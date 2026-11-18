/**
 * Public surface of the TMLGUIDE tools components.
 *
 * Pages import from here so a rename inside a component does not ripple through
 * the routes, and so the server/client split is obvious at a glance: everything
 * exported below without a "use client" boundary is a Server Component, and the
 * interactive calculators are the three modules that carry the directive.
 */

export { ToolShell, TOOL_DISCLAIMER, type ToolSource, type ToolCrumb } from "./tool-shell";
export { ToolCard, type ToolCardProps, type ToolCardStatus } from "./tool-card";

export { BudgetCalculator, type BudgetCalculatorProps } from "./budget-calculator";
export { PearlCalculator, type PearlCalculatorProps } from "./pearl-calculator";
export { SaleTimeline, type SaleTimelineProps } from "./sale-timeline";

export {
  BUDGET_QUERY_KEY,
  BUDGET_STORAGE_KEY,
  MAX_PEOPLE,
  MIN_PEOPLE,
  budgetLinesFor,
  budgetStateSchema,
  buildInstalmentHint,
  computeBudgetResult,
  defaultBudgetState,
  repairBudgetState,
  resolveTicket,
  ticketOptionsFor,
  type BudgetResult,
  type BudgetState,
  type CategoryShare,
  type InstalmentHint,
  type PaymentTermsFact,
  type ResolvedTicket,
} from "./budget-state";

export { ticketChoicesFor, findTicketChoice, CUSTOM_TICKET_ID, type TicketChoice } from "./ticket-choices";

export {
  EDITION_LABEL,
  TOOL_EDITIONS,
  currencyForEdition,
  isToolEdition,
  toolCurrencySchema,
  toolEditionSchema,
  type ToolCurrency,
  type ToolEdition,
} from "./editions";

export {
  AMOUNT_PROBLEM_MESSAGE,
  MAX_MAJOR_UNITS,
  currencySymbol,
  formatAmount,
  formatMoney,
  parseAmountInput,
  parseWholeNumber,
  type AmountParseResult,
  type AmountProblem,
} from "./format";

export { formatWholeNumber, describeDuration } from "./numbers";

export {
  PEARL_DIRECTIONS,
  DIRECTION_LABEL,
  RATE_PROBLEM_MESSAGE,
  RATE_WARNING,
  ROUNDING_EXPLANATION,
  convertPearls,
  parsePearlRate,
  type PearlDirection,
  type PearlRate,
  type PearlResult,
} from "./pearl-logic";

export {
  EDITION_SALE_ZONE,
  SALE_OPEN_WINDOW_MS,
  buildTimeline,
  countdownTarget,
  countdownTo,
  describeSaleTime,
  detectLocalZone,
  saleStatusAt,
  type LocalAndBrussels,
  type SaleRecord,
  type TimelineEdition,
  type TimelineSale,
} from "./timeline-logic";

export {
  ICAL_PRODUCT_ID,
  SALE_REMINDERS_MINUTES,
  buildEditionCalendar,
  buildSaleCalendar,
  editionFilename,
  saleFilename,
  saleToEvent,
} from "./calendar-export";

export { downloadTextFile } from "./download";

export {
  buildShareUrl,
  clearToolState,
  loadToolState,
  resetToDefault,
  safeLocalStorage,
  saveToolState,
  type LoadedState,
  type LoadToolStateOptions,
  type StateOrigin,
  type StorageLike,
} from "./state";
