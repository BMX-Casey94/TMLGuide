/**
 * Tier pairing for price records.
 *
 * Belgium and Winter store one record per product per sale tier, because the
 * ticket and accommodation schemas each carry a single price. A reader thinks in
 * products, so a palette result is one row per product with both prices in the
 * snippet. Pairing here is by id suffix only — the same convention the data
 * files document — and a record without a recognised suffix is returned as its
 * own row rather than being folded into a neighbour it does not belong to.
 */

/** The sale-tier suffixes the Belgian and Winter datasets use. */
const TIER_SUFFIX = /-(presale|worldwide)$/;

/** Display wording for a tier key, in the order pre-sale then WorldWide sale. */
const TIER_TEXT: Readonly<Record<string, { label: string; order: number }>> = {
  presale: { label: "pre-sale", order: 0 },
  worldwide: { label: "WorldWide sale", order: 1 },
};

export interface TierRecord {
  readonly id: string;
  readonly name: string;
}

export interface TierGroup<T extends TierRecord> {
  /** The product id, with the tier suffix removed. */
  readonly productId: string;
  /** Records in display order: pre-sale, then WorldWide sale. */
  readonly records: readonly { readonly tierKey: string; readonly record: T }[];
}

/**
 * A product name without the edition and sale-tier suffix the dataset appends.
 *
 * Records read "Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale". The
 * snippet already names the tier, so the suffix would repeat itself. A name that
 * does not carry the separator is returned untouched: a tidy-up must never
 * truncate a name it did not understand.
 */
export function productName(name: string): string {
  const base = name.split(" \u2014 ")[0].trim();
  return base.length > 0 ? base : name;
}

/** "pre-sale", "WorldWide sale", or the raw key for a tier this file has not seen. */
export function tierLabel(key: string): string {
  return TIER_TEXT[key]?.label ?? key;
}

/**
 * Groups records by product, dropping a repeated name.
 *
 * Two records only pair when their base names agree as well as their ids: an id
 * suffix alone cannot prove that "Easy Tent 2P — Pre-Sale" and "Easy Tent 4P —
 * WorldWide Sale" were meant to share a row, and the id convention guarantees
 * they will not.
 */
export function pairTiers<T extends TierRecord>(records: readonly T[]): TierGroup<T>[] {
  const byProduct = new Map<string, Map<string, T>>();

  for (const record of records) {
    const match = TIER_SUFFIX.exec(record.id);
    const productId = match === null ? record.id : record.id.slice(0, record.id.length - match[0].length);
    const tierKey = match === null ? "single" : match[1];
    if (productId.length === 0) continue;

    const existing = byProduct.get(productId);
    if (existing === undefined) {
      byProduct.set(productId, new Map([[tierKey, record]]));
      continue;
    }
    existing.set(tierKey, record);
  }

  return [...byProduct.entries()].map(([productId, tiers]) => {
    const ordered = [...tiers.entries()].sort(
      ([a], [b]) => (TIER_TEXT[a]?.order ?? 99) - (TIER_TEXT[b]?.order ?? 99) || (a < b ? -1 : 1),
    );
    return {
      productId,
      records: ordered.map(([tierKey, record]) => ({ tierKey, record })),
    };
  });
}
