import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { TABBAR_TOTAL_HEIGHT_PX } from "./layout-metrics";
import { INDEPENDENCE_DISCLAIMER, SOURCE_CAVEAT, SiteFooter } from "./site-footer";

afterEach(cleanup);

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

describe("SiteFooter", () => {
  it("shows the independence disclaimer verbatim", () => {
    render(<SiteFooter />);

    expect(
      screen.getByText(
        "TMLGuide is an independent fan guide. It is not affiliated with, endorsed by or sponsored by Tomorrowland or WeAreOne.World B.V. Tomorrowland is a trademark of its respective owner.",
        { exact: true },
      ),
    ).toBeInTheDocument();
  });

  it("shows the source caveat verbatim", () => {
    render(<SiteFooter />);

    expect(
      screen.getByText(
        "Information is checked against official sources but can change. Always confirm with the official Tomorrowland website before you book.",
        { exact: true },
      ),
    ).toBeInTheDocument();
  });

  it("exposes the disclaimer and caveat constants used for rendering", () => {
    expect(INDEPENDENCE_DISCLAIMER).toContain("WeAreOne.World B.V.");
    expect(SOURCE_CAVEAT).toContain("official Tomorrowland website");
  });

  it("links the footer columns and legal row", () => {
    render(<SiteFooter />);

    const footerNav = screen.getByRole("navigation", { name: "Footer" });
    const columnHrefs = within(footerNav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(columnHrefs).toEqual([
      "/guides",
      "/guides/tickets",
      "/tools",
      "/community",
      "/radio",
      "/about",
      "/contact",
    ]);

    for (const [label, href] of [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Accessibility", "/accessibility"],
      ["Cookies", "/cookies"],
    ] as const) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });

  it("has a logo image and a link home", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "TMLGuide home" })).toHaveAttribute("href", "/");

    // The link carries the accessible name, so the logo itself is decorative.
    const images = document.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("alt", "");
    expect(images[0]).toHaveAttribute("src", "/brand/logo-640.webp");
  });

  it("reserves the tab bar's full height on phones so nothing is hidden", () => {
    const { container } = render(<SiteFooter />);

    const spacer = container.querySelector<HTMLElement>('footer > div[aria-hidden="true"]');
    expect(spacer).not.toBeNull();
    expect(spacer).toHaveClass("min-[900px]:hidden");

    // The bar's content plus its hairline border plus the device inset: the bar occupies all
    // three, so anything less leaves the last footer line behind it.
    expect(spacer?.style.height).toBe(
      `calc(${TABBAR_TOTAL_HEIGHT_PX}px + env(safe-area-inset-bottom))`,
    );
  });
});
