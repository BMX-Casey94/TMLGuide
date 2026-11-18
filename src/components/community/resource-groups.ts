import type { Resource, ResourceCategory } from "@/data/schemas";

/**
 * Presentation rules for the community resources list.
 *
 * The label a resource carries is a claim about who published it, so it is
 * derived from one field only: `confidence`. A resource is "Official" when and
 * only when its citation sits on a tomorrowland.com host (the data layer already
 * enforces that), which means a record can never borrow the badge from its
 * category alone. `resource-apps` is the case that matters: it sits in the
 * "official" category because the apps are official, but its URL is a lnk.to
 * shortener, so it is not badged Official.
 */

export type ResourceProvenance = "official" | "third-party" | "community";

/**
 * `third-party` covers links to services and documents on someone else's
 * domain (a resale marketplace, a third-party map, a Drive file, a playlist);
 * `community` covers community-run pages such as chats and Facebook groups.
 * Both are unofficial, but "tool" is the wrong word for a chat invite, so the
 * two are told apart.
 */
export function resourceProvenance(resource: Resource): ResourceProvenance {
  if (resource.confidence === "official") return "official";
  if (resource.category === "community") return "community";
  return "third-party";
}

/** The visible badge text, or null when no badge should be printed. */
export function resourceBadge(resource: Resource): string | null {
  const provenance = resourceProvenance(resource);
  if (provenance === "official") return "Official";
  if (provenance === "third-party") return "Unofficial third-party tool";
  return "Unofficial community link";
}

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  official: "Official Tomorrowland",
  transport: "Transport",
  accommodation: "Accommodation",
  practical: "Practical tools and documents",
  community: "Community",
  other: "Music and media",
};

/** Reading order: what the festival itself publishes first, then tools, then people. */
const CATEGORY_ORDER: readonly ResourceCategory[] = [
  "official",
  "practical",
  "transport",
  "accommodation",
  "community",
  "other",
];

export interface ResourceGroup {
  readonly category: ResourceCategory;
  readonly label: string;
  readonly resources: readonly Resource[];
}

/**
 * Groups resources by category in reading order, keeping the data order inside
 * each group. Categories with no records are omitted rather than shown empty.
 */
export function groupResourcesByCategory(resources: readonly Resource[]): readonly ResourceGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: RESOURCE_CATEGORY_LABELS[category],
    resources: resources.filter((resource) => resource.category === category),
  })).filter((group) => group.resources.length > 0);
}

/** True when the resource opens a document rather than a site or service. */
export function isDocumentLink(resource: Resource): boolean {
  return /drive\.google\.com|docs\.google\.com/.test(resource.url);
}
