// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  accommodationSchema,
  addOnSchema,
  assertUniqueIds,
  faqSchema,
  lockerSchema,
  pearlBundleSchema,
  saleWindowSchema,
  shuttleSchema,
  stageSchema,
  ticketPackageSchema,
} from "../schemas";
import {
  accommodation,
  addOns,
  belgiumData,
  belgiumFacts,
  belgiumFactsSchema,
  faqs,
  lockers,
  pearlBundles,
  saleWindows,
  shuttles,
  stages,
  tickets,
  validateBelgiumData,
} from "./index";

const VERIFIED_ON = "2026-11-18";

/**
 * The ledger and the conflicts file, read once. Every citation in the Belgium
 * data must appear verbatim in one of them, so a URL cannot be typed from
 * memory or pointed at a page nobody checked.
 */
const ledgerText = ["docs/factcheck/belgium.md", "docs/factcheck/conflicts.md"]
  .map((relativePath) => readFileSync(path.resolve(process.cwd(), relativePath), "utf8"))
  .join("\n\n");

type SourcedRecord = {
  id: string;
  edition: string;
  source: { url: string; title: string; retrievedOn: string };
  lastVerified: string;
  confidence: string;
};

/** A `{ value, source, lastVerified }` leaf inside the facts object. */
type FactLeaf = {
  source: { url: string };
  lastVerified: string;
};

const collections: readonly { label: string; items: readonly SourcedRecord[] }[] = [
  { label: "saleWindows", items: saleWindows },
  { label: "tickets", items: tickets },
  { label: "accommodation", items: accommodation },
  { label: "shuttles", items: shuttles },
  { label: "addOns", items: addOns },
  { label: "lockers", items: lockers },
  { label: "stages", items: stages },
  { label: "faqs", items: faqs },
  { label: "pearlBundles", items: pearlBundles },
];

const allRecords = collections.flatMap(({ label, items }) => items.map((item) => ({ label, item })));

/** Collects every `{ value, source, lastVerified }` leaf from the facts object. */
function factLeaves(facts: unknown): { path: string; leaf: FactLeaf }[] {
  const leaves: { path: string; leaf: FactLeaf }[] = [];

  const walk = (node: unknown, at: string): void => {
    if (node === null || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.source === "object" && record.source !== null && "url" in (record.source as object)) {
      leaves.push({ path: at, leaf: record as unknown as FactLeaf });
      return;
    }
    for (const [key, child] of Object.entries(record)) {
      walk(child, at === "" ? key : `${at}.${key}`);
    }
  };

  walk(facts, "");
  return leaves;
}

