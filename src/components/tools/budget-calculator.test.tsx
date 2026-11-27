import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { EditionProvider } from "@/components/shell";
import { BudgetCalculator } from "./budget-calculator";
import { BUDGET_STORAGE_KEY, type PaymentTermsFact } from "./budget-state";

/** The verified Winter payment-terms fact, as the budget page supplies it. */
const winterFact: PaymentTermsFact = {
  id: "package-payment-terms",
  value: "Prepayment of at least 40% at purchase, capped at €2,500; balance within 30 days",
  detail: "The cap applies however large the order.",
  amountEur: 2500,
  lastVerified: "2026-11-18",
  source: { url: "https://winter.tomorrowland.com/en/sales-info/payment-methods-and-conditions/" },
};

function renderCalculator(paymentTerms?: PaymentTermsFact) {
  return render(
    <EditionProvider>
      <BudgetCalculator paymentTerms={paymentTerms} />
    </EditionProvider>,
  );
}

/** The ticket menu. The current choice is the trigger's `data-value`. */
function ticketSelect(): HTMLElement {
  return screen.getByLabelText(/^Ticket$/i);
}

function ticketValue(): string {
  return ticketSelect().getAttribute("data-value") ?? "";
}

function chooseTicket(value: string): void {
  fireEvent.click(ticketSelect());
  const option = screen
    .getAllByRole("option")
    .find((item) => item.getAttribute("data-value") === value);
  if (option === undefined) throw new Error(`No ticket option with value ${value}`);
  fireEvent.click(option);
}

function field(label: RegExp): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

/** The large total figure. */
function total(): string {
  return document.querySelector(".tool-total__figure")?.textContent ?? "";
}

/** A fresh in-memory Storage, so tests never share state or a stub. */
function installStorage(): Storage {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  return storage;
}

