// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brasilData } from "../../data/brasil";
import { guideBlockSchema, guideChapterSchema, uncitedFactBlocks } from "../schema";
import { brasilChapters } from "./index";

const VERIFIED_ON = "2026-11-18";

/** Every fact-check document a Brasil or general chapter source may cite. */
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
 * Figures the ledgers record as `outdated` or as the superseded side of a
 * `changed` row. Publishing any of them would restate a price that has moved.
 * The R$200 early-bird reduction and the R$1,235 Social reduction are current
 * figures and are deliberately absent from this list.
 */
const SUPERSEDED_STRINGS = [
  "R$2,165",
  "R$4,540",
  "R$6,910",
  "R$11,660",
  "R$18,310",
  "R$12,980",
  "R$17,730",
  "R$24,380",
  "R$19,980",
  "R$24,730",
  "R$31,380",
  "R$21,460",
  "R$30,960",
  "R$44,260",
  "R$1,895",
  "R$2,760",
  "R$1,264",
  "R$1,546",
  "R$5,135",
  "R$3,639",
  "R$3,921",
  "R$199",
  "R$509",
  "R$219",
  "R$180",
  "R$1,250",
  "R$625",
  "Astera",
  "Romania",
  "92.1 FM",
];

/** Every string a chapter publishes, source titles and URLs excluded. */
function chapterText(chapter: (typeof brasilChapters)[number]): string {
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

describe("Brasil chapters — schema", () => {
  it("parses every chapter with the chapter schema", () => {
    for (const chapter of brasilChapters) {
      expect(guideChapterSchema.parse(chapter)).toEqual(chapter);
    }
  });

  it("parses every block with the block schema", () => {
    for (const chapter of brasilChapters) {
      for (const block of chapter.blocks) {
        expect(guideBlockSchema.parse(block)).toEqual(block);
      }
    }
  });

  it("publishes the four chapters the edition owns", () => {
    expect(brasilChapters.map((chapter) => chapter.slug)).toEqual([
      "overview",
      "tickets",
      "dreamville",
      "transport",
    ]);
  });

  it("gives every chapter the Brasil edition and the check date", () => {
    for (const chapter of brasilChapters) {
      expect(chapter.edition).toBe("brasil");
      expect(chapter.lastVerified).toBe(VERIFIED_ON);
    }
  });

  it("stamps every source with the check date", () => {
    for (const chapter of brasilChapters) {
      for (const source of chapter.sources) {
        expect(source.checkedOn).toBe(VERIFIED_ON);
      }
    }
  });
});

describe("Brasil chapters — citations", () => {
  it("leaves no paragraph, list or callout uncited", () => {
    for (const chapter of brasilChapters) {
      expect({ slug: chapter.slug, uncited: uncitedFactBlocks(chapter) }).toEqual({
        slug: chapter.slug,
        uncited: [],
      });
    }
  });

  it("gives every facts row at least one source", () => {
    for (const chapter of brasilChapters) {
      for (const block of chapter.blocks) {
        if (block.type !== "facts") continue;
        for (const row of block.rows) {
          expect(row.sources.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("resolves every source reference to a declared source", () => {
    for (const chapter of brasilChapters) {
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
    const missing = brasilChapters
      .flatMap((chapter) => chapter.sources.map((source) => source.url))
      .filter((url) => !ledger.includes(url));
    expect(missing).toEqual([]);
  });

  it("cites an https url for every source", () => {
    for (const chapter of brasilChapters) {
      for (const source of chapter.sources) {
        expect(source.url.startsWith("https://")).toBe(true);
      }
    }
  });
});

describe("Brasil chapters — structure", () => {
  it("keeps slugs unique", () => {
    const slugs = brasilChapters.map((chapter) => chapter.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps orders unique, positive and contiguous from 1", () => {
    const orders = brasilChapters.map((chapter) => chapter.order).sort((a, b) => a - b);
    expect(orders).toEqual(brasilChapters.map((_, index) => index + 1));
  });

  it("lists related chapters that exist", () => {
    for (const chapter of brasilChapters) {
      for (const target of chapter.related) {
        const [edition, slug] = target.split("/");
        expect(CHAPTER_SLUGS[edition]).toContain(slug);
      }
    }
  });

  it("points every internal guide link at a known chapter", () => {
    for (const chapter of brasilChapters) {
      for (const href of internalLinks(chapterText(chapter))) {
        const match = /^\/guides\/([a-z]+)\/([a-z0-9-]+)$/.exec(href);
        expect({ href, shape: match !== null }).toEqual({ href, shape: true });
        if (!match) continue;
        expect(CHAPTER_SLUGS[match[1]]).toContain(match[2]);
      }
    }
  });

  it("gives every chapter at least one h2 and a plain-noun title", () => {
    for (const chapter of brasilChapters) {
      expect(chapter.blocks.some((block) => block.type === "h2")).toBe(true);
      expect(chapter.summary.length).toBeGreaterThanOrEqual(40);
      expect(chapter.summary.length).toBeLessThanOrEqual(200);
    }
  });

  it("keeps heading ids unique inside a chapter", () => {
    for (const chapter of brasilChapters) {
      const ids = chapter.blocks
        .filter((block) => block.type === "h2" || block.type === "h3")
        .map((block) => (block as { id: string }).id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("keeps each section short enough to scan", () => {
    for (const chapter of brasilChapters) {
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
});

describe("Brasil chapters — superseded material", () => {
  it("never restates a price or name the ledgers record as superseded", () => {
    for (const chapter of brasilChapters) {
      const text = chapterText(chapter);
      for (const banned of SUPERSEDED_STRINGS) {
        expect({ slug: chapter.slug, banned, found: text.includes(banned) }).toEqual({
          slug: chapter.slug,
          banned,
          found: false,
        });
      }
    }
  });

  it("never calls TicketSwap an official channel", () => {
    for (const chapter of brasilChapters) {
      const text = chapterText(chapter).toLowerCase();
      expect(text).not.toContain("ticketswap is official");
    }
  });

  it("never describes the half-price discount as always 50%", () => {
    for (const chapter of brasilChapters) {
      const text = chapterText(chapter).toLowerCase();
      expect(text).not.toMatch(/always (?:a )?50\s?%/);
      expect(text).not.toMatch(/always half/);
    }
  });

  it("says Brasil prices are in reais and not converted", () => {
    const text = brasilChapters.map(chapterText).join("\n").toLowerCase();
    expect(text).toContain("reais");
    expect(text).toContain("not converted");
  });
});

describe("Brasil chapters — data blocks", () => {
  /** The Brasil collection each data-block collection name maps onto. */
  const collectionRecords: Record<string, readonly { id: string }[]> = {
    tickets: brasilData.tickets,
    accommodation: brasilData.dreamvillePackages,
    "sale-windows": brasilData.saleWindows,
    "add-ons": brasilData.shuttles,
    faqs: [],
  };

  const dataBlocks = brasilChapters.flatMap((chapter) =>
    chapter.blocks
      .filter((block) => block.type === "data")
      .map((block) => ({ chapter: chapter.slug, block })),
  );

  it("uses at least one data block", () => {
    expect(dataBlocks.length).toBeGreaterThan(0);
  });

  it("names a collection that holds records for the Brasil edition", () => {
    for (const { chapter, block } of dataBlocks) {
      if (block.type !== "data") continue;
      const records = collectionRecords[block.collection];
      expect({ chapter, collection: block.collection, exists: records !== undefined }).toEqual({
        chapter,
        collection: block.collection,
        exists: true,
      });
      expect(records.length).toBeGreaterThan(0);
    }
  });

  it("only references the Brasil edition", () => {
    for (const { block } of dataBlocks) {
      if (block.type !== "data") continue;
      expect(block.edition).toBe("brasil");
    }
  });

  it("matches at least one record for every idPrefix", () => {
    for (const { chapter, block } of dataBlocks) {
      if (block.type !== "data" || block.idPrefix === undefined) continue;
      const records = collectionRecords[block.collection];
      const matches = records.filter((record) => record.id.startsWith(block.idPrefix as string));
      expect({ chapter, prefix: block.idPrefix, matches: matches.length > 0 }).toEqual({
        chapter,
        prefix: block.idPrefix,
        matches: true,
      });
    }
  });

  it("does not repeat a collection and prefix inside one chapter", () => {
    for (const chapter of brasilChapters) {
      const keys = chapter.blocks
        .filter((block) => block.type === "data")
        .map((block) => (block.type === "data" ? `${block.collection}/${block.idPrefix ?? "*"}` : ""));
      expect({ slug: chapter.slug, unique: new Set(keys).size === keys.length }).toEqual({
        slug: chapter.slug,
        unique: true,
      });
    }
  });

  it("renders every DreamVille package through the accommodation collection", () => {
    // The Brasil DreamVille packages are records in the Brasil data set, so the
    // chapter reads them through a data block rather than retyping a price.
    const accommodationBlocks = dataBlocks.filter(
      ({ block }) => block.type === "data" && block.collection === "accommodation",
    );
    expect(accommodationBlocks.length).toBeGreaterThan(0);

    const covered = new Set<string>();
    for (const { block } of accommodationBlocks) {
      if (block.type !== "data" || block.idPrefix === undefined) continue;
      for (const record of brasilData.dreamvillePackages) {
        if (record.id.startsWith(block.idPrefix)) covered.add(record.id);
      }
    }

    const uncovered = brasilData.dreamvillePackages
      .map((record) => record.id)
      .filter((id) => !covered.has(id));
    expect(uncovered).toEqual([]);
  });

  it("keeps the published Luna figures in a sourced facts row", () => {
    // Luna is the one Mística line the official index prices without mapping a
    // figure to a variant, so `src/data/brasil` carries it as a fact rather than
    // as three package records. The chapter quotes it there, with a source.
    const dreamville = brasilChapters.find((chapter) => chapter.slug === "dreamville");
    const lunaRow =
      dreamville?.blocks
        .filter((block) => block.type === "facts")
        .flatMap((block) => (block.type === "facts" ? block.rows : []))
        .find((row) => row.label.startsWith("Luna")) ?? null;
    expect(lunaRow).not.toBeNull();
    expect(lunaRow?.value).toContain("R$20,049");
    expect(lunaRow?.value).toContain("R$32,959");
    expect(lunaRow?.sources.length).toBeGreaterThan(0);
  });
});

describe("Brasil chapters — verified content", () => {
  it("states the 2027 dates, venue and theme in the overview", () => {
    const overview = brasilChapters.find((chapter) => chapter.slug === "overview");
    const text = overview ? chapterText(overview) : "";
    expect(text).toContain("30 April");
    expect(text).toContain("2 May 2027");
    expect(text).toContain("Parque Maeda");
    expect(text).toContain("Consciência");
  });

  it("explains the flat R$1,580 meia-entrada discount and its citizen limit", () => {
    const tickets = brasilChapters.find((chapter) => chapter.slug === "tickets");
    const text = tickets ? chapterText(tickets) : "";
    expect(text).toContain("R$1,580");
    expect(text).toContain("Brazilian citizens");
    expect(text).toContain("not a percentage");
  });

  it("puts Global Journey on 15 September 2026", () => {
    const tickets = brasilChapters.find((chapter) => chapter.slug === "tickets");
    const text = tickets ? chapterText(tickets) : "";
    expect(text).toContain("15 September 2026");
  });

  it("says the day passes are sold out", () => {
    const text = brasilChapters.map(chapterText).join("\n").toLowerCase();
    expect(text).toContain("day passes are priced for 2027 and are sold out");
  });

  it("names every 2027 Mística tier without a retired one", () => {
    const dreamville = brasilChapters.find((chapter) => chapter.slug === "dreamville");
    const text = dreamville ? chapterText(dreamville) : "";
    for (const tier of ["Solaris", "Luna", "Dreamlodge", "Nomade", "Orion", "Argo", "Grande"]) {
      expect(text).toContain(tier);
    }
    expect(text).not.toContain("Astera");
  });

  it("treats a shuttle voucher as one festival day and lists Rio de Janeiro", () => {
    const transport = brasilChapters.find((chapter) => chapter.slug === "transport");
    const text = transport ? chapterText(transport) : "";
    expect(text).toContain("single festival day");
    expect(text).toContain("three vouchers");
    expect(text).toContain("Rio de Janeiro");
    expect(text).not.toContain("Curitiba");
  });

  it("puts the shuttle stop 300 metres from the Main Entrance", () => {
    const transport = brasilChapters.find((chapter) => chapter.slug === "transport");
    const text = transport ? chapterText(transport) : "";
    expect(text).toContain("300 metres");
    expect(text).not.toContain("400 metres");
  });
});
