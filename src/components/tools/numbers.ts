/**
 * Number formatting shared by the tool pages.
 *
 * Pinned to en-GB so a figure renders identically on the server and in the
 * browser, and grouped so a four-figure Pearl count stays readable.
 */
const wholeFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

/** Formats a whole number with thousands separators, for example "12,500". */
export function formatWholeNumber(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`value must be a safe integer, received ${String(value)}`);
  }
  return wholeFormatter.format(value);
}

/**
 * Formats a distance in seconds as "3 days, 4 hours, 12 minutes".
 *
 * Used by the countdown's screen-reader announcement, which speaks a sentence
 * once a minute rather than every second. The minutes are rounded up, so a
 * reader told "2 minutes" is never told it later than it is; units with a zero
 * count are dropped, and anything under a minute reads as "less than a minute".
 */
export function describeDuration(totalSeconds: number): string {
  const magnitude = Math.abs(totalSeconds);
  if (magnitude < 60) return "less than a minute";

  const days = Math.floor(magnitude / 86_400);
  const hours = Math.floor((magnitude % 86_400) / 3_600);
  const minutes = Math.ceil((magnitude % 3_600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  // Minutes are only worth speaking when they are not lost behind a longer unit.
  if (minutes > 0 && days === 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);

  return parts.length === 0 ? "less than a minute" : parts.join(", ");
}
