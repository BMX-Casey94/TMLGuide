import { z } from "zod";
import {
  accommodationSchema,
  addOnSchema,
  assertUniqueIds,
  assertUniqueSlugs,
  faqSchema,
  lockerSchema,
  pearlBundleSchema,
  saleWindowSchema,
  shuttleSchema,
  stageSchema,
  ticketPackageSchema,
  type Accommodation,
  type AddOn,
  type Faq,
  type Locker,
  type PearlBundle,
  type SaleWindow,
  type Shuttle,
  type Stage,
  type TicketPackage,
} from "../schemas";
import { accommodation as accommodationData } from "./accommodation";
import { addOns as addOnData } from "./add-ons";
import { belgiumFacts as belgiumFactsData, belgiumFactsSchema, type BelgiumFacts } from "./facts";
import { faqs as faqData } from "./faqs";
import { lockers as lockerData } from "./lockers";
import { pearlBundles as pearlBundleData } from "./pearl-bundles";
import { saleWindows as saleWindowData } from "./sale-windows";
import { shuttles as shuttleData } from "./shuttles";
import { stages as stageData } from "./stages";
import { tickets as ticketData } from "./tickets";

export { belgiumFactsSchema } from "./facts";
export type { Accommodation, AddOn, BelgiumFacts, Faq, Locker, PearlBundle, SaleWindow, Shuttle, Stage, TicketPackage };

/** Parses a collection through its schema and reports every failure at once. */
function parseAll<T extends { id: string }>(
  schema: z.ZodType<T>,
  items: readonly unknown[],
  label: string,
): readonly T[] {
  const parsed: T[] = [];
  const problems: string[] = [];

  items.forEach((item, index) => {
    const result = schema.safeParse(item);
    if (result.success) {
      parsed.push(result.data);
    } else {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      problems.push(`${label}[${index}]: ${detail}`);
    }
  });

  if (problems.length > 0) {
    throw new Error(`Belgium data failed validation:\n${problems.join("\n")}`);
  }

  assertUniqueIds(parsed);
  return parsed;
}

/**
 * Validates every Belgium record and returns the parsed collections.
 *
 * Runs at module load so a malformed record fails the build rather than
 * reaching a reader. Each collection is parsed with its own schema, ids are
 * checked for uniqueness, and the facts object is parsed too.
 *
 * `edition` is checked here as well as in the schema: a Belgium array holding a
 * record scoped to another edition would be rendered on the wrong page.
 */
export function validateBelgiumData(): BelgiumData {
  const saleWindows = parseAll(saleWindowSchema, saleWindowData, "saleWindows");
  const tickets = parseAll(ticketPackageSchema, ticketData, "tickets");
  const accommodation = parseAll(accommodationSchema, accommodationData, "accommodation");
  const shuttles = parseAll(shuttleSchema, shuttleData, "shuttles");
  const addOns = parseAll(addOnSchema, addOnData, "addOns");
  const lockers = parseAll(lockerSchema, lockerData, "lockers");
  const stages = parseAll(stageSchema, stageData, "stages");
  const faqs = parseAll(faqSchema, faqData, "faqs");
  const pearlBundles = parseAll(pearlBundleSchema, pearlBundleData, "pearlBundles");
  const facts = belgiumFactsSchema.parse(belgiumFactsData);

  const collections = { saleWindows, tickets, accommodation, shuttles, addOns, lockers, stages, faqs, pearlBundles };

  const misScoped = Object.entries(collections).flatMap(([label, items]) =>
    items.filter((item) => item.edition !== "belgium").map((item) => `${label}: "${item.id}" is scoped to "${item.edition}"`),
  );

  if (misScoped.length > 0) {
    throw new Error(`Belgium data holds records from another edition:\n${misScoped.join("\n")}`);
  }

  // A record's id is internal; a slug becomes a URL. No Belgium record type
  // carries a slug today, so this loop is a guard for the day one does rather
  // than dead weight: without it, a future slug-bearing collection could ship
  // two records that collide on the same route.
  for (const [label, items] of Object.entries(collections)) {
    if (items.some((item) => "slug" in item)) {
      try {
        assertUniqueSlugs(items as unknown as readonly { slug: string }[]);
      } catch (error) {
        throw new Error(`${label} has a slug collision: ${(error as Error).message}`);
      }
    }
  }

  return { ...collections, facts };
}

export type BelgiumData = {
  saleWindows: readonly SaleWindow[];
  tickets: readonly TicketPackage[];
  accommodation: readonly Accommodation[];
  shuttles: readonly Shuttle[];
  addOns: readonly AddOn[];
  lockers: readonly Locker[];
  stages: readonly Stage[];
  faqs: readonly Faq[];
  pearlBundles: readonly PearlBundle[];
  facts: BelgiumFacts;
};

/** The validated Belgium dataset, and the collections every page should read. */
export const belgiumData: BelgiumData = validateBelgiumData();

export const {
  saleWindows,
  tickets,
  accommodation,
  shuttles,
  addOns,
  lockers,
  stages,
  faqs,
  pearlBundles,
  facts: belgiumFacts,
} = belgiumData;
