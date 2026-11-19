import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guideChapterSchema, type GuideChapter } from "@/content/schema";
import { ChapterHeader, ChapterPager, IndependenceNote, RelatedChapters, SourcesList } from "./chapter-parts";
import { Breadcrumbs, chapterCrumbs, editionCrumbs } from "./breadcrumbs";

afterEach(cleanup);

function fixture(overrides: Partial<GuideChapter> = {}): GuideChapter {
  return guideChapterSchema.parse({
    edition: "belgium",
    slug: "overview",
    order: 2,
    title: "An overview chapter",
    summary:
      "A fixture summary that is comfortably long enough for the schema, used by the component tests.",
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
        checkedOn: "2026-11-17",
      },
    ],
    blocks: [
      { type: "h2", id: "topic", text: "Topic" },
      { type: "p", text: "Body text.", sources: ["s1"] },
      { type: "p", text: "More body text.", sources: ["s1"] },
    ],
    ...overrides,
  });
}

describe("breadcrumbs", () => {
  it("renders an ordered list inside a labelled navigation landmark", () => {
    render(<Breadcrumbs crumbs={chapterCrumbs("belgium", "An overview chapter")} />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const list = within(nav).getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("links the ancestors and marks the current page with aria-current", () => {
    render(<Breadcrumbs crumbs={chapterCrumbs("belgium", "An overview chapter")} />);

    expect(screen.getByRole("link", { name: "Guides" })).toHaveAttribute("href", "/guides");
    expect(screen.getByRole("link", { name: "Belgium" })).toHaveAttribute("href", "/guides/belgium");

    const current = screen.getByText("An overview chapter");
    expect(current).toHaveAttribute("aria-current", "page");
    // The current page is not a link to itself.
    expect(within(current).queryByRole("link")).toBeNull();
    expect(screen.queryByRole("link", { name: "An overview chapter" })).toBeNull();
  });

  it("builds the edition crumbs with the edition's own path", () => {
    const crumbs = editionCrumbs("winter");
    expect(crumbs).toEqual([
      { href: "/guides", label: "Guides" },
      { href: "/guides/winter", label: "Winter" },
    ]);
  });

  it("labels the general edition as Good to know", () => {
    expect(editionCrumbs("general")[1]?.label).toBe("Good to know");
  });
});

describe("chapter header", () => {
  it("renders the edition, the title, the summary and the check date as a time element", () => {
    render(<ChapterHeader chapter={fixture()} titleId="chapter-title" />);

    expect(screen.getByText("Belgium · Guide chapter")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 1, name: "An overview chapter" });
    expect(heading).toHaveAttribute("id", "chapter-title");
    expect(screen.getByText(/A fixture summary/)).toBeInTheDocument();

    // The header spells the month out in full.
    const time = screen.getByText("18 November 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-11-18");
  });

  it("states how many sources the chapter cites", () => {
    render(<ChapterHeader chapter={fixture()} />);
    expect(screen.getByText("2 sources cited")).toBeInTheDocument();
  });
});

describe("sources list", () => {
  it("lists every source with a number, a title, a host and a check date", () => {
    render(<SourcesList chapter={fixture()} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const first = within(items[0] as HTMLElement).getByRole("link");
    expect(first).toHaveAttribute("href", "https://belgium.tomorrowland.com/en/");
    expect(first).toHaveAccessibleName(/Source 1: Tomorrowland Belgium/);
    expect(first).toHaveAttribute("rel", "noopener noreferrer");
    expect(first).toHaveAttribute("target", "_blank");

    expect(within(items[0] as HTMLElement).getByText("belgium.tomorrowland.com")).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByText("18 Nov 2026")).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText("17 Nov 2026")).toBeInTheDocument();
  });

  it("gives each source an anchor id that the markers in the text point at", () => {
    const { container } = render(<SourcesList chapter={fixture()} />);

    expect(container.querySelector("#source-overview-1")).not.toBeNull();
    expect(container.querySelector("#source-overview-2")).not.toBeNull();
  });

  it("numbers the sources in the order the chapter declares them", () => {
    render(<SourcesList chapter={fixture()} />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("[1]");
    expect(items[1]).toHaveTextContent("[2]");
  });
});

describe("previous and next", () => {
  const previous = fixture({ slug: "first", order: 1, title: "The first chapter" });
  const next = fixture({ slug: "third", order: 3, title: "The third chapter" });

  it("links the previous and next chapters by their own paths", () => {
    render(<ChapterPager previous={previous} next={next} />);

    const nav = screen.getByRole("navigation", { name: "Chapters in this edition" });
    expect(within(nav).getByRole("link", { name: /Previous chapter.*The first chapter/ })).toHaveAttribute(
      "href",
      "/guides/belgium/first",
    );
    expect(within(nav).getByRole("link", { name: /Next chapter.*The third chapter/ })).toHaveAttribute(
      "href",
      "/guides/belgium/third",
    );
  });

  it("shows only the next link on the first chapter", () => {
    render(<ChapterPager previous={null} next={next} />);

    expect(screen.queryByText(/Previous chapter/)).toBeNull();
    expect(screen.getByText(/Next chapter/)).toBeInTheDocument();
  });

  it("shows only the previous link on the last chapter", () => {
    render(<ChapterPager previous={previous} next={null} />);

    expect(screen.getByText(/Previous chapter/)).toBeInTheDocument();
    expect(screen.queryByText(/Next chapter/)).toBeNull();
  });

  it("renders nothing for a lone chapter", () => {
    const { container } = render(<ChapterPager previous={null} next={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("related chapters", () => {
  it("names the edition of each related chapter", () => {
    render(
      <RelatedChapters
        chapters={[
          fixture({ edition: "general", slug: "pearls", title: "Pearls and spending" }),
          fixture({ edition: "winter", slug: "transport", title: "Getting up the mountain" }),
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Related chapters" })).toBeInTheDocument();
    const pearls = screen.getByRole("link", { name: /Good to know.*Pearls and spending/ });
    expect(pearls).toHaveAttribute("href", "/guides/general/pearls");
    expect(
      screen.getByRole("link", { name: /Winter.*Getting up the mountain/ }),
    ).toHaveAttribute("href", "/guides/winter/transport");
  });

  it("renders nothing when there are no related chapters", () => {
    const { container } = render(<RelatedChapters chapters={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("independence note", () => {
  it("says the site is independent and links the About page", () => {
    render(<IndependenceNote />);

    expect(screen.getByText(/not affiliated with, endorsed by or sponsored by Tomorrowland/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "How the facts are checked" });
    expect(link).toHaveAttribute("href", "/about");
  });
});

/* The TOC is a client component with an effect; its markup is asserted here and its
   observer behaviour in its own file. */
describe("table of contents markup", () => {
  it("renders a labelled navigation landmark with one anchor per heading", async () => {
    vi.resetModules();
    const { TableOfContents } = await import("./table-of-contents");

    render(
      <TableOfContents
        chapterTitle="An overview chapter"
        entries={[
          { id: "first", text: "First heading", level: 2 },
          { id: "second", text: "Second heading", level: 3 },
        ]}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "On this page: An overview chapter" });
    const links = within(nav).getAllByRole("link");

    /*
      Two copies of the same list exist: the sticky rail from 1100px and the
      collapsed <details> below it. At any real viewport one of them is
      `display: none`, which removes it from the accessibility tree, so a reader
      only ever meets one. jsdom applies no stylesheet, so both appear here.
    */
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#first",
      "#second",
      "#first",
      "#second",
    ]);

    expect(nav.querySelector("details")).not.toBeNull();
    expect(nav.querySelector("details > summary")).toHaveTextContent("On this page");
    expect(within(nav).getAllByText("On this page")).toHaveLength(2);
  });

  it("renders nothing at all for a chapter with no headings", async () => {
    vi.resetModules();
    const { TableOfContents } = await import("./table-of-contents");

    const { container } = render(<TableOfContents chapterTitle="No headings" entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers a 44px target on every link and summary", async () => {
    vi.resetModules();
    const { TableOfContents } = await import("./table-of-contents");

    render(
      <TableOfContents chapterTitle="Targets" entries={[{ id: "only", text: "Only", level: 2 }]} />,
    );

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("tml-guide-toc__link");
    }
    for (const summary of screen.getAllByText("On this page")) {
      expect(summary.tagName === "SUMMARY" || summary.tagName === "P").toBe(true);
    }
  });
});
