/**
 * The report-a-broken-link request contract.
 *
 * A visitor who finds a dead invite or a 404 resource should be able to say so in
 * one field. Everything else on the form exists to make the report usable and to
 * keep a spam script out:
 *
 * - `url` is the address they found broken. It is validated as https, because an
 *   `http://`, `javascript:` or `ftp://` report is a mistake or an attempt to get
 *   something odd stored, not a link on this site.
 * - `kind` says what is wrong. A closed set rather than free text: it makes the
 *   value safe to use as a routing label and removes a field a spam script would
 *   otherwise use to carry payload.
 * - `details` is optional, because a visitor often just wants to say "this is
 *   dead" and should not be forced to write a paragraph.
 * - `website` is the honeypot. It is invisible to people and never filled in by
 *   one. It is checked against the raw payload before validation, because a bot
 *   that fills it usually sends junk elsewhere too and the honeypot is the more
 *   reliable signal.
 */

import { z } from "zod";

export const REPORT_FIELD_LIMITS = {
  url: { max: 2048 },
  details: { max: 1_000 },
  reporterHandle: { max: 120 },
} as const;

/** What the visitor says is wrong. A closed set, matched to the labels the form shows. */
export const REPORT_KINDS = ["invite", "resource", "wrong-page", "other"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABELS: Readonly<Record<ReportKind, string>> = {
  invite: "A WhatsApp invite no longer works",
  resource: "A resource link is dead",
  "wrong-page": "The link opens something different from what it claims",
  other: "Something else is wrong",
};

/**
 * An absolute https URL with no credentials.
 *
 * Shares the data layer's rules deliberately: `httpsUrlSchema` is what every
 * published link must satisfy, so a report cannot be filed against an address the
 * site would never publish. The checks are duplicated rather than imported because
 * this schema also caps the length before parsing, which keeps a two-megabyte
 * string away from the URL parser.
 *
 * Every refinement is exception-free. A `refine` that called `new URL` unguarded
 * would throw out of `safeParse` for a value an earlier check had already
 * rejected, turning a `422` into an unhandled `500`.
 */
function hasNoEmbeddedCredentials(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.username === "" && parsed.password === "";
  } catch {
    // An earlier or later check has already rejected this string; never throw
    // from a refinement.
    return false;
  }
}

const reportUrlSchema = z
  .string({ error: "The link is required" })
  .trim()
  .min(1, { error: "The link is required" })
  .max(REPORT_FIELD_LIMITS.url.max, { error: "That link is too long to be one of ours" })
  .refine((value) => !/\s/.test(value), { error: "The link must not contain spaces" })
  .pipe(z.url({ protocol: /^https$/, error: "The link must be an https:// address" }))
  .refine(hasNoEmbeddedCredentials, { error: "The link must not contain a username or password" });

export const linkReportSchema = z.strictObject({
  url: reportUrlSchema,
  kind: z.enum(REPORT_KINDS, { error: "Choose what is wrong with the link" }),
  details: z
    .string()
    .trim()
    .max(REPORT_FIELD_LIMITS.details.max, {
      error: `Keep the details to ${REPORT_FIELD_LIMITS.details.max} characters or fewer`,
    })
    .optional(),
  /**
   * Where the visitor saw it, so the report can be routed to the right page. A
   * single path, never a full URL: it is stored as text, and a full URL would let
   * a reporter attach an arbitrary string to a field the operator reads.
   */
  page: z
    .string()
    .trim()
    .max(200)
    .regex(/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/, {
      error: "The page must be a path on this site",
    })
    .optional(),
  website: z.string().max(0).optional(),
});

export type LinkReport = z.infer<typeof linkReportSchema>;

/** The row written to Supabase. The honeypot is never part of it. */
export interface LinkReportRecord {
  readonly url: string;
  readonly kind: ReportKind;
  readonly details: string | null;
  readonly page: string | null;
  readonly reported_at: string;
  /** Salted digest of the reporter's address, never the address. */
  readonly reporter_ip_hash: string;
}

/**
 * True when the honeypot was filled.
 *
 * Tolerant of any value type on purpose: a bot sending `website: 5` or `true` is
 * still a bot, and rejecting it as a validation error would tell it the field is
 * watched.
 */
export function isHoneypotTripped(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;
  const value = (payload as Record<string, unknown>).website;
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

/**
 * Flattens a Zod error into a field-to-message map, first message per field.
 *
 * One clear sentence per field is more useful than three variations of the same
 * complaint, and it keeps the response small enough to render without scrolling.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