describe("belgium data", () => {
  it("validates every collection without throwing", () => {
    expect(() => validateBelgiumData()).not.toThrow();
  });

  it("parses each collection through its own schema", () => {
    const pairs: readonly [string, { safeParse: (value: unknown) => { success: boolean } }, readonly unknown[]][] = [
      ["saleWindows", saleWindowSchema, saleWindows],
      ["tickets", ticketPackageSchema, tickets],
      ["accommodation", accommodationSchema, accommodation],
      ["shuttles", shuttleSchema, shuttles],
      ["addOns", addOnSchema, addOns],
      ["lockers", lockerSchema, lockers],
      ["stages", stageSchema, stages],
      ["faqs", faqSchema, faqs],
      ["pearlBundles", pearlBundleSchema, pearlBundles],
    ];

    for (const [label, schema, items] of pairs) {
      for (const item of items) {
        const result = schema.safeParse(item);
        if (!result.success) {
          throw new Error(`${label} record failed its schema: ${JSON.stringify(item)}`);
        }
      }
    }
  });

  it("parses the facts object through its local schema", () => {
    expect(belgiumFactsSchema.safeParse(belgiumFacts).success).toBe(true);
    expect(belgiumFacts.edition).toBe("belgium");
  });

  it("exposes the same records through belgiumData", () => {
    expect(belgiumData.saleWindows).toHaveLength(saleWindows.length);
    expect(belgiumData.faqs).toHaveLength(faqs.length);
    expect(belgiumData.facts).toEqual(belgiumFacts);
  });

  it("gives every record a unique id within its collection", () => {
    for (const { label, items } of collections) {
      const ids = items.map((item) => item.id);
      expect(new Set(ids).size, `${label} has duplicate ids`).toBe(ids.length);
    }
  });

  it("rejects a duplicated id, as validateBelgiumData would", () => {
    const duplicated = [...saleWindows, saleWindows[0]];
    expect(() => assertUniqueIds(duplicated)).toThrow(/duplicate id/);
  });

  it("marks every record and fact as verified on 2026-11-18", () => {
    for (const { label, item } of allRecords) {
      expect(item.lastVerified, `${label} record ${item.id}`).toBe(VERIFIED_ON);
    }
    for (const { path: at, leaf } of factLeaves(belgiumFacts)) {
      expect(leaf.lastVerified, `fact at ${at}`).toBe(VERIFIED_ON);
    }
  });

  it("marks every record as official confidence and scoped to Belgium", () => {
    for (const { label, item } of allRecords) {
      expect(item.confidence, `${label} record ${item.id}`).toBe("official");
      expect(item.edition, `${label} record ${item.id}`).toBe("belgium");
    }
  });

  it("uses only https source URLs", () => {
    for (const { label, item } of allRecords) {
      expect(item.source.url.startsWith("https://"), `${label} record ${item.id}`).toBe(true);
    }
    for (const { path: at, leaf } of factLeaves(belgiumFacts)) {
      expect(leaf.source.url.startsWith("https://"), `fact at ${at}`).toBe(true);
    }
  });

  it("cites only source URLs that appear in the fact-check ledger or the conflicts file", () => {
    const missing: string[] = [];

    for (const { label, item } of allRecords) {
      if (!ledgerText.includes(item.source.url)) {
        missing.push(`${label} record "${item.id}": ${item.source.url}`);
      }
    }
    for (const { path: at, leaf } of factLeaves(belgiumFacts)) {
      if (!ledgerText.includes(leaf.source.url)) {
        missing.push(`fact at ${at}: ${leaf.source.url}`);
      }
    }

    expect(missing, `URLs missing from the ledger:\n${missing.join("\n")}`).toEqual([]);
  });

  it("never stores a negative money value", () => {
    const amounts: { label: string; value: number }[] = [];

    const collect = (node: unknown, at: string): void => {
      if (typeof node === "number") {
        amounts.push({ label: at, value: node });
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((child, index) => collect(child, `${at}[${index}]`));
        return;
      }
      if (node !== null && typeof node === "object") {
        for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
          collect(child, at === "" ? key : `${at}.${key}`);
        }
      }
    };

    for (const { label, items } of collections) {
      items.forEach((item, index) => collect(item, `${label}[${index}]`));
    }
    collect(belgiumFacts, "facts");

    for (const { label, value } of amounts) {
      expect(value, `${label} is negative`).toBeGreaterThanOrEqual(0);
    }
  });

  it("publishes the three public sale moments plus Global Journey at the documented instants", () => {
    expect(saleWindows.map((window) => window.id).sort()).toEqual(
      ["global-journey-sale", "worldwide-pre-sale", "worldwide-ticket-sale"].sort(),
    );

    const byId = new Map(saleWindows.map((window) => [window.id, window]));

    expect(byId.get("global-journey-sale")?.opensAt).toBe("2027-01-30T17:00:00+01:00");
    expect(byId.get("worldwide-pre-sale")?.opensAt).toBe("2027-02-06T17:00:00+01:00");
    expect(byId.get("worldwide-ticket-sale")?.opensAt).toBe("2027-02-13T17:00:00+01:00");

    for (const window of saleWindows) {
      expect(Date.parse(window.opensAt), `${window.id} must be a real instant`).not.toBeNaN();
      expect(window.timeZone).toBe("Europe/Brussels");
      expect(new Date(window.opensAt).getUTCHours()).toBe(16);
    }
  });

  it("records the headline statistics without a DreamVille capacity figure", () => {
    expect(belgiumFacts.headlineStats.value).toEqual({
      stages: 16,
      peopleOfTomorrow: 400_000,
      nationalities: 191,
    });
    expect(JSON.stringify(belgiumFacts)).not.toMatch(/dreamvilleCapacity/i);
  });

  it("records the expected number of records per collection", () => {
    expect(saleWindows).toHaveLength(3);
    expect(tickets).toHaveLength(10);
    expect(accommodation).toHaveLength(36);
    expect(addOns).toHaveLength(3);
    expect(shuttles).toHaveLength(0);
    expect(lockers).toHaveLength(0);
    expect(stages).toHaveLength(0);
    expect(pearlBundles).toHaveLength(0);
    expect(belgiumData.tickets).toHaveLength(tickets.length);
  });

  it("publishes the 2027 ticket prices from the corrected column", () => {
    const price = (id: string): number | undefined => tickets.find((record) => record.id === id)?.priceEur;

    expect(price("belgium-2027-full-madness-presale")).toBe(335);
    expect(price("belgium-2027-full-madness-worldwide")).toBe(410);
    expect(price("belgium-2027-day-pass-presale")).toBe(144);
    expect(price("belgium-2027-day-pass-worldwide")).toBe(159);
    expect(price("belgium-2027-full-madness-comfort-presale")).toBe(581);
    expect(price("belgium-2027-full-madness-comfort-worldwide")).toBe(700);
    expect(price("belgium-2027-pleasure-day-pass-presale")).toBe(194);
    expect(price("belgium-2027-pleasure-day-pass-worldwide")).toBe(224);
    expect(price("belgium-2027-comfort-day-pass-presale")).toBe(256);
    expect(price("belgium-2027-comfort-day-pass-worldwide")).toBe(275);
  });

  it("publishes the 2027 accommodation totals from the corrected column", () => {
    const price = (id: string): number | undefined =>
      accommodation.find((record) => record.id === id)?.nightlyOrTotalEur;

    expect(price("belgium-2027-magnificent-greens-presale")).toBe(422);
    expect(price("belgium-2027-magnificent-greens-worldwide")).toBe(498);
    expect(price("belgium-2027-friendship-garden-10p-worldwide")).toBe(5707);
    expect(price("belgium-2027-spectacular-friendship-garden-10p-worldwide")).toBe(6598);
    expect(price("belgium-2027-relax-room-2p-presale")).toBe(2231);
    expect(price("belgium-2027-marivela-2p-worldwide")).toBe(5610);
    expect(price("belgium-2027-solara-2p-presale")).toBe(5576);
    expect(price("belgium-2027-noctis-2p-worldwide")).toBe(2723);
  });

  it("publishes the 2027 Treasure Case prices", () => {
    const byId = new Map(addOns.map((record) => [record.id, record.priceEur]));
    expect(byId.get("belgium-2027-treasure-case-belgium")).toBe(15);
    expect(byId.get("belgium-2027-treasure-case-eu")).toBe(22);
    expect(byId.get("belgium-2027-treasure-case-worldwide")).toBe(31);
  });

  it("never carries a superseded 2025 figure forward as a price", () => {
    // The 2025 figures these products were superseded from. A record whose
    // price matches one of them would mean an old value had leaked forward.
    const obsoletePrices = [304, 374, 129, 143];

    const priced = [
      ...tickets.map((record) => ({ label: `tickets/${record.id}`, price: record.priceEur })),
      ...accommodation.map((record) => ({
        label: `accommodation/${record.id}`,
        price: record.nightlyOrTotalEur,
      })),
      ...addOns.map((record) => ({ label: `addOns/${record.id}`, price: record.priceEur })),
    ];

    for (const { label, price } of priced) {
      expect(obsoletePrices, `${label} carries the superseded price ${price}`).not.toContain(price);
    }
  });

  it("gives every priced record an id and name that says which edition it prices", () => {
    for (const record of [...tickets, ...accommodation, ...addOns]) {
      expect(record.id, `record ${record.id} lacks the year`).toContain("2027");
      expect(record.name).toContain("2027 edition");
    }
  });

  it("records the 2027 festival weekends", () => {
    expect(belgiumFacts.festival.weekendOne.value).toEqual({ startsOn: "2027-07-16", endsOn: "2027-07-18" });
    expect(belgiumFacts.festival.weekendTwo.value).toEqual({ startsOn: "2027-07-23", endsOn: "2027-07-25" });
  });

  it("points every FAQ cross-reference at an entry that exists", () => {
    const ids = new Set(faqs.map((faq) => faq.id));
    const dangling = faqs.flatMap((faq) =>
      faq.related.filter((id) => !ids.has(id)).map((id) => `${faq.id} -> ${id}`),
    );
    expect(dangling, `FAQ references to missing ids:\n${dangling.join("\n")}`).toEqual([]);
  });

  it("rejects a record that carries a field the schema does not declare", () => {
    const extraKey = { ...accommodation[0], unsupportedField: "should fail" };
    expect(accommodationSchema.safeParse(extraKey).success).toBe(false);
  });
});
