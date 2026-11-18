// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  accommodationSchema,
  addOnSchema,
  faqSchema,
  lockerSchema,
  saleWindowSchema,
  shuttleSchema,
  stageSchema,
  ticketPackageSchema,
} from "../schemas";
import {
  validateWinterData,
  winterAccommodation,
  winterAddOns,
  winterData,
  winterFacts,
  winterFactSchema,
  winterFaqs,
  winterLockers,
  winterSaleWindows,
  winterShuttles,
  winterStages,
  winterTickets,
} from "./index";

// `src/data/winter` -> `src/data` -> `src` -> repository root.
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const LEDGER_FILES = [
  path.join(REPO_ROOT, "docs/factcheck/winter.md"),
  path.join(REPO_ROOT, "docs/factcheck/conflicts.md"),
] as const;

const VERIFIED_ON = "2026-11-18";

const ledgerText = LEDGER_FILES.map((file) => readFileSync(file, "utf8")).join("\n");

interface WinterRecord {
  readonly id: string;
  readonly edition: string;
  readonly source: { readonly url: string; readonly title: string; readonly retrievedOn: string };
  readonly lastVerified: string;
  readonly confidence: string;
}

/**
 * Every collection with the schema that governs it. Written as one table so a
 * newly added entity cannot be forgotten by the checks below.
 */
const collections = [
  { name: "sale windows", records: winterSaleWindows, schema: saleWindowSchema },
  { name: "tickets", records: winterTickets, schema: ticketPackageSchema },
  { name: "accommodation", records: winterAccommodation, schema: accommodationSchema },
  { name: "shuttles", records: winterShuttles, schema: shuttleSchema },
  { name: "add-ons", records: winterAddOns, schema: addOnSchema },
  { name: "lockers", records: winterLockers, schema: lockerSchema },
  { name: "stages", records: winterStages, schema: stageSchema },
  { name: "faqs", records: winterFaqs, schema: faqSchema },
  { name: "facts", records: winterFacts, schema: winterFactSchema },
] as const satisfies readonly {
  name: string;
  records: readonly WinterRecord[];
  schema: { safeParse: (value: unknown) => { success: boolean } };
}[];

/** All records across the edition, flattened once for the cross-cutting checks. */
const allRecords: readonly WinterRecord[] = collections.flatMap((collection) =>
  collection.records.map((record) => record as WinterRecord),
);

/** Every outbound URL a record publishes, source citations and booking links alike. */
function outboundUrls(record: object): readonly string[] {
  const urls: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if ((key === "url" || key === "bookingUrl") && typeof value === "string") {
      urls.push(value);
    }
    if (key === "source" && typeof value === "object" && value !== null) {
      const nested = (value as { url?: unknown }).url;
      if (typeof nested === "string") {
        urls.push(nested);
      }
    }
  }
  return urls;
}

/** Every free-text field a reader will see, used for the stale-price scan. */
function proseFields(record: Record<string, unknown>): readonly string[] {
  return Object.entries(record)
    .filter(([key, value]) => key !== "source" && typeof value === "string")
    .map(([, value]) => value as string);
}

describe("Winter data collections", () => {
  it.each(collections.map((collection) => [collection.name, collection] as const))(
    "%s parse with their schema",
    (_name, collection) => {
      for (const record of collection.records) {
        const result = collection.schema.safeParse(record);
        if (!result.success) {
          throw new Error(
            `record "${record.id}" failed its schema: ${JSON.stringify(result.error.issues, null, 2)}`,
          );
        }
      }
      expect(collection.records.length).toBeGreaterThanOrEqual(0);
    },
  );

  it("validateWinterData returns the same validated collections", () => {
    const data = validateWinterData();
    expect(data.saleWindows).toHaveLength(winterSaleWindows.length);
    expect(data.tickets).toHaveLength(winterTickets.length);
    expect(data.accommodation).toHaveLength(winterAccommodation.length);
    expect(data.shuttles).toHaveLength(winterShuttles.length);
    expect(data.addOns).toHaveLength(winterAddOns.length);
    expect(data.lockers).toHaveLength(winterLockers.length);
    expect(data.stages).toHaveLength(winterStages.length);
    expect(data.faqs).toHaveLength(winterFaqs.length);
    expect(data.facts).toHaveLength(winterFacts.length);
  });

  it("winterData is the validated dataset", () => {
    expect(winterData.tickets[0]?.id).toBe("seven-day-festival-ticket-2027");
    expect(winterData.stages.map((stage) => stage.name)).toContain("MainStage");
  });

  it("every id is unique across the whole edition", () => {
    const ids = allRecords.map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every record declares the winter edition", () => {
    for (const record of allRecords) {
      expect(record.edition, `record "${record.id}"`).toBe("winter");
    }
  });
});

