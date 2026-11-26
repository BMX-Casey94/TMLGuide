import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditionProvider } from "./edition-context";
import { SiteHeader } from "./site-header";
import { resetEditionState } from "./test-storage";

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

/** Rendered image stubs, so jsdom never tries to fetch the real asset. */
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

function renderHeader() {
  return render(
    <EditionProvider>
      <SiteHeader />
    </EditionProvider>,
  );
}

beforeEach(() => {
  resetEditionState();
});

describe("SiteHeader", () => {
  it("gives the logo link alt text and a home destination", () => {
    renderHeader();

    const home = screen.getByRole("link", { name: "TMLGuide home" });
    expect(home).toHaveAttribute("href", "/");

    const logo = screen.getByAltText("TMLGuide home");
    expect(logo).toHaveAttribute("src", "/brand/logo-640.webp");
    expect(logo).toHaveAttribute("width", "1682");
    expect(logo).toHaveAttribute("height", "488");
  });

  it("has a primary landmark with the six desktop tabs", () => {
    renderHeader();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.querySelectorAll("a")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Guides" })).toHaveAttribute("href", "/guides");
    expect(screen.getByRole("link", { name: "Radio" })).toHaveAttribute("href", "/radio");
    // /ask is reachable from the header without typing the URL: this is the link
    // that makes that true on every width from 900px up.
    expect(screen.getByRole("link", { name: "Ask" })).toHaveAttribute("href", "/ask");
  });

  it("exposes search as a real text field that accepts typing", () => {
    renderHeader();

    const search = screen.getByRole("searchbox", { name: "Search the guide" });
    expect(search).toHaveAttribute("data-search-trigger");
    expect(search).toHaveAttribute("placeholder", "Search");
    expect(search).toHaveClass("search-field");
    fireEvent.change(search, { target: { value: "lockers" } });
    expect(search).toHaveValue("lockers");
  });

  it("offers one compact edition switcher at every width, with full names for assistive tech", () => {
    renderHeader();

    const groups = screen.getAllByRole("radiogroup", { name: "Choose edition" });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveAttribute("data-variant", "inline");
    expect(screen.getByRole("radio", { name: "Belgium" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Winter" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Brasil" })).toBeInTheDocument();
  });

  it("places the desktop edition switcher inside the search pill, after the search button", () => {
    renderHeader();

    const search = screen.getByRole("searchbox", { name: "Search the guide" });
    const inline = screen
      .getAllByRole("radiogroup", { name: "Choose edition" })
      .find((group) => group.getAttribute("data-variant") === "inline") as HTMLElement;
    const pill = search.closest("div") as HTMLElement;
    expect(pill.contains(inline)).toBe(true);
    expect(search.compareDocumentPosition(inline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("makes the logo the first tab stop in the header", () => {
    renderHeader();

    const header = screen.getByRole("banner");
    const focusable = header.querySelectorAll<HTMLElement>("a[href], button, [tabindex]");
    expect(focusable[0]).toBe(screen.getByRole("link", { name: "TMLGuide home" }));
  });

  it("does not clip or overhang: the logo lives inside the row", () => {
    renderHeader();

    const header = screen.getByRole("banner");
    const link = screen.getByRole("link", { name: "TMLGuide home" });
    expect(header.contains(link)).toBe(true);
    expect(link.style.transform).toBe("");
    expect(link.className).not.toContain("absolute");
  });

  it("carries the accessibility trigger after the pill, and keeps the search field where it was", () => {
    renderHeader();

    const trigger = screen.getByRole("button", { name: "Accessibility settings" });
    const search = screen.getByRole("searchbox", { name: "Search the guide" });
    const pill = search.closest("div") as HTMLElement;

    // After the pill in document order, so it moves neither the field nor the edition switcher.
    expect(pill.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pill.contains(trigger)).toBe(false);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the trigger out of the way below 900px, where the tab bar carries it instead", () => {
    renderHeader();

    const trigger = screen.getByRole("button", { name: "Accessibility settings" });
    expect(trigger.className).toContain("hidden");
    expect(trigger.className).toContain("min-[900px]:grid");
  });
});
