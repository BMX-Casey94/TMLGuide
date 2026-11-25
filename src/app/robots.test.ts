// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "@/app/robots";

const ORIGIN = "https://tmlguide.example";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Runs `robots()` with a known origin. */
function render(): ReturnType<typeof robots> {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGIN);
  return robots();
}

/** The single rule the file publishes, narrowed from the union Next allows. */
function rule() {
  const result = render().rules;
  if (Array.isArray(result)) throw new Error("robots() publishes a rule list, not one rule");
  return result;
}

/** `disallow` as an array, whatever shape the rule gives it. */
function disallowed(): string[] {
  const value = rule().disallow ?? [];
  return Array.isArray(value) ? value : [value];
}

describe("robots()", () => {
  it("applies to every crawler", () => {
    expect(rule().userAgent).toBe("*");
  });

  it("allows the public site", () => {
    expect(rule().allow).toBe("/");
  });

  it("disallows the admin console", () => {
    expect(disallowed()).toContain("/admin");
  });

  it("disallows the API, as a prefix so every route handler is covered", () => {
    const entries = disallowed();
    expect(entries).toContain("/api/");
    // "/api" without the slash would not cover "/api/ask" in every crawler's
    // matching, so the trailing slash is the form that is relied on.
    expect(entries.some((entry) => entry === "/api/ask" || entry === "/api")).toBe(false);
  });

  it("disallows the offline fallback", () => {
    expect(disallowed()).toContain("/offline");
  });

  it("does not disallow any public page", () => {
    const blocked = disallowed();
    for (const path of [
      "/",
      "/guides",
      "/guides/tickets",
      "/tools",
      "/tools/maps",
      "/tools/winter-timer",
      "/community",
      "/community/news",
      "/radio",
      "/about",
      "/accessibility",
      "/ask",
    ]) {
      expect(blocked, path).not.toContain(path);
    }
  });

  it("does not advertise the internal UI kit", () => {
    // `noindex, nofollow` in its own metadata is the control; naming it in a
    // public file adds nothing a crawler needs and publishes the path.
    expect(disallowed()).not.toContain("/kit");
  });

  it("publishes the sitemap as an absolute URL on the configured origin", () => {
    expect(render().sitemap).toBe(`${ORIGIN}/sitemap.xml`);
  });

  it("falls back to the development origin when none is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(robots().sitemap).toBe("http://localhost:3000/sitemap.xml");
  });

  it("does not end the sitemap URL with a double slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", `${ORIGIN}/`);
    expect(robots().sitemap).toBe(`${ORIGIN}/sitemap.xml`);
  });
});
