import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PackageCard } from "./package-card";
import { TicketsExplorer } from "./tickets-explorer";
import type { CatalogueItem, EditionCatalogue, PriceTier } from "./types";

afterEach(cleanup);

const SOURCE = {
  url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/",
  title: "Tomorrowland Belgium — festival tickets",
  retrievedOn: "2026-11-18",
} as const;

function tier(key: string, label: string, amount: number): PriceTier {
  return {
    key,
    label,
    year: 2027,
    currency: "EUR",
    amount,
    source: SOURCE,
    lastVerified: "2026-11-18",
  };
}

const DAY_PASS: CatalogueItem = {
  id: "belgium-2027-day-pass",
  categoryId: "festival-tickets",
  name: "Day Pass",
  includes: ["Festival access for one day"],
  note: "Price excludes the Treasure Case fee.",
  tiers: [
    tier("presale", "Pre-sale", 144),
    tier("worldwide", "WorldWide sale", 159),
  ],
  priceStatus: "published",
  badges: [],
  source: SOURCE,
  lastVerified: "2026-11-18",
};

const FULL_MADNESS: CatalogueItem = {
  id: "belgium-2027-full-madness",
  categoryId: "festival-tickets",
  name: "Full Madness Pass",
  includes: ["Festival access for all three days of one weekend"],
  tiers: [
    tier("presale", "Pre-sale", 335),
    tier("worldwide", "WorldWide sale", 410),
  ],
  priceStatus: "published",
  badges: [],
  source: SOURCE,
  lastVerified: "2026-11-18",
};

const EASY_TENT: CatalogueItem = {
  id: "belgium-2027-easy-tent-2p",
  categoryId: "dreamville",
  name: "Easy Tent 2P",
  qualifier: "2 people · for the whole stay",
  includes: [],
  note: "Pre-erected tent with a double air mattress.",
  tiers: [tier("presale", "Pre-sale", 1240)],
  priceStatus: "published",
  badges: [],
  source: SOURCE,
  lastVerified: "2026-11-18",
};

const UNPRICED: CatalogueItem = {
  id: "four-day-festival-ticket",
  categoryId: "festival-tickets",
  name: "4-Day Festival Ticket",
  qualifier: "Four days",
  includes: [],
  tiers: [],
  priceStatus: "unpublished",
  missingReason: "No 2027 price is published.",
  officialUrl: "https://winter.tomorrowland.com/en/tickets/festival-ticket/",
  badges: ["Price not published"],
  source: SOURCE,
  lastVerified: "2026-11-18",
};

const CATALOGUE: EditionCatalogue = {
  edition: "belgium",
  label: "Belgium",
  year: 2027,
  categories: [
    {
      id: "festival-tickets",
      kicker: "01 · Festival passes",
      label: "Festival tickets",
      description: "Day passes and three-day passes.",
      icon: "gift",
      items: [DAY_PASS, FULL_MADNESS],
    },
    {
      id: "dreamville",
      kicker: "02 · DreamVille",
      label: "DreamVille camping",
      description: "Tents and pitches.",
      icon: "map-pin",
      items: [EASY_TENT],
    },
    {
      id: "global-journey",
      kicker: "04 · Travel packages",
      label: "Global Journey",
      description: "Travel packages.",
      icon: "rocket",
      items: [],
      emptyNote: "No 2027 Global Journey price is published.",
      emptyUrl: "https://belgium.tomorrowland.com/en/tickets/global-journey/",
    },
  ],
  windows: [],
  explainer: [],
  officialLinks: [],
  checkedOn: "2026-11-18",
};

