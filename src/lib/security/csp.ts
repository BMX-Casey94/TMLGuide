/**
 * Content Security Policy and response security headers.
 *
 * Everything here is a pure function of its arguments, so the policy can be unit
 * tested without a server and rebuilt on every request by the proxy.
 *
 * ## Why the policy carries a nonce *and* hashes
 *
 * The obvious policy for this app is the one in the Next.js guide: a per-request
 * nonce plus `'strict-dynamic'`. It does not work here, and the reason is
 * measured rather than supposed.
 *
 * `next.config.ts` sets `cacheComponents: true`, so every route is served as a
 * prerendered static shell with the dynamic parts streamed in afterwards. The
 * shell is written to disk at build time, when no request exists, so its
 * `<script>` tags cannot carry a nonce. Fetching the production build with a CSP
 * request header confirms it: of the 25 script elements on `/`, seven in the
 * streamed remainder carry a nonce and eighteen in the shell do not. Loaded in a
 * real browser, a nonce-only policy blocks those eighteen, `$RV` and `$RC` never
 * run, and the page never hydrates — clicking a link triggers a full document
 * load instead of a client navigation.
 *
 * `'strict-dynamic'` makes that worse rather than better: it tells the browser
 * to ignore `'self'` and any hash sources, so the shell's own chunk files are
 * blocked too.
 *
 * The policy below therefore admits inline scripts in exactly two ways, and
 * never with `'unsafe-inline'`:
 *
 * 1. `'nonce-…'` for anything Next renders during the request.
 * 2. `'sha256-…'` for the inline bootstrap the build wrote into the static
 *    shell. The hashes are computed from the built output by
 *    `scripts/generate-csp-hashes.mjs`, so they describe specific bytes: a
 *    script that changes will not match.
 *
 * `'self'` covers the chunk files, which are same-origin, content-addressed and
 * immutable. `'strict-dynamic'` is available for deployments that render every
 * route dynamically, but it must not be switched on for this one.
 */

/** Bytes of entropy in a nonce. 128 bits is the usual floor for an unguessable token. */
export const NONCE_BYTE_LENGTH = 16;

/**
 * The origins the app legitimately talks to beyond its own.
 *
 * The One World Radio stream is a redirect: `playerservices.streamtheworld.com`
 * answers `302` to a numbered host such as
 * `https://27913.live.streamtheworld.com/OWR_INTERNATIONAL.mp3`, and the number
 * changes between sessions. A policy that pinned only the first host would break
 * playback on the redirect, so the whole parent domain is allowed. Verified on
 * 25 November 2026.
 */
export const ONE_WORLD_RADIO_STREAM_ORIGIN = "https://*.streamtheworld.com";

/**
 * Cloudflare Turnstile's origin, and the only third party admitted to
 * `script-src` and `frame-src`.
 *
 * The bot challenge needs two permissions that a strict policy withholds: the
 * widget script itself, and the iframe it renders the challenge into. They are
 * granted together, and only when the deployment has configured a site key, so a
 * deployment that does not use Turnstile keeps `frame-src 'none'` — which is the
 * stronger position, and the one this site should have by default.
 *
 * `challenges.cloudflare.com` is used rather than a wildcard: Turnstile serves
 * both `api.js` and the challenge frame from that one host, so nothing else on
 * `cloudflare.com` becomes reachable.
 */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * The map tile origin: OpenFreeMap, which serves OpenStreetMap data as vector
 * tiles, the TileJSON document that lists them, and the glyph ranges used for
 * map labels.
 *
 * The venue map on `/tools/maps` is a MapLibre GL canvas. MapLibre fetches its
 * style resources from inside a Web Worker, so the requests are governed by the
 * document's `connect-src`; the TileJSON document, the `.pbf` tiles and the
 * glyph ranges all arrive from this one host over HTTPS with
 * `access-control-allow-origin: *`. Verified on 26 November 2026.
 *
 * One host, no wildcard: `tiles.openfreemap.org` serves every one of those three
 * resource types, so nothing else on `openfreemap.org` becomes reachable.
 */
export const MAP_TILE_ORIGIN = "https://tiles.openfreemap.org";

