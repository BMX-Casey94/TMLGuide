// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sharedData } from "../../data/shared";
import { guideBlockSchema, guideChapterSchema, uncitedFactBlocks } from "../schema";
import { generalChapters } from "./index";

const VERIFIED_ON = "2026-11-18";

/** Every fact-check document a general or Brasil chapter source may cite. */
const LEDGER_FILES = [
  "docs/factcheck/brasil-general.md",
  "docs/factcheck/conflicts.md",
  "docs/factcheck/belgium.md",
];

const ledger = LEDGER_FILES.map((file) =>
  readFileSync(path.join(process.cwd(), file), "utf8"),
).join("\n");

/**
 * Chapter slugs that exist across every edition, taken from the wave 5 brief.
 * Chapters from other editions cannot be imported here because another agent
 * owns those folders, so their published slugs are listed instead.
 */
const CHAPTER_SLUGS: Record<string, readonly string[]> = {
  belgium: [
    "overview",
    "dates-and-sales",
    "tickets",
    "accommodation",
    "dreamville",
    "transport",
    "global-journey",
    "add-ons",
    "food-drinks",
    "faq",
  ],
  winter: [
    "overview",
    "tickets-and-packages",
    "accommodation",
    "transport",
    "stages-and-hours",
    "clothing-and-lockers",
    "lessons-and-gear",
    "add-ons",
  ],
  brasil: ["overview", "tickets", "dreamville", "transport"],
  general: ["pearls", "radio", "sets", "nft", "editions"],
};

/**
 * Strings the ledgers record as superseded or as a claim that must not be
 * published. The Romanian FM figure and the retired Suisse DAB+ claim are here
 * because the official 2026 list contradicts them.
 */
const BANNED_STRINGS = [
  "Romania",
  "92.1",
  "€1.90",
  "€1.82",
  "€2.78",
  "€2.77",
  "Golden Auric",
  "Tensor",
  "matrica.io",
  "guaranteed 2",
  "two tickets per Medallion",
  "2 tickets per year",
  "Astera",
];

/** Every string a chapter publishes, source titles and URLs excluded. */
function chapterText(chapter: (typeof generalChapters)[number]): string {
  const parts: string[] = [chapter.title, chapter.summary];
  for (const block of chapter.blocks) {
    switch (block.type) {
      case "p":
      case "h2":
      case "h3":
        parts.push(block.text);
        break;
      case "ul":
      case "ol":
        parts.push(...block.items);
        break;
      case "callout":
        parts.push(block.title, block.text);
        break;
      case "facts":
        parts.push(block.caption, ...block.rows.map((row) => `${row.label} ${row.value}`));
        break;
      case "data":
        parts.push(block.caption);
        break;
    }
  }
  return parts.join("\n");
}

/** Internal markdown links in the small subset the schema allows. */
function internalLinks(text: string): string[] {
  return [...text.matchAll(/\[[^\]]+\]\((\/[^)\s]*)\)/g)].map((match) => match[1]);
}

describe("General chapters — schema", () => {
  it("parses every chapter with the chapter schema", () => {
    for (const chapter of generalChapters) {
      expect(guideChapterSchema.parse(chapter)).toEqual(chapter);
    }
  });

  it("parses every block with the block schema", () => {
    for (const chapter of generalChapters) {
      for (const block of chapter.blocks) {
        expect(guideBlockSchema.parse(block)).toEqual(block);
      }
    }
  });

  it("publishes the five chapters the edition owns", () => {
    expect(generalChapters.map((chapter) => chapter.slug)).toEqual([
      "pearls",
      "radio",
      "sets",
      "nft",
      "editions",
    ]);
  });

  it("gives every chapter the general edition and the check date", () => {
    for (const chapter of generalChapters) {
      expect(chapter.edition).toBe("general");
      expect(chapter.lastVerified).toBe(VERIFIED_ON);
    }
  });

  it("stamps every source with the check date", () => {
    for (const chapter of generalChapters) {
      for (const source of chapter.sources) {
        expect(source.checkedOn).toBe(VERIFIED_ON);
      }
    }
  });
});

