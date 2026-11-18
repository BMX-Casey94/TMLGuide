// @vitest-environment node
import { describe, expect, it } from "vitest";

import { eurosToCents } from "./money";
import {
  eurToPearls,
  minimumSensiblePearls,
  pearlsToEurCents,
  planPearlTopUp,
} from "./pearls";

describe("pearlsToEurCents", () => {
  it("prices whole Pearls at a two-decimal rate", () => {
    expect(pearlsToEurCents(0, 190)).toBe(0);
    expect(pearlsToEurCents(1, 190)).toBe(190);
    expect(pearlsToEurCents(7, 190)).toBe(1330);
    expect(pearlsToEurCents(100, 125)).toBe(12500);
    expect(eurosToCents(1.9)).toBe(190);
  });

  it("rejects invalid rates and counts", () => {
    expect(() => pearlsToEurCents(10, 0)).toThrow(RangeError);
    expect(() => pearlsToEurCents(10, -190)).toThrow(RangeError);
    expect(() => pearlsToEurCents(10, 190.5)).toThrow(RangeError);
    expect(() => pearlsToEurCents(-1, 190)).toThrow(RangeError);
    expect(() => pearlsToEurCents(1.5, 190)).toThrow(RangeError);
    expect(() => pearlsToEurCents(Number.MAX_SAFE_INTEGER, 190)).toThrow(RangeError);
  });
});

describe("eurToPearls", () => {
  it("returns whole Pearls and the unspendable remainder", () => {
    expect(eurToPearls(0, 190)).toEqual({ wholePearls: 0, remainderEurCents: 0 });
    expect(eurToPearls(190, 190)).toEqual({ wholePearls: 1, remainderEurCents: 0 });
    expect(eurToPearls(189, 190)).toEqual({ wholePearls: 0, remainderEurCents: 189 });
    expect(eurToPearls(1000, 190)).toEqual({ wholePearls: 5, remainderEurCents: 50 });
    expect(eurToPearls(1001, 190)).toEqual({ wholePearls: 5, remainderEurCents: 51 });
  });

  it("never returns a partial Pearl", () => {
    expect(eurToPearls(379, 190)).toEqual({ wholePearls: 1, remainderEurCents: 189 });
    expect(eurToPearls(380, 190)).toEqual({ wholePearls: 2, remainderEurCents: 0 });
  });

  it("rejects invalid budgets and rates", () => {
    expect(() => eurToPearls(-1, 190)).toThrow(RangeError);
    expect(() => eurToPearls(10, 0)).toThrow(RangeError);
    expect(() => eurToPearls(10.5, 190)).toThrow(RangeError);
  });
});

