/**
 * Budget arithmetic for the TMLGUIDE planning tools.
 *
 * A budget is a list of lines, each with a unit amount in euro cents and a
 * quantity. Totals are integer arithmetic throughout; the indicative sterling
 * figure is produced in pence by {@link convertEurCentsToGbpPence} and only when
 * the caller supplies a rate.
 */

import { convertEurCentsToGbpPence } from "./money";

/** One spending line in a budget. */
export interface BudgetLine {
  /** Stable identifier for the line, unique within the budget. */
  readonly id: string;
  /** What the money is for, shown to the reader. */
  readonly label: string;
  /**
   * The amount for one unit, in euro cents. Negative amounts are allowed so a
   * discount or refund can be a line of its own.
   */
  readonly amountEurCents: number;
  /** How many units. A whole number, zero or more. */
  readonly quantity: number;
  /** Grouping label, for example "Travel" or "Food". */
  readonly category: string;
}

/** Input for {@link computeBudget}. */
export interface BudgetInput {
  readonly lines: readonly BudgetLine[];
  /**
   * Optional euro-to-pound rate. When supplied, the result carries an
   * indicative sterling total; when omitted, it carries `null` and the caller
   * must not show a pound figure.
   */
  readonly gbpPerEur?: number;
}

/** A resolved budget line with its own total. */
export interface BudgetLineTotal {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly amountEurCents: number;
  readonly quantity: number;
  /** `amountEurCents * quantity`, in euro cents. */
  readonly totalEurCents: number;
}

/** Totals for one category. */
export interface BudgetCategoryTotal {
  readonly category: string;
  readonly totalEurCents: number;
  /** How many lines contribute to the category. */
  readonly lineCount: number;
}

/** The computed budget. */
export interface BudgetSummary {
  /** Every input line with its own total, in input order. */
  readonly lines: readonly BudgetLineTotal[];
  /** Category totals, largest first, ties broken by category name. */
  readonly categories: readonly BudgetCategoryTotal[];
  /** The sum of every line total, in euro cents. */
  readonly grandTotalEurCents: number;
  /** Indicative total in pence, or null when no rate was supplied. */
  readonly indicativeGbpPence: number | null;
  /** The rate used, or null when no rate was supplied. */
  readonly gbpPerEur: number | null;
}

/** A per-day share of a total. */
export interface PerDayFigure {
  readonly totalEurCents: number;
  readonly days: number;
  /** The share rounded half up to a whole number of cents. */
  readonly perDayEurCents: number;
  /** `totalEurCents - perDayEurCents * days`; the cents the rounding moved. */
  readonly roundingRemainderEurCents: number;
}

