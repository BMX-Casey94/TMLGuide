// @vitest-environment node
import { describe, expect, it } from "vitest";

import { computeBudget, perDay, type BudgetLine } from "./budget";
import { convertEurCentsToGbpPence } from "./money";

function lineOf(overrides: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: "l1",
    label: "Tent spot",
    amountEurCents: 3000,
    quantity: 2,
    category: "Camping",
    ...overrides,
  };
}

describe("computeBudget", () => {
  it("totals each line, each category and the whole budget", () => {
    const summary = computeBudget({
      lines: [
        lineOf({ id: "camp", category: "Camping", amountEurCents: 3000, quantity: 2 }),
        lineOf({ id: "camp-extra", category: "Camping", amountEurCents: 1500, quantity: 1 }),
        lineOf({ id: "train", label: "Train", category: "Travel", amountEurCents: 9900, quantity: 2 }),
      ],
    });

    expect(summary.lines.map((line) => line.totalEurCents)).toEqual([6000, 1500, 19800]);
    expect(summary.categories).toEqual([
      { category: "Travel", totalEurCents: 19800, lineCount: 1 },
      { category: "Camping", totalEurCents: 7500, lineCount: 2 },
    ]);
    expect(summary.grandTotalEurCents).toBe(27300);
    expect(summary.indicativeGbpPence).toBeNull();
    expect(summary.gbpPerEur).toBeNull();
  });

  it("adds the indicative pound total only when a rate is supplied", () => {
    const lines = [
      lineOf({ id: "a", category: "Food", amountEurCents: 1250, quantity: 3 }),
      lineOf({ id: "b", category: "Travel", amountEurCents: 4999, quantity: 1 }),
    ];

    const withRate = computeBudget({ lines, gbpPerEur: 0.855 });
    expect(withRate.grandTotalEurCents).toBe(8749);
    expect(withRate.gbpPerEur).toBe(0.855);
    expect(withRate.indicativeGbpPence).toBe(convertEurCentsToGbpPence(8749, 0.855));
    expect(withRate.indicativeGbpPence).toBe(7480);

    const withoutRate = computeBudget({ lines });
    expect(withoutRate.indicativeGbpPence).toBeNull();
  });

  it("accepts zero quantities and discounts as separate lines", () => {
    const summary = computeBudget({
      lines: [
        lineOf({ id: "ticket", category: "Tickets", amountEurCents: 20_000, quantity: 1 }),
        lineOf({ id: "voucher", category: "Tickets", amountEurCents: -2_500, quantity: 1 }),
        lineOf({ id: "unused", category: "Extras", amountEurCents: 999, quantity: 0 }),
      ],
    });

    expect(summary.grandTotalEurCents).toBe(17_500);
    expect(summary.categories).toEqual([
      { category: "Tickets", totalEurCents: 17_500, lineCount: 2 },
      { category: "Extras", totalEurCents: 0, lineCount: 1 },
    ]);
  });

  it("returns an empty summary for an empty list", () => {
    const summary = computeBudget({ lines: [], gbpPerEur: 0.9 });
    expect(summary.lines).toEqual([]);
    expect(summary.categories).toEqual([]);
    expect(summary.grandTotalEurCents).toBe(0);
    expect(summary.indicativeGbpPence).toBe(0);
  });

  it("sorts equal category totals by name", () => {
    const summary = computeBudget({
      lines: [
        lineOf({ id: "1", category: "Zebra", amountEurCents: 100, quantity: 1 }),
        lineOf({ id: "2", category: "Apple", amountEurCents: 100, quantity: 1 }),
      ],
    });
    expect(summary.categories.map((entry) => entry.category)).toEqual(["Apple", "Zebra"]);
  });

  it("rejects invalid quantities, duplicate ids and bad amounts", () => {
    expect(() => computeBudget({ lines: [lineOf({ quantity: -1 })] })).toThrow(RangeError);
    expect(() => computeBudget({ lines: [lineOf({ quantity: 1.5 })] })).toThrow(RangeError);
    expect(() => computeBudget({ lines: [lineOf({ quantity: Number.NaN })] })).toThrow(RangeError);
    expect(() =>
      computeBudget({ lines: [lineOf({ id: "same" }), lineOf({ id: "same" })] }),
    ).toThrow(RangeError);
    expect(() => computeBudget({ lines: [lineOf({ amountEurCents: 10.5 })] })).toThrow(RangeError);
    expect(() => computeBudget({ lines: [lineOf({ label: "" })] })).toThrow(RangeError);
    expect(() => computeBudget({ lines: [lineOf({ category: "  " })] })).toThrow(RangeError);
    expect(() => computeBudget({ lines: "x" as unknown as BudgetLine[] })).toThrow(RangeError);
  });

  it("rejects invalid rates and totals beyond a safe integer", () => {
    expect(() => computeBudget({ lines: [lineOf()], gbpPerEur: 0 })).toThrow(RangeError);
    expect(() => computeBudget({ lines: [lineOf()], gbpPerEur: -1 })).toThrow(RangeError);
    expect(() => computeBudget({ lines: [lineOf()], gbpPerEur: Number.NaN })).toThrow(RangeError);
    expect(() =>
      computeBudget({
        lines: [
          lineOf({ id: "a", amountEurCents: Number.MAX_SAFE_INTEGER, quantity: 1 }),
          lineOf({ id: "b", amountEurCents: 1, quantity: 1 }),
        ],
      }),
    ).toThrow(RangeError);
    expect(() =>
      computeBudget({ lines: [lineOf({ amountEurCents: Number.MAX_SAFE_INTEGER, quantity: 2 })] }),
    ).toThrow(RangeError);
  });

  it("keeps the grand total equal to the sum of the line and category totals", () => {
    // Deterministic PRNG (mulberry32) for a reproducible property loop.
    let state = 20_261_118;
    const random = (): number => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const categories = ["Tickets", "Travel", "Food", "Camping"];

    for (let round = 0; round < 40; round += 1) {
      const lines = Array.from({ length: 1 + Math.floor(random() * 8) }, (_, index) =>
        lineOf({
          id: `line-${index}`,
          category: categories[Math.floor(random() * categories.length)],
          amountEurCents: Math.floor(random() * 50_000),
          quantity: Math.floor(random() * 5),
        }),
      );

      const summary = computeBudget({ lines, gbpPerEur: 0.855 });
      const lineSum = summary.lines.reduce((total, entry) => total + entry.totalEurCents, 0);
      const categorySum = summary.categories.reduce(
        (total, entry) => total + entry.totalEurCents,
        0,
      );

      expect(summary.grandTotalEurCents).toBe(lineSum);
      expect(summary.grandTotalEurCents).toBe(categorySum);
      expect(summary.indicativeGbpPence).toBe(
        convertEurCentsToGbpPence(summary.grandTotalEurCents, 0.855),
      );
      expect(summary.categories.reduce((count, entry) => count + entry.lineCount, 0)).toBe(
        lines.length,
      );
    }
  });
});

