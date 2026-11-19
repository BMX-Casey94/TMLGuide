// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { guideChapterSchema, uncitedFactBlocks, type GuideChapter } from "../schema";
import { winterChapters } from "./index";
import {
  winterAddOns,
  winterFacts,
  winterFaqs,
  winterSaleWindows,
  winterShuttles,
  winterStages,
  winterTickets,
} from "../../data/winter/index";

// `src/content/winter` -> `src/content` -> `src` -> repository root.
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

/** The two ledgers that govern the Winter edition. */
const LEDGER_FILES = [
  path.join(REPO_ROOT, "docs/factcheck/winter.md"),
  path.join(REPO_ROOT, "docs/factcheck/conflicts.md"),
] as const;

const LEDGERS_AVAILABLE = LEDGER_FILES.every((file) => existsSync(file));
const ledgerText = LEDGERS_AVAILABLE
  ? LEDGER_FILES.map((file) => readFileSync(file, "utf8")).join("\n")
  : "";

const VERIFIED_ON = "2026-11-18";

/**
 * Chapter slugs each edition ships, used to check `related` without importing
 * another agent's content folder. Kept as a literal so a broken sibling module
 * cannot make this suite fail for a reason that is not ours.
 */
const EDITION_CHAPTER_SLUGS: Readonly<Record<string, readonly string[]>> = {
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
 * Figures and names the ledgers mark outdated or excluded. Each entry names
 * what is wrong with it, so a future reader can see why the string is banned
 * rather than deleting the assertion.
 */
const SUPERSEDED_STRINGS: readonly { pattern: RegExp; why: string }[] = [
  // 2025 prices, each marked `outdated` or `changed` in the ledger.
  { pattern: /€\s?995\b/, why: "2025 7-day package minimum, marked outdated" },
  { pattern: /€\s?875\b/, why: "2025 4-day package minimum, marked outdated" },
  { pattern: /€\s?695\b/, why: "2025 7-day festival pass, marked changed" },
  { pattern: /€\s?525\b/, why: "2025 4-day festival pass, marked unverifiable" },
  { pattern: /€\s?375\b/, why: "2025 Comfort upgrade, marked changed (2027 price is €390)" },
  { pattern: /€\s?140\b/, why: "2025 1-day Comfort upgrade, marked outdated" },
  { pattern: /€\s?2\s?695\b/, why: "2025 Exclusive Pass price, marked unverifiable" },
  { pattern: /€\s?2\s?525\b/, why: "2025 Exclusive Pass price, marked unverifiable" },
  { pattern: /€\s?930\b/, why: "2025 Exclusive Pass price, marked unverifiable" },
  { pattern: /€\s?94\b/, why: "2025 covered parking weekly rate, marked changed (2026–27 is €95)" },
  { pattern: /€\s?48\b/, why: "2025 Ben's Bus Lyon single, marked changed" },
  { pattern: /€\s?87\b/, why: "2025 Ben's Bus Lyon return, marked changed" },
  { pattern: /€\s?39\.50\b/, why: "2025 Ben's Bus Grenoble single, marked changed" },
  { pattern: /€\s?69\b/, why: "2025 Ben's Bus Grenoble return, marked changed" },
  { pattern: /€\s?65\b/, why: "2025 Altibus Geneva single or 2025 group-lesson price, both superseded" },
  { pattern: /€\s?150\b/, why: "2025 Altibus Geneva single, contradicted by sources" },
  { pattern: /€\s?200\b/, why: "2025 Paris shuttle fare or 2025 taxi estimate, both outdated" },
  { pattern: /€\s?110\b/, why: "2025 Grenoble shuttle fare, marked outdated" },
  { pattern: /€\s?120\b/, why: "2025 Lyon shuttle fare or 2025 day pass, both superseded" },
  { pattern: /€\s?240\b/, why: "2025 Belgium and Netherlands shuttle fares, marked outdated" },
  { pattern: /€\s?1\s?050\b/, why: "2025 Discover Paris price, marked unverifiable" },
  { pattern: /€\s?1\s?400\b/, why: "2025 Discover Paris price, marked unverifiable" },
  { pattern: /€\s?175\b/, why: "2026 Belgium party tent, unresolved and not a Winter figure" },
  { pattern: /€\s?195\b/, why: "2025 Belgium party tent, unresolved" },
  { pattern: /€\s?29\b(?!.*yoga)/, why: "2026 Montagoe breakfast price, unresolved" },
  { pattern: /€\s?89\b(?!.*workshop)/, why: "2025 Signal cheese fondue, marked outdated" },
  { pattern: /€\s?93\b/, why: "2025 Brasa dinner, marked outdated" },
  { pattern: /€\s?80\b(?!.*paragliding)/, why: "2025 4-day equipment-hire price, marked outdated" },
  { pattern: /€\s?165\b/, why: "2025 7-day equipment-hire price, marked outdated" },
  { pattern: /€\s?170\b/, why: "2025 3-half-day group lesson, marked changed (2027 is €222)" },
  { pattern: /€\s?230\b/, why: "2025 6-half-day group lesson, marked changed (2027 is €275)" },
  { pattern: /€\s?220\b/, why: "2025 private half-day lesson, marked changed (2027 is €244)" },
  { pattern: /€\s?660\b/, why: "2025 3-half-day private lesson, marked unverifiable" },
  { pattern: /€\s?440\b/, why: "2025 full-day private lesson, marked outdated" },
  { pattern: /€\s?1\s?320\b/, why: "2025 multi-day private lesson, marked outdated" },
  { pattern: /€\s?2\s?640\b/, why: "2025 multi-day private lesson, marked outdated" },
  { pattern: /€\s?120\b(?!.*transportation)/, why: "2025 off-slope half day, marked changed (2027 is €124)" },
  { pattern: /€\s?160\b/, why: "2025 full-day off-slope, marked unverifiable" },
  { pattern: /€\s?26\b/, why: "2025 Sarenne First Track, marked changed (2027 is €28)" },
  { pattern: /€\s?35\b/, why: "2025 locker or towel price, marked unverifiable" },
  { pattern: /€\s?45\b/, why: "2025 locker price, marked unverifiable" },
  { pattern: /€\s?50\b(?!.*snowshoeing)/, why: "2025 locker or luggage price" },
  { pattern: /€\s?60\b(?!.*dogsled)/, why: "2025 locker, dogsled or 1-day Comfort context" },
  { pattern: /€\s?12\b(?!.*towels)/, why: "2025 towel rental, marked unverifiable" },
  { pattern: /€\s?20\b(?!.*(TRIBU|single|towels|reduced))/, why: "2025 towel price, marked unverifiable" },
  // Taxi fares are unverifiable in the ledger, but €200, €250 and €350 are real
  // 2027 figures for the Transportation Pass window, the parking and the name
  // change, so the ban is scoped to the taxi wording rather than the amount.
  { pattern: /taxi[a-z]*[^.]*€/i, why: "no official taxi tariff is published" },
  { pattern: /€[^.]*taxi/i, why: "no official taxi tariff is published" },
  { pattern: /€\s?4\b/, why: "2025 VR add-on to the Alpine Coaster, marked unverifiable" },
  { pattern: /1\s?Pearl\s*=?\s*€2\.7/, why: "2025 and 2026 Pearl rates, unpublished for 2027" },
  // Names the ledger marks outdated for 2027.
  { pattern: /\bAmare\b/, why: "not in the 2027 line-up; the ledger marks its route outdated" },
  { pattern: /\bReflection of Love\b/, why: "not in the 2027 line-up" },
  { pattern: /Friends by Coke Studio/, why: "not in the 2027 line-up" },
  { pattern: /L'Aventure/, why: "not in the 2027 line-up" },
  { pattern: /\bSnowcat\b/, why: "no 2027 reference to a Snowcat stage" },
  { pattern: /\bCore\b/, why: "2025 stage name, marked outdated" },
  { pattern: /Astera/, why: "Belgium-only accommodation name" },
  { pattern: /Romania/, why: "not an edition TMLGUIDE covers" },
  { pattern: /TicketSwap is official/i, why: "TicketSwap is never an official channel" },
  {
    pattern: /TicketSwap\s+(?:is|as)\s+(?:the\s+|an\s+)?official/i,
    why: "TicketSwap is never an official channel",
  },
  // Prices that must never be asserted for a 2027 figure.
  { pattern: /package[s]?\s+from\s*€/i, why: "no 2027 package minimum is published" },
  { pattern: /€\s?(?:560|130|190)\b/, why: "community-reported 2027 ticket prices, not official" },
  { pattern: /3\s?300\s?m(?!\d)/, why: "summit is 3,330 m per the ledger" },
  { pattern: /1[,.]?800\s?m/, why: "resort altitude is 1,860 m per the ledger" },
];

/** Every string a reader can see, with the block index for a useful failure. */
function readerVisibleText(chapter: GuideChapter): readonly { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [
    { where: "title", text: chapter.title },
    { where: "summary", text: chapter.summary },
  ];
  chapter.blocks.forEach((block, index) => {
    switch (block.type) {
      case "p":
      case "callout":
        out.push({ where: `blocks[${index}].text`, text: block.text });
        if (block.type === "callout") {
          out.push({ where: `blocks[${index}].title`, text: block.title });
        }
        break;
      case "ul":
      case "ol":
        block.items.forEach((item, itemIndex) => {
          out.push({ where: `blocks[${index}].items[${itemIndex}]`, text: item });
        });
        break;
      case "facts":
        out.push({ where: `blocks[${index}].caption`, text: block.caption });
        block.rows.forEach((row, rowIndex) => {
          out.push({ where: `blocks[${index}].rows[${rowIndex}].label`, text: row.label });
          out.push({ where: `blocks[${index}].rows[${rowIndex}].value`, text: row.value });
        });
        break;
      case "h2":
      case "h3":
        out.push({ where: `blocks[${index}].text`, text: block.text });
        break;
      case "data":
        out.push({ where: `blocks[${index}].caption`, text: block.caption });
        break;
      default:
        break;
    }
  });
  return out;
}

describe("winter chapter files", () => {
  it("lists every chapter the edition ships", () => {
    expect(winterChapters.map((chapter) => chapter.slug)).toEqual([
      "overview",
      "tickets-and-packages",
      "accommodation",
      "transport",
      "stages-and-hours",
      "clothing-and-lockers",
      "lessons-and-gear",
      "add-ons",
    ]);
  });

  it.each(winterChapters.map((chapter) => [chapter.slug, chapter] as const))(
    "%s parses with guideChapterSchema",
    (_slug, chapter) => {
      const result = guideChapterSchema.safeParse(chapter);
      if (!result.success) {
        throw new Error(`${chapter.slug}: ${JSON.stringify(result.error.issues, null, 2)}`);
      }
      expect(result.success).toBe(true);
    },
  );

  it("every chapter declares the winter edition and a verified date", () => {
    for (const chapter of winterChapters) {
      expect(chapter.edition, `chapter "${chapter.slug}"`).toBe("winter");
      expect(chapter.lastVerified, `chapter "${chapter.slug}"`).toBe(VERIFIED_ON);
    }
  });

  it("every chapter cites at least one source checked on the verification date", () => {
    for (const chapter of winterChapters) {
      expect(chapter.sources.length, `chapter "${chapter.slug}"`).toBeGreaterThan(0);
      for (const source of chapter.sources) {
        expect(source.checkedOn, `chapter "${chapter.slug}" source ${source.id}`).toBe(VERIFIED_ON);
        expect(source.url.startsWith("https://")).toBe(true);
      }
    }
  });

  it("no block that states a fact is left uncited", () => {
    const offenders: string[] = [];
    for (const chapter of winterChapters) {
      for (const index of uncitedFactBlocks(chapter)) {
        offenders.push(`${chapter.slug} blocks[${index}]`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every facts row cites a source the chapter declares", () => {
    const offenders: string[] = [];
    for (const chapter of winterChapters) {
      const ids = new Set(chapter.sources.map((source) => source.id));
      chapter.blocks.forEach((block, index) => {
        if (block.type !== "facts") return;
        block.rows.forEach((row, rowIndex) => {
          expect(row.sources.length, `${chapter.slug} blocks[${index}] row ${rowIndex}`).toBeGreaterThan(0);
          for (const ref of row.sources) {
            if (!ids.has(ref)) {
              offenders.push(`${chapter.slug} blocks[${index}] row ${rowIndex} -> ${ref}`);
            }
          }
        });
      });
    }
    expect(offenders).toEqual([]);
  });

  it("slugs and orders are unique, and orders are a contiguous run from 1", () => {
    const slugs = winterChapters.map((chapter) => chapter.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    const orders = winterChapters.map((chapter) => chapter.order);
    expect(new Set(orders).size).toBe(orders.length);
    expect([...orders].sort((a, b) => a - b)).toEqual(
      Array.from({ length: winterChapters.length }, (_, index) => index + 1),
    );
  });

  it("every related target is a chapter that exists", () => {
    const dangling: string[] = [];
    for (const chapter of winterChapters) {
      for (const related of chapter.related) {
        const [edition, slug] = related.split("/");
        const known = EDITION_CHAPTER_SLUGS[edition ?? ""];
        if (!known || !slug || !known.includes(slug)) {
          dangling.push(`${chapter.slug} -> ${related}`);
        }
      }
      expect(chapter.related, `chapter "${chapter.slug}"`).not.toContain(`winter/${chapter.slug}`);
    }
    expect(dangling).toEqual([]);
  });

  it("no chapter links to itself through a related entry", () => {
    const selfLinks = winterChapters
      .filter((chapter) => chapter.related.includes(`winter/${chapter.slug}`))
      .map((chapter) => chapter.slug);
    expect(selfLinks).toEqual([]);
  });
});

describe("winter chapter sources", () => {
  it("reads both ledgers", () => {
    expect(LEDGERS_AVAILABLE).toBe(true);
    expect(ledgerText).toContain("# Fact-check: Tomorrowland Winter (Alpe d'Huez)");
    expect(ledgerText).toContain("## 4. Locker prices and sizes");
  });

  it("every source URL appears verbatim in a Winter ledger", () => {
    const missing: string[] = [];
    for (const chapter of winterChapters) {
      for (const source of chapter.sources) {
        if (!ledgerText.includes(source.url)) {
          missing.push(`${chapter.slug} ${source.id} -> ${source.url}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("no chapter cites a URL outside the ledgers, even in inline prose", () => {
    const missing: string[] = [];
    for (const chapter of winterChapters) {
      for (const { where, text } of readerVisibleText(chapter)) {
        for (const match of text.matchAll(/\((https:\/\/[^\s)]+)\)/g)) {
          const url = match[1];
          if (url && !ledgerText.includes(url)) {
            missing.push(`${chapter.slug} ${where} -> ${url}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("winter chapter figures", () => {
  it.each(SUPERSEDED_STRINGS.map((entry) => [entry.pattern.source, entry] as const))(
    "does not publish a superseded figure or name (%s)",
    (_patternSource, entry) => {
      const offenders: string[] = [];
      for (const chapter of winterChapters) {
        for (const { where, text } of readerVisibleText(chapter)) {
          if (entry.pattern.test(text)) {
            offenders.push(`${chapter.slug} ${where}: "${text}" (${entry.why})`);
          }
        }
      }
      expect(offenders).toEqual([]);
    },
  );

  it("never presents the Altibus Geneva route as a working service", () => {
    // Only a sentence that asserts the route runs is a problem; naming Geneva as
    // a published shuttle departure point is accurate and is what the official
    // 2027 page lists.
    const offenders: string[] = [];
    for (const chapter of winterChapters) {
      for (const { where, text } of readerVisibleText(chapter)) {
        if (!/Geneva/.test(text)) continue;
        const assertsItRuns =
          /(shuttle|coach|transfer)[^.]*\b(runs|run|operates|is available|is running)\b/i.test(text);
        const carriesCaveat = /did not run|not run|not operat|suspended|confirm/i.test(text);
        if (assertsItRuns && !carriesCaveat) {
          offenders.push(`${chapter.slug} ${where}: "${text}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("states the Geneva suspension wherever the Geneva route is offered", () => {
    const genevaChapters = winterChapters.filter((chapter) =>
      chapter.blocks.some(
        (block) =>
          block.type === "p" &&
          /Geneva/.test(block.text) &&
          /shuttle|coach|transfer/i.test(block.text),
      ),
    );
    expect(genevaChapters.map((chapter) => chapter.slug).sort()).toEqual([
      "add-ons",
      "transport",
    ]);
    for (const chapter of genevaChapters) {
      const text = readerVisibleText(chapter)
        .map((entry) => entry.text)
        .join("\n");
      expect(text, `chapter "${chapter.slug}"`).toMatch(/did not run|not operat/i);
    }
  });

  it("names the Exchange Desk as the only official resale route", () => {
    const text = winterChapters
      .flatMap((chapter) => readerVisibleText(chapter))
      .map((entry) => entry.text)
      .join("\n");
    expect(text).toContain("Exchange Desk");
    expect(text).toMatch(/only official resale/i);
  });

  it("states the winter-equipment rule as either four winter tyres or anti-slip devices", () => {
    const text = winterChapters
      .flatMap((chapter) => readerVisibleText(chapter))
      .map((entry) => entry.text)
      .join("\n");
    expect(text).toMatch(/four winter tyres|four 3PMSF/i);
    expect(text).toMatch(/removable anti-slip devices/i);
    expect(text).toMatch(/1 November to 31 March/);
  });

  it("never claims snow chains are mandatory", () => {
    const offenders = winterChapters
      .filter((chapter) =>
        readerVisibleText(chapter).some((entry) => /chains are mandatory|must carry chains/i.test(entry.text)),
      )
      .map((chapter) => chapter.slug);
    expect(offenders).toEqual([]);
  });
});

describe("winter data blocks", () => {
  /** Collection id prefixes the Winter data files can satisfy, by block collection. */
  const knownIds: Readonly<Record<string, readonly string[]>> = {
    tickets: winterTickets.map((record) => record.id),
    "sale-windows": winterSaleWindows.map((record) => record.id),
    "add-ons": winterAddOns.map((record) => record.id),
    faqs: winterFaqs.map((record) => record.id),
    stages: winterStages.map((record) => record.id),
    shuttles: winterShuttles.map((record) => record.id),
    // The Winter accommodation dataset is empty by design, so a `data` block
    // naming it has nothing to render and must not be written.
    accommodation: [],
  };

  const dataBlocks = winterChapters.flatMap((chapter) =>
    chapter.blocks
      .filter((block) => block.type === "data")
      .map((block) => ({ chapter: chapter.slug, block })),
  );

  it("references only collections the Winter data index exports", () => {
    for (const { chapter, block } of dataBlocks) {
      expect(Object.keys(knownIds), `${chapter} -> ${block.collection}`).toContain(block.collection);
    }
  });

  it("every data block declares the winter edition", () => {
    for (const { chapter, block } of dataBlocks) {
      expect(block.edition, `${chapter} -> ${block.collection}`).toBe("winter");
    }
  });

  it("every idPrefix matches at least one Winter record", () => {
    const unmatched: string[] = [];
    for (const { chapter, block } of dataBlocks) {
      if (!block.idPrefix) continue;
      const ids = knownIds[block.collection] ?? [];
      if (!ids.some((id) => id.startsWith(block.idPrefix as string))) {
        unmatched.push(`${chapter} -> ${block.collection}/${block.idPrefix}`);
      }
    }
    expect(unmatched).toEqual([]);
  });

  it("never points a data block at empty accommodation data", () => {
    const offenders = dataBlocks
      .filter((entry) => entry.block.collection === "accommodation")
      .map((entry) => entry.chapter);
    expect(offenders).toEqual([]);
  });

  it("shows the published ticket price through a data block rather than in prose", () => {
    const tickets = winterChapters.find((chapter) => chapter.slug === "tickets-and-packages");
    expect(tickets).toBeDefined();
    const usesData = tickets?.blocks.some(
      (block) => block.type === "data" && block.collection === "tickets",
    );
    expect(usesData).toBe(true);
    const prose = tickets ? readerVisibleText(tickets).map((entry) => entry.text).join(" ") : "";
    expect(prose).not.toMatch(/€\s?735\b/);
  });

  it("shows the Add-On Sale window through a data block", () => {
    const addOns = winterChapters.find((chapter) => chapter.slug === "add-ons");
    const usesData = addOns?.blocks.some(
      (block) => block.type === "data" && block.collection === "sale-windows",
    );
    expect(usesData).toBe(true);
  });

  it("renders the shuttle fares where the chapter discusses them, not in prose", () => {
    const transport = winterChapters.find((chapter) => chapter.slug === "transport");
    expect(transport).toBeDefined();
    const shuttleBlocks =
      transport?.blocks.filter((block) => block.type === "data" && block.collection === "shuttles") ?? [];
    expect(shuttleBlocks.length).toBeGreaterThanOrEqual(3);

    // Every shuttle record is reachable through a block, so no fare is left to prose.
    for (const shuttle of winterShuttles) {
      const covered = shuttleBlocks.some(
        (block) =>
          block.type === "data" &&
          (block.idPrefix === undefined || shuttle.id.startsWith(block.idPrefix)),
      );
      expect(covered, `shuttle ${shuttle.id} is not covered by a data block`).toBe(true);
    }
  });

  it("puts the Altibus fare next to the Geneva caveat, in a block of its own", () => {
    const transport = winterChapters.find((chapter) => chapter.slug === "transport");
    if (transport === undefined) throw new Error("the transport chapter is missing");

    const genevaHeading = transport.blocks.findIndex(
      (block) => block.type === "h2" && block.id === "the-geneva-caveat",
    );
    expect(genevaHeading).toBeGreaterThan(-1);

    const altibusBlock = transport.blocks.findIndex(
      (block) =>
        block.type === "data" &&
        block.collection === "shuttles" &&
        block.idPrefix?.startsWith("altibus") === true,
    );
    expect(altibusBlock).toBeGreaterThan(genevaHeading);

    // The caveat prose stays exactly where it was, before the fare it qualifies.
    const caveat = transport.blocks.find(
      (block) => block.type === "callout" && block.title.includes("Geneva"),
    );
    expect(caveat).toBeDefined();
    if (caveat?.type !== "callout") throw new Error("unreachable");
    expect(caveat.text).toMatch(/did not operate in winter 2025\/26/);
  });
});

describe("winter chapters agree with the validated dataset", () => {
  const prose = winterChapters
    .flatMap((chapter) => readerVisibleText(chapter))
    .map((entry) => entry.text)
    .join("\n");

  it("names every stage the stage dataset records, in prose or in the stage data block", () => {
    /* The roster is rendered from `src/data/winter/stages.ts` by a `data` block,
       so a stage name is "shown" when it appears in the chapter text or when a
       stage block selects its record. A block with no prefix selects every
       record, exactly as the renderer's own filter does. */
    const stageBlocks = winterChapters.flatMap((chapter) =>
      chapter.blocks.filter((block) => block.type === "data" && block.collection === "stages"),
    );
    const shownByABlock = (id: string): boolean =>
      stageBlocks.some(
        (block) =>
          block.type === "data" &&
          (block.idPrefix === undefined || id.startsWith(block.idPrefix)),
      );
    const missing = winterStages
      .filter((stage) => !prose.includes(stage.name) && !shownByABlock(stage.id))
      .map((stage) => stage.name);
    expect(missing).toEqual([]);
  });

  it("renders the whole winter stage roster in one stage data block", () => {
    const stageBlocks = winterChapters.flatMap((chapter) =>
      chapter.blocks.filter((block) => block.type === "data" && block.collection === "stages"),
    );
    expect(stageBlocks).toHaveLength(1);
    const [block] = stageBlocks;
    if (block === undefined || block.type !== "data") throw new Error("no stage block");
    const covered = winterStages.filter(
      (stage) => block.idPrefix === undefined || stage.id.startsWith(block.idPrefix),
    );
    expect(covered.map((stage) => stage.name).sort()).toEqual(
      winterStages.map((stage) => stage.name).sort(),
    );
  });
  it("quotes the published hours exactly as the fact records define them", () => {
    const required = winterFacts.filter((fact) =>
      [
        "mountain-stage-opening-hours",
        "main-area-hours",
        "main-area-last-admission",
        "moosebar-day-slot",
      ].includes(fact.id),
    );
    expect(required.length).toBe(4);
    for (const fact of required) {
      expect(prose, `fact "${fact.id}"`).toContain(fact.value);
    }
  });

  it("shows the Transportation Pass through a data block rather than typing its price", () => {
    const pass = winterAddOns.find((record) => record.id === "transportation-pass-2027");
    expect(pass).toBeDefined();
    const transport = winterChapters.find((chapter) => chapter.slug === "transport");
    const usesData = transport?.blocks.some(
      (block) =>
        block.type === "data" &&
        block.collection === "add-ons" &&
        block.idPrefix === "transportation-pass",
    );
    expect(usesData).toBe(true);
    // The price itself must not be retyped, in this chapter or any other.
    expect(prose).not.toContain(`€${pass?.priceEur}`);
  });

  it("traces every euro figure in prose to a validated Winter fact", () => {
    // Chapters may name a price in prose only when a `winterFacts` record holds
    // the same figure; anything else must be shown through a `data` block. This
    // is what stops a price drifting in the chapter while the record stays put.
    const factText = winterFacts.map((fact) => `${fact.value} ${fact.detail ?? ""}`).join("\n");
    const offenders: string[] = [];
    for (const chapter of winterChapters) {
      for (const { where, text } of readerVisibleText(chapter)) {
        for (const match of text.matchAll(/€\s?\d[\d,.]*/g)) {
          const figure = match[0].replace(/\s/g, "");
          if (!factText.includes(figure)) {
            offenders.push(`${chapter.slug} ${where}: ${figure}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not type a ticket or add-on price that a data block already renders", () => {
    const priced = [
      ...winterTickets.map((record) => record.priceEur),
      ...winterAddOns.map((record) => record.priceEur),
    ];
    const offenders: string[] = [];
    for (const chapter of winterChapters) {
      for (const { where, text } of readerVisibleText(chapter)) {
        for (const amount of priced) {
          const variants = [`€${amount}`, `€${amount.toFixed(2)}`, `€ ${amount}`];
          if (variants.some((variant) => text.includes(variant))) {
            offenders.push(`${chapter.slug} ${where}: ${amount}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never retypes a coach fare that the shuttle data block renders instead", () => {
    // The shuttle records are rendered by a `data` block, so a fare typed into
    // prose would be a second copy that no renderer keeps in step with the
    // record. The block prints the price, the operator and the operator's own
    // notes; the chapter text must not print the figure at all.
    const offenders: string[] = [];
    for (const shuttle of winterShuttles) {
      const formatted = `€${shuttle.priceEur.toFixed(2)}`;
      const rounded = `€${Math.round(shuttle.priceEur)}`;
      for (const { where, text } of winterChapters.flatMap((chapter) =>
        readerVisibleText(chapter).map((entry) => ({ where: `${chapter.slug} ${entry.where}`, text: entry.text })),
      )) {
        if (text.includes(formatted) || new RegExp(`${rounded}\\b`).test(text)) {
          offenders.push(`${where}: ${shuttle.id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("winter chapter shape", () => {  it("gives every chapter an h2 and a summary inside the schema limits", () => {
    for (const chapter of winterChapters) {
      expect(chapter.blocks.some((block) => block.type === "h2")).toBe(true);
      expect(chapter.summary.length, `chapter "${chapter.slug}"`).toBeGreaterThanOrEqual(40);
      expect(chapter.summary.length, `chapter "${chapter.slug}"`).toBeLessThanOrEqual(200);
    }
  });

  it("keeps heading text short enough to scan and ids unique within a chapter", () => {
    for (const chapter of winterChapters) {
      const ids = new Set<string>();
      for (const block of chapter.blocks) {
        if (block.type !== "h2" && block.type !== "h3") continue;
        expect(block.text.length, `${chapter.slug} heading "${block.text}"`).toBeLessThanOrEqual(120);
        expect(ids.has(block.id), `${chapter.slug} duplicate heading id ${block.id}`).toBe(false);
        ids.add(block.id);
      }
    }
  });

  it("uses UK spelling and miles rather than kilometres", () => {
    const offenders: string[] = [];
    for (const chapter of winterChapters) {
      for (const { where, text } of readerVisibleText(chapter)) {
        if (/\bkilomet(er|re)s?\b|\bkm\b/.test(text)) {
          offenders.push(`${chapter.slug} ${where}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("carries at least one callout per chapter where a rule changes a decision", () => {
    const missing = winterChapters
      .filter((chapter) => !chapter.blocks.some((block) => block.type === "callout"))
      .map((chapter) => chapter.slug);
    expect(missing).toEqual([]);
  });

  it("gives at least one warning callout per chapter, for money or a deadline", () => {
    const missing = winterChapters
      .filter(
        (chapter) =>
          !chapter.blocks.some((block) => block.type === "callout" && block.tone === "warning"),
      )
      .map((chapter) => chapter.slug);
    expect(missing).toEqual([]);
  });
});
