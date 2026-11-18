import { describe, expect, it } from "vitest";
import {
  baseName,
  findCategory,
  findItem,
  groupByProduct,
  latestVerified,
  sortItems,
  sortTiers,
  sortWindows,
  splitTierId,
  uniqueSources,
} from "./catalogue";
import type { CatalogueItem, PriceTier } from "./types";

/* ---------------------------------------------------------------------------------------------
 * Fixtures
 *
 * Built by hand rather than imported from src/data so a change to a 2027 price
 * cannot break a test that is really about grouping.
 * ------------------------------------------------------------------------------------------- */

function tier(overrides: Partial<PriceTier> & Pick<PriceTier, "key" | "amount">): PriceTier {
  return {
    label: overrides.key,
    year: 2027,
    currency: "EUR",
    source: {
      url: "https://example.com/source",
      title: "Example source",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    ...overrides,
  };
}

function item(overrides: Partial<CatalogueItem> & Pick<CatalogueItem, "id" | "name">): CatalogueItem {
  const source = {
    url: "https://example.com/source",
    title: "Example source",
    retrievedOn: "2026-11-18",
  } as const;
  return {
    categoryId: "festival-tickets",
    includes: [],
    tiers: [],
    priceStatus: "published",
    badges: [],
    source,
    lastVerified: "2026-11-18",
    ...overrides,
  };
}

describe("splitTierId", () => {
  it("splits a pre-sale id into the product and its tier", () => {
    expect(splitTierId("belgium-2027-full-madness-presale")).toEqual({
      productId: "belgium-2027-full-madness",
      tierKey: "presale",
    });
  });

  it("splits a WorldWide sale id", () => {
    expect(splitTierId("belgium-2027-easy-tent-2p-worldwide")).toEqual({
      productId: "belgium-2027-easy-tent-2p",
      tierKey: "worldwide",
    });
  });

  it("returns null for an id with no recognised suffix", () => {
    expect(splitTierId("seven-day-festival-ticket-2027")).toBeNull();
  });

  it("returns null rather than an empty product id", () => {
    // "-presale" would otherwise yield a product called "".
    expect(splitTierId("-presale")).toBeNull();
  });

  it("does not treat a suffix in the middle as a tier", () => {
    expect(splitTierId("belgium-2027-presale-thing")).toBeNull();
  });

  it("only strips the final suffix, keeping a hyphenated product name intact", () => {
    expect(splitTierId("belgium-2027-magnificent-greens-tent-2p-worldwide")).toEqual({
      productId: "belgium-2027-magnificent-greens-tent-2p",
      tierKey: "worldwide",
    });
  });
});

describe("baseName", () => {
  it("strips the edition and sale suffix", () => {
    expect(baseName("Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale")).toBe("Day Pass");
  });

  it("keeps a name with no suffix unchanged", () => {
    expect(baseName("7-Day Festival Ticket")).toBe("7-Day Festival Ticket");
  });

  it("keeps a name that contains its own em dash", () => {
    // Only the first segment is kept, which is the product name.
    expect(baseName("Full Madness Pass — 2027 edition, WorldWide Ticket Sale")).toBe(
      "Full Madness Pass",
    );
  });

  it("falls back to the original when stripping would empty the name", () => {
    expect(baseName(" — 2027 edition")).toBe(" — 2027 edition");
  });
});

describe("groupByProduct", () => {
  it("pairs two records of the same product", () => {
    const { groups, unpaired } = groupByProduct([
      { id: "thing-presale" },
      { id: "thing-worldwide" },
    ]);

    expect(unpaired).toEqual([]);
    expect(groups).toHaveLength(1);
    expect(groups[0].productId).toBe("thing");
    expect(groups[0].records).toHaveLength(2);
  });

  it("keeps different products apart", () => {
    const { groups } = groupByProduct([
      { id: "one-presale" },
      { id: "two-presale" },
      { id: "one-worldwide" },
    ]);

    expect(groups.map((group) => group.productId)).toEqual(["one", "two"]);
    expect(groups[0].records.map((record) => record.id)).toEqual(["one-presale", "one-worldwide"]);
  });

  it("reports a record with no tier suffix instead of merging it", () => {
    const { groups, unpaired } = groupByProduct([
      { id: "thing-presale" },
      { id: "loose-record" },
    ]);

    expect(groups).toHaveLength(1);
    expect(unpaired).toEqual([{ id: "loose-record" }]);
  });

  it("groups a product sold in only one sale moment", () => {
    const { groups } = groupByProduct([{ id: "friendship-garden-worldwide" }]);

    expect(groups).toHaveLength(1);
    expect(groups[0].records).toHaveLength(1);
  });

  it("returns nothing for an empty collection", () => {
    expect(groupByProduct([])).toEqual({ groups: [], unpaired: [] });
  });
});

describe("sortTiers", () => {
  it("puts the pre-sale before the WorldWide sale regardless of input order", () => {
    const sorted = sortTiers([
      tier({ key: "worldwide", amount: 159 }),
      tier({ key: "presale", amount: 144 }),
    ]);

    expect(sorted.map((entry) => entry.key)).toEqual(["presale", "worldwide"]);
  });

  it("places an unfamiliar tier after the known ones and sorts those by key", () => {
    const sorted = sortTiers([
      tier({ key: "zeta", amount: 1 }),
      tier({ key: "worldwide", amount: 2 }),
      tier({ key: "alpha", amount: 3 }),
    ]);

    expect(sorted.map((entry) => entry.key)).toEqual(["worldwide", "alpha", "zeta"]);
  });

  it("does not mutate the array it was given", () => {
    const input = [tier({ key: "worldwide", amount: 2 }), tier({ key: "presale", amount: 1 })];
    sortTiers(input);

    expect(input.map((entry) => entry.key)).toEqual(["worldwide", "presale"]);
  });
});

describe("sortItems", () => {
  it("orders by the lowest price first", () => {
    const sorted = sortItems([
      item({ id: "b", name: "B", tiers: [tier({ key: "presale", amount: 300 })] }),
      item({ id: "a", name: "A", tiers: [tier({ key: "presale", amount: 100 })] }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("uses the cheapest tier, not the first one listed", () => {
    const sorted = sortItems([
      item({
        id: "dear",
        name: "Dear",
        tiers: [tier({ key: "presale", amount: 900 }), tier({ key: "worldwide", amount: 950 })],
      }),
      item({
        id: "cheap",
        name: "Cheap",
        tiers: [tier({ key: "presale", amount: 100 }), tier({ key: "worldwide", amount: 5_000 })],
      }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["cheap", "dear"]);
  });

  it("puts unpublished prices last, even though Infinity is not a price", () => {
    const sorted = sortItems([
      item({ id: "none", name: "Aaa", priceStatus: "unpublished", tiers: [] }),
      item({ id: "priced", name: "Zzz", tiers: [tier({ key: "presale", amount: 1_000 })] }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["priced", "none"]);
  });

  it("breaks a tie by name", () => {
    const sorted = sortItems([
      item({ id: "b", name: "Beta", tiers: [tier({ key: "presale", amount: 100 })] }),
      item({ id: "a", name: "Alpha", tiers: [tier({ key: "presale", amount: 100 })] }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () => {
    const input = [
      item({ id: "b", name: "B", tiers: [tier({ key: "presale", amount: 2 })] }),
      item({ id: "a", name: "A", tiers: [tier({ key: "presale", amount: 1 })] }),
    ];
    sortItems(input);

    expect(input.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("returns an empty list unchanged", () => {
    expect(sortItems([])).toEqual([]);
  });
});

describe("sortWindows", () => {
  it("orders by opening instant", () => {
    const sorted = sortWindows([
      { id: "second", name: "Second", opensAt: "2027-02-06T17:00:00+01:00", timeZone: "Europe/Brussels", audience: "", source: { url: "https://example.com", title: "S", retrievedOn: "2026-11-18" }, lastVerified: "2026-11-18" },
      { id: "first", name: "First", opensAt: "2027-01-30T17:00:00+01:00", timeZone: "Europe/Brussels", audience: "", source: { url: "https://example.com", title: "S", retrievedOn: "2026-11-18" }, lastVerified: "2026-11-18" },
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["first", "second"]);
  });

  it("compares instants across offsets, not the text of the string", () => {
    // 11:00-03:00 and 15:00+01:00 are both 14:00Z, so the tie breaks by id. Sorting
    // the strings instead would put "a" first for the wrong reason.
    const sorted = sortWindows([
      { id: "b", name: "B", opensAt: "2026-09-24T11:00:00-03:00", timeZone: "America/Sao_Paulo", audience: "", source: { url: "https://example.com", title: "S", retrievedOn: "2026-11-18" }, lastVerified: "2026-11-18" },
      { id: "a", name: "A", opensAt: "2026-09-24T15:00:00+01:00", timeZone: "Europe/Brussels", audience: "", source: { url: "https://example.com", title: "S", retrievedOn: "2026-11-18" }, lastVerified: "2026-11-18" },
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("orders by the real instant even when the local clocks disagree", () => {
    // 10:00-03:00 is 13:00Z, which is earlier than 15:00+01:00 at 14:00Z, although
    // the Brasília clock reads the earlier hour.
    const sorted = sortWindows([
      { id: "afternoon-brussels", name: "B", opensAt: "2026-09-24T15:00:00+01:00", timeZone: "Europe/Brussels", audience: "", source: { url: "https://example.com", title: "S", retrievedOn: "2026-11-18" }, lastVerified: "2026-11-18" },
      { id: "morning-sao-paulo", name: "A", opensAt: "2026-09-24T10:00:00-03:00", timeZone: "America/Sao_Paulo", audience: "", source: { url: "https://example.com", title: "S", retrievedOn: "2026-11-18" }, lastVerified: "2026-11-18" },
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["morning-sao-paulo", "afternoon-brussels"]);
  });
});

describe("latestVerified", () => {
  it("returns the most recent date", () => {
    expect(
      latestVerified([{ lastVerified: "2026-11-18" }, { lastVerified: "2026-12-01" }], "2000-01-01"),
    ).toBe("2026-12-01");
  });

  it("returns the fallback for an empty collection", () => {
    expect(latestVerified([], "2026-11-18")).toBe("2026-11-18");
  });
});

describe("uniqueSources", () => {
  it("keeps one entry per URL in first-seen order", () => {
    const sources = uniqueSources([
      { url: "https://a.example", title: "A", retrievedOn: "2026-11-18" },
      { url: "https://b.example", title: "B", retrievedOn: "2026-11-18" },
      { url: "https://a.example", title: "A again", retrievedOn: "2026-11-18" },
    ]);

    expect(sources.map((source) => source.url)).toEqual(["https://a.example", "https://b.example"]);
  });
});

describe("findCategory and findItem", () => {
  const catalogue = {
    edition: "belgium" as const,
    label: "Belgium",
    year: 2027,
    categories: [
      {
        id: "festival-tickets",
        label: "Festival tickets",
        kicker: "01",
        description: "",
        icon: "gift" as const,
        items: [item({ id: "day-pass", name: "Day Pass" })],
      },
    ],
    windows: [],
    explainer: [],
    officialLinks: [],
    checkedOn: "2026-11-18",
  };

  it("finds a category by id", () => {
    expect(findCategory(catalogue, "festival-tickets")?.label).toBe("Festival tickets");
  });

  it("returns undefined for an unknown or absent category", () => {
    expect(findCategory(catalogue, "nope")).toBeUndefined();
    expect(findCategory(catalogue, undefined)).toBeUndefined();
  });

  it("finds an item inside a category", () => {
    const category = findCategory(catalogue, "festival-tickets");
    expect(findItem(category, "day-pass")?.name).toBe("Day Pass");
  });

  it("returns undefined for an unknown item or a missing category", () => {
    const category = findCategory(catalogue, "festival-tickets");
    expect(findItem(category, "nope")).toBeUndefined();
    expect(findItem(undefined, "day-pass")).toBeUndefined();
  });
});
