import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";

import { ICON_3D_NAMES } from "@/components/ui/icon-3d";
import { START_HERE, StartHere } from "./start-here";
import { isInternalLink, renderAsRouter } from "./test-support";

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

afterEach(cleanup);

describe("START_HERE", () => {
  it("covers the six destinations the brief names", () => {
    expect(START_HERE.map((item) => item.href)).toEqual([
      "/guides/tickets",
      "/tools/sale-timeline",
      "/tools/budget-calculator",
      "/tools/pearl-calculator",
      "/community",
      "/radio",
    ]);
  });

  it("uses only icon names that exist in the 3D set", () => {
    for (const item of START_HERE) {
      expect(ICON_3D_NAMES).toContain(item.icon);
    }
  });

  it("gives every card a title and a line of copy", () => {
    for (const item of START_HERE) {
      expect(item.title.length).toBeGreaterThan(3);
      expect(item.body.length).toBeGreaterThan(30);
    }
  });

  it("links only to routes the site knows about", () => {
    for (const item of START_HERE) {
      expect(isInternalLink(item.href)).toBe(true);
    }
  });

  it("has no duplicate destination", () => {
    const hrefs = START_HERE.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("StartHere", () => {
  it("renders six linked cards with a 3D icon each", () => {
    const { container } = renderAsRouter(<StartHere />);

    expect(container.querySelectorAll(".tml-icon3d")).toHaveLength(6);
    expect(container.querySelectorAll(".tml-card--interactive")).toHaveLength(6);
  });

  it("names each card with its heading, not just its body copy", () => {
    renderAsRouter(<StartHere />);

    for (const item of START_HERE) {
      expect(screen.getByRole("heading", { level: 3, name: item.title })).toBeInTheDocument();
    }
  });

  it("makes each card a single link to its destination", () => {
    renderAsRouter(<StartHere />);

    for (const item of START_HERE) {
      const link = screen.getByRole("link", { name: new RegExp(item.title) });
      expect(link).toHaveAttribute("href", item.href);
    }
  });

  it("marks decorative icons as such, so they are skipped by a screen reader", () => {
    const { container } = renderAsRouter(<StartHere />);

    for (const image of Array.from(container.querySelectorAll(".tml-icon3d img"))) {
      expect(image.getAttribute("alt")).toBe("");
    }
  });

  it("wraps the cards in a labelled region", () => {
    renderAsRouter(<StartHere />);
    const region = screen.getByRole("region", { name: "Ways to start planning" });

    expect(within(region).getAllByRole("link")).toHaveLength(6);
  });

  it("gives the section one h2 and the cards h3s", () => {
    renderAsRouter(<StartHere />);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
    expect(screen.queryAllByRole("heading", { level: 4 })).toHaveLength(0);
  });

  it("links its heading action to the guide index", () => {
    renderAsRouter(<StartHere />);

    const action = screen.getByRole("link", { name: /All guides/ });
    expect(action).toHaveAttribute("href", "/guides");
  });
});
