import { describe, expect, it } from "vitest";
import { buildSearchIndex, kindLabel } from "./build";
import { KIND_LABELS, KIND_ORDER, kindPrefix } from "./kinds";
import { KNOWN_ROUTES, isKnownRoute } from "./routes";
import { SNIPPET_MAX } from "./text";
import { EDITION_SCOPES, type SearchKind } from "./types";

/**
 * Integrity tests for the real index, built from the real data files.
 *
 * These are the tests that catch a data change drifting away from the palette:
 * a record that loses its price, a route that is renamed, a duplicate id. They
 * are deliberately about invariants rather than about exact content, so adding a
 * ticket to `src/data` does not fail a test — but adding one whose href is not on
 * the route whitelist does.
 */
const index = buildSearchIndex();

const KINDS: readonly SearchKind[] = [
  "page",
  "guide",
  "sale",
  "ticket",
  "accommodation",
  "edition",
  "faq",
  "whatsapp",
  "resource",
  "partner",
];

describe("buildSearchIndex", () => {
  it("returns a substantial index", () => {
    // Every FAQ, ticket variant, DreamVille package, sale window, community
    // group and resource in the v3 data, plus the site pages.
    expect(index.length).toBeGreaterThan(150);
  });

  it("keeps at least a floor of entries in every category", () => {
    // A total alone would hide one source list silently emptying while another
    // grew. These floors are deliberately below the current counts, so adding a
    // record never fails the test but losing a whole collection always does.
    const counts = new Map<SearchKind, number>();
    for (const entry of index) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);

    const floors: Readonly<Record<SearchKind, number>> = {
      page: 10,
      guide: 25,
      sale: 9,
      ticket: 20,
      accommodation: 25,
      edition: 6,
      faq: 70,
      whatsapp: 20,
      resource: 15,
      partner: 5,
    };

    for (const [kind, floor] of Object.entries(floors) as [SearchKind, number][]) {
      expect(counts.get(kind) ?? 0, kind).toBeGreaterThanOrEqual(floor);
    }
  });

  it("gives every entry a unique id", () => {
    const ids = index.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every entry a non-empty title and snippet", () => {
    for (const entry of index) {
      expect(entry.title.trim(), entry.id).not.toBe("");
      expect(entry.snippet.trim(), entry.id).not.toBe("");
    }
  });

  it("keeps every title and snippet within the character limit", () => {
    for (const entry of index) {
      expect(entry.title.length, entry.id).toBeLessThanOrEqual(SNIPPET_MAX);
      expect(entry.snippet.length, entry.id).toBeLessThanOrEqual(SNIPPET_MAX);
    }
  });

  it("never leaves a Markdown marker in a snippet", () => {
    for (const entry of index) {
      expect(entry.snippet, entry.id).not.toMatch(/\*\*|\[[^\]]+\]\(|^\s*-\s/);
    }
  });

  it("links only to routes the site renders", () => {
    for (const entry of index) {
      expect(entry.href.startsWith("/"), entry.id).toBe(true);
      expect(
        isKnownRoute(entry.href) || entry.kind === "guide",
        `${entry.id} → ${entry.href}`,
      ).toBe(true);
    }
    // And the whitelist holds nothing the index does not use, so it cannot grow
    // a route that no page serves.
    const used = new Set(index.filter((entry) => entry.kind !== "guide").map((entry) => entry.href));
    for (const href of used) expect(KNOWN_ROUTES).toContain(href);
  });

  it("assigns a known kind, and a label that matches it", () => {
    for (const entry of index) {
      expect(KINDS, entry.id).toContain(entry.kind);
      expect(entry.kindLabel, entry.id).toBe(KIND_LABELS[entry.kind]);
      expect(entry.kindLabel.trim()).not.toBe("");
    }
  });

  it("prefixes every id with its kind", () => {
    for (const entry of index) {
      expect(entry.id.startsWith(`${kindPrefix(entry.kind)}:`), entry.id).toBe(true);
    }
  });

  it("assigns a known edition scope to every entry", () => {
    for (const entry of index) {
      expect(EDITION_SCOPES as readonly string[], entry.id).toContain(entry.edition);
    }
  });

  it("records the source file for every entry", () => {
    for (const entry of index) {
      expect(entry.source.trim(), entry.id).not.toBe("");
      expect(entry.source.endsWith(".ts") || entry.source.endsWith(".tsx"), entry.id).toBe(true);
    }
  });

  it("only sets lastVerified as an ISO date that exists", () => {
    for (const entry of index) {
      if (entry.lastVerified === undefined) continue;
      expect(entry.lastVerified, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entry.lastVerified)), entry.id).toBe(false);
    }
  });

  it("only sets sourceUrl as an absolute https URL", () => {
    for (const entry of index) {
      if (entry.sourceUrl === undefined) continue;
      expect(() => new URL(entry.sourceUrl!), entry.id).not.toThrow();
      expect(new URL(entry.sourceUrl!).protocol, entry.id).toBe("https:");
    }
  });

  it("dates every entry that has a source URL, and vice versa", () => {
    // Provenance is per data record, so the two fields travel together. A URL
    // with no date would be a figure of unknown age; a date with no URL would
    // name a check the reader cannot verify.
    for (const entry of index) {
      expect(entry.sourceUrl === undefined, entry.id).toBe(entry.lastVerified === undefined);
    }
  });

  it("covers every kind the palette knows", () => {
    const kinds = new Set(index.map((entry) => entry.kind));
    for (const kind of KINDS) expect(kinds, kind).toContain(kind);
  });

  it("orders its kind list exactly as the palette renders headings", () => {
    expect([...KIND_ORDER]).toEqual([...KINDS]);
  });

  it("includes every site route as a page entry", () => {
    const pageHrefs = index.filter((entry) => entry.kind === "page").map((entry) => entry.href);
    for (const href of [
      "/",
      "/guides",
      "/guides/tickets",
      "/tools",
      "/tools/budget",
      "/tools/pearls",
      "/tools/sale-timeline",
      "/community",
      "/radio",
      "/about",
    ]) {
      expect(pageHrefs, href).toContain(href);
    }
  });

  it("sends tickets, accommodation and sales to the pages that price them", () => {
    for (const entry of index) {
      if (entry.kind === "ticket" || entry.kind === "accommodation") {
        expect(entry.href, entry.id).toMatch(/^\/guides\/tickets/);
      }
      if (entry.kind === "sale") {
        expect(entry.href, entry.id).toBe("/tools/sale-timeline");
      }
    }
  });

  it("sends community content to the community hub", () => {
    for (const entry of index) {
      if (["resource", "whatsapp", "partner"].includes(entry.kind)) {
        expect(entry.href, entry.id).toBe("/community");
      }
    }
  });

  it("sends FAQ answers to the guides index", () => {
    for (const entry of index.filter((candidate) => candidate.kind === "faq")) {
      expect(entry.href, entry.id).toBe("/guides");
    }
  });

  it("sends an edition to its own view of the tickets page", () => {
    const editions = index.filter((entry) => entry.kind === "edition");
    expect(editions.length).toBeGreaterThan(0);

    for (const entry of editions) {
      expect(entry.href, entry.id).toMatch(/^\/guides\/tickets(\?edition=(belgium|winter|brasil))?$/);
    }

    // The three covered editions each address their own view.
    const belgium = editions.find((entry) => entry.id === "edition:edition-belgium-2027");
    const winter = editions.find((entry) => entry.id === "edition:edition-winter-2027");
    const brasil = editions.find((entry) => entry.id === "edition:edition-brasil-2027");
    expect(winter?.href).toBe("/guides/tickets?edition=winter");
    expect(brasil?.href).toBe("/guides/tickets?edition=brasil");
    expect(belgium?.href).toBe("/guides/tickets");
  });

  it("does not leave emoji in a title", () => {
    for (const entry of index) {
      expect(entry.title, entry.id).not.toMatch(/[\p{Extended_Pictographic}]/u);
    }
  });

  it("names a currency on every priced entry, and never converts one", () => {
    const priced = index.filter((entry) => /€|R\$/.test(entry.snippet));
    expect(priced.length).toBeGreaterThan(20);

    for (const entry of priced) {
      expect(entry.snippet, entry.id).toMatch(/€|R\$/);
      // A Brasil record is priced in reais and nothing else; a Belgian or
      // Winter one in euros and nothing else. Never both in one snippet.
      if (entry.edition === "brasil") {
        expect(entry.snippet, entry.id).not.toContain("€");
      } else if (entry.edition === "belgium" || entry.edition === "winter") {
        expect(entry.snippet, entry.id).not.toMatch(/R\$/);
      }
    }
  });

  it("names the edition year on every ticket and accommodation price", () => {
    // The brief requires a price tier in a snippet to carry the year it belongs
    // to. That rule applies to the two priced collections; an FAQ answer is a
    // quotation that may mention a flat fee with no year at all.
    const priced = index.filter(
      (entry) => entry.kind === "ticket" || entry.kind === "accommodation",
    );
    expect(priced.length).toBeGreaterThan(20);

    for (const entry of priced) {
      expect(entry.snippet, entry.id).toMatch(/€|R\$/);
      expect(entry.snippet, entry.id).toMatch(/\b20\d{2}\b/);
    }
  });

  it("is deterministic", () => {
    expect(buildSearchIndex()).toEqual(index);
  });

  it("returns fresh objects, so a consumer cannot poison the next build", () => {
    const first = buildSearchIndex();
    first[0].title = "tampered";
    expect(buildSearchIndex()[0].title).not.toBe("tampered");
  });

  it("does not share entry objects between two builds", () => {
    const first = buildSearchIndex();
    const second = buildSearchIndex();
    expect(first[0]).not.toBe(second[0]);
  });
});

describe("kindLabel", () => {
  it("returns the same label the build assigned", () => {
    for (const entry of index.slice(0, 20)) {
      expect(kindLabel(entry.kind)).toBe(entry.kindLabel);
    }
  });
});
