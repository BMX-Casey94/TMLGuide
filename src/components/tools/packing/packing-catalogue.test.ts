// @vitest-environment node
import { describe, expect, it } from "vitest";

import { guideRegistry } from "@/content";
import { belgiumData } from "@/data/belgium";
import { brasilData } from "@/data/brasil";
import { sharedData } from "@/data/shared";
import { winterData } from "@/data/winter";
import {
  PACKING_EDITIONS,
  PACKING_SECTIONS,
  PACKING_STAYS,
  packingCatalogueSchema,
  packingGuides,
  packingItems,
  SUGGESTION_LABEL,
  guideForEdition,
  type PackingOfficialItem,
} from "./packing-catalogue";

/**
 * The evidence trail for every `official` item.
 *
 * Each official item claims a page and a check date. This file collects the
 * URLs and dates the repository actually holds — from the typed data records and
 * from the guide chapters' sources — and proves that every claim is present in
 * one of them. A citation that no other file cites fails here rather than
 * shipping as a link nobody checked.
 */

interface KnownSource {
  readonly url: string;
  readonly checkedOn: string;
  /** Where in the repo this citation lives, for the failure message. */
  readonly from: string;
}

function dataSources(): KnownSource[] {
  const sources: KnownSource[] = [];
  const add = (from: string, source: { url: string; retrievedOn: string }): void => {
    sources.push({ url: source.url, checkedOn: source.retrievedOn, from });
  };

  for (const faq of belgiumData.faqs) add(`belgium faq ${faq.id}`, faq.source);
  for (const faq of winterData.faqs) add(`winter faq ${faq.id}`, faq.source);
  for (const faq of sharedData.faqs) add(`shared faq ${faq.id}`, faq.source);
  for (const fact of belgiumData.facts ? Object.values(belgiumData.facts) : []) {
    if (typeof fact === "object" && fact !== null && "source" in fact) {
      const record = fact as { source: { url: string; retrievedOn: string } };
      add("belgium fact", record.source);
    }
  }
  for (const fact of winterData.facts) add(`winter fact ${fact.id}`, fact.source);
  for (const record of brasilData.facts) add(`brasil fact ${record.id}`, record.source);
  for (const record of belgiumData.accommodation) add(`belgium accommodation ${record.id}`, record.source);
  for (const record of belgiumData.tickets) add(`belgium ticket ${record.id}`, record.source);
  for (const record of winterData.tickets) add(`winter ticket ${record.id}`, record.source);

  return sources;
}

function guideSources(): KnownSource[] {
  const sources: KnownSource[] = [];
  for (const chapters of Object.values(guideRegistry.byEdition)) {
    for (const chapter of chapters) {
      for (const source of chapter.sources) {
        sources.push({
          url: source.url,
          checkedOn: source.checkedOn,
          from: `${chapter.edition}/${chapter.slug} ${source.id}`,
        });
      }
    }
  }
  return sources;
}

/**
 * Every URL the Winter facts point at, including the ones whose check date the
 * data keeps on the record rather than on the source object.
 */
const ALL_SOURCES: readonly KnownSource[] = [...dataSources(), ...guideSources()];

const OFFICIAL_ITEMS = packingItems.filter(
  (item): item is PackingOfficialItem => item.basis === "official",
);

