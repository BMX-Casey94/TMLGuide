/**
 * Pure helpers for the link-health check.
 *
 * Nothing in this module touches the network, the clock or the filesystem, so
 * every function is deterministic and unit-testable. The network side lives in
 * `scripts/check-links.mjs`.
 */

/** Sent on every request so operators can identify and contact us. */
export const USER_AGENT = "TMLGuideLinkCheck/1.0 (+independent fan guide; contact via site)";

/** Every classification the report can emit, in reporting order. */
export const CLASSIFICATIONS = Object.freeze([
  "ok",
  "redirected",
  "insecure",
  "dead",
  "blocked",
  "unreachable",
  "rejected",
]);

/** Classifications that count as a problem in the report. */
export const PROBLEM_CLASSIFICATIONS = Object.freeze([
  "insecure",
  "dead",
  "blocked",
  "unreachable",
  "rejected",
]);

const NAMED_ENTITIES = Object.freeze({
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
});

/**
 * Decodes the subset of HTML entities that appear in page titles and invite
 * metadata. Unknown entities are left exactly as found rather than dropped.
 */
export function decodeHtmlEntities(value) {
  return String(value ?? "").replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      return String.fromCodePoint(code);
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? match;
  });
}

function networkErrorVerdict(code) {
  const dnsCodes = ["ENOTFOUND", "EAI_AGAIN", "EAI_FAIL", "EAI_NODATA", "EAI_NONAME"];
  if (dnsCodes.includes(code)) {
    return {
      classification: "dead",
      note: `DNS lookup failed (${code}) — the host no longer resolves`,
    };
  }
  if (code === "ETIMEDOUT") {
    return { classification: "unreachable", note: "request timed out with no response" };
  }
  if (code === "ECONNREFUSED") {
    return { classification: "unreachable", note: "connection refused" };
  }
  if (/CERT|TLS|SSL/.test(code)) {
    return { classification: "unreachable", note: `TLS failure (${code})` };
  }
  return { classification: "unreachable", note: `network error (${code})` };
}

/**
 * Turns the outcome of one probe into a classification plus a human note.
 *
 * Precedence is fixed and deliberate:
 *   1. a transport error decides dead/unreachable, because there was no answer;
 *   2. a plain `http:` URL is `insecure` whatever the server answered — the
 *      scheme is the defect, and the note carries the reachability detail;
 *   3. 404/410 are `dead`; 401/403/429/451 are `blocked`; 5xx and unresolved
 *      redirects are `unreachable`; other 4xx are `dead`;
 *   4. a bot challenge on an otherwise 2xx page is `blocked`;
 *   5. any followed redirect is `redirected`, everything else is `ok`.
 *
 * @param {object} outcome
 * @param {number|null} [outcome.httpStatus] Final HTTP status, or null when no response arrived.
 * @param {{code?: string, message?: string}|null} [outcome.error] Transport-level failure.
 * @param {boolean} [outcome.insecure] True when the requested URL used `http:`.
 * @param {boolean} [outcome.challenge] True when the body looked like a bot challenge.
 * @param {number} [outcome.redirects] Number of redirects followed.
 * @param {string|null} [outcome.finalUrl] URL after redirects.
 * @param {string|null} [outcome.requestedUrl] URL that was asked for.
 * @returns {{classification: string, note: string}}
 */
export function classifyStatus(outcome = {}) {
  const { httpStatus = null, error = null, insecure = false, challenge = false } = outcome;
  const redirects = Number(outcome.redirects ?? 0);
  const finalUrl = outcome.finalUrl ?? null;
  const requestedUrl = outcome.requestedUrl ?? null;

  if (error) return networkErrorVerdict(String(error.code ?? "NETWORK_ERROR"));

  if (httpStatus === null || httpStatus === undefined) {
    return { classification: "unreachable", note: "no response received" };
  }

  let base;
  if (httpStatus === 404 || httpStatus === 410) {
    base = { classification: "dead", note: `${httpStatus} — page not found or gone` };
  } else if (httpStatus === 401) {
    base = { classification: "blocked", note: "401 — authentication required" };
  } else if (httpStatus === 403) {
    base = { classification: "blocked", note: "403 — access refused to automated clients" };
  } else if (httpStatus === 429) {
    base = { classification: "blocked", note: "429 — rate limited" };
  } else if (httpStatus === 451) {
    base = { classification: "blocked", note: "451 — unavailable for legal reasons" };
  } else if (httpStatus >= 500) {
    base = { classification: "unreachable", note: `${httpStatus} — server error` };
  } else if (httpStatus >= 400) {
    base = { classification: "dead", note: `${httpStatus} — client error` };
  } else if (httpStatus >= 300) {
    base = { classification: "unreachable", note: `${httpStatus} — redirect without a usable location` };
  } else if (httpStatus < 200) {
    // 1xx is an interim response: the server never sent a final answer.
    base = { classification: "unreachable", note: `${httpStatus} — interim response, no final status` };
  } else if (challenge) {
    base = { classification: "blocked", note: "bot challenge instead of page content" };
  } else if (redirects > 0) {
    base = {
      classification: "redirected",
      note: redirects === 1 ? "follows a redirect" : `follows ${redirects} redirects`,
    };
  } else {
    base = { classification: "ok", note: `${httpStatus} — OK` };
  }

  if (insecure) {
    const moved = finalUrl && requestedUrl && finalUrl !== requestedUrl ? ` and ends at ${finalUrl}` : "";
    return {
      classification: "insecure",
      note: `plain http:// (${base.note})${moved}`,
    };
  }

  return base;
}

