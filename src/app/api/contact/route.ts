/**
 * POST /api/contact
 *
 * The only endpoint that writes to the database, so every check here is
 * deliberate. The order matters: each guard is cheaper than the one after it,
 * and none of them trusts anything the browser sent.
 *
 * 1. Method. Anything but `POST` gets `405` with an `Allow` header.
 * 2. `Content-Type`. Must be JSON, so a cross-site form post cannot reach the
 *    parser and a `multipart` upload is refused before any body is read.
 * 3. Size. `Content-Length` is checked before reading, and the decoded body is
 *    measured again afterwards. The first is a cheap rejection; the second holds
 *    when a chunked request omits `Content-Length` entirely.
 * 4. Origin. `isAllowedOrigin` rejects cross-origin mutations.
 * 5. Rate limit, keyed on a salted hash of the trusted client IP.
 * 6. Parse and validate, honeypot included.
 * 7. Insert with the service role key, server-side only.
 *
 * Nothing in the responses below repeats an internal error. A caller learns what
 * is wrong with their request and nothing about the stack, the schema or the
 * database.
 */

import { NextResponse } from "next/server";
import { getAllowedOrigins } from "@/lib/security/allowed-origins";
import {
  getTrustedClientIp,
  hashClientIp,
  isIpHashSaltConfigured,
} from "@/lib/security/client-ip";
import {
  contactSubmissionSchema,
  fieldErrors,
  isHoneypotTripped,
  type ContactRecord,
} from "@/lib/security/contact-schema";
import { isAllowedOrigin } from "@/lib/security/origin";
import {
  getRateLimiter,
  RateLimiterUnavailableError,
  warnIfLimiterIsNotShared,
} from "@/lib/security/rate-limit";

/**
 * Maximum accepted body, in bytes.
 *
 * A 5,000-character message is at most 20 kB once UTF-8 and JSON escaping are
 * counted, so 16 kB would be too tight for a message written in a non-Latin
 * script. 32 kB leaves room and is still far below anything that would make JSON
 * parsing expensive.
 */
export const MAX_BODY_BYTES = 32 * 1024;

/** Requests permitted per client per window. */
export const RATE_LIMIT_MAX = 5;

/** Fifteen minutes: long enough to stop a script, short enough to forgive a mistake. */
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Bucket name, so this endpoint's counters never collide with another's. */
const RATE_LIMIT_BUCKET = "contact";

/** The Supabase table this route writes to. */
export const CONTACT_TABLE = "contact_messages";

/**
 * The JSON error used when Supabase is not configured.
 *
 * Fixed text with no configuration detail: a caller learns only that the feature
 * is off. It never claims the message was stored, because a visitor who believed
 * a correction had been delivered and got no reply would conclude the site
 * ignores corrections. `503` is the honest status: the server cannot serve this
 * request *yet*, and it is the operator's job to fix it.
 */
const NOT_CONFIGURED_MESSAGE =
  "The contact form is not accepting messages at the moment. Please try again later.";

interface SupabaseConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

/**
 * The part of the environment this route reads.
 *
 * A narrow structural type with an index signature, so the real `process.env`
 * satisfies it without a cast. Next declares `NODE_ENV` as required on
 * `ProcessEnv` and drops the index signature.
 */
export interface SupabaseEnv {
  readonly SUPABASE_URL?: string | undefined;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
  readonly [key: string]: string | undefined;
}

/**
 * Reads the server-only Supabase settings.
 *
 * Both are required. `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security, so
 * it is never imported into a client component and never returned in a response.
 *
 * `https:` is required in production. A plain-HTTP database URL would send the
 * service role key in clear text across the network, so it is refused rather
 * than honoured; in development `http:` is allowed for a local Supabase stack.
 */
export function readSupabaseConfig(env: SupabaseEnv = process.env): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal)) return null;

  return { url: url.replace(/\/+$/, ""), serviceRoleKey };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      // A submission is never a cacheable resource, and an intermediary that
      // stored a `202` would hide later attempts.
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

/** True when the declared Content-Type is JSON, ignoring parameters like charset. */
export function isJsonContentType(value: string | null): boolean {
  if (value === null) return false;
  const mediaType = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json";
}

/** Warned once per process, for a missing hash salt. */
let warnedAboutSalt = false;

