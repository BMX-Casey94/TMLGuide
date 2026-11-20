import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guideChapterSchema, type GuideChapter } from "@/content/schema";
import { expectDividerCount, expectNoAdjacentRules } from "@/components/guides/divider-guard";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const chapterModule = await import("@/app/guides/[edition]/[chapter]/page");
const ChapterView = chapterModule.ChapterView;
const ChapterPage = chapterModule.default;
const generateMetadata = chapterModule.generateMetadata;
const generateStaticParams = chapterModule.generateStaticParams;
const resolveChapterPage = chapterModule.resolveChapterPage;

afterEach(cleanup);

function fixture(
  overrides: Partial<GuideChapter> & Pick<GuideChapter, "slug" | "order" | "title">,
): GuideChapter {
  return guideChapterSchema.parse({
    edition: "belgium",
    summary:
      "A fixture summary long enough for the schema, used by the chapter page tests in this file.",
    lastVerified: "2026-11-18",
    related: [],
    sources: [
      {
        id: "s1",
        title: "Tomorrowland Belgium — official site",
        url: "https://belgium.tomorrowland.com/en/",
        checkedOn: "2026-11-18",
      },
      {
        id: "s2",
        title: "How to order, 2027 sales",
        url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
        checkedOn: "2026-11-18",
      },
    ],
    blocks: [
      { type: "h2", id: "opening", text: "Opening section" },
      { type: "p", text: "A cited paragraph about the edition.", sources: ["s1"] },
      { type: "h3", id: "detail", text: "A detail" },
      { type: "ul", items: ["First rule", "Second rule"], sources: ["s2"] },
      { type: "p", text: "A closing paragraph.", sources: ["s1"] },
    ],
    ...overrides,
  });
}

const OVERVIEW = fixture({ slug: "overview", order: 1, title: "Overview" });
const DATES = fixture({
  slug: "dates-and-sales",
  order: 2,
  title: "Dates and sales",
  related: ["belgium/overview"],
});
const TRANSPORT = fixture({ slug: "transport", order: 3, title: "Getting there" });
const SIBLINGS = [OVERVIEW, DATES, TRANSPORT];

function renderChapter(chapter: GuideChapter, siblings = SIBLINGS, related: readonly GuideChapter[] = []) {
  return render(<ChapterView chapter={chapter} siblings={siblings} related={related} />);
}

describe("static params", () => {
  it("returns real chapters, or the placeholder pair while content is empty", () => {
    const params = generateStaticParams();

    expect(params.length).toBeGreaterThan(0);
    for (const param of params) {
      expect(typeof param.edition).toBe("string");
      expect(typeof param.chapter).toBe("string");
    }
  });
});

describe("metadata", () => {
  it("uses the chapter title, the summary as the description and its canonical path", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ edition: "belgium", chapter: "overview" }),
    });

    // The live content may be empty, so the assertion only runs for a real chapter.
    if (meta.title === "Chapter not found") return;
    expect(meta.alternates?.canonical).toMatch(/^\/guides\/(belgium|winter|brasil|general)\//);
    expect(meta.description).toBeTruthy();
  });

  it("returns a not-found title for an unknown chapter", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ edition: "belgium", chapter: "no-such-chapter" }),
    });

    expect(meta.title).toBe("Chapter not found");
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
  });

  it("returns a not-found title for an unknown edition", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ edition: "thailand", chapter: "overview" }),
    });

    expect(meta.title).toBe("Chapter not found");
  });
});

