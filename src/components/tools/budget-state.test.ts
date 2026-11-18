// @vitest-environment node
import { describe, expect, it } from "vitest";

import { computeBudget, perDay } from "@/lib/tools";
import {
  BUDGET_CATEGORIES,
  MAX_PEOPLE,
  budgetLinesFor,
  budgetStateSchema,
  buildInstalmentHint,
  computeBudgetResult,
  defaultBudgetState,
  repairBudgetState,
  resolveTicket,
  type BudgetState,
  type PaymentTermsFact,
} from "./budget-state";
import { ticketChoicesFor } from "./ticket-choices";
import { winterFacts } from "@/data/winter";

/** The verified Winter payment-terms fact, as the page passes it in. */
const winterPaymentFact: PaymentTermsFact = {
  id: "package-payment-terms",
  value: "Prepayment of at least 40% at purchase, capped at €2,500; balance within 30 days",
  detail: "The cap applies however large the order: prepayment is 40% of the total or €2,500, whichever is lower.",
  amountEur: 2500,
  lastVerified: "2026-11-18",
  source: { url: "https://winter.tomorrowland.com/en/sales-info/payment-methods-and-conditions/" },
};

function stateOf(overrides: Partial<BudgetState> = {}): BudgetState {
  return { ...defaultBudgetState("belgium"), ...overrides };
}

describe("budgetStateSchema", () => {
  it("accepts the default state for every edition", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      expect(budgetStateSchema.safeParse(defaultBudgetState(edition)).success).toBe(true);
    }
  });

  it("rejects a group size outside the allowed range", () => {
    expect(budgetStateSchema.safeParse(stateOf({ people: 0 })).success).toBe(false);
    expect(budgetStateSchema.safeParse(stateOf({ people: -1 })).success).toBe(false);
    expect(budgetStateSchema.safeParse(stateOf({ people: MAX_PEOPLE + 1 })).success).toBe(false);
    expect(budgetStateSchema.safeParse(stateOf({ people: 1.5 })).success).toBe(false);
    expect(budgetStateSchema.safeParse(stateOf({ people: Number.NaN })).success).toBe(false);
  });

  it("rejects negative and oversized amounts", () => {
    expect(budgetStateSchema.safeParse(stateOf({ travelMinor: -1 })).success).toBe(false);
    expect(budgetStateSchema.safeParse(stateOf({ foodDrinkMinor: 1.5 })).success).toBe(false);
    expect(budgetStateSchema.safeParse(stateOf({ extrasMinor: Number.MAX_SAFE_INTEGER })).success).toBe(
      false,
    );
  });

  it("rejects an unknown edition and unknown keys", () => {
    expect(budgetStateSchema.safeParse({ ...stateOf(), edition: "mars" }).success).toBe(false);
    expect(budgetStateSchema.safeParse({ ...stateOf(), injected: 1 }).success).toBe(false);
  });
});

