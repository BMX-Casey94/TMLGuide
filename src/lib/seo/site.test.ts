// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { SITE_URL_FALLBACK, absoluteUrl, siteOrigin } from "./site";

/**
 * The canonical origin.
 *
 * Canonical tags, Open Graph URLs, JSON-LD, the sitemap and robots.txt all read
 * this one function, so a mistake here is a mistake on every page at once. The
 * cases below are the shapes an operator actually types into a deployment
 * variable.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe("siteOrigin", () => {
  it("returns a configured https origin unchanged", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://tml.guide" })).toBe("https://tml.guide");
  });

  it("trims surrounding whitespace, which a copied value often has", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "  https://tml.guide  " })).toBe("https://tml.guide");
  });

  it("drops a trailing slash", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://tml.guide/" })).toBe("https://tml.guide");
  });

  it("drops a path, rather than making it the base for every relative URL", () => {
    // `metadataBase: https://tml.guide/guides` would turn a canonical of "/about"
    // into "https://tml.guide/about" but a relative Open Graph URL into
    // "https://tml.guide/guides/og.png", which is the class of bug this stops.
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://tml.guide/guides" })).toBe("https://tml.guide");
  });

  it("drops a query string and a fragment", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://tml.guide/?utm=x#top" })).toBe("https://tml.guide");
  });

  it("keeps a non-default port", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://tml.guide:8443" })).toBe("https://tml.guide:8443");
  });

  it("accepts plain http only for loopback hosts", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100" })).toBe("http://127.0.0.1:3100");
  });

  it("falls back when a public origin is plain http", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "http://tml.guide" })).toBe(SITE_URL_FALLBACK);
  });

  it("falls back when the value is not a URL at all", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "tml.guide" })).toBe(SITE_URL_FALLBACK);
  });

  it("falls back when the value uses another scheme", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "ftp://tml.guide" })).toBe(SITE_URL_FALLBACK);
  });

  it("refuses credentials in the URL", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // A canonical containing a password would publish it in every page's head.
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://user:pass@tml.guide" })).toBe(SITE_URL_FALLBACK);
  });

  it("falls back when the value is missing", () => {
    expect(siteOrigin({})).toBe(SITE_URL_FALLBACK);
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "   " })).toBe(SITE_URL_FALLBACK);
  });

  it("reports a production misconfiguration once, not on every call", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    siteOrigin({ NEXT_PUBLIC_SITE_URL: "", NODE_ENV: "production" });
    siteOrigin({ NEXT_PUBLIC_SITE_URL: "", NODE_ENV: "production" });

    // One line naming the variable is what an operator acts on; a message per
    // reader of the module is what they learn to skim past.
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("stays quiet outside production, where the fallback is the normal case", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    siteOrigin({ NEXT_PUBLIC_SITE_URL: undefined, NODE_ENV: "development" });
    expect(error).not.toHaveBeenCalled();
  });
});

describe("absoluteUrl", () => {
  it("joins an origin and a rooted path", () => {
    expect(absoluteUrl("/about", "https://tml.guide")).toBe("https://tml.guide/about");
  });

  it("adds the missing leading slash rather than nesting the path", () => {
    expect(absoluteUrl("about", "https://tml.guide")).toBe("https://tml.guide/about");
  });

  it("treats the root as one trailing slash", () => {
    expect(absoluteUrl("/", "https://tml.guide")).toBe("https://tml.guide/");
  });

  it("does not double a trailing slash on the origin", () => {
    expect(absoluteUrl("/about", "https://tml.guide/")).toBe("https://tml.guide/about");
  });
});
