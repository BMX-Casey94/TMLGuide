/**
 * Tests for the legacy redirect table.
 *
 * `redirects()` in `next.config.ts` is matched *before* the filesystem, so this
 * table can break the live site in two ways that no type check would catch:
 *
 * - a source that is also a real page makes that page unreachable;
 * - a chain that returns to its own source makes the browser spin.
 *
 * Both are asserted against the application's actual route inventory, read from
 * `src/app` at test time rather than copied into a fixture. A fixture would drift:
 * the day someone adds `/news` as a real page, a copied route list would still say
 * the redirect is safe.
 */

// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LEGACY_LOCALES,
  LEGACY_LOCALE_REDIRECTS,
  LEGACY_PATH_REDIRECTS,
  legacyRedirects,
  type LegacyRedirect,
} from "./legacy-redirects";

const APP_DIR = join(import.meta.dirname, "..", "..", "app");

/** One route the application serves. */
interface LiveRoute {
  /** The pattern, as a request path: `/guides/[edition]/[chapter]`. */
  readonly pattern: string;
  /** True for `page.tsx`, false for `route.ts` (an API handler). */
  readonly isPage: boolean;
}

/**
 * Every route under `src/app`, derived from the file convention.
 *
 * Route groups — `(name)` — contribute no URL segment, which is why they are
 * dropped rather than kept.
 */
function liveRoutes(dir: string = APP_DIR): LiveRoute[] {
  const routes: LiveRoute[] = [];

  function walk(current: string, segments: string[]): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        const segment = entry.name.startsWith("(") && entry.name.endsWith(")") ? null : entry.name;
        walk(full, segment === null ? segments : [...segments, segment]);
      } else if (entry.name === "page.tsx" || entry.name === "route.ts") {
        routes.push({
          pattern: `/${segments.join("/")}`.replace(/\/$/, "") || "/",
          isPage: entry.name === "page.tsx",
        });
      }
    }
  }

  walk(dir, []);
  return routes;
}

/** True when `pattern` carries no dynamic segment, so it names exactly one path. */
function isStatic(pattern: string): boolean {
  return !pattern.includes("[");
}

/**
 * Matches a concrete request path against a route pattern.
 *
 * Only the segment shapes this app uses are supported: a literal, `[param]`, and
 * `[...catchAll]`. That is deliberate — a matcher broader than the router would
 * give false confidence.
 */
function matchesPattern(path: string, pattern: string): boolean {
  const pathSegments = path.split("/").filter((segment) => segment !== "");
  const patternSegments = pattern.split("/").filter((segment) => segment !== "");

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    if (patternSegment === undefined) return false;
    if (patternSegment.startsWith("[...")) return true;
    const pathSegment = pathSegments[index];
    if (pathSegment === undefined) return false;
    if (patternSegment.startsWith("[") && patternSegment.endsWith("]")) continue;
    if (patternSegment !== pathSegment) return false;
  }

  return pathSegments.length === patternSegments.length;
}

/** The path and fragment of a destination. */
function splitDestination(destination: string): { path: string; hash: string | null } {
  const hashAt = destination.indexOf("#");
  if (hashAt < 0) return { path: destination, hash: null };
  return { path: destination.slice(0, hashAt), hash: destination.slice(hashAt + 1) };
}

/**
 * Returns the destination for `rule` applied to `path`, or null when it does not
 * match.
 *
 * Supported segment shapes are exactly the ones this table uses: a literal,
 * `:param` (one segment), `:param*` (zero or more, to the end) and a trailing
 * `(a|b|c)` alternation. A matcher wider than the router would give false
 * confidence, so anything else is deliberately unsupported.
 */