describe("General chapters — citations", () => {
  it("leaves no paragraph, list or callout uncited", () => {
    for (const chapter of generalChapters) {
      expect({ slug: chapter.slug, uncited: uncitedFactBlocks(chapter) }).toEqual({
        slug: chapter.slug,
        uncited: [],
      });
    }
  });

  it("gives every facts row at least one source", () => {
    for (const chapter of generalChapters) {
      for (const block of chapter.blocks) {
        if (block.type !== "facts") continue;
        for (const row of block.rows) {
          expect(row.sources.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("resolves every source reference to a declared source", () => {
    for (const chapter of generalChapters) {
      const ids = new Set(chapter.sources.map((source) => source.id));
      const refs = chapter.blocks.flatMap((block) => {
        if (block.type === "facts") return block.rows.flatMap((row) => row.sources);
        if ("sources" in block && block.sources) return [...block.sources];
        return [];
      });
      for (const ref of refs) {
        expect(ids.has(ref)).toBe(true);
      }
    }
  });

  it("cites only source urls that appear in the ledgers", () => {
    const missing = generalChapters
      .flatMap((chapter) => chapter.sources.map((source) => source.url))
      .filter((url) => !ledger.includes(url));
    expect(missing).toEqual([]);
  });

  it("cites an https url for every source", () => {
    for (const chapter of generalChapters) {
      for (const source of chapter.sources) {
        expect(source.url.startsWith("https://")).toBe(true);
      }
    }
  });
});

describe("General chapters — structure", () => {
  it("keeps slugs unique", () => {
    const slugs = generalChapters.map((chapter) => chapter.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps orders unique, positive and contiguous from 1", () => {
    const orders = generalChapters.map((chapter) => chapter.order).sort((a, b) => a - b);
    expect(orders).toEqual(generalChapters.map((_, index) => index + 1));
  });

  it("lists related chapters that exist", () => {
    for (const chapter of generalChapters) {
      for (const target of chapter.related) {
        const [edition, slug] = target.split("/");
        expect(CHAPTER_SLUGS[edition]).toContain(slug);
      }
    }
  });

  it("points every internal guide link at a known chapter", () => {
    for (const chapter of generalChapters) {
      for (const href of internalLinks(chapterText(chapter))) {
        const match = /^\/guides\/([a-z]+)\/([a-z0-9-]+)$/.exec(href);
        expect({ href, shape: match !== null }).toEqual({ href, shape: true });
        if (!match) continue;
        expect(CHAPTER_SLUGS[match[1]]).toContain(match[2]);
      }
    }
  });

  it("gives every chapter at least one h2 and a summary in range", () => {
    for (const chapter of generalChapters) {
      expect(chapter.blocks.some((block) => block.type === "h2")).toBe(true);
      expect(chapter.summary.length).toBeGreaterThanOrEqual(40);
      expect(chapter.summary.length).toBeLessThanOrEqual(200);
    }
  });

  it("keeps heading ids unique inside a chapter", () => {
    for (const chapter of generalChapters) {
      const ids = chapter.blocks
        .filter((block) => block.type === "h2" || block.type === "h3")
        .map((block) => (block as { id: string }).id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("keeps each section short enough to scan", () => {
    for (const chapter of generalChapters) {
      let since = 0;
      const long: string[] = [];
      for (const block of chapter.blocks) {
        if (block.type === "h2" || block.type === "h3") {
          if (since > 6) long.push(`${since} blocks before "${block.id}"`);
          since = 0;
        } else {
          since += 1;
        }
      }
      if (since > 6) long.push(`${since} blocks after the last heading`);
      expect({ slug: chapter.slug, long }).toEqual({ slug: chapter.slug, long: [] });
    }
  });

  it("uses no data blocks, because no general collection is representable", () => {
    for (const chapter of generalChapters) {
      expect(chapter.blocks.some((block) => block.type === "data")).toBe(false);
    }
  });
});

describe("General chapters — banned claims", () => {
  it("never publishes a string the ledgers mark as superseded or unverifiable", () => {
    for (const chapter of generalChapters) {
      const text = chapterText(chapter);
      for (const banned of BANNED_STRINGS) {
        expect({ slug: chapter.slug, banned, found: text.includes(banned) }).toEqual({
          slug: chapter.slug,
          banned,
          found: false,
        });
      }
    }
  });

  it("states no euro-per-Pearl figure at all", () => {
    for (const chapter of generalChapters) {
      const text = chapterText(chapter);
      expect(text).not.toMatch(/€\s?\d+(?:[.,]\d+)?\s*(?:per|\/)\s*Pearl/i);
    }
  });

  it("never promises a Medallion ticket guarantee", () => {
    const text = generalChapters.map(chapterText).join("\n").toLowerCase();
    expect(text).toContain("no ticket guarantee is published");
    expect(text).not.toMatch(/guarantee[sd]? (?:you )?(?:the )?(?:right to buy|purchase)/);
  });

  it("puts Switzerland online only and never on DAB+", () => {
    const radio = generalChapters.find((chapter) => chapter.slug === "radio");
    const text = radio ? chapterText(radio) : "";
    expect(text).toContain("Switzerland");
    expect(text).toContain("Online only");
  });

  it("names Thailand as sold out", () => {
    const editions = generalChapters.find((chapter) => chapter.slug === "editions");
    const text = editions ? chapterText(editions) : "";
    expect(text).toContain("Thailand");
    expect(text).toContain("11 to 13 December 2026");
    expect(text.toLowerCase()).toContain("officially sold out");
  });
});

describe("General chapters — consistency with shared data", () => {
  it("names the station exactly as the shared record does", () => {
    const radio = generalChapters.find((chapter) => chapter.slug === "radio");
    const text = radio ? chapterText(radio) : "";
    expect(text).toContain(sharedData.radio.station.name);
  });

  it("carries the Thailand edition dates from the shared record", () => {
    const thailand = sharedData.editions.find((record) => record.id === "thailand-2026");
    expect(thailand?.status).toBe("sold-out");
    const editions = generalChapters.find((chapter) => chapter.slug === "editions");
    const text = editions ? chapterText(editions) : "";
    expect(text).toContain("11 to 13 December 2026");
  });

  it("carries the Brasil 2027 dates from the shared record", () => {
    const brasil = sharedData.editions.find((record) => record.id === "brasil-2027");
    expect(brasil?.startsOn).toBe("2027-04-30");
    const editions = generalChapters.find((chapter) => chapter.slug === "editions");
    const text = editions ? chapterText(editions) : "";
    expect(text).toContain("30 April to 2 May 2027");
  });
});
