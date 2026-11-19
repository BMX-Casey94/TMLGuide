// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  formatCheckedDate,
  formatEuroAmount,
  formatLongCheckedDate,
  formatMomentInUkTime,
  formatMomentInZone,
  formatReaisAmount,
  statusAsAt,
  zonedMoment,
} from "./format";

describe("check dates", () => {
  it("formats a date-only value in en-GB without shifting the day", () => {
    expect(formatCheckedDate("2026-11-18")).toBe("18 Nov 2026");
    expect(formatCheckedDate("2027-03-01")).toBe("1 Mar 2027");
  });

  it("takes the calendar day of a timestamp, not the UTC offset's day", () => {
    expect(formatCheckedDate("2026-11-18T23:30:00Z")).toBe("18 Nov 2026");
  });

  it("returns null for anything unparseable", () => {
    expect(formatCheckedDate("not-a-date")).toBeNull();
    expect(formatCheckedDate("")).toBeNull();
  });

  it("spells the month out in full for the chapter header", () => {
    expect(formatLongCheckedDate("2026-11-18")).toBe("18 November 2026");
    expect(formatLongCheckedDate("2027-03-01")).toBe("1 March 2027");
    // September is the one ICU versions disagree about; the table settles it.
    expect(formatLongCheckedDate("2026-09-24")).toBe("24 September 2026");
  });

  it("returns null from the long formatter for anything unparseable", () => {
    expect(formatLongCheckedDate("nonsense")).toBeNull();
  });
});

describe("money", () => {
  it("formats a euro amount through the shared money helpers", () => {
    expect(formatEuroAmount(144)).toBe("€144.00");
    expect(formatEuroAmount(5707)).toBe("€5,707.00");
  });

  it("keeps cents when a price genuinely has them", () => {
    expect(formatEuroAmount(13.5)).toBe("€13.50");
  });

  it("formats reais in Brazilian Portuguese", () => {
    // `pt-BR` puts a non-breaking space after the symbol, which is correct for a
    // price that must not wrap across two lines. The assertion normalises it.
    const flat = (value: string) => value.replace(/\u00a0/g, " ");
    expect(flat(formatReaisAmount(3160))).toBe("R$ 3.160,00");
    expect(flat(formatReaisAmount(51819))).toBe("R$ 51.819,00");
    expect(formatReaisAmount(3160)).toContain("\u00a0");
  });

  it("refuses a non-finite reais amount rather than printing NaN", () => {
    expect(() => formatReaisAmount(Number.NaN)).toThrow(RangeError);
    expect(() => formatReaisAmount(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("never converts between currencies", () => {
    // The two formatters are independent: no euro figure appears in the reais output.
    expect(formatReaisAmount(1000)).not.toContain("€");
    expect(formatEuroAmount(1000)).not.toContain("R$");
  });
});

describe("zoned moments", () => {
  it("reads an instant in the zone the record names", () => {
    expect(formatMomentInZone("2027-01-30T17:00:00+01:00", "Europe/Brussels")).toBe(
      "Sat 30 Jan 2027, 17:00 CET",
    );
  });

  it("reads the same instant in UK time", () => {
    expect(formatMomentInUkTime("2027-01-30T17:00:00+01:00")).toBe("30 Jan 2027, 16:00 GMT");
  });

  it("keeps a summer instant on British Summer Time", () => {
    expect(formatMomentInUkTime("2027-07-16T17:00:00+02:00")).toBe("16 Jul 2027, 16:00 BST");
  });

  it("reads a Brasil instant in São Paulo time", () => {
    expect(formatMomentInZone("2026-09-24T10:00:00-03:00", "America/Sao_Paulo")).toBe(
      "Thu 24 Sep 2026, 10:00 GMT-3",
    );
  });

  it("pins the month abbreviation rather than following the ICU build", () => {
    // en-GB renders September as "Sept" in some ICU versions; the page says "Sep".
    expect(zonedMoment("2026-09-24T10:00:00-03:00", "America/Sao_Paulo").date).toContain("Sep");
    expect(zonedMoment("2026-09-24T10:00:00-03:00", "America/Sao_Paulo").date).not.toContain("Sept");
  });

  it("uses a 24-hour clock at every hour", () => {
    expect(zonedMoment("2027-01-30T00:05:00+01:00", "Europe/Brussels").time).toBe("00:05");
    expect(zonedMoment("2027-01-30T12:00:00+01:00", "Europe/Brussels").time).toBe("12:00");
    expect(zonedMoment("2027-01-30T23:59:00+01:00", "Europe/Brussels").time).toBe("23:59");
  });

  it("throws for an unparseable instant rather than printing Invalid Date", () => {
    expect(() => zonedMoment("not-an-instant", "Europe/Brussels")).toThrow(RangeError);
  });

  it("throws for a zone the runtime does not know", () => {
    expect(() => zonedMoment("2027-01-30T17:00:00+01:00", "Mars/Olympus")).toThrow(RangeError);
  });

  it("crosses a date boundary between zones correctly", () => {
    // 23:30 in Brussels on 30 January is still 22:30 in London on the same day.
    expect(formatMomentInUkTime("2027-01-30T23:30:00+01:00")).toBe("30 Jan 2027, 22:30 GMT");
    // 00:30 in Brussels is 23:30 the previous day in London.
    expect(formatMomentInUkTime("2027-01-31T00:30:00+01:00")).toBe("30 Jan 2027, 23:30 GMT");
  });
});

describe("sale status", () => {
  it("calls a window that opened before the check date past", () => {
    expect(statusAsAt("2026-09-24T10:00:00-03:00", "2026-11-18")).toBe("past");
  });

  it("calls a window still ahead of the check date upcoming", () => {
    expect(statusAsAt("2027-02-06T17:00:00+01:00", "2026-11-18")).toBe("upcoming");
  });

  it("reads the same answer twice, because the reference is a stored date and not a clock", () => {
    const first = statusAsAt("2027-01-30T17:00:00+01:00", "2026-11-18");
    const second = statusAsAt("2027-01-30T17:00:00+01:00", "2026-11-18");
    expect(first).toBe(second);
  });

  it("falls back to upcoming for an unparseable instant rather than claiming a past sale", () => {
    expect(statusAsAt("nonsense", "2026-11-18")).toBe("upcoming");
  });
});
