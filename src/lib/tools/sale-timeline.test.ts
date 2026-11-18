// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  compareTimes,
  countdown,
  formatInZone,
  getSaleStatus,
  nextSale,
  type SaleWindow,
} from "./sale-timeline";

function windowOf(id: string, opensAtIso: string): SaleWindow {
  return { id, name: `Window ${id}`, opensAtIso };
}

describe("getSaleStatus", () => {
  it("reports upcoming before the opening instant and open at or after it", () => {
    const window = windowOf("w1", "2027-01-30T16:00:00Z");
    expect(getSaleStatus(window, new Date("2027-01-30T15:59:59.999Z"))).toBe("upcoming");
    expect(getSaleStatus(window, new Date("2027-01-30T16:00:00Z"))).toBe("open");
    expect(getSaleStatus(window, new Date("2027-01-30T16:00:01Z"))).toBe("open");
  });

  it("compares absolute instants, not wall-clock text", () => {
    // 17:00+01:00 is the same instant as 16:00Z.
    const window = windowOf("w1", "2027-01-30T17:00:00+01:00");
    expect(getSaleStatus(window, new Date("2027-01-30T15:59:00Z"))).toBe("upcoming");
    expect(getSaleStatus(window, new Date("2027-01-30T16:00:00Z"))).toBe("open");
  });

  it("accepts an offset written without a colon", () => {
    const window = windowOf("w1", "2027-01-30T17:00:00+0100");
    expect(getSaleStatus(window, new Date("2027-01-30T15:59:00Z"))).toBe("upcoming");
    expect(getSaleStatus(window, new Date("2027-01-30T16:00:00Z"))).toBe("open");
  });

  it("accepts the space separator a database may emit, but still demands an offset", () => {
    const window = windowOf("w1", "2027-01-30 16:00:00Z");
    expect(getSaleStatus(window, new Date("2027-01-30T15:59:00Z"))).toBe("upcoming");
    expect(() =>
      getSaleStatus(windowOf("w1", "2027-01-30 16:00:00"), new Date("2027-01-01T00:00:00Z")),
    ).toThrow(RangeError);
  });

  it("rejects unparseable instants and instants without an offset", () => {
    expect(() =>
      getSaleStatus(windowOf("w1", "2027-01-30T16:00:00"), new Date("2027-01-01T00:00:00Z")),
    ).toThrow(RangeError);
    expect(() =>
      getSaleStatus(windowOf("w1", "next saturday"), new Date("2027-01-01T00:00:00Z")),
    ).toThrow(RangeError);
    expect(() =>
      getSaleStatus(windowOf("w1", "2027-02-30T16:00:00Z"), new Date("2027-01-01T00:00:00Z")),
    ).toThrow(RangeError);
    expect(() =>
      getSaleStatus(windowOf("w1", "2027-01-30T16:00:00Z"), new Date("not a date")),
    ).toThrow(RangeError);
  });
});

