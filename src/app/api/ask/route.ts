/**
 * POST /api/ask — "Ask the guide".
 *
 * Every guard is cheaper than the one after it, and none of them trusts the
 * browser. The order:
 *
 * 1. Method and `Content-Type`. A cross-site form post cannot set a JSON content
 *    type, so rejecting the type closes the cheapest CSRF route before any body
 *    work.
 * 2. Declared size, then the measured body. `Content-Length` is a cheap rejection;
 *    the second measurement holds when a chunked request omits it.
 * 3. Origin. `isAllowedOrigin` rejects cross-origin mutations, and an endpoint
 *    that spends money on a stranger's behalf needs it more than the contact form.
 * 4. Rate limit, keyed on a salted hash of the trusted client IP.
 * 5. Zod validation, strict, with the question length-capped.
 * 6. Turnstile, when the deployment has configured it.
 * 7. The pipeline, which refuses before it spends.
 *
 * Nothing in a response repeats an internal detail. A caller learns what is wrong
 * with their request and nothing about the stack, the model or the ledger.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { askGuide, oldestDate, type Citation } from "@/lib/ai/answer";
import { providerFromEnv, readProviderConfig } from "@/lib/ai/provider";
import { MAX_QUESTION_CHARS, MIN_QUESTION_CHARS } from "@/lib/ai/prompt";
import {
  describeSpendLedger,
  getSpendLedger,
  warnIfLedgerIsNotShared,
} from "@/lib/ai/spend-cap";
import { isTurnstileConfigured, verifyTurnstile } from "@/lib/ai/turnstile";
import { readBoundedBody } from "@/lib/http/json";
import { getAllowedOrigins } from "@/lib/security/allowed-origins";
import { getTrustedClientIp, hashClientIp, isIpHashSaltConfigured } from "@/lib/security/client-ip";
import { isAllowedOrigin } from "@/lib/security/origin";
import { getRateLimiter, RateLimiterUnavailableError, warnIfLimiterIsNotShared } from "@/lib/security/rate-limit";

/** A question is short. 4 kB covers 500 characters in any script plus the JSON. */
export const MAX_BODY_BYTES = 4 * 1024;

/** Ten questions per fifteen minutes per hashed IP, per the feature brief. */
export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const RATE_LIMIT_BUCKET = "ask";

/**
 * The accepted request body.
 *
 * `strictObject` so an unexpected key is a `422` rather than being ignored: a
 * client sending `systemPrompt` should be told it is not part of the contract,
 * not silently have it dropped while it retries with a variation.
 */
export const askRequestSchema = z.strictObject({
  question: z
    .string({ error: "question is required" })
    .trim()
    .min(MIN_QUESTION_CHARS, { error: "question must be at least 3 characters" })
    .max(MAX_QUESTION_CHARS, { error: `question must be ${MAX_QUESTION_CHARS} characters or fewer` })
    .refine((value) => /[\p{L}\p{N}]/u.test(value), {
      error: "question must contain at least one letter or digit",
    }),
  edition: z.enum(["belgium", "winter", "brasil", "all"], {
    error: 'edition must be "belgium", "winter", "brasil" or "all"',
  }).optional(),
  turnstileToken: z
    .string({ error: "turnstileToken must be text" })
    .max(2048, { error: "turnstileToken is too long" })
    .optional(),
});

export type AskRequest = z.infer<typeof askRequestSchema>;

