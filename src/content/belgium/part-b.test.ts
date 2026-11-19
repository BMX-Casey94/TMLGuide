// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { belgiumData } from "@/data/belgium";
import { GUIDE_EDITIONS, guideChapterSchema, uncitedFactBlocks, type GuideChapter } from "../schema";
import { belgiumChaptersB } from "./index-b";

const VERIFIED_ON = "2026-11-18";

const ledgerText = ["docs/factcheck/belgium.md", "docs/factcheck/conflicts.md"]
  .map((relativePath) => readFileSync(path.resolve(process.cwd(), relativePath), "utf8"))
  .join("\n\n");

/**
 * Chapter slugs published by the other workstreams, from the wave 5 brief.
 * `related` may point at these even though this module cannot import them: the
 * Belgium file is owned elsewhere, and the other editions are imported by their
 * own tests. Anything outside this list is a typo, not a cross-reference.
 */
const OTHER_CHAPTER_SLUGS: readonly string[] = [
  "belgium/overview",
  "belgium/dates-and-sales",
  "belgium/tickets",
  "belgium/accommodation",
  "belgium/dreamville",
  "winter/overview",
  "winter/tickets-and-packages",
  "winter/accommodation",
  "winter/transport",
  "winter/stages-and-hours",
  "winter/clothing-and-lockers",
  "winter/lessons-and-gear",
  "winter/add-ons",
  "brasil/overview",
  "brasil/tickets",
  "brasil/dreamville",
  "brasil/transport",
  "general/pearls",
  "general/radio",
  "general/sets",
  "general/nft",
  "general/editions",
];

/**
 * Superseded figures taken from the ledger's OLD column. A price in a chapter
 * that matches one of these is a 2025 value carried forward, which is the exact
 * mistake the brief warns about. Compared as whole numeric tokens, so 2,454 does
 * not trip the 452 entry and 2850 does not trip 285.
 */
const OBSOLETE_FIGURES = [
  129, 143, 177, 208, 232, 250, 304, 374, 381, 452, 525, 530, 599, 640, 975, 1018, 1114, 1121, 1152,
  1238, 2041, 2165, 2174, 2206, 2298, 2326, 2485, 4844, 4968, 5158, 5952,
];

/** Strings the ledger records as wrong, superseded or belonging to another edition. */
const FORBIDDEN_STRINGS = ["Astera", "Romania", "TicketSwap is official", "mansion@dreamville.be"];

const COLLECTION_LENGTHS: Record<string, number> = {
  tickets: belgiumData.tickets.length,
  accommodation: belgiumData.accommodation.length,
  "sale-windows": belgiumData.saleWindows.length,
  "add-ons": belgiumData.addOns.length,
  faqs: belgiumData.faqs.length,
};

const COLLECTION_IDS: Record<string, readonly string[]> = {
  tickets: belgiumData.tickets.map((record) => record.id),
  accommodation: belgiumData.accommodation.map((record) => record.id),
  "sale-windows": belgiumData.saleWindows.map((record) => record.id),
  "add-ons": belgiumData.addOns.map((record) => record.id),
  faqs: belgiumData.faqs.map((record) => record.id),
};

/** Every piece of reader-facing prose in a chapter, in document order. */
function chapterText(chapter: GuideChapter): string {
  const parts: string[] = [chapter.title, chapter.summary];
  for (const block of chapter.blocks) {
    switch (block.type) {
      case "p":
      case "callout":
        parts.push(block.text);
        if (block.type === "callout") parts.push(block.title);
        break;
      case "ul":
      case "ol":
        parts.push(...block.items);
        break;
      case "facts":
        parts.push(block.caption, ...block.rows.flatMap((row) => [row.label, row.value]));
        break;
      case "h2":
      case "h3":
        parts.push(block.text);
        break;
      case "data":
        parts.push(block.caption);
        break;
    }
  }
  return parts.join("\n");
}

const chapters = belgiumChaptersB;