describe("countdown", () => {
  const opensAt = "2027-01-30T16:00:00Z";

  it("breaks a distance into days, hours, minutes and seconds", () => {
    expect(countdown(opensAt, new Date("2026-11-18T15:45:00Z"))).toEqual({
      // 73 days plus 15 minutes.
      totalSeconds: 6_308_100,
      days: 73,
      hours: 0,
      minutes: 15,
      seconds: 0,
      isPast: false,
    });
  });

  it("handles the exact opening instant and times after it", () => {
    expect(countdown(opensAt, new Date(opensAt))).toEqual({
      totalSeconds: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: true,
    });

    const after = countdown(opensAt, new Date("2027-01-31T16:00:01Z"));
    expect(after.totalSeconds).toBe(-86_401);
    expect(after.days).toBe(1);
    expect(after.hours).toBe(0);
    expect(after.minutes).toBe(0);
    expect(after.seconds).toBe(1);
    expect(after.isPast).toBe(true);
  });

  it("returns unit fields that are never negative", () => {
    const past = countdown(opensAt, new Date("2027-03-05T00:00:30Z"));
    expect(past.totalSeconds).toBeLessThan(0);
    for (const value of [past.days, past.hours, past.minutes, past.seconds]) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(past.hours).toBeLessThan(24);
    expect(past.minutes).toBeLessThan(60);
    expect(past.seconds).toBeLessThan(60);
  });

  it("counts whole seconds, never showing a negative zero", () => {
    expect(countdown(opensAt, new Date("2027-01-30T15:59:59.500Z")).totalSeconds).toBe(0);
    // Half a second past the opening is already one whole second past it.
    expect(countdown(opensAt, new Date("2027-01-30T16:00:00.500Z")).totalSeconds).toBe(-1);
    expect(countdown(opensAt, new Date("2027-01-30T16:00:00.500Z")).seconds).toBe(1);
  });

  it("rejects unparseable instants", () => {
    expect(() => countdown("2027-01-30T16:00:00", new Date())).toThrow(RangeError);
    expect(() => countdown(opensAt, new Date(Number.NaN))).toThrow(RangeError);
    expect(() => countdown("", new Date())).toThrow(RangeError);
  });
});

describe("formatInZone", () => {
  it("shows winter time in London as GMT and in Brussels as CET", () => {
    const instant = "2027-01-30T16:00:00Z";
    expect(formatInZone(instant, "Europe/London")).toBe("Sat 30 Jan 2027, 16:00 GMT");
    expect(formatInZone(instant, "Europe/Brussels")).toBe("Sat 30 Jan 2027, 17:00 CET");
  });

  it("shows summer time in London as BST and in Brussels as CEST", () => {
    const instant = "2027-07-01T12:00:00Z";
    expect(formatInZone(instant, "Europe/London")).toBe("Thu 01 Jul 2027, 13:00 BST");
    expect(formatInZone(instant, "Europe/Brussels")).toBe("Thu 01 Jul 2027, 14:00 CEST");
  });

  it("keeps the one-hour gap across the end-of-March change", () => {
    // Both zones switch at 01:00 UTC on the last Sunday of March, so the gap
    // stays at one hour either side of the change; only the labels move.
    expect(formatInZone("2027-03-28T00:30:00Z", "Europe/London")).toBe("Sun 28 Mar 2027, 00:30 GMT");
    expect(formatInZone("2027-03-28T00:30:00Z", "Europe/Brussels")).toBe("Sun 28 Mar 2027, 01:30 CET");
    expect(formatInZone("2027-03-28T01:30:00Z", "Europe/London")).toBe("Sun 28 Mar 2027, 02:30 BST");
    expect(formatInZone("2027-03-28T01:30:00Z", "Europe/Brussels")).toBe("Sun 28 Mar 2027, 03:30 CEST");
  });

  it("handles the end-of-October change", () => {
    // Both zones leave summer time at 01:00 UTC on the last Sunday of October.
    expect(formatInZone("2027-10-31T00:30:00Z", "Europe/London")).toBe("Sun 31 Oct 2027, 01:30 BST");
    expect(formatInZone("2027-10-31T00:30:00Z", "Europe/Brussels")).toBe(
      "Sun 31 Oct 2027, 02:30 CEST",
    );
    expect(formatInZone("2027-10-31T01:30:00Z", "Europe/London")).toBe("Sun 31 Oct 2027, 01:30 GMT");
    expect(formatInZone("2027-10-31T01:30:00Z", "Europe/Brussels")).toBe("Sun 31 Oct 2027, 02:30 CET");
  });

  it("honours the locale argument", () => {
    expect(formatInZone("2027-01-30T16:00:00Z", "Europe/Brussels", "en-GB")).toContain("17:00");
    expect(formatInZone("2027-01-30T16:00:00Z", "Europe/London", "en-GB")).toContain("GMT");
    expect(formatInZone("2027-01-30T16:00:00Z", "Europe/London", "de-DE")).toContain("16:00");
  });

  it("rejects invalid instants and unknown zones", () => {
    expect(() => formatInZone("2027-01-30T16:00:00", "Europe/London")).toThrow(RangeError);
    expect(() => formatInZone("2027-01-30T16:00:00Z", "Not/AZone")).toThrow(RangeError);
    expect(() => formatInZone("2027-13-30T16:00:00Z", "Europe/London")).toThrow(RangeError);
  });
});

