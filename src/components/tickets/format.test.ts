import { describe, expect, it } from "vitest";
import {
  formatCheckedDate,
  formatEuro,
  formatInstantLong,
  formatInstantParts,
  formatInstantProse,
  formatMoney,
  formatReal,
} from "./format";

describe("formatEuro", () => {
  it("formats a whole euro amount with the symbol before the figure", () => {
    expect(formatEuro(144)).toBe("€144.00");
  });

  it("groups thousands", () => {
    expect(formatEuro(5707)).toBe("€5,707.00");
  });

  it("keeps two decimals when a price has cents", () => {
    expect(formatEuro(19.99)).toBe("€19.99");
  });

  it("rejects an amount with more than two decimals rather than rounding it", () => {
    expect(() => formatEuro(19.999)).toThrow(/two decimal/);
  });

  it("rejects a negative amount", () => {
    expect(() => formatEuro(-1)).toThrow();
  });
});

describe("formatReal", () => {
  it("formats reais with the Brazilian grouping and decimal separators", () => {
    // pt-BR uses "." for thousands and "," for decimals; the symbol follows a
    // non-breaking space.
    expect(formatReal(3160).replace(/\u00a0/g, " ")).toBe("R$ 3.160,00");
  });

  it("formats a large package total", () => {
    expect(formatReal(51819).replace(/\u00a0/g, " ")).toBe("R$ 51.819,00");
  });

  it("formats zero without inventing a figure", () => {
    expect(formatReal(0).replace(/\u00a0/g, " ")).toBe("R$ 0,00");
  });

  it("rejects a non-finite amount", () => {
    expect(() => formatReal(Number.NaN)).toThrow(/finite/);
  });
});

describe("formatMoney", () => {
  it("uses euros for a EUR tier", () => {
    expect(formatMoney(735, "EUR")).toBe("€735.00");
  });

  it("uses reais for a BRL tier", () => {
    expect(formatMoney(3160, "BRL").replace(/\u00a0/g, " ")).toBe("R$ 3.160,00");
  });

  it("never converts a reais amount into euros", () => {
    // The same number renders differently per currency; no rate is applied.
    expect(formatMoney(3160, "EUR")).not.toBe(formatMoney(3160, "BRL"));
  });
});

describe("formatCheckedDate", () => {
  it("formats an ISO date as a short English date", () => {
    expect(formatCheckedDate("2026-11-18")).toBe("18 Nov 2026");
  });

  it("keeps the calendar day for a late-evening UTC timestamp", () => {
    expect(formatCheckedDate("2026-11-18T23:30:00Z")).toBe("18 Nov 2026");
  });

  it("returns null for an unparseable value", () => {
    expect(formatCheckedDate("not-a-date")).toBeNull();
  });

  it("returns null for a non-string", () => {
    expect(formatCheckedDate(undefined as unknown as string)).toBeNull();
  });
});

describe("formatInstantParts", () => {
  it("renders a January sale in Belgian winter time", () => {
    const parts = formatInstantParts("2027-01-30T17:00:00+01:00", "Europe/Brussels");

    expect(parts.date).toBe("Sat 30 Jan 2027");
    expect(parts.time).toBe("17:00");
    expect(parts.zone).toBe("CET");
  });

  it("renders the same instant in London an hour earlier, in GMT", () => {
    const parts = formatInstantParts("2027-01-30T17:00:00+01:00", "Europe/London");

    expect(parts.time).toBe("16:00");
    expect(parts.zone).toBe("GMT");
  });

  it("applies the right daylight-saving rule to a July instant", () => {
    const parts = formatInstantParts("2027-07-16T12:00:00+02:00", "Europe/Brussels");

    expect(parts.time).toBe("12:00");
    expect(parts.zone).toBe("CEST");
  });

  it("renders a Brasil sale in Brasília time", () => {
    const parts = formatInstantParts("2026-09-24T10:00:00-03:00", "America/Sao_Paulo");

    expect(parts.date).toBe("Thu 24 Sep 2026");
    expect(parts.time).toBe("10:00");
    expect(parts.zone).toBe("GMT-3");
  });

  it("always renders the minutes, including on the hour", () => {
    // ICU drops a trailing ":00" from some patterns; a sale at 17:00 must not read
    // as "17".
    expect(formatInstantParts("2027-01-30T17:00:00+01:00", "Europe/Brussels").time).toBe("17:00");
  });

  it("renders September as Sep, not the en-GB Sept", () => {
    expect(formatInstantParts("2026-09-24T10:00:00-03:00", "America/Sao_Paulo").date).toContain(
      "Sep 2026",
    );
  });

  it("writes the weekday without a trailing comma", () => {
    expect(formatInstantParts("2027-01-30T17:00:00+01:00", "Europe/Brussels").date).toBe(
      "Sat 30 Jan 2027",
    );
  });

  it("renders the long style without a weekday", () => {
    const parts = formatInstantParts("2026-12-02T15:00:00+01:00", "Europe/Brussels", "long");

    expect(parts.date).toBe("2 December 2026");
  });

  it("throws for an instant with no offset", () => {
    expect(() => formatInstantParts("2027-01-30T17:00:00", "Europe/Brussels")).toThrow(
      /must be an ISO 8601 instant with an offset/,
    );
  });

  it("throws for an instant with no time at all", () => {
    expect(() => formatInstantParts("2027-01-30", "Europe/Brussels")).toThrow(/ISO 8601 instant/);
  });

  it("throws for an impossible date rather than rolling it into the next month", () => {
    // Date.parse would read 30 February as 2 March.
    expect(() => formatInstantParts("2027-02-30T17:00:00+01:00", "Europe/Brussels")).toThrow(
      /date that does not exist/,
    );
  });

  it("accepts 29 February in a leap year", () => {
    expect(() =>
      formatInstantParts("2028-02-29T17:00:00+01:00", "Europe/Brussels"),
    ).not.toThrow();
  });

  it("rejects 29 February in a common year", () => {
    expect(() => formatInstantParts("2027-02-29T17:00:00+01:00", "Europe/Brussels")).toThrow(
      /date that does not exist/,
    );
  });

  it("throws for an unsupported zone rather than falling back to the local clock", () => {
    expect(() => formatInstantParts("2027-01-30T17:00:00+01:00", "Mars/Olympus")).toThrow(
      /supported time zone/,
    );
  });
});

describe("formatInstantLong and formatInstantProse", () => {
  it("joins the date, time and zone on one line", () => {
    expect(formatInstantLong("2027-02-06T17:00:00+01:00", "Europe/Brussels")).toBe(
      "Sat 6 Feb 2027, 17:00 CET",
    );
  });

  it("writes a prose form for a sentence", () => {
    expect(formatInstantProse("2026-12-02T15:00:00+01:00", "Europe/Brussels")).toBe(
      "2 December 2026 at 15:00 CET",
    );
  });
});