function applyRule(rule: LegacyRedirect, path: string): string | null {
  const sourceSegments = rule.source.split("/").filter((segment) => segment !== "");
  const pathSegments = path.split("/").filter((segment) => segment !== "");
  const captures = new Map<string, string>();

  let consumed = 0;
  for (const sourceSegment of sourceSegments) {
    // `:path*` takes every remaining segment, including none of them.
    const star = /^:([A-Za-z]+)\*$/.exec(sourceSegment);
    if (star !== null) {
      captures.set(star[1] ?? "", pathSegments.slice(consumed).join("/"));
      consumed = pathSegments.length;
      continue;
    }

    const pathSegment = pathSegments[consumed];
    if (pathSegment === undefined) return null;

    // A bare alternation, `(es|fr)`, contributes nothing to the destination.
    const alternation = /^\((.+)\)$/.exec(sourceSegment);
    if (alternation !== null) {
      if (!(alternation[1] ?? "").split("|").includes(pathSegment)) return null;
      consumed += 1;
      continue;
    }

    // `:name` or `:name(a|b)`. The alternation restricts the value, and the name is
    // what the destination interpolates.
    const param = /^:([A-Za-z]+)(?:\((.+)\))?$/.exec(sourceSegment);
    if (param !== null) {
      if (param[2] !== undefined && !param[2].split("|").includes(pathSegment)) return null;
      captures.set(param[1] ?? "", pathSegment);
      consumed += 1;
      continue;
    }

    if (sourceSegment !== pathSegment) return null;
    consumed += 1;
  }

  // A pattern without `:path*` must consume the whole path.
  if (consumed !== pathSegments.length) return null;

  return rule.destination.replace(/:([A-Za-z]+)\*?/g, (whole, name: string) =>
    captures.get(name) ?? whole,
  );
}

/** The first rule that matches `path`, or null. */
function applyTable(
  table: readonly LegacyRedirect[],
  path: string,
): { rule: LegacyRedirect; to: string } | null {
  for (const rule of table) {
    const to = applyRule(rule, path);
    if (to !== null) return { rule, to };
  }
  return null;
}

const ROUTES = liveRoutes();
const STATIC_ROUTES = ROUTES.filter((route) => isStatic(route.pattern)).map((route) => route.pattern);
const TABLE = legacyRedirects();

