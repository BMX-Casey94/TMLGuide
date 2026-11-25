/**
 * Trusted client IP resolution and the hashed identity derived from it.
 *
 * Rate limiting is only as good as the key it counts against, so two separate
 * questions are answered here, and they are deliberately kept apart:
 *
 * 1. **Which address is real?** A client can send any `x-forwarded-for` it likes.
 *    The rule is to trust the header the hosting platform writes, and only fall
 *    back to `x-forwarded-for` when no platform header exists.
 * 2. **What may be stored?** An IP address is personal data under UK GDPR. The
 *    rate-limit key is therefore a salted SHA-256 digest, never the address.
 *    Comparing two digests still tells the limiter whether two requests came
 *    from the same client, which is all it needs.
 */

import { canonicaliseIpAddress, clientIpNetwork, parseIpv6 } from "./ip-address";

/**
 * Headers written by the hosting platform, in order of trust.
 *
 * 1. `x-vercel-forwarded-for` — set by the Vercel edge, which overwrites any
 *    inbound value.
 * 2. `cf-connecting-ip` — set by Cloudflare, and overwritten by it too.
 * 3. `x-real-ip` — set by nginx and several load balancers.
 *
 * The first header present wins and the search stops. That is the point: a
 * client-supplied `x-forwarded-for` must never override a header the platform
 * wrote, or one caller could rotate their apparent address at will and never be
 * limited.
 */
export const TRUSTED_SINGLE_VALUE_HEADERS: readonly string[] = [
  "x-vercel-forwarded-for",
  "cf-connecting-ip",
  "x-real-ip",
];

/** The chained header, used only when no platform header is present. */
export const FORWARDED_FOR_HEADER = "x-forwarded-for";

/** The value used when no trustworthy address can be determined. */
export const UNKNOWN_CLIENT_IP = "unknown";

/**
 * Header that *used* to carry the number of proxies in front of the app.
 *
 * It is deliberately no longer read. The value has to match the real topology,
 * so it is operator configuration, and a request header is written by whoever
 * sent the request. Reading it from there let a caller send
 * `x-trusted-proxy-count: 2` alongside a fabricated `x-forwarded-for` chain and
 * be counted under an address of their choosing — a free bypass of every rate
 * limit on the site, since rotating that address resets the count. The count now
 * comes from `TRUSTED_PROXY_COUNT` only.
 *
 * The constant is exported so the test suite can prove the header is ignored.
 */
export const IGNORED_PROXY_COUNT_HEADER = "x-trusted-proxy-count";

const IPV4_PATTERN = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/**
 * Validates one address token.
 *
 * Delegates to the shared parser in `@/lib/security/ip-address` so this module and
 * the SSRF deny-list cannot disagree about what an address is. The consequence
 * that matters here is canonicalisation: `2001:DB8::1` and
 * `2001:0db8:0000:0000:0000:0000:0000:0001` are one client, and a limiter that
 * treats them as two can be evaded by re-spelling.
 */
export function isPlausibleIp(value: string): boolean {
  if (value === "") return false;
  if (IPV4_PATTERN.test(value)) return true;
  return parseIpv6(value) !== null;
}

/**
 * Strips the decorations a proxy may add to an address, and canonicalises it.
 *
 * Values arrive as `1.2.3.4`, `1.2.3.4:5678`, `[2001:db8::1]:443` or
 * `[2001:db8::1]`. Only the address is kept: a port is not part of an identity,
 * and retaining it would let one client appear as many.
 */
export function normaliseIp(raw: string): string | null {
  let value = raw.trim();
  if (value === "") return null;

  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close === -1) return null;
    return canonicaliseIpAddress(value.slice(1, close));
  }

  if (IPV4_PATTERN.test(value)) return value;

  // `1.2.3.4:5678` — a port is stripped only from a dotted quad. A bare IPv6
  // address contains colons of its own and must not be split on them.
  const lastColon = value.lastIndexOf(":");
  if (lastColon !== -1 && value.indexOf(":") === lastColon) {
    const host = value.slice(0, lastColon);
    const port = value.slice(lastColon + 1);
    if (IPV4_PATTERN.test(host) && /^\d{1,5}$/.test(port)) return host;
  }

  return canonicaliseIpAddress(value);
}

/**
 * Picks an address from a comma-separated chain.
 *
 * `proxyCount` counts the proxies the operator trusts. With a count of one there
 * is a single trusted hop, so the address it appended is the last entry. The
 * index is clamped, so a count larger than the chain still yields a usable entry
 * rather than `undefined`.
 */
export function pickFromChain(value: string, proxyCount: number): string | null {
  const parts = value
    .split(",")
    .map((part) => normaliseIp(part))
    .filter((ip): ip is string => ip !== null);
  if (parts.length === 0) return null;

  const trusted = Math.max(1, Math.min(proxyCount, parts.length));
  return parts[parts.length - trusted] ?? parts[0] ?? null;
}

