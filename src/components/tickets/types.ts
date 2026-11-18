/**
 * Shapes the tickets page renders.
 *
 * Everything here is plain JSON-compatible data: strings, numbers, arrays and
 * objects. That matters twice over. The catalogue is built on the server from
 * the validated datasets in `src/data`, then handed to the explorer, which is a
 * Client Component, so nothing may survive only as a class instance or a getter.
 *
 * These are types only. They import no data, so a client component can depend on
 * this module without pulling zod or the festival records into the browser.
 */
import type { Icon3DName } from "@/components/ui/icon-3d";
import type { Source } from "@/data/schemas";
import type { TicketEditionId } from "./routes";

/** The currency a tier is priced in. Reais are never converted to euros. */
export type TierCurrency = "EUR" | "BRL";

/**
 * One published price for a product.
 *
 * Belgian and Winter records hold a single price each, so a product sold in two
 * sale moments arrives as two records that are paired back into one product with
 * two tiers. `key` is what makes that pairing visible in a comparison: two
 * products share a tier key when they are quoting the same sale moment.
 */
export interface PriceTier {
  /** Stable identifier for the sale moment, for example "presale". */
  key: string;
  /** Human label, for example "Pre-sale" or "Half-price (meia-entrada)". */
  label: string;
  /** Edition year the price belongs to, taken from the record itself. */
  year: number;
  currency: TierCurrency;
  /**
   * The amount in whole currency units: euros with at most two decimals, or
   * whole reais. It is never a pre-formatted string, so the renderer owns the
   * locale.
   */
  amount: number;
  /** What the amount buys, when the record states it, for example "per stay". */
  unit?: string;
  /** Tier-specific qualifier from the record, often the arithmetic breakdown. */
  note?: string;
  source: Source;
  lastVerified: string;
}

/**
 * Whether a price can be shown.
 *
 * `unpublished` is a real, honest state rather than an error: the product is
 * known to exist and Tomorrowland has published no price for it, so the card
 * shows "Price not published yet" beside the official page instead of a figure.
 */
export type PriceStatus = "published" | "unpublished";

/** A product: a pass, a package or a placeholder for an unpublished price. */
export interface CatalogueItem {
  /** Kebab-case id, also the `package` query parameter. */
  id: string;
  categoryId: string;
  name: string;
  /** Capacity, length or unit qualifier, for example "2 people · for the whole stay". */
  qualifier?: string;
  /** What the product includes, exactly as the record lists it. Empty when absent. */
  includes: string[];
  /** Prose the record attaches to the product, shown in the detail view. */
  note?: string;
  tiers: PriceTier[];
  priceStatus: PriceStatus;
  /** Why no price is shown, quoting the record that says so. */
  missingReason?: string;
  /** Official page for a product with no published price. */
  officialUrl?: string;
  /** Short status pills, for example "Sold out" or "WorldWide sale only". */
  badges: string[];
  source: Source;
  lastVerified: string;
}

export interface CatalogueCategory {
  id: string;
  label: string;
  /** Tracked mono label above the category title. */
  kicker: string;
  description: string;
  icon: Icon3DName;
  items: CatalogueItem[];
  /**
   * Why a category has no products, when that is deliberate. A category whose
   * products exist but carry no published price is shown with this note and the
   * official page, never with an estimated figure.
   */
  emptyNote?: string;
  /** The official page a reader should check when a category has no products. */
  emptyUrl?: string;
}

/**
 * A dated moment in the edition's sale calendar, normalised across the three
 * editions. Belgium and Winter pin their windows to Europe/Brussels; Brasil
 * publishes in America/Sao_Paulo, so the zone travels with the record instead of
 * being assumed.
 */
export interface CatalogueSaleWindow {
  id: string;
  name: string;
  /** ISO 8601 instant with an explicit offset. */
  opensAt: string;
  closesAt?: string;
  timeZone: string;
  audience: string;
  notes?: string;
  /** Published status, where the edition records one ("Past", "Open", "Upcoming"). */
  statusLabel?: string;
  source: Source;
  lastVerified: string;
}

/** One row of the "how sales work" explainer. */
export interface ExplainerRow {
  id: string;
  term: string;
  detail: string;
  sources: Source[];
  lastVerified: string;
}

/** An official link, drawn from a record that cites it. */
export interface OfficialLink {
  label: string;
  url: string;
}

/** Everything the page needs for one edition. */
export interface EditionCatalogue {
  edition: TicketEditionId;
  label: string;
  /** The edition year, read from the shared editions overview. */
  year: number;
  categories: CatalogueCategory[];
  windows: CatalogueSaleWindow[];
  explainer: ExplainerRow[];
  officialLinks: readonly OfficialLink[];  /** The most recent `lastVerified` across the edition's records. */
  checkedOn: string;
}