function assertAmount(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a whole number of euro cents, received ${String(value)}`);
  }
}

/**
 * Computes per-category totals, a grand total in euro cents and, when a rate is
 * supplied, an indicative total in pence.
 *
 * @throws RangeError when the input is malformed, a quantity is not a whole
 * number of zero or more, an amount is not a whole number of cents, an id
 * repeats, a rate is not finite and greater than zero, or a total overflows a
 * safe integer.
 */
export function computeBudget(input: BudgetInput): BudgetSummary {
  if (input === null || typeof input !== "object") {
    throw new RangeError("computeBudget needs an input object");
  }
  const { lines, gbpPerEur } = input;
  if (!Array.isArray(lines)) {
    throw new RangeError("lines must be an array of budget lines");
  }
  if (gbpPerEur !== undefined) {
    if (typeof gbpPerEur !== "number" || !Number.isFinite(gbpPerEur) || gbpPerEur <= 0) {
      throw new RangeError(`gbpPerEur must be a finite number greater than zero, received ${String(gbpPerEur)}`);
    }
  }

  const seenIds = new Set<string>();
  const resolved: BudgetLineTotal[] = [];
  const categoryTotals = new Map<string, { totalEurCents: number; lineCount: number }>();
  let grandTotal = 0;

  lines.forEach((line, index) => {
    if (line === null || typeof line !== "object") {
      throw new RangeError(`budget line at index ${index} must be an object`);
    }
    if (typeof line.id !== "string" || line.id.trim() === "") {
      throw new RangeError(`budget line at index ${index} needs a non-empty id`);
    }
    if (seenIds.has(line.id)) {
      throw new RangeError(`budget line id "${line.id}" appears more than once`);
    }
    seenIds.add(line.id);

    if (typeof line.label !== "string" || line.label.trim() === "") {
      throw new RangeError(`budget line "${line.id}" needs a non-empty label`);
    }
    if (typeof line.category !== "string" || line.category.trim() === "") {
      throw new RangeError(`budget line "${line.id}" needs a non-empty category`);
    }
    assertAmount(line.amountEurCents, `the amount of budget line "${line.id}"`);

    if (typeof line.quantity !== "number" || !Number.isSafeInteger(line.quantity)) {
      throw new RangeError(`the quantity of budget line "${line.id}" must be a whole number`);
    }
    if (line.quantity < 0) {
      throw new RangeError(`the quantity of budget line "${line.id}" must not be negative`);
    }

    const lineTotal = line.amountEurCents * line.quantity;
    if (!Number.isSafeInteger(lineTotal)) {
      throw new RangeError(`the total of budget line "${line.id}" is too large to represent`);
    }

    grandTotal += lineTotal;
    if (!Number.isSafeInteger(grandTotal)) {
      throw new RangeError("the grand total is too large to represent as a safe integer");
    }

    const existing = categoryTotals.get(line.category) ?? { totalEurCents: 0, lineCount: 0 };
    existing.totalEurCents += lineTotal;
    existing.lineCount += 1;
    if (!Number.isSafeInteger(existing.totalEurCents)) {
      throw new RangeError(`the total for category "${line.category}" is too large to represent`);
    }
    categoryTotals.set(line.category, existing);

    resolved.push({
      id: line.id,
      label: line.label,
      category: line.category,
      amountEurCents: line.amountEurCents,
      quantity: line.quantity,
      totalEurCents: lineTotal,
    });
  });

  const categories = [...categoryTotals.entries()]
    .map(([category, totals]) => ({
      category,
      totalEurCents: totals.totalEurCents,
      lineCount: totals.lineCount,
    }))
    .sort((a, b) =>
      a.totalEurCents === b.totalEurCents
        ? a.category.localeCompare(b.category, "en-GB")
        : b.totalEurCents - a.totalEurCents,
    );

  return {
    lines: resolved,
    categories,
    grandTotalEurCents: grandTotal,
    indicativeGbpPence:
      gbpPerEur === undefined ? null : convertEurCentsToGbpPence(grandTotal, gbpPerEur),
    gbpPerEur: gbpPerEur ?? null,
  };
}

/**
 * Divides a total into a per-day share, rounding half up to the nearest cent and
 * reporting what the rounding left over so a caller can show the exact figure.
 *
 * @throws RangeError when the total is not a whole number of cents or the day
 * count is not a whole number of one or more.
 */
export function perDay(totalEurCents: number, days: number): PerDayFigure {
  assertAmount(totalEurCents, "totalEurCents");
  if (typeof days !== "number" || !Number.isSafeInteger(days)) {
    throw new RangeError(`days must be a whole number, received ${String(days)}`);
  }
  if (days < 1) {
    throw new RangeError(`days must be at least one, received ${String(days)}`);
  }

  // Half up means away from zero, so a negative total is rounded through its
  // magnitude rather than through Math.floor's downward bias. The quotient and
  // remainder keep the arithmetic exact: doubling the total to round would
  // overflow a safe integer for large budgets.
  const magnitude = Math.abs(totalEurCents);
  const whole = Math.floor(magnitude / days);
  const remainder = magnitude - whole * days;
  const rounded = remainder * 2 >= days ? whole + 1 : whole;
  const share = totalEurCents < 0 ? -rounded : rounded;

  return {
    totalEurCents,
    days,
    perDayEurCents: share,
    roundingRemainderEurCents: totalEurCents - share * days,
  };
}
