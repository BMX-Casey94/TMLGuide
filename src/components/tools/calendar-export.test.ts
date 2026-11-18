// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  SALE_REMINDERS_MINUTES,
  buildEditionCalendar,
  buildSaleCalendar,
  saleToEvent,
} from "./calendar-export";
import type { TimelineSale } from "./timeline-logic";

/**
 * A minimal RFC 5545 reader, written here rather than pulled in as a dependency.
 *
 * It parses the calendar into properties and events, unfolding continuation
 * lines first, which is the operation a real client performs. Using it to check
 * the generator is the point: it proves the file is a well-formed calendar rather
 * than a string that merely contains the right words.
 */
interface ParsedProperty {
  readonly name: string;
  readonly value: string;
}

interface ParsedEvent {
  readonly properties: readonly ParsedProperty[];
  readonly alarms: readonly (readonly ParsedProperty[])[];
}

interface ParsedCalendar {
  readonly properties: readonly ParsedProperty[];
  readonly events: readonly ParsedEvent[];
}

/** Splits a content line into its name and value at the first unescaped colon. */
function parseProperty(line: string): ParsedProperty {
  const colon = line.indexOf(":");
  if (colon < 0) throw new Error(`property line has no colon: ${JSON.stringify(line)}`);
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  // Parameters (for example DTSTART;TZID=...) are kept with the name, which is
  // enough for the assertions here; this generator never writes parameters.
  return { name: head.toUpperCase(), value };
}

/**
 * Unfolds a calendar: every CRLF followed by a single space continues the
 * previous line. Lines must be terminated with CRLF, never a bare LF.
 */
function unfold(calendar: string): string {
  if (!calendar.endsWith("\r\n")) throw new Error("the calendar does not end with CRLF");
  if (/[^\r]\n/.test(calendar)) throw new Error("the calendar contains a bare LF");
  return calendar.slice(0, -2).replace(/\r\n[ \t]/g, "");
}

function parseCalendar(calendar: string): ParsedCalendar {
  const lines = unfold(calendar).split("\r\n");

  if (lines[0] !== "BEGIN:VCALENDAR") throw new Error("the calendar does not begin correctly");
  if (lines[lines.length - 1] !== "END:VCALENDAR") throw new Error("the calendar does not end correctly");

  const properties: ParsedProperty[] = [];
  const events: ParsedEvent[] = [];

  let depth = 0;
  let current: { properties: ParsedProperty[]; alarms: ParsedProperty[][] } | null = null;
  let currentAlarm: ParsedProperty[] | null = null;

  for (const line of lines.slice(1, -1)) {
    if (line === "BEGIN:VEVENT") {
      depth = 1;
      current = { properties: [], alarms: [] };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current === null) throw new Error("END:VEVENT without a matching BEGIN");
      events.push({ properties: current.properties, alarms: current.alarms });
      current = null;
      depth = 0;
      continue;
    }
    if (line === "BEGIN:VALARM") {
      currentAlarm = [];
      continue;
    }
    if (line === "END:VALARM") {
      if (current === null || currentAlarm === null) throw new Error("END:VALARM misplaced");
      current.alarms.push(currentAlarm);
      currentAlarm = null;
      continue;
    }

    const property = parseProperty(line);
    if (currentAlarm !== null) {
      currentAlarm.push(property);
    } else if (current !== null && depth === 1) {
      current.properties.push(property);
    } else {
      properties.push(property);
    }
  }

  return { properties, events };
}

function property(event: ParsedEvent, name: string): string | undefined {
  return event.properties.find((entry) => entry.name === name)?.value;
}

const sale: TimelineSale = {
  id: "worldwide-ticket-sale",
  name: "WorldWide Ticket Sale",
  audience: "Everyone who pre-registered",
  notes: "General sale of tickets and DreamVille packages, with a comma, a semicolon and a line\nbreak.",
  opensAtIso: "2027-02-13T17:00:00+01:00",
  sourceZone: "Europe/Brussels",
  status: "upcoming",
  sourceUrl: "https://faq.tomorrowland.com/hc/en-us/articles/360037219532",
  lastVerified: "2026-11-18",
  calendarUid: "worldwide-ticket-sale@tmlguide.com",
  calendarSummary: "WorldWide Ticket Sale — Tomorrowland Belgium",
};

