/**
 * Browser-side Supabase Auth calls for the admin console.
 *
 * ## Why this talks to GoTrue directly
 *
 * The project has no `supabase-js` dependency, and adding one for two endpoints
 * would pull a client library into a page that otherwise ships almost no
 * JavaScript. These are four `fetch` calls against the documented Auth REST API.
 *
 * ## What is held, and for how long
 *
 * The access token lives **in memory only**: no `localStorage`, no
 * `sessionStorage`, no cookie. A reload therefore signs the administrator out and
 * they must enter the code again. That is deliberate. A token in web storage is
 * readable by any script that ever runs on the origin, and the whole point of the
 * second factor is that a stolen token alone is not enough — which is only true if
 * the token is not sitting somewhere a script can lift.
 *
 * ## The two-step sign-in
 *
 * `POST /auth/v1/token?grant_type=password` returns an `aal1` session. If the
 * account has a verified TOTP factor, that session is not sufficient for the admin
 * endpoints: `requireAdminSession` on the server refuses anything below `aal2`.
 * The console therefore asks for the six-digit code and exchanges it for an
 * `aal2` session with the documented challenge/verify pair.
 *
 * Both shapes of the "MFA required" answer are handled:
 *
 * - a `200` whose `access_token` is only `aal1`, with factors listed on the user;
 * - a `4xx` carrying `error_code: "mfa_required"` and a short-lived `mfa_token`,
 *   which is then used as the bearer for the challenge instead of a session token.
 *
 * ## Never trusted for authorisation
 *
 * Nothing here decides what the console may do. The role and assurance level are
 * checked again on every API call by `src/lib/admin/auth.ts`, which verifies the
 * token against Supabase. This module only decides which screen to show.
 */

/** The public project settings Auth needs. Both are safe to expose. */
export interface AuthEnvironment {
  readonly url: string;
  readonly anonKey: string;
}

/** The fields of a GoTrue session this console uses. */
export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  /** Epoch seconds, when the provider supplied one. */
  readonly expiresAt: number | null;
  readonly userId: string;
  readonly email: string | null;
  /** `aal1` or `aal2`, read from the token that was just issued. */
  readonly aal: string | null;
}

/** One verified factor, narrowed to what the console needs to challenge it. */
export interface TotpFactor {
  readonly id: string;
}

/** What a sign-in attempt produced. */
export type SignInOutcome =
  | { readonly kind: "session"; readonly session: AuthSession; readonly factors: readonly TotpFactor[] }
  | {
      readonly kind: "mfa-required";
      /** Bearer token that may be used for the challenge: an aal1 session or a short-lived mfa token. */
      readonly challengeToken: string;
      readonly factorId: string;
      readonly session: AuthSession | null;
    }
  | { readonly kind: "invalid-credentials" }
  | { readonly kind: "rate-limited"; readonly retryAfterSec: number }
  | { readonly kind: "not-configured" }
  | { readonly kind: "unavailable" };

/** Result of exchanging a code for a second factor. */
export type VerifyOutcome =
  | { readonly kind: "session"; readonly session: AuthSession }
  | { readonly kind: "invalid-code" }
  | { readonly kind: "rate-limited"; readonly retryAfterSec: number }
  | { readonly kind: "unavailable" };

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Reads `NEXT_PUBLIC_SUPABASE_URL` and the anon key at call time, not at import. */
export function readAuthEnvironment(): AuthEnvironment | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    // A plain-HTTP project URL would send the password in clear text, so it is
    // refused rather than attempted.
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/+$/, ""), anonKey };
}

/** Decodes a JWT payload without verifying it. Screen selection only, never authorisation. */
export function decodeClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const segment = parts[1];
  if (segment === undefined || segment === "") return null;

  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Reads verified TOTP factors from a GoTrue user object. */
export function readTotpFactors(user: unknown): readonly TotpFactor[] {
  if (typeof user !== "object" || user === null) return [];
  const factors = (user as { factors?: unknown }).factors;
  if (!Array.isArray(factors)) return [];

  const found: TotpFactor[] = [];
  for (const factor of factors) {
    if (typeof factor !== "object" || factor === null) continue;
    const record = factor as { id?: unknown; factor_type?: unknown; status?: unknown };
    if (record.factor_type !== "totp" || record.status !== "verified") continue;
    if (typeof record.id === "string" && record.id !== "") found.push({ id: record.id });
  }
  return found;
}

/** Narrows a GoTrue session payload. Returns null when the shape is not one this console understands. */
export function parseSession(payload: unknown): AuthSession | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;

  const accessToken = record.access_token;
  if (typeof accessToken !== "string" || accessToken === "") return null;

  const user = record.user;
  if (typeof user !== "object" || user === null) return null;
  const userRecord = user as Record<string, unknown>;

  const userId = userRecord.id;
  if (typeof userId !== "string" || userId === "") return null;

  const claims = decodeClaims(accessToken);
  const aal = claims !== null && typeof claims.aal === "string" ? claims.aal : null;

  return {
    accessToken,
    refreshToken: typeof record.refresh_token === "string" ? record.refresh_token : null,
    expiresAt: typeof record.expires_at === "number" ? record.expires_at : null,
    userId,
    email: typeof userRecord.email === "string" ? userRecord.email : null,
    aal,
  };
}

