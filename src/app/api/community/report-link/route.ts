/**
 * POST /api/community/report-link
 *
 * A visitor reports a dead or wrong link. The route writes one row and answers
 * honestly about what happened to it:
 *
 * | Status | Meaning |
 * | --- | --- |
 * | `202` | The report was recorded, or the honeypot caught a bot (same answer to both) |
 * | `403` | Cross-origin or forged-origin request |
 * | `413` | The body is larger than the form can produce |
 * | `415` | Not JSON |
 * | `429` | Rate limited, with `Retry-After` |
 * | `503` | Supabase (or the limiter) is not available. Nothing was stored. |
 *
 * ## The `503` is the point
 *
 * A guide that silently drops a correction is worse than one that never offered
 * the form: the visitor believes someone will look, and nobody does. So an
 * unconfigured backend is answered with `503` and a sentence that says the report
 * was not saved, and the form on the page shows the same thing.
 *
 * ## What is stored
 *
 * The URL as reported, the kind, optional details, the page it was reported from,
 * the server's timestamp, and a **salted digest** of the reporter's address. The
 * address itself is not stored: the digest is enough to spot a flood from one
 * source and not enough to identify a person.
 */

import { getAllowedOrigins } from "@/lib/security/allowed-origins";
import { getTrustedClientIp, hashClientIp, isIpHashSaltConfigured } from "@/lib/security/client-ip";
import { isAllowedOrigin } from "@/lib/security/origin";
import {
  getRateLimiter,
  RateLimiterUnavailableError,
  warnIfLimiterIsNotShared,
} from "@/lib/security/rate-limit";
import { isJsonContentType, jsonResponse, methodNotAllowed, readBoundedBody } from "@/lib/http/json";
import {
  fieldErrors,
  isHoneypotTripped,
  linkReportSchema,
  type LinkReportRecord,
} from "@/lib/community/link-report-schema";
import { readSupabaseServerConfig } from "@/lib/supabase/config";

/** The table reports are written to. */
export const LINK_REPORTS_TABLE = "community_link_reports";

/**
 * Maximum accepted body, in bytes.
 *
 * Two kilobytes of details, a 2 kB URL and JSON escaping sit comfortably under
 * this; 16 kB leaves room for a report written in a non-Latin script and is still
 * far below anything that would make parsing expensive.
 */
export const MAX_BODY_BYTES = 16 * 1024;

/** Reports permitted per client per window. */
export const RATE_LIMIT_MAX = 5;

/** One hour: a person finds one or two dead links, a script finds thousands. */
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const RATE_LIMIT_BUCKET = "community-report-link";

/** Fixed text for an unconfigured backend. It never claims the report was saved. */
const NOT_CONFIGURED_MESSAGE =
  "Link reports are not being saved at the moment. Nothing has been recorded — please try again later.";

/** Warned once per process, for a missing hash salt. */
let warnedAboutSalt = false;

/**
 * Whether this request may be answered.
 *
 * Exported so the ordering is testable: a test can prove that the origin check
 * runs before the limiter, because otherwise a cross-origin flood would spend the
 * allowance of whoever shares the attacker's apparent address.
 */
export async function POST(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonResponse({ error: "Content-Type must be application/json" }, 415);
  }

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0) {
      return jsonResponse({ error: "Invalid Content-Length header" }, 400);
    }
    if (length > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Request body is too large" }, 413);
    }
  }

  if (!isAllowedOrigin(request, getAllowedOrigins())) {
    return jsonResponse({ error: "Cross-origin request rejected" }, 403);
  }

  if (!isIpHashSaltConfigured() && !warnedAboutSalt) {
    warnedAboutSalt = true;
    console.warn(
      "[security] RATE_LIMIT_IP_SALT is unset or shorter than 16 characters, so " +
        "rate-limit keys are hashed without a secret salt. Set it to a long " +
        "random value to make the stored digests unlinkable.",
    );
  }
  warnIfLimiterIsNotShared();

  const clientIp = getTrustedClientIp(request.headers);
  const identity = await hashClientIp(clientIp);

  let outcome;
  try {
    outcome = await getRateLimiter().check({
      name: RATE_LIMIT_BUCKET,
      identifier: identity,
      limit: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
  } catch (error) {
    if (!(error instanceof RateLimiterUnavailableError)) {
      console.error("[community/report-link] Rate limiter threw an unexpected error", error);
    }
    return jsonResponse(
      { error: "Link reports are temporarily unavailable. Please try again shortly." },
      503,
      { "Retry-After": "30" },
    );
  }

  if (!outcome.allowed) {
    return jsonResponse({ error: "Too many reports sent. Please try again later." }, 429, {
      "Retry-After": String(outcome.retryAfterSec),
      "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
      "X-RateLimit-Remaining": "0",
    });
  }

  const body = await readBoundedBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    if (body.reason === "too-large") {
      return jsonResponse({ error: "Request body is too large" }, 413);
    }
    return jsonResponse({ error: "Request body could not be read" }, 400);
  }
  const raw = body.text;
  if (raw.trim() === "") {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return jsonResponse({ error: "Request body must be a JSON object" }, 400);
  }

  /*
    Checked against the raw payload, before validation. A bot that fills it gets
    the same `202` a person gets, so it cannot tell it was detected and adapt. It
    still spent one of its allowance.
  */
  if (isHoneypotTripped(payload)) {
    return jsonResponse({ status: "accepted" }, 202);
  }

  const parsed = linkReportSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(
      { error: "Please check the highlighted fields", fields: fieldErrors(parsed.error) },
      422,
    );
  }

  const config = readSupabaseServerConfig();
  if (config === null) {
    return jsonResponse({ error: NOT_CONFIGURED_MESSAGE }, 503);
  }

  const record: LinkReportRecord = {
    url: parsed.data.url,
    kind: parsed.data.kind,
    details: parsed.data.details === undefined || parsed.data.details === "" ? null : parsed.data.details,
    page: parsed.data.page ?? null,
    // Set here, not from the body: a client clock is not evidence.
    reported_at: new Date().toISOString(),
    reporter_ip_hash: identity,
  };

  try {
    const response = await fetch(`${config.url}/rest/v1/${LINK_REPORTS_TABLE}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        // Ask for nothing back: the row's contents are not needed to answer, and
        // returning them would put reporter data into a response that may be logged.
        Prefer: "return=minimal",
      },
      body: JSON.stringify(record),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error(`[community/report-link] Supabase insert failed with HTTP ${response.status}`);
      return jsonResponse(
        { error: "The report could not be saved. Please try again later." },
        502,
      );
    }
  } catch (error) {
    console.error("[community/report-link] Supabase insert threw", error);
    return jsonResponse({ error: "The report could not be saved. Please try again later." }, 502);
  }

  return jsonResponse({ status: "accepted" }, 202);
}

/** Everything but `POST` is a `405`. Next calls this for other methods. */
export function GET(): Response {
  return methodNotAllowed("POST");
}
