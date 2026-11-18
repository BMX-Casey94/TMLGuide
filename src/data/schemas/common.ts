import { z } from "zod";

/**
 * Shared primitives for every TMLGUIDE v3 data record.
 *
 * Conventions enforced here:
 * - Every record carries provenance (`source`, `lastVerified`, `confidence`)
 *   so a stale or unverified fact can never be rendered as if it were checked.
 * - Money is always stored in euros as a number with at most two decimals.
 *   Indicative GBP figures are derived at render time and are never persisted.
 * - Links are https only. The previous site shipped plain-http invite links,
 *   so the schema refuses anything that is not an absolute https URL.
 */

/** The three editions TMLGUIDE covers. */
export const editionIdSchema = z.enum(["belgium", "winter", "brasil"], {
  error: 'edition must be "belgium", "winter" or "brasil"',
});
export type EditionId = z.infer<typeof editionIdSchema>;

/** Records that are not edition-specific (festival-wide FAQ, partner offers) use "all". */
export const editionScopeSchema = z.union([editionIdSchema, z.literal("all")], {
  error: 'edition must be "belgium", "winter", "brasil" or "all"',
});
export type EditionScope = z.infer<typeof editionScopeSchema>;

/**
 * Kebab-case slug: lowercase letters, digits and single hyphens, with no
 * leading, trailing or doubled hyphen. Used for record ids and news slugs.
 */
export const slugSchema = z
  .string({ error: "id must be a kebab-case slug" })
  .trim()
  .min(1, { error: "id is required" })
  .max(80, { error: "id must be 80 characters or fewer" })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    error: "id must be a kebab-case slug (lowercase letters, digits and single hyphens)",
  });
export type Slug = z.infer<typeof slugSchema>;

/**
 * A calendar date in YYYY-MM-DD form. The pattern is leap-year aware, so an
 * impossible date such as 2027-02-30 is rejected rather than rolling over
 * into March.
 */
export const isoDateSchema = z.iso.date({
  error: "date must be a real calendar date in YYYY-MM-DD format",
});
export type IsoDate = z.infer<typeof isoDateSchema>;

/**
 * An exact point in time: ISO-8601 date-time with either a `Z` suffix or a
 * numeric UTC offset. A local date-time without an offset is ambiguous, so it
 * is rejected.
 */
export const isoInstantSchema = z
  .iso.datetime({
    offset: true,
    error: "instant must be an ISO-8601 date-time with a UTC offset or Z",
  })
  .refine((value) => Number.isFinite(Date.parse(value)), {
    error: "instant must be a date-time JavaScript can parse",
  });
export type IsoInstant = z.infer<typeof isoInstantSchema>;

/**
 * An absolute https URL. `http:`, `javascript:`, `data:` and every other
 * scheme is refused: links on the site are either citations or live outbound
 * actions, and both must be encrypted.
 *
 * Credentials embedded in the URL (`https://user:pass@host`) are refused too.
 * A citation or invite link never needs them, and letting one through would
 * publish a secret in the generated HTML.
 */
function isCredentialFreeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.username === "" && parsed.password === "";
  } catch {
    // A later or earlier check has already rejected this string; never throw
    // from a refinement.
    return false;
  }
}

export const httpsUrlSchema = z
  .url({ protocol: /^https$/, error: "URL must be an absolute https:// URL" })
  .max(2048, { error: "URL must be 2048 characters or fewer" })
  .refine((value) => !/\s/.test(value), {
    error: "URL must not contain whitespace",
  })
  .refine(isCredentialFreeUrl, { error: "URL must not embed credentials" });
export type HttpsUrl = z.infer<typeof httpsUrlSchema>;

/** Where a fact came from, and when it was read. */
export const sourceSchema = z.strictObject({
  url: httpsUrlSchema,
  title: z
    .string({ error: "source title is required" })
    .trim()
    .min(1, { error: "source title is required" })
    .max(200, { error: "source title must be 200 characters or fewer" }),
  retrievedOn: isoDateSchema,
});
export type Source = z.infer<typeof sourceSchema>;

/** How far a fact can be trusted. "unverified" records must not be presented as confirmed. */
export const confidenceSchema = z.enum(["official", "community", "unverified"], {
  error: 'confidence must be "official", "community" or "unverified"',
});
export type Confidence = z.infer<typeof confidenceSchema>;

/**
 * The fields every entity extends. Strict on purpose: an unknown key arriving
 * from a data file or a CMS payload is a mistake that should fail loudly at
 * build time rather than be silently dropped.
 */
export const verifiedBase = z.strictObject({
  id: slugSchema,
  edition: editionScopeSchema,
  source: sourceSchema,
  lastVerified: isoDateSchema,
  confidence: confidenceSchema,
});
export type VerifiedBase = z.infer<typeof verifiedBase>;

/**
 * A non-negative euro amount with at most two decimals, stored as a number and
 * never as a formatted string. `z.number()` already rejects NaN and Infinity,
 * and `multipleOf(0.01)` rejects a third decimal without any rounding, so a
 * price of 19.999 fails instead of being silently stored as 20.00.
 */
export const moneyEurSchema = z
  .number({ error: "price must be a number of euros" })
  .nonnegative({ error: "price must not be negative" })
  .multipleOf(0.01, { error: "price must have at most two decimals" });
export type MoneyEur = z.infer<typeof moneyEurSchema>;
