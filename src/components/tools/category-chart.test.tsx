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
    render(<CategoryChart categories={categories} currency="EUR" />);

    for (const entry of categories) {
      expect(document.querySelector("svg")?.textContent).toContain(entry.category);
    }
  });

  it("shows each category's own total as text inside the drawing", () => {
    render(<CategoryChart categories={categories} currency="EUR" />);

    const text = document.querySelector("svg")?.textContent ?? "";
    expect(text).toContain("€422.00");
    expect(text).toContain("€50.00");
  });

  it("is hidden from assistive technology, because the table carries the same figures", () => {
    render(<CategoryChart categories={categories} currency="EUR" />);

    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    // Nothing in the chart is announced, so there is no duplicate image role.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("sizes each bar in proportion to its own value", () => {
    // Categories arrive sorted largest first, but the bar is driven by the
    // category's value, not by its position.
    render(<CategoryChart categories={categories} currency="EUR" />);

    const bars = [...document.querySelectorAll(".tool-chart__bar")].map((bar) => ({
      category: bar.parentElement?.querySelector("text")?.textContent ?? "",
      width: Number(bar.getAttribute("width")),
    }));

    const widthOf = (name: string) => bars.find((bar) => bar.category === name)?.width ?? 0;

    // Accommodation (€422) is the largest and therefore the widest.
    expect(widthOf("Accommodation")).toBeGreaterThan(widthOf("Tickets"));
    expect(widthOf("Tickets")).toBeGreaterThan(widthOf("Travel"));
  });

  it("draws a visible sliver for a tiny but non-zero category", () => {
    render(
      <CategoryChart
        categories={[
          { category: "Tickets", totalMinor: 1_000_000, percent: 100, lineCount: 1 },
          { category: "Extras", totalMinor: 1, percent: 0, lineCount: 1 },
        ]}
        currency="EUR"
      />,
    );

    const widths = [...document.querySelectorAll(".tool-chart__bar")].map((bar) =>
      Number(bar.getAttribute("width")),
    );
    expect(widths[1]).toBeGreaterThan(0);
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

  it("renders nothing for an empty breakdown", () => {
    const { container } = render(
      <CategoryTable categories={[]} currency="EUR" id="t" caption="Empty" people={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
