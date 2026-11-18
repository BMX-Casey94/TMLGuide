import type { EditionScope, WhatsappGroup } from "@/data/schemas";

/**
 * Filtering rules for the community WhatsApp directory.
 *
 * Everything here is pure: the directory component owns the interaction, and
 * these functions own the decisions, so the behaviour can be tested without a
 * DOM. Nothing in this module knows about the URL; `community-query.ts` owns
 * that, and both read the same `WhatsappFilters` shape.
 */

/**
 * The edition filter. `"all"` is a real value in the data (meet-ups that belong
 * to no single festival edition), so "no filter" needs a value of its own:
 * `"any"`. Using `"all"` for both would make the four non-edition groups
 * impossible to reach.
 */
export type EditionFilter = EditionScope | "any";

export interface WhatsappFilters {
  readonly q: string;
  readonly edition: EditionFilter;
  readonly region: string | null;
}

export const NO_WHATSAPP_FILTERS: WhatsappFilters = { q: "", edition: "any", region: null };

/**
 * Display labels for the edition values in the data.
 *
 * `all` is shown as "Other events" because that is what those four records are:
 * CORE Medellin, Terra Solis Dubai, UNITY Los Angeles and ADE Amsterdam belong
 * to no single Tomorrowland edition (see docs/data/community-omissions.md).
 * "All editions" would claim coverage the data does not support.
 */
export const EDITION_LABELS: Record<EditionScope, string> = {
  belgium: "Belgium",
  winter: "Winter",
  brasil: "Brasil",
  all: "Other events",
};

/** Regions naming no place at all; sorted first because they are the default meeting point. */
export const WORLDWIDE_REGION = "Worldwide";

/** Lowercases, trims and collapses whitespace so "  Alpe   d'Huez " matches "alpe d'huez". */
export function normaliseSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Region order: "Worldwide" first, then alphabetical, so the list is stable across renders. */
export function compareRegions(left: string, right: string): number {
  if (left === right) return 0;
  if (left === WORLDWIDE_REGION) return -1;
  if (right === WORLDWIDE_REGION) return 1;
  return left.localeCompare(right, "en-GB");
}

/**
 * True when a group survives every active filter.
 *
 * The text filter is a token search over title, region and edition label: every
 * whitespace-separated word must appear somewhere, so "dream easy" narrows to
 * the Easy Tent groups rather than returning nothing.
 */
export function matchesWhatsappFilters(group: WhatsappGroup, filters: WhatsappFilters): boolean {
  if (filters.edition !== "any" && group.edition !== filters.edition) return false;
  if (filters.region !== null && group.region !== filters.region) return false;

  const query = normaliseSearchText(filters.q);
  if (query === "") return true;

  const haystack = normaliseSearchText(
    [group.title, group.region, EDITION_LABELS[group.edition]].join(" "),
  );
  return query.split(" ").every((token) => haystack.includes(token));
}

export function filterWhatsappGroups(
  groups: readonly WhatsappGroup[],
  filters: WhatsappFilters,
): readonly WhatsappGroup[] {
  return groups.filter((group) => matchesWhatsappFilters(group, filters));
}

/** Every region present in the data, in display order. */
export function whatsappRegionOptions(groups: readonly WhatsappGroup[]): readonly string[] {
  return [...new Set(groups.map((group) => group.region))].sort(compareRegions);
}

export interface RegionGroup {
  readonly region: string;
  readonly groups: readonly WhatsappGroup[];
}

/**
 * Groups the filtered records by region, keeping the data order inside each
 * region so a group never jumps position when another region is filtered out.
 */
export function groupWhatsappByRegion(groups: readonly WhatsappGroup[]): readonly RegionGroup[] {
  const buckets = new Map<string, WhatsappGroup[]>();
  for (const group of groups) {
    const bucket = buckets.get(group.region);
    if (bucket === undefined) buckets.set(group.region, [group]);
    else bucket.push(group);
  }

  return [...buckets.keys()]
    .sort(compareRegions)
    .map((region) => ({ region, groups: buckets.get(region) ?? [] }));
}

/** "1 group" / "24 groups". */
export function countGroups(count: number): string {
  return `${count} ${count === 1 ? "group" : "groups"}`;
}

/**
 * The sentence shown in the polite live region. It always names both numbers
 * once a filter is active, so a reader knows how much is hidden rather than
 * only what is shown.
 */
export function describeWhatsappResults(shown: number, total: number): string {
  if (total === 0) return "No groups are published yet.";
  if (shown === total) return `Showing all ${countGroups(total)}.`;
  return `Showing ${shown} of ${countGroups(total)}.`;
}

/** True when at least one filter narrows the list, used to offer "Clear filters". */
export function hasActiveWhatsappFilters(filters: WhatsappFilters): boolean {
  return filters.q.trim() !== "" || filters.edition !== "any" || filters.region !== null;
}
