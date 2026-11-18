// @vitest-environment node
import { describe, expect, it } from "vitest";

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
        "/tools/budget-calculator",
        "/tools/pearl-calculator",
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

  it("accepts a tool under the tools family", () => {
    expect(isKnownRoute("/tools/sale-timeline")).toBe(true);
    expect(isKnownRoute("/tools/some-future-tool")).toBe(true);
  });

  it("rejects a route that only looks similar", () => {
    expect(isKnownRoute("/guide")).toBe(false);
    expect(isKnownRoute("/abouts")).toBe(false);
    expect(isKnownRoute("/toolbox")).toBe(false);
  });

  it("rejects the bare family prefix, which is not a page on its own", () => {
    expect(isKnownRoute("/tools/")).toBe(false);
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
  it("resolves a page path against the configured origin", () => {
    expect(absoluteUrl("/about")).toBe(`${SITE_URL_FALLBACK}/about`);
  });

  it("falls back to the same origin the root layout uses for metadataBase", () => {
    // The layout's fallback is http://localhost:3000; a canonical URL built here
    // must agree with it or the two would disagree about the site's origin.
    expect(SITE_URL_FALLBACK).toBe("http://localhost:3000");
  });

  it("treats the root as one trailing slash, not two", () => {
    expect(absoluteUrl("/")).toBe(`${SITE_URL_FALLBACK}/`);
  });

  it("adds a leading slash to a path written without one", () => {
    expect(absoluteUrl("about")).toBe(`${SITE_URL_FALLBACK}/about`);
  });
});
