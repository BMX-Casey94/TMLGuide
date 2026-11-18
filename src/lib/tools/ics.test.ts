// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildIcs, icsFilename, type IcsEvent } from "./ics";

const encoder = new TextEncoder();
const now = new Date("2026-11-18T15:45:00Z");

function eventOf(overrides: Partial<IcsEvent> = {}): IcsEvent {
  return {
    uid: "event-1",
    summary: "Mainstage",
    startIso: "2027-07-18T20:00:00Z",
    ...overrides,
  };
}

function linesOf(calendar: string): string[] {
  // The generator's contract is CRLF throughout, with a trailing CRLF.
  expect(calendar.endsWith("\r\n")).toBe(true);
  expect(calendar).not.toMatch(/[^\r]\n/);
  return calendar.slice(0, -2).split("\r\n");
}

function unfold(calendar: string): string {
  return linesOf(calendar).join("\r\n").replace(/\r\n /g, "");
}

describe("buildIcs structure", () => {
  it("writes the required calendar properties in order with CRLF endings", () => {
    const calendar = buildIcs({
      productId: "-//TMLGUIDE//Planning tools//EN",
      events: [eventOf()],
      now,
    });

    const lines = linesOf(calendar);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines[1]).toBe("VERSION:2.0");
    expect(lines[2]).toBe("PRODID:-//TMLGUIDE//Planning tools//EN");
    expect(lines[3]).toBe("CALSCALE:GREGORIAN");
    expect(lines[4]).toBe("METHOD:PUBLISH");
    expect(lines[lines.length - 1]).toBe("END:VCALENDAR");
    expect(calendar).toContain("\r\nBEGIN:VEVENT\r\n");
    expect(calendar).toContain("\r\nEND:VEVENT\r\n");
  });

  it("writes UTC date-times, a DTSTAMP and a one-hour default duration", () => {
    const calendar = buildIcs({ productId: "p", events: [eventOf()], now });
    expect(calendar).toContain("DTSTART:20270718T200000Z");
    expect(calendar).toContain("DTEND:20270718T210000Z");
    expect(calendar).toContain("DTSTAMP:20261118T154500Z");
    expect(calendar).toContain("UID:event-1");
    expect(calendar).toContain("SUMMARY:Mainstage");
    expect(calendar).toContain("CALSCALE:GREGORIAN");
  });

  it("converts an offset start to UTC", () => {
    const calendar = buildIcs({
      productId: "p",
      events: [eventOf({ startIso: "2027-07-18T22:00:00+02:00" })],
      now,
    });
    expect(calendar).toContain("DTSTART:20270718T200000Z");
  });

  it("honours an explicit end and optional text fields", () => {
    const calendar = buildIcs({
      productId: "p",
      events: [
        eventOf({
          description: "Line one\nLine two",
          location: "Boom, Belgium",
          endIso: "2027-07-19T01:30:00Z",
          url: "https://example.test/tickets?a=1,b=2",
        }),
      ],
      now,
    });

    expect(calendar).toContain("DTEND:20270719T013000Z");
    expect(calendar).toContain("DESCRIPTION:Line one\\nLine two");
    expect(calendar).toContain("LOCATION:Boom\\, Belgium");
    // URI values keep their commas and semicolons.
    expect(calendar).toContain("URL:https://example.test/tickets?a=1,b=2");
  });

  it("emits one VALARM per reminder, sorted and de-duplicated", () => {
    const calendar = buildIcs({
      productId: "p",
      events: [eventOf({ alarmMinutesBefore: [60, 15, 60, 1440] })],
      now,
    });

    const lines = linesOf(calendar);
    const triggers = lines.filter((line) => line.startsWith("TRIGGER:"));
    expect(triggers).toEqual(["TRIGGER:-PT15M", "TRIGGER:-PT60M", "TRIGGER:-PT1440M"]);
    expect(lines.filter((line) => line === "BEGIN:VALARM")).toHaveLength(3);
    expect(lines.filter((line) => line === "END:VALARM")).toHaveLength(3);
    expect(lines.filter((line) => line === "ACTION:DISPLAY")).toHaveLength(3);
    expect(calendar).toContain("DESCRIPTION:Reminder: Mainstage");
  });

  it("writes no alarm when none is requested", () => {
    const calendar = buildIcs({ productId: "p", events: [eventOf()], now });
    expect(calendar).not.toContain("VALARM");
  });

  it("handles several events", () => {
    const calendar = buildIcs({
      productId: "p",
      events: [
        eventOf({ uid: "a", summary: "One" }),
        eventOf({ uid: "b", summary: "Two" }),
        eventOf({ uid: "c", summary: "Three" }),
      ],
      now,
    });
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(calendar.match(/END:VEVENT/g)).toHaveLength(3);
  });
});

