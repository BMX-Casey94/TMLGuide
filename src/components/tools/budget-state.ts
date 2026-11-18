import { z } from "zod";
import { computeBudget, perDay, type BudgetCategoryTotal, type BudgetLine } from "@/lib/tools";
import { currencyForEdition, toolEditionSchema, type ToolCurrency, type ToolEdition } from "./editions";
import { MAX_MINOR_UNITS } from "./format";
import {
  CUSTOM_TICKET_ID,
  defaultTicketId,
  findTicketChoice,
  ticketChoicesFor,
  type TicketChoice,
} from "./ticket-choices";

/**
 * The festival budget calculator's state and arithmetic.
 *
 * The shape here is the whole contract between the form, the URL, localStorage
 * and the result. It is deliberately made of validated numbers rather than the
 * text a reader typed: the form keeps a text buffer per field so partial input
 * works, but only a value that parses becomes state. A corrupt URL or a stale
 * stored record therefore cannot reach the arithmetic at all.
 */

/** An amount in minor units of the edition's currency: zero or more. */
const amountSchema = z
  .int({ error: "an amount must be a whole number of minor units" })
  .min(0, { error: "an amount must not be negative" })
  .max(MAX_MINOR_UNITS, { error: "an amount is larger than this tool accepts" });

/** The group size the per-person figures are computed from. */
export const MIN_PEOPLE = 1;
export const MAX_PEOPLE = 40;

export const budgetStateSchema = z.strictObject({
  edition: toolEditionSchema,
  /** A ticket product id from the edition's data, or {@link CUSTOM_TICKET_ID}. */
  ticketId: z.string().min(1).max(80),
  /** The hand-typed ticket price, used only when `ticketId` is the custom id. */
  ticketCustomMinor: amountSchema.nullable(),
  /** Per-person accommodation, or the whole-group figure when shared. */
  accommodationMinor: amountSchema.nullable(),
  /** Whether the accommodation figure is per person or for the whole group. */
  accommodationPerGroup: z.boolean(),
  travelMinor: amountSchema.nullable(),
  foodDrinkMinor: amountSchema.nullable(),
  extrasMinor: amountSchema.nullable(),
  people: z
    .int({ error: "the number of people must be a whole number" })
    .min(MIN_PEOPLE, { error: `the group must be at least ${MIN_PEOPLE} person` })
    .max(MAX_PEOPLE, { error: `the group can be at most ${MAX_PEOPLE} people` }),
});

export type BudgetState = z.infer<typeof budgetStateSchema>;

/** The state a first visit shows: the cheapest listed ticket, nothing else spent. */
export function defaultBudgetState(edition: ToolEdition = "belgium"): BudgetState {
  return {
    edition,
    ticketId: defaultTicketId(edition),
    ticketCustomMinor: null,
    accommodationMinor: null,
    accommodationPerGroup: false,
    travelMinor: null,
    foodDrinkMinor: null,
    extrasMinor: null,
    people: 1,
  };
}

export const BUDGET_STORAGE_KEY = "tml-budget-v1";
export const BUDGET_QUERY_KEY = "plan";

/**
 * Repairs a state whose ticket id does not belong to its edition.
 *
 * This happens legitimately: the edition switcher writes the chosen edition to
 * storage, so the first load on a newly chosen edition can find a plan built
 * around another edition's ticket. Keeping the rest of the plan and moving the
 * ticket choice to that edition's first published product is friendlier than
 * throwing the whole plan away, and the page says it happened.
 */
export function repairBudgetState(state: BudgetState): { state: BudgetState; repaired: boolean } {
  if (state.ticketId === CUSTOM_TICKET_ID) return { state, repaired: false };
  if (findTicketChoice(state.edition, state.ticketId) !== undefined) {
    return { state, repaired: false };
  }
  return {
    state: { ...state, ticketId: defaultTicketId(state.edition), ticketCustomMinor: null },
    repaired: true,
  };
}

/** The ticket row in the breakdown, whether it came from data or was typed in. */
export interface ResolvedTicket {
  readonly label: string;
  /** Price for one person, in minor units. Zero when the field is blank or invalid. */
  readonly priceMinor: number;
  /** The product chosen from the data, when one was; undefined for a custom amount. */
  readonly choice: TicketChoice | undefined;
  readonly isCustom: boolean;
}

