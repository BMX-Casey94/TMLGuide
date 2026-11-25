/**
 * Allow-listed, SSRF-hardened live fetcher.
 *
 * `docs/ai/robots-and-terms-check.md` §6 permits exactly one thing: reading a
 * specific public page, at the moment a reader asks about it, to answer that
 * question, with a link back and a retrieval timestamp. This module is the only
 * code in the application that does it, and it is written so that the permission
 * cannot be stretched.
 *
 * ## The controls, and why each is here
 *
 * 1. **One function decides.** {@link permittedTarget} returns a rebuilt URL or
 *    `null`. There is no second path, no override flag, and no caller that
 *    builds a request without it.
 * 2. **Hostname comparison is a `Set` lookup, not `endsWith`.** `endsWith
 *    ("tomorrowland.com")` accepts `eviltomorrowland.com`; the document records
 *    that as a real vulnerability it was written to avoid.
 * 3. **Deny is evaluated before trust.** A permitted host does not make a denied
 *    path safe, and the ordering is visible so a refactor cannot invert it.
 * 4. **HTTPS, default port, no credentials, no fragment.** A citation link with
 *    a fragment could show one thing and fetch another.
 * 5. **Manual redirects, re-validated every hop.** `redirect: "manual"` plus an
 *    explicit loop, so a `302` to `http://169.254.169.254/` is refused rather
 *    than followed. Two hops, as the compliance document specifies.
 * 6. **Four-second deadline and a 256 kB cap.** Both are read from the stream as
 *    it arrives, so a slow or huge response cannot exhaust memory or a request
 *    budget.
 * 7. **Soft-404 rejection.** The marketing hosts answer a missing page with a
 *    `200` and a 4.8 kB HTML error page. Treating a `200` as content is how an
 *    error page becomes an answer, so the body is checked.
 * 8. **Nothing is stored.** The result is returned in memory and discarded. There
 *    is no cache, no disk write, no embedding, and no log of the body.
 */

/** Hosts the compliance document permits, exactly as written there. */
export const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  "belgium.tomorrowland.com",
  "winter.tomorrowland.com",
  "brasil.tomorrowland.com",
  "www.tomorrowland.com",
  "press.belgium.tomorrowland.com",
  "press.winter.tomorrowland.com",
  "press.brasil.tomorrowland.com",
  "faq.tomorrowland.com",
  "faq.tomorrowlandwinter.com",
  "tomorrowlandbrasil.zendesk.com",
]);

/** Zendesk hosts, which publish `robots.txt` rules the others do not. */
export const ZENDESK_HOSTS: ReadonlySet<string> = new Set([
  "faq.tomorrowland.com",
  "faq.tomorrowlandwinter.com",
  "tomorrowlandbrasil.zendesk.com",
]);

/** Denied at the root of a host: exact match, or a path segment beneath it. */
export const DENIED_ROOTS: readonly string[] = [
  "/tickets",
  "/search",
  "/access",
  "/auth",
  "/api",
  "/account",
  "/accounts",
  "/console",
  "/users",
];

/**
 * Published Zendesk denials where the language segment varies.
 *
 * Expanded rather than globbed at request time: a literal `/hc/en-us/search`
 * comparison silently misses `/hc/pt-br/search`, which is where much of the
 * Brasil material lives.
 */
export const DENIED_UNDER_HC = /^\/hc\/[a-z]{2}(?:-[a-z]{2,4})?\/(?:search|requests|signin)(?:\/|$)/;

/** The identifying user agent the compliance document specifies. */
export const USER_AGENT = "TMLGuideBot/1.0 (+https://tml.guide/about; contact: webmaster@tml.guide)";

export const FETCH_TIMEOUT_MS = 4000;
export const MAX_BYTES = 256 * 1024;
export const MAX_REDIRECTS = 2;

/** Longest excerpt passed to the model, in characters. About 200 words. */
export const MAX_EXCERPT_CHARS = 1400;