describe("buildIcs escaping and folding", () => {
  it("escapes backslashes, semicolons, commas and newlines", () => {
    const calendar = buildIcs({
      productId: "p",
      events: [eventOf({ summary: "a\\b;c,d\ne\r\nf" })],
      now,
    });
    expect(calendar).toContain("SUMMARY:a\\\\b\\;c\\,d\\ne\\nf");
    expect(calendar).not.toMatch(/SUMMARY:[^\r]*[\r]\n[ \t][^\r]*[;]/);
  });

  it("folds lines at 75 octets and never splits a multi-byte character", () => {
    const summary = `Tëst 🎉 ${"é".repeat(120)}`;
    const calendar = buildIcs({ productId: "p", events: [eventOf({ summary })], now });

    for (const line of linesOf(calendar)) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }

    // Unfolding restores the escaped value exactly.
    expect(unfold(calendar)).toContain(`SUMMARY:${summary}`);
  });

  it("keeps every fold boundary on a character boundary for emoji-only text", () => {
    const summary = "🎉".repeat(40);
    const calendar = buildIcs({ productId: "p", events: [eventOf({ summary })], now });

    const raw = linesOf(calendar);
    for (const line of raw) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      // A lone surrogate would survive in a broken split; the encoder replaces
      // it with U+FFFD, so check the decoded text round-trips.
      expect(new TextDecoder("utf-8", { fatal: true }).decode(encoder.encode(line))).toBe(line);
    }
    expect(unfold(calendar)).toContain(`SUMMARY:${summary}`);
  });

  it("never splits an escape pair across a fold", () => {
    // Padding chosen so the `\;` escape lands exactly on the fold boundary.
    const summary = `${"a".repeat(66)};b`;
    const calendar = buildIcs({ productId: "p", events: [eventOf({ summary })], now });

    // Unfolding must restore the escaped value exactly, which can only hold if
    // no pair was cut in half.
    expect(unfold(calendar)).toContain(`SUMMARY:${"a".repeat(66)}\\;b`);

    // A line ending in an odd run of backslashes would leave an escape dangling
    // across the fold and corrupt the value once unfolded.
    for (const line of linesOf(calendar)) {
      const trailing = /\\*$/.exec(line)?.[0].length ?? 0;
      expect(trailing % 2).toBe(0);
    }
  });

  it("folds a long description and re-joins it without loss", () => {
    const description = "Tomorrowland planning note. ".repeat(12);
    const calendar = buildIcs({
      productId: "p",
      events: [eventOf({ description })],
      now,
    });
    expect(unfold(calendar)).toContain(`DESCRIPTION:${description}`);
  });
});

