import { eurosToCents, formatEur } from "@/lib/tools/money";

/**
 * Formatting for the guide pages.
 *
 * Two rules hold everywhere here. Money is formatted in the currency its record
 * is priced in and never converted, because no official source publishes a euro
 * value for a Brasil figure. Dates and instants are assembled from `Intl` parts
 * rather than from a pattern string, because ICU versions disagree about
 * abbreviations and a sale time is not a place to be vague.
 */

const CHECKED_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  /* Pinned: an unpinned formatter renders in the runtime zone, which can shift the
     day by one and differ between the server and the browser. */
  timeZone: "UTC",
});

const REAIS_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const UK_TIME_ZONE = "Europe/London";

/**
 * Formats a `YYYY-MM-DD` check date as "18 Nov 2026".
 *
 * Returns null for anything unparseable so the caller omits the line rather than
 * printing "Invalid Date" beside a price.
 */
export function formatCheckedDate(iso: string): string | null {
  if (typeof iso !== "string") return null;
  const value = iso.trim();
  const normalised = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return null;
  return CHECKED_FORMATTER.format(date);
}

const LONG_CHECKED_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

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
 * Formats a check date in full, as "18 November 2026".
 *
 * The month name comes from the table for the same reason the sale times use one:
 * `en-GB` renders September as "Sept" in some ICU builds, and a page that states
 * when it was checked should not change its wording with the runtime.
 */
export function formatLongCheckedDate(iso: string): string | null {
  if (typeof iso !== "string") return null;
  const value = iso.trim();
  const normalised = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return null;
  const parts = LONG_CHECKED_FORMATTER.formatToParts(date);
  const monthIndex = Number(partOf(parts, "month"));
  if (!Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) return null;
  return `${Number(partOf(parts, "day"))} ${MONTHS_LONG[monthIndex - 1]} ${partOf(parts, "year")}`;
}

/** Formats a euro amount as stored, through the shared money helpers: 144 becomes "€144.00". */
export function formatEuroAmount(amount: number): string {
  return formatEur(eurosToCents(amount));
}

/** Formats a whole number of reais in Brazilian Portuguese: 3160 becomes "R$ 3.160,00". */
export function formatReaisAmount(amount: number): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new RangeError(`formatReaisAmount: expected a finite number, received ${String(amount)}`);
  }
  return REAIS_FORMATTER.format(amount);
}

export interface ZonedMoment {
  /** "Sat 6 Feb 2027" */
  readonly date: string;
  /** 24-hour, always two digits: "17:00". */
  readonly time: string;
  /** The zone abbreviation the runtime reports: "CET", "GMT". */
  readonly zone: string;
}

const MOMENT_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/**
 * Month names are taken from this table rather than from the formatter's own
 * `month` part: ICU renders September as "Sept" in `en-GB`, and a page that prints
 * sale dates should not change its wording with the ICU build.
 */
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

function momentFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = MOMENT_FORMATTERS.get(timeZone);
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
    throw new RangeError(`"${timeZone}" is not a time zone this runtime knows`);
  }

  MOMENT_FORMATTERS.set(timeZone, formatter);
  return formatter;
}

function partOf(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((candidate) => candidate.type === type);
  if (part === undefined) throw new RangeError(`the formatter produced no ${type} part`);
  return part.value;
}

/**
 * Splits an instant into the date, clock time and zone it shows in a named zone.
 *
 * @throws RangeError when the instant is unparseable or the zone unknown.
 */
export function zonedMoment(instant: string, timeZone: string): ZonedMoment {
  const epoch = Date.parse(instant);
  if (!Number.isFinite(epoch)) {
    throw new RangeError(`zonedMoment: ${JSON.stringify(instant)} is not a valid instant`);
  }
  const parts = momentFormatter(timeZone).formatToParts(new Date(epoch));
  const monthIndex = Number(partOf(parts, "month"));
  if (!Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    throw new RangeError(`the formatter produced an impossible month: ${monthIndex}`);
  }
  return {
    date: `${partOf(parts, "weekday")} ${Number(partOf(parts, "day"))} ${MONTHS_SHORT[monthIndex - 1]} ${partOf(parts, "year")}`,
    time: `${partOf(parts, "hour")}:${partOf(parts, "minute")}`,
    zone: partOf(parts, "timeZoneName"),
  };
}

/** "Sat 6 Feb 2027, 17:00 CET" in the given zone. */
export function formatMomentInZone(instant: string, timeZone: string): string {
  const moment = zonedMoment(instant, timeZone);
  return `${moment.date}, ${moment.time} ${moment.zone}`;
}

/** "6 Feb 2027, 16:00 GMT": the same instant read in UK time. */
export function formatMomentInUkTime(instant: string): string {
  const moment = zonedMoment(instant, UK_TIME_ZONE);
  const [, day, month, year] = moment.date.split(" ");
  return `${day} ${month} ${year}, ${moment.time} ${moment.zone}`;
}

/**
 * Whether a sale window's opening moment falls before or after a reference date.
 *
 * The reference is always a date the record itself carries (its own check date),
 * never the clock: a prerendered page must read the same twice, and a status that
 * silently changed with the build time would be a claim nothing sources.
 */
export function statusAsAt(opensAt: string, referenceIsoDate: string): "past" | "upcoming" {
  const opening = Date.parse(opensAt);
  const reference = Date.parse(`${referenceIsoDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(opening) || !Number.isFinite(reference)) return "upcoming";
  return opening < reference ? "past" : "upcoming";
}