export async function POST(request: Request): Promise<NextResponse> {
  // 1. The export fixes the method, but an explicit guard keeps the handler
  // correct if it is ever remounted or reached through a rewrite.
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  // 2. Content-Type before any body work.
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonResponse({ error: "Content-Type must be application/json" }, 415);
  }

  // 3. Declared size, rejected before reading.
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const declared = Number(declaredLength);
    if (!Number.isFinite(declared) || declared < 0) {
      return jsonResponse({ error: "Invalid Content-Length header" }, 400);
    }
    if (declared > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Request body is too large" }, 413);
    }
  }

  // 4. Origin, before anything expensive.
  const allowedOrigins = getAllowedOrigins();
  if (!isAllowedOrigin(request, allowedOrigins)) {
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

  // 5. Rate limit, before the body is parsed so an abusive client cannot spend
  // CPU on JSON decoding. The key is a salted digest: the address itself is
  // never stored, which is the data-minimisation position UK GDPR asks for.
  const clientIp = getTrustedClientIp(request.headers);
  const identity = await hashClientIp(clientIp);
  const limiter = getRateLimiter();

  let limit;
  try {
    limit = await limiter.check({
      name: RATE_LIMIT_BUCKET,
      identifier: identity,
      limit: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
  } catch (error) {
    if (error instanceof RateLimiterUnavailableError) {
      // Fail closed. Accepting requests would remove the limit precisely when the
      // limiter is degraded, which is when it is most needed.
      return jsonResponse(
        { error: "The contact form is temporarily unavailable. Please try again shortly." },
        503,
        { "Retry-After": "30" },
      );
    }
    console.error("[contact] Rate limiter threw an unexpected error", error);
    return jsonResponse(
      { error: "The contact form is temporarily unavailable. Please try again shortly." },
      503,
      { "Retry-After": "30" },
    );
  }

  if (!limit.allowed) {
    return jsonResponse(
      { error: "Too many messages sent. Please try again later." },
      429,
      {
        "Retry-After": String(limit.retryAfterSec),
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
        "X-RateLimit-Remaining": "0",
      },
    );
  }

  // 6. Read, then measure the real body. A chunked request carries no
  // Content-Length, so the declared check above cannot be relied on alone.
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonResponse({ error: "Could not read the request body" }, 400);
  }

  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request body is too large" }, 413);
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
    The honeypot is checked against the raw payload. A bot that filled it gets the
    same `202` a person gets, so it cannot tell it was detected and adapt. Nothing
    is written, and no rate-limit refund is offered: the request still cost the
    caller one of their allowance.
  */
  if (isHoneypotTripped(payload)) {
    return jsonResponse({ status: "accepted" }, 202);
  }

  const parsed = contactSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(
      { error: "Please check the highlighted fields", fields: fieldErrors(parsed.error) },
      422,
    );
  }

  // 7. Persist, or report honestly that the feature is off.
  const config = readSupabaseConfig();
  if (config === null) {
    return jsonResponse({ error: NOT_CONFIGURED_MESSAGE }, 503);
  }

  const { website: _honeypot, ...submission } = parsed.data;
  const record: ContactRecord = {
    ...submission,
    // Set here rather than accepted from the body: a client clock is not
    // evidence, and a forged timestamp would corrupt ordering in the inbox.
    submitted_at: new Date().toISOString(),
  };

  try {
    // PostgREST over the REST API rather than a Supabase client: it keeps the
    // service role key inside this module and adds no dependency to the bundle.
    const response = await fetch(`${config.url}/rest/v1/${CONTACT_TABLE}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        // Ask for nothing back. The row's contents are not needed to answer, and
        // returning them would put visitor data into a response that may be logged.
        Prefer: "return=minimal",
      },
      body: JSON.stringify(record),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      // The status is logged for operators. The caller gets a generic message, so
      // a column name, a constraint or a permission detail is never reflected
      // back to be used for probing.
      console.error(`[contact] Supabase insert failed with HTTP ${response.status}`);
      return jsonResponse(
        { error: "Your message could not be saved. Please try again later." },
        502,
      );
    }
  } catch (error) {
    console.error("[contact] Supabase insert threw", error);
    return jsonResponse(
      { error: "Your message could not be saved. Please try again later." },
      502,
    );
  }

  return jsonResponse({ status: "accepted" }, 202);
}

/** Everything but `POST` is a `405`. Next calls this for other methods. */
export function GET(): NextResponse {
  return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
}
