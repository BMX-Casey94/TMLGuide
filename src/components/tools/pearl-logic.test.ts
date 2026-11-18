// @vitest-environment node
import { describe, expect, it } from "vitest";

import { eurToPearls, pearlsToEurCents } from "@/lib/tools";
import {
  PEARL_DIRECTIONS,
  convertPearls,
  parsePearlRate,
  RATE_PROBLEM_MESSAGE,
  RATE_WARNING,
  ROUNDING_EXPLANATION,
} from "./pearl-logic";

/** A parsed rate, for tests that are not about rate parsing itself. */
function rateOf(centsPerPearl: number) {
  const parsed = parsePearlRate(centsPerPearl / 100);
  if (!parsed.ok) throw new Error("expected a valid rate");
  return parsed.rate;
}

describe("parsePearlRate", () => {
  it("reads a published rate into whole cents", () => {
    expect(parsePearlRate(1.9)).toEqual({ ok: true, rate: { centsPerPearl: 190 } });
    expect(parsePearlRate(1.82)).toEqual({ ok: true, rate: { centsPerPearl: 182 } });
    expect(parsePearlRate(2.5)).toEqual({ ok: true, rate: { centsPerPearl: 250 } });
    expect(parsePearlRate(0.01)).toEqual({ ok: true, rate: { centsPerPearl: 1 } });
  });

  it("refuses a non-positive rate", () => {
    for (const value of [0, -1, -0.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parsePearlRate(value)).toEqual({ ok: false, problem: "not-positive" });
    }
  });

  it("refuses a rate finer than a cent rather than rounding it", () => {
    expect(parsePearlRate(1.905)).toEqual({ ok: false, problem: "too-precise" });
    expect(parsePearlRate(1.2345)).toEqual({ ok: false, problem: "too-precise" });
  });

  it("refuses a rate beyond the tool's ceiling", () => {
    expect(parsePearlRate(10_000_001)).toEqual({ ok: false, problem: "too-large" });
  });

  it("has a readable message for every problem it can report", () => {
    for (const message of Object.values(RATE_PROBLEM_MESSAGE)) {
      expect(message.length).toBeGreaterThan(10);
    }
  });
});

describe("convertPearls, money into Pearls", () => {
  it("gives whole Pearls and reports the money that cannot reach another", () => {
    // €20.00 at €1.90 is 10.5 Pearls: ten whole Pearls and 100 cents left over.
    const result = convertPearls("euros-to-pearls", 2000, rateOf(190));
    expect(result.pearls).toBe(10);
    expect(result.remainderMinor).toBe(100);
    expect(result.hasRemainder).toBe(true);
  });

  it("never returns a partial Pearl", () => {
    for (const cents of [0, 1, 189, 190, 379, 380]) {
      const result = convertPearls("euros-to-pearls", cents, rateOf(190));
      expect(Number.isInteger(result.pearls)).toBe(true);
      expect(result.pearls).toBeGreaterThanOrEqual(0);
    }
  });

  it("agrees with the tested library", () => {
    for (const cents of [0, 99, 190, 1000, 1001, 123_456]) {
      const result = convertPearls("euros-to-pearls", cents, rateOf(190));
      const reference = eurToPearls(cents, 190);
      expect(result.pearls).toBe(reference.wholePearls);
      expect(result.remainderMinor).toBe(reference.remainderEurCents);
    }
  });

  it("reports no remainder when the money divides exactly", () => {
    const result = convertPearls("euros-to-pearls", 1900, rateOf(190));
    expect(result.pearls).toBe(10);
    expect(result.remainderMinor).toBe(0);
    expect(result.hasRemainder).toBe(false);
  });

  it("turns zero into zero rather than failing", () => {
    const result = convertPearls("euros-to-pearls", 0, rateOf(190));
    expect(result.pearls).toBe(0);
    expect(result.amountMinor).toBe(0);
  });
});

describe("convertPearls, Pearls into money", () => {
  it("prices whole Pearls exactly at the rate", () => {
    const result = convertPearls("pearls-to-euros", 10, rateOf(190));
    expect(result.amountMinor).toBe(1900);
    expect(result.pearls).toBe(10);
    expect(result.hasRemainder).toBe(false);
  });

  it("agrees with the tested library", () => {
    for (const pearls of [0, 1, 7, 100]) {
      const result = convertPearls("pearls-to-euros", pearls, rateOf(190));
      expect(result.amountMinor).toBe(pearlsToEurCents(pearls, 190));
    }
  });

  it("prices a fractional-cent rate without losing money", () => {
    // €1.82 is not a whole number of cents per ten Pearls, but each Pearl is
    // still exact at 182 cents.
    expect(convertPearls("pearls-to-euros", 11, rateOf(182)).amountMinor).toBe(2002);
  });
});

describe("the guidance text", () => {
  it("says the 2027 rate has not been announced", () => {
    expect(RATE_WARNING).toMatch(/2027/);
    expect(RATE_WARNING).toMatch(/not been announced|not .*announced/i);
  });

  it("explains whole Pearls in plain language", () => {
    expect(ROUNDING_EXPLANATION).toMatch(/whole/i);
    expect(ROUNDING_EXPLANATION).not.toMatch(/epsilon|integer|floor/i);
  });

  it("offers both directions and nothing else", () => {
    expect(PEARL_DIRECTIONS).toEqual(["euros-to-pearls", "pearls-to-euros"]);
  });
});
