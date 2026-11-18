/**
 * Sale timeline helpers for the TMLGUIDE planning tools.
 *
 * Ticket sales open at a stated instant. The site shows the same instant to a
 * reader in London and a reader in Brussels, and those two clocks disagree by an
 * hour for most of the year and agree for a few weeks around the spring change,
 * so every function here works from an absolute instant and formats it in a
 * named zone.
 */

import {
  formatInstantInZone,
  parseInstant,
  zonedDayParts,
} from "./instant";

/** The zones the guide compares: the UK and the festival's home country. */
export const GUIDE_TIME_ZONES = {
  london: "Europe/London",
  brussels: "Europe/Brussels",
} as const;

/** A named point in time at which a sale opens. */
export interface SaleWindow {
  readonly id: string;
  readonly name: string;
  /**
   * The opening instant as an ISO 8601 string with an explicit offset or `Z`,
   * for example "2027-01-30T16:00:00Z" or "2027-01-30T17:00:00+01:00".
   */
  readonly opensAtIso: string;
}

/** Whether a sale is still ahead of the reader or has begun. */
export type SaleStatus = "upcoming" | "open";

/** A countdown broken into display units. */
export interface Countdown {
  /** Signed whole seconds until opening: negative once the opening has passed. */
  readonly totalSeconds: number;
  /** Whole days in the distance to opening. */
  readonly days: number;
  /** Whole hours left after the days are counted. */
  readonly hours: number;
  /** Whole minutes left after the days and hours are counted. */
  readonly minutes: number;
  /** Whole seconds left after the days, hours and minutes are counted. */
  readonly seconds: number;
  /** Whether the opening instant has been reached. */
  readonly isPast: boolean;
}

/** An instant rendered in both guide zones. */
export interface TimeComparison {
  /** The instant as supplied. */
  readonly instantIso: string;
  /** The instant in London, for example "Sat 30 Jan 2027, 16:00 GMT". */
  readonly london: string;
  /** The instant in Brussels, for example "Sat 30 Jan 2027, 17:00 CET". */
  readonly brussels: string;
  /** The calendar date shown in London, as YYYY-MM-DD. */
  readonly londonDate: string;
  /** The calendar date shown in Brussels, as YYYY-MM-DD. */
  readonly brusselsDate: string;
  /** Whether the two zones show different calendar dates for this instant. */
  readonly dayDiffers: boolean;
}

function instantOf(now: Date): number {
  if (!(now instanceof Date)) {
    throw new RangeError("now must be a Date");
  }
  const epoch = now.getTime();
  if (!Number.isFinite(epoch)) {
    throw new RangeError("now must be a valid Date");
  }
  return epoch;
}

function assertWindow(window: SaleWindow): void {
  if (window === null || typeof window !== "object") {
    throw new RangeError("a sale window must be an object");
  }
  if (typeof window.id !== "string" || window.id.trim() === "") {
    throw new RangeError("a sale window needs a non-empty id");
  }
  if (typeof window.name !== "string" || window.name.trim() === "") {
    throw new RangeError(`sale window "${window.id}" needs a non-empty name`);
  }
}

function epochOfWindow(window: SaleWindow): number {
  assertWindow(window);
  return parseInstant(window.opensAtIso, `the opening time of "${window.id}"`);
}

/**
 * Reports whether a sale is still ahead of `now` or has already opened.
 *
 * @throws RangeError when the window is malformed or its opening time is not a
 * valid instant with an offset.
 */
export function getSaleStatus(window: SaleWindow, now: Date): SaleStatus {
  const opensAt = epochOfWindow(window);
  return instantOf(now) < opensAt ? "upcoming" : "open";
}

/**
 * Measures the distance from `now` to an opening instant.
 *
 * The unit fields describe the size of the distance, so they are never negative;
 * `isPast` and the sign of `totalSeconds` say which side of the opening the
 * reader is on. At the opening instant itself `totalSeconds` is zero and
 * `isPast` is true. Seconds are floored towards the past, so a reader one
 * fraction of a second after the opening sees -1 second past, never a negative
 * zero that would display as "now" in both directions.
 *
 * @throws RangeError when either value is not a valid instant.
 */
export function countdown(opensAtIso: string, now: Date): Countdown {
  const opensAt = parseInstant(opensAtIso, "opensAtIso");
  const current = instantOf(now);
  const differenceMs = opensAt - current;
  const totalSeconds = Math.floor(differenceMs / 1000);
  const magnitude = Math.abs(totalSeconds);

  return {
    totalSeconds,
    days: Math.floor(magnitude / 86_400),
    hours: Math.floor((magnitude % 86_400) / 3_600),
    minutes: Math.floor((magnitude % 3_600) / 60),
    seconds: magnitude % 60,
    isPast: differenceMs <= 0,
  };
}

/**
 * Formats an instant in a named zone, for example
 * "Sat 30 Jan 2027, 16:00 GMT" in Europe/London.
 *
 * @throws RangeError when the instant has no offset, is unparseable, or the zone
 * is not supported by the runtime's time-zone data.
 */
export function formatInZone(instantIso: string, timeZone: string, locale = "en-GB"): string {
  const epoch = parseInstant(instantIso, "instantIso");
  return formatInstantInZone(epoch, timeZone, locale);
}

/**
 * Formats an instant in both guide zones and reports whether the two zones
 * disagree about the calendar date. They can: at 00:30 Brussels time on the
 * morning the clocks in the UK have not yet gone forward, London still reads the
 * previous evening.
 *
 * @throws RangeError when the instant is not a valid instant with an offset.
 */
export function compareTimes(instantIso: string): TimeComparison {
  const epoch = parseInstant(instantIso, "instantIso");
  const londonParts = zonedDayParts(epoch, GUIDE_TIME_ZONES.london);
  const brusselsParts = zonedDayParts(epoch, GUIDE_TIME_ZONES.brussels);
  const londonDate = `${londonParts.year}-${londonParts.month}-${londonParts.day}`;
  const brusselsDate = `${brusselsParts.year}-${brusselsParts.month}-${brusselsParts.day}`;

  return {
    instantIso,
    london: formatInstantInZone(epoch, GUIDE_TIME_ZONES.london, "en-GB"),
    brussels: formatInstantInZone(epoch, GUIDE_TIME_ZONES.brussels, "en-GB"),
    londonDate,
    brusselsDate,
    dayDiffers: londonDate !== brusselsDate,
  };
}

/**
 * Finds the soonest sale that has not yet opened, or null when every sale in the
 * list has opened. Ties are broken by id so the result is stable across runs.
 *
 * @throws RangeError when the list is not an array, any window is malformed, or
 * any opening time is invalid.
 */
export function nextSale(windows: readonly SaleWindow[], now: Date): SaleWindow | null {
  if (!Array.isArray(windows)) {
    throw new RangeError("windows must be an array of sale windows");
  }
  const current = instantOf(now);

  let best: SaleWindow | null = null;
  let bestEpoch = Number.POSITIVE_INFINITY;

  for (const window of windows) {
    const opensAt = epochOfWindow(window);
    if (opensAt <= current) continue;
    if (
      opensAt < bestEpoch ||
      (opensAt === bestEpoch && best !== null && window.id < best.id)
    ) {
      best = window;
      bestEpoch = opensAt;
    }
  }

  return best;
}