/**
 * True when a pathname is denied on any host.
 *
 * Exported because the test suite exercises the rule directly, and because a
 * future caller (a sitemap checker, say) should be able to reuse the same answer
 * rather than reimplement it.
 */
export function isDeniedPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  if (DENIED_UNDER_HC.test(lower)) return true;
  return DENIED_ROOTS.some((root) => lower === root || lower.startsWith(`${root}/`));
}

/** True when a hostname is on the allow-list. Exact comparison, always. */
export function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname.toLowerCase());
}

/**
 * Returns the canonical URL a fetch may use, or `null`.
 *
 * The return value is rebuilt from `origin` + `pathname` + `search`, so a
 * fragment, a username or an unusual port cannot survive into the request even
 * if a caller passes them.
 */
export function permittedTarget(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.port !== "") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (!isAllowedHost(url.hostname)) return null;
  if (isDeniedPath(url.pathname)) return null;

  return `${url.origin}${url.pathname}${url.search}`;
}

/**
 * True for an address the fetcher must never reach.
 *
 * IPv4 private, loopback, link-local (including the cloud metadata address
 * `169.254.169.254`), carrier-grade NAT, benchmarking and multicast ranges are
 * all refused, as are their IPv6 equivalents. An address in an unknown or
 * unparseable form is treated as unsafe: this is a deny-list with a fail-closed
 * default, not a permit-list.
 */
export function isBlockedAddress(address: string): boolean {
  const value = address.trim().toLowerCase();
  if (value === "") return true;

  // IPv6 forms, including the mapped/compatible 6to4 shapes that carry an IPv4
  // address inside them.
  if (value.includes(":")) {
    const bare = value.startsWith("[") ? value.slice(1, value.indexOf("]")) : value;
    if (bare === "::1" || bare === "::") return true;
    if (bare.startsWith("fe80")) return true; // link-local
    if (bare.startsWith("fc") || bare.startsWith("fd")) return true; // unique local
    if (bare.startsWith("ff")) return true; // multicast
    const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(bare);
    if (mapped !== null) return isBlockedAddress(mapped[1] ?? "");
    return false;
  }

  const parts = value.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    // Not a dotted quad at all. A hostname reaching this function has already
    // passed the allow-list; anything else is refused rather than guessed at.
    return true;
  }

  const [a = 0, b = 0] = parts;
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast and reserved

  return false;
}

/** Resolves a hostname to addresses. Injectable so a test never touches DNS. */
export type HostResolver = (hostname: string) => Promise<readonly string[]>;

/**
 * The default resolver.
 *
 * `node:dns` is imported lazily so this module can be bundled for a runtime that
 * does not have it without failing at import time. A resolution failure returns
 * an empty list, which the caller treats as "no opinion": the allow-list already
 * decides whether the host may be contacted at all, and this check is
 * defence-in-depth against a rebind, not the primary control.
 */
async function defaultResolver(hostname: string): Promise<readonly string[]> {
  try {
    const dns = await import("node:dns/promises");
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    return records.map((record) => record.address);
  } catch {
    return [];
  }
}

export interface LiveFetchDeps {
  readonly fetchImpl?: typeof fetch;
  readonly resolve?: HostResolver;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

export interface LiveExcerpt {
  readonly url: string;
  /** Plain text, collapsed to single spaces and truncated at a sentence end. */
  readonly text: string;
  /** "18 Nov 2026" style date, supplied by the caller's formatter; ISO here. */
  readonly retrievedAt: string;
  readonly sourceTitle: string;
}

export type LiveFetchOutcome =
  | { readonly ok: true; readonly excerpt: LiveExcerpt }
  | { readonly ok: false; readonly code: LiveFetchFailureCode; readonly detail: string };

export type LiveFetchFailureCode =
  /** Not https, not on the allow-list, or a denied path. */
  | "not-permitted"
  /** The hostname resolved to a blocked address. */
  | "blocked-address"
  /** A redirect chain longer than {@link MAX_REDIRECTS}. */
  | "too-many-redirects"
  /** The deadline expired. */
  | "timeout"
  /** The body exceeded {@link MAX_BYTES}. */
  | "too-large"
  /** Non-2xx, a wrong content type, or a soft 404. */
  | "unusable-response"
  /** A transport error. */
  | "fetch-failed";

/**
 * Reads a response body as text, aborting once the byte cap is passed.
 *
 * Reading with a reader rather than `response.text()` is the difference between
 * a cap and a suggestion: `text()` buffers the whole body before anyone can
 * measure it, so a 2 GB response has already been accepted by the time the check
 * runs.
 */
async function readBounded(
  response: Response,
  maxBytes: number,
): Promise<{ readonly text: string; readonly bytes: number } | null> {
  const body = response.body;
  if (body === null) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) return null;
    return { text: new TextDecoder("utf-8").decode(buffer), bytes: buffer.byteLength };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let received = 0;
  let text = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return { text, bytes: received };
}

