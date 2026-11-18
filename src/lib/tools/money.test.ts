// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  centsToEuros,
  convertEurCentsToGbpPence,
  eurosToCents,
  formatEur,
  formatGbp,
  sumCents,
} from "./money";

/** Deterministic PRNG (mulberry32) so property loops are reproducible. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("eurosToCents", () => {
  it("converts whole and fractional euro amounts exactly", () => {
    expect(eurosToCents(0)).toBe(0);
    expect(eurosToCents(1)).toBe(100);
    expect(eurosToCents(19.99)).toBe(1999);
    expect(eurosToCents(0.01)).toBe(1);
    expect(eurosToCents(0.1)).toBe(10);
    expect(eurosToCents(1234.56)).toBe(123456);
    expect(eurosToCents(0.07)).toBe(7);
  });

  it("rejects negative, non-finite and over-precise amounts", () => {
    expect(() => eurosToCents(-1)).toThrow(RangeError);
    expect(() => eurosToCents(-0.01)).toThrow(RangeError);
    expect(() => eurosToCents(Number.NaN)).toThrow(RangeError);
    expect(() => eurosToCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => eurosToCents(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
    expect(() => eurosToCents(1.005)).toThrow(RangeError);
    expect(() => eurosToCents(0.333)).toThrow(RangeError);
    expect(() => eurosToCents(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
    expect(() => eurosToCents("19.99" as unknown as number)).toThrow(RangeError);
  });

  it("round-trips cents through euros for seeded random values", () => {
    const random = seededRandom(20_261_118);
    for (let index = 0; index < 400; index += 1) {
      const cents = Math.floor(random() * 5_000_000);
      expect(eurosToCents(centsToEuros(cents))).toBe(cents);
    }
  });

  it("round-trips two-decimal euro strings through cents", () => {
    const random = seededRandom(7);
    for (let index = 0; index < 400; index += 1) {
      const cents = Math.floor(random() * 1_000_000);
      const written = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
      expect(eurosToCents(Number(written))).toBe(cents);
    }
  });
});

describe("centsToEuros", () => {
  it("divides by one hundred", () => {
    expect(centsToEuros(0)).toBe(0);
    expect(centsToEuros(1)).toBe(0.01);
    expect(centsToEuros(1999)).toBe(19.99);
    expect(centsToEuros(-250)).toBe(-2.5);
  });

  it("rejects non-integer cents", () => {
    expect(() => centsToEuros(1.5)).toThrow(RangeError);
    expect(() => centsToEuros(Number.NaN)).toThrow(RangeError);
    expect(() => centsToEuros(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => centsToEuros(2 ** 53)).toThrow(RangeError);
  });
});

describe("convertEurCentsToGbpPence", () => {
  it("applies the rate as an exact fraction and rounds half up", () => {
    expect(convertEurCentsToGbpPence(0, 0.855)).toBe(0);
    expect(convertEurCentsToGbpPence(100, 1)).toBe(100);
    // 100 * 0.855 is exactly 85.5; half up gives 86.
    expect(convertEurCentsToGbpPence(100, 0.855)).toBe(86);
    expect(convertEurCentsToGbpPence(1000, 0.855)).toBe(855);
    expect(convertEurCentsToGbpPence(1999, 0.5)).toBe(1000);
    expect(convertEurCentsToGbpPence(1, 0.5)).toBe(1);
    // 100 * 1.15 is 114.99999999999999 in binary; the decimal reading gives 115.
    expect(convertEurCentsToGbpPence(100, 1.15)).toBe(115);
    expect(convertEurCentsToGbpPence(100, 0.8)).toBe(80);
  });

  it("converts negative amounts symmetrically", () => {
    expect(convertEurCentsToGbpPence(-100, 0.855)).toBe(-86);
    expect(convertEurCentsToGbpPence(-1999, 0.5)).toBe(-1000);
  });

  it("rejects invalid rates", () => {
    expect(() => convertEurCentsToGbpPence(100, 0)).toThrow(RangeError);
    expect(() => convertEurCentsToGbpPence(100, -0.9)).toThrow(RangeError);
    expect(() => convertEurCentsToGbpPence(100, Number.NaN)).toThrow(RangeError);
    expect(() => convertEurCentsToGbpPence(100, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => convertEurCentsToGbpPence(100.5, 0.9)).toThrow(RangeError);
  });

  it("never loses more than half a penny over a seeded rate range", () => {
    const random = seededRandom(99);
    for (let index = 0; index < 300; index += 1) {
      const cents = Math.floor(random() * 2_000_000);
      const rateThousandths = 500 + Math.floor(random() * 1001);
      const pence = convertEurCentsToGbpPence(cents, rateThousandths / 1000);
      expect(Number.isSafeInteger(pence)).toBe(true);
      // Compare in thousandths of a penny to avoid reintroducing float drift.
      expect(Math.abs(pence * 1000 - cents * rateThousandths)).toBeLessThanOrEqual(500);
    }
  });
});

describe("formatEur and formatGbp", () => {
  it("formats in the site locale with currency symbols", () => {
    expect(formatEur(0)).toBe("€0.00");
    expect(formatEur(1234)).toBe("€12.34");
    expect(formatEur(123456)).toBe("€1,234.56");
    expect(formatEur(-1234)).toBe("-€12.34");
    expect(formatGbp(0)).toBe("£0.00");
    expect(formatGbp(1234)).toBe("£12.34");
    expect(formatGbp(123456)).toBe("£1,234.56");
  });

  it("rejects non-integer pence", () => {
    expect(() => formatGbp(12.5)).toThrow(RangeError);
    expect(() => formatEur(Number.NaN)).toThrow(RangeError);
  });
});

describe("sumCents", () => {
  it("sums exactly", () => {
    expect(sumCents([])).toBe(0);
    expect(sumCents([1])).toBe(1);
    expect(sumCents([1999, 1])).toBe(2000);
    expect(sumCents([10, -5, 7])).toBe(12);
  });

  it("avoids the floating point drift of summing euros", () => {
    const cents = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(sumCents(cents)).toBe(550);
    expect(centsToEuros(sumCents(cents))).toBe(5.5);
    // The naive euro sum does drift, which is why cents are the internal unit.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumCents([10, 20])).toBe(eurosToCents(0.3));
  });

  it("rejects non-integer values", () => {
    expect(() => sumCents([1, 2.5])).toThrow(RangeError);
    expect(() => sumCents([Number.NaN])).toThrow(RangeError);
    expect(() => sumCents("1" as unknown as number[])).toThrow(RangeError);
  });

  it("matches a seeded reference sum without drift", () => {
    const random = seededRandom(4242);
    for (let round = 0; round < 50; round += 1) {
      const count = 1 + Math.floor(random() * 20);
      const values = Array.from({ length: count }, () =>
        Math.floor(random() * 100_000) - 50_000,
      );
      const reference = values.reduce((total, value) => total + value, 0);
      expect(sumCents(values)).toBe(reference);
    }
  });
});
