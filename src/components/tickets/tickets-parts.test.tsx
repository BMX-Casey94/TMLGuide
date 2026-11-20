import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComparisonProvider } from "./comparison";
import { CompareToggle } from "./compare-toggle";
import { ComparisonTable } from "./comparison-table";
import { PriceTiers, UNPUBLISHED_LABEL } from "./price-tiers";
import { SaleTimeline } from "./sale-timeline";
import { SourceLine } from "./source-line";
import type { CatalogueItem, CatalogueSaleWindow, PriceTier } from "./types";

afterEach(cleanup);

const SOURCE = {
  url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
  title: "Tomorrowland Belgium — day passes",
  retrievedOn: "2026-11-18",
} as const;

function tier(overrides: Partial<PriceTier> & Pick<PriceTier, "key" | "amount">): PriceTier {
  return {
    label: overrides.key === "presale" ? "Pre-sale" : "WorldWide sale",
    year: 2027,
    currency: "EUR",
    source: SOURCE,
    lastVerified: "2026-11-18",
    ...overrides,
  };
}

function item(overrides: Partial<CatalogueItem> & Pick<CatalogueItem, "id" | "name">): CatalogueItem {
  return {
    categoryId: "festival-tickets",
    includes: [],
    tiers: [],
    priceStatus: "published",
    badges: [],
    source: SOURCE,
    lastVerified: "2026-11-18",
    ...overrides,
  };
}

const DAY_PASS = item({
  id: "day-pass",
  name: "Day Pass",
  tiers: [tier({ key: "presale", amount: 144 }), tier({ key: "worldwide", amount: 159 })],
  includes: ["Festival access for one day"],
});

const FULL_MADNESS = item({
  id: "full-madness",
  name: "Full Madness Pass",
  tiers: [tier({ key: "presale", amount: 335 }), tier({ key: "worldwide", amount: 410 })],
  includes: ["Festival access for all three days of one weekend"],
});

const UNPRICED = item({
  id: "four-day",
  name: "4-Day Festival Ticket",
  priceStatus: "unpublished",
  tiers: [],
  badges: ["Price not published"],
  missingReason: "The official ticket page lists it for 2027 without a price.",
  officialUrl: "https://winter.tomorrowland.com/en/tickets/festival-ticket/",
});

/* ---------------------------------------------------------------------------------------------
 * PriceTiers
 * ------------------------------------------------------------------------------------------- */