describe("packing catalogue: sourcing", () => {
  it("has at least one official item, so the check is not vacuous", () => {
    expect(OFFICIAL_ITEMS.length).toBeGreaterThan(10);
  });

  it("gives every official item a source URL and a check date", () => {
    for (const item of OFFICIAL_ITEMS) {
      expect({ id: item.id, url: typeof item.sourceUrl }).toEqual({ id: item.id, url: "string" });
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      expect(item.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("cites only pages this repository already holds, on the date it holds them", () => {
    const problems: string[] = [];

    for (const item of OFFICIAL_ITEMS) {
      const matches = ALL_SOURCES.filter(
        (source) => source.url === item.sourceUrl && source.checkedOn === item.checkedOn,
      );
      if (matches.length === 0) {
        const sameUrl = ALL_SOURCES.filter((source) => source.url === item.sourceUrl);
        problems.push(
          sameUrl.length === 0
            ? `${item.id}: ${item.sourceUrl} appears in no data or guide source`
            : `${item.id}: ${item.sourceUrl} is held with checkedOn ${[
                ...new Set(sameUrl.map((source) => source.checkedOn)),
              ].join(", ")}, not ${item.checkedOn}`,
        );
      }
    }

    expect(problems).toEqual([]);
  });

  it("cites only pages held by the edition the item belongs to", () => {
    const problems: string[] = [];

    for (const item of OFFICIAL_ITEMS) {
      const origins = ALL_SOURCES.filter((source) => source.url === item.sourceUrl).map(
        (source) => source.from,
      );
      if (origins.length === 0) continue;
      const editionMismatch = item.editions.some((edition) => {
        // A shared FAQ or a general chapter is valid for any edition; the check
        // only rejects a page whose every citation comes from another edition.
        const fromOtherEditions = origins.every((origin) => !origin.startsWith(edition));
        const sharedOrGeneral = origins.some((origin) => origin.startsWith("shared") || origin.startsWith("general/"));
        return fromOtherEditions && !sharedOrGeneral;
      });
      if (editionMismatch) problems.push(`${item.id}: ${origins.join(" | ")}`);
    }

    expect(problems).toEqual([]);
  });

  it("gives every official note in the edition guidance a held citation", () => {
    const problems: string[] = [];
    for (const guide of packingGuides) {
      for (const note of [...guide.notAllowed, ...guide.included]) {
        const held = ALL_SOURCES.some(
          (source) => source.url === note.sourceUrl && source.checkedOn === note.checkedOn,
        );
        if (!held) problems.push(`${guide.edition}: ${note.sourceUrl} @ ${note.checkedOn}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("packing catalogue: content rules", () => {
  it("never gives a suggestion a rule or a citation", () => {
    for (const item of packingItems) {
      if (item.basis !== "suggestion") continue;
      expect(Object.keys(item).sort()).toEqual(
        ["basis", "editions", "id", "label", "section", ...(item.stays === undefined ? [] : ["stays"])].sort(),
      );
    }
  });

  it("labels suggestions with the exact wording the interface shows", () => {
    expect(SUGGESTION_LABEL).toBe("Suggestion, not an official requirement");
  });

  it("states no quantity, bag size or fee in any item label", () => {
    const forbidden = [
      /\b\d+\s*(?:x|×)\s/i,
      /\b\d+\s*(?:litre|liter|l\b|ml\b)/i,
      /\b\d+\s*(?:kg|g\b|cm|mm|m\b)/i,
      /\b€\s?\d/,
      /\bR\$\s?\d/,
    ];
    const problems: string[] = [];
    for (const item of packingItems) {
      for (const pattern of forbidden) {
        if (pattern.test(item.label)) problems.push(`${item.id}: "${item.label}" vs ${pattern}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("states only figures its own cited record states", () => {
    /*
      Every figure in the catalogue has to already exist in the data layer. The
      list below is exhaustive on purpose: a new item that introduces a number
      fails this test until the figure is shown to come from a record.
    */
    const figures: Readonly<Record<string, readonly string[]>> = {
      "belgium-perfume": ["100 ml"],
      "belgium-tent": ["1", "2"],
      "winter-baggage": ["2 kg", "10 to 12 kg"],
      "winter-bracelet": ["€15", "€22"],
      "winter-locker": ["4 or 7 days"],
      "winter-ski-kit": ["3300"],
      "winter-transport-pass": ["€40"],
      "winter-tyres": ["1 November", "31 March"],
    };

    const withFigures = OFFICIAL_ITEMS.filter((item) => /\d/.test(item.rule)).map((item) => item.id).sort();
    expect(withFigures).toEqual(Object.keys(figures).sort());

    for (const [id, expected] of Object.entries(figures)) {
      const item = OFFICIAL_ITEMS.find((candidate) => candidate.id === id);
      expect(item, id).toBeDefined();
      for (const figure of expected) {
        expect(item?.rule, `${id} should state ${figure}`).toContain(figure);
      }
    }
  });

  it("matches its stated figures to the records that carry them", () => {
    const byId = new Map(OFFICIAL_ITEMS.map((item) => [item.id, item]));
    const rule = (id: string): string => byId.get(id)?.rule ?? "";

    // €40 Transportation Pass and the €15 / €22 Treasure Case fees are Winter facts.
    expect(winterData.facts.find((fact) => fact.id === "transportation-pass-price")?.amountEur).toBe(40);
    expect(rule("winter-transport-pass")).toContain("€40");
    expect(winterData.facts.find((fact) => fact.id === "treasure-case-fee-eu")?.amountEur).toBe(15);
    expect(winterData.facts.find((fact) => fact.id === "treasure-case-fee-worldwide")?.amountEur).toBe(22);
    expect(rule("winter-bracelet")).toContain("€15");
    expect(rule("winter-bracelet")).toContain("€22");

    // The 100 ml perfume allowance is the Belgium forbidden-objects FAQ.
    expect(belgiumData.faqs.find((faq) => faq.id === "bringing-food-and-drink")?.answer).toContain("100 ml");
    expect(rule("belgium-perfume")).toContain("100 ml");

    // The winter-tyre window and the 500 g gas limit are in their own records.
    expect(winterData.facts.find((fact) => fact.id === "winter-equipment-rule")?.value).toContain(
      "1 November to 31 March",
    );
    expect(belgiumData.faqs.find((faq) => faq.id === "what-is-banned-on-site")?.answer).toContain("500 g");

    // The locker durations come from the Winter locker fact.
    expect(winterData.facts.find((fact) => fact.id === "locker-areas-and-durations")?.value).toContain(
      "4 or 7 days",
    );
  });

  it("says plainly that locker prices are unpublished for both editions", () => {
    const winter = guideForEdition("winter");
    expect(winter.unpublished.some((gap) => /locker price/i.test(gap.text))).toBe(true);

    const belgium = guideForEdition("belgium");
    expect(belgium.unpublished.some((gap) => /locker price/i.test(gap.text))).toBe(true);

    // Both data files hold no locker record, which is the reason for the gap.
    expect(belgiumData.lockers).toEqual([]);
    expect(winterData.lockers).toEqual([]);
  });

  it("claims no prohibited-item list for an edition whose data has none", () => {
    for (const edition of ["winter", "brasil"] as const) {
      const guide = guideForEdition(edition);
      expect(guide.notAllowed).toEqual([]);
      expect(guide.notAllowedGap).toBeDefined();
      expect(guide.notAllowedGap).toMatch(/prohibited items/i);
    }
    // Belgium does have one, and cites it.
    expect(guideForEdition("belgium").notAllowed.length).toBeGreaterThan(4);
  });

  it("does not copy the community packing PDF", () => {
    const driveHost = "drive.google.com";
    const serialised = JSON.stringify({ items: packingItems, guides: packingGuides });
    expect(serialised).not.toContain(driveHost);
  });
});

describe("packing catalogue: structure", () => {
  it("parses through its own schema", () => {
    expect(() => packingCatalogueSchema.parse({ items: packingItems, guides: packingGuides })).not.toThrow();
  });

  it("covers every edition and uses only known sections", () => {
    const sectionIds = new Set(PACKING_SECTIONS.map((section) => section.id));
    for (const edition of PACKING_EDITIONS) {
      expect(packingItems.some((item) => item.editions.includes(edition))).toBe(true);
    }
    for (const item of packingItems) {
      expect(sectionIds.has(item.section)).toBe(true);
    }
  });

  it("names stays only where the stay belongs to a listed edition", () => {
    for (const item of packingItems) {
      if (item.stays === undefined) continue;
      for (const stay of item.stays) {
        const option = PACKING_STAYS.find((candidate) => candidate.id === stay);
        expect(option).toBeDefined();
        expect(item.editions).toContain(option?.edition);
      }
    }
  });

  it("has exactly one guidance record per edition", () => {
    expect(packingGuides.map((guide) => guide.edition).sort()).toEqual([...PACKING_EDITIONS].sort());
  });

  it("rejects a catalogue with two items sharing an id", () => {
    const duplicate = [packingItems[0], packingItems[0]];
    expect(() => packingCatalogueSchema.parse({ items: duplicate, guides: packingGuides })).toThrow(
      /duplicate item id/i,
    );
  });

  it("rejects an official item with no source URL", () => {
    const broken = {
      ...OFFICIAL_ITEMS[0],
      sourceUrl: undefined,
    };
    expect(() => packingCatalogueSchema.parse({ items: [broken], guides: packingGuides })).toThrow();
  });

  it("rejects a suggestion that carries a rule", () => {
    const broken = {
      id: "bad-suggestion",
      section: "tech",
      basis: "suggestion",
      label: "A charger",
      editions: ["belgium"],
      rule: "Bring a charger.",
    };
    expect(() => packingCatalogueSchema.parse({ items: [broken], guides: packingGuides })).toThrow();
  });
});