beforeEach(() => {
  installStorage();
  window.history.replaceState(null, "", "/tools/budget");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BudgetCalculator", () => {
  it("starts on a published ticket price for Belgium in euros", async () => {
    renderCalculator();

    await waitFor(() => expect(ticketValue()).toBe("belgium-2027-day-pass-presale"));
    // The first Belgium product is the €144 day pass, priced for one person.
    await waitFor(() => expect(total()).toBe("€144.00"));
  });

  it("multiplies the ticket by the number of people", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.change(field(/Number of people/i), { target: { value: "3" } });
    await waitFor(() => expect(total()).toBe("€432.00"));
  });

  it("adds per-person amounts and totals them with the ticket", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.change(field(/^Travel$/i), { target: { value: "50" } });
    fireEvent.change(field(/^Food and drink$/i), { target: { value: "20.50" } });

    // 144 + 50 + 20.50
    await waitFor(() => expect(total()).toBe("€214.50"));
  });

  it("accepts a custom ticket price", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    chooseTicket("custom");
    const customField = await screen.findByLabelText(/Your ticket price, per person/i);
    fireEvent.change(customField, { target: { value: "250" } });

    await waitFor(() => expect(total()).toBe("€250.00"));
  });

  it("shows an error for a negative amount and does not use it", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    const travel = field(/^Travel$/i);
    fireEvent.change(travel, { target: { value: "-50" } });

    await waitFor(() => expect(travel).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText(/Amounts cannot be negative/i)).toBeInTheDocument();
    // The ticket alone remains.
    expect(total()).toBe("€144.00");
  });

  it("refuses a group size outside the allowed range and restores a valid figure on blur", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    const people = field(/Number of people/i);
    fireEvent.change(people, { target: { value: "0" } });

    await waitFor(() => expect(people).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText(/Enter a whole number from 1 to 40/i)).toBeInTheDocument();
    expect(total()).toBe("€144.00");

    fireEvent.blur(people);
    await waitFor(() => expect(people.value).toBe("1"));
  });

  it("switches currency with the edition and never converts", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.click(screen.getByRole("button", { name: "Brasil" }));

    await waitFor(() => expect(ticketValue()).toBe("full-madness"));
    // The Brasil Full Madness pass is R$3,160, shown in reais.
    await waitFor(() => expect(total()).toBe("R$3,160.00"));
    expect(screen.queryByText(/^€/)).not.toBeInTheDocument();
  });

  it("resets every field", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.change(field(/^Travel$/i), { target: { value: "50" } });
    fireEvent.change(field(/Number of people/i), { target: { value: "2" } });
    await waitFor(() => expect(total()).toBe("€388.00"));

    fireEvent.click(screen.getByRole("button", { name: /^Reset$/i }));

    await waitFor(() => expect(field(/^Travel$/i).value).toBe(""));
    expect(field(/Number of people/i).value).toBe("1");
    expect(total()).toBe("€144.00");
  });

  it("persists the plan and restores it on a fresh mount", async () => {
    const storage = installStorage();
    const { unmount } = renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.change(field(/^Travel$/i), { target: { value: "75" } });
    fireEvent.change(field(/Number of people/i), { target: { value: "2" } });

    await waitFor(() => {
      const stored = storage.getItem(BUDGET_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored ?? "{}").travelMinor).toBe(7500);
    });

    unmount();
    renderCalculator();

    await waitFor(() => expect(field(/^Travel$/i).value).toBe("75"));
    expect(field(/Number of people/i).value).toBe("2");
  });

  it("starts fresh and says so when the stored plan is corrupt", async () => {
    const storage = installStorage();
    storage.setItem(BUDGET_STORAGE_KEY, "{not json");
    renderCalculator();

    await waitFor(() => expect(screen.getByText(/Starting fresh/i)).toBeInTheDocument());
    expect(total()).toBe("€144.00");
  });

  it("reads a plan from the URL query string", async () => {
    const plan = {
      edition: "belgium",
      ticketId: "belgium-2027-full-madness-presale",
      ticketCustomMinor: null,
      accommodationMinor: 42200,
      accommodationPerGroup: false,
      travelMinor: null,
      foodDrinkMinor: null,
      extrasMinor: null,
      people: 2,
    };
    window.history.replaceState(
      null,
      "",
      `/tools/budget?plan=${encodeURIComponent(JSON.stringify(plan))}`,
    );

    renderCalculator();

    // (335 + 422) × 2
    await waitFor(() => expect(total()).toBe("€1,514.00"));
  });

  it("builds a shareable link containing the plan", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.change(field(/^Travel$/i), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /Share this plan/i }));

    const share = (await screen.findByLabelText(/Shareable link/i)) as HTMLInputElement;
    const url = new URL(share.value);
    expect(url.pathname).toBe("/tools/budget");
    const decoded = JSON.parse(url.searchParams.get("plan") ?? "{}");
    expect(decoded.travelMinor).toBe(3000);
  });

  it("renders the category chart and its text table with matching figures", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.change(field(/^Travel$/i), { target: { value: "100" } });

    // The chart is decorative; the table is the accessible form of the figures.
    await waitFor(() => expect(document.querySelector(".tool-chart__bar")).not.toBeNull());

    const table = screen.getByRole("table", { name: /Category breakdown/i });
    expect(within(table).getByText("Travel")).toBeInTheDocument();
    expect(within(table).getByText("Tickets")).toBeInTheDocument();
    // 144 + 100 = 244
    expect(within(table).getAllByText("€244.00").length).toBeGreaterThan(0);
  });

  it("makes each sideways-scrolling table reachable from the keyboard", async () => {
    /*
      At 320px the four-column tables are wider than the panel, so they scroll
      inside their own box. Neither table contains a focusable control, so
      without a tab stop on the wrapper the right-hand figures could not be
      reached by keyboard at all.
    */
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    const regions = document.querySelectorAll(".tool-table-wrap");
    expect(regions.length).toBeGreaterThan(0);
    for (const region of Array.from(regions)) {
      expect(region).toHaveAttribute("tabindex", "0");
      expect(region.getAttribute("aria-label")).toMatch(/scrolls sideways/i);
    }
  });

  it("announces the new total in a polite live region after an edit", async () => {
    /*
      The total changes silently for a screen-reader user otherwise: the figure is
      a plain paragraph with no live region. The announcement is debounced, so a
      reader typing "120" hears one sentence rather than three.
    */
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    const announcer = document.querySelector(".tool-announcer");
    expect(announcer).not.toBeNull();
    expect(announcer).toHaveAttribute("role", "status");
    expect(announcer).toHaveAttribute("aria-live", "polite");
    // The first render says nothing: nothing has changed, and the figure is
    // already in the document.
    expect(announcer?.textContent).toBe("");

    fireEvent.change(field(/Number of people/i), { target: { value: "3" } });

    await waitFor(
      () => expect(announcer?.textContent).toMatch(/Total for 3 people: €432\.00, €144\.00 each\./),
      { timeout: 3000 },
    );
  });

  it("shows the part-payment hint for Winter only", async () => {
    renderCalculator(winterFact);
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    // Belgium holds the fact but must not show it.
    expect(screen.queryByText(/Pay in two parts/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Winter" }));

    await waitFor(() => expect(screen.getByText(/Pay in two parts/i)).toBeInTheDocument());
    // The Winter ticket is €735, so 40% is €294.
    await waitFor(() => expect(screen.getByText("€294.00")).toBeInTheDocument());
  });

  it("does not show a part-payment hint when the page supplies no fact", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.click(screen.getByRole("button", { name: "Winter" }));

    await waitFor(() => expect(ticketValue()).toBe("seven-day-festival-ticket-2027"));
    expect(screen.queryByText(/Pay in two parts/i)).not.toBeInTheDocument();
  });

  it("labels every control for assistive technology", async () => {
    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    for (const label of [
      /^Ticket$/i,
      /^Accommodation$/i,
      /^Travel$/i,
      /^Food and drink$/i,
      /^Extras$/i,
      /Number of people/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    const group = screen.getByRole("group", { name: /Edition/i });
    expect(within(group).getByRole("button", { name: "Belgium" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("offers a print control that calls the browser's print dialog", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);

    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.click(screen.getByRole("button", { name: /^Print$/i }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("copies a summary and confirms it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.click(screen.getByRole("button", { name: /Copy summary/i }));

    await waitFor(() => expect(screen.getByText(/Summary copied/i)).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain("TMLGuide budget estimate");
    expect(text).toContain("€144.00");
    expect(text).toContain("not an official calculator");
  });

  it("reports a failed copy instead of pretending it worked", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });

    renderCalculator();
    await waitFor(() => expect(ticketValue()).not.toBe(""));

    fireEvent.click(screen.getByRole("button", { name: /Copy summary/i }));

    await waitFor(() => expect(screen.getByText(/Could not copy/i)).toBeInTheDocument());
  });
});
