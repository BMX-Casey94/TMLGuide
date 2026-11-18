/**
 * Formatting helpers shared by the community cards.
 *
 * Dates are formatted with an explicit UTC time zone: `lastVerified` and
 * `lastLinkCheck` are calendar dates with no time, so letting the runtime pick a
 * zone would shift the day for anyone west of UTC and would also differ between
 * the server render and the browser.
 */

const CHECK_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Formats an ISO date (date-only or full timestamp) as "18 Nov 2026".
 *
 * @returns the formatted date, or null when the value is missing or unparseable
 *   so the caller can omit the line rather than print "Invalid Date".
 */
export function formatCheckDate(iso: string | undefined): string | null {
  if (iso === undefined) return null;
  const value = iso.trim();
  if (value === "") return null;

  const normalised = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return null;

  return CHECK_DATE_FORMATTER.format(date);
}

/**
 * The hostname of a URL without a leading "www.", for a compact source line
 * ("Source: chat.whatsapp.com"). Returns null rather than throwing, because this
 * only ever runs on data that has already been schema-checked.
 */
export function sourceHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "") || null;
  } catch {
    return null;
  }
}
