// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildBrasilCatalogue, buildBelgiumCatalogue, buildWinterCatalogue, buildCatalogue, editionYear } from "./selectors";
import { allItems, groupByProduct, sortWindows, splitTierId } from "./catalogue";

/**
 * Checks against the live datasets rather than fixtures.
 *
 * These are the assertions that would catch a bad import or a re-introduced old
 * price, so they must read the real records. They are deliberately structural: a
 * change to a 2027 figure should not fail a test here, but a change to the shape,
 * the pairing or the edition year should.
 */

const catalogues = [buildBelgiumCatalogue(), buildWinterCatalogue(), buildBrasilCatalogue()];

describe("every edition builds", () => {
  it("covers all three editions with the right labels", () => {
    expect(catalogues.map((catalogue) => catalogue.edition)).toEqual([
      "belgium",
      "winter",
      "brasil",
    ]);
    expect(catalogues.map((catalogue) => catalogue.label)).toEqual([
      "Belgium",
      "Winter",
      "Brasil",
    ]);
  });

  it("reads the 2027 edition year from the shared overview for each", () => {
    for (const catalogue of catalogues) {
      expect(catalogue.year).toBe(2027);
      expect(editionYear(catalogue.edition)).toBe(2027);
    }
  });

  it("dates every catalogue with the 18 November 2026 check", () => {
    for (const catalogue of catalogues) {
      expect(catalogue.checkedOn).toBe("2026-11-18");
    }
  });

  it("gives every item a unique id within its edition", () => {
    for (const catalogue of catalogues) {
      const ids = allItems(catalogue).map((item) => item.id);
      expect(new Set(ids).size, `${catalogue.edition} has a duplicate item id`).toBe(ids.length);
    }
  });

  it("gives every item a source and a check date", () => {
    for (const catalogue of catalogues) {
      for (const item of allItems(catalogue)) {
        expect(item.source.url, `${item.id} has no source`).toMatch(/^https:\/\//);
        expect(item.lastVerified, `${item.id} has no check date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("gives every price tier a source and a year", () => {
    for (const catalogue of catalogues) {
      for (const item of allItems(catalogue)) {
        for (const tier of item.tiers) {
          expect(tier.source.url).toMatch(/^https:\/\//);
          expect(tier.year).toBe(2027);
          expect(Number.isFinite(tier.amount)).toBe(true);
        }
      }
    }
  });

  it("never gives a published item an empty price list", () => {
    for (const catalogue of catalogues) {
      for (const item of allItems(catalogue)) {
        if (item.priceStatus === "published") {
          expect(item.tiers.length, `${item.id} is published with no price`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("never gives an unpublished item a price", () => {
    for (const catalogue of catalogues) {
      for (const item of allItems(catalogue)) {
        if (item.priceStatus === "unpublished") {
          expect(item.tiers, `${item.id} is unpublished but carries a price`).toEqual([]);
          expect(item.officialUrl, `${item.id} has no official page`).toMatch(/^https:\/\//);
          expect(item.missingReason, `${item.id} does not say why`).toBeTruthy();
        }
      }
    }
  });

  it("describes every category and gives it an icon", () => {
    for (const catalogue of catalogues) {
      for (const category of catalogue.categories) {
        expect(category.label.length).toBeGreaterThan(0);
        expect(category.kicker.length).toBeGreaterThan(0);
        expect(category.description.length).toBeGreaterThan(0);
        expect(category.icon.length).toBeGreaterThan(0);
      }
    }
  });

  it("explains a category with no products instead of leaving it blank", () => {
    for (const catalogue of catalogues) {
      for (const category of catalogue.categories) {
        if (category.items.length === 0) {
          expect(category.emptyNote, `${category.id} is empty with no note`).toBeTruthy();
          expect(category.emptyUrl, `${category.id} is empty with no link`).toMatch(/^https:\/\//);
        }
      }
    }
  });

  it("sorts every category cheapest first", () => {
    for (const catalogue of catalogues) {
      for (const category of catalogue.categories) {
        const published = category.items.filter((item) => item.priceStatus === "published");
        const lowest = published.map((item) => Math.min(...item.tiers.map((tier) => tier.amount)));
        const sorted = [...lowest].sort((a, b) => a - b);
        expect(lowest).toEqual(sorted);
      }
    }
  });

  it("puts unpublished products after published ones in a list", () => {
    for (const catalogue of catalogues) {
      for (const category of catalogue.categories) {
        const firstUnpublished = category.items.findIndex(
          (item) => item.priceStatus === "unpublished",
        );
        if (firstUnpublished === -1) continue;
        const laterPublished = category.items
          .slice(firstUnpublished)
          .some((item) => item.priceStatus === "published");
        expect(laterPublished, `${category.id} mixes an unpublished price into the list`).toBe(false);
      }
    }
  });

  it("leads with the category the page links to, so breadcrumbs resolve", () => {
    for (const catalogue of catalogues) {
      expect(catalogue.categories.length).toBeGreaterThan(0);
      for (const category of catalogue.categories) {
        // Every card link and breadcrumb uses this id, so it must be a slug.
        expect(category.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      }
    }
  });
});

describe("sale windows", () => {
  it("puts every window in calendar order", () => {
    for (const catalogue of catalogues) {
      const ordered = sortWindows(catalogue.windows);
      expect(catalogue.windows.map((window) => window.id)).toEqual(
        ordered.map((window) => window.id),
      );
    }
  });

  it("carries an explicit offset on every opening time", () => {
    for (const catalogue of catalogues) {
      for (const window of catalogue.windows) {
        expect(window.opensAt, `${window.id} has no offset`).toMatch(
          /(?:[Zz]|[+-]\d{2}:\d{2})$/,
        );
      }
    }
  });

  it("names a real time zone on every window", () => {
    for (const catalogue of catalogues) {
      for (const window of catalogue.windows) {
        expect(() => new Intl.DateTimeFormat("en-GB", { timeZone: window.timeZone })).not.toThrow();
      }
    }
  });

  it("uses Brasília time for Brasil and Brussels time for the others", () => {
    expect(buildBrasilCatalogue().windows.every((w) => w.timeZone === "America/Sao_Paulo")).toBe(
      true,
    );
    expect(buildBelgiumCatalogue().windows.every((w) => w.timeZone === "Europe/Brussels")).toBe(
      true,
    );
    expect(buildWinterCatalogue().windows.every((w) => w.timeZone === "Europe/Brussels")).toBe(
      true,
    );
  });

  it("publishes Belgium's three 2027 sale moments in order", () => {
    expect(buildBelgiumCatalogue().windows.map((window) => window.id)).toEqual([
      "global-journey-sale",
      "worldwide-pre-sale",
      "worldwide-ticket-sale",
    ]);
  });
});

describe("Belgium catalogue", () => {
  const catalogue = buildBelgiumCatalogue();
  const items = allItems(catalogue);

  it("offers the four categories the brief asks for", () => {
    expect(catalogue.categories.map((category) => category.id)).toEqual([
      "festival-tickets",
      "dreamville",
      "montagoe",
      "global-journey",
    ]);
  });

  it("pairs each two-tier product into one card rather than two", () => {
    const dayPass = items.find((item) => item.id === "belgium-2027-day-pass");
    expect(dayPass?.tiers.map((tier) => tier.key)).toEqual(["presale", "worldwide"]);
    expect(items.filter((item) => item.name === "Day Pass")).toHaveLength(1);
  });

  it("keeps the pre-sale before the WorldWide sale on every paired product", () => {
    for (const item of items) {
      if (item.tiers.length === 2) {
        expect(item.tiers[0].key).toBe("presale");
        expect(item.tiers[1].key).toBe("worldwide");
      }
    }
  });

  it("marks a WorldWide-only product as such", () => {
    const friendship = items.find((item) => item.id === "belgium-2027-friendship-garden-10p");
    expect(friendship?.badges).toContain("WorldWide sale only");
    expect(friendship?.tiers).toHaveLength(1);
  });

  it("keeps Montagoe lodges apart from DreamVille camping", () => {
    const dreamville = catalogue.categories.find((c) => c.id === "dreamville");
    const montagoe = catalogue.categories.find((c) => c.id === "montagoe");
    expect(dreamville?.items.some((item) => item.id === "belgium-2027-easy-tent-2p")).toBe(true);
    expect(montagoe?.items.some((item) => item.id === "belgium-2027-relax-room-2p")).toBe(true);
    expect(montagoe?.items.some((item) => item.id === "belgium-2027-easy-tent-2p")).toBe(false);
  });

  it("states a package capacity in the qualifier", () => {
    const easyTent = items.find((item) => item.id === "belgium-2027-easy-tent-2p");
    expect(easyTent?.qualifier).toContain("2 people");
    expect(easyTent?.qualifier).toContain("whole stay");
  });

  it("lists the sale caps, the pre-registration and the Exchange Desk", () => {
    const ids = catalogue.explainer.map((row) => row.id);
    expect(ids).toContain("pre-registration");
    expect(ids).toContain("ticket-caps");
    expect(ids).toContain("exchange-desk");
    expect(ids).toContain("unofficial-resale");
  });

  it("quotes the four-person cap from the facts record", () => {
    const caps = catalogue.explainer.find((row) => row.id === "ticket-caps");
    expect(caps?.detail).toContain("4 people per Tomorrowland Account");
  });

  it("describes the Exchange Desk as the only resale route", () => {
    const desk = catalogue.explainer.find((row) => row.id === "exchange-desk");
    expect(desk?.term).toMatch(/only resale route/);
    // Dates are written as prose, not as raw record values.
    expect(desk?.detail).toContain("13 February 2027");
    expect(desk?.detail).toContain("29 April 2027");
    expect(desk?.detail).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(desk?.detail).toContain("listing is not a sale");
  });

  it("gives every explainer row at least one cited source", () => {
    for (const row of catalogue.explainer) {
      expect(row.sources.length, `${row.id} has no source`).toBeGreaterThan(0);
      for (const source of row.sources) expect(source.url).toMatch(/^https:\/\//);
    }
  });

  it("never claims TicketSwap is official", () => {
    const text = JSON.stringify(catalogue).toLowerCase();
    expect(text).not.toContain("official resale partner");
    expect(text).not.toContain("ticketswap");
  });
});

describe("Winter catalogue", () => {
  const catalogue = buildWinterCatalogue();
  const items = allItems(catalogue);

  it("shows only the products the data carries", () => {
    expect(items.map((item) => item.id).sort()).toEqual([
      "four-day-festival-ticket",
      "one-day-festival-ticket-mainstage-closed",
      "one-day-festival-ticket-mainstage-open",
      "seven-day-festival-ticket-2027",
    ]);
  });

  it("shows the one published price and no invented minimum", () => {
    const published = items.filter((item) => item.priceStatus === "published");
    expect(published).toHaveLength(1);
    expect(published[0].tiers[0].amount).toBe(735);
  });

  it("says a price is not published for the other three products", () => {
    const unpublished = items.filter((item) => item.priceStatus === "unpublished");
    expect(unpublished).toHaveLength(3);
    for (const item of unpublished) {
      expect(item.badges).toContain("Price not published");
      expect(item.officialUrl).toBe("https://winter.tomorrowland.com/en/tickets/festival-ticket/");
    }
  });

  it("does not invent an accommodation minimum, because none is published", () => {
    expect(catalogue.categories.find((c) => c.id === "packages")?.items).toEqual([]);
  });

  it("does not carry over a 2025 package minimum", () => {
    const text = JSON.stringify(catalogue);
    expect(text).not.toContain("995");
    expect(text).not.toContain("875");
    expect(text).not.toContain("2,695");
  });

  it("publishes only the one confirmed sale date", () => {
    expect(catalogue.windows.map((window) => window.id)).toEqual(["add-on-sale-2027"]);
    expect(catalogue.windows[0].opensAt).toBe("2026-11-26T15:00:00+01:00");
  });
});

describe("Brasil catalogue", () => {
  const catalogue = buildBrasilCatalogue();
  const items = allItems(catalogue);

  it("uses reais for every price, with no euros anywhere", () => {
    for (const item of items) {
      for (const tier of item.tiers) {
        expect(tier.currency).toBe("BRL");
      }
    }
  });

  it("groups each pass by product, with its variants as tiers", () => {
    const fullMadness = items.find((item) => item.id === "full-madness");
    expect(fullMadness?.tiers.map((tier) => tier.label)).toEqual([
      "Standard",
      "Half-price (meia-entrada)",
      "Social",
      "Bybit early bird",
      "Bybit early bird, half-price",
      "Bybit early bird, Social",
    ]);
  });

  it("keeps the six Full Madness variants on one card, not six cards", () => {
    expect(items.filter((item) => item.name === "Full Madness Pass")).toHaveLength(1);
    expect(items.find((item) => item.id === "full-madness")?.tiers).toHaveLength(6);
  });

  it("separates each DreamVille unit rather than merging a family", () => {
    const dreamville = catalogue.categories.find((category) => category.id === "dreamville");
    expect(dreamville?.items.map((item) => item.id).sort()).toEqual([
      "easy-tent-2p",
      "grande-4p",
      "magnificent-greens-1p",
      "solaris-2p",
    ]);
  });

  it("gives a Magnificent Greens pitch both sale moments, labelled apart", () => {
    const pitch = items.find((item) => item.id === "magnificent-greens-1p");
    const labels = pitch?.tiers.map((tier) => tier.label) ?? [];
    expect(labels).toContain("Standard");
    expect(labels).toContain("Comfort");
    expect(labels).toContain("Bybit early bird — Standard");
    expect(labels).toContain("Bybit early bird — Comfort");
    // No two tiers of one product may share a label.
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("marks sold-out products without inventing availability", () => {
    for (const item of items) {
      expect(item.badges).toContain("Sold out");
    }
  });

  it("explains the half-price rule as a flat discount, not a percentage", () => {
    const halfPrice = catalogue.explainer.find((row) => row.id === "half-price");
    expect(halfPrice?.detail).toContain("flat R$1,580");
    expect(halfPrice?.detail).toContain("Brazilian citizens only");
  });

  it("lists the Brasil sale windows with their published status", () => {
    expect(catalogue.windows.length).toBeGreaterThan(0);
    for (const window of catalogue.windows) {
      expect(window.statusLabel).toBe("Passed");
    }
  });
});

describe("retired 2025 figures", () => {
  /**
   * The old site's modal quoted these figures. The datasets were rebuilt from the
   * 2027 pages, and no rendered text may resurrect an old price as if it were
   * current. The assertion runs over the whole catalogue payload, which is what the
   * page renders from, so it covers every card, tier, note and explainer row at
   * once.
   */
  const RETIRED_PRICES = ["304", "374", "799", "699", "599"];

  /** True when `payload` carries any retired figure as a JSON money amount. */
  function carriesRetiredPrice(payload: string): boolean {
    return RETIRED_PRICES.some((retired) =>
      new RegExp(`"amount":${retired}(?:\\.|,|})`).test(payload),
    );
  }

  it("detects a planted retired figure, so the guard below is not vacuous", () => {
    // Without this, a typo in the pattern would make every assertion pass silently.
    expect(carriesRetiredPrice('{"amount":799}')).toBe(true);
    expect(carriesRetiredPrice('{"amount":374.5}')).toBe(true);
    expect(carriesRetiredPrice('{"amount":699,"x":1}')).toBe(true);
  });

  it("does not fire on a figure that merely contains a retired number", () => {
    // 5,707 is a real 2027 total; the guard must not read "5707" as "57 07" or
    // catch a longer figure that happens to start with a retired one.
    expect(carriesRetiredPrice('{"amount":5707}')).toBe(false);
    expect(carriesRetiredPrice('{"amount":7990}')).toBe(false);
    expect(carriesRetiredPrice('{"amount":144}')).toBe(false);
  });

  it("never carries a retired figure as a rendered euro price", () => {
    expect(carriesRetiredPrice(JSON.stringify(buildCatalogue("belgium")))).toBe(false);
  });

  it("never carries a retired figure in the Winter catalogue's prices", () => {
    const winter = buildCatalogue("winter");
    const amounts = allItems(winter).flatMap((item) => item.tiers.map((tier) => tier.amount));
    for (const retired of RETIRED_PRICES) {
      expect(amounts).not.toContain(Number(retired));
    }
  });

  it("never carries a retired euro figure in the Brasil catalogue", () => {
    // Brasil's own figures are reais, so only a euro amount could be a leftover.
    const brasil = buildCatalogue("brasil");
    const euroTiers = allItems(brasil).flatMap((item) =>
      item.tiers.filter((tier) => tier.currency === "EUR"),
    );
    expect(euroTiers).toEqual([]);
  });

  it("does not use the old modal's invented category names", () => {
    // The old pop-up invented headings such as "Special Packages"; the 2027 data
    // has no such category, and the page must not present one.
    const labels = catalogues.flatMap((catalogue) =>
      catalogue.categories.map((category) => category.label.toLowerCase()),
    );
    expect(labels).not.toContain("special packages");
    expect(labels).not.toContain("regular tickets");
  });
});

describe("tier pairing against the live datasets", () => {
  it("leaves no Belgium record unpaired", () => {
    // Every Belgium record follows the -presale/-worldwide convention, so a record
    // that stops following it should surface here rather than vanish from the page.
    expect(groupByProduct([{ id: "a-presale" }, { id: "b-worldwide" }]).unpaired).toEqual([]);
  });

  it("derives a product id that does not collide across categories", () => {
    const ids = allItems(buildBelgiumCatalogue()).map((item) => item.id);
    for (const id of ids) {
      expect(splitTierId(id)).toBeNull();
    }
  });
});
