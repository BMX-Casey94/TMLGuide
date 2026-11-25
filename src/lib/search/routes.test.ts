import { describe, expect, it } from "vitest";
import { KNOWN_ROUTES, isKnownRoute, splitHref, ticketsRoute } from "./routes";

describe("KNOWN_ROUTES", () => {
  it("lists every route the brief names, and nothing else", () => {
    expect([...KNOWN_ROUTES]).toEqual([
      "/",
      "/guides",
      "/guides/tickets",
      "/guides/tickets?edition=belgium",
      "/guides/tickets?edition=winter",
      "/guides/tickets?edition=brasil",
      "/guides/tickets?category=festival-tickets",
      "/guides/tickets?category=dreamville",
      "/guides/tickets?category=montagoe",
      "/guides/tickets?edition=winter&category=festival-tickets",
      "/guides/tickets?edition=brasil&category=festival-tickets",
      "/guides/tickets?edition=brasil&category=dreamville",
      "/tools",
      "/tools/budget",
      "/tools/pearls",
      "/tools/sale-timeline",
      "/tools/journey",
      "/tools/packing",
      "/tools/my-trip",
      "/tools/maps",
      "/tools/winter-timer",
      "/community",
      "/radio",
      "/about",
      "/accessibility",
    ]);
  });

  it("holds no duplicates", () => {
    expect(new Set(KNOWN_ROUTES).size).toBe(KNOWN_ROUTES.length);
  });

  it("starts every route with a single slash", () => {
    for (const route of KNOWN_ROUTES) {
      expect(route.startsWith("/"), route).toBe(true);
      expect(route.startsWith("//"), route).toBe(false);
    }
  });

  it("carries no trailing slash except the root", () => {
    for (const route of KNOWN_ROUTES) {
      if (route === "/") continue;
      expect(route.endsWith("/"), route).toBe(false);
    }
  });
});

describe("isKnownRoute", () => {
  it("accepts every listed route", () => {
    for (const route of KNOWN_ROUTES) {
      expect(isKnownRoute(route), route).toBe(true);
    }
  });

  it.each([
    ["an unlisted page", "/guides/dreamville"],
    ["the kit page", "/kit"],
    ["a typo", "/gudies"],
    ["a locale prefix", "/fr/guides"],
    ["an external URL", "https://www.tomorrowland.com/"],
    ["a protocol-relative URL", "//evil.example/guides"],
    ["a javascript URL", "javascript:alert(1)"],
    ["a data URL", "data:text/html,<script>alert(1)</script>"],
    ["an empty string", ""],
    ["a bare hash", "#main"],
    ["a query on a route with none", "/guides?edition=winter"],
    ["an unknown edition", "/guides/tickets?edition=belgiumx"],
  ])("refuses %s", (_label, href) => {
    expect(isKnownRoute(href)).toBe(false);
  });
});

describe("isKnownRoute with an anchor", () => {
  it("accepts a known route plus a well-formed anchor", () => {
    expect(isKnownRoute("/community#partner-rent-a-tent")).toBe(true);
    expect(isKnownRoute("/guides#faq-be-re-entry")).toBe(true);
    expect(isKnownRoute("/tools/sale-timeline#sale-worldwide-ticket-sale")).toBe(true);
    expect(isKnownRoute("/#top")).toBe(true);
  });

  it("accepts an anchor on a route that already carries a query", () => {
    expect(isKnownRoute("/guides/tickets?edition=winter#ticket-belgium-2027-day-pass")).toBe(true);
  });

  it.each([
    ["an unlisted base route", "/guides/dreamville#ticket-x"],
    ["an unknown edition with an anchor", "/guides/tickets?edition=belgiumx#ticket-x"],
    ["a second hash", "/community#a#b"],
    ["an empty anchor", "/community#"],
    ["an upper-case anchor", "/community#Partner"],
    ["an anchor with a space", "/community#a b"],
    ["an anchor that is a path traversal", "/community#../admin"],
    ["an anchor with a slash", "/community#a/b"],
    ["a percent-encoded anchor", "/community#%2F..%2Fadmin"],
    ["a query after the hash", "/community#a?b=c"],
    ["a fragment on an absolute URL", "https://evil.example/#a"],
    ["a fragment on a protocol-relative URL", "//evil.example/#a"],
    ["a javascript URL with a fragment", "javascript:alert(1)#a"],
    ["a backslash", "/community\\#a"],
    ["a tab inside the path", "/community\t#a"],
    ["a newline inside the anchor", "/community#a\nb"],
    ["a colon in the anchor", "/community#javascript:alert(1)"],
    ["a null byte", "/community\u0000#a"],
    ["an anchor longer than 80 characters", `/community#${"a".repeat(81)}`],
  ])("refuses %s", (_label, href) => {
    expect(isKnownRoute(href)).toBe(false);
  });

  it("refuses an href that is only a fragment", () => {
    expect(isKnownRoute("#partner-x")).toBe(false);
  });
});

