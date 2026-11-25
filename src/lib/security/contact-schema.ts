/**
 * The contact form's input contract.
 *
 * One schema, shared by the route handler — which must not trust anything the
 * browser sent — and its tests. Length caps live here rather than in the
 * database, so an oversized body is rejected before it reaches Supabase, and the
 * limits the form advertises are the limits that actually apply.
 */

import { z } from "zod";

export const CONTACT_FIELD_LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 254 },
  topic: { min: 1, max: 40 },
  message: { min: 10, max: 5000 },
} as const;

/**
 * The subjects the form offers.
 *
 * A closed set rather than free text: it makes the value safe to use as a
 * routing label, keeps the database column meaningful, and removes a field a
 * spam script would otherwise use to carry payload text.
 *
 * Kept in step with the labels shown in the form. A request carrying anything
 * else is a validation failure, not a guess at the nearest match.
 */
export const CONTACT_TOPICS = [
  "correction",
  "tickets",
  "travel",
  "accessibility",
  "partnership",
  "other",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** Human-readable labels, for the form and for validation messages. */
export const CONTACT_TOPIC_LABELS: Readonly<Record<ContactTopic, string>> = {
  correction: "Factual correction",
  tickets: "Tickets and sale dates",
  travel: "Travel and DreamVille",
  accessibility: "Accessibility",
  partnership: "Partnership or press",
  other: "Something else",
};

/**
 * Email validation.
 *
 * `z.email()` in Zod 4 applies a practical HTML-shaped check rather than a full
 * RFC 5321 grammar: it rejects whitespace, a missing local or domain part, and a
 * domain without a dot. That is the right level here — the address is only ever
 * used to reply, never as an identity.
 *
 * The length is checked before the format check so an attacker cannot use a
 * two-megabyte string to make the format parser do work; the route's body cap
 * limits that further.
 */
const emailSchema = z
  .string()
  .trim()
  .max(CONTACT_FIELD_LIMITS.email.max, "Email address is too long")
  .pipe(z.email("Enter a valid email address"));

export const contactSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(CONTACT_FIELD_LIMITS.name.min, "Name is too short")
    .max(CONTACT_FIELD_LIMITS.name.max, "Name is too long"),

  email: emailSchema,

  topic: z.enum(CONTACT_TOPICS, "Choose a topic"),

  message: z
    .string()
    .trim()
    .min(CONTACT_FIELD_LIMITS.message.min, "Message is too short")
    .max(CONTACT_FIELD_LIMITS.message.max, "Message is too long"),

  /**
   * Honeypot. A field hidden from people and never filled in by one.
   *
   * Declared here so the contract is complete, but it is checked against the raw
   * payload by `isHoneypotTripped` *before* validation runs. A bot that fills the
   * honeypot usually sends junk elsewhere too, and the honeypot is the more
   * reliable signal; it must not be masked by an unrelated validation failure.
   */
  website: z.string().max(0).optional(),
});

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;

/** The payload actually written to the database. `website` is never part of it. */
export type ContactRecord = Omit<ContactSubmission, "website"> & {
  /** ISO timestamp, set by the server so a client clock cannot forge it. */
  readonly submitted_at: string;
};

/**
 * True when the honeypot was filled.
 *
 * Deliberately tolerant of any value type: a bot sending `website: 5` or
 * `website: true` is still a bot, and rejecting it with a validation error would
 * tell it that the field is watched.
 */
export function isHoneypotTripped(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;
  const value = (payload as Record<string, unknown>).website;
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

/**
 * Flattens a Zod error into a field-to-message map.
 *
 * The first message per field is kept: one clear sentence is more useful than
 * three variations of the same complaint, and it keeps the response small enough
 * to render without scrolling.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