describe("saleToEvent", () => {
  it("uses UTC instants so the reader's calendar shows the right local time", () => {
    const event = saleToEvent(sale);
    // 17:00 at +01:00 is 16:00 UTC.
    expect(event.startIso).toBe("2027-02-13T16:00:00.000Z");
    expect(event.endIso).toBe("2027-02-13T16:30:00.000Z");
  });

  it("carries the two reminders the brief requires", () => {
    const event = saleToEvent(sale);
    expect(event.alarmMinutesBefore).toEqual([30, 1440]);
    expect(SALE_REMINDERS_MINUTES).toEqual([30, 24 * 60]);
  });

  it("points the event at the official page", () => {
    expect(saleToEvent(sale).url).toBe(sale.sourceUrl);
  });

  it("refuses an invalid opening instant rather than exporting the epoch", () => {
    expect(() => saleToEvent({ ...sale, opensAtIso: "not-an-instant" })).toThrow(RangeError);
  });
});

describe("the generated calendar", () => {
  const now = new Date("2026-11-18T15:45:00Z");

  it("parses as a well-formed VCALENDAR", () => {
    const parsed = parseCalendar(buildSaleCalendar(sale, now));

    const version = parsed.properties.find((entry) => entry.name === "VERSION")?.value;
    const prodId = parsed.properties.find((entry) => entry.name === "PRODID")?.value;
    const calscale = parsed.properties.find((entry) => entry.name === "CALSCALE")?.value;

    expect(version).toBe("2.0");
    expect(prodId).toBe("-//TMLGuide//Sale timeline//EN");
    expect(calscale).toBe("GREGORIAN");
    expect(parsed.events).toHaveLength(1);
  });

  it("writes a single event with a start, an end and a stamp in UTC form", () => {
    const parsed = parseCalendar(buildSaleCalendar(sale, now));
    const event = parsed.events[0];

    expect(property(event, "DTSTART")).toBe("20270213T160000Z");
    expect(property(event, "DTEND")).toBe("20270213T163000Z");
    expect(property(event, "DTSTAMP")).toBe("20261118T154500Z");
    expect(property(event, "SUMMARY")).toBe("WorldWide Ticket Sale — Tomorrowland Belgium");
  });

  it("emits exactly two VALARM blocks with the expected triggers", () => {
    const parsed = parseCalendar(buildSaleCalendar(sale, now));
    const alarms = parsed.events[0].alarms;

    expect(alarms).toHaveLength(2);
    const triggers = alarms.map(
      (alarm) => alarm.find((entry) => entry.name === "TRIGGER")?.value ?? "",
    );
    expect(triggers).toEqual(["-PT30M", "-PT1440M"]);

    for (const alarm of alarms) {
      expect(alarm.find((entry) => entry.name === "ACTION")?.value).toBe("DISPLAY");
      expect(alarm.find((entry) => entry.name === "DESCRIPTION")?.value).toMatch(/^Reminder: /);
    }
  });

  it("escapes commas and newlines so the note cannot break the file", () => {
    const calendar = buildSaleCalendar(sale, now);
    const unfolded = unfold(calendar);
    // The comma and line break in the note are escaped, so the note stays
    // inside one DESCRIPTION property.
    const descriptionLine = unfolded
      .split("\r\n")
      .find((line) => line.startsWith("DESCRIPTION:"));
    expect(descriptionLine).toBeDefined();
    expect(descriptionLine).toContain("\\,");
    expect(descriptionLine).toContain("\\n");
    // Unescaped commas in a property value would be a parameter separator.
    expect(descriptionLine?.split(":").slice(1).join(":")).not.toMatch(/[^\\],/);
  });

  it("escapes a semicolon in a value", () => {
    const withSemicolon: TimelineSale = { ...sale, notes: "Bring ID; bring a card." };
    const unfolded = unfold(buildSaleCalendar(withSemicolon, now));
    expect(unfolded).toContain("Bring ID\\; bring a card.");
  });

  it("keeps every line within 75 octets so a long note folds legally", () => {
    const long: TimelineSale = { ...sale, notes: "A long note. ".repeat(40) };
    const calendar = buildSaleCalendar(long, now);
    const encoder = new TextEncoder();

    expect(calendar.endsWith("\r\n")).toBe(true);
    for (const line of calendar.slice(0, -2).split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // Folding must not lose the text.
    expect(unfold(calendar)).toContain("A long note.");
  });

  it("holds one event per sale in the edition calendar", () => {
    const second: TimelineSale = { ...sale, id: "pre-sale", name: "Pre-Sale", opensAtIso: "2027-02-06T17:00:00+01:00" };
    const parsed = parseCalendar(buildEditionCalendar([sale, second], now));

    expect(parsed.events).toHaveLength(2);
    const starts = parsed.events.map((event) => property(event, "DTSTART")).sort();
    expect(starts).toEqual(["20270206T160000Z", "20270213T160000Z"]);
  });

  it("refuses a list holding the same sale twice", () => {
    // The UID is derived from the sale id and its instant, so a duplicated
    // record would collide. The writer rejects that rather than emitting two
    // events a calendar would treat as one.
    expect(() => buildEditionCalendar([sale, sale], now)).toThrow(RangeError);
  });
});