describe("buildIcs injection resistance", () => {
  const payloads = [
    "Mainstage\r\nBEGIN:VEVENT",
    "Mainstage\nATTENDEE:mailto:attacker@example.test",
    "Mainstage\r\nATTENDEE:mailto:attacker@example.test\r\n",
    "Mainstage\r\n \r\nACTION:EMAIL",
    "a\u0000b\u0007c",
  ];

  it.each(payloads)("does not let %j start a new property line", (summary) => {
    const calendar = buildIcs({ productId: "p", events: [eventOf({ summary })], now });
    const lines = linesOf(calendar);

    expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines.filter((line) => line === "END:VEVENT")).toHaveLength(1);
    expect(lines.some((line) => line.startsWith("ATTENDEE"))).toBe(false);
    expect(lines.some((line) => line.startsWith("ACTION:EMAIL"))).toBe(false);
    expect(calendar).not.toContain("\u0000");
    expect(calendar).not.toContain("\u0007");
    // Nothing but the calendar wrapper may appear outside the event block.
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines[lines.length - 1]).toBe("END:VCALENDAR");
  });

  it("escapes injection attempts in the description, location and uid", () => {
    const calendar = buildIcs({
      productId: "p",
      events: [
        eventOf({
          uid: "uid\r\nX-WR-CALNAME:Owned",
          description: "line\r\nATTENDEE:mailto:a@b.test",
          location: "Boom\nACTION:EMAIL",
        }),
      ],
      now,
    });
    const lines = linesOf(calendar);
    expect(lines.some((line) => line.startsWith("X-WR-CALNAME"))).toBe(false);
    expect(lines.some((line) => line.startsWith("ATTENDEE"))).toBe(false);
    expect(lines.filter((line) => line.startsWith("ACTION:"))).toHaveLength(0);
    expect(calendar).toContain("UID:uid\\nX-WR-CALNAME:Owned");
  });

  it("strips CR and LF from a URL that tries to break out", () => {
    const calendar = buildIcs({
      productId: "p",
      events: [eventOf({ url: "https://example.test/x\r\nATTENDEE:mailto:a@b.test" })],
      now,
    });
    // The URL parser moves the injection into the path, where the sanitiser
    // flattens it; either way it stays one line.
    const urlLines = linesOf(calendar).filter((line) => line.startsWith("URL:"));
    expect(urlLines).toHaveLength(1);
    expect(urlLines[0]).not.toContain("\r");
    expect(linesOf(calendar).some((line) => line.startsWith("ATTENDEE"))).toBe(false);
  });

  it("rejects a URL that is not http, https or webcal", () => {
    expect(() =>
      buildIcs({ productId: "p", events: [eventOf({ url: "javascript:alert(1)" })], now }),
    ).toThrow(RangeError);
    expect(() =>
      buildIcs({ productId: "p", events: [eventOf({ url: "data:text/html,x" })], now }),
    ).toThrow(RangeError);
    expect(() => buildIcs({ productId: "p", events: [eventOf({ url: "/relative" })], now })).toThrow(
      RangeError,
    );
  });

  it("rejects a URL carrying credentials into a published calendar", () => {
    expect(() =>
      buildIcs({
        productId: "p",
        events: [eventOf({ url: "https://user:secret@example.test/tickets" })],
        now,
      }),
    ).toThrow(RangeError);
  });

  it("escapes a product id that tries to inject properties", () => {
    const calendar = buildIcs({
      productId: "-//T//EN\r\nX-WR-CALNAME:Ideology",
      events: [eventOf()],
      now,
    });
    expect(calendar).toContain("PRODID:-//T//EN\\nX-WR-CALNAME:Ideology");
    expect(calendar).not.toContain("\r\nX-WR-CALNAME");
  });
});