describe("defaultBudgetState", () => {
  it("starts on the first published ticket for each edition", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      const state = defaultBudgetState(edition);
      expect(state.ticketId).toBe(ticketChoicesFor(edition)[0].id);
      expect(state.people).toBe(1);
      expect(state.accommodationMinor).toBeNull();
    }
  });

  it("offers every published ticket price from the data layer", () => {
    // Belgium has five products per sale tier; the exact count is the data's
    // business, but each option must carry a real price and a source.
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      const choices = ticketChoicesFor(edition);
      expect(choices.length).toBeGreaterThan(0);
      for (const choice of choices) {
        expect(Number.isSafeInteger(choice.priceMinor)).toBe(true);
        expect(choice.priceMinor).toBeGreaterThan(0);
        expect(choice.sourceUrl).toMatch(/^https:\/\//);
        expect(choice.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("prices Brasil tickets in centavos without converting to euros", () => {
    const brasil = ticketChoicesFor("brasil");
    const fullMadness = brasil.find((choice) => choice.id === "full-madness");
    expect(fullMadness?.priceMinor).toBe(316_000);
  });

  it("marks a sold-out Brasil product as sold out", () => {
    for (const choice of ticketChoicesFor("brasil")) {
      expect(choice.soldOut).toBe(true);
    }
  });
});

describe("repairBudgetState", () => {
  it("leaves a valid ticket choice alone", () => {
    const state = stateOf();
    expect(repairBudgetState(state)).toEqual({ state, repaired: false });
  });

  it("moves a foreign ticket id to the edition's first product", () => {
    const brasilTicket = ticketChoicesFor("brasil")[0].id;
    const state = stateOf({ edition: "belgium", ticketId: brasilTicket, ticketCustomMinor: 5000 });
    const repaired = repairBudgetState(state);
    expect(repaired.repaired).toBe(true);
    expect(repaired.state.ticketId).toBe(ticketChoicesFor("belgium")[0].id);
    expect(repaired.state.ticketCustomMinor).toBeNull();
    // Everything else is kept.
    expect(repaired.state.people).toBe(state.people);
  });

  it("never rewrites a custom amount", () => {
    const state = stateOf({ ticketId: "custom", ticketCustomMinor: 12_345 });
    expect(repairBudgetState(state)).toEqual({ state, repaired: false });
  });
});

describe("resolveTicket", () => {
  it("resolves a published product with its label and source", () => {
    const state = stateOf();
    const ticket = resolveTicket(state);
    expect(ticket.choice).toBeDefined();
    expect(ticket.priceMinor).toBeGreaterThan(0);
    expect(ticket.isCustom).toBe(false);
  });

  it("resolves a custom amount, and zero when nothing is typed", () => {
    const withAmount = resolveTicket(stateOf({ ticketId: "custom", ticketCustomMinor: 9999 }));
    expect(withAmount).toMatchObject({ priceMinor: 9999, isCustom: true });

    const blank = resolveTicket(stateOf({ ticketId: "custom", ticketCustomMinor: null }));
    expect(blank.priceMinor).toBe(0);
  });
});

describe("budgetLinesFor", () => {
  it("multiplies per-person lines by the group size", () => {
    const state = stateOf({ people: 3, travelMinor: 5000, foodDrinkMinor: 2000 });
    const lines = budgetLinesFor(state);
    const travel = lines.find((line) => line.id === "travel");
    expect(travel?.quantity).toBe(3);
    expect(travel?.category).toBe(BUDGET_CATEGORIES.travel);
  });

  it("does not multiply shared accommodation", () => {
    const shared = budgetLinesFor(stateOf({ people: 4, accommodationMinor: 80_000, accommodationPerGroup: true }));
    expect(shared.find((line) => line.id === "accommodation")?.quantity).toBe(1);
    expect(shared.find((line) => line.id === "accommodation")?.label).toContain("shared");

    const perPerson = budgetLinesFor(stateOf({ people: 4, accommodationMinor: 80_000 }));
    expect(perPerson.find((line) => line.id === "accommodation")?.quantity).toBe(4);
  });

  it("omits blank fields rather than adding zero lines", () => {
    const lines = budgetLinesFor(stateOf({ ticketId: "custom", ticketCustomMinor: null }));
    expect(lines).toEqual([]);
  });

  it("omits a zero amount but keeps a priced ticket", () => {
    // A blank travel field adds no line, while the chosen ticket still does.
    const lines = budgetLinesFor(stateOf({ travelMinor: 0, foodDrinkMinor: 100 }));
    expect(lines.map((line) => line.id)).toEqual(["ticket", "foodDrink"]);
  });
});

describe("computeBudgetResult", () => {
  it("agrees with the tested library for the same lines", () => {
    const state = stateOf({ people: 2, travelMinor: 12_500, foodDrinkMinor: 7000, extrasMinor: 1500 });
    const result = computeBudgetResult(state);
    const reference = computeBudget({ lines: budgetLinesFor(state) });
    expect(result.grandTotalMinor).toBe(reference.grandTotalEurCents);
    expect(result.categories.map((entry) => entry.category)).toEqual(
      reference.categories.map((entry) => entry.category),
    );
  });

  it("splits per person with half-up rounding and discloses the remainder", () => {
    // 100 cents across three people is 33 each, leaving one cent.
    const state = stateOf({ ticketId: "custom", ticketCustomMinor: 100, people: 3 });
    const result = computeBudgetResult(state);
    expect(result.grandTotalMinor).toBe(300);
    expect(result.perPersonMinor).toBe(100);

    // A total that does not divide exactly reports what was left over.
    const uneven = computeBudgetResult(stateOf({ ticketId: "custom", ticketCustomMinor: 101, people: 3 }));
    expect(uneven.perPersonMinor).toBe(perDay(uneven.grandTotalMinor, 3).perDayEurCents);
    expect(uneven.splitRemainderMinor).toBe(perDay(uneven.grandTotalMinor, 3).roundingRemainderEurCents);
  });

  it("reports an empty budget plainly rather than showing a misleading figure", () => {
    const result = computeBudgetResult(stateOf({ ticketId: "custom", ticketCustomMinor: null }));
    expect(result.isEmpty).toBe(true);
    expect(result.grandTotalMinor).toBe(0);
    expect(result.categories).toEqual([]);
  });

  it("gives every non-empty category a whole percentage that sums to about 100", () => {
    const result = computeBudgetResult(
      stateOf({ people: 2, travelMinor: 30_000, foodDrinkMinor: 10_000, extrasMinor: 5000 }),
    );
    for (const entry of result.categories) {
      expect(Number.isInteger(entry.percent)).toBe(true);
      expect(entry.percent).toBeGreaterThanOrEqual(0);
      expect(entry.percent).toBeLessThanOrEqual(100);
    }
    const sum = result.categories.reduce((total, entry) => total + entry.percent, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(result.categories.length);
  });

  it("keeps the currency tied to the edition", () => {
    expect(computeBudgetResult(stateOf({ edition: "belgium" })).currency).toBe("EUR");
    expect(computeBudgetResult(stateOf({ edition: "winter" })).currency).toBe("EUR");
    expect(computeBudgetResult(stateOf({ edition: "brasil" })).currency).toBe("BRL");
  });

  it("handles a very large but permitted budget without losing precision", () => {
    const state = stateOf({
      people: MAX_PEOPLE,
      accommodationMinor: 1_000_000,
      travelMinor: 1_000_000,
      foodDrinkMinor: 1_000_000,
      extrasMinor: 1_000_000,
    });
    expect(() => computeBudgetResult(state)).not.toThrow();
    const result = computeBudgetResult(state);
    expect(Number.isSafeInteger(result.grandTotalMinor)).toBe(true);
    expect(Number.isSafeInteger(result.perPersonMinor)).toBe(true);
  });
});

describe("buildInstalmentHint", () => {
  it("is absent for Belgium and Brasil even when a fact is supplied", () => {
    expect(buildInstalmentHint("belgium", 100_000, winterPaymentFact)).toBeNull();
    expect(buildInstalmentHint("brasil", 100_000, winterPaymentFact)).toBeNull();
  });

  it("is absent for Winter when the data holds no fact", () => {
    expect(buildInstalmentHint("winter", 100_000, undefined)).toBeNull();
  });

  it("computes 40% for a Winter budget below the cap", () => {
    const hint = buildInstalmentHint("winter", 100_000, winterPaymentFact);
    expect(hint?.upfrontPercent).toBe(40);
    expect(hint?.upfrontMinor).toBe(40_000);
    expect(hint?.balanceMinor).toBe(60_000);
  });

  it("caps the up-front amount at €2,500 for a large Winter budget", () => {
    const hint = buildInstalmentHint("winter", 1_000_000, winterPaymentFact);
    expect(hint?.capMinor).toBe(250_000);
    expect(hint?.upfrontMinor).toBe(250_000);
    expect(hint?.balanceMinor).toBe(750_000);
  });

  it("never reports more up front than the total", () => {
    const hint = buildInstalmentHint("winter", 1000, winterPaymentFact);
    expect(hint?.upfrontMinor).toBe(400);
    expect(hint?.balanceMinor).toBe(600);
  });

  it("quotes the fact without arithmetic when the total is zero", () => {
    const hint = buildInstalmentHint("winter", 0, winterPaymentFact);
    expect(hint?.upfrontMinor).toBeNull();
    expect(hint?.balanceMinor).toBeNull();
    expect(hint?.valueText).toContain("40%");
  });

  it("falls back to the wording when the fact no longer carries a percentage and a cap", () => {
    const vague: PaymentTermsFact = { ...winterPaymentFact, value: "Payment on booking", amountEur: undefined };
    const hint = buildInstalmentHint("winter", 100_000, vague);
    expect(hint?.upfrontPercent).toBeNull();
    expect(hint?.upfrontMinor).toBeNull();
    expect(hint?.valueText).toBe("Payment on booking");
  });

  it("reads the real verified fact, so the hint does not depend on a typed copy", () => {
    const fact = winterFacts.find((entry) => entry.id === "package-payment-terms");
    expect(fact).toBeDefined();
    const hint = buildInstalmentHint("winter", 100_000, {
      id: fact!.id,
      value: fact!.value,
      ...(fact!.detail === undefined ? {} : { detail: fact!.detail }),
      ...(fact!.amountEur === undefined ? {} : { amountEur: fact!.amountEur }),
      lastVerified: fact!.lastVerified,
      source: { url: fact!.source.url },
    });
    expect(hint?.upfrontPercent).toBe(40);
    expect(hint?.capMinor).toBe(250_000);
  });
});
