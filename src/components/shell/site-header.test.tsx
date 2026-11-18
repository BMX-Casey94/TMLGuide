import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EditionProvider } from "./edition-context";
import { LOGO_OVERHANG_PX, SiteHeader } from "./site-header";
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

  it("has a primary landmark with the five desktop tabs", () => {
    renderHeader();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.querySelectorAll("a")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Guides" })).toHaveAttribute("href", "/guides");
    expect(screen.getByRole("link", { name: "Radio" })).toHaveAttribute("href", "/radio");
  });

  it("exposes the search trigger as a real button", () => {
    renderHeader();

    const search = screen.getByRole("button", { name: "Search" });
    expect(search).toHaveAttribute("data-search-trigger");
    expect(search).toHaveAttribute("type", "button");
  });

  it("offers the edition switcher on both desktop and mobile", () => {
    renderHeader();

    const groups = screen.getAllByRole("radiogroup", { name: "Choose edition" });
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.getAttribute("data-variant"))).toEqual([
      "inline",
      "stacked",
    ]);
  });

  it("makes the logo the first tab stop in the header", () => {
    renderHeader();

    const header = screen.getByRole("banner");
    const focusable = header.querySelectorAll<HTMLElement>("a[href], button, [tabindex]");
    expect(focusable[0]).toBe(screen.getByRole("link", { name: "TMLGuide home" }));
  });

  it("pushes the logo below the header row without clipping it", () => {
    renderHeader();

    const header = screen.getByRole("banner");
    const row = header.querySelector(".border-b");
    expect(row).not.toBeNull();

    // jsdom does not resolve Tailwind classes, so assert on the classes themselves: nothing in the
    // logo's ancestor chain may clip, or the overhang would be cut off.
    for (const element of [header, header.firstElementChild as HTMLElement]) {
      expect(element).not.toBeNull();
      expect(element.className).not.toContain("overflow-hidden");
      expect(element.className).not.toContain("overflow-clip");
    }

    const link = screen.getByRole("link", { name: "TMLGuide home" });
    expect(link.style.transform).toBe(`translateY(${LOGO_OVERHANG_PX}px)`);
    expect(LOGO_OVERHANG_PX).toBeGreaterThanOrEqual(18);
    expect(LOGO_OVERHANG_PX).toBeLessThanOrEqual(22);
  });

  it("sets the edition bar's top padding clear of the logo overhang on phones", () => {
    renderHeader();

    // The stacked switcher sits in its own bar below the row; that bar's top padding must exceed the
    // overhang, otherwise the logo would land on the segments on a phone.
    const stacked = screen
      .getAllByRole("radiogroup", { name: "Choose edition" })
      .find((group) => group.getAttribute("data-variant") === "stacked");
    expect(stacked).toBeDefined();

    const bar = (stacked as HTMLElement).parentElement as HTMLElement;
    const paddingTop = bar.className.match(/pt-(\d+(?:\.\d+)?)/)?.[1];
    expect(paddingTop).toBeDefined();
    // Tailwind's spacing scale is 0.25rem per step; 1rem is 16px at the browser default.
    expect(Number(paddingTop) * 4).toBeGreaterThan(LOGO_OVERHANG_PX);
  });

  it("keeps the logo wrapper out of the pointer path", () => {
    renderHeader();

    // The wrapper is full-width across the header top, so it must not swallow clicks on the tabs,
    // edition switcher or search button beneath it; only the link may receive pointers.
    const link = screen.getByRole("link", { name: "TMLGuide home" });
    const wrapper = link.parentElement as HTMLElement;
    expect(wrapper.className).toContain("pointer-events-none");
    expect(link.className).toContain("pointer-events-auto");
  });

  it("reserves the overhang's space itself, above 900px, so pages need no top padding", () => {
    renderHeader();

    // Without this strip the logo would sit on whatever a page renders first. It is decorative and
    // exactly the overhang tall.
    const strip = Array.from(screen.getByRole("banner").querySelectorAll<HTMLElement>("div")).find(
      (element) => element.style.height === `${LOGO_OVERHANG_PX}px`,
    );
    expect(strip).toBeDefined();
    expect(strip).toHaveAttribute("aria-hidden", "true");
    expect(strip).toHaveClass("hidden", "min-[900px]:block");
  });
});
