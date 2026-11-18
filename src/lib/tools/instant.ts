/**
 * Strict parsing and formatting of ISO 8601 instants for the planning tools.
 *
 * The site's data layer supplies timestamps as ISO strings. `Date.parse` on its
 * own is too forgiving for that job: it accepts strings without an offset (and
 * silently reads them as local time), rolls impossible dates such as 30
 * February forward into March, and is implementation-defined for anything
 * outside the spec. Sale times are the one place where a silent misreading costs
 * a reader a ticket, so every timestamp here must carry an explicit offset and
 * must name a calendar day that exists.
 *
 * This module is internal to the tools package and is not re-exported from the
 * package index; callers reach its behaviour through the documented functions in
 * `sale-timeline` and `ics`.
 */

/**
 * Accepts a `T` or a space between the date and time, both common in ISO 8601
 * output. The space is only unambiguous because an offset is mandatory, so it
 * can never mean "local time".
 */
const INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?([Zz]|[+-]\d{2}:?\d{2})$/;

const MILLIS_PER_MINUTE = 60_000;

function daysInMonth(year: number, month: number): number {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function offsetMinutes(offset: string): number {
  if (offset === "Z" || offset === "z") return 0;

  const sign = offset[0] === "-" ? -1 : 1;
  const digits = offset.slice(1).replace(":", "");
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));
  if (hours > 23 || minutes > 59) {
    throw new RangeError(`offset ${offset} is outside the valid range`);
  }
  return sign * (hours * 60 + minutes);
}

/**
 * Parses an ISO 8601 instant that carries an explicit offset or `Z`.
 *
 * @returns Milliseconds since the Unix epoch.
 * @throws RangeError when the value is not a string, has no offset, names an
 * impossible date or time, or falls outside the years 1000 to 9999.
 */
export function parseInstant(value: string, label = "instant"): number {
  if (typeof value !== "string") {
    throw new RangeError(`${label} must be an ISO 8601 string`);
  }

  const match = INSTANT_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(
      `${label} must be an ISO 8601 instant with an offset or Z, received ${JSON.stringify(value)}`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const millisecond = match[7] === undefined ? 0 : Number(match[7].padEnd(3, "0").slice(0, 3));

  if (year < 1000) {
    throw new RangeError(`${label} must be between the years 1000 and 9999, received ${String(year)}`);
  }
  if (month < 1 || month > 12) {
    throw new RangeError(`${label} has an impossible month: ${match[2]}`);
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`${label} has an impossible day for ${match[1]}-${match[2]}: ${match[3]}`);
  }
  if (hour > 23 || minute > 59 || second > 59) {
    throw new RangeError(`${label} has an impossible time: ${value}`);
  }

  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const epoch = wallClock - offsetMinutes(match[8]) * MILLIS_PER_MINUTE;

  if (!Number.isFinite(epoch)) {
    throw new RangeError(`${label} is outside the representable date range: ${value}`);
  }
  return epoch;
}

/** Formats an instant for display in the given IANA time zone and locale. */
export function formatInstantInZone(epochMs: number, timeZone: string, locale: string): string {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone,
      timeZoneName: "short",
    });
  } catch {
    throw new RangeError(`"${timeZone}" is not a supported time zone for locale "${locale}"`);
  }

  // Assembled from parts rather than from a pattern so the shape stays stable
  // across ICU versions and locales: "Sat 30 Jan 2027, 16:00 GMT".
  const parts = formatter.formatToParts(new Date(epochMs));
  const pick = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((candidate) => candidate.type === type);
    if (!part) throw new RangeError(`the time zone "${timeZone}" did not produce a ${type} part`);
    return part.value;
  };

  const date = `${pick("weekday")} ${pick("day")} ${pick("month")} ${pick("year")}`;
  return `${date}, ${pick("hour")}:${pick("minute")} ${pick("timeZoneName")}`;
}

/** Reads the calendar day an instant falls on in a specific time zone. */
export function zonedDayParts(
  epochMs: number,
  timeZone: string,
): { year: string; month: string; day: string } {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone,
    });
  } catch {
    throw new RangeError(`"${timeZone}" is not a supported time zone`);
  }

  const parts = formatter.formatToParts(new Date(epochMs));
  const pick = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((candidate) => candidate.type === type);
    if (!part) throw new RangeError(`the time zone "${timeZone}" did not produce a ${type} part`);
    return part.value;
  };
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

/** Formats milliseconds since the epoch as an RFC 5545 UTC date-time. */
export function formatUtcStamp(epochMs: number): string {
  const date = new Date(epochMs);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}