describe("planPearlTopUp", () => {
  it("plans a budget that covers every item", () => {
    const plan = planPearlTopUp({
      budgetEurCents: 10_000,
      eurPerPearlCents: 190,
      itemPearlCosts: [10, 15, 5],
    });

    expect(plan.totalItemPearls).toBe(30);
    expect(plan.totalItemCostEurCents).toBe(5700);
    expect(plan.pearlsToLoad).toBe(30);
    expect(plan.loadCostEurCents).toBe(5700);
    expect(plan.coversItems).toBe(true);
    expect(plan.shortfallEurCents).toBe(0);
    expect(plan.unaffordablePearls).toBe(0);
    expect(plan.headroomEurCents).toBe(4300);
  });

  it("caps the load at the budget when items cost more", () => {
    const plan = planPearlTopUp({
      budgetEurCents: 1000,
      eurPerPearlCents: 190,
      itemPearlCosts: [10, 15, 5],
    });

    // 1000 / 190 floors to 5 whole Pearls.
    expect(plan.pearlsToLoad).toBe(5);
    expect(plan.loadCostEurCents).toBe(950);
    expect(plan.headroomEurCents).toBe(50);
    expect(plan.coversItems).toBe(false);
    expect(plan.totalItemPearls).toBe(30);
    expect(plan.totalItemCostEurCents).toBe(5700);
    expect(plan.unaffordablePearls).toBe(25);
    expect(plan.shortfallEurCents).toBe(5700 - 950);
  });

  it("handles an empty item list and a zero budget", () => {
    const empty = planPearlTopUp({ budgetEurCents: 5000, eurPerPearlCents: 190, itemPearlCosts: [] });
    expect(empty).toEqual({
      pearlsToLoad: 0,
      totalItemPearls: 0,
      totalItemCostEurCents: 0,
      loadCostEurCents: 0,
      budgetEurCents: 5000,
      headroomEurCents: 5000,
      shortfallEurCents: 0,
      unaffordablePearls: 0,
      coversItems: true,
    });

    const broke = planPearlTopUp({ budgetEurCents: 0, eurPerPearlCents: 190, itemPearlCosts: [3] });
    expect(broke.pearlsToLoad).toBe(0);
    expect(broke.coversItems).toBe(false);
    expect(broke.headroomEurCents).toBe(0);
  });

  it("keeps the plan consistent for seeded budgets and rates", () => {
    // Deterministic PRNG (mulberry32); small values keep the loop readable.
    let state = 1234;
    const random = (): number => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let round = 0; round < 150; round += 1) {
      const eurPerPearlCents = 50 + Math.floor(random() * 500);
      const budgetEurCents = Math.floor(random() * 50_000);
      const itemPearlCosts = Array.from({ length: Math.floor(random() * 6) }, () =>
        Math.floor(random() * 40),
      );

      const plan = planPearlTopUp({ budgetEurCents, eurPerPearlCents, itemPearlCosts });

      expect(plan.loadCostEurCents).toBeLessThanOrEqual(budgetEurCents);
      expect(plan.headroomEurCents).toBeGreaterThanOrEqual(0);
      expect(plan.loadCostEurCents).toBe(pearlsToEurCents(plan.pearlsToLoad, eurPerPearlCents));
      expect(plan.totalItemCostEurCents).toBe(
        pearlsToEurCents(plan.totalItemPearls, eurPerPearlCents),
      );
      expect(plan.pearlsToLoad + plan.unaffordablePearls).toBe(plan.totalItemPearls);
      expect(plan.coversItems).toBe(plan.pearlsToLoad === plan.totalItemPearls);
      expect(plan.shortfallEurCents).toBe(plan.totalItemCostEurCents - plan.loadCostEurCents);
      expect(plan.headroomEurCents).toBe(budgetEurCents - plan.loadCostEurCents);
    }
  });

  it("rejects malformed input", () => {
    expect(() =>
      planPearlTopUp({ budgetEurCents: 100, eurPerPearlCents: 0, itemPearlCosts: [] }),
    ).toThrow(RangeError);
    expect(() =>
      planPearlTopUp({ budgetEurCents: -1, eurPerPearlCents: 190, itemPearlCosts: [] }),
    ).toThrow(RangeError);
    expect(() =>
      planPearlTopUp({ budgetEurCents: 100, eurPerPearlCents: 190, itemPearlCosts: [-2] }),
    ).toThrow(RangeError);
  });
});

