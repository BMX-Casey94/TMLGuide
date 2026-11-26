// @vitest-environment node
import type { Metadata } from "next";
import { describe, expect, it } from "vitest";

import { EXCLUDED_ROUTES, sitemapRoutes } from "@/lib/seo/routes";

/**
 * Metadata coverage across every page the site publishes.
 *
 * A page without a title or description is a page a search engine has to invent
 * a snippet for, and a page without a canonical is a page that can be indexed
 * under several addresses. The tables below import each route module's own
 * `metadata` export, so the assertion is against the object Next renders rather
 * than against a copy of it.
 *
 * Dynamic routes (`/guides/[edition]`, `/guides/[edition]/[chapter]`) are
 * covered by their own page tests, which call `generateMetadata` with real
 * params; importing a function that needs params here would assert nothing.
 */

interface PageUnderTest {
  readonly path: string;
  readonly metadata: Metadata;
}

/** A loader for one route module's metadata export. */
type PageModule = { readonly metadata: Metadata };

async function metadataFor(path: string, loader: () => Promise<PageModule>): Promise<PageUnderTest> {
  const { metadata } = await loader();
  return { path, metadata };
}

const PUBLIC_PAGES = async (): Promise<readonly PageUnderTest[]> =>
  Promise.all([
    metadataFor("/", () => import("@/app/page")),
    metadataFor("/guides", () => import("@/app/guides/page")),
    metadataFor("/guides/tickets", () => import("@/app/guides/tickets/page")),
    metadataFor("/tools", () => import("@/app/tools/page")),
    metadataFor("/tools/budget", () => import("@/app/tools/budget/page")),
    metadataFor("/tools/pearls", () => import("@/app/tools/pearls/page")),
    metadataFor("/tools/sale-timeline", () => import("@/app/tools/sale-timeline/page")),
    metadataFor("/tools/journey", () => import("@/app/tools/journey/page")),
    metadataFor("/tools/packing", () => import("@/app/tools/packing/page")),
    metadataFor("/tools/my-trip", () => import("@/app/tools/my-trip/page")),
    metadataFor("/tools/maps", () => import("@/app/tools/maps/page")),
    metadataFor("/tools/winter-timer", () => import("@/app/tools/winter-timer/page")),
    metadataFor("/ask", () => import("@/app/ask/page")),
    metadataFor("/community", () => import("@/app/community/page")),
    metadataFor("/community/news", () => import("@/app/community/news/page")),
    metadataFor("/radio", () => import("@/app/radio/page")),
    metadataFor("/about", () => import("@/app/about/page")),
    metadataFor("/accessibility", () => import("@/app/accessibility/page")),
    metadataFor("/more", () => import("@/app/more/page")),
  ]);

/** Pages that must never be indexed, with the metadata each one declares. */
const NON_INDEXED_PAGES = async (): Promise<readonly PageUnderTest[]> =>
  Promise.all([
    metadataFor("/admin", () => import("@/app/admin/page")),
    metadataFor("/offline", () => import("@/app/offline/page")),
    metadataFor("/kit", () => import("@/app/kit/page")),
  ]);

