import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { guideChapterSchema, type GuideChapter } from "@/content/schema";
import { winterChapters } from "@/content/winter";
import { winterShuttles, winterStages } from "@/data/winter";
import { ChapterBlocks, GuideBlockView, sourceNumbers, tableOfContents } from "./blocks";

afterEach(cleanup);

/**
 * A chapter that uses every block type at least once, parsed through the real
 * schema so the fixture cannot drift from the content model.
 */
const FIXTURE: GuideChapter = guideChapterSchema.parse({
  edition: "belgium",
  slug: "every-block",
  order: 1,
  title: "Every block type",
  summary:
    "A fixture chapter that exercises each block in the renderer, written for the component tests only.",
  lastVerified: "2026-11-18",
  related: [],
  sources: [
    {
      id: "s1",
      title: "First official page",
      url: "https://belgium.tomorrowland.com/en/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "Second official page",
      url: "https://belgium.tomorrowland.com/en/tickets/",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    { type: "h2", id: "opening", text: "Opening section" },
    { type: "p", text: "A paragraph with **bold** and a [link](/guides).", sources: ["s1"] },
    { type: "h3", id: "detail", text: "A detail" },
    { type: "ul", items: ["First item", "Second *item*"], sources: ["s1", "s2"] },
    { type: "ol", items: ["Step one", "Step two"], sources: ["s2"] },
    {
      type: "callout",
      tone: "warning",
      title: "A warning title",
      text: "A warning that changes a decision.",
      sources: ["s2"],
    },
    {
      type: "facts",
      caption: "A fact caption",
      rows: [{ label: "A label", value: "A value", sources: ["s1"] }],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "tickets",
      idPrefix: "belgium-2027-day-pass",
      caption: "Day pass prices",
    },
  ],
});

describe("table of contents", () => {
  it("collects h2 and h3 blocks in document order with their own ids", () => {
    const entries = tableOfContents(FIXTURE);

    expect(entries).toEqual([
      { id: "opening", text: "Opening section", level: 2 },
      { id: "detail", text: "A detail", level: 3 },
    ]);
  });

  it("returns nothing for a chapter with no headings", () => {
    // The schema insists on an h2, so this fixture bypasses the parse: the point
    // is that the extractor copes with a heading-free block list.
    const blocks: GuideChapter["blocks"] = [
      { type: "p", text: "Only a paragraph.", sources: ["s1"] },
      { type: "p", text: "And another.", sources: ["s1"] },
      { type: "p", text: "A third.", sources: ["s1"] },
    ];

    expect(tableOfContents({ blocks })).toEqual([]);
  });
});

describe("source markers", () => {
  it("maps a reference to the position of the source in the chapter", () => {
    const numbers = sourceNumbers(FIXTURE, ["s2", "s1"]);
    expect(numbers.map((entry) => entry.number)).toEqual([2, 1]);
  });

  it("drops a reference the chapter does not declare rather than inventing a number", () => {
    expect(sourceNumbers(FIXTURE, ["s9"])).toEqual([]);
  });

  it("renders a marker as a link to the source list with an accessible name", () => {
    render(<ChapterBlocks chapter={FIXTURE} />);

    const markers = screen.getAllByRole("link", { name: "Source 1" });
    expect(markers.length).toBeGreaterThan(0);
    expect(markers[0]).toHaveAttribute("href", "#source-every-block-1");
  });
});

describe("block rendering", () => {
  it("renders a paragraph, a list and an ordered list with their items", () => {
    const { container } = render(<ChapterBlocks chapter={FIXTURE} />);

    expect(screen.getByText(/A paragraph with/)).toBeInTheDocument();

    const unordered = container.querySelector("ul.tml-guide-list");
    expect(unordered).not.toBeNull();
    expect(within(unordered as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
    expect(within(unordered as HTMLElement).getByText(/First item/)).toBeInTheDocument();
    // Italic inside a list item is parsed, not printed as asterisks.
    expect((unordered as HTMLElement).querySelector("em")?.textContent).toBe("item");

    const ordered = container.querySelector("ol.tml-guide-list");
    expect(ordered).not.toBeNull();
    expect(within(ordered as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders headings with the ids the table of contents links to", () => {
    const { container } = render(<ChapterBlocks chapter={FIXTURE} />);

    expect(container.querySelector("h2#opening")).toHaveTextContent("Opening section");
    expect(container.querySelector("h3#detail")).toHaveTextContent("A detail");
  });

  it("renders a callout with its tone as a non-colour label", () => {
    render(<ChapterBlocks chapter={FIXTURE} />);

    const callout = screen.getByRole("note", { name: "Warning: A warning title" });
    expect(callout).toBeInTheDocument();
    // The tone is in the visible text, so it never depends on the border colour.
    expect(within(callout).getByText("Warning")).toBeInTheDocument();
    expect(within(callout).getByText("A warning title")).toBeInTheDocument();
  });

  it("renders each callout tone with its own label", () => {
    for (const tone of ["note", "tip"] as const) {
      const chapter = guideChapterSchema.parse({
        ...FIXTURE,
        blocks: [
          { type: "h2", id: "tone", text: "Tone" },
          { type: "callout", tone, title: "A tone title", text: "Body.", sources: ["s1"] },
          { type: "p", text: "Closing.", sources: ["s1"] },
        ],
      });
      render(<ChapterBlocks chapter={chapter} />);
      const label = tone === "note" ? "Note" : "Tip";
      expect(screen.getByRole("note", { name: `${label}: A tone title` })).toBeInTheDocument();
      cleanup();
    }
  });

  it("keeps callouts out of the landmark list, because a chapter has several", () => {
    const { container } = render(<ChapterBlocks chapter={FIXTURE} />);

    // `aside` would be a `complementary` landmark; role="note" is not one.
    expect(screen.queryAllByRole("complementary")).toHaveLength(0);
    expect(container.querySelectorAll('aside[role="note"]').length).toBeGreaterThan(0);
  });

  it("renders facts as a real table with a caption, header cells and row headers", () => {
    const { container } = render(<ChapterBlocks chapter={FIXTURE} />);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(within(table as HTMLElement).getByText("A fact caption").tagName).toBe("CAPTION");
    expect(within(table as HTMLElement).getByRole("columnheader", { name: "Detail" })).toBeInTheDocument();
    expect(within(table as HTMLElement).getByRole("rowheader", { name: "A label" })).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText("A value")).toBeInTheDocument();
  });

  it("renders a data block from the real verified records", () => {
    const { container } = render(<ChapterBlocks chapter={FIXTURE} />);

    const captions = container.querySelectorAll("caption");
    const prices = Array.from(captions).find((caption) => caption.textContent === "Day pass prices");
    expect(prices).toBeDefined();

    const table = prices?.closest("table");
    expect(table).not.toBeNull();
    // The Belgium 2027 day pass records are filtered in by their id prefix.
    expect(
      within(table as HTMLElement).getByRole("rowheader", {
        name: "Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale",
      }),
    ).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText("€144.00 (2027)")).toBeInTheDocument();
    // Every row links the official page it came from.
    const links = within(table as HTMLElement).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders every block type without an unhandled case", () => {
    // One render per block, so a missing branch fails with the block named.
    FIXTURE.blocks.forEach((block, index) => {
      expect(() =>
        render(<GuideBlockView chapter={FIXTURE} block={block} index={index} />),
      ).not.toThrow();
      cleanup();
    });
  });

  it("never turns an HTML tag in the content into an element", () => {
    const chapter = guideChapterSchema.parse({
      ...FIXTURE,
      blocks: [
        { type: "h2", id: "hostile", text: "Hostile input" },
        { type: "p", text: '<img src=x onerror="alert(1)">', sources: ["s1"] },
        { type: "p", text: "Closing paragraph.", sources: ["s1"] },
      ],
    });

    const { container } = render(<ChapterBlocks chapter={chapter} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});

describe("the live Winter chapters through the block renderer", () => {
  /* The chapter tests check the content; the data-block tests check the table.
     This renders the two real chapters that use the new collections, so a block
     that parses but cannot render is caught here rather than in the browser. */
  const chapter = (slug: string): GuideChapter => {
    const found = winterChapters.find((entry) => entry.slug === slug);
    if (found === undefined) throw new Error(`no winter chapter ${slug}`);
    return found;
  };

  it("renders the stage roster from the stage records, not from typed facts", () => {
    const { container } = render(<ChapterBlocks chapter={chapter("stages-and-hours")} />);

    const captions = Array.from(container.querySelectorAll("caption"));
    const stages = captions.find((caption) => /seven stages named for Winter 2027/.test(caption.textContent ?? ""));
    expect(stages).toBeDefined();

    const table = stages?.closest("table");
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(winterStages.length);
    for (const stage of winterStages) {
      expect(within(table as HTMLElement).getByRole("rowheader", { name: stage.name })).toBeInTheDocument();
    }
  });

  it("renders every shuttle fare with its operator note in the price cell", () => {
    const { container } = render(<ChapterBlocks chapter={chapter("transport")} />);

    const noteFor = (record: (typeof winterShuttles)[number]): void => {
      const note = within(container).getByText(record.notes);
      const cell = note.closest("td");
      expect(cell, `notes for ${record.id}`).not.toBeNull();
      expect(cell).toHaveTextContent("€");
    };

    for (const record of winterShuttles) noteFor(record);

    const altibus = winterShuttles.find((record) => record.id === "altibus-geneva-return");
    if (altibus === undefined) throw new Error("the Altibus Geneva record is missing");
    const genevaCell = within(container).getByText(altibus.notes).closest("td");
    expect(genevaCell).toHaveTextContent("ne circulera pas pendant la saison d'hiver 2025/2026");
  });
});