/**
 * IPv4 blocks that must never be fetched: loopback, private, link-local (cloud
 * metadata lives at 169.254.169.254), carrier-grade NAT, and the IANA special
 * purpose ranges that are not routable on the public internet.
 */
const PRIVATE_IPV4_BLOCKS = Object.freeze([
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
]);

function ipv4ToInt(octets) {
  return ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
}

function inIpv4Block(octets, block) {
  const [base, prefixText] = block.split("/");
  const prefix = Number(prefixText);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const address = ipv4ToInt(octets);
  return ((address & mask) >>> 0) === ((ipv4ToInt(parseIpv4(base)) & mask) >>> 0);
}

function parseIpv4(value) {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    octets.push(octet);
  }
  return octets;
}

function isPrivateIpv4(octets) {
  return PRIVATE_IPV4_BLOCKS.some((block) => inIpv4Block(octets, block));
}

/** Expands a `::`-compressed IPv6 address into eight 16-bit groups. */
function parseIpv6(value) {
  const [head, tail] = value.includes("::") ? value.split("::") : [value, null];
  const headGroups = head ? head.split(":").filter((group) => group !== "") : [];
  const tailGroups = tail ? tail.split(":").filter((group) => group !== "") : [];
  const groups = [];
  for (const group of [...headGroups, ...tailGroups]) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    groups.push(Number.parseInt(group, 16));
  }
  if (tail === null) return groups.length === 8 ? groups : null;
  const missing = 8 - groups.length;
  if (missing < 1) return null;
  const padded = [...headGroups, ...Array(missing).fill("0"), ...tailGroups];
  return padded.length === 8 ? padded.map((group) => Number.parseInt(group, 16)) : null;
}

function isPrivateIpv6(groups) {
  const [first, second] = groups;
  const allZero = groups.every((group) => group === 0);
  if (allZero) return true; // ::
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true; // ::1
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (first === 0x2001 && second === 0x0db8) return true; // documentation
  /*
    Every shape below carries an IPv4 address that has to be judged on its own
    terms. Each is written out rather than pattern-matched, because the text
    spellings of these addresses differ wildly while the values are identical:
    `::ffff:127.0.0.1` and `::ffff:7f00:1` are one address.
  */
  const lastTwo = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
  // IPv4-mapped (::ffff:0:0/96).
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return isPrivateIpv4(lastTwo);
  }
  // IPv4-compatible (::/96), deprecated but still routable on some stacks. This
  // is the form `::127.0.0.1` compresses to.
  if (groups.slice(0, 6).every((group) => group === 0)) return isPrivateIpv4(lastTwo);
  // NAT64 (64:ff9b::/96).
  if (first === 0x0064 && second === 0xff9b && groups.slice(2, 6).every((g) => g === 0)) {
    return isPrivateIpv4(lastTwo);
  }
  // 6to4 (2002::/16) carries the IPv4 address in the second and third groups.
  if (first === 0x2002) {
    return isPrivateIpv4([
      (second >> 8) & 0xff,
      second & 0xff,
      (groups[2] >> 8) & 0xff,
      groups[2] & 0xff,
    ]);
  }
  return false;
}

