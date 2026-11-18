// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildEditionCalendar, buildSaleCalendar, saleFilename } from "./calendar-export";
import { buildTimeline, type SaleRecord } from "./timeline-logic";
import { saleWindows as belgiumSaleWindows } from "@/data/belgium";
import { winterSaleWindows } from "@/data/winter";
import { brasilSaleWindows } from "@/data/brasil";

/**
 * The calendar export tested against the real data, not a fixture.
 *
 * The unit tests in this folder use a representative sale; this one proves the
 * export works for every edition's actual records, which is what a reader clicks.
 */

const NOW = new Date("2026-11-18T15:45:00Z");

function recordsOf(
  windows: readonly {
    id: string;
    name: string;
    audience: string;
    notes?: string;
    opensAt: string;
    source: { url: string };
    lastVerified: string;
  }[],
): readonly SaleRecord[] {
  return windows.map((window) => ({
    id: window.id,
    name: window.name,
    audience: window.audience,
    ...(window.notes === undefined ? {} : { notes: window.notes }),
    opensAt: window.opensAt,
    source: { url: window.source.url },
    lastVerified: window.lastVerified,
  }));
}

/** Counts occurrences of a substring in a string. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const editions = [
  { name: "belgium", windows: belgiumSaleWindows },
  { name: "winter", windows: winterSaleWindows },
  { name: "brasil", windows: brasilSaleWindows },
] as const;

describe("every published edition produces a valid calendar", () => {
  for (const edition of editions) {
    it(`${edition.name}: one calendar, one event per sale, two reminders each`, () => {
      const records = recordsOf(edition.windows);
      const timeline = buildTimeline(records, edition.name, NOW);
      const calendar = buildEditionCalendar(timeline, NOW);

      // The wrapper is present exactly once.
      expect(count(calendar, "BEGIN:VCALENDAR")).toBe(1);
      expect(count(calendar, "END:VCALENDAR")).toBe(1);
      expect(calendar.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
      expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);

      // One event per sale, with no stray blocks.
      expect(count(calendar, "BEGIN:VEVENT")).toBe(records.length);
      expect(count(calendar, "END:VEVENT")).toBe(records.length);

      // Two alarms per event: 30 minutes and a day before.
      expect(count(calendar, "BEGIN:VALARM")).toBe(records.length * 2);
      expect(count(calendar, "TRIGGER:-PT30M")).toBe(records.length);
      expect(count(calendar, "TRIGGER:-PT1440M")).toBe(records.length);

      // Every event carries the required properties.
      expect(count(calendar, "UID:")).toBe(records.length);
      expect(count(calendar, "DTSTART:")).toBe(records.length);
      expect(count(calendar, "DTEND:")).toBe(records.length);
      expect(count(calendar, "SUMMARY:")).toBeGreaterThanOrEqual(records.length);
    });
  }

  it("writes every date-time as UTC, never as a local time", () => {
    const timeline = buildTimeline(recordsOf(belgiumSaleWindows), "belgium", NOW);
    const calendar = buildEditionCalendar(timeline, NOW);

    const stamps = calendar.match(/DT(?:START|END|STAMP):[^\r]+/g) ?? [];
    expect(stamps.length).toBeGreaterThan(0);
    for (const stamp of stamps) {
      expect(stamp).toMatch(/^DT(START|END|STAMP):\d{8}T\d{6}Z$/);
    }
  });

  it("keeps every line inside the 75-octet limit, even with the real notes", () => {
    const encoder = new TextEncoder();
    for (const edition of editions) {
      const timeline = buildTimeline(recordsOf(edition.windows), edition.name, NOW);
      const calendar = buildEditionCalendar(timeline, NOW);
      for (const line of calendar.slice(0, -2).split("\r\n")) {
        expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      }
    }
  });

  it("converts the Brussels opening time to the right UTC instant", () => {
    // The first Belgium sale opens at 17:00 at +01:00, which is 16:00 UTC.
    const timeline = buildTimeline(recordsOf(belgiumSaleWindows), "belgium", NOW);
    const first = timeline[0];
    const calendar = buildSaleCalendar(first, NOW);
    expect(calendar).toContain("DTSTART:20270130T160000Z");
  });

  it("converts a Brasil opening time, which is year-round UTC-03:00", () => {
    const timeline = buildTimeline(recordsOf(brasilSaleWindows), "brasil", NOW);
    const first = timeline[0];
    const calendar = buildSaleCalendar(first, NOW);
    // 10:00 at -03:00 is 13:00 UTC.
    expect(calendar).toContain("T130000Z");
  });

  it("names the file safely for each edition", () => {
    const timeline = buildTimeline(recordsOf(winterSaleWindows), "winter", NOW);
    const name = saleFilename(timeline[0]);
    expect(name).toMatch(/^[a-z0-9-]+\.ics$/);
    expect(name.length).toBeLessThanOrEqual(60);
  });
});
