import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import MorePage, { metadata } from "./page";

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

afterEach(cleanup);

/** Every destination the page lists, in document order. */
function listedHrefs(): string[] {
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "")
    // The card is the link; its "Open" hint is decoration inside it.
    .filter((href) => href !== "");
}

describe("more page", () => {
  it("has one h1, and the list of pages hangs off a section heading below it", () => {
    render(<MorePage />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Everything else");

    expect(screen.getByRole("heading", { level: 2, name: "Pages" })).toBeInTheDocument();
  });

  it("lists exactly the four live pages, and no unpublished one", () => {
    render(<MorePage />);

    expect(listedHrefs()).toEqual(["/ask", "/radio", "/about", "/accessibility"]);
  });

  it("does not link Contact, Privacy, Terms or Cookies, which are not published", () => {
    render(<MorePage />);

    const hrefs = listedHrefs();
    for (const unpublished of ["/contact", "/privacy", "/terms", "/cookies"]) {
      expect(hrefs, unpublished).not.toContain(unpublished);
    }

    // And in words: no visible label offers one of those pages either.
    for (const label of [/^contact$/i, /^privacy/i, /^terms$/i, /^cookies?$/i]) {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    }
  });

  it("gives every card a title that is a heading, and a description", () => {
    render(<MorePage />);

    for (const title of [
      "Ask the guide",
      "One World Radio",
      "About this guide",
      "Accessibility",
    ]) {
      const heading = screen.getByRole("heading", { level: 3, name: title });
      const card = heading.closest("a");
      expect(card, title).not.toBeNull();
      // The description is the card's prose, not a second copy of its title.
      expect(card?.textContent?.length ?? 0, title).toBeGreaterThan(title.length + 40);
    }
  });

  it("describes Ask the guide with the claim its own page makes, and no invented figures", () => {
    render(<MorePage />);

    const heading = screen.getByRole("heading", { level: 3, name: "Ask the guide" });
    const card = heading.closest("a") as HTMLElement;

    expect(within(card).getByText(/verified, dated records/i)).toBeInTheDocument();
    expect(within(card).getByText(/official page behind it/i)).toBeInTheDocument();
    // No currency figure and no count is promised on a page that states neither.
    expect(card.textContent).not.toMatch(/€|£|R\$/);
  });

  it("marks the cards up as a list, so a screen reader announces how many there are", () => {
    render(<MorePage />);

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    // The list style is removed visually, so the semantic role must survive that.
    expect(list).toHaveClass("more-grid");
  });

  it("puts no form, no script and no outbound link on the page", () => {
    const { container } = render(<MorePage />);

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")?.startsWith("/")).toBe(true);
    }
  });

  it("renders every card through the shared kit, which carries the icon glow", () => {
    const { container } = render(<MorePage />);

    expect(container.querySelectorAll(".tml-card")).toHaveLength(4);
    expect(container.querySelectorAll(".tml-icon3d--glow")).toHaveLength(4);
  });
});

describe("more page metadata", () => {
  it("declares its own title and description, not the site default", () => {
    expect(metadata.title).toBe("More");
    expect(String(metadata.description).length).toBeGreaterThan(50);
    expect(String(metadata.description).length).toBeLessThanOrEqual(320);
  });

  it("declares a canonical URL matching its own path", () => {
    expect(metadata.alternates?.canonical).toBe("/more");
  });

  it("carries a complete Open Graph and Twitter block", () => {
    const openGraph = metadata.openGraph as
      | { title?: string; description?: string; url?: unknown; siteName?: string; locale?: string }
      | undefined;

    expect(openGraph?.title).toBe("More | TMLGuide");
    expect(openGraph?.description).toBeTruthy();
    expect(openGraph?.url).toBe("/more");
    expect(openGraph?.siteName).toBe("TMLGuide");
    expect(openGraph?.locale).toBe("en_GB");

    const twitter = metadata.twitter as { card?: string; title?: string } | undefined;
    expect(twitter?.card).toBe("summary");
    expect(twitter?.title).toBe("More | TMLGuide");
  });

  it("is indexable, like every other public page", () => {
    expect(metadata.robots).toBeUndefined();
  });
});
