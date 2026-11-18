import { communityData } from "@/data/community";
import { joinSnippet, stripEmoji } from "./types";
import type { SourceEntry } from "./types";

/**
 * Community content, derived from the validated data files rather than retyped,
 * so a change to a group, a resource or a partner flows straight through to the
 * palette.
 *
 * Everything links to `/community`, which renders all three collections with
 * their warnings, filters and full partner disclosures. The palette deliberately
 * does not link out to an invite or a partner site: a search result is a
 * wayfinding aid, and the page that carries the safety note is where a reader
 * should land.
 *
 * `sourceUrl` is the URL the data record itself cites, which for a group is the
 * invite that was opened and for a partner is their own site. It is shown as
 * provenance only, never as the result's destination.
 */

const RESOURCE_CATEGORY_TEXT: Readonly<Record<string, string>> = {
  official: "Official",
  transport: "Transport",
  accommodation: "Accommodation",
  practical: "Practical",
  community: "Community",
  other: "Other",
};

export const resourceEntries: SourceEntry[] = communityData.resources.map((resource) => ({
  slug: `resource-${resource.id}`,
  title: resource.title,
  snippet: joinSnippet([RESOURCE_CATEGORY_TEXT[resource.category], resource.description]),
  edition: resource.edition,
  href: "/community",
  source: "src/data/community/resources.ts",
  sourceUrl: resource.source.url,
  lastVerified: resource.lastVerified,
}));

/**
 * Group titles carry emoji for scanning in the directory. They are stripped
 * here, both because they add nothing to a match and because a title made mostly
 * of pictographs reads badly in a one-line result.
 */
export const whatsappEntries: SourceEntry[] = communityData.whatsappGroups.map((group) => ({
  slug: `whatsapp-${group.id}`,
  title: stripEmoji(group.title),
  snippet: joinSnippet([
    "WhatsApp group",
    group.region,
    group.edition === "all" ? "Any edition" : undefined,
  ]),
  edition: group.edition,
  href: "/community",
  source: "src/data/community/whatsapp-groups.ts",
  sourceUrl: group.source.url,
  lastVerified: group.lastVerified,
}));

export const partnerEntries: SourceEntry[] = communityData.partners.map((partner) => ({
  slug: `partner-${partner.id}`,
  title: partner.name,
  snippet: joinSnippet([
    partner.offer,
    partner.promoCode === undefined ? undefined : `Code ${partner.promoCode}`,
  ]),
  edition: partner.edition,
  href: "/community",
  source: "src/data/community/partners.ts",
  sourceUrl: partner.source.url,
  lastVerified: partner.lastVerified,
}));
