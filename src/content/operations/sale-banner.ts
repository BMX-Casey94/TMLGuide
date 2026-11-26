/**
 * The site-wide sale notice.
 *
 * One record, rendered by `components/shell/sale-banner.tsx` directly under the header. It ships
 * switched off: while `enabled` is false the component returns null, so the public site has no
 * element, no landmark and no gap where the notice would be.
 *
 * ## Switching it on
 *
 * Flip `enabled` to true only after reading the official ticket page and confirming that what the
 * message claims is on it. Then move `lastVerified` to the day of that reading and, if the sale page
 * has moved, change `href` to the page that serves it. The record is not a place for a price or a
 * countdown: those live in `src/data`, where a change is covered by the guides' own checks.
 *
 * ## Where the values come from
 *
 * `href` is the Belgium festival ticket page, the same URL `src/content/belgium/tickets.ts` cites as
 * source s3, and `lastVerified` is that source's `checkedOn`. Nothing here invents a path.
 *
 * ## Why the record is checked at import time
 *
 * `href` goes straight into an anchor, so a mistyped scheme or a host outside `tomorrowland.com`
 * would turn a content edit into either a `javascript:` URL or a redirect to some other site wearing
 * the word "official". {@link parseSaleBannerRecord} refuses both, and the check runs as the module is
 * imported, so a bad edit fails the build instead of reaching a reader.
 */

/** The one record the notice renders. Nothing else reads it. */
export interface SaleBannerRecord {
  /**
   * Ships false. While false the banner renders nothing at all, which is what keeps the public site
   * unchanged until the sale is genuinely worth announcing.
   */
  readonly enabled: boolean;
  /** One sentence, shown as the notice. */
  readonly message: string;
  /** An https URL on an official Tomorrowland host. */
  readonly href: string;
  /** Visible link text. It must name the official site, because that is the trust cue. */
  readonly linkLabel: string;
  /**
   * `YYYY-MM-DD`, the day the message and the destination were last read for this notice.
   *
   * Not rendered: the notice is one sentence and a link, and a second date line would compete with it.
   * It is recorded so that the next editor can see how stale the wording is before switching it on,
   * and so the test suite can hold it to a real calendar date.
   */
  readonly lastVerified: string;
}

/**
 * The only hosts a `href` may use: `tomorrowland.com` and its subdomains (`belgium.`, `winter.`,
 * `faq.` and so on). A suffix test, not a substring test, so `tomorrowland.com.example.net` fails.
 */
const OFFICIAL_HOST = "tomorrowland.com";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function invalid(field: string, expectation: string): never {
  throw new Error(`Sale banner ${field}: ${expectation}.`);
}

/**
 * Reads a required string and holds it to a length band. The upper bound is a guard, not a style
 * rule: a notice longer than this is a paragraph, and a paragraph belongs on a page.
 */
function boundedString(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") invalid(field, "must be a string");
  const trimmed = value.trim();
  if (trimmed.length < min) invalid(field, `must be at least ${min} characters`);
  if (trimmed.length > max) invalid(field, `must be at most ${max} characters`);
  // A control character (a newline pasted in, for instance) would break the single-line layout.
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) invalid(field, "must not contain control characters");
  return trimmed;
}

/** A calendar date, not just something shaped like one: 2026-02-30 is refused. */
function isoCalendarDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    invalid(field, "must be an ISO date such as 2026-11-18");
  }
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    invalid(field, "must be a real calendar date");
  }
  return value;
}

/** An https URL with no credentials, on the official Tomorrowland domain. */
function officialHttpsUrl(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > 2048) {
    invalid(field, "must be an https URL of at most 2048 characters");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid(field, "must be an absolute URL");
  }
  if (url.protocol !== "https:") invalid(field, "must use https");
  if (url.username !== "" || url.password !== "") invalid(field, "must not carry credentials");
  if (url.host !== OFFICIAL_HOST && !url.host.endsWith(`.${OFFICIAL_HOST}`)) {
    invalid(field, `must be on ${OFFICIAL_HOST} or one of its subdomains`);
  }
  return url.toString();
}

/**
 * Validates a notice record and returns it with every string trimmed.
 *
 * Throws with the field named, so the failure says which value to fix. It is deliberately a plain
 * function rather than a schema library: this module is imported by the shell, so whatever it pulls
 * in is shipped as JavaScript to every page.
 *
 * An unknown key is refused for the same reason the guide schema refuses one: a renamed or misspelt
 * field would otherwise sit in the file doing nothing, and the next editor would not know which of the
 * two spellings is live.
 */
export function parseSaleBannerRecord(value: unknown): SaleBannerRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Sale banner: the record must be an object.");
  }
  const source = value as Record<string, unknown>;

  const KNOWN_KEYS = ["enabled", "message", "href", "linkLabel", "lastVerified"] as const;
  for (const key of Object.keys(source)) {
    if (!(KNOWN_KEYS as readonly string[]).includes(key)) {
      invalid(key, `is not a field of the record; use one of ${KNOWN_KEYS.join(", ")}`);
    }
  }

  const enabled = source.enabled;
  if (typeof enabled !== "boolean") invalid("enabled", "must be true or false");

  return {
    enabled,
    message: boundedString(source.message, "message", 10, 200),
    href: officialHttpsUrl(source.href, "href"),
    linkLabel: boundedString(source.linkLabel, "linkLabel", 3, 60),
    lastVerified: isoCalendarDate(source.lastVerified, "lastVerified"),
  };
}

/**
 * The notice as it ships: off.
 *
 * The message is a neutral template, unused while `enabled` is false. It names the edition whose
 * ticket page the link opens, and no year, price or deadline, because none of those has been verified
 * for this notice.
 */
export const SALE_BANNER: SaleBannerRecord = parseSaleBannerRecord({
  enabled: false,
  message: "Worldwide ticket sales for Tomorrowland Belgium are open on the official site.",
  href: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/",
  linkLabel: "Open the official ticket page",
  lastVerified: "2026-11-18",
});
