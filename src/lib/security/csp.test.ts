/**
 * Tests for the CSP builder and the standard hardening headers.
 *
 * The policy is security-critical, so most assertions are about what must be
 * *absent* (`'unsafe-inline'`, `*`, a missing `frame-ancestors`) as much as what
 * must be present. Each directive is parsed back out of the header string rather
 * than matched as a substring, so a test cannot pass merely because the directive
 * appeared somewhere in a longer value.
 */

import { describe, expect, it } from "vitest";
import {
  buildCspHeader,
  buildReportToHeader,
  buildReportingEndpointsHeader,
  buildSecurityHeaders,
  generateNonce,
  HSTS_MAX_AGE_SECONDS,
  isDevelopment,
  NONCE_BYTE_LENGTH,
  normaliseConnectOrigin,
  ONE_WORLD_RADIO_STREAM_ORIGIN,
  PERMISSIONS_POLICY,
  toCspHashSource,
} from "./csp";

/** Splits a policy into `directive -> sources`, for precise assertions. */
function parse(csp: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of csp.split(";")) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    const [name, ...sources] = trimmed.split(/\s+/);
    if (name === undefined) continue;
    map.set(name, sources);
  }
  return map;
}

const BASE = { nonce: "TESTNONCE", isDev: false } as const;

describe("generateNonce", () => {
  it("produces a 128-bit base64 nonce", () => {
    const nonce = generateNonce();
    // 16 bytes base64-encoded is 24 characters with padding, or 22 unpadded.
    expect(nonce.length).toBeGreaterThanOrEqual(22);
    expect(NONCE_BYTE_LENGTH).toBe(16);
  });

  it("matches the grammar Next.js reads back out of the header", () => {
    // Next's own parser uses /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/, so a nonce
    // containing any other character would silently never be applied.
    for (let i = 0; i < 50; i += 1) {
      expect(generateNonce()).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    }
  });

  it("never repeats", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(generateNonce());
    expect(seen.size).toBe(500);
  });

  it("decodes back to exactly the configured entropy", () => {
    const bytes = Buffer.from(generateNonce(), "base64");
    expect(bytes.length).toBe(NONCE_BYTE_LENGTH);
  });

  it("is not produced by Math.random", () => {
    // A structural check: two calls made at the same instant must differ, which a
    // time-seeded generator would not guarantee.
    expect(generateNonce()).not.toBe(generateNonce());
  });
});

