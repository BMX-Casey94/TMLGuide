// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { accommodation, tickets } from "@/data/belgium";
import { guideChapterSchema, uncitedFactBlocks, type GuideChapter } from "@/content/schema";
import { belgiumChapters } from "@/content/belgium";
import { accommodationChapter } from "@/content/belgium/accommodation";
import { datesAndSalesChapter } from "@/content/belgium/dates-and-sales";
import { dreamvilleChapter } from "@/content/belgium/dreamville";
import { overviewChapter } from "@/content/belgium/overview";
import { ticketsChapter } from "@/content/belgium/tickets";

/**
 * Guards for the part A Belgium chapters.
 *
 * Most of these assertions exist to stop a later edit rather than to prove the
 * code compiles: a fact cannot arrive without a citation, a price cannot be
 * retyped into prose, and a superseded 2025 figure cannot creep back in. The
 * checks run over the five chapters this workstream owns, not the whole
 * edition, so a part B chapter is never judged by these rules.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const LEDGER_TEXT = [
  path.join(REPO_ROOT, "docs/factcheck/belgium.md"),
  path.join(REPO_ROOT, "docs/factcheck/conflicts.md"),
]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

const chapters: readonly GuideChapter[] = [
  overviewChapter,
  datesAndSalesChapter,
  ticketsChapter,
  accommodationChapter,
  dreamvilleChapter,
];

const MY_SLUGS = ["overview", "dates-and-sales", "tickets", "accommodation", "dreamville"];

/** Slugs that other workstreams own, from the brief's chapter list. */
const KNOWN_SLUGS: Record<string, readonly string[]> = {
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
 * The 2025 prices and Treasure Case fees that the 2027 values replaced, taken
 * from the ledger's `outdated` rows. Checked as standalone numbers so a date or
 * an opening time cannot trip the assertion.
 */
const SUPERSEDED_PRICES = [
  129, 143, 177, 208, 232, 250, 304, 374, 530, 640, 381, 452, 614, 733, 525, 599, 758, 880, 975,
  1121, 1441, 1683, 1018, 1152, 1484, 1714, 5158, 5952, 1114, 1238, 1800, 1329, 1453, 1795, 2015,
  1594, 1718, 2060, 2280, 2206, 3138, 3578, 2596, 2844, 3528, 3968, 2041, 2165, 2507, 2727, 2174,
  2298, 2640, 2860, 2450, 2574, 2916, 3136, 2266, 2390, 2732, 2952, 2313, 2437, 2779, 2999, 2326,
  2485, 2792, 3047, 2481, 2605, 2947, 3167, 4844, 4968, 5310, 5530, 4994, 5118, 5460, 5680, 13.5,
  19.5, 27,
];

/** Every price the 2027 data publishes, so prose cannot restate one. */
const PUBLISHED_PRICES = [
  ...tickets.map((record) => record.priceEur),
  ...accommodation.map((record) => record.nightlyOrTotalEur),
].map((price) => String(price));

function allText(chapter: GuideChapter): string {
  const parts: string[] = [chapter.title, chapter.summary];
  for (const block of chapter.blocks) {
    switch (block.type) {
      case "p":
      case "h2":
      case "h3":
        parts.push(block.text);
        break;
      case "callout":
        parts.push(block.title, block.text);
        break;
      case "ul":
      case "ol":
        parts.push(...block.items);
        break;
      case "facts":
        parts.push(block.caption, ...block.rows.flatMap((row) => [row.label, row.value]));
        break;
      case "data":
        parts.push(block.caption);
        break;
    }
  }
  return parts.join("\n");
}

/** Prose only: the blocks a reader sees as running text. */
function proseText(chapter: GuideChapter): string {
  return chapter.blocks
    .flatMap((block) => {
      if (block.type === "p") return [block.text];
      if (block.type === "ul" || block.type === "ol") return block.items;
      if (block.type === "callout") return [block.title, block.text];
      return [];
    })
    .join("\n");
}

function containsNumber(text: string, value: number): boolean {
  const pattern = new RegExp(`(?<![\\d.,])${String(value).replace(".", "\\.")}(?![\\d.,])`);
  return pattern.test(text);
}

describe("Belgium part A chapters", () => {
  it("parses every chapter with the guide schema", () => {
    for (const chapter of chapters) {
      const result = guideChapterSchema.safeParse(chapter);
      expect(result.error?.issues ?? []).toEqual([]);
    }
  });

  it("covers the five slugs this workstream owns, in reading order", () => {
    expect(chapters.map((chapter) => chapter.slug)).toEqual(MY_SLUGS);
    expect(chapters.map((chapter) => chapter.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("is listed in the edition index", () => {
    const listed = belgiumChapters.map((chapter) => chapter.slug);
    for (const slug of MY_SLUGS) {
      expect(listed).toContain(slug);
    }
    expect(new Set(listed).size).toBe(listed.length);
  });

  it("leaves no paragraph, list or callout without a source", () => {
    for (const chapter of chapters) {
      expect({ slug: chapter.slug, uncited: uncitedFactBlocks(chapter) }).toEqual({
        slug: chapter.slug,
        uncited: [],
      });
    }
  });

  it("cites only URLs that appear in the fact-check ledgers", () => {
    for (const chapter of chapters) {
      for (const source of chapter.sources) {
        expect({ chapter: chapter.slug, url: source.url, known: LEDGER_TEXT.includes(source.url) }).toEqual({
          chapter: chapter.slug,
          url: source.url,
          known: true,
        });
      }
    }
  });

  it("stamps every source and chapter with the check date", () => {
    for (const chapter of chapters) {
      expect(chapter.lastVerified).toBe("2026-11-18");
      for (const source of chapter.sources) {
        expect(source.checkedOn).toBe("2026-11-18");
      }
    }
  });

  it("links only to chapters that exist", () => {
    for (const chapter of chapters) {
      for (const target of chapter.related) {
        const [edition, slug] = target.split("/");
        const known = KNOWN_SLUGS[edition]?.includes(slug) ?? false;
        expect({ from: chapter.slug, target, known }).toEqual({ from: chapter.slug, target, known: true });
      }
    }
  });

  it("never repeats a price the ledgers mark outdated", () => {
    for (const chapter of chapters) {
      const text = allText(chapter);
      const found = SUPERSEDED_PRICES.filter((price) => containsNumber(text, price));
      expect({ chapter: chapter.slug, found }).toEqual({ chapter: chapter.slug, found: [] });
    }
  });

  it("never restates a published ticket or accommodation price in prose", () => {
    for (const chapter of chapters) {
      const found = PUBLISHED_PRICES.filter((price) => containsNumber(proseText(chapter), Number(price)));
      expect({ chapter: chapter.slug, found }).toEqual({ chapter: chapter.slug, found: [] });
    }
  });

  it("never carries the retired claims the brief rules out", () => {
    for (const chapter of chapters) {
      const text = allText(chapter);
      expect(text).not.toContain("Romania");
      expect(text.toLowerCase()).not.toContain("ticketswap is official");
      expect(text).not.toContain("over 200 countries");
      if (chapter.slug !== "accommodation") {
        expect({ chapter: chapter.slug, astera: text.includes("Astera") }).toEqual({
          chapter: chapter.slug,
          astera: false,
        });
      }
    }
  });

  it("points every data block at a collection that holds matching records", () => {
    const collections = ["tickets", "accommodation", "sale-windows", "add-ons", "faqs"];

    for (const chapter of chapters) {
      for (const block of chapter.blocks) {
        if (block.type !== "data") continue;
        expect(block.edition).toBe("belgium");
        expect(collections).toContain(block.collection);

        if (block.collection === "tickets") {
          expect(block.idPrefix, `${block.caption} needs an idPrefix`).toBeTruthy();
          const matches = tickets.filter((record) => record.id.startsWith(block.idPrefix ?? ""));
          expect({ block: block.caption, matches: matches.length > 0 }).toEqual({
            block: block.caption,
            matches: true,
          });
        }
        if (block.collection === "accommodation") {
          expect(block.idPrefix, `${block.caption} needs an idPrefix`).toBeTruthy();
          const matches = accommodation.filter((record) => record.id.startsWith(block.idPrefix ?? ""));
          expect({ block: block.caption, matches: matches.length > 0 }).toEqual({
            block: block.caption,
            matches: true,
          });
        }
      }
    }
  });

  it("shows every 2027 ticket price through a data block", () => {
    const shown = new Set<string>();
    for (const chapter of chapters) {
      for (const block of chapter.blocks) {
        if (block.type === "data" && block.collection === "tickets") {
          for (const record of tickets) {
            if (record.id.startsWith(block.idPrefix ?? "")) shown.add(record.id);
          }
        }
      }
    }
    expect(shown.size).toBe(tickets.length);
  });

  it("does not carry a source the chapter never cites", () => {
    for (const chapter of chapters) {
      const cited = new Set<string>();
      for (const block of chapter.blocks) {
        if ("sources" in block && Array.isArray(block.sources)) {
          for (const ref of block.sources) cited.add(ref);
        }
        if (block.type === "facts") {
          for (const row of block.rows) for (const ref of row.sources) cited.add(ref);
        }
      }
      const unused = chapter.sources.map((source) => source.id).filter((id) => !cited.has(id));
      expect({ chapter: chapter.slug, unused }).toEqual({ chapter: chapter.slug, unused: [] });
    }
  });

  it("gives every heading a unique id within its chapter", () => {
    for (const chapter of chapters) {
      const ids = chapter.blocks
        .filter((block) => block.type === "h2" || block.type === "h3")
        .map((block) => (block.type === "h2" || block.type === "h3" ? block.id : ""));
      expect({ chapter: chapter.slug, unique: new Set(ids).size === ids.length }).toEqual({
        chapter: chapter.slug,
        unique: true,
      });
    }
  });

  it("puts at most six paragraphs between two headings", () => {
    for (const chapter of chapters) {
      let sinceHeading = 0;
      for (const block of chapter.blocks) {
        if (block.type === "h2" || block.type === "h3") {
          sinceHeading = 0;
          continue;
        }
        if (block.type === "p") {
          sinceHeading += 1;
          expect({ chapter: chapter.slug, sinceHeading }).toEqual({
            chapter: chapter.slug,
            sinceHeading: Math.min(sinceHeading, 6),
          });
        }
      }
    }
  });

  it("carries at least one warning where a rule changes a decision", () => {
    for (const chapter of chapters) {
      const warnings = chapter.blocks.filter(
        (block) => block.type === "callout" && block.tone === "warning",
      );
      expect({ chapter: chapter.slug, hasWarning: warnings.length > 0 }).toEqual({
        chapter: chapter.slug,
        hasWarning: true,
      });
    }
  });

  it("keeps titles and summaries inside the schema limits", () => {
    for (const chapter of chapters) {
      expect(chapter.title.length).toBeLessThanOrEqual(90);
      expect(chapter.summary.length).toBeGreaterThanOrEqual(40);
      expect(chapter.summary.length).toBeLessThanOrEqual(200);
    }
  });
});