/** The response shape, so the client and the tests agree on one contract. */
export interface AskResponseBody {
  readonly answer: string;
  readonly citations: ReadonlyArray<{
    readonly index: number;
    readonly sourceUrl: string;
    readonly sourceTitle: string;
    readonly lastVerified: string;
    readonly live: boolean;
  }>;
  readonly lastVerified: string | null;
  readonly refusal: { readonly reason: string; readonly message: string } | null;
  readonly model: string;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      // An answer is specific to one question and one moment. A proxy that stored
      // one would serve it to everyone who asked something similar.
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

/** True when the declared Content-Type is JSON, ignoring parameters. */
export function isJsonContentType(value: string | null): boolean {
  if (value === null) return false;
  const mediaType = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json";
}

let warnedAboutSalt = false;

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Method and content type.
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonResponse({ error: "Content-Type must be application/json" }, 415);
  }

  // 2. Declared size.
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

  // 3. Origin.
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
  warnIfLedgerIsNotShared();

  // 4. Rate limit, before the body is parsed so an abusive client cannot spend
  // CPU on JSON decoding.
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
    const detail = error instanceof RateLimiterUnavailableError ? "limiter unavailable" : "limiter error";
    console.error(`[ask] Rate limiter failed (${detail})`);
    // Fail closed: accepting requests would remove the limit exactly when the
    // limiter is degraded.
    return jsonResponse(
      { error: "Question service is temporarily unavailable. Please try again shortly." },
      503,
      { "Retry-After": "30" },
    );
  }

  if (!limit.allowed) {
    return jsonResponse(
      { error: "Too many questions asked. Please try again later." },
      429,
      {
        "Retry-After": String(limit.retryAfterSec),
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
        "X-RateLimit-Remaining": "0",
      },
    );
  }

  // 5. Read, then measure the real body. Reading stops at the cap, so a chunked
  // request with no Content-Length cannot buffer an unbounded body first.
  const read = await readBoundedBody(request, MAX_BODY_BYTES);
  if (!read.ok) {
    if (read.reason === "too-large") {
      return jsonResponse({ error: "Request body is too large" }, 413);
    }
    return jsonResponse({ error: "Could not read the request body" }, 400);
  }
  const raw = read.text;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return jsonResponse({ error: "Request body must be a JSON object" }, 400);
  }

  const parsed = askRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "question";
      if (fields[key] === undefined) fields[key] = issue.message;
    }
    return jsonResponse({ error: "Please check the question and try again.", fields }, 422);
  }

  // 6. Turnstile, when configured. Skipped cleanly when it is not.
  if (isTurnstileConfigured()) {
    const outcome = await verifyTurnstile({
      token: parsed.data.turnstileToken,
      remoteIp: clientIp,
    });
    if (!outcome.ok) {
      console.warn(`[ask] Turnstile rejected a request (${outcome.code})`);
      return jsonResponse(
        {
          error:
            outcome.code === "unavailable"
              ? "The verification service is not available. Please try again shortly."
              : "Please complete the verification check and try again.",
        },
        outcome.code === "unavailable" ? 503 : 403,
      );
    }
  }

  // 7. The pipeline.
  const provider = providerFromEnv();
  const config = readProviderConfig();

  if (!config.ok) {
    // Honest, and specific enough to fix without leaking configuration values.
    console.warn(`[ask] Provider is not configured: ${config.reason}`);
    return jsonResponse(
      {
        answer: "",
        citations: [],
        lastVerified: null,
        refusal: {
          reason: "unconfigured",
          message:
            "The AI answer service is not configured on this deployment. The guide's verified pages are all still here, with sources and check dates.",
        },
        model: config.model,
      } satisfies AskResponseBody,
      503,
    );
  }

  const requestId = crypto.randomUUID();

  let result;
  try {
    result = await askGuide(
      {
        question: parsed.data.question,
        ...(parsed.data.edition === undefined ? {} : { edition: parsed.data.edition }),
        requestId,
        signal: request.signal,
      },
      { provider, ledger: getSpendLedger() },
    );
  } catch {
    // A throw here is a bug, not a runtime state. It is logged without the
    // question text, because a transcript is exactly what this endpoint promises
    // not to keep.
    console.error("[ask] Pipeline threw unexpectedly", { requestId });
    return jsonResponse(
      {
        answer: "",
        citations: [],
        lastVerified: null,
        refusal: {
          reason: "provider-unavailable",
          message:
            "The answer service ran into a problem. The guide's own pages are unaffected, and every fact is on them with its source.",
        },
        model: provider.model,
      } satisfies AskResponseBody,
      502,
    );
  }

  // Operational log: shape, cost and outcome. Never the question, the passages or
  // the answer.
  const ledger = describeSpendLedger();
  console.info(
    JSON.stringify({
      event: "ask",
      requestId,
      provider: result.provider,
      model: result.model,
      outcome: result.refusal === null ? "answered" : `refused:${result.refusal.reason}`,
      costPence: result.costPence,
      citationCount: result.citations.length,
      ledger: ledger.backend,
    }),
  );

  const body: AskResponseBody = {
    answer: result.answer,
    citations: result.citations.map((citation: Citation) => ({
      index: citation.index,
      sourceUrl: citation.sourceUrl,
      sourceTitle: citation.sourceTitle,
      lastVerified: citation.lastVerified,
      live: citation.live,
    })),
    lastVerified: result.lastVerified ?? oldestDate(result.citations.map((citation) => citation.lastVerified)),
    refusal: result.refusal,
    model: result.model,
  };

  // A refusal is a successful answer to an unanswerable question, so it is a
  // `200`: a `4xx` would make a client treat correct behaviour as an error.
  return jsonResponse(body as unknown as Record<string, unknown>, 200);
}

/** Everything but `POST` is a `405`. */
export function GET(): NextResponse {
  return jsonResponse({ error: "Method not allowed" }, 405, { Allow: "POST" });
}

/** Reported by `/api/ask`'s own health check in tests; not a route handler. */
export function describeAskLimits(): {
  rateLimitMax: number;
  rateLimitWindowMs: number;
  maxBodyBytes: number;
  turnstile: boolean;
} {
  return {
    rateLimitMax: RATE_LIMIT_MAX,
    rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
    maxBodyBytes: MAX_BODY_BYTES,
    turnstile: isTurnstileConfigured(),
  };
}