describe("not-found decisions", () => {
  it("resolves a real chapter and refuses everything else", () => {
    const live = generateStaticParams()[0];
    if (live === undefined) throw new Error("no chapter params");

    // Whatever the registry currently holds, the same pair resolves here…
    if (resolveChapterPage(live.edition, live.chapter) === null) {
      // …unless the only params are the placeholder, which must not resolve.
      expect(live.chapter).toBe("chapters-pending");
    }

    expect(resolveChapterPage("belgium", "no-such-chapter")).toBeNull();
    expect(resolveChapterPage("thailand", "overview")).toBeNull();
    expect(resolveChapterPage("belgium", "Overview")).toBeNull();
    expect(resolveChapterPage(undefined, undefined)).toBeNull();
  });

  it("answers the page with notFound() for a bad edition or chapter", async () => {
    await expect(
      ChapterPage({ params: Promise.resolve({ edition: "thailand", chapter: "overview" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    await expect(
      ChapterPage({ params: Promise.resolve({ edition: "belgium", chapter: "no-such-chapter" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("never renders the placeholder pair as a chapter", () => {
    expect(resolveChapterPage("general", "chapters-pending")).toBeNull();
  });
});

describe("the chapter header", () => {
  it("names the edition, the title, the summary and the check date", () => {
    const { container } = renderChapter(OVERVIEW);

    expect(screen.getByText("Belgium · Guide chapter")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/A fixture summary long enough/)).toBeInTheDocument();

    // The header's own line, not the per-source dates further down.
    const header = container.querySelector(".tml-guide-hero");
    const time = within(header as HTMLElement).getByText("18 November 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-11-18");
  });
});

describe("the breadcrumb", () => {
  it("shows Guides / Edition / Chapter with the last crumb marked current", () => {
    renderChapter(OVERVIEW);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const items = within(nav).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0] as HTMLElement).getByRole("link")).toHaveAttribute("href", "/guides");
    expect(within(items[1] as HTMLElement).getByRole("link")).toHaveAttribute(
      "href",
      "/guides/belgium",
    );
    expect(within(items[2] as HTMLElement).getByText("Overview")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("the table of contents", () => {
  it("lists the h2 and h3 headings and links their ids", () => {
    renderChapter(OVERVIEW);

    const nav = screen.getByRole("navigation", { name: "On this page: Overview" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#opening",
      "#detail",
      "#opening",
      "#detail",
    ]);
    expect(within(nav).getAllByText("On this page").length).toBeGreaterThan(0);
  });

  it("has a collapsible summary for narrow screens", () => {
    renderChapter(OVERVIEW);

    const details = screen
      .getByRole("navigation", { name: "On this page: Overview" })
      .querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.querySelector("summary")).toHaveTextContent("On this page");
  });

  it("puts the matching ids on the headings the body renders", () => {
    const { container } = renderChapter(OVERVIEW);

    expect(container.querySelector("h2#opening")).not.toBeNull();
    expect(container.querySelector("h3#detail")).not.toBeNull();
  });
});

describe("the body", () => {
  it("renders every block, including the lists", () => {
    const { container } = renderChapter(OVERVIEW);

    expect(screen.getByText(/A cited paragraph about the edition/)).toBeInTheDocument();
    const list = container.querySelector("ul.tml-guide-list");
    expect(within(list as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
  });

  it("puts a numbered source marker after each cited block", () => {
    renderChapter(OVERVIEW);

    const markers = screen.getAllByRole("link", { name: "Source 1" });
    expect(markers.length).toBeGreaterThan(0);
    expect(markers[0]).toHaveAttribute("href", "#source-overview-1");
    // The second source is cited by the list.
    expect(screen.getAllByRole("link", { name: "Source 2" }).length).toBeGreaterThan(0);
  });

  it("labels the article with the visible h1", () => {
    const { container } = renderChapter(OVERVIEW);

    const article = container.querySelector("article");
    expect(article).toHaveAttribute("aria-labelledby", "chapter-title");
    expect(container.querySelector("#chapter-title")?.textContent).toBe("Overview");
  });
});

describe("the source list", () => {
  it("lists every source with its number, title, host and check date", () => {
    renderChapter(OVERVIEW);

    const heading = screen.getByRole("heading", { level: 2, name: "Sources" });
    expect(heading).toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: /Source 1: Tomorrowland Belgium — official site/,
    });
    expect(link).toHaveAttribute("href", "https://belgium.tomorrowland.com/en/");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("gives the markers something to jump to", () => {
    const { container } = renderChapter(OVERVIEW);

    expect(container.querySelector("#source-overview-1")).not.toBeNull();
    expect(container.querySelector("#source-overview-2")).not.toBeNull();
  });
});

describe("previous and next ordering", () => {
  it("links the chapters either side by their order", () => {
    renderChapter(DATES);

    const nav = screen.getByRole("navigation", { name: "Chapters in this edition" });
    expect(within(nav).getByRole("link", { name: /Previous chapter.*Overview/ })).toHaveAttribute(
      "href",
      "/guides/belgium/overview",
    );
    expect(within(nav).getByRole("link", { name: /Next chapter.*Getting there/ })).toHaveAttribute(
      "href",
      "/guides/belgium/transport",
    );
  });

  it("gives the first chapter no previous link", () => {
    renderChapter(OVERVIEW);

    expect(screen.queryByText(/Previous chapter/)).toBeNull();
    expect(screen.getByText(/Next chapter/)).toBeInTheDocument();
  });

  it("gives the last chapter no next link", () => {
    renderChapter(TRANSPORT);

    expect(screen.getByText(/Previous chapter/)).toBeInTheDocument();
    expect(screen.queryByText(/Next chapter/)).toBeNull();
  });

  it("gives a lone chapter no pager at all", () => {
    renderChapter(OVERVIEW, [OVERVIEW]);

    expect(screen.queryByRole("navigation", { name: "Chapters in this edition" })).toBeNull();
  });

  it("orders by the array the registry gave, not by the order the props arrived", () => {
    renderChapter(DATES, [TRANSPORT, OVERVIEW, DATES]);

    const nav = screen.getByRole("navigation", { name: "Chapters in this edition" });
    // Order wins over array position: DATES (2) sits between OVERVIEW (1) and
    // TRANSPORT (3) even though the array lists TRANSPORT first.
    expect(within(nav).getByRole("link", { name: /Previous chapter/ })).toHaveTextContent("Overview");
    expect(within(nav).getByRole("link", { name: /Next chapter/ })).toHaveTextContent("Getting there");
  });
});

describe("related chapters", () => {
  it("renders the resolved related chapters under their own heading", () => {
    renderChapter(DATES, SIBLINGS, [OVERVIEW]);

    expect(screen.getByRole("heading", { level: 2, name: "Related chapters" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Belgium.*Overview/ })).toHaveAttribute(
      "href",
      "/guides/belgium/overview",
    );
  });

  it("omits the section entirely when nothing resolves", () => {
    renderChapter(OVERVIEW);

    expect(screen.queryByRole("heading", { name: "Related chapters" })).toBeNull();
  });
});

describe("the closing parts", () => {
  it("shows the independence note with a link to the About page", () => {
    renderChapter(OVERVIEW);

    expect(screen.getByText(/not affiliated with, endorsed by or sponsored by Tomorrowland/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How the facts are checked" })).toHaveAttribute(
      "href",
      "/about",
    );
  });

  it("links back to the edition hub with the chapter count", () => {
    renderChapter(OVERVIEW);

    expect(screen.getByRole("link", { name: "All 3 Belgium chapters" })).toHaveAttribute(
      "href",
      "/guides/belgium",
    );
  });
});

describe("structured data", () => {
  it("publishes a four-level breadcrumb and nothing else", () => {
    const { container } = renderChapter(OVERVIEW);

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);

    const payload = JSON.parse(scripts[0]?.innerHTML ?? "{}") as {
      "@type": string;
      itemListElement: { name: string; item: string; position: number }[];
    };
    expect(payload["@type"]).toBe("BreadcrumbList");
    expect(payload.itemListElement.map((entry) => entry.name)).toEqual([
      "Home",
      "Guides",
      "Tomorrowland Belgium",
      "Overview",
    ]);
    expect(payload.itemListElement.map((entry) => entry.position)).toEqual([1, 2, 3, 4]);
    expect(container.innerHTML).not.toContain('"@type":"Article"');
    expect(container.innerHTML).not.toContain('"@type":"Product"');
  });

  it("escapes a chapter title so it cannot close the script element", () => {
    const hostile = fixture({
      slug: "hostile",
      order: 1,
      title: "A title with </script> in it",
    });
    const { container } = renderChapter(hostile);

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.innerHTML).not.toContain("</script");
    expect(script?.innerHTML).toContain("\\u003c");
  });
});

describe("the page", () => {
  it("wraps the chapter in one main landmark with the skip-link target", async () => {
    const live = generateStaticParams()[0];
    if (live === undefined) throw new Error("no chapter params");

    let element;
    try {
      element = await ChapterPage({ params: Promise.resolve(live) });
    } catch {
      // The placeholder pair legitimately 404s; that path has its own assertion.
      return;
    }
    render(element);

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});

/*
  The chapter page has no GoldDivider at all. Its chrome is a run of bordered cards
  and hairline-separated lists: the hero ends on a rule, the source list is a table of
  hairline rows, the pager and the related links are bordered cards, and the closing
  note is a card. Adding a divider anywhere in that run would put it next to a border,
  which is the fault the brief forbids. These assertions guard both directions: no
  divider added, and no new top-level rule stacked on the chrome.
*/
describe("divider and page-frame conventions", () => {
  it("uses no GoldDivider, because every boundary is already a card edge or a hairline", () => {
    const { container } = renderChapter(DATES, SIBLINGS, [OVERVIEW]);
    expectDividerCount(container, 0);
  });

  it("never puts two rules side by side in the page flow", () => {
    const { container } = renderChapter(DATES, SIBLINGS, [OVERVIEW]);
    expectNoAdjacentRules(container);
  });

  it("gives the sources list no rule of its own, so it cannot double the block above it", () => {
    const { container } = renderChapter(DATES, SIBLINGS, [OVERVIEW]);
    const sources = container.querySelector(".tml-guide-sources");

    expect(sources).not.toBeNull();
    // The block above is a paragraph or a callout; a `border-t` on the sources block
    // would sit a few pixels under that edge.
    expect(sources?.className).not.toMatch(/border-t\b/);
  });

  it("gives the prev/next pager no rule of its own, because its links are bordered cards", () => {
    const { container } = renderChapter(DATES, SIBLINGS, [OVERVIEW]);
    const pager = container.querySelector(".tml-guide-pager");

    expect(pager).not.toBeNull();
    expect(pager?.className).not.toMatch(/border-t\b/);
    // Both neighbours exist here, so the pager is drawn and the cards are its break.
    expect(pager?.querySelectorAll(".tml-guide-pager__link")).toHaveLength(2);
  });

  it("keeps the hero's hairline as the only rule at the top of the chapter", () => {
    const { container } = renderChapter(DATES, SIBLINGS, [OVERVIEW]);
    const heros = container.querySelectorAll(".tml-guide-hero");

    expect(heros).toHaveLength(1);
    // The breadcrumb above it carries no border of its own.
    const crumbs = container.querySelector(".tml-guide-crumbs");
    expect(crumbs?.className).not.toMatch(/border-b\b/);
  });
});