describe("PriceTiers", () => {
  it("renders one row per tier, labelled with its year", () => {
    render(<PriceTiers item={DAY_PASS} />);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Pre-sale");
    expect(rows[0]).toHaveTextContent("2027");
    expect(rows[1]).toHaveTextContent("WorldWide sale");
  });

  it("formats each amount as euros", () => {
    render(<PriceTiers item={DAY_PASS} />);

    expect(screen.getByText("€144.00")).toBeInTheDocument();
    expect(screen.getByText("€159.00")).toBeInTheDocument();
  });

  it("names the year for a screen reader as well as showing it", () => {
    render(<PriceTiers item={DAY_PASS} />);

    expect(screen.getAllByText(", 2027 price")).toHaveLength(2);
  });

  it("shows an explicit unpublished state rather than a blank", () => {
    render(<PriceTiers item={UNPRICED} />);

    expect(screen.getByText(UNPUBLISHED_LABEL)).toBeInTheDocument();
    expect(screen.getByText(/lists it for 2027 without a price/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("links the official page for an unpublished product", () => {
    render(<PriceTiers item={UNPRICED} />);

    const link = screen.getByRole("link", { name: /Official page/ });
    expect(link).toHaveAttribute("href", "https://winter.tomorrowland.com/en/tickets/festival-ticket/");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("treats a published item with no tiers as unpublished, not as free", () => {
    const inconsistent = item({ id: "odd", name: "Odd", tiers: [] });
    render(<PriceTiers item={inconsistent} />);

    expect(screen.getByText(UNPUBLISHED_LABEL)).toBeInTheDocument();
    expect(screen.queryByText(/€0/)).not.toBeInTheDocument();
  });

  it("shows a per-stay unit beside the figure", () => {
    const stay = item({
      id: "easy-tent",
      name: "Easy Tent 2P",
      tiers: [tier({ key: "presale", amount: 1240, unit: "for the whole stay" })],
    });
    render(<PriceTiers item={stay} />);

    expect(screen.getByText("for the whole stay")).toBeInTheDocument();
  });

  it("formats a Brasil tier in reais, not euros", () => {
    const brasil = item({
      id: "full-madness",
      name: "Full Madness Pass",
      tiers: [
        tier({ key: "standard", label: "Standard", amount: 3160, currency: "BRL" }),
      ],
    });
    render(<PriceTiers item={brasil} />);

    expect(screen.getByText(/R\$\s*3\.160,00/)).toBeInTheDocument();
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------------------------
 * SourceLine
 * ------------------------------------------------------------------------------------------- */

describe("SourceLine", () => {
  it("shows the source title, a link and the checked date", () => {
    render(<SourceLine source={SOURCE} lastVerified="2026-11-18" />);

    expect(screen.getByRole("link", { name: /day passes/ })).toHaveAttribute("href", SOURCE.url);
    expect(screen.getByText(/Checked/)).toHaveTextContent("Checked 18 Nov 2026");
    expect(screen.getByText("18 Nov 2026")).toHaveAttribute("datetime", "2026-11-18");
  });

  it("warns a screen reader that the link opens a new tab", () => {
    render(<SourceLine source={SOURCE} lastVerified="2026-11-18" />);

    expect(screen.getByText("(opens in a new tab)")).toBeInTheDocument();
  });

  it("separates the source title from the check date", () => {
    const { container } = render(<SourceLine source={SOURCE} lastVerified="2026-11-18" />);

    const line = container.querySelector(".tml-tix-source");
    expect(line?.textContent).toMatch(/—\s*Checked 18 Nov 2026/);
    // The old middot is gone: one separator, not two conventions.
    expect(line?.textContent).not.toContain("·");
    // The dash is decorative, so a screen reader hears the date on its own.
    const separator = line?.querySelector(".tml-check-sep");
    expect(separator?.querySelector('[aria-hidden="true"]')).toHaveTextContent("—");
  });

  it("omits the date rather than printing an invalid one", () => {
    render(<SourceLine source={SOURCE} lastVerified="not-a-date" />);

    expect(screen.queryByText(/Checked/)).not.toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------------------------
 * CompareToggle and ComparisonTable
 * ------------------------------------------------------------------------------------------- */

function renderComparison(items: readonly CatalogueItem[], editionLabel = "Belgium") {
  return render(
    <ComparisonProvider>
      <ComparisonTable items={items} editionLabel={editionLabel} />
    </ComparisonProvider>,
  );
}

describe("CompareToggle", () => {
  function renderToggle(itemId: string, itemName: string) {
    return render(
      <ComparisonProvider>
        <CompareToggle itemId={itemId} itemName={itemName} />
      </ComparisonProvider>,
    );
  }

  it("is a labelled checkbox naming the package", () => {
    renderToggle("day-pass", "Day Pass");

    const checkbox = screen.getByRole("checkbox", { name: /Day Pass/ });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeEnabled();
  });

  it("ticks and unticks on click", () => {
    renderToggle("day-pass", "Day Pass");
    const checkbox = screen.getByRole("checkbox", { name: /Day Pass/ });

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});

describe("ComparisonTable", () => {
  it("invites a comparison when nothing is selected", () => {
    renderComparison([DAY_PASS, FULL_MADNESS]);

    expect(screen.getByRole("heading", { name: "Compare packages" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a real table once a package is selected", () => {
    function Harness() {
      return (
        <ComparisonProvider>
          <CompareToggle itemId="day-pass" itemName="Day Pass" />
          <ComparisonTable items={[DAY_PASS, FULL_MADNESS]} editionLabel="Belgium" />
        </ComparisonProvider>
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Day Pass/ }));

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    // A caption names the table for a screen reader.
    expect(within(table).getByText(/Belgium tickets and packages compared/)).toBeInTheDocument();
  });

  it("labels each price row with its sale moment and year", () => {
    function Harness() {
      return (
        <ComparisonProvider>
          <CompareToggle itemId="day-pass" itemName="Day Pass" />
          <ComparisonTable items={[DAY_PASS]} editionLabel="Belgium" />
        </ComparisonProvider>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Day Pass/ }));

    expect(screen.getByRole("rowheader", { name: /Pre-sale/ })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /WorldWide sale/ })).toBeInTheDocument();
  });

  it("keeps the first column as a header cell so the row label stays announced", () => {
    function Harness() {
      return (
        <ComparisonProvider>
          <CompareToggle itemId="day-pass" itemName="Day Pass" />
          <ComparisonTable items={[DAY_PASS]} editionLabel="Belgium" />
        </ComparisonProvider>
      );
    }
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Day Pass/ }));

    const stickyCells = container.querySelectorAll(".tml-tix-table__sticky");
    expect(stickyCells.length).toBeGreaterThan(0);
    for (const cell of stickyCells) {
      expect(cell.tagName).toBe("TH");
    }
  });

  it("shows a spoken dash where a package has no price for a row", () => {
    const onlyWorldwide = item({
      id: "friendship",
      name: "Friendship Garden",
      tiers: [tier({ key: "worldwide", amount: 5707 })],
    });

    function Harness() {
      return (
        <ComparisonProvider>
          <CompareToggle itemId="day-pass" itemName="Day Pass" />
          <CompareToggle itemId="friendship" itemName="Friendship Garden" />
          <ComparisonTable items={[DAY_PASS, onlyWorldwide]} editionLabel="Belgium" />
        </ComparisonProvider>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Day Pass/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Friendship Garden/ }));

    // One package lacks the pre-sale row, so the cell says so rather than shifting.
    expect(screen.getByText("Not published for this sale moment")).toBeInTheDocument();
  });

  it("offers a remove control per column", () => {
    function Harness() {
      return (
        <ComparisonProvider>
          <CompareToggle itemId="day-pass" itemName="Day Pass" />
          <ComparisonTable items={[DAY_PASS, FULL_MADNESS]} editionLabel="Belgium" />
        </ComparisonProvider>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Day Pass/ }));

    const remove = screen.getByRole("button", { name: /Remove Day Pass/ });
    fireEvent.click(remove);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("explains when euros and reais appear in one table, never converting", () => {
    const brasilItem = item({
      id: "br-full-madness",
      name: "Full Madness Pass",
      tiers: [tier({ key: "presale", label: "Standard", amount: 3160, currency: "BRL" })],
    });

    function Harness() {
      return (
        <ComparisonProvider>
          <CompareToggle itemId="day-pass" itemName="Day Pass" />
          <CompareToggle itemId="br-full-madness" itemName="Full Madness Pass" />
          <ComparisonTable items={[DAY_PASS, brasilItem]} editionLabel="Mixed" />
        </ComparisonProvider>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Day Pass$/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Full Madness Pass/ }));

    expect(screen.getByText(/never converted between euros and reais/)).toBeInTheDocument();
  });

  it("caps the comparison at three packages", () => {
    const third = item({ id: "third", name: "Third", tiers: [tier({ key: "presale", amount: 900 })] });
    const fourth = item({ id: "fourth", name: "Fourth", tiers: [tier({ key: "presale", amount: 950 })] });
    const all = [DAY_PASS, FULL_MADNESS, third, fourth];

    function Harness() {
      return (
        <ComparisonProvider>
          {all.map((entry) => (
            <CompareToggle key={entry.id} itemId={entry.id} itemName={entry.name} />
          ))}
          <ComparisonTable items={all} editionLabel="Belgium" />
        </ComparisonProvider>
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Day Pass$/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Full Madness Pass/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Third/ }));

    const fourthBox = screen.getByRole("checkbox", { name: /Fourth/ });
    expect(fourthBox).toBeDisabled();
    // The reason is available to a screen reader through aria-describedby.
    const describedBy = fourthBox.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toMatch(
      /holds up to 3 packages/,
    );
  });

  it("clears the whole comparison", () => {
    function Harness() {
      return (
        <ComparisonProvider>
          <CompareToggle itemId="day-pass" itemName="Day Pass" />
          <CompareToggle itemId="full-madness" itemName="Full Madness Pass" />
          <ComparisonTable items={[DAY_PASS, FULL_MADNESS]} editionLabel="Belgium" />
        </ComparisonProvider>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Day Pass$/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Full Madness Pass/ }));

    fireEvent.click(screen.getByRole("button", { name: "Clear comparison" }));

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Day Pass$/ })).not.toBeChecked();
  });
});

/* ---------------------------------------------------------------------------------------------
 * SaleTimeline
 * ------------------------------------------------------------------------------------------- */

describe("SaleTimeline", () => {
  const windows: CatalogueSaleWindow[] = [
    {
      id: "pre-sale",
      name: "WorldWide Pre-Sale",
      opensAt: "2027-02-06T17:00:00+01:00",
      timeZone: "Europe/Brussels",
      audience: "Everyone who pre-registered",
      source: SOURCE,
      lastVerified: "2026-11-18",
    },
    {
      id: "general-sale",
      name: "WorldWide Ticket Sale",
      opensAt: "2027-02-13T17:00:00+01:00",
      timeZone: "Europe/Brussels",
      audience: "Everyone who pre-registered",
      notes: "The Exchange Desk opens on the same day.",
      source: SOURCE,
      lastVerified: "2026-11-18",
    },
  ];

  it("shows each window with the published Belgian time and zone", () => {
    render(<SaleTimeline windows={windows} editionLabel="Belgium" />);

    expect(screen.getByText("Sat 6 Feb 2027, 17:00 CET")).toBeInTheDocument();
    expect(screen.getByText("Sat 13 Feb 2027, 17:00 CET")).toBeInTheDocument();
  });

  it("uses an ordered list, because the windows are a sequence", () => {
    const { container } = render(<SaleTimeline windows={windows} editionLabel="Belgium" />);

    expect(container.querySelector("ol")).not.toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("gives each window a machine-readable opening time", () => {
    const { container } = render(<SaleTimeline windows={windows} editionLabel="Belgium" />);

    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2027-02-06T17:00:00+01:00");
  });

  it("shows the notes and the source for each window", () => {
    render(<SaleTimeline windows={windows} editionLabel="Belgium" />);

    expect(screen.getByText(/The Exchange Desk opens on the same day/)).toBeInTheDocument();
    expect(screen.getAllByText(/Checked/)).toHaveLength(2);
  });

  it("says so when an edition has no published window", () => {
    render(<SaleTimeline windows={[]} editionLabel="Brasil" />);

    expect(screen.getByText(/No sale window for Brasil is published/)).toBeInTheDocument();
  });

  it("shows a published status label when the edition records one", () => {
    render(
      <SaleTimeline
        windows={[{ ...windows[0], statusLabel: "Passed" }]}
        editionLabel="Brasil"
      />,
    );

    expect(screen.getByText("Passed")).toBeInTheDocument();
  });
});