describe("buildIcs validation", () => {
  it("rejects missing or empty required fields", () => {
    expect(() => buildIcs({ productId: "", events: [], now })).toThrow(RangeError);
    expect(() => buildIcs({ productId: "p", events: [eventOf({ uid: " " })], now })).toThrow(
      RangeError,
    );
    expect(() => buildIcs({ productId: "p", events: [eventOf({ summary: "" })], now })).toThrow(
      RangeError,
    );
    expect(() =>
      buildIcs({ productId: "p", events: [{ summary: "x", startIso: "2027-07-18T20:00:00Z", uid: undefined as unknown as string }], now }),
    ).toThrow(RangeError);
  });

  it("rejects invalid dates, offset-less dates and impossible dates", () => {
    expect(() =>
      buildIcs({ productId: "p", events: [eventOf({ startIso: "18/07/2027" })], now }),
    ).toThrow(RangeError);
    expect(() =>
      buildIcs({ productId: "p", events: [eventOf({ startIso: "2027-07-18T20:00:00" })], now }),
    ).toThrow(RangeError);
    expect(() =>
      buildIcs({ productId: "p", events: [eventOf({ startIso: "2027-02-30T20:00:00Z" })], now }),
    ).toThrow(RangeError);
    expect(() =>
      buildIcs({ productId: "p", events: [eventOf({ endIso: "2027-13-01T20:00:00Z" })], now }),
    ).toThrow(RangeError);
  });

  it("rejects an end before the start, but accepts an equal end", () => {
    expect(() =>
      buildIcs({
        productId: "p",
        events: [eventOf({ startIso: "2027-07-18T20:00:00Z", endIso: "2027-07-18T19:59:59Z" })],
        now,
      }),
    ).toThrow(RangeError);
    expect(() =>
      buildIcs({
        productId: "p",
        events: [eventOf({ startIso: "2027-07-18T20:00:00Z", endIso: "2027-07-18T20:00:00Z" })],
        now,
      }),
    ).not.toThrow();
  });

  it("rejects duplicate uids and bad alarm offsets", () => {
    expect(() =>
      buildIcs({
        productId: "p",
        events: [eventOf({ uid: "same" }), eventOf({ uid: "same", summary: "Other" })],
        now,
      }),
    ).toThrow(RangeError);
    expect(() =>
      buildIcs({ productId: "p", events: [eventOf({ alarmMinutesBefore: [-5] })], now }),
    ).toThrow(RangeError);
    expect(() =>
      buildIcs({ productId: "p", events: [eventOf({ alarmMinutesBefore: [1.5] })], now }),
    ).toThrow(RangeError);
  });

  it("rejects an invalid now and a malformed input object", () => {
    expect(() => buildIcs({ productId: "p", events: [], now: new Date(Number.NaN) })).toThrow(
      RangeError,
    );
    expect(() =>
      buildIcs({ productId: "p", events: "x" as unknown as IcsEvent[], now }),
    ).toThrow(RangeError);
  });
});

describe("icsFilename", () => {
  it("produces a lowercase kebab filename", () => {
    expect(icsFilename("Tomorrowland 2027 — Mainstage")).toBe("tomorrowland-2027-mainstage.ics");
    expect(icsFilename("Sale  Opening")).toBe("sale-opening.ics");
    expect(icsFilename("already-kebab")).toBe("already-kebab.ics");
  });

  it("strips path separators and traversal attempts", () => {
    expect(icsFilename("../../etc/passwd")).toBe("etc-passwd.ics");
    expect(icsFilename("C:\\Windows\\System32")).toBe("c-windows-system32.ics");
    expect(icsFilename("a/b\\c")).toBe("a-b-c.ics");
  });

  it("falls back for an empty or unusable name", () => {
    expect(icsFilename("")).toBe("calendar.ics");
    expect(icsFilename("   ")).toBe("calendar.ics");
    expect(icsFilename("!!!")).toBe("calendar.ics");
    expect(icsFilename("🎉🎉")).toBe("calendar.ics");
  });

  it("caps the filename at 60 characters including the extension", () => {
    const name = icsFilename("a".repeat(200));
    expect(name).toBe(`${"a".repeat(56)}.ics`);
    expect(name.length).toBe(60);

    const dashed = icsFilename(`${"word ".repeat(40)}`);
    expect(dashed.length).toBeLessThanOrEqual(60);
    expect(dashed.endsWith(".ics")).toBe(true);
    expect(dashed).not.toContain("--");
    expect(dashed).not.toMatch(/-\.ics$/);
  });
});
