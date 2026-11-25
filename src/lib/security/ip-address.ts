/**
 * IP literal parsing, canonicalisation and range classification.
 *
 * One implementation, because two copies of this logic is how they end up
 * disagreeing. The live fetcher asks "may this address be reached at all?" and
 * the rate limiter asks "is this the same client as last time?", and both
 * questions need the same parser: two spellings of one address must not pass one
 * check and fail the other.
 *
 * ## Why parse rather than pattern-match
 *
 * Every historical SSRF bypass in this class of code comes from matching on text.
 * `::ffff:127.0.0.1`, `::ffff:7f00:1` and `[0:0:0:0:0:ffff:7f00:1]` are the same
 * address; a `startsWith("fc")` test sees three unrelated strings. Hex and octal
 * IPv4 (`0x7f000001`, `0177.0.0.1`, `2130706433`) are the same problem in the
 * other family, and the WHATWG URL parser already canonicalises those to
 * `127.0.0.1` before anything here sees them — which is why this module only has
 * to handle the dotted-quad and IPv6 forms a resolver can actually return.
 *
 * ## Fail closed
 *
 * An address that does not parse is treated as blocked by
 * {@link isBlockedIpAddress}. Callers that need the distinction (a log line, a
 * sentence for an operator) can use {@link parseIpAddress} and see `null`.
 */

/**
 * IPv4 ranges that must never be reached, as CIDR blocks.
 *
 * Every IANA special-purpose block that is not ordinary global unicast, plus the
 * three documentation ranges. CGNAT (`100.64.0.0/10`) is the one that is most
 * often forgotten and most often in use: it is where a cloud load balancer puts
 * its internal endpoints.
 */
export const BLOCKED_IPV4_CIDRS: readonly string[] = [
  "0.0.0.0/8", // "this network"
  "10.0.0.0/8", // private
  "100.64.0.0/10", // carrier-grade NAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local, including the cloud metadata address
  "172.16.0.0/12", // private
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // documentation (TEST-NET-1)
  "192.88.99.0/24", // deprecated 6to4 relay anycast
  "192.168.0.0/16", // private
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // documentation (TEST-NET-2)
  "203.0.113.0/24", // documentation (TEST-NET-3)
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved, including broadcast
];

interface Cidr {
  readonly base: number;
  readonly mask: number;
}

/** Parses `a.b.c.d/prefix`. Internal, and only ever called on the list above. */
function parseCidr(cidr: string): Cidr | null {
  const [address, prefixText] = cidr.split("/");
  if (address === undefined || prefixText === undefined) return null;
  const octets = parseIpv4(address);
  if (octets === null) return null;
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { base: (ipv4ToInt(octets) & mask) >>> 0, mask };
}

const BLOCKED_CIDRS: readonly Cidr[] = BLOCKED_IPV4_CIDRS.map(parseCidr).filter(
  (block): block is Cidr => block !== null,
);

/** A dotted quad as four octets, or null. No leading-zero tolerance: `0177` is not `177`. */
export function parseIpv4(value: string): number[] | null {
  const pieces = value.split(".");
  if (pieces.length !== 4) return null;
  const octets: number[] = [];
  for (const piece of pieces) {
    if (!/^\d{1,3}$/.test(piece)) return null;
    // A leading zero is ambiguous: some resolvers read `0177` as octal. Refusing
    // it is the only reading that cannot be wrong.
    if (piece.length > 1 && piece.startsWith("0")) return null;
    const parsed = Number(piece);
    if (parsed > 255) return null;
    octets.push(parsed);
  }
  return octets;
}

/** A dotted quad as a 32-bit unsigned integer. */
export function ipv4ToInt(octets: readonly number[]): number {
  return (
    (((octets[0] ?? 0) << 24) >>> 0) +
    ((octets[1] ?? 0) << 16) +
    ((octets[2] ?? 0) << 8) +
    (octets[3] ?? 0)
  ) >>> 0;
}

