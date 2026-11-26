import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { CategoryChart, CategoryTable } from "./category-chart";
import type { CategoryShare } from "./budget-state";

const categories: readonly CategoryShare[] = [
  { category: "Tickets", totalMinor: 33_500, percent: 62, lineCount: 1 },
  { category: "Accommodation", totalMinor: 42_200, percent: 30, lineCount: 1 },
  { category: "Travel", totalMinor: 5000, percent: 8, lineCount: 1 },
];

afterEach(cleanup);

describe("CategoryChart", () => {
  it("draws one labelled row per category", () => {
    const { container } = render(<CategoryChart categories={categories} currency="EUR" />);

    const rows = [...container.querySelectorAll(".tool-chart__row")];
    expect(rows).toHaveLength(categories.length);
    for (const entry of categories) {
      expect(container.textContent).toContain(entry.category);
    }
  });

  it("shows each category's own total as text inside the drawing", () => {
    const { container } = render(<CategoryChart categories={categories} currency="EUR" />);

    const text = container.textContent ?? "";
    expect(text).toContain("€422.00");
    expect(text).toContain("€50.00");
  });

  it("is hidden from assistive technology, because the table carries the same figures", () => {
    const { container } = render(<CategoryChart categories={categories} currency="EUR" />);

    // The whole figure is decorative; the table beside it is the accessible form.
    expect(container.querySelector("figure")).toHaveAttribute("aria-hidden", "true");
    // Nothing in the chart is announced, so there is no duplicate image role.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("sizes each bar in proportion to its own value", () => {
    // Categories arrive sorted largest first, but the bar is driven by the
    // category's value, not by its position.
    const { container } = render(<CategoryChart categories={categories} currency="EUR" />);

    const widthOf = (name: string): number => {
      const row = [...container.querySelectorAll(".tool-chart__row")].find((element) =>
        element.querySelector(".tool-chart__row-label")?.textContent === name,
      );
      const bar = row?.querySelector<HTMLElement>(".tool-chart__bar");
      return Number.parseFloat(bar?.style.width ?? "0");
    };

    // Accommodation (€422) is the largest and therefore the widest.
    expect(widthOf("Accommodation")).toBeGreaterThan(widthOf("Tickets"));
    expect(widthOf("Tickets")).toBeGreaterThan(widthOf("Travel"));
    // The largest bar fills the track.
    expect(widthOf("Accommodation")).toBeCloseTo(100, 1);
  });

  it("draws a visible sliver for a tiny but non-zero category", () => {
    const { container } = render(
      <CategoryChart
        categories={[
          { category: "Tickets", totalMinor: 1_000_000, percent: 100, lineCount: 1 },
          { category: "Extras", totalMinor: 1, percent: 0, lineCount: 1 },
        ]}
        currency="EUR"
      />,
    );

    const widths = [...container.querySelectorAll<HTMLElement>(".tool-chart__bar")].map((bar) =>
      Number.parseFloat(bar.style.width),
    );
    expect(widths[1]).toBeGreaterThan(0);
  });

  it("draws nothing at all for a zero-valued category", () => {
    const { container } = render(
      <CategoryChart
        categories={[
          { category: "Tickets", totalMinor: 1000, percent: 100, lineCount: 1 },
          { category: "Extras", totalMinor: 0, percent: 0, lineCount: 1 },
        ]}
        currency="EUR"
      />,
    );

    const widths = [...container.querySelectorAll<HTMLElement>(".tool-chart__bar")].map((bar) =>
      Number.parseFloat(bar.style.width),
    );
    // A visible bar for nothing would be a lie about the figures.
    expect(widths[1]).toBe(0);
  });

  it("draws nothing for an empty breakdown", () => {
    const { container } = render(<CategoryChart categories={[]} currency="EUR" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("formats a Brasil chart in reais", () => {
    render(
      <CategoryChart
        categories={[{ category: "Tickets", totalMinor: 316_000, percent: 100, lineCount: 1 }]}
        currency="BRL"
      />,
    );
    expect(screen.getByText("R$3,160.00")).toBeInTheDocument();
  });
});

describe("CategoryTable", () => {
  it("renders a named table with one row per category and a total", () => {
    render(
      <CategoryTable
        categories={categories}
        currency="EUR"
        id="breakdown-table"
        caption="Category breakdown"
        people={2}
      />,
    );

    const table = screen.getByRole("table", { name: "Category breakdown" });
    expect(within(table).getByRole("rowheader", { name: "Tickets" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Travel" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Total" })).toBeInTheDocument();
  });

  it("shows each category's total, its per-person share and its percentage", () => {
    render(
      <CategoryTable
        categories={categories}
        currency="EUR"
        id="breakdown-table"
        caption="Category breakdown"
        people={2}
      />,
    );

    const table = screen.getByRole("table");
    // Tickets: 335 total, 168 per person (rounded), 62%.
    expect(within(table).getByText("€335.00")).toBeInTheDocument();
    expect(within(table).getByText("€167.50")).toBeInTheDocument();
    expect(within(table).getByText("62%")).toBeInTheDocument();
  });

  it("totals every category", () => {
    render(
      <CategoryTable
        categories={categories}
        currency="EUR"
        id="breakdown-table"
        caption="Category breakdown"
        people={1}
      />,
    );

    const totalRow = screen.getByRole("rowheader", { name: "Total" }).closest("tr");
    // 335 + 422 + 50 = 807
    expect(totalRow?.textContent).toContain("€807.00");
    expect(totalRow?.textContent).toContain("100%");
  });

  it("labels its columns so the figures are never ambiguous", () => {
    render(
      <CategoryTable
        categories={categories}
        currency="EUR"
        id="breakdown-table"
        caption="Category breakdown"
        people={2}
      />,
    );

    for (const name of ["Category", "Total", "Per person", "Share"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
  });

  it("makes the sideways-scrolling wrapper reachable from the keyboard", () => {
    /*
      On a 320px screen four columns of money do not fit, so the wrapper scrolls.
      A scroll container whose content holds no focusable control cannot be
      scrolled by keyboard at all, which leaves the right-hand column unreadable
      to anyone without a pointer. The wrapper therefore takes a tab stop and a
      name, and the name is a real sentence rather than "scrollable region".
    */
    render(
      <CategoryTable
        categories={categories}
        currency="EUR"
        id="breakdown-table"
        caption="Category breakdown"
        people={2}
      />,
    );

    const region = screen.getByRole("group", { name: /Category breakdown.*scrolls sideways/i });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("tool-table-wrap");
    // The table inside is still named by its own caption, not by this wrapper.
    expect(screen.getByRole("table", { name: "Category breakdown" })).toBeInTheDocument();
  });

  it("renders nothing for an empty breakdown", () => {
    const { container } = render(
      <CategoryTable categories={[]} currency="EUR" id="t" caption="Empty" people={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
