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
  describeTurnstile,
  isTurnstileEnabled,
  MAP_TILE_ORIGIN,
  NONCE_BYTE_LENGTH,
  normaliseConnectOrigin,
  ONE_WORLD_RADIO_STREAM_ORIGIN,
  PERMISSIONS_POLICY,
  readTurnstileSiteKey,
  toCspHashSource,
  TURNSTILE_ORIGIN,
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

  it("keeps frame-src at 'none' by default, so no third party can be framed", () => {
    // The default matters more than the opt-in: a policy that admitted a frame
    // origin unless told otherwise would make the exemption the baseline.
    expect(parse(buildCspHeader(BASE)).get("frame-src")).toEqual(["'none'"]);
    expect(parse(buildCspHeader({ ...BASE, turnstile: false })).get("frame-src")).toEqual(["'none'"]);
  });

  it("admits Cloudflare Turnstile to script-src and frame-src only when opted in", () => {
    const parsed = parse(buildCspHeader({ ...BASE, turnstile: true }));
    expect(parsed.get("script-src")).toContain(TURNSTILE_ORIGIN);
    expect(parsed.get("frame-src")).toEqual([TURNSTILE_ORIGIN]);
    // 'none' and an origin together is a malformed directive; the browser would
    // ignore the origin. It must be replaced, not extended.
    expect(parsed.get("frame-src")).not.toContain("'none'");
  });

  it("adds exactly one origin for Turnstile, never a wildcard", () => {
    const parsed = parse(buildCspHeader({ ...BASE, turnstile: true }));
    const scriptSrc = parsed.get("script-src") ?? [];
    expect(scriptSrc.filter((source) => source.includes("cloudflare"))).toEqual([TURNSTILE_ORIGIN]);
    expect(scriptSrc.some((source) => source.includes("*"))).toBe(false);
    expect(TURNSTILE_ORIGIN).toBe("https://challenges.cloudflare.com");
  });

  it("does not leak the Turnstile origin into any other directive", () => {
    const parsed = parse(buildCspHeader({ ...BASE, turnstile: true }));
    // The widget makes no same-document fetch of its own; the token goes in the
    // form post to our own origin. connect-src must therefore not widen for it.
    expect(parsed.get("connect-src")).not.toContain(TURNSTILE_ORIGIN);
    expect(parsed.get("img-src")).not.toContain(TURNSTILE_ORIGIN);
    expect(parsed.get("default-src")).toEqual(["'self'"]);
    expect(parsed.get("style-src")).not.toContain(TURNSTILE_ORIGIN);
  });

  it("still refuses 'unsafe-inline' when Turnstile is enabled", () => {
    for (const turnstile of [true, false]) {
      for (const isDev of [true, false]) {
        expect(parse(buildCspHeader({ ...BASE, isDev, turnstile })).get("script-src")).not.toContain(
          "'unsafe-inline'",
        );
      }
    }
  });

  it("keeps the nonce and hashes alongside the Turnstile origin", () => {
    const parsed = parse(
      buildCspHeader({ ...BASE, turnstile: true, scriptHashes: ["sha256-abc="] }),
    );
    const scriptSrc = parsed.get("script-src") ?? [];
    expect(scriptSrc).toContain("'nonce-TESTNONCE'");
    expect(scriptSrc).toContain("'sha256-abc='");
    expect(scriptSrc).toContain(TURNSTILE_ORIGIN);
  });

  it("restricts img-src to self, data and blob", () => {
    expect(parse(buildCspHeader(BASE)).get("img-src")).toEqual(["'self'", "data:", "blob:"]);
  });

  it("restricts connect-src to 'self', the map tiles and explicit origins", () => {
    expect(parse(buildCspHeader(BASE)).get("connect-src")).toEqual(["'self'", MAP_TILE_ORIGIN]);

    const withEndpoint = parse(
      buildCspHeader({ ...BASE, connectSrc: ["https://analytics.example.com/collect"] }),
    );
    expect(withEndpoint.get("connect-src")).toEqual([
      "'self'",
      MAP_TILE_ORIGIN,
      "https://analytics.example.com",
    ]);
  });

  it("rejects a plain-HTTP or malformed connect origin rather than relaxing the policy", () => {
    const parsed = parse(
      buildCspHeader({
        ...BASE,
        connectSrc: ["http://insecure.example.com", "not a url", "https://ok.example.com"],
      }),
    );
    expect(parsed.get("connect-src")).toEqual([
      "'self'",
      MAP_TILE_ORIGIN,
      "https://ok.example.com",
    ]);
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

  describe("MapLibre GL and the venue map", () => {
    it("admits the OpenFreeMap origin to connect-src, so tiles and glyphs can be fetched", () => {
      /*
        MapLibre fetches inside a Web Worker, so the requests carry the document's
        policy. The TileJSON document, the `.pbf` tiles and the glyph ranges are all
        served from this one host; without it the canvas stays blank and the reader
        sees the fallback with no explanation of why.
      */
      const parsed = parse(buildCspHeader(BASE));
      expect(parsed.get("connect-src")).toContain(MAP_TILE_ORIGIN);
      expect(MAP_TILE_ORIGIN).toBe("https://tiles.openfreemap.org");
    });

    it("allows blob workers through both worker-src and its child-src fallback", () => {
      const parsed = parse(buildCspHeader(BASE));
      expect(parsed.get("worker-src")).toEqual(["'self'", "blob:"]);
      // Browsers without `worker-src` consult `child-src`; the two must agree.
      expect(parsed.get("child-src")).toEqual(["'self'", "blob:"]);
    });

    it("never lets blob: reach script-src, so a blob can only run as a worker", () => {
      for (const isDev of [true, false]) {
        const scriptSrc = parse(buildCspHeader({ ...BASE, isDev })).get("script-src") ?? [];
        expect(scriptSrc).not.toContain("blob:");
        expect(scriptSrc).not.toContain("data:");
        expect(scriptSrc).not.toContain("'unsafe-inline'");
        // `'unsafe-eval'` is a development-only exception for React's stack traces;
        // neither map-related change is allowed to introduce it in production.
        if (!isDev) expect(scriptSrc).not.toContain("'unsafe-eval'");
      }
    });

    it("keeps blob: out of script-src even while admitting it to img-src", () => {
      // MapLibre's canvas produces blob images for markers; that is an image
      // source, not an executable one, and the two must not be conflated.
      const parsed = parse(buildCspHeader(BASE));
      expect(parsed.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
      expect(parsed.get("script-src") ?? []).not.toContain("blob:");
    });

    it("adds no wildcard and no third-party origin beyond the tile host", () => {
      const parsed = parse(buildCspHeader(BASE));
      expect(parsed.get("connect-src")).toEqual(["'self'", MAP_TILE_ORIGIN]);
      for (const [directive, sources] of parsed) {
        for (const source of sources) {
          if (directive === "default-src") continue;
          expect(source, `${directive} carries a bare wildcard`).not.toBe("*");
        }
      }
      // A schema-relative wildcard would admit every subdomain of every host.
      expect(buildCspHeader(BASE)).not.toMatch(/connect-src[^;]*\*/);
    });

    it("keeps the tile origin out of every directive that does not need it", () => {
      const parsed = parse(buildCspHeader(BASE));
      for (const directive of ["script-src", "style-src", "font-src", "media-src", "frame-src"]) {
        expect(parsed.get(directive) ?? [], directive).not.toContain(MAP_TILE_ORIGIN);
      }
    });
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

  it("refuses a reporting endpoint that would inject a directive", () => {
    /*
      Regression: `CSP_REPORT_URI` was interpolated into the policy as-is, so
      `https://r.example/x; script-src *` appended an entire permissive policy.
      A browser takes the first occurrence of a directive, so the injected
      `script-src` would not win — but `frame-src` or a second `report-uri` would,
      and relying on directive ordering is not a control.
    */
    for (const value of [
      "https://r.example/x; script-src *",
      "x; frame-src *",
      "https://r.example/x\nframe-src *",
      "javascript:alert(1)",
      "http://insecure.example/x",
      "not a url",
      "https://r.example/x','default-src *",
    ]) {
      const csp = buildCspHeader({ ...BASE, reportToUrl: value });
      expect(csp, value).not.toMatch(/script-src \*|frame-src \*|default-src \*/);
      // Either the directive is dropped entirely or only the validated origin lands.
      expect(csp, value).not.toContain("\n");
    }
  });

  it("keeps only the validated endpoint, path included, for the reporting directives", () => {
    const parsed = parse(
      buildCspHeader({ ...BASE, reportToUrl: "https://r.example.com/collect?q=a;b" }),
    );
    // A reporting endpoint is a URL, not an origin, but a value containing a
    // directive separator is refused outright rather than truncated.
    expect(parsed.get("report-uri")).toBeUndefined();
    expect(parsed.get("report-to")).toBeUndefined();

    const clean = parse(buildCspHeader({ ...BASE, reportToUrl: "https://r.example.com/collect?q=1" }));
    expect(clean.get("report-uri")).toEqual(["https://r.example.com/collect?q=1"]);
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

describe("readTurnstileSiteKey", () => {
  it("returns null when nothing is configured, so the challenge is off", () => {
    expect(readTurnstileSiteKey({})).toBeNull();
    expect(readTurnstileSiteKey({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "" })).toBeNull();
    expect(readTurnstileSiteKey({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "   " })).toBeNull();
  });

  it("returns the key when it is configured", () => {
    const key = "0x4AAAAAAABkMYinukE8nzY";
    expect(readTurnstileSiteKey({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: key })).toBe(key);
    expect(readTurnstileSiteKey({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: `  ${key}  ` })).toBe(key);
  });

  it("refuses a key containing characters that would inject a CSP directive", () => {
    /*
      The key is interpolated into a policy header. A semicolon or a space would
      let an environment variable append directives of its choosing, which is the
      one route by which a "public" value could become a policy bypass.
    */
    for (const value of [
      "key'; script-src * '",
      "key; frame-src *",
      "key with space",
      "key\"onload=\"alert(1)",
      "key\nframe-src *",
      "k".repeat(129),
    ]) {
      expect(readTurnstileSiteKey({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: value }), value).toBeNull();
    }
  });

  it("drives isTurnstileEnabled from the same value, so the two cannot disagree", () => {
    expect(isTurnstileEnabled({})).toBe(false);
    expect(isTurnstileEnabled({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-key" })).toBe(true);
    expect(isTurnstileEnabled({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "bad;key" })).toBe(false);
  });

  it("reports a rendered-but-unenforced challenge as a misconfiguration", () => {
    // A widget the reader solves and the server never verifies is worse than no
    // widget: it costs the reader effort for no protection.
    expect(describeTurnstile({})).toEqual({ rendered: false, enforced: false, misconfigured: false });
    expect(
      describeTurnstile({
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-key",
        TURNSTILE_SECRET_KEY: "secret",
      }),
    ).toEqual({ rendered: true, enforced: true, misconfigured: false });
    expect(describeTurnstile({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-key" })).toEqual({
      rendered: true,
      enforced: false,
      misconfigured: true,
    });
    expect(describeTurnstile({ TURNSTILE_SECRET_KEY: "secret" })).toEqual({
      rendered: false,
      enforced: true,
      misconfigured: true,
    });
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
