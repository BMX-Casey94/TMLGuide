import { describe, expect, it } from "vitest";
import {
  formatCheckedDate,
  formatDateRange,
  formatEuro,
  formatInstant,
  formatInstantLong,
  formatIsoDate,
  formatReal,
} from "./format";

describe("formatEuro", () => {
  it("renders a euro amount with the currency symbol", () => {
    expect(formatEuro(144)).toBe("€144.00");
    expect(formatEuro(0)).toBe("€0.00");
    expect(formatEuro(5707.5)).toBe("€5,707.50");
  });

  it("rejects a non-number rather than printing NaN", () => {
    expect(() => formatEuro(Number.NaN)).toThrow(RangeError);
    expect(() => formatEuro(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("formatReal", () => {
  it("renders reais in Brazilian Portuguese", () => {
    // Non-breaking space after the symbol, thousands with a dot, decimals with
    // a comma: the pt-BR convention the tickets page also uses.
    expect(formatReal(3160).replace(/\u00a0/g, " ")).toBe("R$ 3.160,00");
    expect(formatReal(735).replace(/\u00a0/g, " ")).toBe("R$ 735,00");
  });

  it("never converts, so a whole number of reais stays whole", () => {
    expect(formatReal(1580)).toContain("1.580");
  });

  it("rejects a non-number", () => {
    expect(() => formatReal(Number.NaN)).toThrow(RangeError);
  });
});

describe("formatInstant", () => {
  it("renders a Brussels winter instant with its own zone", () => {
    const result = formatInstant("2027-01-30T17:00:00+01:00", "Europe/Brussels");
    expect(result.date).toBe("Saturday 30 January 2027");
    expect(result.time).toBe("17:00 CET");
  });

  it("reports summer time as CEST", () => {
    const result = formatInstant("2027-07-16T17:00:00+02:00", "Europe/Brussels");
    expect(result.time).toBe("17:00 CEST");
  });

  it("keeps a São Paulo instant on its own calendar day", () => {
    const result = formatInstant("2026-09-24T10:00:00-03:00", "America/Sao_Paulo");
    expect(result.date).toBe("Thursday 24 September 2026");
    expect(result.time).toBe("10:00 GMT-3");
  });

  it("rejects an unparseable instant", () => {
    expect(() => formatInstant("not a date", "Europe/Brussels")).toThrow(RangeError);
  });

  it("rejects an unknown zone rather than falling back to local time", () => {
    expect(() => formatInstant("2027-01-30T17:00:00+01:00", "Mars/Olympus")).toThrow();
  });
});

describe("formatInstantLong", () => {
  it("joins the date and time with a comma", () => {
    expect(formatInstantLong("2027-02-06T17:00:00+01:00", "Europe/Brussels")).toBe(
      "Saturday 6 February 2027, 17:00 CET",
    );
  });
});

describe("formatIsoDate", () => {
  it("renders a date with its weekday", () => {
    expect(formatIsoDate("2027-07-16")).toBe("Friday 16 July 2027");
    expect(formatIsoDate("2027-03-20")).toBe("Saturday 20 March 2027");
  });

  it("does not shift a date at a year boundary", () => {
    expect(formatIsoDate("2027-01-01")).toBe("Friday 1 January 2027");
  });

  it("rejects anything that is not a plain ISO date", () => {
    expect(() => formatIsoDate("2027-07-16T10:00:00Z")).toThrow(RangeError);
    expect(() => formatIsoDate("2027-13-01")).toThrow(RangeError);
    expect(() => formatIsoDate("2027-00-10")).toThrow(RangeError);
    expect(() => formatIsoDate("2027-02-30")).toThrow(RangeError);
    expect(() => formatIsoDate("2027-04-31")).toThrow(RangeError);
  });

  it("accepts a real leap day", () => {
    expect(formatIsoDate("2028-02-29")).toBe("Tuesday 29 February 2028");
  });
});

describe("formatDateRange", () => {
  it("collapses the month when both ends share it", () => {
    expect(formatDateRange("2027-07-16", "2027-07-18")).toBe("16–18 July 2027");
  });

  it("names both months when the range crosses one", () => {
    expect(formatDateRange("2027-04-30", "2027-05-02")).toBe("30 April – 2 May 2027");
  });

  it("names both years when the range crosses one", () => {
    expect(formatDateRange("2026-12-31", "2027-01-01")).toBe(
      "31 December 2026 – 1 January 2027",
    );
  });

  it("renders a single-day range as a range of one", () => {
    expect(formatDateRange("2027-07-16", "2027-07-16")).toBe("16–16 July 2027");
  });

  it("refuses a range with a malformed end", () => {
    expect(() => formatDateRange("2027-07-16", "2027-07-xx")).toThrow(RangeError);
    expect(() => formatDateRange("2027-02-30", "2027-03-01")).toThrow(RangeError);
  });
});

describe("formatCheckedDate", () => {
  it("renders the house style", () => {
    expect(formatCheckedDate("2026-11-18")).toBe("18 Nov 2026");
  });

  it("rejects anything that is not an ISO date", () => {
    expect(() => formatCheckedDate("18/11/2026")).toThrow(RangeError);
  });
});
