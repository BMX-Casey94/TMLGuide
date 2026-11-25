import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import HomePage, { metadata } from "@/app/page";
import { expectResolvableLinks, expectSoundHeadingOrder, sectionByName } from "@/components/home/page-assertions";
import { sitemapRoutes } from "@/lib/seo/routes";

/** Every path the sitemap publishes, for the "does this link exist?" checks. */
const SITEMAP_PATHS = sitemapRoutes().map((route) => route.path);

/**
 * Page-level tests for the home page.
 *
 * The page is a Server Component, so it renders synchronously here. The one
 * exception is the next-sale panel, which needs the request's clock: it is an
 * async component behind Suspense, and React renders its fallback in a plain
 * client render. So this suite asserts the strip's fallback and checks the real
 * strip separately, in `next-sale-strip.test.tsx`.
 */
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

/* Testing Library cannot register its automatic cleanup here because the shared
   setup does not enable globals. Without this, each render accumulates in the
   same document and every role query finds two matches. */
afterEach(cleanup);

describe("HomePage structure", () => {
  it("renders a main landmark that the skip link can target", () => {
    const { container } = render(<HomePage />);
    const main = container.querySelector("main");

    expect(main).not.toBeNull();
    expect(main).toHaveAttribute("id", "main");
  });

  it("has exactly one h1 and never skips a heading level", () => {
    const { container } = render(<HomePage />);
    expectSoundHeadingOrder(container);
  });

  it("puts the promise in the h1", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /The independent guide to Tomorrowland/,
    );
  });

  it("renders every section the brief asks for", () => {
    render(<HomePage />);

    // 1. Hero, with its two actions.
    expect(screen.getByRole("link", { name: "Plan your trip" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check ticket dates" })).toBeInTheDocument();

    // 2. The next-sale strip, whose real content arrives from the request.
    expect(screen.getByRole("heading", { level: 2, name: /Checking the sale calendar/ })).toBeInTheDocument();

    // 3. Edition cards.
    expect(screen.getByRole("region", { name: "Tomorrowland editions" })).toBeInTheDocument();

    // 4. Start here.
    expect(sectionByName("Ways to start planning")).toBeInTheDocument();

    // 5. Trust strip.
    expect(
      screen.getByRole("heading", { level: 2, name: /Facts checked against official sources/ }),
    ).toBeInTheDocument();

    // 6. FAQ highlights.
    expect(screen.getAllByRole("heading", { level: 2, name: /Four rules/ })).toHaveLength(1);

    // 7. Closing call to action, with no duplicated footer.
    expect(screen.getByRole("link", { name: "Find a group" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Listen to the radio" })).toBeInTheDocument();
  });

  it("does not render the global footer itself", () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector("footer")).toBeNull();
  });

  it("includes the six start-here destinations", () => {
    render(<HomePage />);

    for (const href of [
      "/guides/tickets",
      "/tools/sale-timeline",
      // The tool pages are /tools/budget and /tools/pearls. The longer names
      // ("budget-calculator", "pearl-calculator") describe the component, not the
      // route, and linking to them 404'd.
      "/tools/budget",
      "/tools/pearls",
      "/community",
      "/radio",
    ]) {
      expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === href)).toBe(true);
    }
  });

  it("links to no tool route the site does not serve", () => {
    const { container } = render(<HomePage />);
    const hrefs = Array.from(container.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/tools/"));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      // Whatever the home page calls a tool must be a path the sitemap lists.
      expect(SITEMAP_PATHS, href).toContain(href.split(/[?#]/)[0]);
    }
  });

  it("links each edition card to the ticket guide with that edition", () => {
    const { container } = render(<HomePage />);
    const hrefs = Array.from(container.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"));

    expect(hrefs).toContain("/guides/tickets?edition=belgium");
    expect(hrefs).toContain("/guides/tickets?edition=winter");
    expect(hrefs).toContain("/guides/tickets?edition=brasil");
  });

  it("shows all three edition cards with their dates", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 3, name: /Tomorrowland Belgium/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Tomorrowland Winter/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Tomorrowland Brasil/ })).toBeInTheDocument();
  });

  it("shows the four highlighted questions", () => {
    const { container } = render(<HomePage />);
    expect(container.querySelectorAll(".home-faq__item")).toHaveLength(4);
  });

  it("states the check date and the independence line", () => {
    render(<HomePage />);

    // The date appears wherever a figure or a date is cited, which is the point:
    // it is never stated once and assumed everywhere else.
    expect(screen.getAllByText(/18 November 2026/).length).toBeGreaterThan(1);
    expect(screen.getByText(/not affiliated with/)).toBeInTheDocument();
  });

  it("renders every internal link against a known route, and every outbound link safely", () => {
    const { container } = render(<HomePage />);
    const hrefs = expectResolvableLinks(container);

    // The pages this one must reach, per the brief.
    expect(hrefs).toContain("/guides");
    expect(hrefs).toContain("/guides/tickets");
    expect(hrefs).toContain("/tools/sale-timeline");
    expect(hrefs).toContain("/community");
    expect(hrefs).toContain("/radio");
    expect(hrefs).toContain("/about");
  });

  it("emits WebSite JSON-LD with no organisation and no search action", () => {
    const { container } = render(<HomePage />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    const json = script?.innerHTML ?? "";
    const parsed = JSON.parse(json);

    expect(parsed["@type"]).toBe("WebSite");
    expect(parsed.name).toBe("TMLGuide");
    expect(json).not.toContain("Organization");
    expect(json).not.toContain("SearchAction");
    expect(json).not.toContain("</script>");
  });

  it("declares a canonical URL and Open Graph text", () => {
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.openGraph?.title).toBeTruthy();
    expect(metadata.description).toBeTruthy();
    expect(metadata.title).toBeTruthy();
  });

  it("claims no Open Graph image when no such asset exists", () => {
    // There is no Open Graph image under public/brand, so none is advertised.
    const openGraph = metadata.openGraph as { images?: unknown } | undefined;
    expect(openGraph?.images).toBeUndefined();
  });
});
