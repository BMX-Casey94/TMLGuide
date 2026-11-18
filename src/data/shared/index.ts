/**
 * Shared data entry point.
 *
 * `validateSharedData()` parses every shared record through its schema and
 * checks the invariants a single-record schema cannot see: unique ids within
 * each collection, unique broadcast countries, and `related` FAQ ids that
 * actually exist. It runs at build time and again in the test suite, so a
 * broken cross-reference fails loudly rather than producing a dead link.
 *
 * `sharedData` holds the parsed result, so pages import checked data instead of
 * re-parsing on each render.
 */
import { assertUniqueIds } from "../schemas";
import { faqSchema, type Faq } from "../schemas/faq";
import { editionsCollections, editionOverviewSchema, type EditionOverview } from "./editions";
import { faqCollections } from "./faqs";
import {
  radioBroadcastSchema,
  radioChannelSchema,
  radioCollections,
  radioMilestoneSchema,
  radioStationSchema,
  type RadioBroadcast,
  type RadioChannel,
  type RadioMilestone,
  type RadioStation,
} from "./radio";

export * from "./radio";
export * from "./editions";
export * from "./faqs";

export interface SharedData {
  readonly radio: {
    readonly station: RadioStation;
    readonly milestones: readonly RadioMilestone[];
    readonly channels: readonly RadioChannel[];
    readonly broadcasts: readonly RadioBroadcast[];
  };
  readonly editions: readonly EditionOverview[];
  readonly faqs: readonly Faq[];
}

/**
 * Parses and checks every shared collection.
 *
 * @throws Error if a record does not match its schema, if two records in one
 *   collection share an id, if two broadcast records name the same country, or
 *   if an FAQ entry points `related` at an id that does not exist.
 */
export function validateSharedData(): SharedData {
  const station = radioStationSchema.parse(radioCollections.station);
  const milestones = radioCollections.milestones.map((record) => radioMilestoneSchema.parse(record));
  const channels = radioCollections.channels.map((record) => radioChannelSchema.parse(record));
  const broadcasts = radioCollections.broadcasts.map((record) => radioBroadcastSchema.parse(record));
  const editionRecords = editionsCollections.editions.map((record) =>
    editionOverviewSchema.parse(record),
  );
  const faqs = faqCollections.general.map((record) => faqSchema.parse(record));

  assertUniqueIds(milestones);
  assertUniqueIds(channels);
  assertUniqueIds(broadcasts);
  assertUniqueIds(editionRecords);
  assertUniqueIds(faqs);

  const seenCountries = new Set<string>();
  for (const broadcast of broadcasts) {
    const country = broadcast.country.toLowerCase();
    if (seenCountries.has(country)) {
      throw new Error(`validateSharedData: two broadcast records name ${broadcast.country}`);
    }
    seenCountries.add(country);
  }

  const faqIds = new Set(faqs.map((entry) => entry.id));
  for (const entry of faqs) {
    for (const relatedId of entry.related) {
      if (!faqIds.has(relatedId)) {
        throw new Error(
          `validateSharedData: FAQ "${entry.id}" relates to unknown id "${relatedId}"`,
        );
      }
    }
  }

  return {
    radio: { station, milestones, channels, broadcasts },
    editions: editionRecords,
    faqs,
  };
}

/** Shared data, parsed and verified once at module load. */
export const sharedData: SharedData = validateSharedData();