export interface CspOptions {
  /** Base64 nonce, as produced by `generateNonce`. */
  readonly nonce: string;
  /** Development relaxations: `'unsafe-eval'` for React's debugging stack traces. */
  readonly isDev: boolean;
  /** Optional CSP reporting endpoint. When set, `report-uri` and `report-to` are emitted. */
  readonly reportToUrl?: string;
  /**
   * Emit `'strict-dynamic'`. Defaults to false.
   *
   * Only safe when every route renders dynamically. See the module comment: with
   * `cacheComponents` the shell's scripts carry no nonce, and
   * `'strict-dynamic'` also makes the browser ignore `'self'` and every hash
   * source, so switching it on here blocks the whole application.
   */
  readonly strictDynamic?: boolean;
  /**
   * `sha256-…` digests of inline scripts the build wrote into the static shell.
   *
   * Accepted with or without the surrounding single quotes so a caller can pass
   * either the bare digest or the finished CSP source expression.
   */
  readonly scriptHashes?: readonly string[];
  /** Extra origins for `connect-src`, for example a configured analytics endpoint. */
  readonly connectSrc?: readonly string[];
  /**
   * True when the deployment has configured Cloudflare Turnstile.
   *
   * Only then is {@link TURNSTILE_ORIGIN} admitted to `script-src` and
   * `frame-src`. When false — the default — `frame-src` stays `'none'`, so this
   * is an opt-in that a misconfiguration cannot switch on by accident.
   */
  readonly turnstile?: boolean;
}

/** Same inputs as the policy itself: the headers are a superset of the policy. */
export type SecurityHeaderOptions = CspOptions;

/**
 * Header name Next.js reads to inject the nonce into its own script tags.
 *
 * Next parses `'nonce-…'` out of the request's `Content-Security-Policy` and
 * applies it to framework scripts, page bundles and inline styles. `x-nonce` is
 * forwarded as well so application code can read it from `headers()`.
 */
export const NONCE_HEADER = "x-nonce";

export const CSP_HEADER = "Content-Security-Policy";

/** The header a caller sends instead of `Content-Security-Policy` to report without blocking. */
export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";

/** Reporting API endpoint list, the modern replacement for `Report-To`. */
export const REPORTING_ENDPOINTS_HEADER = "Reporting-Endpoints";

export const CSP_REPORT_GROUP = "csp-endpoint";

/** Two years, in seconds. Long enough to satisfy preload-list requirements. */
export const HSTS_MAX_AGE_SECONDS = 63_072_000;

/** `Report-To` entry lifetime, in seconds. Thirty days. */
export const REPORT_TO_MAX_AGE_SECONDS = 2_592_000;

/**
 * Permissions Policy for a guide site.
 *
 * Every powerful capability is switched off. The radio player plays audio, which
 * needs no permission (`autoplay` is the exception, and it is limited to this
 * origin so the player's own resume button keeps working). `interest-cohort` is
 * included for the older cohort-based ad API.
 */
export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=(self)",
  "camera=()",
  "display-capture=()",
  "encrypted-media=(self)",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Base64-encodes bytes without depending on `Buffer` or `btoa`.
 *
 * `btoa` is not present in every runtime the proxy can be deployed to, and
 * `Buffer` couples the module to Node, so the encoding is done with arithmetic.
 */
function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const triple = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += BASE64_ALPHABET[(triple >> 18) & 63];
    out += BASE64_ALPHABET[(triple >> 12) & 63];
    out += b1 === undefined ? "=" : BASE64_ALPHABET[(triple >> 6) & 63];
    out += b2 === undefined ? "=" : BASE64_ALPHABET[triple & 63];
  }
  return out;
}

/**
 * Returns a fresh, unguessable nonce for one request.
 *
 * The output matches Next.js' nonce grammar (`[A-Za-z0-9+/_-]+={0,2}`), so it
 * survives being embedded in the header and read back by the framework.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

/**
 * Turns a digest into a CSP source expression.
 *
 * Accepts a bare `sha256-…` digest or an already-quoted `'sha256-…'`, and
 * rejects anything that is not a base64 SHA digest so a malformed value cannot
 * inject extra directives into the header.
 */
export function toCspHashSource(hash: string): string | null {
  const bare = hash.trim().replace(/^'+|'+$/g, "");
  if (!/^(sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2}$/.test(bare)) return null;
  return `'${bare}'`;
}

/**
 * Normalises a candidate URL, or returns null when it is not one.
 *
 * Only `https:` is admitted. `connect-src` is about data leaving the page, and
 * this site is served over HTTPS everywhere; a plain-HTTP endpoint would be
 * blocked by `upgrade-insecure-requests` in any case.
 */
