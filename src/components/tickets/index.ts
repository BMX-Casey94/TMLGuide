/**
 * Entry point for the tickets components and data layer.
 *
 * The explorer is a Client Component, so this barrel deliberately exports only
 * things that are safe to bundle for the browser: the route helpers, the pure
 * pairing helpers and the components. The data-loading module (`selectors.ts`) is
 * not re-exported here; a Server Component imports it directly.
 */
export { buildTicketHref, parseTicketView, type TicketView } from "./routes";
export { TICKET_EDITIONS, DEFAULT_TICKET_EDITION, type TicketEditionId } from "./routes";
export {
  allItems,
  findCategory,
  findItem,
  groupByProduct,
  sortItems,
  splitTierId,
  baseName,
} from "./catalogue";
export { COMPARISON_LIMIT, ComparisonProvider, isComparisonFull, toggleSelection } from "./comparison";
export { ComparisonTable } from "./comparison-table";
export { CompareToggle } from "./compare-toggle";
export { PackageCard } from "./package-card";
export { PriceTiers, UNPUBLISHED_LABEL } from "./price-tiers";
export { SaleTimeline } from "./sale-timeline";
export { SourceLine } from "./source-line";
export { TicketsExplorer } from "./tickets-explorer";
export { VisitorTime, useVisitorZone, visitorReading } from "./visitor-time";
export { formatCheckedDate, formatEuro, formatMoney, formatReal } from "./format";
export type {
  CatalogueCategory,
  CatalogueItem,
  CatalogueSaleWindow,
  EditionCatalogue,
  ExplainerRow,
  OfficialLink,
  PriceTier,
  TierCurrency,
} from "./types";
