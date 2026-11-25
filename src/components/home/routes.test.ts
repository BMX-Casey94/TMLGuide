// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import {
  KNOWN_ROUTES,
  SITE_URL_FALLBACK,
  absoluteUrl,
  isExternalHref,
  isKnownRoute,
  routePath,
} from "./routes";

describe("KNOWN_ROUTES", () => {
  it("matches the set of destinations the brief names", () => {
    expect([...KNOWN_ROUTES].sort()).toEqual(
      [
        "/",
        "/about",
        "/community",
        "/community#partners",
        "/guides",
        "/guides/tickets",
        "/radio",
        "/tools",
        "/tools/budget",
        "/tools/pearls",
        "/tools/sale-timeline",
      ].sort(),
    );
  });

  it("lists no path twice", () => {
    expect(new Set(KNOWN_ROUTES).size).toBe(KNOWN_ROUTES.length);
  });
});

describe("routePath", () => {
  it("drops a fragment, because it does not change which page is served", () => {
    expect(routePath("/community#partners")).toBe("/community");
  });

  it("drops a query string", () => {
    expect(routePath("/guides/tickets?edition=brasil")).toBe("/guides/tickets");
  });

  it("drops both, in either order", () => {
    expect(routePath("/guides/tickets?edition=winter#prices")).toBe("/guides/tickets");
  });

  it("keeps a bare path unchanged", () => {
    expect(routePath("/about")).toBe("/about");
  });
});

describe("isKnownRoute", () => {
  it("accepts every listed route", () => {
    for (const route of KNOWN_ROUTES) {
      expect(isKnownRoute(route)).toBe(true);
    }
  });

  it("accepts the edition-selected ticket guide the edition cards link to", () => {
    expect(isKnownRoute("/guides/tickets?edition=belgium")).toBe(true);
    expect(isKnownRoute("/guides/tickets?edition=winter")).toBe(true);
    expect(isKnownRoute("/guides/tickets?edition=brasil")).toBe(true);
  });

  it("accepts the tool pages that exist", () => {
    expect(isKnownRoute("/tools/sale-timeline")).toBe(true);
    expect(isKnownRoute("/tools/budget")).toBe(true);
    expect(isKnownRoute("/tools/pearls")).toBe(true);
  });

  it("rejects a tool path that is not a page, rather than accepting any /tools/ prefix", () => {
    // These two were published by the home page and 404'd: the real pages are
    // /tools/budget and /tools/pearls. A wildcard under /tools/ is what let them
    // through, which is why there is no wildcard any more.
    expect(isKnownRoute("/tools/budget-calculator")).toBe(false);
    expect(isKnownRoute("/tools/pearl-calculator")).toBe(false);
    expect(isKnownRoute("/tools/some-future-tool")).toBe(false);
  });

  it("rejects a route that only looks similar", () => {
    expect(isKnownRoute("/guide")).toBe(false);
    expect(isKnownRoute("/abouts")).toBe(false);
    expect(isKnownRoute("/toolbox")).toBe(false);
  });

  it("rejects the bare tools prefix, which is a page only without the slash", () => {
    expect(isKnownRoute("/tools/")).toBe(false);
    expect(isKnownRoute("/tools")).toBe(true);
  });

  it("rejects an internal path nobody has planned", () => {
    expect(isKnownRoute("/pricing")).toBe(false);
    expect(isKnownRoute("/guide/tickets")).toBe(false);
  });

  it("rejects an external URL, which is checked separately", () => {
    expect(isKnownRoute("https://belgium.tomorrowland.com/en/")).toBe(false);
    expect(isKnownRoute("mailto:someone@example.com")).toBe(false);
    expect(isKnownRoute("#main")).toBe(false);
  });
});

describe("isExternalHref", () => {
  it("recognises http and https links", () => {
    expect(isExternalHref("https://belgium.tomorrowland.com/en/")).toBe(true);
    expect(isExternalHref("http://example.com")).toBe(true);
  });

  it("does not mistake a site path for an external link", () => {
    expect(isExternalHref("/about")).toBe(false);
    expect(isExternalHref("mailto:someone@example.com")).toBe(false);
    expect(isExternalHref("tel:+441234567890")).toBe(false);
  });
});

describe("absoluteUrl", () => {
  /*
    These run with `NEXT_PUBLIC_SITE_URL` explicitly unset, so the assertion is
    about the fallback rather than about whatever the machine happens to export.
    A test that passes only while the variable is absent fails the moment someone
    runs the suite in a shell that has it, which is what happened here.
  */
  const original = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  function withoutConfiguredOrigin() {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  }

  it("resolves a page path against the configured origin", () => {
    withoutConfiguredOrigin();
    expect(absoluteUrl("/about")).toBe(`${SITE_URL_FALLBACK}/about`);
  });

  it("falls back to the same origin the root layout uses for metadataBase", () => {
    // The layout and this module both read `@/lib/seo/site`, so a canonical URL
    // built here and `metadataBase` cannot disagree about the site's origin.
    expect(SITE_URL_FALLBACK).toBe("http://localhost:3000");
  });

  it("treats the root as one trailing slash, not two", () => {
    withoutConfiguredOrigin();
    expect(absoluteUrl("/")).toBe(`${SITE_URL_FALLBACK}/`);
  });

  it("adds a leading slash to a path written without one", () => {
    withoutConfiguredOrigin();
    expect(absoluteUrl("about")).toBe(`${SITE_URL_FALLBACK}/about`);
  });

  it("uses the configured origin when there is one", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://tml.guide";
    expect(absoluteUrl("/about")).toBe("https://tml.guide/about");
  });
});
