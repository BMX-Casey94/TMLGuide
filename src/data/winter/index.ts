import { z } from "zod";
import {
  accommodationSchema,
  addOnSchema,
  assertUniqueIds,
  assertUniqueSlugs,
  faqSchema,
  lockerSchema,
  saleWindowSchema,
  shuttleSchema,
  stageSchema,
  ticketPackageSchema,
  type Accommodation,
  type AddOn,
  type Faq,
  type Locker,
  type SaleWindow,
  type Shuttle,
  type Stage,
  type TicketPackage,
} from "../schemas";
import { winterFacts, winterFactSchema, type WinterFact } from "./facts";
import { winterAccommodation } from "./accommodation";
import { winterAddOns } from "./add-ons";
import { winterFaqs } from "./faqs";
import { winterLockers } from "./lockers";
import { winterSaleWindows } from "./sale-windows";
import { winterShuttles } from "./shuttles";
import { winterStages } from "./stages";
import { winterTickets } from "./tickets";

export { winterFacts, winterFactSchema, winterFactCategorySchema } from "./facts";
export type { WinterFact, WinterFactCategory } from "./facts";
export { winterSaleWindows } from "./sale-windows";
export { winterTickets } from "./tickets";
export { winterAccommodation } from "./accommodation";
export { winterShuttles } from "./shuttles";
export { winterAddOns } from "./add-ons";
export { winterLockers } from "./lockers";
export { winterStages } from "./stages";
export { winterFaqs } from "./faqs";
export { assertUniqueIds, assertUniqueSlugs } from "../schemas";

/**
 * The validated Winter 2027 dataset.
 *
 * Built by `validateWinterData`, not by hand, so a consumer that imports
 * `winterData` can be certain every record has already been parsed by its
 * schema, that no two records share an id, and that no id collides as a URL
 * segment.
 */
export interface WinterData {
  readonly saleWindows: readonly SaleWindow[];
  readonly tickets: readonly TicketPackage[];
  readonly accommodation: readonly Accommodation[];
  readonly shuttles: readonly Shuttle[];
  readonly addOns: readonly AddOn[];
  readonly lockers: readonly Locker[];
  readonly stages: readonly Stage[];
  readonly faqs: readonly Faq[];
  readonly facts: readonly WinterFact[];
}

/**
 * Parses every Winter record with its schema and checks identifier uniqueness.
 *
 * @throws ZodError if any record fails its schema.
 * @throws Error if two records share an id, or if two ids collide as slugs.
 */
export function validateWinterData(): WinterData {
  const data: WinterData = {
    saleWindows: z.array(saleWindowSchema).parse(winterSaleWindows),
    tickets: z.array(ticketPackageSchema).parse(winterTickets),
    accommodation: z.array(accommodationSchema).parse(winterAccommodation),
    shuttles: z.array(shuttleSchema).parse(winterShuttles),
    addOns: z.array(addOnSchema).parse(winterAddOns),
    lockers: z.array(lockerSchema).parse(winterLockers),
    stages: z.array(stageSchema).parse(winterStages),
    faqs: z.array(faqSchema).parse(winterFaqs),
    facts: z.array(winterFactSchema).parse(winterFacts),
  };

  const collections: readonly (readonly { id: string }[])[] = [
    data.saleWindows,
    data.tickets,
    data.accommodation,
    data.shuttles,
    data.addOns,
    data.lockers,
    data.stages,
    data.faqs,
    data.facts,
  ];

  for (const collection of collections) {
    assertUniqueIds(collection);
  }

  // Ids double as URL segments on the Winter pages, so a collision would build
  // two routes onto one path. Checking the whole edition at once also catches
  // the case that matters more: the same id in two different collections.
  const slugSource = collections.flat().map((record) => ({ slug: record.id }));
  assertUniqueSlugs(slugSource);

  return data;
}

/** The Winter dataset, validated at module load. */
export const winterData: WinterData = validateWinterData();