describe("TicketsExplorer at the root", () => {
  it("lists every category with its package count", () => {
    render(<TicketsExplorer catalogue={CATALOGUE} />);

    expect(screen.getByRole("link", { name: /Festival tickets/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /DreamVille camping/ })).toBeInTheDocument();
    expect(screen.getByText("2 packages")).toBeInTheDocument();
    expect(screen.getByText("1 package")).toBeInTheDocument();
  });

  it("says a category has nothing published rather than showing a zero price", () => {
    render(<TicketsExplorer catalogue={CATALOGUE} />);

    expect(screen.getByText("No price published yet")).toBeInTheDocument();
  });

  it("shows a breadcrumb whose only crumb is the current page", () => {
    render(<TicketsExplorer catalogue={CATALOGUE} />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const current = within(nav).getByText("Tickets");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("announces the category count in a live region", () => {
    const { container } = render(<TicketsExplorer catalogue={CATALOGUE} />);

    const status = container.querySelector('[role="status"]');
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status?.textContent).toMatch(/^3 categories of tickets and packages for Belgium/);
  });

  it("counts only the categories an edition actually has, not a fixed number", () => {
    // Winter and Brasil publish two categories, so a hardcoded "four" would lie.
    const twoCategory: EditionCatalogue = {
      ...CATALOGUE,
      label: "Winter",
      edition: "winter",
      categories: CATALOGUE.categories.slice(0, 2),
    };
    const { container } = render(<TicketsExplorer catalogue={twoCategory} />);

    expect(container.querySelector('[role="status"]')?.textContent).toMatch(/^2 categories/);
    expect(container.querySelector('[role="status"]')?.textContent).not.toMatch(/four/i);
  });
});

describe("TicketsExplorer at a category", () => {
  it("lists the category's packages as cards", () => {
    render(<TicketsExplorer catalogue={CATALOGUE} categoryId="festival-tickets" />);

    expect(screen.getByRole("heading", { name: "Day Pass" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Full Madness Pass" })).toBeInTheDocument();
  });

  it("shows a two-level breadcrumb with a link back to the root", () => {
    render(<TicketsExplorer catalogue={CATALOGUE} categoryId="festival-tickets" />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/guides/tickets");
    expect(within(nav).getByText("Festival tickets")).toHaveAttribute("aria-current", "page");
  });

  it("links each card to its own drill-down URL", () => {
    render(<TicketsExplorer catalogue={CATALOGUE} categoryId="festival-tickets" />);

    expect(screen.getByRole("link", { name: /Details for Day Pass/ })).toHaveAttribute(
      "href",
      "/guides/tickets?category=festival-tickets&package=belgium-2027-day-pass",
    );
  });

  it("shows the empty state and official link for a category with no products", () => {
    render(<TicketsExplorer catalogue={CATALOGUE} categoryId="global-journey" />);

    expect(screen.getByText("No price published yet")).toBeInTheDocument();
    expect(screen.getByText(/No 2027 Global Journey price is published/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Official page/ })).toHaveAttribute(
      "href",
      "https://belgium.tomorrowland.com/en/tickets/global-journey/",
    );
  });

  it("falls back to the root for an unknown category instead of erroring", () => {
    render(<TicketsExplorer catalogue={CATALOGUE} categoryId="not-a-category" />);

    expect(screen.getByRole("link", { name: /Festival tickets/ })).toBeInTheDocument();
  });

  it("announces the package count for the category", () => {
    const { container } = render(<TicketsExplorer catalogue={CATALOGUE} categoryId="dreamville" />);

    expect(container.querySelector('[role="status"]')?.textContent).toMatch(
      /1 package in DreamVille camping/,
    );
  });

  it("renders the comparison invitation below the list", () => {
    render(<TicketsExplorer catalogue={CATALOGUE} categoryId="festival-tickets" />);

    expect(screen.getByRole("heading", { name: "Compare packages" })).toBeInTheDocument();
  });
});

describe("TicketsExplorer at a package", () => {
  it("shows the package heading at level two, under the page heading", () => {
    render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Day Pass" })).toBeInTheDocument();
  });

  it("makes the package heading a focus target", () => {
    render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Day Pass" });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading.id).toBe("package-heading");
  });

  it("shows a three-level breadcrumb", () => {
    render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/guides/tickets",
      "/guides/tickets?category=festival-tickets",
    ]);
    expect(within(nav).getByText("Day Pass")).toHaveAttribute("aria-current", "page");
  });

  it("shows every tier with its label and year", () => {
    render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    expect(screen.getByText("€144.00")).toBeInTheDocument();
    expect(screen.getByText("€159.00")).toBeInTheDocument();
    expect(screen.getByText("Pre-sale")).toBeInTheDocument();
  });

  it("shows what the package includes", () => {
    render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    expect(screen.getByText("What is included")).toBeInTheDocument();
    expect(screen.getByText("Festival access for one day")).toBeInTheDocument();
  });

  it("shows the record's own note", () => {
    render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    expect(screen.getByText(/Price excludes the Treasure Case fee/)).toBeInTheDocument();
  });

  it("explains which sale each price applies to when there are several", () => {
    render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-full-madness"
      />,
    );

    expect(screen.getByText("Where each price applies")).toBeInTheDocument();
  });

  it("offers a link back to the category", () => {
    render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    expect(screen.getByRole("link", { name: /Back to Festival tickets/ })).toHaveAttribute(
      "href",
      "/guides/tickets?category=festival-tickets",
    );
  });

  it("ignores a package id that is not in the category and shows the list", () => {
    render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="not-a-package"
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Festival tickets" })).toBeInTheDocument();
  });

  it("announces which package is shown", () => {
    const { container } = render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    expect(container.querySelector('[role="status"]')?.textContent).toBe("Day Pass details shown.");
  });
});

describe("TicketsExplorer focus movement", () => {
  it("moves focus to the package heading after a drill-down", () => {
    const { rerender } = render(<TicketsExplorer catalogue={CATALOGUE} categoryId="festival-tickets" />);

    rerender(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 2, name: "Day Pass" }),
    );
  });

  it("moves focus to the category heading when leaving a package", () => {
    const { rerender } = render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    rerender(<TicketsExplorer catalogue={CATALOGUE} categoryId="festival-tickets" />);

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 2, name: "Festival tickets" }),
    );
  });

  it("moves focus to the visible category grid heading when returning to the root", () => {
    const { rerender } = render(
      <TicketsExplorer catalogue={CATALOGUE} categoryId="festival-tickets" />,
    );

    rerender(<TicketsExplorer catalogue={CATALOGUE} />);

    const heading = screen.getByRole("heading", { level: 2, name: "Browse by category" });
    expect(document.activeElement).toBe(heading);
    // A focus target must be visible: it cannot sit in the visually hidden class.
    expect(heading.className).not.toContain("tml-tix-sr");
  });

  it("does not steal focus on first render, so a deep link starts at the top", () => {
    render(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    expect(document.activeElement).toBe(document.body);
  });
});

