/**
 * Origin checking for state-changing requests.
 *
 * A CSRF defence in depth. No authorisation here rests on a cookie, but a
 * mutating endpoint that accepts a cross-origin `POST` is still a way to spend
 * someone else's rate limit, fill a table with junk, or use the server as an
 * open relay. Checking `Origin` and then `Referer` closes that door.
 *
 * The check is fail-closed by design: an empty allow-list allows nothing, and a
 * mutating request carrying neither header is rejected.
 */

/** Methods that must be same-origin. `GET` and `HEAD` are read-only and exempt. */
export const MUTATING_METHODS: readonly string[] = ["POST", "PUT", "PATCH", "DELETE"];

/** The shape this module needs, so tests can pass a plain object. */
export interface OriginRequest {
  readonly method: string;
  readonly headers: { get(name: string): string | null };
}

/**
 * Reduces an absolute URL to its origin, or null when it is not one.
 *
 * `URL` is used rather than string splitting so ports, IPv6 literals and
 * internationalised hosts are handled exactly as the browser handles them.
 */
export function normaliseOrigin(value: string): string | null {
  const trimmed = value.trim();
  // A `null` origin is what a sandboxed frame or a `data:` document sends. It is
  // a real value and it never matches a configured site.
  if (trimmed === "" || trimmed === "null") return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // Only web origins make sense here. A `file:` or `chrome-extension:` origin
  // never equals a configured site, so treating it as unmatched is correct.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  return url.origin.toLowerCase();
}

/** True when the request method can change server state. */
export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.includes(method.toUpperCase());
}

/** Builds the comparison set, normalised and lower-cased. */
function allowedSet(allowedOrigins: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const candidate of allowedOrigins) {
    const normalised = normaliseOrigin(candidate);
    if (normalised !== null) set.add(normalised);
  }
  return set;
}

/**
 * Returns true when a mutating request demonstrably came from an allowed origin.
 *
 * - Read-only methods always pass; they cannot be used for CSRF.
 * - A present `Origin` header is decisive. A foreign origin rejects the request
 *   even when `Referer` looks fine, because `Origin` is the header the browser
 *   sets and a referrer policy can strip `Referer` while `Origin` still arrives.
 * - With no `Origin`, `Referer` is used. Browsers send one or the other on a
 *   cross-origin post, so requiring both to be absent before rejecting would let
 *   a stripped-header request through.
 * - With neither header the request is rejected. A legitimate form post or
 *   `fetch` from the site always carries at least one.
 */
export function isAllowedOrigin(
  request: OriginRequest,
  allowedOrigins: readonly string[],
): boolean {
  if (!isMutatingMethod(request.method)) return true;

  const allowed = allowedSet(allowedOrigins);
  if (allowed.size === 0) return false;

  const originHeader = request.headers.get("origin");
  if (originHeader !== null && originHeader.trim() !== "") {
    const origin = normaliseOrigin(originHeader);
    return origin !== null && allowed.has(origin);
  }

  const refererHeader = request.headers.get("referer");
  if (refererHeader !== null && refererHeader.trim() !== "") {
    const referer = normaliseOrigin(refererHeader);
    return referer !== null && allowed.has(referer);
  }

  return false;
}