/** Reads `Retry-After`, falling back to a sensible wait. */
function retryAfter(response: Response): number {
  const header = response.headers.get("retry-after");
  const parsed = header === null ? Number.NaN : Number.parseInt(header, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

/** The `error_code` a GoTrue error body may carry, or null. */
function errorCode(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const code = record.error_code ?? record.code;
  return typeof code === "string" ? code : null;
}

function readMfaToken(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const token = (payload as Record<string, unknown>).mfa_token;
  return typeof token === "string" && token !== "" ? token : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Signs in with an email address and password.
 *
 * Returns `mfa-required` when the account has a verified factor, carrying the
 * token that the challenge call needs. Never throws: every failure becomes an
 * outcome the console can show.
 */
export async function signInWithPassword(
  env: AuthEnvironment | null,
  credentials: { readonly email: string; readonly password: string },
  fetchImpl: FetchLike = (input, init) => globalThis.fetch(input, init),
): Promise<SignInOutcome> {
  if (env === null) return { kind: "not-configured" };

  let response: Response;
  try {
    response = await fetchImpl(`${env.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: env.anonKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      cache: "no-store",
    });
  } catch {
    return { kind: "unavailable" };
  }

  const payload = await readJson(response);

  if (response.status === 429) {
    return { kind: "rate-limited", retryAfterSec: retryAfter(response) };
  }
  if (response.status >= 500) return { kind: "unavailable" };

  if (!response.ok) {
    // The `mfa_required` shape: no session, only a short-lived token and the
    // factor to challenge.
    if (errorCode(payload) === "mfa_required") {
      const mfaToken = readMfaToken(payload);
      const user = (payload as { user?: unknown } | null)?.user;
      const factors = readTotpFactors(user);
      const factor = factors[0];
      if (mfaToken !== null && factor !== undefined) {
        return { kind: "mfa-required", challengeToken: mfaToken, factorId: factor.id, session: null };
      }
    }
    return { kind: "invalid-credentials" };
  }

  const session = parseSession(payload);
  if (session === null) return { kind: "unavailable" };

  const user = (payload as { user?: unknown }).user;
  const factors = readTotpFactors(user);

  // A session that is already `aal2` needs nothing more. A session at `aal1` with
  // a verified factor must be upgraded before the admin endpoints will accept it.
  if (session.aal !== "aal2" && factors.length > 0) {
    const factor = factors[0];
    if (factor !== undefined) {
      return {
        kind: "mfa-required",
        challengeToken: session.accessToken,
        factorId: factor.id,
        session,
      };
    }
  }

  return { kind: "session", session, factors };
}

/**
 * Creates a challenge and immediately verifies it with the code the user typed.
 *
 * The challenge call exists to mint a `challenge_id` the code is bound to, so a
 * code cannot be replayed against a different challenge. Two round trips, both
 * short, and the second one produces the `aal2` session.
 */
export async function verifyTotpCode(
  env: AuthEnvironment | null,
  input: { readonly challengeToken: string; readonly factorId: string; readonly code: string },
  fetchImpl: FetchLike = (input: string, init: RequestInit) => globalThis.fetch(input, init),
): Promise<VerifyOutcome> {
  if (env === null) return { kind: "unavailable" };

  const authHeaders = {
    apikey: env.anonKey,
    Authorization: `Bearer ${input.challengeToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let challengeResponse: Response;
  try {
    challengeResponse = await fetchImpl(
      `${env.url}/auth/v1/factors/${encodeURIComponent(input.factorId)}/challenge`,
      { method: "POST", headers: authHeaders, body: "{}", cache: "no-store" },
    );
  } catch {
    return { kind: "unavailable" };
  }

  if (challengeResponse.status === 429) {
    return { kind: "rate-limited", retryAfterSec: retryAfter(challengeResponse) };
  }
  if (!challengeResponse.ok) return { kind: "unavailable" };

  const challengePayload = await readJson(challengeResponse);
  const challengeId =
    typeof challengePayload === "object" && challengePayload !== null
      ? (challengePayload as { id?: unknown }).id
      : undefined;
  if (typeof challengeId !== "string" || challengeId === "") return { kind: "unavailable" };

  let verifyResponse: Response;
  try {
    verifyResponse = await fetchImpl(
      `${env.url}/auth/v1/factors/${encodeURIComponent(input.factorId)}/verify`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ challenge_id: challengeId, code: input.code }),
        cache: "no-store",
      },
    );
  } catch {
    return { kind: "unavailable" };
  }

  if (verifyResponse.status === 429) {
    return { kind: "rate-limited", retryAfterSec: retryAfter(verifyResponse) };
  }
  if (!verifyResponse.ok) {
    // A wrong or expired code is a 403 or a 422 from GoTrue. Both mean the same
    // thing to the person typing: try the current code.
    if (verifyResponse.status === 403 || verifyResponse.status === 422 || verifyResponse.status === 400) {
      return { kind: "invalid-code" };
    }
    return { kind: "unavailable" };
  }

  const session = parseSession(await readJson(verifyResponse));
  if (session === null) return { kind: "unavailable" };
  return { kind: "session", session };
}

/** True when the session's own expiry has passed. */
export function isSessionExpired(session: AuthSession, nowSeconds: number = Date.now() / 1000): boolean {
  if (session.expiresAt === null) return false;
  // Thirty seconds of slack, so a request is not sent with a token that expires
  // while it is in flight.
  return session.expiresAt - 30 <= nowSeconds;
}
