/**
 * Types for the global search palette.
 *
 * Everything here is dependency-free and synchronous: the index is built from
 * the bundled data files, never fetched from a third party.
 */

/** Broad grouping used for the result headings. */
export type SearchKind =
  | "page"
  | "faq"
  | "ticket"
  | "accommodation"
  | "sale"
  | "edition"
  | "resource"
  | "whatsapp"
  | "partner";

/** The three editions the site covers, plus the scope for content that is not edition-specific. */
export const EDITION_IDS = ["belgium", "winter", "brasil"] as const;

export type EditionId = (typeof EDITION_IDS)[number];

/**
 * Which edition an entry belongs to. `all` marks content that is equally
 * relevant everywhere: site pages, the editions overview and community links.
 */
export const EDITION_SCOPES = [...EDITION_IDS, "all"] as const;

export type EditionScope = (typeof EDITION_SCOPES)[number];

/** True for one of the three festival editions (not `all`). */
export function isEditionId(value: unknown): value is EditionId {
  return typeof value === "string" && (EDITION_IDS as readonly string[]).includes(value);
}

export interface SearchEntry {
  /** Stable and unique across the index. */
  id: string;
  title: string;
  /** At most {@link SNIPPET_MAX} characters, taken from the source record. */
  snippet: string;
  kind: SearchKind;
  /** Human label rendered beside the result, e.g. "FAQ". */
  kindLabel: string;
  edition: EditionScope;
  /** Internal route, always starting with "/". Known routes only. */
  href: string;
  /** Repo-relative file the entry came from, for provenance and drift checks. */
  source: string;
  /**
   * The official page the record cites, when it has one. Shown beside a result
   * so a price or date in the snippet always names where it came from. Hand-
   * written page entries have none, because a page is not a fact.
   */
  sourceUrl?: string;
  /**
   * ISO date the underlying record was last checked, where the data records
   * one. Every record in `src/data` carries `lastVerified`, so this is present
   * for everything except the hand-written page entries.
   */
  lastVerified?: string;
}

export interface RankedEntry extends SearchEntry {
  /** Higher is better. Only meaningful within a single search call. */
  score: number;
}

export interface SearchOptions {
  /**
   * The index to search. Required rather than defaulted, so this module — and
   * therefore the browser bundle — never imports the data layer. The index is
   * built on the server and passed down as data.
   */
  index: readonly SearchEntry[];
  /** Edition to boost. Entries in other editions still match. */
  edition?: EditionScope | null;
  /** Maximum results, 1–{@link MAX_LIMIT}. Defaults to DEFAULT_LIMIT. */
  limit?: number;
}
