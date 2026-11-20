/**
 * Anchors: the one place that decides what DOM id a search result points at.
 *
 * A result that opens a page and leaves the reader at the top of it is only half
 * a result. Every record-backed entry therefore carries an anchor: the id the
 * target page must put on that record's own element. The page and the index both
 * derive the id from the record id *here*, so the two cannot drift: if the page
 * imports `recordAnchor` and the source list calls `recordAnchor` with the same
 * record id, the link lands.
 *
 * This module is pure — no data imports, no React, no DOM — so both the Server
 * Component that builds the index and the page that renders the record can use
 * it, and it can be tested directly.
 *
 * The shape is deliberately narrow. An id is lower-case kebab-case, 1–80
 * characters, and nothing else: no `#`, no `?`, no percent-encoding, no spaces,
 * no leading digit problem (`id` attributes may start with a digit, and
 * `getElementById` does not care). That narrowness is what makes `href` safety
 * provable in `routes.ts`: an anchor that matches this pattern cannot close the
 * hash, start a query, or escape the URL.
 */

/** The longest anchor id a search result may point at. */
export const ANCHOR_MAX = 80;

/**
 * The only shape an anchor id may take: one or more lower-case alphanumeric
 * runs separated by single hyphens.
 */
export const ANCHOR_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True when `value` is a usable anchor id. */
export function isAnchorId(value: string): boolean {
  return value.length > 0 && value.length <= ANCHOR_MAX && ANCHOR_PATTERN.test(value);
}

/**
 * The record families that carry an anchor, and the prefix each one uses.
 *
 * The prefixes are short because they appear in the address bar, and they are
 * distinct from the kind labels so a reader can tell `wa-` (a WhatsApp group)
 * from `resource-` when editing a URL by hand. `whatsapp` uses `wa` rather than
 * the kind name for that reason.
 */
export type AnchorFamily =
  | "faq"
  | "ticket"
  | "stay"
  | "sale"
  | "whatsapp"
  | "resource"
  | "partner";

export const ANCHOR_PREFIX: Readonly<Record<AnchorFamily, string>> = {
  faq: "faq",
  ticket: "ticket",
  stay: "stay",
  sale: "sale",
  whatsapp: "wa",
  resource: "resource",
  partner: "partner",
};

/**
 * The id the chapter page's `<h1>` already carries, used as the "chapter top"
 * anchor. It is a constant rather than derived from the slug because the page
 * sets it once for every chapter.
 */
export const GUIDE_TOP_ANCHOR = "chapter-title";

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NOT_SEGMENT = /[^a-z0-9]+/g;

/**
 * One record id folded into the character set an anchor allows.
 *
 * The data ids are already kebab-case, so in practice this changes nothing. It
 * exists so a future id with an underscore, a dot, an accent or an emoji cannot
 * produce an invalid anchor, and so the failure is a tidy id rather than a
 * thrown error at build time: a search result that scrolls to the right record
 * with a slightly tidied id beats a build that fails over punctuation.
 */
function toSegment(value: string): string {
  const folded = value
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NOT_SEGMENT, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return folded.length > 0 ? folded : "record";
}

/** FNV-1a, 32-bit, as base 36. Short, stable, and dependency-free. */
function digest(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    // `Math.imul` keeps the multiply in 32-bit range, which `*` does not.
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(-7);
}

/**
 * `prefix-segment`, capped at {@link ANCHOR_MAX}.
 *
 * A record id that already begins with the family's own word is not prefixed
 * twice: the community data uses `wa-1`, `resource-travel-partner` and
 * `partner-dca-travel`, and `wa-wa-1` reads like a mistake in the address bar.
 * The word is only stripped when something is left after it (`partner-partner`
 * keeps one), so an id that is exactly the prefix still yields a usable anchor.
 */
function join(prefix: string, segment: string): string {
  const folded = toSegment(segment);
  const withoutEcho =
    folded === prefix
      ? folded
      : folded.startsWith(`${prefix}-`)
        ? folded.slice(prefix.length + 1)
        : folded;

  const full = `${prefix}-${withoutEcho}`;
  if (full.length <= ANCHOR_MAX) return full;

  const tail = `-${digest(full)}`;
  const room = ANCHOR_MAX - prefix.length - 1 - tail.length;
  // Cut on a hyphen where possible, so the short id still reads as words.
  const cut = withoutEcho.slice(0, Math.max(1, room));
  const boundary = cut.lastIndexOf("-");
  const head = (boundary > 0 ? cut.slice(0, boundary) : cut).replace(/-+$/, "");
  return `${prefix}-${head || "record"}${tail}`;
}

/**
 * The anchor id for one record: `faq-<id>`, `ticket-<id>`, `stay-<id>`,
 * `sale-<id>`, `wa-<id>`, `resource-<id>` or `partner-<id>`.
 *
 * Deterministic: the same family and record id always give the same string, with
 * no clock, no counter and no randomness, which is what lets the index and the
 * page compute it independently.
 */
export function recordAnchor(family: AnchorFamily, recordId: string): string {
  return join(ANCHOR_PREFIX[family], recordId);
}

/**
 * The anchor for one heading inside a guide chapter.
 *
 * Chapter headings already carry an id in the content (`src/content/schema.ts`
 * validates it as kebab-case), so this only has to check it and fall back to a
 * tidy value if a hand-written chapter id is ever outside the pattern.
 */
export function guideSectionAnchor(headingId: string): string {
  return isAnchorId(headingId) ? headingId : join("section", headingId);
}

/**
 * The anchor for one FAQ answer.
 *
 * FAQ record ids are only unique within their own collection: the shared set
 * restates a Belgium rule under the same id, so `faq-<id>` alone would name two
 * different answers. The collection therefore becomes the prefix, with the same
 * short keys the search ids use.
 *
 * The page that renders a collection must use this function for the row id, so
 * the link and the target cannot drift.
 */
export type FaqCollection = "belgium" | "winter" | "brasil" | "shared";

const FAQ_PREFIX: Readonly<Record<FaqCollection, string>> = {
  belgium: "be",
  winter: "wi",
  brasil: "br",
  shared: "sh",
};

export function faqAnchor(collection: FaqCollection, recordId: string): string {
  return recordAnchor("faq", `${FAQ_PREFIX[collection]}-${recordId}`);
}

/**
 * `route#anchor`, or just `route` when there is no anchor.
 *
 * The route is expected to be a site path (it has already been checked against
 * the whitelist by the builder); this function only joins, and it will not
 * invent a hash out of an empty anchor.
 */
export function hrefWithAnchor(route: string, anchor: string | null | undefined): string {
  if (anchor === null || anchor === undefined || anchor === "") return route;
  return `${route}#${anchor}`;
}