describe("minimumSensiblePearls", () => {
  it("buys exactly the requirement when a single package covers it", () => {
    const purchase = minimumSensiblePearls(10, [1, 5, 10, 25]);
    expect(purchase.pearlsToBuy).toBe(10);
    expect(purchase.overshootPearls).toBe(0);
    expect(purchase.packages).toEqual([{ pearls: 10, count: 1 }]);
  });

  it("uses the supplied denominations rather than assuming a size", () => {
    const purchase = minimumSensiblePearls(37, [1, 5, 20]);
    expect(purchase.pearlsToBuy).toBe(37);
    expect(purchase.overshootPearls).toBe(0);
    expect(purchase.packages).toEqual([
      { pearls: 20, count: 1 },
      { pearls: 5, count: 3 },
      { pearls: 1, count: 2 },
    ]);
  });

  it("overshoots by as little as the denominations allow", () => {
    // Reachable totals near 21 are 20 and 25; 25 is the smallest that reaches it.
    const purchase = minimumSensiblePearls(21, [10, 15]);
    expect(purchase.pearlsToBuy).toBe(25);
    expect(purchase.overshootPearls).toBe(4);
    expect(purchase.packages).toEqual([
      { pearls: 15, count: 1 },
      { pearls: 10, count: 1 },
    ]);
  });

  it("prefers an exact combination over a single larger package", () => {
    // 4 + 5 is exactly 9, so the 10 package would be a needless overshoot.
    const purchase = minimumSensiblePearls(9, [4, 5, 10]);
    expect(purchase.pearlsToBuy).toBe(9);
    expect(purchase.overshootPearls).toBe(0);
    expect(purchase.packages).toEqual([
      { pearls: 5, count: 1 },
      { pearls: 4, count: 1 },
    ]);
  });

  it("searches above the requirement when every package is smaller than it", () => {
    const purchase = minimumSensiblePearls(23, [3, 4]);
    expect(purchase.pearlsToBuy).toBe(23);
    expect(purchase.packages.reduce((sum, entry) => sum + entry.pearls * entry.count, 0)).toBe(23);
  });

  it("returns nothing for a zero requirement", () => {
    expect(minimumSensiblePearls(0, [10])).toEqual({
      pearlsToBuy: 0,
      overshootPearls: 0,
      packages: [],
    });
  });

  it("falls back to a single package when the gap is smaller than one", () => {
    const purchase = minimumSensiblePearls(1, [25]);
    expect(purchase.pearlsToBuy).toBe(25);
    expect(purchase.overshootPearls).toBe(24);
    expect(purchase.packages).toEqual([{ pearls: 25, count: 1 }]);
  });

  it("rejects impossible or invalid input", () => {
    expect(() => minimumSensiblePearls(10, [])).toThrow(RangeError);
    expect(() => minimumSensiblePearls(10, [0])).toThrow(RangeError);
    expect(() => minimumSensiblePearls(-1, [10])).toThrow(RangeError);
    expect(() => minimumSensiblePearls(10, [2.5])).toThrow(RangeError);
    expect(() => minimumSensiblePearls(10, "10" as unknown as number[])).toThrow(RangeError);
  });

  it("matches an exhaustive search for seeded small denominations", () => {
    // Deterministic PRNG (mulberry32) for a reproducible property loop.
    let state = 55_555;
    const random = (): number => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let round = 0; round < 60; round += 1) {
      const size = 1 + Math.floor(random() * 3);
      const denominations = Array.from(
        { length: size },
        () => 1 + Math.floor(random() * 12),
      );
      const requirement = 1 + Math.floor(random() * 40);

      const purchase = minimumSensiblePearls(requirement, denominations);
      const total = purchase.packages.reduce((sum, entry) => sum + entry.pearls * entry.count, 0);

      // Exhaustive reference: the smallest reachable total at or above the
      // requirement, searching every count of every denomination up to a
      // ceiling that provably contains the optimum.
      const ceiling = requirement + Math.max(...denominations);
      let reference = Number.POSITIVE_INFINITY;
      const walk = (index: number, accumulated: number): void => {
        if (accumulated >= reference) return;
        if (index === denominations.length) {
          if (accumulated >= requirement) reference = accumulated;
          return;
        }
        for (let count = 0; count * denominations[index] <= ceiling; count += 1) {
          walk(index + 1, accumulated + count * denominations[index]);
        }
      };
      walk(0, 0);

      // The packages must add up to the reported total, and the total must be
      // the smallest reachable one.
      expect(total).toBe(purchase.pearlsToBuy);
      expect(purchase.pearlsToBuy).toBe(reference);
      expect(purchase.overshootPearls).toBe(reference - requirement);
      expect(purchase.packages.every((entry) => denominations.includes(entry.pearls))).toBe(true);
    }
  });
});
