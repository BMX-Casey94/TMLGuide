import { sharedData } from "@/data/shared";
import type { EditionScope } from "../types";

/**
 * A search entry before the builder assigns its id, checks the route whitelist
 * and enforces the snippet limit. `slug` only has to be unique within its own
 * source list.
 */
export interface SourceEntry {
  slug: string;
  title: string;
  snippet: string;
  edition: EditionScope;
  href: string;
  /**
   * The DOM id the target page exposes for this record, from `../anchors.ts`.
   *
   * The builder appends it to {@link href} as a fragment after checking that it
   * matches the anchor pattern, so a source never writes `#` itself and the two
   * halves cannot disagree.
   */
  anchor?: string;
  /** Repo-relative file the facts came from, so drift is traceable. */
  source: string;
  /** The official page the record cites, when it has one. */
  sourceUrl?: string;
  lastVerified?: string;
}

/** The one date every record in the datasets was checked on. */
export const DATA_CHECKED_ON = "2026-11-18";

/**
 * The edition year, read from the shared editions overview rather than parsed
 * out of a product name or an id.
 *
 * A price record carries no year field, and two of the three editions price
 * products for a year that is not the one in the record's own name suffix. The
 * overview does carry real dates, so the year comes from the edition the guide
 * covers, preferring one still ahead of us and otherwise the latest.
 *
 * @throws Error when the overview has no record for the edition, so a missing
 *   overview fails loudly rather than silently labelling a price with the wrong
 *   year.
 */
export function editionYear(edition: "belgium" | "winter" | "brasil"): number {
  const candidates = sharedData.editions.filter((record) => record.guideEdition === edition);
  if (candidates.length === 0) {
    throw new Error(`editionYear: the editions overview has no record for "${edition}"`);
  }
  const upcoming = candidates.filter((record) => record.status === "upcoming");
  const pool = upcoming.length > 0 ? upcoming : candidates;
  const latest = pool.reduce((best, record) =>
    Date.parse(record.startsOn) > Date.parse(best.startsOn) ? record : best,
  );
  const year = Number(latest.startsOn.slice(0, 4));
  if (!Number.isInteger(year)) {
    throw new Error(`editionYear: "${latest.id}" has an unreadable start date`);
  }
  return year;
}

/** The edition as a label, for snippets that name it. */
export const EDITION_LABELS: Readonly<Record<EditionScope, string>> = {
  belgium: "Belgium",
  winter: "Winter",
  brasil: "Brasil",
  all: "All editions",
};

/** Joins the parts of a snippet, dropping anything empty. */
export function joinSnippet(parts: readonly (string | undefined)[]): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(" · ");
}

/**
 * Group names carry emoji for visual scanning in the community directory. They
 * are noise in a search result, and a title full of emoji reads badly in a
 * one-line row, so they are removed here.
 */
export function stripEmoji(value: string): string {
  return value
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
