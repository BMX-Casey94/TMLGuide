/**
 * Cloudflare Turnstile verification.
 *
 * Turnstile raises the cost of automation; it does not identify anyone, and the
 * provider spike is explicit that it will not stop a patient human. It is
 * therefore one layer, never the only gate, and it sits behind the rate limit
 * rather than in front of it: a request that is going to be refused for volume
 * should not first cost a round trip to Cloudflare.
 *
 * Configured means enforced. A deployment with `TURNSTILE_SECRET_KEY` set will
 * reject a request with no token, because the operator asked for the challenge;
 * a deployment without it skips the check cleanly, so local development and the
 * test suite work without a Cloudflare account.
 *
 * The siteverify call is server-side only. The client-side token is a claim, and
 * treating a claim as proof is the classic mistake this module exists to avoid.
 */

export const TURNSTILE_VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's own guidance: fail fast rather than hold a reader waiting. */
export const TURNSTILE_TIMEOUT_MS = 4000;

export interface TurnstileEnv {
  readonly TURNSTILE_SECRET_KEY?: string | undefined;
  readonly [key: string]: string | undefined;
}

export type TurnstileOutcome =
  /** No secret configured: the check is not part of this deployment. */
  | { readonly ok: true; readonly skipped: true }
  /** Verified by Cloudflare. */
  | { readonly ok: true; readonly skipped: false }
  /** Configured, and the request failed the check. */
  | { readonly ok: false; readonly code: "missing-token" | "invalid-token" | "unavailable"; readonly detail: string };

export interface VerifyOptions {
  readonly token: string | undefined;
  /** The trusted client IP, so Cloudflare can score the request. */
  readonly remoteIp?: string;
  readonly env?: TurnstileEnv;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

/** True when this deployment enforces the challenge. */
export function isTurnstileConfigured(env: TurnstileEnv = process.env): boolean {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  return typeof secret === "string" && secret.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Verifies a Turnstile token.
 *
 * Never throws. An unavailable Cloudflare is `unavailable`, which the route
 * treats as a refusal: letting traffic through because the bot check is down
 * would remove the protection exactly when an attacker knows it is down.
 */
export async function verifyTurnstile(options: VerifyOptions): Promise<TurnstileOutcome> {
  const env = options.env ?? process.env;
  const secret = env.TURNSTILE_SECRET_KEY?.trim() ?? "";

  if (secret === "") return { ok: true, skipped: true };

  const token = options.token?.trim() ?? "";
  if (token === "") {
    return {
      ok: false,
      code: "missing-token",
      detail: "TURNSTILE_SECRET_KEY is set but the request carried no token",
    };
  }

  // A Turnstile token is a few hundred characters. A megabyte-long "token" is an
  // attempt to make the verification endpoint do work on our behalf.
  if (token.length > 2048) {
    return { ok: false, code: "invalid-token", detail: "Turnstile token was implausibly long" };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const body = new URLSearchParams({ secret, response: token });
  if (options.remoteIp !== undefined && options.remoteIp.length > 0) {
    body.set("remoteip", options.remoteIp);
  }

  let response: Response;
  try {
    response = await fetchImpl(TURNSTILE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(options.timeoutMs ?? TURNSTILE_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: "unavailable", detail: "Turnstile verification could not be reached" };
  }

  if (!response.ok) {
    return {
      ok: false,
      code: "unavailable",
      detail: `Turnstile verification responded with HTTP ${response.status}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return { ok: false, code: "unavailable", detail: "Turnstile verification returned a non-JSON body" };
  }

  if (!isRecord(parsed) || parsed.success !== true) {
    // The error codes are logged by the route, never returned: a caller probing
    // the check learns nothing from a generic refusal.
    return { ok: false, code: "invalid-token", detail: "Turnstile reported the token as invalid" };
  }

  return { ok: true, skipped: false };
}
