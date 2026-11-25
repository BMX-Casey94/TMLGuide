/**
 * Allowed origins for state-changing requests.
 *
 * Derived from configuration rather than compared against the request's own
 * `Host` header. Comparing `Origin` with `Host` is a common shortcut and is
 * unsafe: behind a proxy that forwards `Host` unchanged, both values are
 * attacker-influenced, so a forged pair agrees with itself and the check passes.
 *
 * Three sources are consulted, in order of authority:
 *
 * 1. `NEXT_PUBLIC_SITE_URL` — the canonical origin already used for metadata and
 *    canonical URLs, so there is one place to change it.
 * 2. `VERCEL_URL` — the deployment's own hostname. Present automatically on
 *    Vercel, which lets a preview deployment accept its own origin without the
 *    operator having to set another variable per branch.
 * 3. `localhost` and `127.0.0.1` on the development ports, and only when not in
 *    production. Allowing loopback in production would widen the accepted set
 *    for no benefit.
 */

/**
 * The loopback origin used when no site URL is configured.
 *
 * Defined here rather than imported from the UI layer: a security module should
 * not depend on a component module, and the value is a constant.
 */
export const LOCALHOST_ORIGIN = "http://localhost:3000";

/** Development ports that are actually used by this project. */
const DEV_ORIGINS: readonly string[] = [
  LOCALHOST_ORIGIN,
  "http://127.0.0.1:3000",
  "http://localhost:3100",
  "http://127.0.0.1:3100",
];

export interface OriginEnv {
  readonly NEXT_PUBLIC_SITE_URL?: string;
  readonly VERCEL_URL?: string;
  readonly NODE_ENV?: string;
}

/** Reduces a configured value to an origin, tolerating a bare hostname. */
function toOrigin(value: string, scheme: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  try {
    // A bare host, as `VERCEL_URL` supplies, needs a scheme before `URL` will
    // parse it.
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `${scheme}://${trimmed}`;
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Returns the origins a mutating request may come from.
 *
 * A malformed value is skipped rather than thrown on: a typo in a deployment
 * variable must not take the contact form down, and an empty result fails closed
 * at the call site (`isAllowedOrigin` rejects everything).
 */
export function getAllowedOrigins(env: OriginEnv = process.env as OriginEnv): string[] {
  const origins = new Set<string>();
  const isProduction = env.NODE_ENV === "production";

  const configured = env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    const origin = toOrigin(configured, "https");
    if (origin !== null) origins.add(origin);
  }

  /*
    On Vercel, `VERCEL_URL` is the deployment hostname with no scheme, and the
    platform terminates TLS, so `https` is the right scheme. It is added only when
    the canonical URL did not already supply an origin, so a preview deployment
    cannot quietly accept a second origin in production.
  */
  const vercel = env.VERCEL_URL;
  if (vercel && origins.size === 0) {
    const origin = toOrigin(vercel, "https");
    if (origin !== null) origins.add(origin);
  }

  if (!isProduction) {
    for (const origin of DEV_ORIGINS) origins.add(origin);
    // A site URL on a custom development port (the e2e suite uses 3100) is
    // already covered by the DEV_ORIGINS list above.
    if (origins.size === 0) origins.add(LOCALHOST_ORIGIN);
  }

  return [...origins];
}
