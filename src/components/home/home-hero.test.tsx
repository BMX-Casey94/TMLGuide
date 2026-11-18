import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { sharedData } from "@/data/shared";
import { HomeHero } from "./home-hero";
import { NextSaleStrip } from "./next-sale-strip";
import { nextSaleFrom } from "./next-sale";
import { isInternalLink, renderAsRouter } from "./test-support";

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

const CHECKED_ON = "2026-11-18";
const CHECKED_LABEL = "18 November 2026";
const SERVER_NOW = "2026-11-18T12:00:00Z";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function saleSlot() {
  const next = nextSaleFrom(
    [
      {
        edition: "winter",
        id: "add-on-sale-2027",
        name: "Winter 2027 Add-On Sale",
        opensAtIso: "2026-11-26T15:00:00+01:00",
        timeZone: "Europe/Brussels",
        audience: "General sale",
        source: {
          url: "https://winter.tomorrowland.com/en/add-ons/",
          title: "Tomorrowland Winter 2027 add-ons",
          retrievedOn: CHECKED_ON,
        },
        lastVerified: CHECKED_ON,
      },
    ],
    new Date(SERVER_NOW),
  );

  return (
    <NextSaleStrip
      next={next}
      checkedOn={CHECKED_ON}
      checkedOnLabel={CHECKED_LABEL}
      serverNowIso={SERVER_NOW}
    />
  );
}

function renderHero() {
  return renderAsRouter(
    <HomeHero
      editions={sharedData.editions}
      checkedOnLabel={CHECKED_LABEL}
      saleSlot={saleSlot()}
    />,
  );
}

describe("HomeHero", () => {
  it("carries the one h1 on the page", () => {
    renderHero();

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(
      "The independent guide to Tomorrowland: tickets, travel, DreamVille and the tools to plan it",
    );
  });

  it("does not repeat the site's name at display size", () => {
    renderHero();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent?.toLowerCase()).not.toContain("tmlguide");
  });

  it("offers the two primary actions the brief names", () => {
    renderHero();

    expect(screen.getByRole("link", { name: "Plan your trip" })).toHaveAttribute("href", "/guides");
    expect(screen.getByRole("link", { name: "Check ticket dates" })).toHaveAttribute(
      "href",
      "/tools/sale-timeline",
    );
  });

  it("shows the dates for each edition, read from the data", () => {
    renderHero();

    expect(screen.getByText("16–18 July 2027")).toBeInTheDocument();
    expect(screen.getByText("23–25 July 2027")).toBeInTheDocument();
    expect(screen.getByText("20–27 March 2027")).toBeInTheDocument();
    expect(screen.getByText("30 April – 2 May 2027")).toBeInTheDocument();
  });

  it("lists the facts row under one accessible name", () => {
    renderHero();
    expect(screen.getByRole("list", { name: "Festival dates by edition" })).toBeInTheDocument();
  });

  it("shows no past edition in the facts row", () => {
    renderHero();
    expect(screen.queryByText("2026")).not.toBeInTheDocument();
    expect(screen.queryByText("17–19 July 2026")).not.toBeInTheDocument();
  });

  it("places the sale strip inside the hero", () => {
    const { container } = renderHero();
    expect(container.querySelector(".home-hero .home-next")).not.toBeNull();
  });

  it("states the check date and links to the method", () => {
    renderHero();

    expect(screen.getByText(/Dates read from the shared edition overview/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /How facts are checked/ })).toHaveAttribute(
      "href",
      "/about",
    );
  });

  it("links only to routes the site knows about", () => {
    renderHero();

    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("/")) expect(isInternalLink(href)).toBe(true);
    }
  });

  it("keeps the decorative trail out of the accessibility tree", () => {
    const { container } = renderHero();
    expect(container.querySelector(".tml-trail")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the hero without a sale strip when the slot is empty", () => {
    renderAsRouter(
      <HomeHero editions={sharedData.editions} checkedOnLabel={CHECKED_LABEL} saleSlot={null} />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });
});
