/**
 * Server-side verification of an admin session.
 *
 * There are three things this module refuses to do, and each one is a mistake
 * that has shipped in real applications:
 *
 * 1. **It never trusts a decoded token on its own.** Base64 is not a signature.
 *    Anyone can write `{"app_metadata":{"role":"admin"}}` into a string that
 *    decodes cleanly. So every token is presented to Supabase Auth
 *    (`GET /auth/v1/user`), and only a `200` from that call establishes that the
 *    token is real and unexpired. Supabase performs the signature check.
 * 2. **It never reads `user_metadata`.** That object is writable by the account
 *    holder through `updateUser`, so a role kept there is a role the user can
 *    grant themselves. Only `app_metadata` — written with the service role key,
 *    from the dashboard or an admin endpoint — is consulted.
 * 3. **It never treats "signed in" as "authorised".** A valid token is the
 *    starting point. The role and the second factor are checked after it, and
 *    every failure fails closed.
 *
 * ## Why the `aal` claim is read only after the token is verified
 *
 * Multi-factor state lives in the token's `aal` claim: `aal1` means one factor,
 * `aal2` means the second factor was completed *for this session*. The claim is
 * read from the same string Supabase just accepted, so its contents are
 * authenticated by that acceptance: a forged claim would mean a forged token,
 * which `/auth/v1/user` has already rejected. Reading it before verification, or
 * from a token that was never checked, would be the vulnerability this ordering
 * exists to prevent.
 *
 * Enrolment is checked separately from session state. `aal2` is only reachable
 * once a verified factor exists, but when Supabase reports a factor list with no
 * verified TOTP factor in it, that is a configuration fault and the session is
 * refused rather than trusted.
 */

import { readSupabasePublicConfig, type SupabaseEnv } from "@/lib/supabase/config";

/** The only `app_metadata.role` value that grants access. */
export const ADMIN_ROLE = "admin";

/** The assurance level a session must reach. */
export const REQUIRED_AAL = "aal2";

/** The TOTP factor type. A verified one must exist for MFA to be real. */
export const MFA_FACTOR_TYPE = "totp";

/** Timeout for the Auth call. A hung identity provider must not hold a request open. */
const AUTH_TIMEOUT_MS = 8_000;

/**
 * Longest bearer token accepted, in characters.
 *
 * A JWT for this project is well under 2 kB. The cap exists because the token is
 * forwarded verbatim in a header to the identity provider: an 8 MB "token" would
 * be a cheap way to make the server build and send a huge request, and the
 * identity provider would reject it after the cost had been paid. A value beyond
 * the cap is refused before any network call, as a malformed credential rather
 * than an unavailable service.
 */
export const MAX_TOKEN_LENGTH = 4096;

/** Why a session was refused. Reported so an operator can act on it. */
export type AdminAuthFailureReason =
  | "missing-token"
  | "invalid-token"
  | "not-admin"
  | "mfa-required"
  | "mfa-not-enrolled"
  | "not-configured"
  | "auth-unavailable";

/** A verified administrator. */
export interface AdminIdentity {
  readonly userId: string;
  /** Null when the account has no email, which should not happen with password auth. */
  readonly email: string | null;
  readonly role: typeof ADMIN_ROLE;
  readonly aal: typeof REQUIRED_AAL;
  /** The bearer token, for a downstream call that needs to act as this user. */
  readonly accessToken: string;
}

/** A refused request, with the status the route should answer. */
export interface AdminAuthFailure {
  readonly ok: false;
  readonly reason: AdminAuthFailureReason;
  readonly status: 401 | 403 | 503;
  /** A fixed sentence safe to return. Never includes a token, a claim or a URL. */
  readonly error: string;
}

export interface AdminAuthSuccess {
  readonly ok: true;
  readonly identity: AdminIdentity;
}

export type AdminSessionResult = AdminAuthSuccess | AdminAuthFailure;

/**
 * Sentences for each refusal.
 *
 * Written for an administrator reading their own console: each says what is
 * missing and what to do about it, without naming a claim, a header or an
 * internal service.
 */