describe("perDay", () => {
  it("divides a total by whole days, rounding half up", () => {
    expect(perDay(1000, 1)).toEqual({
      totalEurCents: 1000,
      days: 1,
      perDayEurCents: 1000,
      roundingRemainderEurCents: 0,
    });
    expect(perDay(10_000, 4)).toEqual({
      totalEurCents: 10_000,
      days: 4,
      perDayEurCents: 2500,
      roundingRemainderEurCents: 0,
    });
    // 100 / 3 = 33.33, rounds to 33, leaving one cent unallocated.
    expect(perDay(100, 3)).toMatchObject({ perDayEurCents: 33, roundingRemainderEurCents: 1 });
    // 101 / 3 = 33.67, rounds to 34, overshooting by one cent.
    expect(perDay(101, 3)).toMatchObject({ perDayEurCents: 34, roundingRemainderEurCents: -1 });
  });

  it("rounds a negative total away from zero", () => {
    expect(perDay(-100, 3)).toMatchObject({ perDayEurCents: -33, roundingRemainderEurCents: -1 });
    expect(perDay(-101, 3)).toMatchObject({ perDayEurCents: -34, roundingRemainderEurCents: 1 });
  });

  it("rejects non-integer totals and day counts below one", () => {
    expect(() => perDay(10.5, 2)).toThrow(RangeError);
    expect(() => perDay(100, 0)).toThrow(RangeError);
    expect(() => perDay(100, -1)).toThrow(RangeError);
    expect(() => perDay(100, 1.5)).toThrow(RangeError);
  });

  it("always lands within half a cent per day of the exact share", () => {
    let state = 7;
    const random = (): number => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };

    for (let round = 0; round < 200; round += 1) {
      const total = Math.floor(random() * 1_000_000);
      const days = 1 + Math.floor(random() * 30);
      const figure = perDay(total, days);
      const drift = figure.perDayEurCents * days - total;
      expect(Math.abs(drift * 2)).toBeLessThanOrEqual(days);
    }
  });
});
