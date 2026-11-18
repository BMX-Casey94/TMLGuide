/**
 * Money and date formatting for search snippets.
 *
 * Prices in `src/data` are numbers plus the currency their edition publishes:
 * euros for Belgium and Winter, whole reais for Brasil. Nothing here converts
 * between the two, because no official exchange rate is published for them.
 *
 * The formatters are pinned to a locale rather than left to the visitor's, so a
 * snippet reads the same on the server and in the browser and a search result
 * never disagrees with the page it links to.
 */

const euroFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
});

const realFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** "€144.00" for a euro amount stored in the data file. */
export function formatEuro(amount: number): string {
  if (!Number.isFinite(amount)) throw new RangeError(`formatEuro: ${String(amount)} is not a number`);
  return euroFormatter.format(amount);
}

/** "R$ 3.160,00" for a whole-reais amount stored in the data file. */
export function formatReal(amount: number): string {
  if (!Number.isFinite(amount)) throw new RangeError(`formatReal: ${String(amount)} is not a number`);
  return realFormatter.format(amount);
}

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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export interface InstantText {
  /** "Saturday 30 January 2027" */
  date: string;
  /** "17:00 CET" */
  time: string;
}

/**
 * Renders an ISO instant in a named zone, using `Intl` parts rather than a
 * pattern so the zone abbreviation is whatever the runtime reports for that
 * date (CET in January, CEST in July).
 */
export function formatInstant(instant: string, timeZone: string): InstantText {
  const epoch = Date.parse(instant);
  if (!Number.isFinite(epoch)) {
    throw new RangeError(`formatInstant: ${JSON.stringify(instant)} is not a valid instant`);
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
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
  const parts = formatter.formatToParts(new Date(epoch));
  const pick = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((candidate) => candidate.type === type);
    if (part === undefined) {
      throw new RangeError(`formatInstant: "${timeZone}" produced no ${type} part`);
    }
    return part.value;
  };

  const day = Number(pick("day"));
  const month = Number(pick("month"));
  const year = pick("year");
  const weekdayIndex = WEEKDAYS.findIndex((name) => name.startsWith(pick("weekday")));
  const weekday = weekdayIndex === -1 ? "" : `${WEEKDAYS[weekdayIndex]} `;

  return {
    date: `${weekday}${day} ${MONTHS_LONG[month - 1]} ${year}`.trim(),
    time: `${pick("hour")}:${pick("minute")} ${pick("timeZoneName")}`,
  };
}

/** "Saturday 30 January 2027, 17:00 CET". */
export function formatInstantLong(instant: string, timeZone: string): string {
  const { date, time } = formatInstant(instant, timeZone);
  return `${date}, ${time}`;
}

/**
 * Renders an ISO date (no time) as "Friday 16 July 2027". Reads the calendar
 * fields straight from the string, so a date near midnight cannot shift by a
 * day when the visitor's clock is behind UTC.
 */
export function formatIsoDate(iso: string): string {
  const { year, month, day, weekday } = parseIsoDate(iso);
  return `${weekday} ${day} ${MONTHS_LONG[month - 1]} ${year}`;
}

interface ParsedDate {
  year: number;
  month: number;
  day: number;
  weekday: string;
}

/**
 * Splits and verifies an ISO date, refusing anything that is not a real day.
 *
 * `Date.UTC(2027, 1, 30)` rolls forward into 2 March rather than objecting, so
 * the parsed fields are compared back to the input. That is the only reliable
 * leap-year check: a day range alone would accept 30 February.
 */
function parseIsoDate(iso: string): ParsedDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) throw new RangeError(`formatDate: ${JSON.stringify(iso)} is not a date`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 ||
    month > 12 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`formatDate: ${JSON.stringify(iso)} names no real date`);
  }

  return { year, month, day, weekday: WEEKDAYS[date.getUTCDay()] };
}

/**
 * "16–18 July 2027", collapsing the month and year where they agree.
 *
 * Both ends go through {@link parseIsoDate}, so a malformed range throws rather
 * than rendering "NaN undefined" beside a real date.
 */
export function formatDateRange(startsOn: string, endsOn: string): string {
  const from = parseIsoDate(startsOn);
  const to = parseIsoDate(endsOn);

  if (from.year !== to.year) {
    return `${from.day} ${MONTHS_LONG[from.month - 1]} ${from.year} – ${to.day} ${MONTHS_LONG[to.month - 1]} ${to.year}`;
  }
  if (from.month !== to.month) {
    return `${from.day} ${MONTHS_LONG[from.month - 1]} – ${to.day} ${MONTHS_LONG[to.month - 1]} ${to.year}`;
  }
  return `${from.day}–${to.day} ${MONTHS_LONG[to.month - 1]} ${to.year}`;
}

/** "18 Nov 2026", the house style for a checked-on date. */
export function formatCheckedDate(iso: string): string {
  const short = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const { year, month, day } = parseIsoDate(iso);
  return `${day} ${short[month - 1]} ${year}`;
}