const FAILURE_TEXT: Readonly<Record<AdminAuthFailureReason, { status: 401 | 403 | 503; error: string }>> = {
  "missing-token": {
    status: 401,
    error: "Sign in to use the admin console.",
  },
  "invalid-token": {
    status: 401,
    error: "That session is not valid. Sign in again.",
  },
  "not-admin": {
    status: 403,
    error: "This account does not have administrator access.",
  },
  "mfa-required": {
    status: 403,
    error:
      "Two-factor authentication is required for administrator access. Complete the code step and try again.",
  },
  "mfa-not-enrolled": {
    status: 403,
    error: "This administrator account has no authenticator app enrolled. Enrol one before signing in.",
  },
  "not-configured": {
    status: 503,
    error: "Administrator sign-in is not configured on this deployment.",
  },
  "auth-unavailable": {
    status: 503,
    error: "The sign-in service is unavailable. Try again shortly.",
  },
};

/** Builds a typed failure. */
export function adminAuthFailure(reason: AdminAuthFailureReason): AdminAuthFailure {
  const { status, error } = FAILURE_TEXT[reason];
  return { ok: false, reason, status, error };
}

/**
 * Extracts a bearer token, or null when the header is absent or malformed.
 *
 * Scheme matching is case-insensitive because RFC 7235 says it is, and a token
 * with internal whitespace is refused rather than trimmed into something else.
 */
export function readBearerToken(headers: { get(name: string): string | null }): string | null {
  const header = headers.get("authorization");
  if (header === null) return null;

  const match = /^Bearer[ \t]+(\S+)$/i.exec(header.trim());
  if (match === null) return null;
  const token = match[1];
  return token === undefined || token === "" ? null : token;
}

/**
 * Decodes a JWT payload without verifying it.
 *
 * **This is not a security check.** It is used only on a token Supabase has
 * already accepted, to read the `aal` claim that the user endpoint does not
 * return. Never call it on a token that has not been verified first.
 *
 * Returns null for anything that is not a three-part JWT with a JSON object
 * payload: an opaque token, a truncated string, or a payload that is an array.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const segment = parts[1];
  if (segment === undefined || segment === "") return null;

  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** One factor as Supabase reports it. Only the fields this module reads. */
interface SupabaseFactor {
  readonly factor_type?: unknown;
  readonly status?: unknown;
}

/** The user record from `GET /auth/v1/user`, narrowed to what is used here. */
interface SupabaseUser {
  readonly id?: unknown;
  readonly email?: unknown;
  readonly app_metadata?: unknown;
  readonly factors?: unknown;
}

/** True when the user holds the admin role in `app_metadata`. */
function hasAdminRole(user: SupabaseUser): boolean {
  const metadata = user.app_metadata;
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>).role === ADMIN_ROLE;
}

/**
 * Whether a verified TOTP factor exists.
 *
 * - `undefined` or `null` means Supabase did not include a factor list. The
 *   `aal2` claim remains the deciding evidence, so this does not fail the session
 *   on its own.
 * - An array with no verified TOTP factor fails closed: the account is claiming a
 *   second factor it has not enrolled.
 * - A value that is neither means the response is not one this module
 *   understands, which also fails closed.
 */
export function hasVerifiedTotpFactor(factors: unknown): boolean {
  if (factors === undefined || factors === null) return true;
  if (!Array.isArray(factors)) return false;
  return factors.some((factor: unknown) => {
    if (typeof factor !== "object" || factor === null) return false;
    const record = factor as SupabaseFactor;
    return record.factor_type === MFA_FACTOR_TYPE && record.status === "verified";
  });
}

/** The subset of `fetch` this module needs, so a test can supply a double. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface RequireAdminOptions {
  /** Fetch injection, for tests. */
  readonly fetchImpl?: FetchLike;
  /** Environment injection, for tests. */
  readonly env?: SupabaseEnv;
}

