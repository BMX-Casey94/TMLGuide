/**
 * Indicative GBP (£) planning estimates for EUR ticket and package figures.
 *
 * Tomorrowland Belgium and Tomorrowland Winter publish prices in euros (EUR).
 * This module provides a single, dated reference rate to display a secondary
 * indicative GBP estimate beside EUR figures for UK visitors planning a trip.
 *
 * CRITICAL RULES:
 * - This rate is an indicative planning rate ONLY, never an official
 *   Tomorrowland exchange rate.
 * - Tomorrowland Brasil prices are published in Brazilian reais (BRL) and are
 *   NEVER converted.
 */
import { convertEurCentsToGbpPence, eurosToCents, formatGbp } from "@/lib/tools/money";

/**
 * Single indicative reference rate (GBP per 1 EUR) used for planning estimates.
 * Never treated as an official Tomorrowland rate.
 */
export const INDICATIVE_GBP_PER_EUR = 0.85;

/** ISO date (YYYY-MM-DD) when `INDICATIVE_GBP_PER_EUR` was last reviewed. */
export const INDICATIVE_GBP_RATE_DATE = "2026-11-20";

export type PriceCurrency = "EUR" | "BRL";

/**
 * Formats an indicative GBP (£) estimate for a EUR amount, e.g. `"≈ £2,402.95"`.
 *
 * Returns `null` for `"BRL"` (Tomorrowland Brasil prices stay in reais and are
 * never converted) and for invalid/negative amounts.
 */
export function formatIndicativeGbp(
  eurAmount: number,
  currency: PriceCurrency,
): string | null {
  if (currency !== "EUR") {
    return null;
  }
  if (typeof eurAmount !== "number" || !Number.isFinite(eurAmount) || eurAmount < 0) {
    return null;
  }

  const eurCents = eurosToCents(eurAmount);
  const gbpPence = convertEurCentsToGbpPence(eurCents, INDICATIVE_GBP_PER_EUR);
  return `≈ ${formatGbp(gbpPence)}`;
}
