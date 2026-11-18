import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { TrustStrip } from "./trust-strip";
import { CommunityCta } from "./community-cta";
import { isInternalLink, renderAsRouter } from "./test-support";

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

afterEach(cleanup);

describe("TrustStrip", () => {
  it("states the check date the page was given", () => {
    render(<TrustStrip checkedOn="2026-11-18" checkedOnLabel="18 November 2026" />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Facts checked against official sources on 18 November 2026",
      }),
    ).toBeInTheDocument();
  });

  it("gives the date a machine-readable value", () => {
    render(<TrustStrip checkedOn="2026-11-18" checkedOnLabel="18 November 2026" />);
    expect(screen.getByText("18 November 2026")).toHaveAttribute("datetime", "2026-11-18");
  });

  it("states independence plainly, naming both entities", () => {
    const { container } = render(
      <TrustStrip checkedOn="2026-11-18" checkedOnLabel="18 November 2026" />,
    );

    const statement = container.querySelector(".home-trust__statement")?.textContent ?? "";
    expect(statement).toContain("not affiliated with");
    expect(statement).toContain("Tomorrowland");
    expect(statement).toContain("WeAreOne.World B.V.");
    expect(statement).toContain("no ticket, package or partner listing here is sold by us");
  });

  it("links to the About page for the method", () => {
    render(<TrustStrip checkedOn="2026-11-18" checkedOnLabel="18 November 2026" />);

    const link = screen.getByRole("link", { name: /How this site is checked/ });
    expect(link).toHaveAttribute("href", "/about");
  });

  it("uses no decorative image, so the butterfly motif stays in the hero and the closing panel", () => {
    const { container } = render(
      <TrustStrip checkedOn="2026-11-18" checkedOnLabel="18 November 2026" />,
    );

    expect(container.querySelector(".tml-trail")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("CommunityCta", () => {
  it("offers community and radio, and nothing else", () => {
    renderAsRouter(<CommunityCta />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/community", "/radio"]);
  });

  it("names each action in words, not just an icon", () => {
    renderAsRouter(<CommunityCta />);

    expect(screen.getByRole("link", { name: "Find a group" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Listen to the radio" })).toBeInTheDocument();
  });

  it("gives the section one h2", () => {
    renderAsRouter(<CommunityCta />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });

  it("does not duplicate the global footer", () => {
    const { container } = renderAsRouter(<CommunityCta />);
    expect(container.querySelector("footer")).toBeNull();
  });

  it("links only to routes the site knows about", () => {
    renderAsRouter(<CommunityCta />);

    for (const link of screen.getAllByRole("link")) {
      expect(isInternalLink(link.getAttribute("href") ?? "")).toBe(true);
    }
  });
});
