// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  MAX_MAJOR_UNITS,
  MAX_MINOR_UNITS,
  currencySymbol,
  formatAmount,
  formatMoney,
  parseAmountInput,
  parseWholeNumber,
} from "./format";

describe("parseAmountInput", () => {
  it("reads plain whole and decimal amounts into minor units", () => {
    expect(parseAmountInput("0")).toEqual({ kind: "valid", minorUnits: 0 });
    expect(parseAmountInput("120")).toEqual({ kind: "valid", minorUnits: 12_000 });
    expect(parseAmountInput("120.5")).toEqual({ kind: "valid", minorUnits: 12_050 });
    expect(parseAmountInput("120.05")).toEqual({ kind: "valid", minorUnits: 12_005 });
    expect(parseAmountInput("0.01")).toEqual({ kind: "valid", minorUnits: 1 });
  });

  it("treats an empty or whitespace-only field as empty, not zero", () => {
    expect(parseAmountInput("")).toEqual({ kind: "empty" });
    expect(parseAmountInput("   ")).toEqual({ kind: "empty" });
  });

  it("strips a typed currency symbol or code", () => {
    expect(parseAmountInput("€20")).toEqual({ kind: "valid", minorUnits: 2000 });
    expect(parseAmountInput("R$1,234.00")).toEqual({ kind: "valid", minorUnits: 123_400 });
    expect(parseAmountInput("EUR 15.50")).toEqual({ kind: "valid", minorUnits: 1550 });
    expect(parseAmountInput("brl 10")).toEqual({ kind: "valid", minorUnits: 1000 });
  });

  it("reads a dot or a comma as the decimal mark, but never both at once", () => {
    expect(parseAmountInput("12,5")).toEqual({ kind: "valid", minorUnits: 1250 });
    expect(parseAmountInput("1,234.56")).toEqual({ kind: "valid", minorUnits: 123_456 });
    expect(parseAmountInput("1.234,56")).toEqual({ kind: "valid", minorUnits: 123_456 });
  });

  it("reads three-digit groups as thousands, not decimals", () => {
    expect(parseAmountInput("1,234")).toEqual({ kind: "valid", minorUnits: 123_400 });
    expect(parseAmountInput("1.234")).toEqual({ kind: "valid", minorUnits: 123_400 });
    expect(parseAmountInput("12,345")).toEqual({ kind: "valid", minorUnits: 1_234_500 });
    // Grouped thousands are refused at the ceiling like any other oversized amount.
    expect(parseAmountInput("1,234,567")).toEqual({ kind: "invalid", problem: "too-large" });
  });

  it("refuses a third decimal place rather than rounding it away", () => {
    expect(parseAmountInput("1.2345")).toEqual({ kind: "invalid", problem: "too-precise" });
    expect(parseAmountInput("0.333")).toEqual({ kind: "invalid", problem: "too-precise" });
    expect(parseAmountInput("0,333")).toEqual({ kind: "invalid", problem: "too-precise" });
    // Three digits after a separator with no leading zero groups thousands, so
    // this is ten thousand nine hundred and ninety-nine, not ten point nine nine nine.
    expect(parseAmountInput("10,999")).toEqual({ kind: "valid", minorUnits: 1_099_900 });
  });

  it("refuses negative amounts", () => {
    expect(parseAmountInput("-1")).toEqual({ kind: "invalid", problem: "negative" });
    expect(parseAmountInput("-0.01")).toEqual({ kind: "invalid", problem: "negative" });
  });

  it("refuses text that is not a number", () => {
    expect(parseAmountInput("abc")).toEqual({ kind: "invalid", problem: "not-a-number" });
    expect(parseAmountInput("12abc")).toEqual({ kind: "invalid", problem: "not-a-number" });
    expect(parseAmountInput("1..2")).toEqual({ kind: "invalid", problem: "not-a-number" });
    expect(parseAmountInput("1,2,3")).toEqual({ kind: "invalid", problem: "not-a-number" });
    expect(parseAmountInput(".")).toEqual({ kind: "invalid", problem: "not-a-number" });
    expect(parseAmountInput("1 2")).toEqual({ kind: "invalid", problem: "not-a-number" });
  });

  it("refuses amounts beyond the tool's ceiling", () => {
    expect(parseAmountInput(String(MAX_MAJOR_UNITS))).toEqual({
      kind: "valid",
      minorUnits: MAX_MINOR_UNITS,
    });
    expect(parseAmountInput(String(MAX_MAJOR_UNITS + 1))).toEqual({
      kind: "invalid",
      problem: "too-large",
    });
    expect(parseAmountInput("999999999999999999999")).toEqual({
      kind: "invalid",
      problem: "too-large",
    });
  });

  it("never returns NaN, Infinity or a fraction of a cent", () => {
    for (const text of ["NaN", "Infinity", "-Infinity", "1e5", "0x10", " ", "abc"]) {
      const result = parseAmountInput(text);
      if (result.kind === "valid") {
        expect(Number.isSafeInteger(result.minorUnits)).toBe(true);
      }
    }
  });

  it("round-trips through formatAmount, so a restored draft re-parses to the same value", () => {
    // A saved plan is rendered back into the field by formatAmount and re-read
    // by parseAmountInput on the next visit, so the two must agree exactly.
    for (const minorUnits of [0, 1, 99, 100, 1234, 12_000, 123_456, 999_999, MAX_MINOR_UNITS]) {
      const text = formatAmount(minorUnits);
      expect(parseAmountInput(text)).toEqual({ kind: "valid", minorUnits });
    }
  });

  it("rejects a non-string without throwing", () => {
    expect(parseAmountInput(undefined as unknown as string)).toEqual({
      kind: "invalid",
      problem: "not-a-number",
    });
  });
});

