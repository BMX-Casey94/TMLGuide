/**
 * Proxy: the single place security headers are attached to a response.
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts`, and the file lives in `src/` so
 * it sits beside `app/`. The `proxy` named export and the `config.matcher` shape
 * are what this version expects; `middleware.ts` still works but is deprecated.
 *
 * ## What happens on each request
 *
 * 1. A fresh nonce is minted. It is never reused between requests.
 * 2. A minimal CSP carrying only that nonce is written onto the *forwarded
 *    request*. Next parses the nonce out of it and attaches it to every script it
 *    renders for this request. The request header is deliberately small: the
 *    hashes would be dead weight there.
 * 3. The full policy is written onto the *response*, together with the standard
 *    hardening headers.
 *
 * `x-nonce` is forwarded as well so a server component can read the value with
 * `headers()` if it ever needs to render its own `<script>`. Nothing in the
 * layout reads it today: `layout.tsx` must stay free of `headers()` or every
 * route loses its static shell under `cacheComponents`.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildSecurityHeaders,
  generateNonce,
  isDevelopment,
  CSP_HEADER,
  NONCE_HEADER,
} from "@/lib/security/csp";
import { getInlineScriptHashes, isPrerenderOutputAvailable } from "@/lib/security/csp-hashes";
/**
 * Reporting endpoint, when the deployment has one.
 *
 * Left unset by default: a `report-uri` the operator does not read is worse than
 * none, because it looks like monitoring.
 */
function reportToUrl(): string | undefined {
  const configured = process.env.CSP_REPORT_URI?.trim();
  return configured ? configured : undefined;
}

/**
 * Origins the browser may `fetch` from this document.
 *
 * The analytics endpoint belongs here: the consent-gated scaffold posts to it,
 * and a site operator who switches it on should not also have to edit a CSP.
 */
function connectOrigins(): string[] {
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT?.trim();
  return endpoint ? [endpoint] : [];
}

/** Warned once per process, so a misconfigured host does not flood the log. */
let warnedAboutHashes = false;

/** True when the request is a React Server Component payload, not a document. */
function isRscRequest(request: NextRequest): boolean {
  return (
    request.headers.get("rsc") !== null ||
    request.headers.get("next-router-state-tree") !== null
  );
}

/**
 * Whether this request could be answered with an HTML document.
 *
 * The classification decides two things that must not be got wrong: whether the
 * shell's hashes are attached, and whether the response may be shared-cached. A
 * document carrying a per-request nonce must never reach a CDN, so anything that
 * *might* be a document has to be treated as one. The rule is therefore
 * deliberately inclusive:
 *
 * - API routes are never documents. They set their own `Cache-Control`, which is
 *   stricter (`no-store`), and overriding it would weaken it.
 * - RSC payloads are never documents: they execute no inline script.
 * - With Fetch Metadata present, it decides. `document` and `iframe` are
 *   documents; `empty` and `script` are not.
 * - With no Fetch Metadata at all — an older browser, curl, a crawler — the
 *   request is treated as a possible document. A crawler that receives HTML with
 *   a nonce-bound policy and `s-maxage=31536000` would otherwise let a CDN serve
 *   that copy to browsers, whose own scripts carry no nonce and would be blocked.
 *
 * The cost of being inclusive is hashing a shell for a request that turns out to
 * be a payload; the cost of being exclusive is a poisoned cache entry.
 */
function wantsDocument(request: NextRequest): boolean {
  if (request.nextUrl.pathname.startsWith("/api/")) return false;
  if (isRscRequest(request)) return false;

  const destination = request.headers.get("sec-fetch-dest");
  if (destination !== null) return destination === "document" || destination === "iframe";

  return true;
}

export function proxy(request: NextRequest): NextResponse {
  const isDev = isDevelopment();
  const nonce = generateNonce();

  const scriptHashes = isDev || !wantsDocument(request) ? [] : getInlineScriptHashes(request.nextUrl.pathname);

  if (!isDev && !warnedAboutHashes && !isPrerenderOutputAvailable()) {
    warnedAboutHashes = true;
    console.warn(
      "[security] Prerendered shell output is not readable at runtime, so inline " +
        "scripts in static shells cannot be hashed. Pages that are prerendered " +
        "will not hydrate until the output is available to the server process.",
    );
  }

  const headers = buildSecurityHeaders({
    nonce,
    isDev,
    reportToUrl: reportToUrl(),
    scriptHashes,
    connectSrc: connectOrigins(),
  });

  // The request copy carries the nonce and nothing else. Next only reads the
  // nonce from it, and a six-kilobyte request header would risk a 431 from a
  // front-end proxy for no benefit.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, `script-src 'self' 'nonce-${nonce}'`);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }

  /*
    A document carrying a per-request nonce must not be stored by a *shared*
    cache. If a CDN served one visitor's HTML to another, a nonce the first
    visitor already knows would appear in the second visitor's page, and the
    one-time property the policy rests on is gone.

    `private` forbids shared caches while still letting the browser store the
    response, which the service worker needs: `public/sw.js` precaches the guide
    routes, and `no-store` would make `cache.add` reject them and break offline
    reading. `no-cache` forces revalidation, so a stored copy is never reused
    without a fresh nonce.
  */
  if (!isDev && wantsDocument(request)) {
    response.headers.set("Cache-Control", "private, no-cache, must-revalidate");
  }

  return response;
}

export const config = {
  /*
    Everything except the immutable build output and the icons the manifest
    points at. API routes are included on purpose: they need `nosniff` and
    `Referrer-Policy` just as much as a page does.

    Prefetches are excluded. They fetch an RSC payload, which executes no inline
    script, and skipping them keeps the hash lookup off the most frequent path.
  */
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icons/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
