/**
 * POST /api/community/news/[id]/like
 *
 * Records one "this was useful" against a news item and returns the new count.
 *
 * ## What identifies a like
 *
 * Nothing about the person. There is no cookie, no session, and no readable
 * identifier of any kind. The only key is a salted SHA-256 digest of the trusted
 * client IP, and even that is used for exactly one thing: the rate limit.
 *
 * That means likes are **not deduplicated per person**. A visitor who reloads and
 * taps again is counted again, up to the rate limit. The alternative — a cookie
 * or a stored address — would either put a tracking identifier on the reader or
 * hold personal data to police a vanity counter, and both are a worse trade for a
 * guide with no accounts. The page says what the number means, and the counter is
 * a signal rather than a vote.
 *
 * ## The increment
 *
 * It goes through a Supabase RPC (`increment_news_like`) so the read and the write
 * are one statement. Doing `select` then `update` from here would lose concurrent
 * likes, and a counter that silently undercounts is a bug nobody notices.
 */

import { getTrustedClientIp, hashClientIp, isIpHashSaltConfigured } from "@/lib/security/client-ip";
import { getAllowedOrigins } from "@/lib/security/allowed-origins";
import { isAllowedOrigin } from "@/lib/security/origin";
import {
  getRateLimiter,
  RateLimiterUnavailableError,
  warnIfLimiterIsNotShared,
} from "@/lib/security/rate-limit";
import { jsonResponse, methodNotAllowed } from "@/lib/http/json";
import { slugSchema } from "@/data/schemas";
import { readSupabaseServerConfig } from "@/lib/supabase/config";
import { NEWS_TABLE } from "@/lib/community/news";

/** Likes permitted per client per window. Generous: a reader may like several items. */
export const RATE_LIMIT_MAX = 20;

/** Ten minutes. Long enough that a stuck key cannot be used as a counter, short enough to forgive. */
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const RATE_LIMIT_BUCKET = "community-news-like";

/** The database function that performs the increment atomically. */
export const LIKE_RPC = "increment_news_like";

/** Fixed text for an unconfigured backend. It never claims the like was counted. */
const NOT_CONFIGURED_MESSAGE =
  "Likes are not being recorded at the moment. Your tap was not counted.";

/** Warned once per process, for a missing hash salt. */
let warnedAboutSalt = false;

/** Reads the dynamic `[id]` segment from the context Next supplies. */
async function readId(context: { params: Promise<{ id: string }> } | undefined): Promise<string | null> {
  if (context === undefined) return null;
  try {
    const params = await context.params;
    return typeof params?.id === "string" ? params.id : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");

  /*
    The origin check comes first and is not optional. Without it any page on the
    internet could spend a visitor's allowance by embedding a form, and could move
    a counter without the reader ever seeing the item.
  */
  if (!isAllowedOrigin(request, getAllowedOrigins())) {
    return jsonResponse({ error: "Cross-origin request rejected" }, 403);
  }

  /*
    The id is validated before the limiter. A malformed id is a client mistake or
    a probe, neither of which should spend an allowance, and the check is a regex
    against a string that is already in memory.
  */
  const rawId = await readId(context);
  const parsedId = slugSchema.safeParse(rawId);
  if (!parsedId.success) {
    return jsonResponse({ error: "Unknown news item" }, 404);
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
      console.error("[community/news/like] Rate limiter threw an unexpected error", error);
    }
    return jsonResponse({ error: "Likes are temporarily unavailable. Please try again shortly." }, 503, {
      "Retry-After": "30",
    });
  }

  if (!outcome.allowed) {
    return jsonResponse({ error: "Too many likes from this connection. Try again later." }, 429, {
      "Retry-After": String(outcome.retryAfterSec),
      "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
      "X-RateLimit-Remaining": "0",
    });
  }

  const config = readSupabaseServerConfig();
  if (config === null) {
    return jsonResponse({ error: NOT_CONFIGURED_MESSAGE }, 503);
  }

  let likeCount: number | null = null;
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/${LIKE_RPC}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      /*
        The function takes the item's id and the table it lives in. Returning the
        new count from the function rather than reading it back afterwards keeps
        one round trip and removes the race between the two.
      */
      body: JSON.stringify({ item_id: parsedId.data, target_table: NEWS_TABLE }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      // A `404` from PostgREST here means no row matched, which is a caller error
      // rather than a fault: the item is gone or was never published.
      if (response.status === 404) {
        return jsonResponse({ error: "Unknown news item" }, 404);
      }
      console.error(`[community/news/like] Supabase RPC failed with HTTP ${response.status}`);
      return jsonResponse({ error: "The like could not be recorded. Please try again later." }, 502);
    }

    const payload: unknown = await response.json();
    if (typeof payload === "number" && Number.isFinite(payload) && payload >= 0) {
      likeCount = Math.trunc(payload);
    } else if (typeof payload === "object" && payload !== null) {
      // PostgREST returns a scalar as the bare value, but a function declared
      // `returns table(...)` comes back as a one-row array. Both shapes are
      // accepted so a change on the database side does not silently break this.
      const record = Array.isArray(payload) ? payload[0] : payload;
      if (typeof record === "object" && record !== null) {
        const candidate = (record as { like_count?: unknown }).like_count;
        if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) {
          likeCount = Math.trunc(candidate);
        }
      }
    }
  } catch (error) {
    console.error("[community/news/like] Supabase RPC threw", error);
    return jsonResponse({ error: "The like could not be recorded. Please try again later." }, 502);
  }

  if (likeCount === null) {
    console.error("[community/news/like] Supabase returned no usable count");
    return jsonResponse({ error: "The like could not be recorded. Please try again later." }, 502);
  }

  return jsonResponse({ status: "recorded", id: parsedId.data, likeCount }, 200);
}

/** Everything but `POST` is a `405`. */
export function GET(): Response {
  return methodNotAllowed("POST");
}