/**
 * Reads the configured trusted proxy count, defaulting to one.
 *
 * Only the environment is consulted. A header must never decide this, because a
 * header is attacker-controlled: see {@link IGNORED_PROXY_COUNT_HEADER}.
 */
function configuredProxyCount(): number {
  const fromEnv = Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv >= 1 && fromEnv <= 10) return fromEnv;
  return 1;
}

/**
 * Returns the address a request should be rate limited against.
 *
 * The result is always a non-empty string: `UNKNOWN_CLIENT_IP` when no header
 * yields a usable address. Callers must treat that as one shared bucket rather
 * than skipping the limit, so a request that withholds every header cannot
 * escape throttling by doing so.
 */
export function getTrustedClientIp(headers: { get(name: string): string | null }): string {
  const proxyCount = configuredProxyCount();

  for (const name of TRUSTED_SINGLE_VALUE_HEADERS) {
    const value = headers.get(name);
    if (value === null || value.trim() === "") continue;

    // The platform writes exactly one address for these, usually. Reading it as
    // a chain keeps working on a platform that appends instead of overwriting.
    const ip = pickFromChain(value, proxyCount);
    if (ip !== null) return ip;
  }

  const forwarded = headers.get(FORWARDED_FOR_HEADER);
  if (forwarded !== null && forwarded.trim() !== "") {
    const ip = pickFromChain(forwarded, proxyCount);
    if (ip !== null) return ip;
  }

  return UNKNOWN_CLIENT_IP;
}

const HASH_PREFIX = "ip:";

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Base64url-encodes bytes without `Buffer` or `btoa`.
 *
 * Neither is guaranteed in every runtime the proxy can be deployed to, and the
 * encoding is three lines of arithmetic. Padding is omitted, which base64url
 * permits and which keeps the digest short enough for a tidy Redis key.
 */
function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const triple = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += BASE64URL_ALPHABET[(triple >> 18) & 63];
    out += BASE64URL_ALPHABET[(triple >> 12) & 63];
    if (b1 !== undefined) out += BASE64URL_ALPHABET[(triple >> 6) & 63];
    if (b2 !== undefined) out += BASE64URL_ALPHABET[triple & 63];
  }
  return out;
}

/**
 * Hashes a client identity for storage in a rate-limit key.
 *
 * SHA-256 with a secret salt makes the digest unusable as an address even if a
 * Redis dump leaks: without the salt an attacker cannot confirm a guess, and
 * with a per-deployment salt they cannot reuse a table built elsewhere.
 *
 * The salt comes from `RATE_LIMIT_IP_SALT`. When it is absent the digest is still
 * hashed, but with an empty salt, which is a weaker guarantee; the module
 * reports that through `isIpHashSaltConfigured` so the route can log it once. A
 * missing salt is not made fatal: it must not take the contact form down, and a
 * hashed address is still better than a stored one.
 *
 * `UNKNOWN_CLIENT_IP` hashes to the same digest for every such request, which is
 * intended: they share one bucket.
 *
 * ## Why the identity is a network, not an address
 *
 * The value hashed is `clientIpNetwork(ip)`, so an IPv4 address is hashed as
 * itself and an IPv6 address as its `/64`. Without that, a residential IPv6
 * customer — delegated a whole `/64` and free to rotate inside it — could present
 * a new address on every request and never share a bucket. Grouping to `/64` is
 * the smallest unit that cannot be gamed that way without changing ISP, and it is
 * still narrow enough that two households do not collide in practice.
 *
 * The digest is over the network rather than the address, which does not weaken
 * the data-minimisation position: a `/64` is no more identifying than the address
 * inside it, and the salt is what makes the digest unlinkable.
 */
export async function hashClientIp(
  ip: string,
  salt: string = process.env.RATE_LIMIT_IP_SALT ?? "",
): Promise<string> {
  // An address that will not parse is hashed as it arrived. Callers only ever
  // pass a value `getTrustedClientIp` produced, so this is the sentinel and not a
  // raw header; hashing it unchanged keeps the sentinel's one shared bucket.
  const identity = clientIpNetwork(ip) ?? ip;
  const encoder = new TextEncoder();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(`${salt}:${identity}`));
  return `${HASH_PREFIX}${toBase64Url(new Uint8Array(digest))}`;
}

/**
 * The part of the environment this module reads.
 *
 * A narrow structural type with an index signature, so the real `process.env`
 * satisfies it without a cast. Next declares `NODE_ENV` as required on
 * `ProcessEnv` and drops the index signature, which is why a bare
 * `{ readonly RATE_LIMIT_IP_SALT?: string }` would not accept `process.env`.
 */
export interface ClientIpEnv {
  readonly RATE_LIMIT_IP_SALT?: string | undefined;
  readonly [key: string]: string | undefined;
}

/** True when a usable salt is configured, so callers can warn once when it is not. */
export function isIpHashSaltConfigured(env: ClientIpEnv = process.env): boolean {
  const salt = env.RATE_LIMIT_IP_SALT;
  return typeof salt === "string" && salt.length >= 16;
}
