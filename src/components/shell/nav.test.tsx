import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { DESKTOP_NAV, MOBILE_TABS, activeHref, matchesPath } from "./nav";
import { HeaderTabs } from "./header-tabs";
import { MobileTabBar } from "./mobile-tabbar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

afterEach(cleanup);

/** Rendered image stubs: keep next/image out of jsdom, which cannot decode images. */
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

describe("nav path matching", () => {
  it("matches an exact path and its nested paths", () => {
    expect(matchesPath("/guides", "/guides")).toBe(true);
    expect(matchesPath("/guides/tickets", "/guides")).toBe(true);
    expect(matchesPath("/guides/tickets", "/guides/tickets")).toBe(true);
    expect(matchesPath("/guidesx", "/guides")).toBe(false);
  });

  it("matches the home route only at the root", () => {
    expect(matchesPath("/", "/")).toBe(true);
    expect(matchesPath("/guides", "/")).toBe(false);
  });

  it("picks the most specific covering destination", () => {
    expect(activeHref("/guides/tickets", DESKTOP_NAV)).toBe("/guides/tickets");
    expect(activeHref("/guides/dreamville", DESKTOP_NAV)).toBe("/guides");
    expect(activeHref("/about", DESKTOP_NAV)).toBeNull();
  });

  it("picks at most one mobile tab", () => {
    expect(activeHref("/", MOBILE_TABS)).toBe("/");
    expect(activeHref("/guides/tickets", MOBILE_TABS)).toBe("/guides");
    expect(activeHref("/tools/pearl-calculator", MOBILE_TABS)).toBe("/tools");
  });
});

describe("HeaderTabs", () => {
  it("marks the covering tab as the current page", () => {
    render(
      <nav aria-label="Primary">
        <HeaderTabs pathname="/guides/tickets" />
      </nav>,
    );

    const current = within(screen.getByRole("navigation", { name: "Primary" })).getAllByRole("link", {
      current: "page",
    });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("Tickets");
  });

  it("marks Guides for a child path with no closer tab", () => {
    render(
      <nav aria-label="Primary">
        <HeaderTabs pathname="/guides/dreamville" />
      </nav>,
    );

    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveAccessibleName("Guides");
  });

  it("marks nothing current when the pathname is unknown", () => {
    render(
      <nav aria-label="Primary">
        <HeaderTabs pathname={null} />
      </nav>,
    );

    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(DESKTOP_NAV.length);
  });

  it("marks nothing current on an unrelated path", () => {
    render(
      <nav aria-label="Primary">
        <HeaderTabs pathname="/about" />
      </nav>,
    );

    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("links every desktop destination", () => {
    render(
      <nav aria-label="Primary">
        <HeaderTabs pathname="/" />
      </nav>,
    );

    for (const item of DESKTOP_NAV) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });
});

describe("MobileTabBar", () => {
  it("has five links, each with an accessible name", () => {
    render(<MobileTabBar pathname="/" />);

    const nav = screen.getByRole("navigation", { name: "Mobile" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(5);

    const expected = MOBILE_TABS.map((tab) => tab.label);
    expect(links.map((link) => link.textContent?.trim())).toEqual(expected);
    for (const link of links) expect(link).toHaveAccessibleName();
  });

  it("renders exactly five cells and no accessibility trigger", () => {
    render(<MobileTabBar pathname="/" />);

    const nav = screen.getByRole("navigation", { name: "Mobile" });

    expect(nav.querySelectorAll("li")).toHaveLength(5);
    // The dock carries destinations only: the accessibility settings button is in the header.
    expect(
      within(nav).queryByRole("button", { name: "Accessibility settings" }),
    ).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: /settings/i })).not.toBeInTheDocument();
    expect(within(nav).queryAllByRole("button")).toHaveLength(0);
    expect(nav.querySelector("ul")?.className).toContain("grid-cols-5");
  });

  it("marks the Home tab current at the root", () => {
    render(<MobileTabBar pathname="/" />);

    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveAccessibleName("Home");
  });

  it("keeps Guides current on a nested guide page", () => {
    render(<MobileTabBar pathname="/guides/tickets" />);

    expect(screen.getByRole("link", { current: "page" })).toHaveAccessibleName("Guides");
  });

  it("marks nothing current when the pathname is unknown", () => {
    render(<MobileTabBar pathname={null} />);

    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });
});