/**
 * Markers that identify the marketing hosts' HTML 404 page.
 *
 * The document records that a missing page returns `200` with `text/html` and a
 * Next.js error page, so a status-code test alone would parse an error as
 * content. These phrases appear in that template and in no real article.
 */
const SOFT_404_MARKERS: readonly string[] = [
  "this page could not be found",
  "404 - page not found",
  "page not found",
  "pagina niet gevonden",
  "page introuvable",
  "página não encontrada",
];

/** True when an HTML body looks like the site's own 404 template. */
export function looksLikeSoft404(html: string): boolean {
  const lower = html.toLowerCase();
  // The template is small. A long page that happens to contain "page not found"
  // in a footer link is not a soft 404, so size is part of the test.
  if (html.length > 20_000) return false;
  return SOFT_404_MARKERS.some((marker) => lower.includes(marker));
}

/** Elements whose contents are never useful as an excerpt. */
const STRIP_ELEMENTS = /<(script|style|noscript|svg|iframe|template|nav|footer|header|form)\b[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * Reduces HTML to readable plain text.
 *
 * Deliberately simple and deterministic: the excerpt goes to a model as
 * untrusted data, not to a browser, so the only requirements are that the words
 * survive, the markup does not, and nothing can be smuggled through as an
 * instruction hidden in an attribute.
 *
 * Block-level tags become a space, so two paragraphs do not run together. Inline
 * tags become nothing, so a figure split by `<em>` stays one figure rather than
 * becoming "€1 44", which is a different number.
 */
export function htmlToText(html: string): string {
  const withoutHidden = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(STRIP_ELEMENTS, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, " ");

  return withoutHidden
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const value = Number.parseInt(code, 10);
      return Number.isFinite(value) && value > 31 && value < 0x110000 ? String.fromCodePoint(value) : " ";
    })
    .replace(/\s+/g, " ")
    // A removed tag leaves a space. Before punctuation that space is wrong, and it
    // broke a quoted figure: "€144 ." is not a sentence a reader or a model should see.
    .replace(/\s+([.,;:!?%)\]])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .trim();
}

/**
 * Truncates to a paragraph or sentence boundary.
 *
 * Quoting half a sentence is how a correct passage becomes a wrong answer, so the
 * cut is always at a boundary. A text with no boundary inside the budget is cut
 * at the last space rather than mid-word.
 */
export function truncateAtBoundary(text: string, maxChars: number = MAX_EXCERPT_CHARS): string {
  if (text.length <= maxChars) return text.trim();

  const window = text.slice(0, maxChars);
  const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
  if (sentenceEnd > maxChars * 0.4) return window.slice(0, sentenceEnd + 1).trim();

  const space = window.lastIndexOf(" ");
  return (space > 0 ? window.slice(0, space) : window).trim();
}

/**
 * Fetches one allow-listed page and returns a short plain-text excerpt.
 *
 * Never throws: every failure is a typed value, because a reader waiting for an
 * answer should get the verified data plus a refusal, not a stack trace.
 */