/**
 * Verifies the request's bearer token and returns the administrator behind it,
 * or a typed refusal.
 *
 * Never throws. A network fault, a malformed response or a missing configuration
 * all become a refusal, because a route that let an exception escape here would
 * answer `500` and tell a caller their request got further than it did.
 */
export async function requireAdminSession(
  request: {
    readonly headers: { get(name: string): string | null };
  },
  options: RequireAdminOptions = {},
): Promise<AdminSessionResult> {
  const token = readBearerToken(request.headers);
  if (token === null) return adminAuthFailure("missing-token");
  // Refused before the identity provider is contacted, so an oversized header
  // cannot make the server build and send a huge request.
  if (token.length > MAX_TOKEN_LENGTH) return adminAuthFailure("invalid-token");

  const config = readSupabasePublicConfig(options.env);
  if (config === null) return adminAuthFailure("not-configured");

  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));

  let response: Response;
  try {
    response = await fetchImpl(`${config.url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      /*
        Redirects are never followed. The bearer token is in an `Authorization`
        header, and a `fetch` that follows a `302` re-sends headers to whatever
        `Location` names. The URL here is built from `NEXT_PUBLIC_SUPABASE_URL`
        and cannot be redirected by a caller, but a misconfigured or compromised
        project URL should not be able to hand the token to a third host.
      */
      redirect: "error",
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[admin/auth] The Supabase Auth lookup failed", error);
    return adminAuthFailure("auth-unavailable");
  }

  // 401 and 403 from the identity provider both mean "this token is not usable
  // for a session": expired, revoked, or belonging to another project.
  if (response.status === 401 || response.status === 403) {
    return adminAuthFailure("invalid-token");
  }
  if (!response.ok) {
    console.error(`[admin/auth] Supabase Auth answered HTTP ${response.status}`);
    return adminAuthFailure("auth-unavailable");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error("[admin/auth] Supabase Auth returned a body that is not JSON");
    return adminAuthFailure("auth-unavailable");
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    console.error("[admin/auth] Supabase Auth returned an unexpected response shape");
    return adminAuthFailure("auth-unavailable");
  }

  const user = payload as SupabaseUser;
  if (typeof user.id !== "string" || user.id === "") {
    console.error("[admin/auth] Supabase Auth returned a user with no id");
    return adminAuthFailure("auth-unavailable");
  }

  // The role is read from the server-written object only. `user_metadata` is
  // deliberately not consulted anywhere in this module.
  if (!hasAdminRole(user)) return adminAuthFailure("not-admin");

  const claims = decodeJwtPayload(token);
  if (claims === null) {
    // An opaque token carries no assurance level, so it cannot prove a second
    // factor was completed. Refusing is the fail-closed reading.
    return adminAuthFailure("mfa-required");
  }

  // A token minted for a different user must never be paired with this user
  // record, so a mismatched subject is refused rather than trusted.
  if (typeof claims.sub === "string" && claims.sub !== user.id) {
    return adminAuthFailure("invalid-token");
  }

  if (claims.aal !== REQUIRED_AAL) return adminAuthFailure("mfa-required");

  if (!hasVerifiedTotpFactor(user.factors)) return adminAuthFailure("mfa-not-enrolled");

  return {
    ok: true,
    identity: {
      userId: user.id,
      email: typeof user.email === "string" && user.email !== "" ? user.email : null,
      role: ADMIN_ROLE,
      aal: REQUIRED_AAL,
      accessToken: token,
    },
  };
}

/**
 * Turns a refusal into the response a route returns.
 *
 * Kept beside the check so the status and the sentence cannot drift apart, and so
 * a route never has to invent its own wording for a refusal.
 */
export function adminAuthFailureResponse(result: AdminAuthFailure): Response {
  return Response.json(
    { error: result.error, reason: result.reason },
    {
      status: result.status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        // A caller that is not signed in should never be told to cache anything.
        ...(result.status === 401 ? { "WWW-Authenticate": 'Bearer realm="admin"' } : {}),
      },
    },
  );
}