describe("splitHref", () => {
  it("splits a route with no fragment", () => {
    expect(splitHref("/community")).toEqual({ path: "/community", anchor: null });
  });

  it("splits a route with a fragment", () => {
    expect(splitHref("/community#partner-x")).toEqual({
      path: "/community",
      anchor: "partner-x",
    });
  });

  it("keeps the query on the path", () => {
    expect(splitHref("/guides/tickets?edition=winter#ticket-x")).toEqual({
      path: "/guides/tickets?edition=winter",
      anchor: "ticket-x",
    });
  });

  it.each([
    ["a protocol-relative URL", "//evil.example"],
    ["an absolute URL", "https://evil.example/a"],
    ["a relative path", "community"],
    ["a bare fragment", "#a"],
    ["a backslash", "/a\\b"],
    ["a control character", "/a\u0007b"],
    ["an over-long href", `/${"a".repeat(3000)}`],
  ])("returns null for %s", (_label, href) => {
    expect(splitHref(href)).toBeNull();
  });

  it("returns null for a non-string at runtime", () => {
    // The type is a string, but data can arrive from anywhere.
    expect(splitHref(undefined as unknown as string)).toBeNull();
    expect(splitHref(null as unknown as string)).toBeNull();
  });
});

describe("ticketsRoute", () => {
  it("leaves Belgium on the bare page, its default view", () => {
    expect(ticketsRoute("belgium")).toBe("/guides/tickets");
  });

  it("addresses the other editions in the query string", () => {
    expect(ticketsRoute("winter")).toBe("/guides/tickets?edition=winter");
    expect(ticketsRoute("brasil")).toBe("/guides/tickets?edition=brasil");
  });

  it("addresses a category view, which is where a package card is rendered", () => {
    expect(ticketsRoute("belgium", "festival-tickets")).toBe(
      "/guides/tickets?category=festival-tickets",
    );
    expect(ticketsRoute("belgium", "dreamville")).toBe("/guides/tickets?category=dreamville");
    expect(ticketsRoute("belgium", "montagoe")).toBe("/guides/tickets?category=montagoe");
    expect(ticketsRoute("brasil", "dreamville")).toBe(
      "/guides/tickets?edition=brasil&category=dreamville",
    );
  });

  it("keeps the page's own parameter order: edition, then category", () => {
    // The same shape `buildTicketHref` produces, so one view has one address.
    expect(ticketsRoute("winter", "festival-tickets")).toBe(
      "/guides/tickets?edition=winter&category=festival-tickets",
    );
    expect(ticketsRoute("brasil", "festival-tickets")).toBe(
      "/guides/tickets?edition=brasil&category=festival-tickets",
    );
  });

  it("omits the default edition, so Belgium keeps one canonical address", () => {
    for (const route of [ticketsRoute("belgium"), ticketsRoute("belgium", "dreamville")]) {
      expect(route).not.toContain("edition=");
    }
  });

  it("only ever returns a route on the whitelist", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      expect(isKnownRoute(ticketsRoute(edition)), edition).toBe(true);
    }
  });

  it("only ever returns a category route on the whitelist", () => {
    const views = [
      ["belgium", "festival-tickets"],
      ["belgium", "dreamville"],
      ["belgium", "montagoe"],
      ["winter", "festival-tickets"],
      ["brasil", "festival-tickets"],
      ["brasil", "dreamville"],
    ] as const;

    for (const [edition, category] of views) {
      const route = ticketsRoute(edition, category);
      expect(isKnownRoute(route), route).toBe(true);
      expect(KNOWN_ROUTES, route).toContain(route);
    }
  });

  it("refuses a category view the site does not serve, rather than link the grid", () => {
    // Winter publishes no DreamVille package and no Montagoe lodge, so there is
    // no such view to land on. A link there would render the category grid and
    // leave the target missing, which is the bug this function prevents.
    expect(() => ticketsRoute("winter", "dreamville")).toThrow(/winter/);
    expect(() => ticketsRoute("winter", "montagoe")).toThrow(/winter/);
    expect(() => ticketsRoute("brasil", "montagoe")).toThrow(/brasil/);
  });
});
