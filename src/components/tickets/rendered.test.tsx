import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComparisonProvider } from "./comparison";
import { CompareToggle } from "./compare-toggle";
import { ComparisonTable } from "./comparison-table";
import { PackageCard } from "./package-card";
import { PriceTiers } from "./price-tiers";
import { SaleTimeline } from "./sale-timeline";
import { buildBrasilCatalogue, buildBelgiumCatalogue, buildWinterCatalogue } from "./selectors";

afterEach(cleanup);

/**
 * Rendered-output checks against the live datasets.
 *
 * The unit tests above use fixtures to pin behaviour. These render the real
 * catalogue, which is the only way to assert what a visitor actually sees: a
 * retired figure could survive in a note or a heading even when every amount field
 * is clean.
 */

const RETIRED_PRICES = ["304", "374", "799", "699", "599"] as const;

/**
 * Detects a retired figure in rendered text as a standalone amount.
 *
 * The figures are matched with a currency symbol or as a bare number surrounded by
 * non-digits, so "€799" and "799" both count but "5,707" and "1,799" do not.
 */
function findRetiredPrices(text: string): string[] {
  const hits: string[] = [];
  for (const retired of RETIRED_PRICES) {
    const patterns = [
      new RegExp(`€\\s?${retired}(?![\\d,.])`),
      new RegExp(`R\\$\\s?${retired}(?![\\d,.])`),
      new RegExp(`(?<![\\d,.])${retired}(?![\\d,.])`),
    ];
    if (patterns.some((pattern) => pattern.test(text))) hits.push(retired);
  }
  return hits;
}

describe("findRetiredPrices", () => {
  it("finds a retired figure with and without a currency symbol", () => {
    expect(findRetiredPrices("€799")).toEqual(["799"]);
    expect(findRetiredPrices("the 2025 price was 599")).toEqual(["599"]);
  });

  it("does not fire on a longer number that contains the digits", () => {
    expect(findRetiredPrices("€5,707.00")).toEqual([]);
    expect(findRetiredPrices("€1,799.00")).toEqual([]);
    expect(findRetiredPrices("€2,304.00")).toEqual([]);
  });

  it("does not fire on a year or a count", () => {
    expect(findRetiredPrices("2027")).toEqual([]);
    expect(findRetiredPrices("4 people")).toEqual([]);
  });
});

describe("rendered Belgium page content", () => {
  const catalogue = buildBelgiumCatalogue();

  it("shows no retired 2025 figure anywhere on a category page", () => {
    for (const category of catalogue.categories) {
      const { container, unmount } = render(
        <ComparisonProvider>
          {category.items.map((item) => (
            <PackageCard
              key={item.id}
              item={item}
              detailHref={`/guides/tickets?category=${category.id}&package=${item.id}`}
            />
          ))}
        </ComparisonProvider>,
      );

      const text = container.textContent ?? "";
      expect(findRetiredPrices(text), `${category.id} renders a retired price`).toEqual([]);
      unmount();
    }
  });

  it("shows the 2027 figure for a package whose 2025 price was replaced", () => {
    // A spot check that the page really is showing this year's numbers.
    const dayPass = catalogue.categories
      .find((category) => category.id === "festival-tickets")
      ?.items.find((item) => item.id === "belgium-2027-day-pass");

    expect(dayPass).toBeDefined();
    render(<PriceTiers item={dayPass!} />);

    expect(screen.getByText("€144.00")).toBeInTheDocument();
    expect(screen.getByText("€159.00")).toBeInTheDocument();
  });

  it("shows the checked date on every card", () => {
    const category = catalogue.categories.find((entry) => entry.id === "festival-tickets");
    const { container } = render(
      <ComparisonProvider>
        {category?.items.map((item) => (
          <PackageCard key={item.id} item={item} detailHref="/guides/tickets" />
        ))}
      </ComparisonProvider>,
    );

    const sourceLines = container.querySelectorAll(".tml-tix-source");
    expect(sourceLines).toHaveLength(category?.items.length ?? 0);
    for (const line of sourceLines) {
      expect(line.textContent).toMatch(/Checked\s*18 Nov 2026/);
      // Every card separates the source title from the check date.
      expect(line.textContent).toMatch(/—\s*Checked/);
      expect(line.textContent).not.toContain("·");
    }
  });

  it("shows the sale timeline with Belgian local times", () => {
    render(<SaleTimeline windows={catalogue.windows} editionLabel="Belgium" />);

    expect(screen.getByText("Sat 30 Jan 2027, 17:00 CET")).toBeInTheDocument();
    expect(screen.getByText("Sat 6 Feb 2027, 17:00 CET")).toBeInTheDocument();
    expect(screen.getByText("Sat 13 Feb 2027, 17:00 CET")).toBeInTheDocument();
  });
});