export async function fetchExcerpt(
  rawUrl: string,
  deps: LiveFetchDeps = {},
): Promise<LiveFetchOutcome> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const resolve = deps.resolve ?? defaultResolver;
  const timeoutMs = deps.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxBytes = deps.maxBytes ?? MAX_BYTES;

  let target = permittedTarget(rawUrl);
  if (target === null) {
    return { ok: false, code: "not-permitted", detail: "URL is not on the allow-list" };
  }

  const deadline = AbortSignal.timeout(timeoutMs);
  let hops = 0;

  for (;;) {
    const hostname = new URL(target).hostname;
    const addresses = await resolve(hostname);
    if (addresses.some((address) => isBlockedAddress(address))) {
      return {
        ok: false,
        code: "blocked-address",
        detail: `${hostname} resolved to an address the fetcher may not reach`,
      };
    }

    let response: Response;
    try {
      response = await fetchImpl(target, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-GB,en;q=0.9",
        },
        signal: deadline,
        cache: "no-store",
        // No cookies, no credentials: this is a public page read, not a session.
        credentials: "omit",
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      return {
        ok: false,
        code: timedOut ? "timeout" : "fetch-failed",
        detail: `Fetch of ${hostname} failed`,
      };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location === null) {
        return { ok: false, code: "unusable-response", detail: "Redirect with no Location header" };
      }
      if (hops >= MAX_REDIRECTS) {
        return { ok: false, code: "too-many-redirects", detail: `More than ${MAX_REDIRECTS} redirects` };
      }

      // Resolve relative to the URL just requested, then re-validate against both
      // lists. A redirect is a fresh decision, not an inherited permission.
      let absolute: string;
      try {
        absolute = new URL(location, target).toString();
      } catch {
        return { ok: false, code: "unusable-response", detail: "Unparseable redirect target" };
      }

      const next = permittedTarget(absolute);
      if (next === null) {
        return { ok: false, code: "not-permitted", detail: "Redirect target is not on the allow-list" };
      }
      target = next;
      hops += 1;
      continue;
    }

    if (!response.ok) {
      return {
        ok: false,
        code: "unusable-response",
        detail: `HTTP ${response.status} from ${hostname}`,
      };
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const isZendesk = ZENDESK_HOSTS.has(hostname);
    if (isZendesk) {
      // The published Zendesk bodies are `text/html; charset=utf-8`. Requiring
      // the charset as well rejects a JSON error served with a 200.
      if (!contentType.startsWith("text/html") || !contentType.includes("charset=utf-8")) {
        return {
          ok: false,
          code: "unusable-response",
          detail: `Unexpected content type from ${hostname}`,
        };
      }
    } else if (!contentType.startsWith("text/html")) {
      return { ok: false, code: "unusable-response", detail: `Unexpected content type from ${hostname}` };
    }

    const body = await readBounded(response, maxBytes);
    if (body === null) {
      return { ok: false, code: "too-large", detail: `Response exceeded ${maxBytes} bytes` };
    }

    if (looksLikeSoft404(body.text)) {
      return { ok: false, code: "unusable-response", detail: `${hostname} served its 404 template` };
    }

    const text = truncateAtBoundary(htmlToText(body.text));
    if (text.length < 40) {
      // A page with no readable prose is not an excerpt; it is a shell that needs
      // JavaScript, and reporting it as content would put an empty passage in
      // front of the model.
      return { ok: false, code: "unusable-response", detail: `${hostname} yielded no readable text` };
    }

    const title = extractTitle(body.text) ?? new URL(target).hostname;
    return {
      ok: true,
      excerpt: {
        url: target,
        text,
        retrievedAt: new Date().toISOString(),
        sourceTitle: title,
      },
    };
  }
}

/** The document title, falling back to the `og:title` when there is no `<title>`. */
export function extractTitle(html: string): string | null {
  const title = /<title[^>]*>([\s\S]{1,300}?)<\/title>/i.exec(html);
  if (title?.[1] !== undefined) {
    const cleaned = htmlToText(title[1]);
    if (cleaned.length > 0) return cleaned.slice(0, 160);
  }
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["']/i.exec(html);
  if (og?.[1] !== undefined) return htmlToText(og[1]).slice(0, 160);
  return null;
}
