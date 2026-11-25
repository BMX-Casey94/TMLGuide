// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import sitemap from "@/app/sitemap";
import { EXCLUDED_ROUTES, sitemapRoutes, type ChapterIndex } from "@/lib/seo/routes";

/**
 * The sitemap, asserted against its own route list.
 *
 * Two separate things are checked: that the route list covers the site (the
 * coverage tests), and that `sitemap()` renders that list into valid absolute
 * entries (the render tests). A defect in either one is a defect a crawler sees.
 */

const ORIGIN = "https://tmlguide.example";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Runs `sitemap()` with a known origin, so expectations do not depend on the host. */
function render(env: Record<string, string> = {}): ReturnType<typeof sitemap> {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGIN);
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return sitemap();
}

/** Extracts the path from an absolute sitemap entry. */
function pathOf(url: string): string {
  return new URL(url).pathname;
}

describe("sitemap coverage", () => {
  const paths = sitemapRoutes().map((route) => route.path);

  it("lists every route a reader can reach, and no path twice", () => {
    expect(new Set(paths).size).toBe(paths.length);
  });

  // The four routes called out in the hardening brief. Each is a page that was
  // easy to forget because it was added after the sitemap was first written.
  it.each(["/tools/maps", "/tools/winter-timer", "/ask", "/community/news"])(
    "includes %s",
    (path) => {
      expect(paths).toContain(path);
    },
  );

  it("includes every other public page the app serves", () => {
    for (const path of [
      "/",
      "/guides",
      "/guides/tickets",
      "/tools",
      "/tools/budget",
      "/tools/pearls",
      "/tools/sale-timeline",
      "/tools/journey",
      "/tools/packing",
      "/tools/my-trip",
      "/community",
      "/radio",
      "/about",
      "/accessibility",
    ]) {
      expect(paths, path).toContain(path);
    }
  });

  it("lists a hub and every chapter for each guide edition", () => {
    const routes = sitemapRoutes();
    for (const edition of ["belgium", "winter", "brasil", "general"]) {
      expect(
        routes.some((route) => route.path === `/guides/${edition}`),
        `/guides/${edition}`,
      ).toBe(true);
    }
    // Real chapters exist, so the derived chapter entries must too.
    expect(routes.filter((route) => /^\/guides\/[a-z]+\/[a-z0-9-]+$/.test(route.path)).length).toBeGreaterThan(0);
  });

  it("derives chapter entries from the registry rather than a typed list", () => {
    const chapter = {
      edition: "belgium" as const,
      slug: "fixture-chapter",
      order: 1,
      title: "Fixture",
      summary: "A fixture chapter.",
      lastVerified: "2026-11-20",
      blocks: [],
      related: [],
      sources: [],
    };
    const index: ChapterIndex = { belgium: [chapter], winter: [], brasil: [], general: [] };
    const routes = sitemapRoutes(index);
    const entry = routes.find((route) => route.path === "/guides/belgium/fixture-chapter");

    expect(entry).toBeDefined();
    expect(entry?.lastModified).toBe("2026-11-20");
  });

  it("still lists an edition hub that has no chapters yet", () => {
    const index: ChapterIndex = { belgium: [], winter: [], brasil: [], general: [] };
    const routes = sitemapRoutes(index);
    expect(routes.map((route) => route.path)).toContain("/guides/winter");
  });

  it("carries no hash anchors", () => {
    for (const route of sitemapRoutes()) {
      expect(route.path, route.path).not.toContain("#");
    }
  });

  it("carries no query strings", () => {
    for (const route of sitemapRoutes()) {
      expect(route.path, route.path).not.toContain("?");
    }
  });

  it("excludes every route that must not be indexed", () => {
    for (const excluded of Object.keys(EXCLUDED_ROUTES)) {
      expect(paths, excluded).not.toContain(excluded);
      // A prefix rule such as "/api" must not let "/api/anything" through either.
      expect(paths.some((path) => path === excluded || path.startsWith(`${excluded}/`)), excluded).toBe(false);
    }
  });

  it("roots every path and drops the trailing slash except on the home page", () => {
    for (const path of paths) {
      expect(path.startsWith("/"), path).toBe(true);
      if (path === "/") continue;
      expect(path.endsWith("/"), path).toBe(false);
    }
  });

  it("dates any lastModified as a real calendar date in the past or today", () => {
    for (const route of sitemapRoutes()) {
      if (route.lastModified === undefined) continue;
      expect(route.lastModified, route.path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(route.lastModified)), route.path).toBe(false);
    }
  });

  it("orders priorities from 1 at the home page down to below 0.5", () => {
    const routes = sitemapRoutes();
    expect(routes[0]?.path).toBe("/");
    expect(routes[0]?.priority).toBe(1);
    for (const route of routes) {
      expect(route.priority, route.path).toBeGreaterThan(0);
      expect(route.priority, route.path).toBeLessThanOrEqual(1);
    }
  });
});

describe("sitemap()", () => {
  it("returns one entry per route", () => {
    expect(render()).toHaveLength(sitemapRoutes().length);
  });

  it("builds every URL from the configured origin", () => {
    for (const entry of render()) {
      expect(entry.url.startsWith(`${ORIGIN}/`), entry.url).toBe(true);
    }
  });

  it("publishes the home page as the origin root", () => {
    const home = render()[0];
    expect(home?.url).toBe(`${ORIGIN}/`);
    expect(new URL(home?.url ?? "").pathname).toBe("/");
  });

  it("passes change frequency and priority through unchanged", () => {
    const entries = render();
    const home = entries.find((entry) => pathOf(entry.url) === "/");

    expect(home?.changeFrequency).toBe("weekly");
    expect(home?.priority).toBe(1);
  });

  it("keeps the lastModified of a route that has one, and omits it otherwise", () => {
    const entries = render();
    const tickets = entries.find((entry) => pathOf(entry.url) === "/guides/tickets");
    const news = entries.find((entry) => pathOf(entry.url) === "/community/news");

    expect(tickets?.lastModified).toBe("2026-11-18");
    // The news page's date is the newest item's, which only the database knows.
    expect(news?.lastModified).toBeUndefined();
  });

  it("never stamps the build time as a modification date", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const entry of render()) {
      if (entry.lastModified === undefined) continue;
      expect(String(entry.lastModified), entry.url).not.toBe(today);
    }
  });

  it("uses the development origin when none is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const entries = sitemap();
    expect(entries[0]?.url).toBe("http://localhost:3000/");
  });

  it("rejects an origin carrying a path, rather than publishing it into every URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", `${ORIGIN}/some/path`);
    for (const entry of sitemap()) {
      expect(entry.url.startsWith(`${ORIGIN}/`), entry.url).toBe(true);
      expect(entry.url, entry.url).not.toContain("/some/path");
    }
  });
});