/**
 * Resolves the ticket the state names.
 *
 * A custom amount with nothing typed yet resolves to zero rather than to a
 * guessed figure, and the form shows the empty field so the reader can see why
 * the total is low.
 */
export function resolveTicket(state: BudgetState): ResolvedTicket {
  if (state.ticketId === CUSTOM_TICKET_ID) {
    return {
      label: "Ticket (your own figure)",
      priceMinor: state.ticketCustomMinor ?? 0,
      choice: undefined,
      isCustom: true,
    };
  }
  const choice = findTicketChoice(state.edition, state.ticketId);
  if (choice === undefined) {
    return { label: "Ticket", priceMinor: 0, choice: undefined, isCustom: false };
  }
  return { label: choice.label, priceMinor: choice.priceMinor, choice, isCustom: false };
}

/** The categories, in the order the form presents them. */
export const BUDGET_CATEGORIES = {
  tickets: "Tickets",
  accommodation: "Accommodation",
  travel: "Travel",
  foodDrink: "Food and drink",
  extras: "Extras",
} as const;

/**
 * Builds the budget lines for the lib's `computeBudget`.
 *
 * A per-person cost becomes one line priced per person with `quantity` set to
 * the group size; shared accommodation is one group-priced line with a quantity
 * of one. That lets the tested library do the multiplication, so the tool never
 * re-implements it. Blank fields produce no line, which keeps the breakdown to
 * what the reader actually entered.
 */
export function budgetLinesFor(state: BudgetState): BudgetLine[] {
  const ticket = resolveTicket(state);
  const lines: BudgetLine[] = [];

  if (ticket.priceMinor > 0) {
    lines.push({
      id: "ticket",
      label: ticket.label,
      amountEurCents: ticket.priceMinor,
      quantity: state.people,
      category: BUDGET_CATEGORIES.tickets,
    });
  }

  const perPerson: ReadonlyArray<{ key: keyof typeof BUDGET_CATEGORIES; id: string; label: string; value: number | null }> = [
    { key: "accommodation", id: "accommodation", label: "Accommodation", value: state.accommodationMinor },
    { key: "travel", id: "travel", label: "Travel", value: state.travelMinor },
    { key: "foodDrink", id: "foodDrink", label: "Food and drink", value: state.foodDrinkMinor },
    { key: "extras", id: "extras", label: "Extras", value: state.extrasMinor },
  ];

  for (const entry of perPerson) {
    if (entry.value === null || entry.value <= 0) continue;
    const shared = entry.key === "accommodation" && state.accommodationPerGroup;
    lines.push({
      id: entry.id,
      label: shared ? `${entry.label} (shared)` : entry.label,
      amountEurCents: entry.value,
      quantity: shared ? 1 : state.people,
      category: BUDGET_CATEGORIES[entry.key],
    });
  }

  return lines;
}

/** One category's share of the total, ready for the chart and the table. */
export interface CategoryShare {
  readonly category: string;
  readonly totalMinor: number;
  /** Percentage of the grand total, 0 to 100, rounded for display. */
  readonly percent: number;
  readonly lineCount: number;
}

/** Everything the result panel renders. */
export interface BudgetResult {
  readonly currency: ToolCurrency;
  readonly grandTotalMinor: number;
  /** The whole-group total divided evenly, rounded half up. */
  readonly perPersonMinor: number;
  /**
   * Minor units the even split left over (positive) or handed out twice
   * (negative), so an odd total is disclosed rather than silently absorbed.
   */
  readonly splitRemainderMinor: number;
  readonly people: number;
  readonly categories: readonly CategoryShare[];
  /** True when nothing has been entered, so the page can say so plainly. */
  readonly isEmpty: boolean;
}

/**
 * Computes the result.
 *
 * The grand total and the per-category totals come from the tested
 * `computeBudget`; the per-person split reuses `perDay`, which divides a total
 * into equal parts with half-up rounding and reports what the rounding moved.
 *
 * @throws RangeError only if the caller hands in a state that bypassed
 *   `budgetStateSchema`, which cannot happen through the form, the URL or
 *   storage, since all three validate first.
 */