describe("belgium chapters, part B", () => {
  it("holds the five chapters this workstream owns", () => {
    expect(chapters.map((chapter) => chapter.slug)).toEqual([
      "transport",
      "global-journey",
      "add-ons",
      "food-drinks",
      "faq",
    ]);
  });

  it("parses every chapter through the guide schema", () => {
    for (const chapter of chapters) {
      const result = guideChapterSchema.safeParse(chapter);
      if (!result.success) {
        throw new Error(
          `${chapter.slug} failed its schema:\n${result.error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
            .join("\n")}`,
        );
      }
    }
  });

  it("scopes every chapter to Belgium and dates it 2026-11-18", () => {
    for (const chapter of chapters) {
      expect(chapter.edition, chapter.slug).toBe("belgium");
      expect(chapter.lastVerified, chapter.slug).toBe(VERIFIED_ON);
      for (const source of chapter.sources) {
        expect(source.checkedOn, `${chapter.slug}/${source.id}`).toBe(VERIFIED_ON);
      }
    }
  });

  it("cites a source on every fact-bearing block", () => {
    for (const chapter of chapters) {
      const uncited = uncitedFactBlocks(chapter);
      expect(uncited, `${chapter.slug} has uncited blocks at ${uncited.join(", ")}`).toEqual([]);
    }
  });

  it("gives every facts row at least one source", () => {
    for (const chapter of chapters) {
      chapter.blocks.forEach((block, index) => {
        if (block.type !== "facts") return;
        block.rows.forEach((row, rowIndex) => {
          expect(
            row.sources.length,
            `${chapter.slug} block ${index} row ${rowIndex} ("${row.label}") is uncited`,
          ).toBeGreaterThan(0);
        });
      });
    }
  });

  it("names each source id exactly once and points every reference at a declared id", () => {
    for (const chapter of chapters) {
      const ids = chapter.sources.map((source) => source.id);
      expect(new Set(ids).size, `${chapter.slug} reuses a source id`).toBe(ids.length);

      const declared = new Set(ids);
      const referenced = new Set<string>();
      for (const block of chapter.blocks) {
        if ("sources" in block && Array.isArray(block.sources)) {
          block.sources.forEach((ref) => referenced.add(ref));
        }
        if (block.type === "facts") {
          block.rows.forEach((row) => row.sources.forEach((ref) => referenced.add(ref)));
        }
      }
      const dangling = [...referenced].filter((ref) => !declared.has(ref));
      expect(dangling, `${chapter.slug} references undeclared sources`).toEqual([]);
    }
  });

  it("keeps slugs and orders unique", () => {
    const slugs = chapters.map((chapter) => chapter.slug);
    const orders = chapters.map((chapter) => chapter.order);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("places its orders after the five chapters the other workstream owns", () => {
    expect(chapters.map((chapter) => chapter.order)).toEqual([6, 7, 8, 9, 10]);
  });

  it("cites only URLs that appear in the fact-check ledgers", () => {
    const missing: string[] = [];
    for (const chapter of chapters) {
      for (const source of chapter.sources) {
        if (!ledgerText.includes(source.url)) {
          missing.push(`${chapter.slug}/${source.id}: ${source.url}`);
        }
      }
    }
    expect(missing, `URLs absent from the ledger:\n${missing.join("\n")}`).toEqual([]);
  });

  it("uses https URLs with no credentials", () => {
    for (const chapter of chapters) {
      for (const source of chapter.sources) {
        const url = new URL(source.url);
        expect(url.protocol, `${chapter.slug}/${source.id}`).toBe("https:");
        expect(url.username).toBe("");
        expect(url.password).toBe("");
      }
    }
  });

  it("links only to chapters that exist", () => {
    const own = new Set(chapters.map((chapter) => `belgium/${chapter.slug}`));
    const allowed = new Set([...own, ...OTHER_CHAPTER_SLUGS]);
    const dangling: string[] = [];
    for (const chapter of chapters) {
      for (const target of chapter.related) {
        if (!allowed.has(target)) dangling.push(`${chapter.slug} -> ${target}`);
      }
    }
    expect(dangling, `related targets that do not exist:\n${dangling.join("\n")}`).toEqual([]);
  });

  it("does not list a chapter as related to itself", () => {
    for (const chapter of chapters) {
      expect(chapter.related, chapter.slug).not.toContain(`belgium/${chapter.slug}`);
    }
  });

  it("carries none of the superseded figures the ledger marks outdated", () => {
    const offenders: string[] = [];
    for (const chapter of chapters) {
      const tokens = chapterText(chapter).match(/\d[\d,]*/g) ?? [];
      for (const token of tokens) {
        const value = Number(token.replace(/,/g, ""));
        if (OBSOLETE_FIGURES.includes(value)) {
          offenders.push(`${chapter.slug}: ${token}`);
        }
      }
    }
    expect(offenders, `superseded figures found:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("carries none of the forbidden strings", () => {
    const offenders: string[] = [];
    for (const chapter of chapters) {
      const text = chapterText(chapter);
      for (const forbidden of FORBIDDEN_STRINGS) {
        if (text.includes(forbidden)) offenders.push(`${chapter.slug}: ${forbidden}`);
      }
    }
    expect(offenders, `forbidden strings found:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("quotes no fare, locker price or Pearl rate", () => {
    /**
     * Euro amounts these chapters are allowed to print, because the ledger
     * confirms them as rules rather than as product prices: the rail fine, and
     * the refundable Avicii deposit. A fare or a locker price would fail here.
     */
    const permitted: Record<string, readonly number[]> = {
      transport: [90],
      "global-journey": [350],
      "add-ons": [10],
      "food-drinks": [],
      faq: [350, 10],
    };

    for (const chapter of chapters) {
      const text = chapterText(chapter);
      const quoted = (text.match(/€\s?\d[\d,.]*/g) ?? []).map((hit) =>
        Number(hit.replace(/[€\s,]/g, "")),
      );
      const unexpected = quoted.filter((value) => !(permitted[chapter.slug] ?? []).includes(value));
      expect(unexpected, `${chapter.slug} quotes an unpermitted euro amount`).toEqual([]);
    }

    for (const slug of ["transport", "food-drinks"]) {
      const chapter = chapters.find((candidate) => candidate.slug === slug) as GuideChapter;
      const text = chapterText(chapter);
      expect(/Pearl\s*(?:=|is worth)/i.test(text), `${slug} states a Pearl rate`).toBe(false);
    }
  });

  it("names every data block's collection and edition, and matches at least one record", () => {
    const dataBlocks = chapters.flatMap((chapter) =>
      chapter.blocks
        .filter((block) => block.type === "data")
        .map((block) => ({ slug: chapter.slug, block })),
    );

    expect(dataBlocks.length, "no data block is used at all").toBeGreaterThan(0);

    for (const { slug, block } of dataBlocks) {
      if (block.type !== "data") throw new Error("unreachable");
      expect(GUIDE_EDITIONS, `${slug} data block names an unknown edition`).toContain(block.edition);
      expect(block.edition, `${slug} reads another edition's data`).toBe("belgium");
      expect(Object.keys(COLLECTION_LENGTHS), `${slug} names an unknown collection`).toContain(
        block.collection,
      );

      const ids = COLLECTION_IDS[block.collection];
      if (block.idPrefix) {
        const matches = ids.filter((id) => id.startsWith(block.idPrefix as string));
        expect(matches.length, `${slug} prefix "${block.idPrefix}" matches no record`).toBeGreaterThan(0);
      } else {
        expect(ids.length, `${slug} points at an empty ${block.collection} collection`).toBeGreaterThan(0);
      }
    }
  });

  it("explains the shuttle, locker and Pearl gaps instead of quoting a figure", () => {
    const transport = chapters.find((chapter) => chapter.slug === "transport") as GuideChapter;
    const addOns = chapters.find((chapter) => chapter.slug === "add-ons") as GuideChapter;
    const foodDrinks = chapters.find((chapter) => chapter.slug === "food-drinks") as GuideChapter;

    expect(chapterText(transport)).toMatch(/no fare is published/i);
    expect(chapterText(addOns)).toMatch(/locker price or dimension is confirmed/i);
    expect(chapterText(foodDrinks)).toMatch(/value of one Pearl/i);

    // The data collections behind those gaps are empty, so a data block for one
    // would render nothing. This asserts the chapters do not ask for one.
    const collections = chapters.flatMap((chapter) =>
      chapter.blocks.filter((block) => block.type === "data").map((block) => block.collection),
    );
    expect(collections).not.toContain("sale-windows");
    expect(collections).toEqual(["add-ons", "faqs"]);
  });

  it("gives every chapter a plain title and a summary inside the card limit", () => {
    for (const chapter of chapters) {
      expect(chapter.summary.length, chapter.slug).toBeGreaterThanOrEqual(40);
      expect(chapter.summary.length, chapter.slug).toBeLessThanOrEqual(200);
    }
  });

  it("opens every chapter with a paragraph before the first heading", () => {
    for (const chapter of chapters) {
      expect(chapter.blocks[0]?.type, `${chapter.slug} opens with a heading`).toBe("p");
    }
  });

  it("uses at least one callout on a rule that changes a decision", () => {
    const withCallout = chapters.filter((chapter) =>
      chapter.blocks.some((block) => block.type === "callout"),
    );
    expect(withCallout.map((chapter) => chapter.slug)).toEqual([
      "transport",
      "global-journey",
      "add-ons",
      "food-drinks",
      "faq",
    ]);
  });
});
