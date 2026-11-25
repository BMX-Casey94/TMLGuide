/**
 * Tests for the origin check and the origin allow-list.
 *
 * A CSRF check is only worth having if it fails closed, so every case where the
 * headers are missing, malformed or forged is tested alongside the happy path.
 */

import { describe, expect, it } from "vitest";
import {
  isAllowedOrigin,
  isMutatingMethod,
  MUTATING_METHODS,
  normaliseOrigin,
} from "./origin";
import { getAllowedOrigins, LOCALHOST_ORIGIN } from "./allowed-origins";

const ALLOWED = ["https://tmlguide.com"];

function request(method: string, entries: Record<string, string>): {
  method: string;
  headers: { get(name: string): string | null };
} {
  const lower = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]));
  return { method, headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null } };
}

describe("normaliseOrigin", () => {
  it("returns a lower-cased origin for an https URL", () => {
    expect(normaliseOrigin("https://TMLGuide.com/path?x=1")).toBe("https://tmlguide.com");
  });

  it("keeps a non-default port", () => {
    expect(normaliseOrigin("http://localhost:3100/x")).toBe("http://localhost:3100");
  });

  it("drops the default port", () => {
    expect(normaliseOrigin("https://tmlguide.com:443/x")).toBe("https://tmlguide.com");
  });

  it("rejects the literal null origin, which a sandboxed frame sends", () => {
    expect(normaliseOrigin("null")).toBeNull();
  });

  it("rejects non-web schemes", () => {
    expect(normaliseOrigin("file:///etc/passwd")).toBeNull();
    expect(normaliseOrigin("chrome-extension://abc/x")).toBeNull();
    expect(normaliseOrigin("data:text/html,x")).toBeNull();
  });

  it("rejects malformed and relative values", () => {
    expect(normaliseOrigin("")).toBeNull();
    expect(normaliseOrigin("   ")).toBeNull();
    expect(normaliseOrigin("/relative")).toBeNull();
    expect(normaliseOrigin("tmlguide.com")).toBeNull();
  });

  it("handles an IPv6 literal", () => {
    expect(normaliseOrigin("http://[::1]:3000/x")).toBe("http://[::1]:3000");
  });
});

describe("isMutatingMethod", () => {
  it("treats the writing methods as mutating", () => {
    for (const method of MUTATING_METHODS) expect(isMutatingMethod(method)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isMutatingMethod("post")).toBe(true);
    expect(isMutatingMethod("Delete")).toBe(true);
  });

  it("exempts read-only methods", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) expect(isMutatingMethod(method)).toBe(false);
  });
});

describe("isAllowedOrigin", () => {
  it("always allows a read-only method", () => {
    expect(isAllowedOrigin(request("GET", {}), ALLOWED)).toBe(true);
    expect(isAllowedOrigin(request("HEAD", { origin: "https://evil.example" }), ALLOWED)).toBe(true);
  });

  it("allows a mutating request from an allowed origin", () => {
    expect(isAllowedOrigin(request("POST", { origin: "https://tmlguide.com" }), ALLOWED)).toBe(true);
  });

  it("rejects a mutating request from a foreign origin", () => {
    expect(isAllowedOrigin(request("POST", { origin: "https://evil.example" }), ALLOWED)).toBe(false);
  });

  it("rejects a look-alike origin", () => {
    // The classic near miss: a subdomain suffix that a naive `endsWith` allows.
    expect(isAllowedOrigin(request("POST", { origin: "https://tmlguide.com.evil.example" }), ALLOWED)).toBe(false);
    expect(isAllowedOrigin(request("POST", { origin: "https://evil-tmlguide.com" }), ALLOWED)).toBe(false);
  });

  it("rejects a schemeless origin", () => {
    expect(isAllowedOrigin(request("POST", { origin: "tmlguide.com" }), ALLOWED)).toBe(false);
  });

  it("prefers Origin and rejects even when Referer looks fine", () => {
    // A foreign Origin with a same-site Referer is a forgery attempt: Origin is
    // the header the browser sets, so it is the one that decides.
    const result = isAllowedOrigin(
      request("POST", { origin: "https://evil.example", referer: "https://tmlguide.com/page" }),
      ALLOWED,
    );
    expect(result).toBe(false);
  });

  it("falls back to Referer when Origin is absent", () => {
    expect(
      isAllowedOrigin(request("POST", { referer: "https://tmlguide.com/contact" }), ALLOWED),
    ).toBe(true);
  });

  it("rejects a foreign Referer when Origin is absent", () => {
    expect(
      isAllowedOrigin(request("POST", { referer: "https://evil.example/page" }), ALLOWED),
    ).toBe(false);
  });

  it("rejects a mutating request carrying neither header", () => {
    expect(isAllowedOrigin(request("POST", {}), ALLOWED)).toBe(false);
  });

  it("rejects everything when the allow-list is empty, rather than allowing by default", () => {
    expect(isAllowedOrigin(request("POST", { origin: "https://tmlguide.com" }), [])).toBe(false);
  });

  it("ignores an unusable entry in the allow-list without widening the rest", () => {
    const list = ["not a url", "https://tmlguide.com"];
    expect(isAllowedOrigin(request("POST", { origin: "https://tmlguide.com" }), list)).toBe(true);
    expect(isAllowedOrigin(request("POST", { origin: "https://evil.example" }), list)).toBe(false);
  });

  it("matches the allow-list regardless of case and trailing slash", () => {
    expect(
      isAllowedOrigin(request("POST", { origin: "https://TMLGUIDE.com/" }), ["https://tmlguide.com/"]),
    ).toBe(true);
  });

  it("treats an empty Origin header as absent and falls through to Referer", () => {
    expect(
      isAllowedOrigin(
        request("POST", { origin: "", referer: "https://tmlguide.com/x" }),
        ALLOWED,
      ),
    ).toBe(true);
  });

  it("rejects the null origin", () => {
    expect(isAllowedOrigin(request("POST", { origin: "null" }), ALLOWED)).toBe(false);
  });

  it("applies to every mutating method", () => {
    for (const method of MUTATING_METHODS) {
      expect(isAllowedOrigin(request(method, { origin: "https://evil.example" }), ALLOWED)).toBe(
        false,
      );
    }
  });
});

