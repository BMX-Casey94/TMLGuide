import { describe, expect, it } from "vitest";
import { KNOWN_ROUTES, isKnownRoute, ticketsRoute } from "./routes";

describe("KNOWN_ROUTES", () => {
  it("lists every route the brief names, and nothing else", () => {
    expect([...KNOWN_ROUTES]).toEqual([
      "/",
      "/guides",
      "/guides/tickets",
      "/guides/tickets?edition=belgium",
      "/guides/tickets?edition=winter",
      "/guides/tickets?edition=brasil",
      "/tools",
      "/tools/budget",
      "/tools/pearls",
      "/tools/sale-timeline",
      "/community",
      "/radio",
      "/about",
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
    ["a fragment", "/guides#top"],
  ])("refuses %s", (_label, href) => {
    expect(isKnownRoute(href)).toBe(false);
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

  it("only ever returns a route on the whitelist", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      expect(isKnownRoute(ticketsRoute(edition)), edition).toBe(true);
    }
  });
});