describe("the table's shape", () => {
  it("finds the application's real routes", () => {
    // Guards the whole file: if the route walk broke, every assertion below would
    // pass vacuously against an empty list.
    expect(STATIC_ROUTES.length).toBeGreaterThan(15);
    expect(STATIC_ROUTES).toContain("/");
    expect(STATIC_ROUTES).toContain("/tools/budget");
    expect(STATIC_ROUTES).toContain("/community");
  });

  it("marks every rule permanent, so each is answered as 308", () => {
    for (const rule of TABLE) expect(rule.permanent, rule.source).toBe(true);
  });

  it("roots every source and destination, which a pattern match requires", () => {
    for (const rule of TABLE) {
      expect(rule.source.startsWith("/"), rule.source).toBe(true);
      expect(rule.destination.startsWith("/"), rule.destination).toBe(true);
      // A pattern segment written without its slash becomes a literal string and
      // can produce an infinite redirect, per Next's own documentation.
      expect(rule.source, `${rule.source} is not rooted`).toMatch(/^\//);
    }
  });

  it("carries no trailing slash on a source, which would duplicate its bare form", () => {
    for (const rule of TABLE) expect(rule.source.endsWith("/"), rule.source).toBe(false);
  });

  it("has no duplicate sources, where the second could never match", () => {
    const seen = new Set<string>();
    for (const rule of TABLE) {
      expect(seen.has(rule.source), rule.source).toBe(false);
      seen.add(rule.source);
    }
  });

  it("returns a fresh array, so a caller cannot mutate the table", () => {
    const first = legacyRedirects();
    first.pop();
    expect(legacyRedirects().length).toBe(TABLE.length);
  });
});

describe("shadowing", () => {
  /*
    A source that is also a static route makes that route unreachable, because
    `redirects()` is matched before the filesystem. A source that matches only a
    dynamic pattern is the opposite: `/guides/food-drinks` matches
    `/guides/[edition]`, and intercepting it is the whole point, since `food-drinks`
    is not an edition.
  */
  it("never intercepts a path that is a real static page", () => {
    for (const rule of TABLE) {
      if (rule.source.includes(":") || rule.source.includes("(")) continue;
      expect(STATIC_ROUTES, `${rule.source} shadows a live page`).not.toContain(rule.source);
    }
  });

  it("never intercepts the tools that v3 actually serves", () => {
    // These five exist as pages; a rule for one would be a silent 404 on a live
    // tool. Listed explicitly because they are the ones most likely to be
    // re-added by someone reaching for "the old calculator".
    for (const live of [
      "/tools/budget",
      "/tools/pearls",
      "/tools/sale-timeline",
      "/tools/journey",
      "/tools/packing",
    ]) {
      expect(TABLE.map((rule) => rule.source)).not.toContain(live);
      expect(STATIC_ROUTES).toContain(live);
    }
  });

  it("leaves /guides/tickets alone, which is a static route that looks like a slug", () => {
    // `tickets` is not a value of `edition`; the static route wins by precedence.
    expect(STATIC_ROUTES).toContain("/guides/tickets");
    expect(TABLE.map((rule) => rule.source)).not.toContain("/guides/tickets");
  });

  it("leaves /community alone, and only redirects its old child sections", () => {
    expect(STATIC_ROUTES).toContain("/community");
    expect(TABLE.map((rule) => rule.source)).not.toContain("/community");
  });
});

describe("destinations", () => {
  it("all point at a path the application serves", () => {
    for (const rule of TABLE) {
      const { path } = splitDestination(rule.destination);
      // A locale rule's destination is a capture, so its result is checked by the
      // chain test below instead; here only literal paths are asserted.
      if (path.includes(":")) continue;
      const resolved = ROUTES.some((route) => matchesPattern(path, route.pattern));
      expect(resolved, `${rule.source} -> ${path} is not a route`).toBe(true);
    }
  });

  it("point at a page rather than an API handler", () => {
    for (const rule of TABLE) {
      const { path } = splitDestination(rule.destination);
      if (path.includes(":")) continue;
      const matched = ROUTES.filter((route) => matchesPattern(path, route.pattern));
      expect(matched.some((route) => route.isPage), `${rule.source} -> ${path}`).toBe(true);
    }
  });

  it("names a section that exists in the community hub, for every fragment", () => {
    /*
      A fragment is not visible to the server, so a typo in one lands the reader at
      the top of the hub with no error anywhere. The ids are read from the page that
      renders them, so the assertion fails if one is renamed.
    */
    const communityPage = readFileSync(join(APP_DIR, "community", "page.tsx"), "utf8");
    const fragments = TABLE.map((rule) => splitDestination(rule.destination).hash).filter(
      (hash): hash is string => hash !== null,
    );
    expect(fragments.length).toBeGreaterThan(0);
    for (const fragment of fragments) {
      expect(communityPage, `no id="${fragment}" in the community page`).toContain(`id="${fragment}"`);
    }
  });
});

/**
 * Follows a path the way Next does until it settles, and reports the hops taken.
 *
 * The order matters and is the reason this helper exists rather than a simpler
 * one: Next matches `redirects()` **before** the filesystem. `/guides/food-drinks`
 * also matches the live pattern `/guides/[edition]`, and the redirect is what wins;
 * checking routes first would model the wrong router. A static source shadowing a
 * live page is a separate defect, asserted under "shadowing".
 *
 * Throws rather than looping forever, so a cycle fails the suite with the chain
 * printed instead of hanging it.
 */
function resolveChain(start: string, limit = 6): { hops: string[]; final: string } {
  const hops: string[] = [];
  let current = start;

  for (let step = 0; step <= limit; step += 1) {
    const next = applyTable(TABLE, current);
    if (next === null) return { hops, final: current };
    hops.push(`${current} -> ${splitDestination(next.to).path}`);
    current = splitDestination(next.to).path;
    if (current === start) throw new Error(`redirect loop: ${[...hops, current].join(", ")}`);
  }

  throw new Error(`redirect chain did not terminate within ${limit} hops: ${hops.join(", ")}`);
}

describe("chains", () => {
  /** Every source, with its patterns filled in with plausible values. */
  const SAMPLES: readonly string[] = [
    "/tools/budget-calculator",
    "/tools/pearl-calculator",
    "/tools/pearl-converter",
    "/tools/countdown",
    "/guides/food-drinks",
    "/guides/accommodation",
    "/guides/dreamville",
    "/guides/transport",
    "/guides/global-journey",
    "/guides/add-ons",
    "/guides/faq",
    "/news",
    "/news/some-article",
    "/sets",
    "/community/whatsapp",
    "/community/partners",
    "/index.html",
    "/es",
    "/fr",
    "/de",
    "/nl",
    "/pt",
    "/es/guides/belgium",
    "/fr/guides/food-drinks",
    "/de/tools/budget-calculator",
    "/nl/community/whatsapp",
    "/pt/news/some-article",
    "/es/guides/winter/transport",
  ];

  it("covers every concrete source in the table", () => {
    // Keeps SAMPLES honest: a new exact rule must be added to it, or this fails.
    const concrete = TABLE.map((rule) => rule.source).filter(
      (source) => !source.includes(":") && !source.includes("("),
    );
    for (const source of concrete) expect(SAMPLES, `${source} untested`).toContain(source);
  });

  it("terminates at a live route within two hops, for every sample", () => {
    for (const sample of SAMPLES) {
      const { hops } = resolveChain(sample);
      expect(hops.length, `${sample}: ${hops.join(" | ")}`).toBeLessThanOrEqual(2);
    }
  });

  it("never loops, including through the locale rules", () => {
    // The locale rules strip one segment per application, so termination is
    // structural; this asserts it rather than trusting the argument.
    for (const sample of SAMPLES) {
      expect(() => resolveChain(sample), sample).not.toThrow();
    }
  });

  it("lands on the destination an operator would expect", () => {
    const cases: readonly [string, string][] = [
      ["/tools/budget-calculator", "/tools/budget"],
      ["/tools/pearl-calculator", "/tools/pearls"],
      ["/tools/pearl-converter", "/tools/pearls"],
      ["/guides/food-drinks", "/guides/belgium/food-drinks"],
      ["/news", "/community/news"],
      ["/sets", "/guides/general/sets"],
      ["/fr/guides/belgium", "/guides/belgium"],
    ];
    for (const [from, to] of cases) {
      const { final } = resolveChain(from);
      expect(final, from).toBe(to);
    }
  });

  it("keeps every locale prefix, and no others", () => {
    // `en` carried no prefix in the old build and must not be redirected: an
    // English request is already the v3 address.
    expect([...LEGACY_LOCALES]).toEqual(["es", "fr", "de", "nl", "pt"]);
    const alternation = LEGACY_LOCALE_REDIRECTS[1]?.source ?? "";
    expect(alternation).toContain("(es|fr|de|nl|pt)");
    expect(alternation).not.toContain("en");
  });

  it("sends an unknown localised path to its unprefixed form, where it 404s honestly", () => {
    // A 404 is the correct answer here. Redirecting `/de/anything` to a real page
    // would tell a crawler that unrelated content had moved there, and the honest
    // signal is that nothing lives at that address.
    const { final } = resolveChain("/de/anything-at-all");
    expect(final).toBe("/anything-at-all");
    expect(ROUTES.some((route) => matchesPattern(final, route.pattern))).toBe(false);
  });
});

describe("the locale rules' order", () => {
  it("strips the bare locale before any path rule can match it", () => {
    // `/es` must become `/`, not be read as a path named "es".
    const first = LEGACY_LOCALE_REDIRECTS[0];
    expect(first?.source).toBe("/:locale(es|fr|de|nl|pt)");
    expect(first?.destination).toBe("/");
  });

  it("comes before the path rules, so a localised tool URL is stripped first", () => {
    const table = legacyRedirects();
    const localeIndex = table.findIndex((rule) => rule.source.includes(":locale"));
    const pathIndex = table.findIndex((rule) => rule.source === "/tools/budget-calculator");
    expect(localeIndex).toBeGreaterThanOrEqual(0);
    expect(localeIndex).toBeLessThan(pathIndex);
  });
});