describe("public page metadata", () => {
  it("covers every route the sitemap lists", async () => {
    const covered = new Set((await PUBLIC_PAGES()).map((page) => page.path));
    const listed = sitemapRoutes()
      .map((route) => route.path)
      // Hubs and chapters are asserted by their own page tests.
      .filter((path) => !/^\/guides\/(belgium|winter|brasil|general)(\/|$)/.test(path));

    const missing = listed.filter((path) => !covered.has(path));
    expect(missing).toEqual([]);
  });

  it("puts every public page in the sitemap", async () => {
    // The other direction of the check above: a page with good metadata that the
    // sitemap forgets is a page a crawler has to find by following links.
    const listed = new Set(sitemapRoutes().map((route) => route.path));
    const absent = (await PUBLIC_PAGES())
      .map((page) => page.path)
      .filter((path) => !listed.has(path));

    expect(absent).toEqual([]);
  });

  it("gives every public page a non-empty title", async () => {
    for (const page of await PUBLIC_PAGES()) {
      expect(typeof page.metadata.title, page.path).toBe("string");
      expect(String(page.metadata.title).trim().length, page.path).toBeGreaterThan(0);
    }
  });

  it("gives every public page a description long enough to be a snippet", async () => {
    for (const page of await PUBLIC_PAGES()) {
      const description = page.metadata.description;
      expect(typeof description, page.path).toBe("string");
      // Google truncates around 155-160 characters; a shorter one wastes the
      // snippet, and an empty one lets the crawler invent it.
      expect(String(description).trim().length, page.path).toBeGreaterThan(50);
      expect(String(description).length, page.path).toBeLessThanOrEqual(320);
    }
  });

  it("gives every public page a canonical URL matching its own path", async () => {
    for (const page of await PUBLIC_PAGES()) {
      const canonical = page.metadata.alternates?.canonical;
      expect(canonical, page.path).toBe(page.path === "/" ? "/" : page.path);
    }
  });

  it("does not noindex a public page", async () => {
    for (const page of await PUBLIC_PAGES()) {
      expect(page.metadata.robots, page.path).toBeUndefined();
    }
  });

  it("gives every public page a complete Open Graph block", async () => {
    /*
      Next replaces `openGraph` wholesale rather than merging it, so a page that
      declares one must declare all of it. Twelve pages declared none at all,
      which meant a link shared into WhatsApp or Discord had no preview of its
      own; this is the assertion that keeps that from coming back.
    */
    for (const page of await PUBLIC_PAGES()) {
      const openGraph = page.metadata.openGraph as
        | { title?: string; description?: string; url?: unknown; siteName?: string; locale?: string }
        | undefined;

      expect(openGraph, page.path).toBeDefined();
      expect(openGraph?.title, page.path).toBeTruthy();
      expect(openGraph?.description, page.path).toBeTruthy();
      expect(openGraph?.siteName, page.path).toBe("TMLGuide");
      expect(openGraph?.locale, page.path).toBe("en_GB");
      expect(openGraph?.url, page.path).toBe(page.path);
    }
  });

  it("gives every public page a Twitter card", async () => {
    for (const page of await PUBLIC_PAGES()) {
      const twitter = page.metadata.twitter as
        | { card?: string; title?: string; description?: string }
        | undefined;

      expect(twitter?.card, page.path).toBe("summary");
      expect(twitter?.title, page.path).toBeTruthy();
      expect(twitter?.description, page.path).toBeTruthy();
    }
  });

  it("gives every public page a title no other public page uses", async () => {
    /*
      Two pages sharing a `<title>` compete for one result, and a search engine
      has to choose which to show. Six pairs did this before the hardening pass:
      Belgium/Winter "Accommodation", Belgium/Brasil "DreamVille",
      Brasil/Winter "Getting there", the two radio pages, the two ticket pages,
      and the Belgium overview chapter against its own hub.
    */
    const seen = new Map<string, string[]>();
    for (const page of await PUBLIC_PAGES()) {
      const title = String(page.metadata.title);
      seen.set(title, [...(seen.get(title) ?? []), page.path]);
    }

    const duplicated = [...seen.entries()].filter(([, paths]) => paths.length > 1);
    expect(duplicated).toEqual([]);
  });
});

describe("non-indexed page metadata", () => {
  it("marks every private page noindex and nofollow", async () => {
    for (const page of await NON_INDEXED_PAGES()) {
      expect(page.metadata.robots, page.path).toMatchObject({ index: false, follow: false });
    }
  });

  it("keeps every private page out of the sitemap", async () => {
    const listed = new Set(sitemapRoutes().map((route) => route.path));
    for (const page of await NON_INDEXED_PAGES()) {
      expect(listed.has(page.path), page.path).toBe(false);
    }
  });

  it("names every private page in the exclusion list, with a reason", async () => {
    for (const page of await NON_INDEXED_PAGES()) {
      expect(EXCLUDED_ROUTES[page.path], page.path).toBeTruthy();
    }
  });
});

describe("the private routes robots.txt must also refuse", () => {
  it("has a disallow entry for admin and the API", async () => {
    const robots = (await import("@/app/robots")).default;
    const rule = robots().rules;
    if (Array.isArray(rule)) throw new Error("robots() publishes a rule list");
    const disallowed = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow ?? ""];

    expect(disallowed).toContain("/admin");
    expect(disallowed).toContain("/api/");
  });
});
