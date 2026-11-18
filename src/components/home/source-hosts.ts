/**
 * The official hosts the About page's data-sources table lists, and a check
 * that the table covers every official host the data actually cites.
 *
 * The About page tells a reader that every fact names its source, so it also
 * shows which sources those are. The list is written by hand because each host
 * needs a one-line description of what it covers, and a test compares it with
 * the URLs in the data: a citation to a new Tomorrowland host fails the suite
 * until the table names it, so the page cannot quietly fall out of date.
 *
 * Only Tomorrowland's own properties are listed. The data also cites primary
 * operator pages (a resort's parking page, a venue's contact page) and a handful
 * of community links; those are not festival sources, belong to individual
 * records rather than to the site's method, and would make the table a link
 * directory. They are therefore deliberately out of scope here.
 */
import { belgiumData } from "@/data/belgium";
import { brasilData } from "@/data/brasil";
import { sharedData } from "@/data/shared";
import { winterData } from "@/data/winter";

/** A host the data cites, with what it covers. */
export interface SourceHost {
  /** The bare hostname, as it appears in a URL. */
  readonly host: string;
  /** One line naming what this host is used for. */
  readonly role: string;
}

/**
 * Tomorrowland's own hosts, grouped by what they cover. The order is the order
 * of the table: the three edition sites first, then their help centres, then
 * the festival-wide properties.
 */
export const OFFICIAL_HOST_ROLES: readonly SourceHost[] = [
  { host: "belgium.tomorrowland.com", role: "Belgium 2027 tickets, sales and practical pages" },
  { host: "winter.tomorrowland.com", role: "Winter 2027 tickets, add-ons and practical pages" },
  { host: "brasil.tomorrowland.com", role: "Brasil 2027 tickets, DreamVille and add-ons" },
  { host: "press.belgium.tomorrowland.com", role: "Belgium press releases" },
  { host: "press.winter.tomorrowland.com", role: "Winter press releases" },
  { host: "press.brasil.tomorrowland.com", role: "Brasil press releases" },
  { host: "portaldoamanha.tomorrowlandbrasil.com", role: "The Brasil Bybit Early Bird sale page" },
  { host: "faq.tomorrowland.com", role: "The official help centre, where the festival rules live" },
  { host: "faq.tomorrowlandwinter.com", role: "The Winter help centre" },
  { host: "tomorrowlandbrasil.zendesk.com", role: "The Brasil help centre" },
  { host: "thailand.tomorrowland.com", role: "Thailand edition dates" },
  { host: "nft.tomorrowland.com", role: "NFT collections, the Medallion and wallet safety" },
  {
    host: "www.tomorrowland.com",
    role: "Festival-wide articles and the One World Radio page",
  },
];

/** The hosts the table accounts for. */
export const ACCOUNTED_HOSTS: readonly string[] = OFFICIAL_HOST_ROLES.map((entry) => entry.host);

/** Reads the hostname from a URL, or null when it cannot be parsed. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True for a host Tomorrowland runs: `tomorrowland.com` itself, any subdomain of
 * it (which covers the three edition sites, the press sites, `www`, `nft` and
 * `portaldoamanha.tomorrowlandbrasil.com`), plus the two help-centre domains the
 * festival uses for Brasil and Winter, which are branded Tomorrowland but hosted
 * on Zendesk.
 */
export function isOfficialHost(host: string): boolean {
  return (
    host === "tomorrowland.com" ||
    host.endsWith(".tomorrowland.com") ||
    host.endsWith(".tomorrowlandbrasil.com") ||
    host === "tomorrowlandbrasil.zendesk.com" ||
    host === "faq.tomorrowlandwinter.com"
  );
}

/**
 * Every official host cited by a set of URLs, sorted, so the table can be
 * checked against the data in one assertion.
 *
 * URLs that are not official are ignored: they belong to individual records and
 * are outside the table's scope, as explained at the top of this file.
 */
export function officialHostsCited(urls: readonly string[]): readonly string[] {
  const hosts = new Set<string>();
  for (const url of urls) {
    const host = hostOf(url);
    if (host !== null && isOfficialHost(host)) hosts.add(host);
  }
  return [...hosts].sort();
}

/**
 * The official hosts cited by the data that the table does not list.
 *
 * An empty list means the table is complete. A non-empty one names the hosts to
 * add, so the failure message is the fix rather than a count to hunt down.
 */
export function unlistedOfficialHosts(urls: readonly string[]): readonly string[] {
  const listed = new Set(ACCOUNTED_HOSTS);
  return officialHostsCited(urls).filter((host) => !listed.has(host));
}

/**
 * Every source URL the site's data cites.
 *
 * Assembled here rather than in the page so the About table's test and the page
 * itself check the same set: if a collection is added to one and not the other,
 * the page and its assertion drift apart.
 */
export function citedSourceUrls(): readonly string[] {
  return [
    ...sharedData.editions.map((record) => record.source.url),
    ...sharedData.faqs.map((record) => record.source.url),
    ...belgiumData.tickets.map((record) => record.source.url),
    ...belgiumData.faqs.map((record) => record.source.url),
    ...belgiumData.saleWindows.map((record) => record.source.url),
    ...winterData.tickets.map((record) => record.source.url),
    ...winterData.faqs.map((record) => record.source.url),
    ...winterData.saleWindows.map((record) => record.source.url),
    ...brasilData.tickets.map((record) => record.source.url),
    ...brasilData.facts.map((record) => record.source.url),
    ...brasilData.saleWindows.map((record) => record.source.url),
  ];
}