describe("getAllowedOrigins", () => {
  it("uses NEXT_PUBLIC_SITE_URL as the canonical origin", () => {
    const origins = getAllowedOrigins({
      NEXT_PUBLIC_SITE_URL: "https://tmlguide.com",
      NODE_ENV: "production",
    });
    expect(origins).toContain("https://tmlguide.com");
  });

  it("reduces a site URL with a path to its origin", () => {
    const origins = getAllowedOrigins({
      NEXT_PUBLIC_SITE_URL: "https://tmlguide.com/some/path",
      NODE_ENV: "production",
    });
    expect(origins).toEqual(["https://tmlguide.com"]);
  });

  it("does not allow localhost in production", () => {
    const origins = getAllowedOrigins({ NODE_ENV: "production" });
    expect(origins.some((origin) => origin.includes("localhost"))).toBe(false);
    expect(origins.some((origin) => origin.includes("127.0.0.1"))).toBe(false);
  });

  it("allows the loopback origins outside production", () => {
    const origins = getAllowedOrigins({ NODE_ENV: "development" });
    expect(origins).toContain(LOCALHOST_ORIGIN);
    expect(origins).toContain("http://127.0.0.1:3000");
    expect(origins).toContain("http://localhost:3100");
  });

  it("uses VERCEL_URL when no canonical URL is set", () => {
    const origins = getAllowedOrigins({
      VERCEL_URL: "tmlguide-git-main-team.vercel.app",
      NODE_ENV: "production",
    });
    expect(origins).toContain("https://tmlguide-git-main-team.vercel.app");
  });

  it("prefers the canonical URL over VERCEL_URL instead of accepting both", () => {
    const origins = getAllowedOrigins({
      NEXT_PUBLIC_SITE_URL: "https://tmlguide.com",
      VERCEL_URL: "tmlguide-preview.vercel.app",
      NODE_ENV: "production",
    });
    expect(origins).toEqual(["https://tmlguide.com"]);
  });

  it("skips a malformed site URL instead of throwing", () => {
    expect(() =>
      getAllowedOrigins({ NEXT_PUBLIC_SITE_URL: "not a url", NODE_ENV: "production" }),
    ).not.toThrow();
    expect(getAllowedOrigins({ NEXT_PUBLIC_SITE_URL: "not a url", NODE_ENV: "production" })).toEqual(
      [],
    );
  });

  it("never returns duplicates", () => {
    const origins = getAllowedOrigins({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NODE_ENV: "development",
    });
    expect(new Set(origins).size).toBe(origins.length);
  });

  it("produces a list that accepts the configured origin and rejects a foreign one", () => {
    const origins = getAllowedOrigins({ NEXT_PUBLIC_SITE_URL: "https://tmlguide.com", NODE_ENV: "production" });
    expect(isAllowedOrigin(request("POST", { origin: "https://tmlguide.com" }), origins)).toBe(true);
    expect(isAllowedOrigin(request("POST", { origin: "https://evil.example" }), origins)).toBe(false);
  });
});