describe("formatAmount and formatMoney", () => {
  it("groups a bare amount without a currency symbol", () => {
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(123_456)).toBe("1,234.56");
    expect(formatAmount(12_000)).toBe("120");
  });

  it("formats euros and reais with their own symbols, never mixed", () => {
    expect(formatMoney(123_456, "EUR")).toBe("€1,234.56");
    expect(formatMoney(123_456, "BRL")).toBe("R$1,234.56");
    expect(formatMoney(0, "EUR")).toBe("€0.00");
    expect(formatMoney(316_000, "BRL")).toBe("R$3,160.00");
  });

  it("refuses a currency it does not know", () => {
    expect(() => formatMoney(100, "USD" as unknown as "EUR")).toThrow(RangeError);
  });

  it("refuses fractional minor units rather than rounding", () => {
    expect(() => formatMoney(10.5, "EUR")).toThrow(RangeError);
    expect(() => formatAmount(Number.NaN)).toThrow(RangeError);
  });

  it("uses the right symbol for each currency", () => {
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("BRL")).toBe("R$");
  });
});

describe("parseWholeNumber", () => {
  it("accepts whole numbers inside the bounds", () => {
    expect(parseWholeNumber("1", 1, 40)).toBe(1);
    expect(parseWholeNumber("40", 1, 40)).toBe(40);
    expect(parseWholeNumber(" 7 ", 1, 40)).toBe(7);
  });

  it("rejects anything outside the bounds or not a whole number", () => {
    expect(parseWholeNumber("0", 1, 40)).toBeNull();
    expect(parseWholeNumber("41", 1, 40)).toBeNull();
    expect(parseWholeNumber("1.5", 1, 40)).toBeNull();
    expect(parseWholeNumber("-2", 1, 40)).toBeNull();
    expect(parseWholeNumber("", 1, 40)).toBeNull();
    expect(parseWholeNumber("two", 1, 40)).toBeNull();
    expect(parseWholeNumber("1000", 1, 40)).toBeNull();
    expect(parseWholeNumber("NaN", 1, 40)).toBeNull();
  });
});