/** Lower-cases a hostname and removes IPv6 brackets and any trailing dot. */
function normaliseHost(host) {
  return String(host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

/**
 * True when a hostname is, or is an alias for, something on the local network.
 *
 * Covers IPv4 private/special ranges, IPv6 loopback/ULA/link-local/mapped
 * forms, and the reserved local names. Resolution of ordinary DNS names is the
 * caller's job (`scripts/check-links.mjs` checks every resolved address too),
 * because this function stays synchronous and network-free by design.
 */
export function isPrivateHost(host) {
  const value = normaliseHost(host);
  if (value === "") return true;
  if (value === "localhost") return true;
  if (/\.(localhost|local|internal|home\.arpa)$/.test(value)) return true;
  if (value.includes(":")) {
    const groups = parseIpv6(value);
    return groups === null ? true : isPrivateIpv6(groups);
  }
  const octets = parseIpv4(value);
  if (octets) return isPrivateIpv4(octets);
  // A dotted-quad with leading zeros or a bare integer may still parse as IPv4
  // for the resolver, so refuse anything that is entirely digits and dots.
  return /^[0-9.]+$/.test(value);
}

const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

/**
 * Parses a URL and refuses it unless it is a plain web URL on a public host.
 *
 * Run every URL through this before it reaches the network code, and run every
 * redirect target through it too: a public page can still redirect to
 * `http://169.254.169.254/`, which is the classic SSRF route to cloud metadata.
 * DNS names are checked by name only here; `scripts/check-links.mjs` resolves
 * each host and applies `isPrivateHost` to every address before connecting.
 *
 * @param {unknown} rawUrl
 * @returns {{safe: true, url: URL, reason: null} | {safe: false, url: null, reason: string}}
 */
export function inspectUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    return { safe: false, url: null, reason: "missing url" };
  }
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { safe: false, url: null, reason: "not a valid absolute URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { safe: false, url: null, reason: `unsupported scheme "${parsed.protocol}"` };
  }
  // A URL carrying credentials would send them on the wire; refuse outright.
  if (parsed.username !== "" || parsed.password !== "") {
    return { safe: false, url: null, reason: "URL embeds credentials" };
  }
  if (parsed.hostname === "") {
    return { safe: false, url: null, reason: "URL has no host" };
  }
  if (isPrivateHost(parsed.hostname)) {
    return {
      safe: false,
      url: null,
      reason: `host "${parsed.hostname}" is a private or reserved address`,
    };
  }
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return { safe: false, url: null, reason: `port ${parsed.port} is not allowed` };
  }
  return { safe: true, url: parsed, reason: null };
}

const WHATSAPP_GENERIC_TITLES = new Set([
  "whatsapp group invite",
  "whatsapp group chat invite",
  "whatsapp",
  "whatsapp messenger",
  "whatsapp business",
]);

const WHATSAPP_INVALID_MARKERS = Object.freeze([
  "invite link is invalid or has been revoked",
  "invite link is invalid",
  "invite link has been revoked",
  "invite link has been reset",
  "invite link has expired",
  "this invite link is no longer valid",
  "no longer available",
]);

function firstMatch(source, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match) return match;
  }
  return null;
}

/**
 * Reads a WhatsApp invite page and reports whether the invite still works.
 *
 * The check is passive: it fetches the public invite page once, with no login
 * and no join request, and reads only what that page prints. A revoked invite
 * renders the generic "WhatsApp Group Invite" shell with an empty `og:title`
 * and no group name, so the absence of a name is treated as invalid rather
 * than as an unknown.
 *
 * @param {unknown} html Response body of `https://chat.whatsapp.com/<code>`.
 * @returns {{state: "active"|"invalid"|"unknown", groupName: string|null, evidence: string}}
 */
export function parseWhatsappInvite(html) {
  const source = String(html ?? "");
  if (source.trim() === "") {
    return { state: "unknown", groupName: null, evidence: "empty response body" };
  }

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(source);
  const pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : "";

  const ogMatch = firstMatch(source, [
    /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i,
  ]);
  const ogTitle = ogMatch ? decodeHtmlEntities(ogMatch[1]).trim() : "";

  const inviteNameMatch = firstMatch(source, [
    /invited to join\s*(?:<br\s*\/?>)?\s*[“"']([^”"']+)[”"']/i,
    /invited to join\s*(?:<br\s*\/?>)?\s*&ldquo;([^&]+)&rdquo;/i,
  ]);
  const inviteName = inviteNameMatch ? decodeHtmlEntities(inviteNameMatch[1]).trim() : "";

  const lowerSource = source.toLowerCase();
  const marker = WHATSAPP_INVALID_MARKERS.find((candidate) => lowerSource.includes(candidate));
  if (marker) {
    return { state: "invalid", groupName: null, evidence: `page says "${marker}"` };
  }

  const name = inviteName || ogTitle;
  const isGenericName = name === "" || WHATSAPP_GENERIC_TITLES.has(name.toLowerCase());
  if (!isGenericName) {
    return {
      state: "active",
      groupName: name,
      evidence: inviteName ? "group name in invite page body" : "group name in og:title",
    };
  }

  const looksLikeWhatsappShell = /whatsapp/i.test(pageTitle) || lowerSource.includes("whatsapp group invite");
  if (looksLikeWhatsappShell && isGenericName) {
    return {
      state: "invalid",
      groupName: null,
      evidence: `generic invite page with no group name (title: "${pageTitle || "(none)"}")`,
    };
  }

  return { state: "unknown", groupName: null, evidence: "no invite metadata found on the page" };
}