export function normaliseConnectOrigin(origin: string): string | null {
  const trimmed = origin.trim();
  if (trimmed === "") return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Normalises a URL that may legitimately carry a path, or returns null.
 *
 * A CSP reporting endpoint is a full URL, not an origin: `/csp` is a different
 * collector from `/`. The value is rebuilt from parsed components and checked
 * against a grammar with no whitespace and no semicolon, so it cannot terminate
 * the directive it sits in and start another one. That is the difference between
 * a reported violation and an injected policy.
 */
export function normaliseReportUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  // A CSP source expression cannot contain whitespace or a directive separator.
  if (/[\s;,'"\\]/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (url.username !== "" || url.password !== "") return null;
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/**
 * Builds the Content-Security-Policy string.
 *
 * Notes on the choices that are not obvious:
 *
 * - `script-src` never contains `'unsafe-inline'`. Once a nonce or hash is
 *   present a browser ignores that keyword anyway, so including it would add no
 *   compatibility and would mislead the next reader.
 * - `script-src-attr 'none'` blocks inline event handlers (`onclick="…"`)
 *   outright. The app uses React event props, which are not inline attributes.
 * - `'unsafe-eval'` is added in development only. React uses `eval` to rebuild
 *   server stack traces in the browser; production does not.
 * - `style-src` keeps `'unsafe-inline'`. Server-rendered `style="…"` attributes
 *   are governed by `style-src`, and the shell's stylesheet links are
 *   build-time. A nonce cannot reach them, so the alternative is a broken
 *   layout. Script execution is the dangerous surface, and that stays nonce- and
 *   hash-only.
 * - `img-src` admits `data:` and `blob:` because `next/image` emits small
 *   placeholders, the 3D icons use inline SVG data URLs, and MapLibre's canvas
 *   produces `blob:` images for its own markers.
 * - `connect-src` admits the configured analytics endpoint, so the consent-gated
 *   scaffold keeps working without a second policy edit, and
 *   {@link MAP_TILE_ORIGIN} for the venue map's tiles, glyphs and TileJSON.
 * - `worker-src` and `child-src` admit `blob:` because MapLibre GL JS builds its
 *   tile worker from a blob URL. `script-src` deliberately does not, so a blob
 *   can be executed only as a worker and never as a page script.
 * - `upgrade-insecure-requests` is production-only: on a plain-HTTP dev server it
 *   would rewrite the websocket and break hot reload.
 */
export function buildCspHeader({
  nonce,
  isDev,
  reportToUrl,
  strictDynamic = false,
  scriptHashes = [],
  connectSrc = [],
  turnstile = false,
}: CspOptions): string {
  const hashSources = scriptHashes
    .map((hash) => toCspHashSource(hash))
    .filter((hash): hash is string => hash !== null);

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    ...hashSources,
    ...(turnstile ? [TURNSTILE_ORIGIN] : []),
    ...(strictDynamic ? ["'strict-dynamic'"] : []),
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  const connectOrigins = connectSrc
    .map((origin) => normaliseConnectOrigin(origin))
    .filter((origin): origin is string => origin !== null);

  /*
    `frame-src 'none'` unless Turnstile is configured. The widget renders its
    challenge into an iframe on Cloudflare's origin, so a policy that kept
    `'none'` would fail the check silently in the browser while the server still
    demanded it — a dead end for the reader. The two directives are granted from
    the same flag so they cannot drift apart.
  */
  const directives: string[] = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    /*
      MapLibre fetches the TileJSON document and the glyph ranges with `fetch`,
      and its worker fetches the tiles. All three come from {@link MAP_TILE_ORIGIN}.
      The origin is added unconditionally rather than behind a flag: the venue map
      is part of the guide, not an optional integration, and an origin in
      `connect-src` grants nothing beyond reading that public tile set.
    */
    `connect-src ${["'self'", MAP_TILE_ORIGIN, ...connectOrigins].join(" ")}`,
    `media-src 'self' ${ONE_WORLD_RADIO_STREAM_ORIGIN}`,
    "manifest-src 'self'",
    /*
      `worker-src` and `child-src` both carry `blob:`. MapLibre GL JS builds its
      tile worker from a blob URL, and the cross-origin worker URL it would
      otherwise load is refused by a same-origin policy. `worker-src` is the
      modern directive; `child-src` is the fallback that browsers without
      `worker-src` support consult, and the two must agree or the worker loads in
      one engine and silently fails in another.

      `blob:` here is not a script-execution hole: `script-src` still has no
      `blob:` source, so a blob cannot be loaded as a page script — only as a
      worker, whose own `importScripts`/`fetch` calls are subject to
      `connect-src` above.
    */
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    turnstile ? `frame-src ${TURNSTILE_ORIGIN}` : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  if (reportToUrl !== undefined) {
    /*
      The endpoint is validated, not interpolated. `CSP_REPORT_URI` is operator
      configuration, but a value containing a semicolon or a space would append
      directives of its choosing to the policy — `report-uri x; script-src *`
      would turn a reporting setting into a full policy bypass. Validating here
      means a malformed value is dropped rather than trusted.
    */
    const endpoint = normaliseReportUrl(reportToUrl);
    if (endpoint !== null) {
      // `report-uri` is deprecated but still the only reporting directive older
      // browsers understand; `report-to` names the group declared in the
      // `Reporting-Endpoints` header. Emitting both costs nothing.
      directives.push(`report-uri ${endpoint}`);
      directives.push(`report-to ${CSP_REPORT_GROUP}`);
    }
  }

  return directives.join("; ");
}

/**
 * The `Report-To` header value for the current Reporting API.
 *
 * It is a JSON document, so the endpoint is JSON-encoded rather than
 * interpolated, and a malformed URL prevents the header being emitted at all
 * rather than producing a value the browser rejects.
 */
export function buildReportToHeader(reportToUrl: string): string | null {
  const origin = normaliseConnectOrigin(reportToUrl);
  if (origin === null) return null;
  return JSON.stringify({
    group: CSP_REPORT_GROUP,
    max_age: REPORT_TO_MAX_AGE_SECONDS,
    endpoints: [{ url: origin }],
  });
}

/** The `Reporting-Endpoints` header value, or null when the URL is unusable. */
export function buildReportingEndpointsHeader(reportToUrl: string): string | null {
  const origin = normaliseConnectOrigin(reportToUrl);
  if (origin === null) return null;
  return `${CSP_REPORT_GROUP}="${origin}"`;
}

/**
 * Returns every security header for one response.
 *
 * The returned object contains only *response* headers. The nonce is not
 * included: it is written onto the forwarded request instead (see
 * `src/proxy.ts`), and echoing it in the response would publish a value that
 * only the document needs.
 */
export function buildSecurityHeaders({
  nonce,
  isDev,
  reportToUrl,
  strictDynamic,
  scriptHashes,
  connectSrc,
  turnstile,
}: SecurityHeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    [CSP_HEADER]: buildCspHeader({
      nonce,
      isDev,
      reportToUrl,
      strictDynamic,
      scriptHashes,
      connectSrc,
      turnstile: turnstile === true,
    }),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  // HSTS on a local HTTP dev server would make the browser refuse plain HTTP for
  // localhost, so it is production-only.
  if (!isDev) {
    headers["Strict-Transport-Security"] =
      `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains; preload`;
  }

  if (reportToUrl) {
    const reportTo = buildReportToHeader(reportToUrl);
    if (reportTo !== null) headers["Report-To"] = reportTo;
    const endpoints = buildReportingEndpointsHeader(reportToUrl);
    if (endpoints !== null) headers[REPORTING_ENDPOINTS_HEADER] = endpoints;
  }

  return headers;
}

/** True when the app is running under `next dev`. */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/** The part of the environment that decides whether the challenge is active. */
export interface TurnstileEnv {
  readonly NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string | undefined;
  readonly TURNSTILE_SECRET_KEY?: string | undefined;
  readonly [key: string]: string | undefined;
}

/**
 * The Cloudflare Turnstile site key, or null when the challenge is not in use.
 *
 * The site key is the switch, because it is the value that makes the widget
 * appear: a deployment that sets it intends readers to be challenged, so the
 * policy has to admit Cloudflare's script and frame or the widget cannot render.
 *
 * The key is validated against the documented character set before it is
 * returned. It is interpolated into a policy header and into a script URL, and
 * permitting a value containing a semicolon or a space would let an environment
 * variable inject CSP directives — which is the one way a "public" key could
 * become a policy bypass.
 *
 * `TURNSTILE_SECRET_KEY` is what makes the challenge *enforced*, and
 * `verifyTurnstile` fails closed on a missing token whenever it is set. A
 * deployment that sets only the site key renders a widget whose token the server
 * never checks; `describeTurnstile` reports that state so it can be caught.
 */
export function readTurnstileSiteKey(env: TurnstileEnv = process.env): string | null {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (!siteKey) return null;
  return /^[A-Za-z0-9_-]{1,128}$/.test(siteKey) ? siteKey : null;
}

/** True when this deployment renders the challenge, and so needs the CSP exemption. */
export function isTurnstileEnabled(env: TurnstileEnv = process.env): boolean {
  return readTurnstileSiteKey(env) !== null;
}

/**
 * The state of the challenge, for a startup log or a health endpoint.
 *
 * `rendered` and `enforced` are separate because the gap between them is the
 * failure worth catching: a widget the reader solves and the server never checks
 * is worse than no widget, since it costs the reader effort for no protection.
 */
export function describeTurnstile(env: TurnstileEnv = process.env): {
  rendered: boolean;
  enforced: boolean;
  misconfigured: boolean;
} {
  const rendered = readTurnstileSiteKey(env) !== null;
  const enforced = (env.TURNSTILE_SECRET_KEY?.trim() ?? "") !== "";
  return { rendered, enforced, misconfigured: rendered !== enforced };
}
