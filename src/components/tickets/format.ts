/**
 * Formatting helpers for the tickets page.
 *
 * Money never passes through this module as a formatted string held in data: a
 * record stores a number and the renderer decides the locale. Euros go through the
 * shared `src/lib/tools/money.ts` helpers so the page cannot drift from the rest of
 * the site; reais use their own `pt-BR` formatter, because Tomorrowland Brasil
 * publishes reais and no official euro equivalent exists to convert to.
 *
 * Instants are assembled from `Intl` parts rather than from a pattern. ICU versions
 * disagree on details that a price page cannot afford to be vague about: `en-GB`
 * renders September as "Sept", inserts a comma after the weekday, and would drop a
 * trailing ":00" if the hour pattern were not pinned. Taking the parts and joining
 * them here fixes the shape for good.
 */
import { eurosToCents, formatEur } from "@/lib/tools/money";
import type { TierCurrency } from "./types";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const checkedFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  /* Pinned: an unpinned formatter renders in the runtime zone, which can move a
     date by one day and differ between the server and the browser. */
  timeZone: "UTC",
});

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * An ISO 8601 instant that names its offset. A local date-time without one is
 * ambiguous, and `Date.parse` would silently read it as the runtime's own zone, so
 * the offset is required here rather than trusted to the parser.
 */
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:[Zz]|[+-]\d{2}:?\d{2})$/;

/** Formats a euro amount exactly as stored, for example 5707 becomes "€5,707.00". */
export function formatEuro(amount: number): string {
  return formatEur(eurosToCents(amount));
}

/** Formats a whole number of reais in Brazilian Portuguese, for example "R$ 3.160,00". */
export function formatReal(amount: number): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new RangeError(`formatReal: amount must be a finite number, received ${String(amount)}`);
  }
  return brlFormatter.format(amount);
}

/** Formats an amount in the currency its record is priced in. Never converts. */
export function formatMoney(amount: number, currency: TierCurrency): string {
  return currency === "BRL" ? formatReal(amount) : formatEuro(amount);
}

/**
 * Formats a `lastVerified` date as "18 Nov 2026".
 *
 * Returns null for anything unparseable, so a caller omits the line rather than
 * printing "Invalid Date" beside a price.
 */
export function formatCheckedDate(iso: string): string | null {
  if (typeof iso !== "string") return null;
  const value = iso.trim();
  const normalised = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return null;
  return checkedFormatter.format(date);
}

export interface InstantParts {
  /** "Sat 30 Jan 2027" in the short style, "2 December 2026" in the long one. */
  date: string;
  /** 24-hour clock, always with two digits for the hour and minute, for example "17:00". */
  time: string;
  /** The zone abbreviation the runtime reports, for example "CET", "GMT" or "GMT-3". */
  zone: string;
}

export type InstantStyle = "short" | "long";

const partsCache = new Map<string, Intl.DateTimeFormat>();

/**
 * One formatter per zone, kept because constructing `Intl.DateTimeFormat` is the
 * expensive part and a timeline renders the same zone several times.
 *
 * Every field is requested from the same formatter, so all parts describe the same
 * instant in the same zone.
 */
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const existing = partsCache.get(timeZone);
  if (existing !== undefined) return existing;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
      timeZone,
    });
  } catch {
    throw new RangeError(`"${timeZone}" is not a supported time zone`);
  }

  partsCache.set(timeZone, formatter);
  return formatter;
}

function pick(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
  zone: string,
): string {
  const part = parts.find((candidate) => candidate.type === type);
  if (part === undefined) {
    throw new RangeError(`the time zone "${zone}" did not produce a ${type} part`);
  }
  return part.value;
}

/** The last day of a month, so 30 February can be refused. */
function daysInMonth(year: number, month: number): number {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Splits an instant into the date, clock time and zone abbreviation it shows in a
 * named time zone.
 *
 * Sale times are the one place on this page where a silent misreading costs a
 * reader a ticket, so the zone is always explicit, an unsupported zone throws
 * rather than falling back to the visitor's clock, and an instant without an offset
 * is refused instead of being read as local time.
 *
 * @throws RangeError when the instant is unparseable, has no offset, or the zone is
 *   unknown to the runtime.
 */
export function formatInstantParts(
  instant: string,
  timeZone: string,
  style: InstantStyle = "short",
): InstantParts {
  if (typeof instant !== "string" || !INSTANT_PATTERN.test(instant)) {
    throw new RangeError(
      `formatInstantParts: ${JSON.stringify(instant)} must be an ISO 8601 instant with an offset or Z`,
    );
  }

  const [yearText, monthText, dayText] = instant.slice(0, 10).split("-");
  const calendarYear = Number(yearText);
  const calendarMonth = Number(monthText);
  const calendarDay = Number(dayText);
  if (
    !Number.isInteger(calendarMonth) ||
    calendarMonth < 1 ||
    calendarMonth > 12 ||
    !Number.isInteger(calendarDay) ||
    calendarDay < 1 ||
    calendarDay > daysInMonth(calendarYear, calendarMonth)
  ) {
    // Date.parse would roll an impossible date into the next month, so a sale on
    // "30 February" would silently become 2 March.
    throw new RangeError(
      `formatInstantParts: ${JSON.stringify(instant)} names a date that does not exist`,
    );
  }

  const epoch = Date.parse(instant);
  if (!Number.isFinite(epoch)) {
    throw new RangeError(`formatInstantParts: ${JSON.stringify(instant)} is not a valid instant`);
  }

  const parts = formatterFor(timeZone).formatToParts(new Date(epoch));
  const day = pick(parts, "day", timeZone);
  const month = Number(pick(parts, "month", timeZone));
  const year = pick(parts, "year", timeZone);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`the time zone "${timeZone}" reported an impossible month: ${month}`);
  }

  const date =
    style === "long"
      ? `${Number(day)} ${MONTHS_LONG[month - 1]} ${year}`
      : `${pick(parts, "weekday", timeZone)} ${Number(day)} ${MONTHS_SHORT[month - 1]} ${year}`;

  return {
    date,
    time: `${pick(parts, "hour", timeZone)}:${pick(parts, "minute", timeZone)}`,
    zone: pick(parts, "timeZoneName", timeZone),
  };
}

/** "Sat 30 Jan 2027, 17:00 CET" in the given zone. */
export function formatInstantLong(instant: string, timeZone: string): string {
  const parts = formatInstantParts(instant, timeZone, "short");
  return `${parts.date}, ${parts.time} ${parts.zone}`;
}

/** "2 December 2026 at 15:00 CET" in the given zone. */
export function formatInstantProse(instant: string, timeZone: string): string {
  const parts = formatInstantParts(instant, timeZone, "long");
  return `${parts.date} at ${parts.time} ${parts.zone}`;
}
