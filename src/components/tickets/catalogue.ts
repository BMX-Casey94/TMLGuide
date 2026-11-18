/**
 * Pure helpers shared by the tickets data layer and the explorer.
 *
 * Everything here works on values passed in as arguments and imports no dataset,
 * so a Client Component can use it without dragging zod or the festival records
 * into the browser bundle. The data-loading side lives in `selectors.ts`, which is
 * server-only in practice.
 */

import type {
  CatalogueCategory,
  CatalogueItem,
  CatalogueSaleWindow,
  EditionCatalogue,
  PriceTier,
} from "./types";
import type { Source } from "@/data/schemas";

function byText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** The later of two ISO dates. Both are schema-checked calendar dates. */
export function laterDate(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/** The most recent verification date across a set of records. */
export function latestVerified(
  records: readonly { lastVerified: string }[],
  fallback: string,
): string {
  return records.reduce((latest, record) => laterDate(latest, record.lastVerified), fallback);
}

/** De-duplicates sources by URL, keeping first-seen order. */
export function uniqueSources(sources: readonly Source[]): Source[] {
  const seen = new Set<string>();
  const result: Source[] = [];
  for (const source of sources) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    result.push(source);
  }
  return result;
}

/* ---------------------------------------------------------------------------------------------
 * Tier pairing
 * ------------------------------------------------------------------------------------------- */

/** The two sale-tier suffixes the Belgian and Winter datasets use. */
const TIER_SUFFIX = /-(presale|worldwide)$/;

export const TIER_LABELS: Readonly<Record<string, string>> = {
  presale: "Pre-sale",
  worldwide: "WorldWide sale",
};

/**
 * Pre-sale opens a week before the WorldWide sale, so it is always listed first.
 * An unfamiliar tier sorts after both and then alphabetically, so it still
 * appears rather than vanishing from the card.
 */
const TIER_ORDER: Readonly<Record<string, number>> = {
  presale: 0,
  worldwide: 1,
};

/**
 * Splits a record id into the product it belongs to and its sale tier.
 *
 * Returns null for an id with no recognised suffix, so a record that breaks the
 * convention is reported rather than merged into a product that is not its own.
 */
export function splitTierId(id: string): { productId: string; tierKey: string } | null {
  const match = TIER_SUFFIX.exec(id);
  if (match === null) return null;
  const tierKey = match[1];
  const productId = id.slice(0, id.length - match[0].length);
  if (productId.length === 0) return null;
  return { productId, tierKey };
}

/**
 * A product name without the edition and sale-tier suffix the dataset appends.
 *
 * Records read "Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale". A card
 * already shows the tier labels, so the suffix would repeat itself on every line.
 * A name that does not match the pattern is returned untouched: a tidy-up must
 * never truncate a name it did not understand.
 */
export function baseName(name: string): string {
  const withoutEdition = name.split(" — ")[0].trim();
  return withoutEdition.length > 0 ? withoutEdition : name;
}

/** Orders tiers pre-sale first, then WorldWide sale, then anything else by key. */
export function sortTiers(tiers: readonly PriceTier[]): PriceTier[] {
  return [...tiers].sort((a, b) => {
    const rankA = TIER_ORDER[a.key] ?? 99;
    const rankB = TIER_ORDER[b.key] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return byText(a.key, b.key);
  });
}

export interface GroupedProduct<T> {
  productId: string;
  records: T[];
}

/**
 * Groups records by product key, preserving dataset order so a category still
 * reads as curated.
 *
 * Records whose id carries no tier suffix come back in `unpaired` instead of being
 * folded into a neighbouring product.
 */
export function groupByProduct<T extends { id: string }>(
  records: readonly T[],
): { groups: GroupedProduct<T>[]; unpaired: T[] } {
  const groups = new Map<string, GroupedProduct<T>>();
  const unpaired: T[] = [];

  for (const record of records) {
    const split = splitTierId(record.id);
    if (split === null) {
      unpaired.push(record);
      continue;
    }
    const existing = groups.get(split.productId);
    if (existing) {
      existing.records.push(record);
    } else {
      groups.set(split.productId, { productId: split.productId, records: [record] });
    }
  }

  return { groups: [...groups.values()], unpaired };
}

/** "WorldWide sale only" when a product is sold in exactly that one moment. */
export function saleBadges(tiers: readonly PriceTier[]): string[] {
  if (tiers.length === 1 && tiers[0].key === "worldwide") return ["WorldWide sale only"];
  return [];
}

/* ---------------------------------------------------------------------------------------------
 * Sorting
 * ------------------------------------------------------------------------------------------- */

/** The lowest published price across a product's tiers, or Infinity when it has none. */
function lowestAmount(item: CatalogueItem): number {
  if (item.tiers.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...item.tiers.map((tier) => tier.amount));
}

/**
 * Orders a package list: cheapest published first, then by name.
 *
 * Products with no published price sort last. "Price not published yet" is not a
 * price and must never appear to be the cheapest option in a list ordered by cost.
 */
export function sortItems(items: readonly CatalogueItem[]): CatalogueItem[] {
  return [...items].sort((a, b) => {
    const unpublishedA = a.priceStatus === "unpublished" ? 1 : 0;
    const unpublishedB = b.priceStatus === "unpublished" ? 1 : 0;
    if (unpublishedA !== unpublishedB) return unpublishedA - unpublishedB;
    const priceA = lowestAmount(a);
    const priceB = lowestAmount(b);
    if (priceA !== priceB) return priceA < priceB ? -1 : 1;
    return byText(a.name, b.name);
  });
}

/** Windows in calendar order, so the strip reads as a schedule. */
export function sortWindows(windows: readonly CatalogueSaleWindow[]): CatalogueSaleWindow[] {
  return [...windows].sort((a, b) => {
    const delta = Date.parse(a.opensAt) - Date.parse(b.opensAt);
    if (delta !== 0) return delta;
    return byText(a.id, b.id);
  });
}

/* ---------------------------------------------------------------------------------------------
 * Lookup
 * ------------------------------------------------------------------------------------------- */

/** The category with this id, or undefined when the id is absent or unknown. */
export function findCategory(
  catalogue: EditionCatalogue,
  categoryId: string | undefined,
): CatalogueCategory | undefined {
  if (categoryId === undefined) return undefined;
  return catalogue.categories.find((category) => category.id === categoryId);
}

/** The item with this id inside a category, or undefined. */
export function findItem(
  category: CatalogueCategory | undefined,
  itemId: string | undefined,
): CatalogueItem | undefined {
  if (category === undefined || itemId === undefined) return undefined;
  return category.items.find((item) => item.id === itemId);
}

/** Every item in the catalogue, flattened in category order. */
export function allItems(catalogue: EditionCatalogue): CatalogueItem[] {
  return catalogue.categories.flatMap((category) => category.items);
}