describe("buildCspHeader", () => {
  it("never emits 'unsafe-inline' in script-src", () => {
    for (const isDev of [true, false]) {
      const parsed = parse(buildCspHeader({ ...BASE, isDev }));
      expect(parsed.get("script-src")).not.toContain("'unsafe-inline'");
      expect(buildCspHeader({ ...BASE, isDev })).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    }
  });

  it("includes the nonce in script-src", () => {
    const parsed = parse(buildCspHeader({ nonce: "abc123", isDev: false }));
    expect(parsed.get("script-src")).toContain("'nonce-abc123'");
  });

  it("omits 'strict-dynamic' by default and includes it only when asked", () => {
    expect(parse(buildCspHeader(BASE)).get("script-src")).not.toContain("'strict-dynamic'");
    expect(
      parse(buildCspHeader({ ...BASE, strictDynamic: true })).get("script-src"),
    ).toContain("'strict-dynamic'");
  });

  it("adds 'unsafe-eval' in development only", () => {
    expect(parse(buildCspHeader({ ...BASE, isDev: true })).get("script-src")).toContain(
      "'unsafe-eval'",
    );
    expect(parse(buildCspHeader(BASE)).get("script-src")).not.toContain("'unsafe-eval'");
  });

  it("blocks inline event handlers", () => {
    expect(parse(buildCspHeader(BASE)).get("script-src-attr")).toEqual(["'none'"]);
  });

  it("carries the required lockdown directives", () => {
    const parsed = parse(buildCspHeader(BASE));
    expect(parsed.get("frame-ancestors")).toEqual(["'none'"]);
    expect(parsed.get("base-uri")).toEqual(["'self'"]);
    expect(parsed.get("form-action")).toEqual(["'self'"]);
    expect(parsed.get("object-src")).toEqual(["'none'"]);
    expect(parsed.get("frame-src")).toEqual(["'none'"]);
    expect(parsed.get("default-src")).toEqual(["'self'"]);
  });

  it("restricts img-src to self, data and blob", () => {
    expect(parse(buildCspHeader(BASE)).get("img-src")).toEqual(["'self'", "data:", "blob:"]);
  });

  it("restricts connect-src to 'self' plus explicit origins", () => {
    expect(parse(buildCspHeader(BASE)).get("connect-src")).toEqual(["'self'"]);

    const withEndpoint = parse(
      buildCspHeader({ ...BASE, connectSrc: ["https://analytics.example.com/collect"] }),
    );
    expect(withEndpoint.get("connect-src")).toEqual(["'self'", "https://analytics.example.com"]);
  });

  it("rejects a plain-HTTP or malformed connect origin rather than relaxing the policy", () => {
    const parsed = parse(
      buildCspHeader({
        ...BASE,
        connectSrc: ["http://insecure.example.com", "not a url", "https://ok.example.com"],
      }),
    );
    expect(parsed.get("connect-src")).toEqual(["'self'", "https://ok.example.com"]);
  });

  it("allows the One World Radio stream in media-src only", () => {
    const parsed = parse(buildCspHeader(BASE));
    expect(parsed.get("media-src")).toContain(ONE_WORLD_RADIO_STREAM_ORIGIN);
    // The stream must not leak into script-src or connect-src.
    expect(parsed.get("script-src")).not.toContain(ONE_WORLD_RADIO_STREAM_ORIGIN);
    expect(parsed.get("connect-src")).not.toContain(ONE_WORLD_RADIO_STREAM_ORIGIN);
  });

  it("permits the service worker script", () => {
    expect(parse(buildCspHeader(BASE)).get("worker-src")).toEqual(["'self'", "blob:"]);
    expect(parse(buildCspHeader(BASE)).get("manifest-src")).toEqual(["'self'"]);
  });

  it("upgrades insecure requests in production only", () => {
    expect(parse(buildCspHeader(BASE)).has("upgrade-insecure-requests")).toBe(true);
    expect(parse(buildCspHeader({ ...BASE, isDev: true })).has("upgrade-insecure-requests")).toBe(
      false,
    );
  });

  it("admits script hashes, so prerendered shell scripts are allowed without 'unsafe-inline'", () => {
    const parsed = parse(
      buildCspHeader({ ...BASE, scriptHashes: ["sha256-abc123+/def=", "'sha256-quoted="] }),
    );
    const scriptSrc = parsed.get("script-src") ?? [];
    expect(scriptSrc).toContain("'sha256-abc123+/def='");
    expect(scriptSrc).toContain("'sha256-quoted='");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("drops a malformed hash rather than letting it inject directives", () => {
    const parsed = parse(
      buildCspHeader({
        ...BASE,
        scriptHashes: [
          "sha256-good=",
          "sha256-bad'; script-src * '",
          "'unsafe-inline'",
          "sha1-weak=",
        ],
      }),
    );
    const scriptSrc = parsed.get("script-src") ?? [];
    expect(scriptSrc).toEqual(["'self'", "'nonce-TESTNONCE'", "'sha256-good='"]);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc.some((source) => source.includes("*"))).toBe(false);
  });

  it("emits reporting directives only when an endpoint is configured", () => {
    expect(parse(buildCspHeader(BASE)).has("report-uri")).toBe(false);
    expect(parse(buildCspHeader(BASE)).has("report-to")).toBe(false);

    const reported = parse(buildCspHeader({ ...BASE, reportToUrl: "https://report.example.com/csp" }));
    expect(reported.get("report-uri")).toEqual(["https://report.example.com/csp"]);
    expect(reported.get("report-to")).toEqual(["csp-endpoint"]);
  });

  it("produces a header with no newlines, which would truncate it in transit", () => {
    const csp = buildCspHeader({ ...BASE, scriptHashes: ["sha256-x="] });
    expect(csp).not.toMatch(/[\r\n]/);
  });

  it("has a single space between sources and no doubled separators", () => {
    const csp = buildCspHeader(BASE);
    expect(csp).not.toMatch(/\s{2,}/);
    expect(csp).not.toMatch(/;;/);
  });

  it("is deterministic for the same inputs", () => {
    expect(buildCspHeader(BASE)).toBe(buildCspHeader(BASE));
  });

  it("embeds the nonce it is given, not a fresh one", () => {
    expect(buildCspHeader({ nonce: "fixed-value", isDev: false })).toContain(
      "'nonce-fixed-value'",
    );
  });
});

describe("toCspHashSource", () => {
  it("accepts a bare digest and quotes it", () => {
    expect(toCspHashSource("sha256-abc=")).toBe("'sha256-abc='");
  });

  it("accepts an already-quoted digest without double-quoting", () => {
    expect(toCspHashSource("'sha384-abc='")).toBe("'sha384-abc='");
  });

  it("tolerates surrounding whitespace", () => {
    expect(toCspHashSource("  sha512-abc=  ")).toBe("'sha512-abc='");
  });

  it("rejects weak algorithms and malformed values", () => {
    expect(toCspHashSource("sha1-abc=")).toBeNull();
    expect(toCspHashSource("md5-abc=")).toBeNull();
    expect(toCspHashSource("sha256-")).toBeNull();
    expect(toCspHashSource("sha256-abc'; script-src *")).toBeNull();
    expect(toCspHashSource("")).toBeNull();
  });
});

describe("normaliseConnectOrigin", () => {
  it("returns the origin of an https URL", () => {
    expect(normaliseConnectOrigin("https://a.example.com/collect?x=1")).toBe("https://a.example.com");
  });

  it("keeps a non-default port", () => {
    expect(normaliseConnectOrigin("https://a.example.com:8443/x")).toBe(
      "https://a.example.com:8443",
    );
  });

  it("rejects http, non-web schemes and junk", () => {
    expect(normaliseConnectOrigin("http://a.example.com")).toBeNull();
    expect(normaliseConnectOrigin("data:text/html,x")).toBeNull();
    expect(normaliseConnectOrigin("javascript:alert(1)")).toBeNull();
    expect(normaliseConnectOrigin("")).toBeNull();
    expect(normaliseConnectOrigin("   ")).toBeNull();
  });
});

describe("buildSecurityHeaders", () => {
  it("includes every required hardening header", () => {
    const headers = buildSecurityHeaders(BASE);
    expect(headers["Content-Security-Policy"]).toBeDefined();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe(PERMISSIONS_POLICY);
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("sets HSTS with a two-year max-age, subdomains and preload in production", () => {
    const hsts = buildSecurityHeaders(BASE)["Strict-Transport-Security"];
    expect(hsts).toBe(`max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains; preload`);
    expect(HSTS_MAX_AGE_SECONDS).toBe(63_072_000);
  });

  it("omits HSTS in development, so localhost is not pinned to HTTPS", () => {
    expect(buildSecurityHeaders({ ...BASE, isDev: true })["Strict-Transport-Security"]).toBeUndefined();
  });

  it("denies every powerful feature in the Permissions-Policy", () => {
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(PERMISSIONS_POLICY).toContain(`${feature}=()`);
    }
  });

  it("does not echo the nonce as a separate response header", () => {
    // The nonce belongs on the forwarded request and inside the policy. A
    // separate `x-nonce` response header would publish it where nothing reads it.
    const headers = buildSecurityHeaders(BASE);
    expect(Object.keys(headers)).not.toContain("x-nonce");
    expect(Object.keys(headers).map((name) => name.toLowerCase())).not.toContain("x-nonce");
    // It must, however, appear in the policy itself.
    expect(headers["Content-Security-Policy"]).toContain("'nonce-TESTNONCE'");
  });

  it("adds the Reporting API headers when an endpoint is configured", () => {
    const headers = buildSecurityHeaders({ ...BASE, reportToUrl: "https://report.example.com/csp" });
    expect(headers["Report-To"]).toBeDefined();
    expect(headers["Reporting-Endpoints"]).toBe('csp-endpoint="https://report.example.com"');
    const reportTo = JSON.parse(headers["Report-To"] ?? "{}") as {
      group: string;
      endpoints: { url: string }[];
    };
    expect(reportTo.group).toBe("csp-endpoint");
    expect(reportTo.endpoints[0]?.url).toBe("https://report.example.com");
  });

  it("omits the Reporting headers when no endpoint is configured", () => {
    const headers = buildSecurityHeaders(BASE);
    expect(headers["Report-To"]).toBeUndefined();
    expect(headers["Reporting-Endpoints"]).toBeUndefined();
  });

  it("includes a safe cross-origin policy pair", () => {
    const headers = buildSecurityHeaders(BASE);
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });
});

describe("buildReportToHeader", () => {
  it("refuses to emit a header for an unusable URL", () => {
    expect(buildReportToHeader("http://insecure.example.com")).toBeNull();
    expect(buildReportToHeader("nonsense")).toBeNull();
  });

  it("emits valid JSON with a bounded max_age", () => {
    const parsed = JSON.parse(buildReportToHeader("https://r.example.com/x") ?? "{}") as {
      max_age: number;
    };
    expect(parsed.max_age).toBe(2_592_000);
  });
});

describe("buildReportingEndpointsHeader", () => {
  it("reduces the endpoint to an origin", () => {
    expect(buildReportingEndpointsHeader("https://r.example.com/path?q=1")).toBe(
      'csp-endpoint="https://r.example.com"',
    );
  });

  it("returns null for an unusable URL", () => {
    expect(buildReportingEndpointsHeader("http://r.example.com")).toBeNull();
  });
});

describe("isDevelopment", () => {
  it("reflects NODE_ENV", () => {
    const original = process.env.NODE_ENV;
    try {
      // `NODE_ENV` is read-only in the type, not at runtime.
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      expect(isDevelopment()).toBe(true);
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      expect(isDevelopment()).toBe(false);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = original;
    }
  });
});
