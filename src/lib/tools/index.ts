/**
 * Public API of the TMLGUIDE planning tools.
 *
 * These modules are pure logic: no React, no browser APIs and no data fetching.
 * The site's data layer supplies every real-world figure (prices, Pearl rates,
 * sale times, exchange rates) as a parameter, so nothing here embeds a value
 * that would need updating when the festival changes its mind.
 */

export {
  eurosToCents,
  centsToEuros,
  convertEurCentsToGbpPence,
  formatEur,
  formatGbp,
  sumCents,
} from "./money";

export {
  pearlsToEurCents,
  eurToPearls,
  planPearlTopUp,
  minimumSensiblePearls,
} from "./pearls";

export type {
  PearlConversion,
  PearlTopUpPlan,
  PearlTopUpInput,
  PearlPackage,
  PearlPurchase,
} from "./pearls";

export {
  GUIDE_TIME_ZONES,
  getSaleStatus,
  countdown,
  formatInZone,
  compareTimes,
  nextSale,
} from "./sale-timeline";

export type {
  SaleWindow,
  SaleStatus,
  Countdown,
  TimeComparison,
} from "./sale-timeline";

export { buildIcs, icsFilename } from "./ics";

export type { IcsEvent, IcsCalendarInput } from "./ics";

export { computeBudget, perDay } from "./budget";

export type {
  BudgetLine,
  BudgetInput,
  BudgetLineTotal,
  BudgetCategoryTotal,
  BudgetSummary,
  PerDayFigure,
} from "./budget";