export function computeBudgetResult(state: BudgetState): BudgetResult {
  const currency = currencyForEdition(state.edition);
  const summary = computeBudget({ lines: budgetLinesFor(state) });
  const split = perDay(summary.grandTotalEurCents, state.people);

  const categories: CategoryShare[] = summary.categories.map((entry: BudgetCategoryTotal) => ({
    category: entry.category,
    totalMinor: entry.totalEurCents,
    percent:
      summary.grandTotalEurCents === 0
        ? 0
        : Math.round((entry.totalEurCents / summary.grandTotalEurCents) * 100),
    lineCount: entry.lineCount,
  }));

  return {
    currency,
    grandTotalMinor: summary.grandTotalEurCents,
    perPersonMinor: split.perDayEurCents,
    splitRemainderMinor: split.roundingRemainderEurCents,
    people: state.people,
    categories,
    isEmpty: summary.lines.length === 0,
  };
}

/**
 * The Winter payment hint, derived from the verified payment-terms fact.
 *
 * Winter sells packages on a part-payment: at least 40% at purchase, capped at
 * €2,500, with the balance due within 30 days. Both halves of that rule live in
 * the fact's `value` text, so the figures are read from it rather than typed in
 * twice; when the wording changes and the pattern no longer matches, the hint
 * falls back to quoting the fact alone instead of computing a wrong number.
 */
export interface InstalmentHint {
  /** The verified fact's own wording, shown verbatim. */
  readonly valueText: string;
  readonly detailText: string | undefined;
  /** The percentage due at purchase, when it could be read from the fact. */
  readonly upfrontPercent: number | null;
  /** The cap on the up-front amount, in euro cents, when the fact states one. */
  readonly capMinor: number | null;
  /** The up-front amount for this budget, when both the cap and percentage are known. */
  readonly upfrontMinor: number | null;
  /** What is left for the balance, when the up-front amount is known. */
  readonly balanceMinor: number | null;
  readonly sourceUrl: string;
  readonly lastVerified: string;
}

/** A Winter fact, reduced to what the hint needs. */
export interface PaymentTermsFact {
  readonly id: string;
  readonly value: string;
  readonly detail?: string;
  readonly amountEur?: number;
  readonly lastVerified: string;
  readonly source: { readonly url: string };
}

/**
 * Builds the instalment hint for a total.
 *
 * @returns null when the edition has no verified part-payment fact, which is
 *   every edition except Winter. Callers must not show a hint for null: a
 *   "pay in instalments" line on Belgium or Brasil would be an invented fact.
 */
export function buildInstalmentHint(
  edition: ToolEdition,
  totalMinor: number,
  fact: PaymentTermsFact | undefined,
): InstalmentHint | null {
  if (edition !== "winter" || fact === undefined) return null;

  const percentMatch = /(\d{1,2})\s?%/.exec(fact.value);
  const parsedPercent = percentMatch === null ? null : Number(percentMatch[1]);
  const upfrontPercent =
    parsedPercent !== null && parsedPercent > 0 && parsedPercent < 100 ? parsedPercent : null;

  const capMinor =
    typeof fact.amountEur === "number" && Number.isFinite(fact.amountEur)
      ? Math.round(fact.amountEur * 100)
      : null;

  if (upfrontPercent === null || capMinor === null || totalMinor <= 0) {
    return {
      valueText: fact.value,
      detailText: fact.detail,
      upfrontPercent,
      capMinor,
      upfrontMinor: null,
      balanceMinor: null,
      sourceUrl: fact.source.url,
      lastVerified: fact.lastVerified,
    };
  }

  // Whole cents, rounded down: the festival charges "at least" the percentage,
  // so the figure shown is the part of it that is certainly due at purchase.
  const percentageShare = Math.floor((totalMinor * upfrontPercent) / 100);
  const upfrontMinor = Math.min(percentageShare, capMinor);

  return {
    valueText: fact.value,
    detailText: fact.detail,
    upfrontPercent,
    capMinor,
    upfrontMinor,
    balanceMinor: totalMinor - upfrontMinor,
    sourceUrl: fact.source.url,
    lastVerified: fact.lastVerified,
  };
}

/** Which ticket ids are valid for an edition, for the form's select. */
export function ticketOptionsFor(edition: ToolEdition): readonly TicketChoice[] {
  return ticketChoicesFor(edition);
}