/**
 * Expands an IPv6 literal into its eight 16-bit groups, or null.
 *
 * A trailing embedded dotted quad is folded into the last two groups, so
 * `::ffff:127.0.0.1` and `::ffff:7f00:1` parse to the same value. Surrounding
 * square brackets and a zone index are refused rather than stripped: a zone is
 * machine-local and meaningless off that machine.
 */
export function parseIpv6(value: string): number[] | null {
  let text = value.trim().toLowerCase();
  if (text.startsWith("[") && text.endsWith("]")) text = text.slice(1, -1);
  if (text === "" || text.includes("%")) return null;
  if (!/^[0-9a-f:.]+$/.test(text)) return null;

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const expand = (segment: string): number[] | null => {
    if (segment === "") return [];
    const pieces = segment.split(":");
    const groups: number[] = [];
    for (let index = 0; index < pieces.length; index += 1) {
      const piece = pieces[index] ?? "";
      if (piece === "") return null;
      if (piece.includes(".")) {
        // An embedded IPv4 is only valid as the final piece.
        if (index !== pieces.length - 1) return null;
        const octets = parseIpv4(piece);
        if (octets === null) return null;
        groups.push(((octets[0] ?? 0) << 8) | (octets[1] ?? 0));
        groups.push(((octets[2] ?? 0) << 8) | (octets[3] ?? 0));
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(piece)) return null;
      groups.push(Number.parseInt(piece, 16));
    }
    return groups;
  };

  const head = expand(halves[0] ?? "");
  if (head === null) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;

  const tail = expand(halves[1] ?? "");
  if (tail === null) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

/** The IPv4 address carried in the last 32 bits of an IPv6 address. */
function embeddedIpv4(high: number, low: number): number[] {
  return [(high >>> 8) & 0xff, high & 0xff, (low >>> 8) & 0xff, low & 0xff];
}

/**
 * Writes eight groups back as the compressed form RFC 5952 asks for.
 *
 * Two spellings of one address must produce one string, because the string is
 * what becomes a rate-limit key: `2001:db8::1` and
 * `2001:0db8:0000:0000:0000:0000:0000:0001` are one client, and a limiter that
 * counts them separately can be evaded by re-spelling.
 */
export function canonicaliseIpv6(groups: readonly number[]): string | null {
  if (groups.length !== 8) return null;
  const hex = groups.map((group) => (group & 0xffff).toString(16));

  // The longest run of two or more zero groups is the one to compress.
  let bestStart = -1;
  let bestLength = 0;
  let start = -1;
  for (let index = 0; index <= hex.length; index += 1) {
    const isZero = index < hex.length && hex[index] === "0";
    if (isZero && start === -1) start = index;
    if (!isZero && start !== -1) {
      const length = index - start;
      if (length > bestLength && length >= 2) {
        bestStart = start;
        bestLength = length;
      }
      start = -1;
    }
  }

  if (bestStart === -1) return hex.join(":");
  const before = hex.slice(0, bestStart).join(":");
  const after = hex.slice(bestStart + bestLength).join(":");
  return `${before}::${after}`;
}

/** True when a dotted quad falls in one of the blocked IPv4 ranges. */
export function isBlockedIpv4(octets: readonly number[]): boolean {
  const address = ipv4ToInt(octets);
  for (const block of BLOCKED_CIDRS) {
    if (((address & block.mask) >>> 0) === block.base) return true;
  }
  return false;
}

/**
 * True when an IPv6 address is one that must never be reached.
 *
 * The mapped, IPv4-compatible, NAT64 and 6to4 shapes all carry an IPv4 address
 * that has to be judged on its own terms. Everything not recognised as one of
 * the globally routable shapes is left to the caller, which is why the blocked
 * ones are listed rather than the allowed ones: an unlisted global unicast
 * prefix is still reachable, and refusing it would break ordinary hosts.
 */
export function isBlockedIpv6(groups: readonly number[]): boolean {
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;

  if (groups.every((group) => group === 0)) return true; // ::
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1) {
    return true; // ::1
  }

  // ::ffff:0:0/96 — IPv4-mapped, the shape every dual-stack resolver returns.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return isBlockedIpv4(embeddedIpv4(g6, g7));
  }
  // ::/96 — IPv4-compatible, deprecated but still routable on some stacks.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedIpv4(embeddedIpv4(g6, g7));
  }
  // 64:ff9b::/96 — NAT64, which is how an IPv6-only host reaches IPv4.
  if (g0 === 0x0064 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedIpv4(embeddedIpv4(g6, g7));
  }
  // 2002::/16 — 6to4, which carries the IPv4 address in groups 1 and 2.
  if (g0 === 0x2002) return isBlockedIpv4(embeddedIpv4(g1, g2));

  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // 2001:db8::/32 documentation
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // 100::/64 discard

  return false;
}

