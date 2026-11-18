import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/tickets/edition-sync", () => ({
  EditionSync: () => null,
}));

const { EditionContent } = await import("@/app/guides/tickets/page");

afterEach(cleanup);

/**
 * The URL-dependent region, resolved the way the server resolves it.
 *
 * `EditionContent` is the async component the page streams behind its Suspense
 * boundary. Awaiting it here gives the element the server would render, so these
 * assertions cover the real content for a real URL rather than a mocked prop.
 */
async function renderContent(
  searchParams: Record<string, string> = {},
): Promise<ReturnType<typeof render>> {
  const element = (await EditionContent({
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement;
  return render(element);
}

describe("edition selection from the URL", () => {
  it("defaults to Belgium with no parameter", async () => {
    await renderContent();

    expect(screen.getByText(/Belgium 2027:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Belgium" })).toHaveAttribute("aria-current", "page");
  });

  it("reads Winter from the query string", async () => {
    await renderContent({ edition: "winter" });

    expect(screen.getByRole("heading", { name: "Winter 2027 sale dates" })).toBeInTheDocument();
  });

  it("reads Brasil from the query string", async () => {
    await renderContent({ edition: "brasil" });

    expect(screen.getByRole("heading", { name: "Brasil 2027 sale dates" })).toBeInTheDocument();
  });

  it("falls back to Belgium for an unknown edition rather than erroring", async () => {
    await renderContent({ edition: "thailand" });

    expect(screen.getByText(/Belgium 2027:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Belgium" })).toHaveAttribute("aria-current", "page");
  });

  it("ignores a repeated edition parameter beyond the first value", async () => {
    await renderContent({ edition: "brasil" });

    expect(screen.getByRole("link", { name: "Brasil" })).toHaveAttribute("aria-current", "page");
  });

  it("renders the same content for the same URL, with no dependence on storage", async () => {
    const first = await renderContent({ edition: "winter" });
    const firstText = first.container.textContent ?? "";
    cleanup();

    const second = await renderContent({ edition: "winter" });
    expect(second.container.textContent).toBe(firstText);
  });
});

describe("edition tabs", () => {
  it("offers a link per edition inside a labelled navigation landmark", async () => {
    await renderContent();

    const nav = screen.getByRole("navigation", { name: "Edition" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Belgium", "Winter", "Brasil"]);
  });

  it("keeps Belgium at the bare URL and gives the others their own address", async () => {
    await renderContent();

    expect(screen.getByRole("link", { name: "Belgium" })).toHaveAttribute("href", "/guides/tickets");
    expect(screen.getByRole("link", { name: "Winter" })).toHaveAttribute(
      "href",
      "/guides/tickets?edition=winter",
    );
    expect(screen.getByRole("link", { name: "Brasil" })).toHaveAttribute(
      "href",
      "/guides/tickets?edition=brasil",
    );
  });

  it("marks the current edition with aria-current, not only a colour", async () => {
    await renderContent({ edition: "winter" });

    expect(screen.getByRole("link", { name: "Winter" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Belgium" })).not.toHaveAttribute("aria-current");
  });
});

describe("page sections", () => {
  it("states the edition and its checked date in the lede", async () => {
    const { container } = await renderContent();

    // The lede is several inline fragments, so assert on the whole line's text.
    const lede = container.querySelector(".tml-tix-lede");
    expect(lede?.textContent).toMatch(/Belgium 2027:/);
    expect(lede?.textContent).toMatch(/18 Nov 2026/);
  });

  it("introduces how sales work", async () => {
    await renderContent();

    expect(
      screen.getByRole("heading", { name: "How Tomorrowland ticket sales work" }),
    ).toBeInTheDocument();
    expect(screen.getByText("The Exchange Desk is the only resale route")).toBeInTheDocument();
  });

  it("shows the sale timeline with published local times", async () => {
    await renderContent();

    expect(screen.getByRole("heading", { name: "Belgium 2027 sale dates" })).toBeInTheDocument();
    expect(screen.getByText("Sat 30 Jan 2027, 17:00 CET")).toBeInTheDocument();
  });

  it("shows the catalogue under its own heading", async () => {
    await renderContent();

    expect(screen.getByRole("heading", { name: "Tickets and packages" })).toBeInTheDocument();
  });

  it("shows the independence disclaimer above the catalogue", async () => {
    await renderContent();

    expect(
      screen.getByText(/not affiliated with, endorsed by or sponsored by Tomorrowland/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the figure the official site listed on the date shown beside it/),
    ).toBeInTheDocument();
  });

  it("links the official pages of the selected edition only", async () => {
    await renderContent({ edition: "brasil" });

    expect(screen.getByRole("link", { name: /All Brasil tickets/ })).toHaveAttribute(
      "href",
      "https://brasil.tomorrowland.com/en/tickets/",
    );
    expect(screen.queryByRole("link", { name: /Exchange Desk/ })).toBeNull();
  });

  it("opens every official link in a new tab without leaking the opener", async () => {
    await renderContent();

    const official = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("https://"));
    expect(official.length).toBeGreaterThan(0);
    for (const link of official) {
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("keeps internal edition links in the same tab", async () => {
    await renderContent();

    const internal = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/"));
    expect(internal.length).toBeGreaterThan(0);
    for (const link of internal) expect(link).not.toHaveAttribute("target");
  });
});

describe("deep links", () => {
  it("renders a category view directly from the URL", async () => {
    await renderContent({ category: "montagoe" });

    expect(screen.getByRole("heading", { level: 2, name: "Montagoe lodges" })).toBeInTheDocument();
  });

  it("renders a package view directly from the URL", async () => {
    await renderContent({ category: "montagoe", package: "belgium-2027-luna-2p" });

    expect(screen.getByRole("heading", { level: 2, name: "Luna 2P" })).toBeInTheDocument();
  });

  it("renders a package view for another edition", async () => {
    await renderContent({ edition: "brasil", category: "dreamville", package: "easy-tent-2p" });

    expect(screen.getByRole("heading", { level: 2, name: "Easy Tent 2P" })).toBeInTheDocument();
  });

  it("falls back to the category list for an unknown package", async () => {
    await renderContent({ category: "montagoe", package: "not-a-package" });

    expect(screen.getByRole("heading", { level: 2, name: "Montagoe lodges" })).toBeInTheDocument();
  });

  it("falls back to the category grid for an unknown category", async () => {
    const { container } = await renderContent({ category: "not-a-category" });

    // The grid lists every category; an unknown id must not blank the page.
    expect(container.querySelectorAll(".tml-tix-cat").length).toBeGreaterThan(1);
    expect(screen.getByText("DreamVille camping")).toBeInTheDocument();
  });
});