describe("compareTimes", () => {
  it("reports both zones and whether their calendar day differs", () => {
    const comparison = compareTimes("2027-03-27T23:30:00Z");
    expect(comparison.london).toBe("Sat 27 Mar 2027, 23:30 GMT");
    expect(comparison.brussels).toBe("Sun 28 Mar 2027, 00:30 CET");
    expect(comparison.londonDate).toBe("2027-03-27");
    expect(comparison.brusselsDate).toBe("2027-03-28");
    expect(comparison.dayDiffers).toBe(true);
  });

  it("reports a shared calendar day for a midday instant", () => {
    const comparison = compareTimes("2027-01-30T12:00:00Z");
    expect(comparison.londonDate).toBe("2027-01-30");
    expect(comparison.brusselsDate).toBe("2027-01-30");
    expect(comparison.dayDiffers).toBe(false);
    expect(comparison.london).toBe("Sat 30 Jan 2027, 12:00 GMT");
    expect(comparison.brussels).toBe("Sat 30 Jan 2027, 13:00 CET");
  });

  it("flags a day boundary at the turn of the year", () => {
    const comparison = compareTimes("2026-12-31T23:30:00Z");
    expect(comparison.londonDate).toBe("2026-12-31");
    expect(comparison.brusselsDate).toBe("2027-01-01");
    expect(comparison.dayDiffers).toBe(true);
  });

  it("rejects invalid instants", () => {
    expect(() => compareTimes("2027-01-30")).toThrow(RangeError);
    expect(() => compareTimes("2027-01-30T12:00:00")).toThrow(RangeError);
  });
});

describe("nextSale", () => {
  const now = new Date("2026-11-18T15:45:00Z");

  it("returns the soonest upcoming window", () => {
    const windows = [
      windowOf("late", "2027-03-01T10:00:00Z"),
      windowOf("soon", "2027-01-30T16:00:00Z"),
      windowOf("past", "2026-10-01T10:00:00Z"),
    ];
    expect(nextSale(windows, now)?.id).toBe("soon");
  });

  it("returns null when every window has opened, or the list is empty", () => {
    expect(nextSale([windowOf("past", "2026-10-01T10:00:00Z")], now)).toBeNull();
    expect(nextSale([], now)).toBeNull();
    // A window opening exactly now has already opened.
    expect(nextSale([windowOf("now", "2026-11-18T15:45:00Z")], now)).toBeNull();
  });

  it("breaks ties by id so the answer is stable", () => {
    const windows = [
      windowOf("b", "2027-01-30T16:00:00Z"),
      windowOf("a", "2027-01-30T17:00:00+01:00"),
    ];
    expect(nextSale(windows, now)?.id).toBe("a");
    expect(nextSale([...windows].reverse(), now)?.id).toBe("a");
  });

  it("does not mutate the input list", () => {
    const windows = [
      windowOf("late", "2027-03-01T10:00:00Z"),
      windowOf("soon", "2027-01-30T16:00:00Z"),
    ];
    const copy = [...windows];
    nextSale(windows, now);
    expect(windows).toEqual(copy);
  });

  it("rejects invalid windows rather than skipping them", () => {
    expect(() => nextSale([windowOf("bad", "2027-02-30T10:00:00Z")], now)).toThrow(RangeError);
    expect(() => nextSale([windowOf("bad", "2027-03-01T10:00:00")], now)).toThrow(RangeError);
    expect(() => nextSale("nope" as unknown as SaleWindow[], now)).toThrow(RangeError);
  });
});
