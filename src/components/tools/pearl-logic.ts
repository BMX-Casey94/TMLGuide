import { eurToPearls, pearlsToEurCents } from "@/lib/tools";
import { MAX_MINOR_UNITS } from "./format";

/**
 * Pearl calculator logic.
 *
 * A Pearl is the festival's cashless currency. Its euro value is set by the
 * organisers and published only when top-ups open, so this tool never assumes a
 * rate: the reader supplies one by typing it.
 *
 * No rate is read out of prose. The only rate the data layer holds is a sentence
 * in the Belgium FAQ describing previous editions ("€1.82 in 2025 … €1.90 in
 * 2026"), and scraping a number out of that sentence would present a 2026 figure
 * as though the tool had verified a 2027 one. So the page links to the FAQ for
 * context and asks the reader for the number. See `docs/briefs/wave4-common.md`.
 *
 * The arithmetic is the tested library's. `eurToPearls` floors to whole Pearls
 * and reports the money that cannot reach another Pearl; `pearlsToEurCents`
 * prices a whole number of Pearls at an integer cent rate. Both take cents, so
 * the rate is converted from a typed euro amount once, at the edge.
 */

/** Which way the reader is converting. */
export type PearlDirection = "euros-to-pearls" | "pearls-to-euros";

export const PEARL_DIRECTIONS: readonly PearlDirection[] = ["euros-to-pearls", "pearls-to-euros"];

export const DIRECTION_LABEL: Readonly<Record<PearlDirection, string>> = {
  "euros-to-pearls": "Euros to Pearls",
  "pearls-to-euros": "Pearls to euros",
};

/** A rate in whole euro cents per Pearl. */
export interface PearlRate {
  readonly centsPerPearl: number;
}

export type PearlRateProblem = "not-positive" | "too-precise" | "too-large";

export type PearlRateResult =
  | { readonly ok: true; readonly rate: PearlRate }
  | { readonly ok: false; readonly problem: PearlRateProblem };

/**
 * Reads a typed rate per Pearl into whole cents.
 *
 * Rates are published to the cent (€1.90, €1.82), so anything finer than a cent
 * is refused rather than rounded: a rate of €1.905 is not a rate the organisers
 * publish, and rounding it would misprice every Pearl.
 */
export function parsePearlRate(eurosPerPearl: number): PearlRateResult {
  if (!Number.isFinite(eurosPerPearl) || eurosPerPearl <= 0) {
    return { ok: false, problem: "not-positive" };
  }

  const scaled = eurosPerPearl * 100;
  const cents = Math.round(scaled);
  // The tolerance matches the money module's: the noise from one multiplication
  // is not a third decimal place.
  const tolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(scaled));
  if (Math.abs(scaled - cents) > tolerance) {
    return { ok: false, problem: "too-precise" };
  }
  if (!Number.isSafeInteger(cents) || cents > MAX_MINOR_UNITS) {
    return { ok: false, problem: "too-large" };
  }

  return { ok: true, rate: { centsPerPearl: cents } };
}

export interface PearlResult {
  /** Whole Pearls the money buys, or the Pearls being priced. */
  readonly pearls: number;
  /** Money that cannot reach another Pearl, in euro cents. */
  readonly remainderMinor: number;
  /** What the Pearls cost, or the money that was converted. */
  readonly amountMinor: number;
  /** True when the conversion left money that cannot buy a whole Pearl. */
  readonly hasRemainder: boolean;
}

/**
 * Converts in either direction at the supplied rate.
 *
 * Both directions are exact in the library: money is floored to whole Pearls
 * with the remainder reported, and Pearls are multiplied by the rate in cents.
 * Nothing is rounded up, because a partial Pearl cannot be bought.
 *
 * @throws RangeError when an input is outside what the library accepts, which
 *   can only happen if a caller skips {@link parsePearlRate}.
 */
export function convertPearls(
  direction: PearlDirection,
  amountMinor: number,
  rate: PearlRate,
): PearlResult {
  if (direction === "euros-to-pearls") {
    const conversion = eurToPearls(amountMinor, rate.centsPerPearl);
    return {
      pearls: conversion.wholePearls,
      remainderMinor: conversion.remainderEurCents,
      amountMinor,
      hasRemainder: conversion.remainderEurCents > 0,
    };
  }

  const cost = pearlsToEurCents(amountMinor, rate.centsPerPearl);
  return {
    pearls: amountMinor,
    remainderMinor: 0,
    amountMinor: cost,
    hasRemainder: false,
  };
}

/**
 * Reads a typed count of whole Pearls.
 *
 * Pearls are only sold whole, so a fractional entry is refused rather than
 * rounded: "10.5 Pearls" is not something the festival sells. A blank field
 * returns null, which the caller treats as "nothing entered yet".
 */
export function parsePearlCount(text: string): number | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim().replace(/^(?:R\$|€|EUR|BRL|P)\s*/i, "");
  if (!/^\d{1,7}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Reads a typed rate per Pearl, for example "1.90".
 *
 * This is deliberately separate from the money parser. The amount parser reads
 * "1,234" as a grouped whole number, which is right for a budget line but wrong
 * for a rate: a rate has one decimal mark and no grouping. Keeping them apart
 * means "1.905" reports "rates are published to the cent" rather than a generic
 * "too many decimal places", and a grouped figure cannot be mistaken for a rate.
 *
 * @returns the rate in whole cents, or a reason the text is not a rate.
 */
export function parseRateInput(text: string): { ok: true; centsPerPearl: number } | { ok: false; problem: PearlRateProblem } {
  if (typeof text !== "string") return { ok: false, problem: "not-positive" };

  const trimmed = text.trim().replace(/^(?:€|EUR)\s*/i, "");
  if (trimmed === "") return { ok: false, problem: "not-positive" };
  if (!/^\d*(?:[.,]\d*)?$/.test(trimmed)) return { ok: false, problem: "not-positive" };

  const normalised = trimmed.replace(",", ".");
  const [whole = "", fraction = ""] = normalised.split(".");
  if (fraction.length > 2) return { ok: false, problem: "too-precise" };

  const majorUnits = Number(whole === "" ? "0" : whole);
  if (!Number.isFinite(majorUnits)) return { ok: false, problem: "too-large" };

  const cents = majorUnits * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return { ok: false, problem: "too-large" };
  if (cents <= 0) return { ok: false, problem: "not-positive" };

  return { ok: true, centsPerPearl: cents };
}

/** The rounding rule, in plain language, shown with every result. */
export const ROUNDING_EXPLANATION =
  "Pearls are only sold whole. Converting money into Pearls gives the number of complete Pearls it buys, and shows any money left over that is not enough for another Pearl. Converting Pearls into money is exact, because every Pearl costs the same fixed amount.";

/** The warning every result carries about the coming edition's rate. */
export const RATE_WARNING =
  "The Pearl rate for 2027 has not been announced. Tomorrowland publishes the value of a Pearl only when top-ups open, which is around June before a July festival. The rate you enter here is one you supplied, not an official 2027 figure.";

/** A message for each rate problem, written for the reader. */
export const RATE_PROBLEM_MESSAGE: Readonly<Record<PearlRateProblem, string>> = {
  "not-positive": "Enter a rate greater than zero, for example 1.90.",
  "too-precise": "Rates are published to the cent, for example 1.90.",
  "too-large": "That rate is larger than this tool accepts.",
};
