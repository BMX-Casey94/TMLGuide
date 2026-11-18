/**
 * Pearl planning for the TMLGUIDE planning tools.
 *
 * Pearls are the festival's cashless currency. The guide does not know, and must
 * not hard-code, what a Pearl costs: every function takes the euro-per-Pearl rate
 * from the caller as an integer number of euro cents. All arithmetic is integer
 * arithmetic on euro cents; no floating point is used for totals.
 */

function assertRate(eurPerPearlCents: number): void {
  if (typeof eurPerPearlCents !== "number" || !Number.isSafeInteger(eurPerPearlCents)) {
    throw new RangeError(
      `eurPerPearlCents must be a whole number of cents, received ${String(eurPerPearlCents)}`,
    );
  }
  if (eurPerPearlCents <= 0) {
    throw new RangeError(`eurPerPearlCents must be greater than zero, received ${String(eurPerPearlCents)}`);
  }
}

function assertCount(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a whole number, received ${String(value)}`);
  }
  if (value < 0) {
    throw new RangeError(`${label} must not be negative, received ${String(value)}`);
  }
}

/** Result of converting a budget in euro cents into whole Pearls. */
export interface PearlConversion {
  /** Whole Pearls the budget can buy. */
  readonly wholePearls: number;
  /** Euro cents left over that are not enough for another Pearl. */
  readonly remainderEurCents: number;
}

/** Result of planning a Pearl top-up against a budget. */
export interface PearlTopUpPlan {
  /** Pearls worth loading now: enough for the items, capped by the budget. */
  readonly pearlsToLoad: number;
  /** Pearls the chosen items cost in total. */
  readonly totalItemPearls: number;
  /** Cost of the chosen items in euro cents at the supplied rate. */
  readonly totalItemCostEurCents: number;
  /** Cost of the Pearls being loaded in euro cents. */
  readonly loadCostEurCents: number;
  /** The budget the plan was made against, in euro cents. */
  readonly budgetEurCents: number;
  /** Budget left after paying for the Pearls being loaded, in euro cents. */
  readonly headroomEurCents: number;
  /** Money still needed to buy every chosen item, in euro cents; zero when covered. */
  readonly shortfallEurCents: number;
  /** Pearls the budget cannot reach, zero when the budget covers every item. */
  readonly unaffordablePearls: number;
  /** Whether the budget buys enough Pearls for every chosen item. */
  readonly coversItems: boolean;
}

/** Input for {@link planPearlTopUp}. */
export interface PearlTopUpInput {
  readonly budgetEurCents: number;
  readonly eurPerPearlCents: number;
  readonly itemPearlCosts: readonly number[];
}

/** A single top-up denomination and how many of them to buy. */
export interface PearlPackage {
  readonly pearls: number;
  readonly count: number;
}

/** Result of {@link minimumSensiblePearls}. */
export interface PearlPurchase {
  /** Total Pearls bought. Always at least the amount required. */
  readonly pearlsToBuy: number;
  /** Whole Pearls bought beyond the requirement. */
  readonly overshootPearls: number;
  /** Packages to buy, largest first, omitting any package with a zero count. */
  readonly packages: readonly PearlPackage[];
}

function toCents(pearls: number, eurPerPearlCents: number, label: string): number {
  const cents = pearls * eurPerPearlCents;
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`${label} is too large to price in euro cents: ${String(pearls)}`);
  }
  return cents;
}

/**
 * Prices a number of whole Pearls at the supplied rate.
 *
 * @throws RangeError when the Pearl count is not a non-negative whole number,
 * the rate is not a positive whole number of cents, or the total overflows.
 */
export function pearlsToEurCents(pearls: number, eurPerPearlCents: number): number {
  assertRate(eurPerPearlCents);
  assertCount(pearls, "pearls");
  return toCents(pearls, eurPerPearlCents, "pearls");
}

/**
 * Converts a budget in euro cents into the whole Pearls it can buy, reporting
 * the money that cannot reach another Pearl. Partial Pearls are not sold, so
 * the remainder is left unspent rather than rounded into a Pearl.
 *
 * @throws RangeError when the budget or rate is invalid.
 */
export function eurToPearls(eurCents: number, eurPerPearlCents: number): PearlConversion {
  assertRate(eurPerPearlCents);
  assertCount(eurCents, "eurCents");

  const wholePearls = Math.floor(eurCents / eurPerPearlCents);
  const remainderEurCents = eurCents - wholePearls * eurPerPearlCents;
  return { wholePearls, remainderEurCents };
}

/**
 * Plans how many Pearls to load for a list of item costs, given a budget.
 *
 * The plan loads the cheaper of "every item needs" and "the budget allows", so
 * the returned figures are always spendable: `loadCostEurCents` never exceeds
 * the budget, and `coversItems` says whether that is enough for every item.
 *
 * @throws RangeError when the budget, rate or any item cost is invalid.
 */
export function planPearlTopUp(input: PearlTopUpInput): PearlTopUpPlan {
  const { budgetEurCents, eurPerPearlCents, itemPearlCosts } = input;

  assertRate(eurPerPearlCents);
  assertCount(budgetEurCents, "budgetEurCents");
  if (!Array.isArray(itemPearlCosts)) {
    throw new RangeError("itemPearlCosts must be an array of Pearl amounts");
  }

  let totalItemPearls = 0;
  for (const cost of itemPearlCosts) {
    assertCount(cost, "each item cost");
    totalItemPearls += cost;
    if (!Number.isSafeInteger(totalItemPearls)) {
      throw new RangeError("the total Pearl cost is too large to represent");
    }
  }

  const totalItemCostEurCents = toCents(totalItemPearls, eurPerPearlCents, "the total Pearl cost");
  const affordable = eurToPearls(budgetEurCents, eurPerPearlCents);
  const pearlsToLoad = Math.min(totalItemPearls, affordable.wholePearls);
  const loadCostEurCents = pearlsToLoad * eurPerPearlCents;
  const coversItems = pearlsToLoad === totalItemPearls;

  return {
    pearlsToLoad,
    totalItemPearls,
    totalItemCostEurCents,
    loadCostEurCents,
    budgetEurCents,
    headroomEurCents: budgetEurCents - loadCostEurCents,
    shortfallEurCents: coversItems ? 0 : totalItemCostEurCents - loadCostEurCents,
    unaffordablePearls: totalItemPearls - pearlsToLoad,
    coversItems,
  };
}

/**
 * Finds the smallest purchase that reaches a required number of Pearls, using
 * the top-up sizes the caller supplies (for example the packages a ticket shop
 * lists). The search is exact: it minimises the Pearls bought, so the overshoot
 * is as small as the available denominations allow, and composes that total from
 * as few packages as possible. It never invents a denomination.
 *
 * @throws RangeError when the requirement or a denomination is invalid, when no
 * denominations are supplied, or when the search space would be unreasonable.
 */
export function minimumSensiblePearls(
  requiredPearls: number,
  denominationPearls: readonly number[],
): PearlPurchase {
  assertCount(requiredPearls, "requiredPearls");
  if (!Array.isArray(denominationPearls) || denominationPearls.length === 0) {
    throw new RangeError("denominationPearls must be a non-empty array of top-up sizes");
  }

  const denominations = [...new Set(denominationPearls)].sort((a, b) => a - b);
  for (const denomination of denominations) {
    if (typeof denomination !== "number" || !Number.isSafeInteger(denomination) || denomination <= 0) {
      throw new RangeError(`each top-up size must be a positive whole number of Pearls, received ${String(denomination)}`);
    }
  }

  if (requiredPearls === 0) {
    return { pearlsToBuy: 0, overshootPearls: 0, packages: [] };
  }

  // One package of the smallest size always suffices eventually, so the smallest
  // optimal total is below `required + smallest`; totals above that cannot win.
  const smallest = denominations[0];
  const limit = requiredPearls + smallest - 1;
  if (limit > 1_000_000) {
    throw new RangeError(
      `the requirement is too large to search exactly: ${String(requiredPearls)} Pearls with a smallest package of ${String(smallest)}`,
    );
  }

  // Fewest packages that add up to each total, with the package used last so a
  // combination can be reconstructed. Ascending order makes each entry final
  // before it is used to reach a larger total.
  const packageCount = new Int32Array(limit + 1).fill(-1);
  const lastPackage = new Int32Array(limit + 1).fill(-1);
  packageCount[0] = 0;

  for (let total = 0; total <= limit; total += 1) {
    const count = packageCount[total];
    if (count < 0) continue;
    for (let index = 0; index < denominations.length; index += 1) {
      const next = total + denominations[index];
      if (next > limit) continue;
      if (packageCount[next] < 0 || count + 1 < packageCount[next]) {
        packageCount[next] = count + 1;
        lastPackage[next] = index;
      }
    }
  }

  let pearlsToBuy = -1;
  for (let total = requiredPearls; total <= limit; total += 1) {
    if (packageCount[total] >= 0) {
      pearlsToBuy = total;
      break;
    }
  }
  if (pearlsToBuy === -1) {
    throw new RangeError("no combination of the supplied top-up sizes reaches the requirement");
  }

  const counts = new Map<number, number>();
  for (let total = pearlsToBuy; total > 0; ) {
    const index = lastPackage[total];
    if (index < 0) {
      throw new RangeError("no combination of the supplied top-up sizes reaches the requirement");
    }
    const denomination = denominations[index];
    counts.set(denomination, (counts.get(denomination) ?? 0) + 1);
    total -= denomination;
  }

  const packages = [...counts.entries()]
    .sort(([a], [b]) => b - a)
    .map(([pearls, count]) => ({ pearls, count }));

  return {
    pearlsToBuy,
    overshootPearls: pearlsToBuy - requiredPearls,
    packages,
  };
}
