import { SNIPPET_MAX, snippet } from "./text";
import { KIND_LABELS, KIND_ORDER, kindPrefix } from "./kinds";
import type { SearchEntry, SearchKind } from "./types";
import { hrefWithAnchor, isAnchorId } from "./anchors";
import { isKnownRoute, splitHref } from "./routes";
import { accommodationEntries } from "./sources/accommodation";
import { partnerEntries, resourceEntries, whatsappEntries } from "./sources/community";
import { editionEntries } from "./sources/editions";
import { faqEntries } from "./sources/faqs";
import { guideEntries, guideSectionEntries, isGuideChapterRoute } from "./sources/guides";
import { pageEntries } from "./sources/pages";
import { saleEntries } from "./sources/sales";
import { ticketEntries } from "./sources/tickets";
import type { SourceEntry } from "./sources/types";

/**
 * Each source list maps to exactly one kind, and therefore to exactly one
 * heading label and one group in the palette.
 *
 * This module imports every data file, so it is a Server Component concern.
 * Nothing that reaches the browser imports it: the client palette receives a
 * built index as data (`SearchDialog` builds it and passes it down), and
 * `kinds.ts` carries the labels without the datasets.
 */
const GROUPS: ReadonlyArray<{
  kind: SearchKind;
  entries: readonly SourceEntry[];
}> = [
  { kind: "page", entries: pageEntries },
  { kind: "guide", entries: guideEntries },
  { kind: "guide-section", entries: guideSectionEntries },
  { kind: "sale", entries: saleEntries },
  { kind: "ticket", entries: ticketEntries },
  { kind: "accommodation", entries: accommodationEntries },
  { kind: "edition", entries: editionEntries },
  { kind: "faq", entries: faqEntries },
  { kind: "whatsapp", entries: whatsappEntries },
  { kind: "resource", entries: resourceEntries },
  { kind: "partner", entries: partnerEntries },
];

/** Display order for result headings. */
export { KIND_ORDER };

/**
 * Build the search index from the validated data files.
 *
 * Pure and synchronous: no fetch, no filesystem, no `Date.now()`. Calling it
 * twice returns equal content, which is what makes it safe to run during render
 * and to assert on in tests.
 *
 * Entries are normalised here rather than at each source so the invariants —
 * unique ids, non-empty titles and snippets, snippets within
 * {@link SNIPPET_MAX}, hrefs on the route whitelist, anchors matching the anchor
 * pattern — hold for every entry regardless of which source list produced it. A
 * violation throws: a dead result in a shipped palette is worse than a loud
 * failure at build time.
 */
export function buildSearchIndex(): SearchEntry[] {
  const index: SearchEntry[] = [];
  const seen = new Set<string>();

  for (const group of GROUPS) {
    const label = KIND_LABELS[group.kind];

    for (const source of group.entries) {
      const id = `${kindPrefix(group.kind)}:${source.slug}`;
      if (seen.has(id)) throw new Error(`Duplicate search index id: ${id}`);
      seen.add(id);

      const title = source.title.trim();
      if (!title) throw new Error(`Search entry ${id} has no title`);

      const body = snippet(source.snippet);
      if (!body) throw new Error(`Search entry ${id} has no snippet`);

      /* The source names an anchor; this is the only place it becomes a
         fragment, so the href and the `anchor` field cannot disagree. */
      const anchor = source.anchor;
      if (anchor !== undefined && !isAnchorId(anchor)) {
        throw new Error(`Search entry ${id} has an invalid anchor: ${anchor}`);
      }
      const href = hrefWithAnchor(source.href, anchor);

      if (!isKnownRoute(href) && !isGuideChapterRoute(href)) {
        throw new Error(`Search entry ${id} links to unknown route ${href}`);
      }
      // Belt and braces: the route check above already parses the href.
      if (splitHref(href) === null) {
        throw new Error(`Search entry ${id} has an unparseable href ${href}`);
      }

      const entry: SearchEntry = {
        id,
        title: title.slice(0, SNIPPET_MAX),
        snippet: body,
        kind: group.kind,
        kindLabel: label,
        edition: source.edition,
        href,
        source: source.source,
      };
      if (anchor !== undefined) entry.anchor = anchor;
      if (source.lastVerified) entry.lastVerified = source.lastVerified;
      if (source.sourceUrl) entry.sourceUrl = source.sourceUrl;
      index.push(entry);
    }
  }

  return index;
}

/** Kind label for one entry kind, for consumers that hold only the kind. */
export function kindLabel(kind: SearchKind): string {
  return KIND_LABELS[kind];
}
