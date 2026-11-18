import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* The page mounts a component that writes the edition into the shell's context,
   and that provider belongs to another workstream. The sync itself has its own
   test; here it would only add an unrelated dependency. */
vi.mock("@/components/tickets/edition-sync", () => ({
  EditionSync: () => null,
}));

/**
 * The page is a Server Component that awaits `searchParams`, so its body cannot be
 * rendered by a DOM test directly. What is tested here is the static shell, which
 * renders on the server and needs no request, plus metadata. The URL-dependent
 * region has its own suite in `edition-content.test.tsx`, where the resolved
 * element can be rendered.
 */
const pageModule = await import("@/app/guides/tickets/page");
const TicketsPage = pageModule.default;
const metadata = pageModule.metadata;

afterEach(cleanup);

describe("page metadata", () => {
  it("uses the requested title", () => {
    expect(metadata.title).toBe("Tickets and packages");
  });

  it("describes what the page covers", () => {
    expect(metadata.description).toMatch(/ticket and package prices/i);
    expect(metadata.description).toMatch(/Belgium, Winter and Brasil/);
  });

  it("declares one canonical address, without an edition parameter", () => {
    // Every edition shares one crawlable address: the edition is a query, not a
    // separate route, so there is nothing to canonicalise per edition.
    expect(metadata.alternates?.canonical).toBe("/guides/tickets");
  });

  it("sets an Open Graph title and description", () => {
    expect(metadata.openGraph).toMatchObject({
      title: "Tickets and packages",
      type: "article",
      url: "/guides/tickets",
    });
  });
});

describe("static shell", () => {
  /** The shell does not await anything, so it renders as a plain element. */
  function renderShell() {
    return render(TicketsPage({ searchParams: Promise.resolve({}) }));
  }

  it("renders a single main landmark with the skip-link target", () => {
    renderShell();

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("has exactly one h1 carrying the page title", () => {
    renderShell();

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Tickets and packages");
  });

  it("explains that nothing is estimated and points to the official page", () => {
    renderShell();

    expect(screen.getByText(/Nothing here is estimated/)).toBeInTheDocument();
    expect(screen.getByText(/where Tomorrowland publishes no price, the page says so/)).toBeInTheDocument();
  });

  it("closes with the currency note and the Exchange Desk warning", () => {
    renderShell();

    expect(screen.getByText(/No figure is converted between currencies/)).toBeInTheDocument();
    expect(
      screen.getByText(/The Exchange Desk is the only official resale route/),
    ).toBeInTheDocument();
  });

  it("includes only the breadcrumb structured data", () => {
    const { container } = renderShell();

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);

    const payload = JSON.parse(scripts[0].innerHTML) as {
      "@type": string;
      itemListElement: { position: number; name: string }[];
    };
    expect(payload["@type"]).toBe("BreadcrumbList");
    expect(payload.itemListElement.map((entry) => entry.name)).toEqual([
      "Home",
      "Tickets and packages",
    ]);
    expect(payload.itemListElement.map((entry) => entry.position)).toEqual([1, 2]);
  });

  it("publishes no Product or Offer markup, because a price can go stale", () => {
    const { container } = renderShell();

    const text = container.innerHTML;
    expect(text).not.toContain('"@type":"Product"');
    expect(text).not.toContain('"@type":"Offer"');
    expect(text).not.toContain('"price"');
  });

  it("escapes the JSON-LD so it cannot close its own script tag", () => {
    const { container } = renderShell();

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.innerHTML).not.toContain("</script");
  });

  it("reserves space for the catalogue instead of collapsing on load", () => {
    const { container } = renderShell();

    const pending = container.querySelector(".tml-tix-pending");
    expect(pending).not.toBeNull();
    // The placeholder is inert: a screen reader hears nothing rather than boxes.
    expect(pending).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the shell free of edition-specific claims", () => {
    // The edition comes from the URL, so the static shell must not name one.
    const { container } = renderShell();
    const hero = container.querySelector(".tml-tix-hero");
    expect(hero?.textContent).not.toMatch(/Belgium 2027|Winter 2027|Brasil 2027/);
  });

  it("never reads or writes storage, so a URL alone decides the edition", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const first = renderShell().container.innerHTML;

    expect(first).toContain('id="main"');
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("puts the disclaimer into the region that depends on the URL, not the shell", () => {
    const { container } = renderShell();

    // It sits after the catalogue, so it streams with that region.
    expect(within(container).queryByText(/not affiliated with/)).toBeNull();
  });
});
