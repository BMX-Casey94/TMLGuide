/**
 * TMLGUIDE v3 data schemas.
 *
 * Every entity module exports a Zod schema and its inferred TypeScript type.
 * Data files are parsed through these schemas at build time, so a malformed
 * price, a plain-http link or a missing citation fails the build instead of
 * reaching a reader.
 *
 * Money is always euros, stored as numbers; GBP is computed elsewhere for
 * display only. All prose is UK English.
 */
import { isoDateSchema } from "./common";

export * from "./common";
export * from "./ticket-package";
export * from "./accommodation";
export * from "./shuttle";
export * from "./sale-window";
export * from "./add-on";
export * from "./locker";
export * from "./stage";
export * from "./pearl-bundle";
export * from "./faq";
export * from "./whatsapp-group";
export * from "./resource";
export * from "./partner";
export * from "./news-item";

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Reports whether a verified fact has aged past its review window.
 *
 * Age is measured in whole calendar days (UTC): `lastVerified` is a date, so a
 * record verified today is zero days old at any time today. The window is
 * inclusive, so a record that is exactly `maxAgeDays` old is still fresh and
 * only becomes stale after that day has passed.
 *
 * @param lastVerified - verification date in YYYY-MM-DD form.
 * @param now - the moment to measure against, normally the build time.
 * @param maxAgeDays - the longest acceptable age in days; must be finite and
 *   not negative.
 * @throws RangeError if `lastVerified` is not a real calendar date, if `now` is
 *   an invalid Date, or if `maxAgeDays` is not a finite, non-negative number.
 */
export function isStale(lastVerified: string, now: Date, maxAgeDays: number): boolean {
  const verified = isoDateSchema.safeParse(lastVerified);
  if (!verified.success) {
    throw new RangeError(
      `isStale: lastVerified ${JSON.stringify(lastVerified)} is not a real calendar date in YYYY-MM-DD form`,
    );
  }
  const nowMs = typeof now?.getTime === "function" ? now.getTime() : Number.NaN;
  if (!Number.isFinite(nowMs)) {
    throw new RangeError("isStale: now is not a valid Date");
  }
  if (!Number.isFinite(maxAgeDays) || maxAgeDays < 0) {
    throw new RangeError(`isStale: maxAgeDays ${String(maxAgeDays)} must be a finite, non-negative number`);
  }

  const verifiedMs = Date.parse(verified.data);
  const todayMs = Math.floor(nowMs / MILLISECONDS_PER_DAY) * MILLISECONDS_PER_DAY;
  const ageInDays = (todayMs - verifiedMs) / MILLISECONDS_PER_DAY;

  return ageInDays > maxAgeDays;
}

/**
 * Asserts that every record in a collection has a distinct `id`.
 *
 * Call this on each collection after parsing. Schemas validate one record at a
 * time, so they cannot see that two records claim the same slug; a duplicate
 * id would make one of them unreachable (or, worse, make a lookup return
 * whichever happens to be first).
 *
 * @throws Error naming the first duplicated id, or the index of an item whose
 *   id is missing or not a string.
 */
export function assertUniqueIds<T extends { id: string }>(items: readonly T[]): void {
  if (!Array.isArray(items)) {
    throw new Error("assertUniqueIds: expected an array of records");
  }

  const seen = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const id: unknown = items[index]?.id;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`assertUniqueIds: record at index ${index} has a missing or non-string id`);
    }
    if (seen.has(id)) {
      throw new Error(`assertUniqueIds: duplicate id "${id}" found in a collection of ${items.length} records`);
    }
    seen.add(id);
  }
}

/**
 * Asserts that every record in a route-bearing collection has a distinct
 * `slug`.
 *
 * A record's id is internal, but its slug becomes a URL. Two news items with
 * different ids and the same slug would try to build the same route, which
 * fails the build at best and silently hides an article at worst, so the pair
 * needs checking separately.
 *
 * @throws Error naming the first duplicated slug, or the index of an item
 *   whose slug is missing or not a string.
 */
export function assertUniqueSlugs<T extends { slug: string }>(items: readonly T[]): void {
  if (!Array.isArray(items)) {
    throw new Error("assertUniqueSlugs: expected an array of records");
  }

  const seen = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const slug: unknown = items[index]?.slug;
    if (typeof slug !== "string" || slug.length === 0) {
      throw new Error(`assertUniqueSlugs: record at index ${index} has a missing or non-string slug`);
    }
    if (seen.has(slug)) {
      throw new Error(
        `assertUniqueSlugs: duplicate slug "${slug}" found in a collection of ${items.length} records`,
      );
    }
    seen.add(slug);
  }
}