/**
 * True for an address that must never be reached.
 *
 * IPv4 private, loopback, link-local (including the cloud metadata address
 * `169.254.169.254`), carrier-grade NAT, documentation, benchmarking and
 * multicast ranges are all refused, as is every IPv6 equivalent — including the
 * mapped, IPv4-compatible, NAT64 and 6to4 shapes that carry an IPv4 address
 * inside them. An address in an unknown or unparseable form is treated as
 * blocked: this is a deny-list with a fail-closed default.
 */
export function isBlockedIpAddress(address: string): boolean {
  const value = address.trim();
  if (value === "") return true;

  if (value.includes(":")) {
    const groups = parseIpv6(value);
    return groups === null ? true : isBlockedIpv6(groups);
  }

  const octets = parseIpv4(value);
  return octets === null ? true : isBlockedIpv4(octets);
}

/** Which family an address literal belongs to, or null when it is neither. */
export function ipAddressFamily(address: string): 4 | 6 | null {
  const value = address.trim();
  if (value === "") return null;
  if (value.includes(":")) return parseIpv6(value) === null ? null : 6;
  return parseIpv4(value) === null ? null : 4;
}

/**
 * The canonical text form of an address literal, or null.
 *
 * IPv6 is compressed and lower-cased; IPv4 is already canonical once parsed.
 * Used wherever the string is an identity rather than an address, so two
 * spellings of one client cannot occupy two buckets.
 */
export function canonicaliseIpAddress(address: string): string | null {
  const value = address.trim();
  if (value === "") return null;

  if (value.includes(":")) {
    const groups = parseIpv6(value);
    return groups === null ? null : canonicaliseIpv6(groups);
  }

  const octets = parseIpv4(value);
  return octets === null ? null : octets.join(".");
}

/**
 * The network an address belongs to, for grouping a single client.
 *
 * An IPv6 subscriber is normally delegated a `/64` and can rotate freely inside
 * it, so keying a rate limit on the full address gives one household millions of
 * buckets. `/64` is the smallest block a residential customer is given, which
 * makes it the right unit for "one client". IPv4 is returned unchanged: a single
 * address is already one client.
 *
 * An IPv4-mapped or IPv4-compatible address is reported as the IPv4 address it
 * carries. Grouping those by `/64` would put every mapped client into the single
 * `::/64` block, which is the opposite of a limit: one shared bucket for the
 * whole IPv4 internet.
 */
export function clientIpNetwork(address: string): string | null {
  const value = address.trim();
  if (value === "") return null;

  if (!value.includes(":")) return canonicaliseIpAddress(value);

  const groups = parseIpv6(value);
  if (groups === null) return null;

  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
  const lowIsIpv4 =
    (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0xffff || g5 === 0)) ||
    (g0 === 0x0064 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0);
  if (lowIsIpv4) {
    return embeddedIpv4(g6, g7).join(".");
  }

  const network = [...groups.slice(0, 4), 0, 0, 0, 0];
  const compressed = canonicaliseIpv6(network);
  return compressed === null ? null : `${compressed}/64`;
}
