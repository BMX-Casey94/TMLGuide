import { sharedData } from "@/data/shared";
import type { EditionOverview } from "@/data/shared/editions";
import { formatDateRange } from "../format";
import { ticketsRoute } from "../routes";
import type { KnownRoute } from "../routes";
import type { EditionScope } from "../types";
import { joinSnippet } from "./types";
import type { SourceEntry } from "./types";

/**
 * Edition facts, from the shared editions overview.
 *
 * Derived from the validated overview rather than retyped, so the palette can
 * never list a festival the site does not know about, or miss one it does.
 *
 * Each covered edition links to its own view of the tickets page, which is the
 * one page that addresses an edition in its URL. Thailand has no guide and no
 * edition view of the tickets page, so it links to the bare tickets page rather
 * than to a URL that would fall back to Belgium and mislead.
 */

const STATUS_TEXT: Readonly<Record<EditionOverview["status"], string>> = {
  past: "Past edition",
  "sold-out": "Sold out",
  "on-sale": "On sale",
  upcoming: "Upcoming",
};

function scopeFor(edition: EditionOverview): EditionScope {
  return edition.guideEdition ?? "all";
}

function routeFor(edition: EditionOverview): KnownRoute {
  return edition.guideEdition === undefined ? "/guides/tickets" : ticketsRoute(edition.guideEdition);
}

export const editionEntries: SourceEntry[] = sharedData.editions.map((edition) => ({
  slug: `edition-${edition.id}`,
  title: edition.name,
  snippet: joinSnippet([
    formatDateRange(edition.startsOn, edition.endsOn),
    edition.venue,
    edition.location,
    STATUS_TEXT[edition.status],
    edition.notes,
  ]),
  edition: scopeFor(edition),
  href: routeFor(edition),
  source: "src/data/shared/editions.ts",
  sourceUrl: edition.source.url,
  lastVerified: edition.lastVerified,
}));