describe("Winter provenance", () => {
  it.each(collections.map((collection) => [collection.name, collection] as const))(
    "%s cite a source retrieved on the verification date",
    (_name, collection) => {
      for (const record of collection.records) {
        expect(record.source.retrievedOn, `record "${record.id}"`).toBe(VERIFIED_ON);
        expect(record.source.title.trim().length, `record "${record.id}"`).toBeGreaterThan(0);
      }
    },
  );

  it.each(collections.map((collection) => [collection.name, collection] as const))(
    "%s were verified on 2026-11-18",
    (_name, collection) => {
      for (const record of collection.records) {
        expect(record.lastVerified, `record "${record.id}"`).toBe(VERIFIED_ON);
      }
    },
  );

  it.each(collections.map((collection) => [collection.name, collection] as const))(
    "%s claim only official or community confidence",
    (_name, collection) => {
      for (const record of collection.records) {
        expect(["official", "community"], `record "${record.id}"`).toContain(record.confidence);
      }
    },
  );

  it("every published URL is https", () => {
    for (const record of allRecords) {
      for (const url of outboundUrls(record)) {
        expect(url.startsWith("https://"), `record "${record.id}" publishes ${url}`).toBe(true);
      }
    }
  });

  it("every published URL appears verbatim in the fact-check ledger", () => {
    const missing: string[] = [];
    for (const record of allRecords) {
      for (const url of outboundUrls(record)) {
        if (!ledgerText.includes(url)) {
          missing.push(`${record.id} -> ${url}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("the ledger files are the ones being read", () => {
    expect(ledgerText).toContain("# Fact-check: Tomorrowland Winter (Alpe d'Huez)");
    expect(ledgerText).toContain("## 4. Locker prices and sizes");
  });
});

describe("Winter money", () => {
  const priceFields = [
    "priceEur",
    "nightlyOrTotalEur",
    "amountEur",
  ] as const;

  it("no amount is negative or carries more than two decimals", () => {
    for (const record of allRecords) {
      const bag = record as unknown as Record<string, unknown>;
      for (const field of priceFields) {
        const value = bag[field];
        if (value === undefined) {
          continue;
        }
        expect(typeof value, `record "${record.id}" field ${field}`).toBe("number");
        const amount = value as number;
        expect(Number.isFinite(amount), `record "${record.id}" field ${field}`).toBe(true);
        expect(amount, `record "${record.id}" field ${field}`).toBeGreaterThanOrEqual(0);
        const cents = amount * 100;
        expect(
          Math.abs(cents - Math.round(cents)),
          `record "${record.id}" field ${field} has a third decimal`,
        ).toBeLessThan(1e-9);
      }
    }
  });

  it("no priced record quotes 2025 unless the note labels it as past-season context", () => {
    const pricedRecords: readonly { id: string; notes?: string }[] = [
      ...winterTickets,
      ...winterAccommodation,
      ...winterShuttles,
      ...winterAddOns,
      ...winterLockers,
    ];

    const offenders: string[] = [];
    for (const record of pricedRecords) {
      const notes = record.notes ?? "";
      if (!notes.includes("2025")) {
        continue;
      }
      if (!/past[- ]season/i.test(notes)) {
        offenders.push(record.id);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no record quotes an outdated 2025 package or ticket price", () => {
    // The 2025 package minimums and ticket prices are the figures the ledger
    // marks outdated. Quoting one would mean a stale price was carried into a
    // 2027 record, whatever the surrounding wording.
    const outdated = /€\s?(995|875|695|525|2\s?695|2\s?525)\b/;
    const offenders = allRecords
      .filter((record) =>
        outdated.test(proseFields(record as unknown as Record<string, unknown>).join(" ")),
      )
      .map((record) => record.id);
    expect(offenders).toEqual([]);
  });
});

describe("Winter FAQ integrity", () => {
  it("every related id points at an existing FAQ", () => {
    const ids = new Set(winterFaqs.map((faq) => faq.id));
    const dangling: string[] = [];
    for (const faq of winterFaqs) {
      for (const related of faq.related) {
        if (!ids.has(related)) {
          dangling.push(`${faq.id} -> ${related}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it("every FAQ answer is real prose, not a placeholder", () => {
    for (const faq of winterFaqs) {
      expect(faq.answer.length, `faq "${faq.id}"`).toBeGreaterThan(80);
      expect(faq.answer).not.toMatch(/\b(TODO|TBD|FIXME|lorem ipsum)\b/i);
    }
  });
});

describe("Winter facts integrity", () => {
  it("covers the headline facts the edition quotes repeatedly", () => {
    const ids = new Set(winterFacts.map((fact) => fact.id));
    for (const required of [
      "festival-dates-2027",
      "mountain-stage-opening-hours",
      "moosebar-day-slot",
      "package-payment-terms",
      "covered-parking-daily",
      "covered-parking-weekly",
      "transportation-pass-price",
      "winter-equipment-rule",
    ]) {
      expect(ids, `missing fact "${required}"`).toContain(required);
    }
  });

  it("does not present a 2025 or 2026 package minimum as a 2027 price", () => {
    // A package minimum is always published as a "from €X" figure. None exists
    // for 2027, so no fact may carry one, and no fact may quote a package as a
    // starting price at all.
    for (const fact of winterFacts) {
      expect(fact.value, `fact "${fact.id}"`).not.toMatch(/from\s*€/i);
      expect(fact.detail ?? "", `fact "${fact.id}"`).not.toMatch(/packages?\s+from\s*€/i);
    }
  });
});
