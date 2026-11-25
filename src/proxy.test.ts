/**
 * Tests for the proxy.
 *
 * The proxy is the one place headers are attached, so these tests are about the
 * wiring rather than the policy itself: which headers land on the response, what
 * is forwarded on the request, and the conditions under which a document gets a
 * hash list and a non-storable cache directive.
 *
 * `NextResponse` is mocked so the assertions can read the headers directly
 * instead of inferring them from a response object.
 */

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Everything the proxy asked `NextResponse.next` to do, per call. */
interface NextCall {
  requestHeaders: Headers;
}

const nextCalls: NextCall[] = [];

vi.mock("next/server", () => {
  class MockNextResponse {
    readonly headers: Headers;
    constructor(headers: Headers) {
      this.headers = headers;
    }
    static next(init?: { request?: { headers?: Headers } }): MockNextResponse {
      nextCalls.push({ requestHeaders: init?.request?.headers ?? new Headers() });
      return new MockNextResponse(new Headers());
    }
  }
  return { NextResponse: MockNextResponse };
});

const hashCalls: string[] = [];

vi.mock("@/lib/security/csp-hashes", () => ({
  getInlineScriptHashes: (pathname: string): readonly string[] => {
    hashCalls.push(pathname);
    return ["sha256-FROMSHELL="];
  },
  isPrerenderOutputAvailable: (): boolean => true,
}));

import { proxy, config } from "./proxy";
import { CSP_HEADER, NONCE_HEADER } from "@/lib/security/csp";

/** A request-shaped object with the members the proxy reads. */
function makeRequest(
  pathname: string,
  headers: Record<string, string> = {},
): {
  nextUrl: { pathname: string };
  headers: Headers;
  method: string;
} {
  return {
    nextUrl: { pathname },
    headers: new Headers(headers),
    method: "GET",
  };
}

/** Runs the proxy and returns the response headers and the forwarded request. */
function run(request: ReturnType<typeof makeRequest>): {
  responseHeaders: Headers;
  requestHeaders: Headers;
} {
  nextCalls.length = 0;
  // The proxy's parameter is a `NextRequest`; this stub provides the members it
  // actually touches, which is what makes the unit test possible without a server.
  const response = proxy(request as unknown as Parameters<typeof proxy>[0]);
  const call = nextCalls[0];
  if (call === undefined) throw new Error("NextResponse.next was not called");
  return {
    responseHeaders: (response as unknown as { headers: Headers }).headers,
    requestHeaders: call.requestHeaders,
  };
}

