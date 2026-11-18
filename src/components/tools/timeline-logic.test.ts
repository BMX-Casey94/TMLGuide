// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  EDITION_SALE_ZONE,
  SALE_OPEN_WINDOW_MS,
  buildTimeline,
  countdownTarget,
  describeSaleTime,
  saleStatusAt,
  type SaleRecord,
} from "./timeline-logic";

const NOW = new Date("2026-11-18T15:45:00Z");

function recordOf(id: string, opensAt: string): SaleRecord {
  return {
    id,
    name: `Sale ${id}`,
    audience: "General sale",
    opensAt,
    source: { url: "https://example.test/sale" },
    lastVerified: "2026-11-18",
  };
}

describe("saleStatusAt", () => {
  it("reports a sale ahead of now as upcoming", () => {
    expect(saleStatusAt("2027-01-30T17:00:00+01:00", NOW)).toBe("upcoming");
  });

  it("reports a sale that opened within the last day as open", () => {
    const justOpened = new Date(NOW.getTime() - 60_000).toISOString();
    expect(saleStatusAt(justOpened, NOW)).toBe("open");
  });

  it("reports a sale beyond the open window as past", () => {
    const longAgo = new Date(NOW.getTime() - SALE_OPEN_WINDOW_MS - 1000).toISOString();
    expect(saleStatusAt(longAgo, NOW)).toBe("past");
  });

  it("treats the exact opening instant as open, not past", () => {
    expect(saleStatusAt(NOW.toISOString(), NOW)).toBe("open");
  });

  it("compares instants, not wall-clock text", () => {
    // 17:00 at +01:00 is the same instant as 16:00Z, which is after 15:45Z.
    expect(saleStatusAt("2026-11-18T17:00:00+01:00", NOW)).toBe("upcoming");
    // 16:30 at +01:00 is 15:30Z, which is before 15:45Z.
    expect(saleStatusAt("2026-11-18T16:30:00+01:00", NOW)).toBe("open");
  });

  it("rejects an instant without an offset", () => {
    expect(() => saleStatusAt("2027-01-30T17:00:00", NOW)).toThrow(RangeError);
  });
});

describe("buildTimeline", () => {
  it("sorts sales chronologically regardless of the data file's order", () => {
    const timeline = buildTimeline(
      [
        recordOf("late", "2027-03-01T10:00:00Z"),
        recordOf("soon", "2027-01-30T16:00:00Z"),
        recordOf("past", "2026-10-01T10:00:00Z"),
      ],
      "belgium",
      NOW,
    );

    expect(timeline.map((sale) => sale.id)).toEqual(["past", "soon", "late"]);
  });

  it("classifies every sale against the same instant", () => {
    const timeline = buildTimeline(
      [recordOf("past", "2026-10-01T10:00:00Z"), recordOf("future", "2027-01-30T16:00:00Z")],
      "belgium",
      NOW,
    );
    expect(timeline[0].status).toBe("past");
    expect(timeline[1].status).toBe("upcoming");
  });

  it("carries the edition's own sale zone", () => {
    const belgium = buildTimeline([recordOf("a", "2027-01-30T16:00:00Z")], "belgium", NOW);
    expect(belgium[0].sourceZone).toBe(EDITION_SALE_ZONE.belgium);
    expect(belgium[0].sourceZone).toBe("Europe/Brussels");

    const brasil = buildTimeline([recordOf("b", "2027-01-30T16:00:00Z")], "brasil", NOW);
    expect(brasil[0].sourceZone).toBe("America/Sao_Paulo");
  });

  it("names the calendar event after the edition", () => {
    const winter = buildTimeline([recordOf("a", "2026-11-26T15:00:00+01:00")], "winter", NOW);
    expect(winter[0].calendarSummary).toContain("Winter");
    expect(winter[0].calendarSummary).toContain("Sale a");
  });
});

describe("countdownTarget", () => {
  it("picks the soonest sale that has not opened", () => {
    const timeline = buildTimeline(
      [
        recordOf("past", "2026-10-01T10:00:00Z"),
        recordOf("soon", "2027-01-30T16:00:00Z"),
        recordOf("later", "2027-02-06T16:00:00Z"),
      ],
      "belgium",
      NOW,
    );
    expect(countdownTarget(timeline, NOW)?.id).toBe("soon");
  });

  it("returns null when every sale has opened", () => {
    const timeline = buildTimeline([recordOf("past", "2026-10-01T10:00:00Z")], "belgium", NOW);
    expect(countdownTarget(timeline, NOW)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(countdownTarget([], NOW)).toBeNull();
  });

  it("treats a sale opening exactly now as already open", () => {
    const timeline = buildTimeline([recordOf("now", NOW.toISOString())], "belgium", NOW);
    expect(countdownTarget(timeline, NOW)).toBeNull();
  });

  it("does not follow an already-open sale, only a future one", () => {
    const opened = new Date(NOW.getTime() - 60_000).toISOString();
    const timeline = buildTimeline(
      [recordOf("open", opened), recordOf("next", "2027-01-30T16:00:00Z")],
      "belgium",
      NOW,
    );
    expect(timeline[0].status).toBe("open");
    expect(countdownTarget(timeline, NOW)?.id).toBe("next");
  });
});

describe("describeSaleTime", () => {
  it("shows the same instant in the reader's zone and in Brussels", () => {
    const described = describeSaleTime("2027-02-13T17:00:00+01:00", "Europe/Brussels");
    expect(described.brussels).toBe("Sat 13 Feb 2027, 17:00 CET");
    expect(described.local).toBe("Sat 13 Feb 2027, 17:00 CET");
  });

  it("shows a different clock in another zone", () => {
    const described = describeSaleTime("2027-02-13T17:00:00+01:00", "Europe/London");
    expect(described.brussels).toContain("17:00");
    expect(described.local).toContain("16:00");
    expect(described.local).toContain("GMT");
  });

  it("flags a different calendar day when the zones disagree", () => {
    // 00:30 Brussels on the morning after the change is still the previous
    // evening in a far-western zone.
    const described = describeSaleTime("2027-03-28T00:30:00+01:00", "America/Los_Angeles");
    expect(described.dayDiffers).toBe(true);
  });

  it("does not flag a day difference when the zones agree", () => {
    const described = describeSaleTime("2027-02-13T17:00:00+01:00", "Europe/Brussels");
    expect(described.dayDiffers).toBe(false);
  });

  it("falls back to Brussels time for an unknown zone", () => {
    const described = describeSaleTime("2027-02-13T17:00:00+01:00", "Not/AZone");
    expect(described.local).toBe(described.brussels);
  });

  it("renders a brasil sale in its own zone", () => {
    const described = describeSaleTime("2026-09-24T10:00:00-03:00", "America/Sao_Paulo");
    expect(described.local).toContain("10:00");
    // Brussels is four hours ahead of São Paulo in September.
    expect(described.brussels).toContain("15:00");
  });
});
