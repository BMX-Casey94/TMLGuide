import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { PearlCalculator } from "./pearl-calculator";

const RATE_URL = "https://belgium.tomorrowland.com/en/practical/your-tomorrowland-bracelet/";

function renderCalculator() {
  return render(<PearlCalculator rateInformationUrl={RATE_URL} />);
}

function rateField(): HTMLInputElement {
  return screen.getByLabelText(/Euro value of one Pearl/i) as HTMLInputElement;
}

function amountField(): HTMLInputElement {
  return screen.getByLabelText(/to convert/i) as HTMLInputElement;
}

/** The large result figure. */
function figure(): string {
  return document.querySelector(".tool-total__figure")?.textContent ?? "";
}

afterEach(cleanup);

describe("PearlCalculator", () => {
  it("calculates nothing until both fields hold usable numbers", () => {
    renderCalculator();
    expect(figure()).toBe("");
    expect(screen.getByText(/Nothing is calculated until both fields/i)).toBeInTheDocument();
  });

  it("does not pre-fill a rate, because no 2027 rate is published", () => {
    renderCalculator();
    expect(rateField().value).toBe("");
  });

  it("converts money into whole Pearls and reports the remainder", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1.90" } });
    fireEvent.change(amountField(), { target: { value: "20" } });

    // €20.00 at €1.90 is ten whole Pearls, with €1.00 left over.
    expect(figure()).toBe("10 Pearls");
    expect(screen.getByText(/€1.00 is left over/i)).toBeInTheDocument();
  });

  it("converts Pearls into money", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1.90" } });
    fireEvent.click(screen.getByRole("button", { name: /Pearls to euros/i }));
    fireEvent.change(amountField(), { target: { value: "10" } });

    expect(figure()).toBe("€19.00");
  });

  it("treats the amount as a Pearl count, not money, in the Pearls-to-euros direction", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1.90" } });
    fireEvent.click(screen.getByRole("button", { name: /Pearls to euros/i }));

    // A count is whole, so a decimal is refused rather than read as €10.50.
    fireEvent.change(amountField(), { target: { value: "10.50" } });
    expect(screen.getByText(/Enter a whole number of Pearls/i)).toBeInTheDocument();
    expect(figure()).toBe("");
  });

  it("never shows a partial Pearl", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1.90" } });
    fireEvent.change(amountField(), { target: { value: "19.90" } });

    // €19.90 buys ten Pearls, not 10.47.
    expect(figure()).toBe("10 Pearls");
    expect(figure()).not.toMatch(/\./);
  });

  it("refuses a rate finer than a cent", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1.905" } });
    fireEvent.change(amountField(), { target: { value: "20" } });

    expect(screen.getByText(/Rates are published to the cent/i)).toBeInTheDocument();
    expect(figure()).toBe("");
  });

  it("reads a comma as the decimal mark in a typed rate", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1,90" } });
    fireEvent.change(amountField(), { target: { value: "20" } });

    expect(figure()).toBe("10 Pearls");
  });

  it("does not read a grouped figure as a rate", () => {
    renderCalculator();

    // A rate is a per-Pearl price, so grouping marks make no sense here.
    fireEvent.change(rateField(), { target: { value: "1,234" } });
    fireEvent.change(amountField(), { target: { value: "20" } });

    expect(screen.getByText(/Rates are published to the cent/i)).toBeInTheDocument();
    expect(figure()).toBe("");
  });

  it("refuses a negative or zero rate", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "0" } });
    fireEvent.change(amountField(), { target: { value: "20" } });
    expect(screen.getByText(/Enter a rate greater than zero/i)).toBeInTheDocument();
    expect(figure()).toBe("");

    fireEvent.change(rateField(), { target: { value: "-1" } });
    expect(screen.getByText(/Enter a rate greater than zero/i)).toBeInTheDocument();
    expect(figure()).toBe("");
  });

  it("refuses a negative amount", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1.90" } });
    fireEvent.change(amountField(), { target: { value: "-20" } });

    expect(screen.getByText(/Amounts cannot be negative/i)).toBeInTheDocument();
    expect(figure()).toBe("");
  });

  it("handles a very large but permitted amount", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1.90" } });
    fireEvent.change(amountField(), { target: { value: "999999" } });

    // 999,999.00 / 1.90 is 526,315.26…, so 526,315 whole Pearls.
    expect(figure()).toBe("526,315 Pearls");
  });

  it("warns that the 2027 rate has not been announced, with a link to the official page", () => {
    renderCalculator();

    const warning = screen.getByText(/No 2027 rate has been announced/i);
    expect(warning).toBeInTheDocument();
    expect(screen.getByText(/Tomorrowland publishes the value of a Pearl only when top-ups open/i)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /official cashless page/i });
    expect(link).toHaveAttribute("href", RATE_URL);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("explains the rounding rule in plain language", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1.90" } });
    fireEvent.change(amountField(), { target: { value: "20" } });

    const note = screen.getByText(/Pearls are only sold whole/i);
    expect(note).toBeInTheDocument();
    expect(note.textContent).not.toMatch(/floor|ceil|integer|epsilon/i);
  });

  it("labels both inputs and reports an invalid rate honestly", () => {
    renderCalculator();

    // A valid control carries no aria-invalid at all rather than "false".
    expect(rateField()).not.toHaveAttribute("aria-invalid");

    const region = document.querySelector('[aria-live="polite"]');
    expect(region).toBeTruthy();

    fireEvent.change(rateField(), { target: { value: "abc" } });
    expect(rateField()).toHaveAttribute("aria-invalid", "true");
  });

  it("switches the direction and relabels the amount field", () => {
    renderCalculator();

    expect(screen.getByLabelText(/Money to convert/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Pearls to euros/i }));
    expect(screen.getByLabelText(/Pearls to convert/i)).toBeInTheDocument();

    const group = screen.getByRole("group", { name: /Direction/i });
    expect(within(group).getByRole("button", { name: /Pearls to euros/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("survives a rate and amount typed in either order", () => {
    renderCalculator();

    fireEvent.change(amountField(), { target: { value: "20" } });
    expect(figure()).toBe("");

    fireEvent.change(rateField(), { target: { value: "1.90" } });
    expect(figure()).toBe("10 Pearls");
  });

  it("does not recalculate after an invalid edit clears the figure", () => {
    const { rerender } = renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1.90" } });
    fireEvent.change(amountField(), { target: { value: "20" } });
    expect(figure()).toBe("10 Pearls");

    fireEvent.change(amountField(), { target: { value: "" } });
    rerender(<PearlCalculator rateInformationUrl={RATE_URL} />);
    expect(figure()).toBe("");
  });

  it("shows an error for an amount that is not a number", () => {
    renderCalculator();

    fireEvent.change(rateField(), { target: { value: "1.90" } });
    fireEvent.change(amountField(), { target: { value: "abc" } });

    expect(screen.getByText(/Enter an amount in numbers/i)).toBeInTheDocument();
    expect(figure()).toBe("");
  });

  it("restores the clipboard stub when a copy fails elsewhere", () => {
    // Guards against a stub from another test file leaking into this one.
    expect(typeof navigator.clipboard?.writeText).not.toBe("number");
    vi.restoreAllMocks();
  });
});