beforeEach(() => {
  nextCalls.length = 0;
  hashCalls.length = 0;
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CSP_REPORT_URI", "");
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("response headers", () => {
  it("sets a Content-Security-Policy on every response", () => {
    const { responseHeaders } = run(makeRequest("/", { "sec-fetch-dest": "document" }));
    const csp = responseHeaders.get(CSP_HEADER);
    expect(csp).toBeTypeOf("string");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("never emits 'unsafe-inline' for scripts", () => {
    const { responseHeaders } = run(makeRequest("/about", { "sec-fetch-dest": "document" }));
    const csp = responseHeaders.get(CSP_HEADER) ?? "";
    const scriptSrc = csp.split(";").find((part) => part.trim().startsWith("script-src ")) ?? "";
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("sets the standard hardening headers", () => {
    const { responseHeaders } = run(makeRequest("/", { "sec-fetch-dest": "document" }));
    expect(responseHeaders.get("X-Content-Type-Options")).toBe("nosniff");
    expect(responseHeaders.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(responseHeaders.get("Permissions-Policy")).toContain("camera=()");
    expect(responseHeaders.get("X-Frame-Options")).toBe("DENY");
    expect(responseHeaders.get("Strict-Transport-Security")).toContain("max-age=63072000");
  });

  it("sets the headers on an API response too, since they matter there as much", () => {
    const { responseHeaders } = run(makeRequest("/api/contact", { accept: "application/json" }));
    expect(responseHeaders.get("X-Content-Type-Options")).toBe("nosniff");
    expect(responseHeaders.get(CSP_HEADER)).toBeTypeOf("string");
  });

  it("emits reporting headers only when an endpoint is configured", () => {
    expect(run(makeRequest("/")).responseHeaders.get("Report-To")).toBeNull();

    vi.stubEnv("CSP_REPORT_URI", "https://report.example.com/csp");
    const { responseHeaders } = run(makeRequest("/", { "sec-fetch-dest": "document" }));
    expect(responseHeaders.get("Report-To")).toContain("csp-endpoint");
    expect(responseHeaders.get("Reporting-Endpoints")).toBe(
      'csp-endpoint="https://report.example.com"',
    );
  });

  it("admits the configured analytics endpoint in connect-src", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "https://analytics.example.com/collect");
    const { responseHeaders } = run(makeRequest("/", { "sec-fetch-dest": "document" }));
    const csp = responseHeaders.get(CSP_HEADER) ?? "";
    const connectSrc = csp.split(";").find((part) => part.trim().startsWith("connect-src ")) ?? "";
    expect(connectSrc).toContain("https://analytics.example.com");
  });
});

describe("request headers", () => {
  it("forwards a fresh nonce on x-nonce", () => {
    const { requestHeaders, responseHeaders } = run(
      makeRequest("/", { "sec-fetch-dest": "document" }),
    );
    const nonce = requestHeaders.get(NONCE_HEADER);
    expect(nonce).toBeTypeOf("string");
    expect((nonce ?? "").length).toBeGreaterThanOrEqual(22);
    // The response policy must carry the same nonce, or Next would attach one
    // the browser was never told about.
    expect(responseHeaders.get(CSP_HEADER)).toContain(`'nonce-${nonce}'`);
  });

  it("sends a minimal CSP on the request, so Next can read the nonce out of it", () => {
    // Next parses `'nonce-…'` from the request's Content-Security-Policy. The
    // request copy stays small: the hashes are only needed on the response.
    const { requestHeaders } = run(makeRequest("/", { "sec-fetch-dest": "document" }));
    const csp = requestHeaders.get(CSP_HEADER) ?? "";
    expect(csp).toMatch(/^script-src 'self' 'nonce-[A-Za-z0-9+/]+={0,2}'$/);
    expect(csp).not.toContain("sha256-");
  });

  it("generates a different nonce for each request", () => {
    const first = run(makeRequest("/")).requestHeaders.get(NONCE_HEADER);
    const second = run(makeRequest("/")).requestHeaders.get(NONCE_HEADER);
    expect(first).not.toBe(second);
  });

  it("preserves the caller's existing headers", () => {
    const { requestHeaders } = run(
      makeRequest("/", { "sec-fetch-dest": "document", "accept-language": "en-GB" }),
    );
    expect(requestHeaders.get("accept-language")).toBe("en-GB");
  });
});

describe("prerendered shell hashes", () => {
  it("attaches the shell hashes for a document request", () => {
    const { responseHeaders } = run(makeRequest("/guides/tickets", { "sec-fetch-dest": "document" }));
    expect(responseHeaders.get(CSP_HEADER)).toContain("'sha256-FROMSHELL='");
    expect(hashCalls).toEqual(["/guides/tickets"]);
  });

  it("attaches no hashes for an RSC payload", () => {
    // An RSC payload executes no inline script, so hashing the shell would be
    // wasted work on the hottest path.
    const { responseHeaders } = run(makeRequest("/guides", { "sec-fetch-dest": "empty" }));
    expect(responseHeaders.get(CSP_HEADER)).not.toContain("sha256-");
    expect(hashCalls).toEqual([]);
  });

  it("treats an RSC request as a payload even without Fetch Metadata", () => {
    const { responseHeaders } = run(makeRequest("/guides", { rsc: "1" }));
    expect(responseHeaders.get(CSP_HEADER)).not.toContain("sha256-");
  });

  it("treats a request with no Fetch Metadata as a possible document", () => {
    /*
      A crawler or an older browser sends neither `sec-fetch-dest` nor anything
      that proves it is not asking for HTML. It must be treated as a document:
      caching an HTML response that carries a per-request nonce would let a CDN
      serve it to browsers, whose scripts would then be blocked.
    */
    const { responseHeaders } = run(makeRequest("/about", { accept: "text/html,application/xhtml+xml" }));
    expect(responseHeaders.get(CSP_HEADER)).toContain("sha256-");
  });

  it("treats a metadata-less request as a possible document even with a JSON accept", () => {
    const { responseHeaders } = run(makeRequest("/about", { accept: "application/json" }));
    expect(responseHeaders.get(CSP_HEADER)).toContain("sha256-");
  });

  it("never treats an API route as a document", () => {
    // The route handler sets its own, stricter `no-store`; overriding it here
    // would weaken it.
    const { responseHeaders } = run(makeRequest("/api/contact", {}));
    expect(responseHeaders.get("Cache-Control")).toBeNull();
  });

  it("wraps a document in an iframe with the document policy too", () => {
    const { responseHeaders } = run(makeRequest("/about", { "sec-fetch-dest": "iframe" }));
    expect(responseHeaders.get(CSP_HEADER)).toContain("sha256-");
  });

  it("does not hash for a script or image fetch", () => {
    for (const destination of ["script", "image", "style", "font"]) {
      const { responseHeaders } = run(makeRequest("/about", { "sec-fetch-dest": destination }));
      expect(responseHeaders.get(CSP_HEADER)).not.toContain("sha256-");
    }
  });
});

describe("cacheability", () => {
  it("forbids shared caching of a document, so a nonce is never reused by a CDN", () => {
    const { responseHeaders } = run(makeRequest("/", { "sec-fetch-dest": "document" }));
    const cacheControl = responseHeaders.get("Cache-Control") ?? "";
    expect(cacheControl).toContain("private");
    expect(cacheControl).not.toContain("public");
    expect(cacheControl).not.toContain("s-maxage");
  });

  it("does not use no-store, so the service worker can still precache pages", () => {
    // `public/sw.js` calls `cache.add` on the guide routes; `no-store` would make
    // every one of those reject and break offline reading.
    const { responseHeaders } = run(makeRequest("/guides", { "sec-fetch-dest": "document" }));
    expect(responseHeaders.get("Cache-Control")).not.toContain("no-store");
  });

  it("forbids shared caching when the request carries no Fetch Metadata", () => {
    // The case that matters: a crawler's HTML would otherwise be cached for a
    // year by Next's own `s-maxage`, and every browser served that copy would
    // carry a nonce it cannot match.
    const { responseHeaders } = run(makeRequest("/about", {}));
    expect(responseHeaders.get("Cache-Control")).toContain("private");
  });

  it("leaves a non-document response's cache headers alone", () => {
    const { responseHeaders } = run(makeRequest("/api/contact", { accept: "application/json" }));
    expect(responseHeaders.get("Cache-Control")).toBeNull();
  });
});

describe("development", () => {
  it("omits HSTS so localhost is not pinned to HTTPS", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { responseHeaders } = run(makeRequest("/", { "sec-fetch-dest": "document" }));
    expect(responseHeaders.get("Strict-Transport-Security")).toBeNull();
  });

  it("allows 'unsafe-eval' for React's development stack traces", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { responseHeaders } = run(makeRequest("/", { "sec-fetch-dest": "document" }));
    const csp = responseHeaders.get(CSP_HEADER) ?? "";
    const scriptSrc = csp.split(";").find((part) => part.trim().startsWith("script-src ")) ?? "";
    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("does not read shell hashes in development, where shells are not prerendered", () => {
    vi.stubEnv("NODE_ENV", "development");
    run(makeRequest("/", { "sec-fetch-dest": "document" }));
    expect(hashCalls).toEqual([]);
  });

  it("does not override the dev server's cache headers", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { responseHeaders } = run(makeRequest("/", { "sec-fetch-dest": "document" }));
    expect(responseHeaders.get("Cache-Control")).toBeNull();
  });
});

describe("matcher config", () => {
  it("excludes the immutable build output and icons", () => {
    const source = config.matcher[0]?.source ?? "";
    expect(source).toContain("_next/static");
    expect(source).toContain("_next/image");
    expect(source).toContain("favicon.ico");
    expect(source).toContain("icons/");
  });

  it("still matches API routes", () => {
    // The negative lookahead must not exclude `api`, or route handlers would lose
    // `nosniff` and the referrer policy.
    const source = config.matcher[0]?.source ?? "";
    expect(source).not.toMatch(/\(\?!api\|/);
  });

  it("skips prefetches, which fetch RSC payloads rather than documents", () => {
    const missing = config.matcher[0]?.missing ?? [];
    const keys = missing.map((entry) => entry.key);
    expect(keys).toContain("next-router-prefetch");
    expect(keys).toContain("purpose");
  });
});