describe("TicketsExplorer comparison across the list", () => {
  it("ticks a package and shows it in the table", () => {
    render(<TicketsExplorer catalogue={CATALOGUE} categoryId="festival-tickets" />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Compare Day Pass" }));

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "Day Pass" }),
    ).toBeInTheDocument();
  });

  it("keeps a selection when moving to a package detail", () => {
    const { rerender } = render(
      <TicketsExplorer catalogue={CATALOGUE} categoryId="festival-tickets" />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Compare Day Pass" }));

    rerender(
      <TicketsExplorer
        catalogue={CATALOGUE}
        categoryId="festival-tickets"
        packageId="belgium-2027-day-pass"
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Add Day Pass to the comparison" }),
    ).toBeChecked();
  });

  it("shows an unpublished product without a price anywhere on the page", () => {
    const withUnpriced: EditionCatalogue = {
      ...CATALOGUE,
      categories: [
        {
          ...CATALOGUE.categories[0],
          items: [DAY_PASS, UNPRICED],
        },
      ],
    };
    render(<TicketsExplorer catalogue={withUnpriced} categoryId="festival-tickets" />);

    expect(screen.getByText("Price not published yet")).toBeInTheDocument();
    expect(screen.getByText(/No 2027 price is published/)).toBeInTheDocument();
  });
});

describe("PackageCard", () => {
  it("renders the name as a heading at the requested level", () => {
    render(<PackageCard item={DAY_PASS} detailHref="/guides/tickets?x=1" headingLevel={3} />);

    expect(screen.getByRole("heading", { level: 3, name: "Day Pass" })).toBeInTheDocument();
  });

  it("defaults to level four inside a list", () => {
    render(<PackageCard item={DAY_PASS} detailHref="/guides/tickets?x=1" />);

    expect(screen.getByRole("heading", { level: 4, name: "Day Pass" })).toBeInTheDocument();
  });

  it("renders at level three in a package list, which sits under a level-two heading", () => {
    // A card under the category heading must not skip from h2 to h4.
    render(<TicketsExplorer catalogue={CATALOGUE} categoryId="festival-tickets" />);

    expect(screen.getByRole("heading", { level: 3, name: "Day Pass" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
  });

  it("shows badges as a list of pills", () => {
    render(
      <PackageCard
        item={{ ...EASY_TENT, badges: ["WorldWide sale only"] }}
        detailHref="/guides/tickets?x=1"
      />,
    );

    expect(screen.getByText("WorldWide sale only")).toBeInTheDocument();
  });

  it("shows the qualifier when the product has one", () => {
    render(<PackageCard item={EASY_TENT} detailHref="/guides/tickets?x=1" />);

    expect(screen.getByText("2 people · for the whole stay")).toBeInTheDocument();
  });

  it("shows a source line with the checked date", () => {
    const { container } = render(<PackageCard item={DAY_PASS} detailHref="/guides/tickets?x=1" />);

    // The line is several inline fragments, so assert on the whole line's text.
    const line = container.querySelector(".tml-tix-source");
    expect(line?.textContent).toMatch(/Checked\s*18 Nov 2026/);
  });

  it("renders the comparison control when one is supplied", () => {
    render(
      <PackageCard
        item={DAY_PASS}
        detailHref="/guides/tickets?x=1"
        compareControl={<input type="checkbox" aria-label="Compare in card" />}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Compare in card" })).toBeInTheDocument();
  });

  it("renders no comparison control on its own", () => {
    render(<PackageCard item={DAY_PASS} detailHref="/guides/tickets?x=1" />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
