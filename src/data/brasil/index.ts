/**
 * Brasil data entry point.
 *
 * `validateBrasilData()` parses every Brasil record through its schema and
 * checks the cross-record invariants a per-record schema cannot see: unique ids
 * inside each collection, no duplicate product/variant pair, and a sale window
 * whose end is not before its start. It runs at build time, so a malformed
 * record fails the build instead of reaching a reader.
 *
 * `brasilData` exposes the same collections already parsed once, so a page
 * imports validated data rather than re-parsing on every render.
 */
import { assertUniqueIds } from "../schemas";
import {
  brasilCollections,
  brasilDreamvillePackageSchema,
  brasilFactSchema,
  brasilSaleWindowSchema,
  brasilShuttleSchema,
  brasilTicketSchema,
  type BrasilDreamvillePackage,
  type BrasilFact,
  type BrasilSaleWindow,
  type BrasilShuttle,
  type BrasilTicket,
} from "./facts";

export * from "./facts";

/** A parsed Brasil data set: every collection, typed and checked. */
export interface BrasilData {
  readonly facts: readonly BrasilFact[];
  readonly tickets: readonly BrasilTicket[];
  readonly dreamvillePackages: readonly BrasilDreamvillePackage[];
  readonly shuttles: readonly BrasilShuttle[];
  readonly saleWindows: readonly BrasilSaleWindow[];
}

/**
 * Parses and checks every Brasil collection.
 *
 * @throws Error if a record does not match its schema, if two records in one
 *   collection share an id, if two tickets claim the same product and variant,
 *   or if a sale window closes before it opens.
 */
export function validateBrasilData(): BrasilData {
  const facts = brasilCollections.facts.map((record) => brasilFactSchema.parse(record));
  const tickets = brasilCollections.tickets.map((record) => brasilTicketSchema.parse(record));
  const dreamvillePackages = brasilCollections.dreamvillePackages.map((record) =>
    brasilDreamvillePackageSchema.parse(record),
  );
  const shuttles = brasilCollections.shuttles.map((record) => brasilShuttleSchema.parse(record));
  const saleWindows = brasilCollections.saleWindows.map((record) =>
    brasilSaleWindowSchema.parse(record),
  );

  assertUniqueIds(facts);
  assertUniqueIds(tickets);
  assertUniqueIds(dreamvillePackages);
  assertUniqueIds(shuttles);
  assertUniqueIds(saleWindows);

  const seenTicketKeys = new Set<string>();
  for (const ticket of tickets) {
    const key = `${ticket.product}/${ticket.variant}`;
    if (seenTicketKeys.has(key)) {
      throw new Error(`validateBrasilData: two tickets claim ${key}`);
    }
    seenTicketKeys.add(key);
  }

  for (const window of saleWindows) {
    if (window.closesAt === undefined) continue;
    if (Date.parse(window.closesAt) < Date.parse(window.opensAt)) {
      throw new Error(
        `validateBrasilData: sale window "${window.id}" closes before it opens`,
      );
    }
  }

  return { facts, tickets, dreamvillePackages, shuttles, saleWindows };
}

/** Brasil data, parsed and verified once at module load. */
export const brasilData: BrasilData = validateBrasilData();
