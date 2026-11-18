/**
 * Date and money formatting for the home and About pages.
 *
 * Two rules drive everything here. Date-only strings are parsed as UTC
 * midnight and formatted in UTC, so a reader in Auckland and a reader in
 * Los Angeles see the same calendar day. Nothing is derived from a duration:
 * an end date is read from the data, never calculated from a start date and a
 * number of nights.
 */

const longDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" });
const longMonth = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const yearFormatter = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "UTC" });

const EN_DASH = "–";

const groupThousands = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days in a month, leap years included. Day 0 of the next month is this one's last. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

interface DateParts {
  readonly year: string;
  readonly monthLong: string;
  readonly monthShort: string;
  readonly day: string;
}

/**
 * Parses a `YYYY-MM-DD` string as UTC midnight and splits it into display parts.
 *
 * The pattern is checked before construction because `new Date` accepts an
 * impossible day and quietly rolls it forward: "2027-02-30" becomes 2 March.
 * A site that prints festival dates cannot do that, so the month length is
 * checked against the year before the date is built.
 *
 * @throws RangeError when the value is not a real calendar date.
 */
function partsOf(iso: string): DateParts {
  const match = ISO_DATE.exec(iso);
  if (match === null) {
    throw new RangeError(`"${iso}" is not a calendar date in YYYY-MM-DD form`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`"${iso}" is not a real calendar date`);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    year: yearFormatter.format(date),
    monthLong: longMonth.format(date),
    monthShort: shortMonth.format(date),
    day: longDay.format(date),
  };
}

export interface DateRangeOptions {
  /** `long` spells the month out; `short` abbreviates it. */
  readonly month?: "long" | "short";
}

/**
 * Formats a start and end date as one range, repeating only the parts that
 * differ: "16–18 July 2027", "30 April – 2 May 2027", or "18 July 2027" for a
 * single day.
 *
 * @throws RangeError when either value is not a calendar date.
 */
export function formatDateRange(
  startsOn: string,
  endsOn: string,
  { month = "long" }: DateRangeOptions = {},
): string {
  const start = partsOf(startsOn);
  const end = partsOf(endsOn);
  const monthOf = (parts: DateParts) => (month === "long" ? parts.monthLong : parts.monthShort);

  if (startsOn === endsOn) {
    return `${start.day} ${monthOf(start)} ${start.year}`;
  }
  if (start.year === end.year && start.monthLong === end.monthLong) {
    return `${start.day}${EN_DASH}${end.day} ${monthOf(start)} ${start.year}`;
  }
  if (start.year === end.year) {
    return `${start.day} ${monthOf(start)} ${EN_DASH} ${end.day} ${monthOf(end)} ${start.year}`;
  }
  return `${start.day} ${monthOf(start)} ${start.year} ${EN_DASH} ${end.day} ${monthOf(end)} ${end.year}`;
}

/**
 * Formats a date as "18 November 2026", the shape the site uses for a check
 * date. Takes the calendar date only, so a timestamp's time of day cannot shift
 * the day.
 *
 * @throws RangeError when the value is not a calendar date.
 */
export function formatLongDate(iso: string): string {
  const parts = partsOf(iso.slice(0, 10));
  return `${parts.day} ${parts.monthLong} ${parts.year}`;
}

/**
 * Formats a euro amount: no decimals for a whole euro, two when the price
 * genuinely has cents. Prices on the site are whole euros today; the cents
 * branch exists so a later price is not rounded away.
 */
export function formatEuroFrom(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  const text = hasCents
    ? new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        amount,
      )
    : groupThousands.format(amount);
  return `€${text}`;
}

/**
 * Formats a whole number of Brazilian reais the way the official pages write
 * it, with a thousands separator and no centavos: R$3,160.
 */
export function formatReaisFrom(amount: number): string {
  return `R$${groupThousands.format(amount)}`;
}
