import type { EditionScope, Partner, Resource, WhatsappGroup } from "@/data/schemas";

/**
 * Counting helpers for the community hub.
 *
 * Pure and exported so the hub's section summaries can be tested without
 * rendering, and so a change in the data shows up as a failing number rather than
 * a quietly shorter page.
 */

export interface CommunityCounts {
  readonly whatsappGroups: number;
  readonly resources: number;
  readonly partners: number;
  readonly officialResources: number;
}

export function communityCounts(
  groups: readonly WhatsappGroup[],
  resources: readonly Resource[],
  partners: readonly Partner[],
): CommunityCounts {
  return {
    whatsappGroups: groups.length,
    resources: resources.length,
    partners: partners.length,
    officialResources: resources.filter((resource) => resource.confidence === "official").length,
  };
}

/**
 * Groups split by edition, used for the hub's summary line.
 *
 * `all` is reported as "Other events" for the same reason the filter uses that
 * label: those records belong to no single edition.
 */
export function groupsByEdition(
  groups: readonly WhatsappGroup[],
): Readonly<Record<EditionScope, number>> {
  const counts: Record<EditionScope, number> = { belgium: 0, winter: 0, brasil: 0, all: 0 };
  for (const group of groups) counts[group.edition] += 1;
  return counts;
}

/** A short, factual summary for the WhatsApp tab: how many chats, across how many regions. */
export function whatsappSummary(groups: readonly WhatsappGroup[]): string {
  if (groups.length === 0) return "No community groups are published yet.";
  const regions = new Set(groups.map((group) => group.region)).size;
  return `${groups.length} community groups across ${regions} ${
    regions === 1 ? "region" : "regions"
  }. Every invite was opened and checked on the date shown on its card.`;
}
