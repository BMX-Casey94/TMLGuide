import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";

import { sharedData } from "@/data/shared";
import { isInternalLink, renderAsRouter } from "./test-support";

/** Image stubs: jsdom cannot decode WebP, so next/image is replaced. */
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

const { EditionCards, ticketGuideHref } = await import("./edition-cards");

afterEach(cleanup);

describe("ticketGuideHref", () => {
  it("preselects the edition in the ticket guide", () => {
    expect(ticketGuideHref("belgium")).toBe("/guides/tickets?edition=belgium");
    expect(ticketGuideHref("winter")).toBe("/guides/tickets?edition=winter");
    expect(ticketGuideHref("brasil")).toBe("/guides/tickets?edition=brasil");
  });
});

describe("EditionCards", () => {
  it("renders one card per edition, each with a heading", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);

    expect(screen.getByRole("heading", { level: 3, name: /Tomorrowland Belgium/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Tomorrowland Winter/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Tomorrowland Brasil/ })).toBeInTheDocument();
  });

  it("links each card to the ticket guide for that edition", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);

    const links = screen
      .getAllByRole("link")
      .filter((link) => (link.getAttribute("href") ?? "").startsWith("/guides/tickets"));
    const hrefs = links.map((link) => link.getAttribute("href"));

    expect(hrefs).toContain("/guides/tickets?edition=belgium");
    expect(hrefs).toContain("/guides/tickets?edition=winter");
    expect(hrefs).toContain("/guides/tickets?edition=brasil");
  });

  it("shows Belgium's 2027 dates and location from the data", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);

    const belgium = screen
      .getByRole("heading", { level: 3, name: /Tomorrowland Belgium/ })
      .closest("article");

    expect(within(belgium as HTMLElement).getByText(/Weekend 1/)).toBeInTheDocument();
    expect(within(belgium as HTMLElement).getByText(/Weekend 2/)).toBeInTheDocument();
    expect(screen.getByText("16–18 July 2027")).toBeInTheDocument();
    expect(screen.getByText("23–25 July 2027")).toBeInTheDocument();
    expect(screen.getAllByText("Boom, Belgium").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Winter's and Brasil's single runs", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);

    expect(screen.getByText("20–27 March 2027")).toBeInTheDocument();
    expect(screen.getByText("30 April – 2 May 2027")).toBeInTheDocument();
  });

  it("shows Belgium's cheapest WorldWide price, labelled with the sale", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);

    expect(screen.getByText("€159")).toBeInTheDocument();
    expect(screen.getByText(/Day Pass · WorldWide Ticket Sale/)).toBeInTheDocument();
  });

  it("shows Winter's one verified price", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);
    expect(screen.getByText("€735")).toBeInTheDocument();
    expect(screen.getByText(/7-Day Festival Ticket/)).toBeInTheDocument();
  });

  it("shows Brasil's price in reais", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);

    expect(screen.getByText("R$1,270")).toBeInTheDocument();
    expect(screen.getByText(/Prices in reais/)).toBeInTheDocument();
  });

  it("never converts reais to euros", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);
    const brasilCard = screen
      .getByRole("heading", { level: 3, name: /Tomorrowland Brasil/ })
      .closest("article");

    expect(brasilCard).not.toBeNull();
    expect(brasilCard?.textContent).not.toContain("€");
  });

  it("marks the sold-out Brasil pass rather than presenting it as bookable", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);
    expect(screen.getByText("Sold out")).toBeInTheDocument();
  });

  it("cites each price with a source link and a check date", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);

    const sourceLinks = Array.from(document.querySelectorAll(".home-edition__source-link"));
    expect(sourceLinks).toHaveLength(3);

    for (const link of sourceLinks) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\/[a-z0-9.-]*tomorrowland\.com\//);
      expect(link.getAttribute("rel")).toContain("noopener");
    }
    expect(screen.getAllByText(/Checked 18 November 2026/)).toHaveLength(3);
  });

  it("shows an honest empty state when an edition has no dates", () => {
    renderAsRouter(
      <EditionCards
        editions={[
          {
            id: "winter-2027",
            name: "Tomorrowland Winter 2027",
            guideEdition: "winter",
            startsOn: "2027-03-20",
            endsOn: "2027-03-27",
            venue: "Alpe d'Huez",
            location: "Alpe d'Huez, France",
            status: "upcoming",
          },
        ]}
      />,
    );

    const belgium = screen.getByRole("heading", { level: 3, name: /Tomorrowland Belgium/ }).closest("article");
    expect(within(belgium as HTMLElement).getByText("Dates are not published yet.")).toBeInTheDocument();
  });

  it("gives the section a single h2 above the card headings", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });

  it("keeps every internal link on a known route", () => {
    renderAsRouter(<EditionCards editions={sharedData.editions} />);

    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("/")) expect(isInternalLink(href)).toBe(true);
    }
  });
});