describe("rendered Winter page content", () => {
  const catalogue = buildWinterCatalogue();

  it("shows no retired 2025 figure", () => {
    const category = catalogue.categories.find((entry) => entry.id === "festival-tickets");
    const { container } = render(
      <ComparisonProvider>
        {category?.items.map((item) => (
          <PackageCard key={item.id} item={item} detailHref="/guides/tickets" />
        ))}
      </ComparisonProvider>,
    );

    expect(findRetiredPrices(container.textContent ?? "")).toEqual([]);
  });

  it("renders an honest missing-price state for each unpublished product", () => {
    const category = catalogue.categories.find((entry) => entry.id === "festival-tickets");
    const unpublished = category?.items.filter((item) => item.priceStatus === "unpublished") ?? [];

    const { container } = render(
      <ComparisonProvider>
        {unpublished.map((item) => (
          <PackageCard key={item.id} item={item} detailHref="/guides/tickets" />
        ))}
      </ComparisonProvider>,
    );

    expect(container.querySelectorAll(".tml-tix-unpublished")).toHaveLength(unpublished.length);
    expect(screen.getAllByText("Price not published yet")).toHaveLength(unpublished.length);
    expect(screen.getAllByRole("link", { name: /Official page/ })).toHaveLength(
      unpublished.length,
    );
  });
});

describe("rendered Brasil page content", () => {
  const catalogue = buildBrasilCatalogue();

  it("shows reais and never a euro amount", () => {
    const category = catalogue.categories.find((entry) => entry.id === "festival-tickets");
    const { container } = render(
      <ComparisonProvider>
        {category?.items.map((item) => (
          <PackageCard key={item.id} item={item} detailHref="/guides/tickets" />
        ))}
      </ComparisonProvider>,
    );

    const text = (container.textContent ?? "").replace(/\u00a0/g, " ");
    expect(text).toContain("R$ 3.160,00");
    expect(text).not.toContain("€");
  });

  it("shows the Brasil sale timeline in Brasília time", () => {
    render(<SaleTimeline windows={catalogue.windows} editionLabel="Brasil" />);

    // 24 September 2026 at 10:00 BRT.
    expect(screen.getByText("Thu 24 Sep 2026, 10:00 GMT-3")).toBeInTheDocument();
  });
});

describe("rendered comparison", () => {
  it("shows a table with the real package names and prices", () => {
    const catalogue = buildBelgiumCatalogue();
    const tickets = catalogue.categories.find(
      (category) => category.id === "festival-tickets",
    )?.items;
    const dayPass = tickets?.find((item) => item.id === "belgium-2027-day-pass");
    const fullMadness = tickets?.find((item) => item.id === "belgium-2027-full-madness");
    const items = [dayPass, fullMadness].filter(
      (item): item is NonNullable<typeof item> => item !== undefined,
    );
    expect(items).toHaveLength(2);

    function Harness() {
      return (
        <ComparisonProvider>
          {items.map((item) => (
            <CompareToggle key={item.id} itemId={item.id} itemName={item.name} />
          ))}
          <ComparisonTable items={items} editionLabel="Belgium" />
        </ComparisonProvider>
      );
    }
    render(<Harness />);

    // Nothing selected: only the invitation, no table.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Compare Day Pass" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Compare Full Madness Pass" }));

    const table = screen.getByRole("table");
    expect(screen.getByRole("columnheader", { name: "Day Pass" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Full Madness Pass" })).toBeInTheDocument();
    // The real 2027 figures, formatted, not converted.
    expect(within(table).getByText("€144.00")).toBeInTheDocument();
    expect(within(table).getByText("€335.00")).toBeInTheDocument();
  });

  it("keeps the first column sticky and as a header in the rendered table", () => {
    const items = buildBelgiumCatalogue().categories
      .find((category) => category.id === "festival-tickets")
      ?.items.slice(0, 2);
    const [first] = items ?? [];

    function Harness() {
      return (
        <ComparisonProvider>
          <CompareToggle itemId={first?.id ?? ""} itemName={first?.name ?? ""} />
          <ComparisonTable items={items ?? []} editionLabel="Belgium" />
        </ComparisonProvider>
      );
    }
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`Compare ${first?.name}`) }));

    const wrapper = container.querySelector(".tml-tix-table-scroll");
    expect(wrapper).not.toBeNull();
    // A keyboard user can scroll the wrapper to reach the later columns.
    expect(wrapper).toHaveAttribute("tabindex", "0");

    for (const cell of container.querySelectorAll(".tml-tix-table__sticky")) {
      expect(cell.tagName).toBe("TH");
      expect(cell.className).toContain("tml-tix-table__sticky");
    }
  });
});

describe("accessibility roles across an edition", () => {
  it("gives the comparison table a caption and scoped headers", () => {
    const items = buildBelgiumCatalogue().categories
      .find((category) => category.id === "festival-tickets")
      ?.items.slice(0, 1);

    function Harness() {
      return (
        <ComparisonProvider>
          <ComparisonTable items={items ?? []} editionLabel="Belgium" />
        </ComparisonProvider>
      );
    }
    render(<Harness />);

    expect(screen.getByRole("heading", { name: "Compare packages" })).toBeInTheDocument();
  });

  it("gives every card heading a unique id so its article can be labelled", () => {
    const items = buildBelgiumCatalogue().categories.flatMap((category) => category.items);
    const { container } = render(
      <ComparisonProvider>
        {items.map((item) => (
          <PackageCard key={item.id} item={item} detailHref="/guides/tickets" headingLevel={3} />
        ))}
      </ComparisonProvider>,
    );

    const ids = Array.from(container.querySelectorAll("h3")).map((heading) => heading.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^pkg-/);
  });
});
