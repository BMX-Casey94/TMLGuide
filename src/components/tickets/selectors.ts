/**
 * The ticket catalogue, assembled from the validated datasets.
 *
 * The datasets in `src/data` hold one record per product *per sale tier*, because
 * the ticket schema carries a single price. A reader thinks in products, not
 * records: Full Madness has a pre-sale price and a WorldWide sale price, and those
 * belong on one card. This module makes that translation without inventing a
 * figure:
 *
 * - a product is formed by pairing records that share a product key;
 * - the tier label and the edition year come from structured fields, never from
 *   parsing prose;
 * - a product whose price Tomorrowland has not published becomes an explicit
 *   `unpublished` item carrying its official page, rather than being dropped or
 *   guessed at.
 *
 * It imports every edition's dataset, so it must only be used from Server
 * Components. The pure pairing and lookup helpers live in `catalogue.ts`, which a
 * Client Component may import freely.
 */
import {
  accommodation as belgiumAccommodation,
  belgiumFacts,
  saleWindows as belgiumSaleWindows,
  tickets as belgiumTickets,
} from "@/data/belgium";
import { brasilData } from "@/data/brasil";
import type {
  Accommodation,
  SaleWindow as SharedSaleWindow,
  Source,
  TicketPackage,
} from "@/data/schemas";
import { sharedData } from "@/data/shared";
import {
  winterAccommodation,
  winterFacts,
  winterFaqs,
  winterSaleWindows,
  winterTickets,
  type WinterFact,
} from "@/data/winter";
import {
  baseName,
  groupByProduct,
  latestVerified,
  saleBadges,
  sortItems,
  sortTiers,
  sortWindows,
  splitTierId,
  TIER_LABELS,
  uniqueSources,
  type GroupedProduct,
} from "./catalogue";
import { formatInstantParts, formatInstantProse } from "./format";
import type {
  CatalogueCategory,
  CatalogueItem,
  CatalogueSaleWindow,
  EditionCatalogue,
  ExplainerRow,
  OfficialLink,
  PriceTier,
} from "./types";
import type { TicketEditionId } from "./routes";
/** The one date every record in the current datasets was checked on. */
const CHECKED_ON = "2026-11-18";

const BRUSSELS = "Europe/Brussels";
const SAO_PAULO = "America/Sao_Paulo";

const EDITION_LABELS: Readonly<Record<TicketEditionId, string>> = {
  belgium: "Belgium",
  winter: "Winter",
  brasil: "Brasil",
};

/**
 * The edition year, read from the shared editions overview.
 *
 * A price record carries no year field: the year lives in its id and its name. The
 * overview does carry real dates, so the year comes from the edition the guide
 * covers, preferring one still ahead of us and otherwise the latest.
 *
 * @throws Error when the overview has no record for the edition.
 */
export function editionYear(edition: TicketEditionId): number {
  const candidates = sharedData.editions.filter((record) => record.guideEdition === edition);
  if (candidates.length === 0) {
    throw new Error(`editionYear: the editions overview has no record for "${edition}"`);
  }
  const upcoming = candidates.filter((record) => record.status === "upcoming");
  const pool = upcoming.length > 0 ? upcoming : candidates;
  const latest = pool.reduce((best, record) =>
    Date.parse(record.startsOn) > Date.parse(best.startsOn) ? record : best,
  );
  const year = Number(latest.startsOn.slice(0, 4));
  if (!Number.isInteger(year)) {
    throw new Error(`editionYear: "${latest.id}" has an unreadable start date`);
  }
  return year;
}

/** The tier key of a record that is being grouped, which always carries one. */
function tierKeyOf(id: string): string {
  return splitTierId(id)?.tierKey ?? "standard";
}

function tierLabel(key: string): string {
  return TIER_LABELS[key] ?? key;
}

function tierFromTicket(ticket: TicketPackage, year: number): PriceTier {
  const key = tierKeyOf(ticket.id);
  return {
    key,
    label: tierLabel(key),
    year,
    currency: "EUR",
    amount: ticket.priceEur,
    ...(ticket.notes === undefined ? {} : { note: ticket.notes }),
    source: ticket.source,
    lastVerified: ticket.lastVerified,
  };
}

function tierFromAccommodation(record: Accommodation, year: number): PriceTier {
  const key = tierKeyOf(record.id);
  return {
    key,
    label: tierLabel(key),
    year,
    currency: "EUR",
    amount: record.nightlyOrTotalEur,
    unit: record.pricing === "per-stay" ? "for the whole stay" : "per night",
    note: record.notes,
    source: record.source,
    lastVerified: record.lastVerified,
  };
}

function itemFromTicketGroup(group: GroupedProduct<TicketPackage>, year: number): CatalogueItem {
  const tiers = sortTiers(group.records.map((record) => tierFromTicket(record, year)));
  const [first] = group.records;
  const nights = Math.max(...group.records.map((record) => record.nights));

  return {
    id: group.productId,
    categoryId: "festival-tickets",
    name: baseName(first.name),
    ...(nights > 0 ? { qualifier: `${nights} nights` } : {}),
    includes: first.includes,
    ...(first.notes === undefined ? {} : { note: first.notes }),
    tiers,
    priceStatus: "published",
    badges: saleBadges(tiers),
    source: first.source,
    lastVerified: latestVerified(group.records, first.lastVerified),
  };
}

function itemFromAccommodationGroup(
  group: GroupedProduct<Accommodation>,
  categoryId: string,
  year: number,
): CatalogueItem {
  const tiers = sortTiers(group.records.map((record) => tierFromAccommodation(record, year)));
  const [first] = group.records;
  const capacity = Math.max(...group.records.map((record) => record.capacity));

  return {
    id: group.productId,
    categoryId,
    name: baseName(first.name),
    qualifier: `${capacity} ${capacity === 1 ? "person" : "people"} · for the whole stay`,
    /* The accommodation schema has no inclusion list: what a package contains is
       stated in `notes`, so nothing is presented here as a checklist. */
    includes: [],
    note: first.notes,
    tiers,
    priceStatus: "published",
    badges: saleBadges(tiers),
    source: first.source,
    lastVerified: latestVerified(group.records, first.lastVerified),
  };
}

function windowFromShared(record: SharedSaleWindow): CatalogueSaleWindow {
  return {
    id: record.id,
    name: record.name,
    opensAt: record.opensAt,
    timeZone: record.timeZone,
    audience: record.audience,
    ...(record.notes === undefined ? {} : { notes: record.notes }),
    source: record.source,
    lastVerified: record.lastVerified,
  };
}

/**
 * Renders a date-only record as a readable day, for example "13 February 2027".
 *
 * The schema stores dates as YYYY-MM-DD, which is right for a record and wrong in
 * a sentence. Noon UTC is used so that formatting in any zone stays on the same
 * calendar day: a date has no time, so it must not acquire one.
 */
export function readableDay(isoDate: string, timeZone: string): string {
  const instant = `${isoDate}T12:00:00Z`;
  return formatInstantParts(instant, timeZone, "long").date;
}

/* ---------------------------------------------------------------------------------------------
 * Belgium
 * ------------------------------------------------------------------------------------------- */

/**
 * Official Belgium pages, every one of which appears in a data record or in
 * `docs/factcheck/belgium.md`. No link here is composed by guessing a slug.
 */
const BELGIUM_OFFICIAL: readonly OfficialLink[] = [
  {
    label: "Festival tickets and prices",
    url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/",
  },
  {
    label: "DreamVille accommodation",
    url: "https://belgium.tomorrowland.com/en/tickets/accommodations/",
  },
  {
    label: "Global Journey travel packages",
    url: "https://belgium.tomorrowland.com/en/tickets/global-journey/",
  },
  {
    label: "Exchange Desk",
    url: "https://belgium.tomorrowland.com/en/sales-info/exchange-desk/",
  },
  {
    label: "Official ticket channels",
    url: "https://belgium.tomorrowland.com/en/sales-info/official-ticket-channels/",
  },
];

function belgiumExplainer(): ExplainerRow[] {
  const facts = belgiumFacts;
  const pre = facts.preRegistration.value;
  const caps = facts.ticketCaps.value;
  const desk = facts.exchangeDeskWindow.value;

  return [
    {
      id: "pre-registration",
      term: "Pre-registration",
      detail:
        `Opens ${formatInstantProse(pre.opensAt, BRUSSELS)} and closes ` +
        `${formatInstantProse(pre.closesAt, BRUSSELS)}. Registering is the entry requirement ` +
        "for every sale moment and does not guarantee a ticket.",
      sources: [facts.preRegistration.source],
      lastVerified: facts.preRegistration.lastVerified,
    },
    {
      id: "sale-moments",
      term: "Three sale moments",
      detail:
        "Global Journey travel packages, then the WorldWide Pre-Sale, then the WorldWide Ticket " +
        "Sale, each a week apart and each opening at 17:00 Belgian time. The 2027 cycle publishes " +
        "no Belgian-only sale and no separately dated Friends sale.",
      sources: uniqueSources(belgiumSaleWindows.map((record) => record.source)),
      lastVerified: latestVerified(belgiumSaleWindows, CHECKED_ON),
    },
    {
      id: "ticket-caps",
      term: "Caps per account",
      detail:
        `${caps.perAccount} people per Tomorrowland Account, ${caps.scope} rather than per order, ` +
        `so two bought in the pre-sale leave two for the general sale. Global Journey allows ` +
        `${caps.globalJourneyPerAccount}, the NFT sale is capped at ` +
        `${caps.duringNftSalePerAccount}, and Friendship Garden is exempt from the cap.`,
      sources: [facts.ticketCaps.source],
      lastVerified: facts.ticketCaps.lastVerified,
    },
    {
      id: "exchange-desk",
      term: "The Exchange Desk is the only resale route",
      detail:
        `It opens on ${readableDay(desk.opensOn, BRUSSELS)} and closes on ` +
        `${readableDay(desk.closesOn, BRUSSELS)}. Tickets cannot be cancelled, ` +
        "so listing is the only way back out: a €10 fee per ticket is deducted from the refund, a " +
        "listing is final and cannot be undone, and a listing is not a sale. Global Journey " +
        "packages cannot be listed at all.",
      sources: uniqueSources([
        facts.exchangeDeskWindow.source,
        facts.exchangeDeskFee.source,
        facts.exchangeDeskListing.source,
        facts.exchangeDeskListingNotASale.source,
        facts.exchangeDeskGlobalJourney.source,
      ]),
      lastVerified: latestVerified(
        [
          facts.exchangeDeskWindow,
          facts.exchangeDeskFee,
          facts.exchangeDeskListing,
          facts.exchangeDeskListingNotASale,
          facts.exchangeDeskGlobalJourney,
        ],
        CHECKED_ON,
      ),
    },
    {
      id: "unofficial-resale",
      term: "Buying outside the official channels",
      detail:
        "There are three official routes: the Paylogic ticket shop and the Official Travel Shop, " +
        "both reached through your Tomorrowland Account, and the Official External Travel Partners " +
        "listed by country. Tomorrowland's own guidance is not to buy through the secondary " +
        "market, and tickets resold illegitimately are cancelled, so a cheap ticket can become a " +
        "bracelet refused at the gate.",
      sources: [
        {
          url: "https://belgium.tomorrowland.com/en/sales-info/official-ticket-channels/",
          title: "Tomorrowland Belgium — official ticket channels",
          retrievedOn: CHECKED_ON,
        },
      ],
      lastVerified: CHECKED_ON,
    },
  ];
}

/** The Belgium catalogue: festival passes, DreamVille camping, Montagoe, Global Journey. */
export function buildBelgiumCatalogue(): EditionCatalogue {
  const year = editionYear("belgium");

  const ticketItems = groupByProduct(belgiumTickets).groups.map((group) =>
    itemFromTicketGroup(group, year),
  );

  const camping: CatalogueItem[] = [];
  const montagoe: CatalogueItem[] = [];
  for (const group of groupByProduct(belgiumAccommodation).groups) {
    const [first] = group.records;
    if (first.kind === "dreamville-tent") {
      camping.push(itemFromAccommodationGroup(group, "dreamville", year));
    } else if (first.kind === "dreamville-lodge") {
      montagoe.push(itemFromAccommodationGroup(group, "montagoe", year));
    }
  }

  const categories: CatalogueCategory[] = [
    {
      id: "festival-tickets",
      kicker: "01 · Festival passes",
      label: "Festival tickets",
      description:
        "Day passes and three-day Full Madness passes for the 2027 weekends, each shown at its " +
        "pre-sale and WorldWide sale price.",
      icon: "gift",
      items: sortItems(ticketItems),
    },
    {
      id: "dreamville",
      kicker: "02 · DreamVille",
      label: "DreamVille camping",
      description:
        "Pitches and pre-pitched tents on the DreamVille campsite, priced for the whole stay and " +
        "including one Full Madness pass for each person the package sleeps.",
      icon: "map-pin",
      items: sortItems(camping),
    },
    {
      id: "montagoe",
      kicker: "03 · Montagoe",
      label: "Montagoe lodges",
      description:
        "The lodge end of DreamVille: lockable rooms and units with furniture, from Relax Room to " +
        "Ensuite, priced for the whole stay.",
      icon: "key",
      items: sortItems(montagoe),
    },
    {
      id: "global-journey",
      kicker: "04 · Travel packages",
      label: "Global Journey",
      description:
        "Ticket-and-transport packages sold in their own sale, a week before the WorldWide Pre-Sale.",
      icon: "rocket",
      items: [],
      emptyNote:
        "No 2027 Global Journey package price is published on the official pages checked for this " +
        "guide, so no figure is shown. Rather than estimate one, this section lists no product.",
      emptyUrl: "https://belgium.tomorrowland.com/en/tickets/global-journey/",
    },
  ];

  return {
    edition: "belgium",
    label: EDITION_LABELS.belgium,
    year,
    categories,
    windows: sortWindows(belgiumSaleWindows.map(windowFromShared)),
    explainer: belgiumExplainer(),
    officialLinks: BELGIUM_OFFICIAL,
    checkedOn: latestVerified(
      [...belgiumTickets, ...belgiumAccommodation, ...belgiumSaleWindows],
      CHECKED_ON,
    ),
  };
}

/* ---------------------------------------------------------------------------------------------
 * Winter
 * ------------------------------------------------------------------------------------------- */

/**
 * A Winter product that Tomorrowland lists for 2027 without publishing a price.
 *
 * Each entry is backed by a record that says so in its own words: the 1-Day split
 * comes from the `day-pass-mainstage-split` fact, and the 4-Day ticket from the
 * 7-Day FAQ, which states that neither the 4-Day nor the 1-Day price is published.
 * No entry names a figure.
 */
interface UnpricedWinterProduct {
  id: string;
  name: string;
  qualifier: string;
  missingReason: string;
  officialUrl: string;
  /** The Winter fact whose citation backs this product. */
  factId?: string;
  /** The Winter FAQ whose citation backs this product. */
  faqId?: string;
}

const WINTER_TICKET_PAGE = "https://winter.tomorrowland.com/en/tickets/festival-ticket/";

const WINTER_UNPRICED: readonly UnpricedWinterProduct[] = [
  {
    id: "four-day-festival-ticket",
    name: "4-Day Festival Ticket",
    qualifier: "Four days, 23–26 March 2027",
    missingReason:
      "The official ticket page lists the 4-Day Festival Ticket for 2027 but shows no price, and " +
      "no 2027 package minimum is published either, so there is no official figure to show.",
    officialUrl: WINTER_TICKET_PAGE,
    faqId: "faq-seven-day-ticket-price",
  },
  {
    id: "one-day-festival-ticket-mainstage-closed",
    name: "1-Day Festival Ticket, MainStage closed",
    qualifier: "One day between 20 and 22 March 2027",
    missingReason:
      "The product is confirmed for 2027 without a shown price. The MainStage is closed on these " +
      "days, which is why the ticket is sold as a separate option.",
    officialUrl: WINTER_TICKET_PAGE,
    factId: "day-pass-mainstage-split",
  },
  {
    id: "one-day-festival-ticket-mainstage-open",
    name: "1-Day Festival Ticket, MainStage open",
    qualifier: "One day between 23 and 26 March 2027",
    missingReason:
      "The product is confirmed for 2027 without a shown price. The MainStage is open on these " +
      "days, so this option covers the full evening programme.",
    officialUrl: WINTER_TICKET_PAGE,
    factId: "day-pass-mainstage-split",
  },
];

/** The record that cites an unpriced product, so its card can show a real source. */
function winterRecordFor(product: UnpricedWinterProduct): {
  source: Source;
  lastVerified: string;
} {
  if (product.factId !== undefined) {
    const fact = winterFact(product.factId);
    return { source: fact.source, lastVerified: fact.lastVerified };
  }
  if (product.faqId !== undefined) {
    const faq = winterFaqs.find((record) => record.id === product.faqId);
    if (faq === undefined) {
      throw new Error(`buildWinterCatalogue: no Winter FAQ "${product.faqId}"`);
    }
    return { source: faq.source, lastVerified: faq.lastVerified };
  }
  throw new Error(`buildWinterCatalogue: "${product.id}" cites no record`);
}

function winterFact(id: string): WinterFact {
  const record = winterFacts.find((entry) => entry.id === id);
  if (record === undefined) throw new Error(`the Winter data has no fact "${id}"`);
  return record;
}

function winterExplainer(): ExplainerRow[] {
  /**
   * Renders a Winter fact as an explainer row, appending a sentence only where the
   * fact's own detail stops short of what a buyer needs next.
   */
  const factRow = (id: string, term: string, extra?: string): ExplainerRow => {
    const fact = winterFact(id);
    const parts = [fact.value, fact.detail, extra].filter(
      (part): part is string => part !== undefined && part.trim().length > 0,
    );
    return {
      id,
      term,
      detail: parts.map((part) => part.trim()).join(" "),
      sources: [fact.source],
      lastVerified: fact.lastVerified,
    };
  };

  const desk = winterFact("exchange-desk-window");

  return [
    {
      id: "add-on-sale",
      term: "The one published 2027 sale date",
      detail:
        "The 2027 Add-On Sale opens on " +
        `${formatInstantProse(winterSaleWindows[0].opensAt, BRUSSELS)}. It covers activities, ` +
        "lockers, slope experiences, equipment, ski insurance, shuttles, the Transportation Pass " +
        "and towels.",
      sources: uniqueSources(winterSaleWindows.map((record) => record.source)),
      lastVerified: latestVerified(winterSaleWindows, CHECKED_ON),
    },
    factRow(
      "exchange-desk-window",
      "The Exchange Desk, for ticket-only buyers",
      "Package bookings follow the cancellation ladder instead, and no name change is possible " +
        "after 15 January 2027 on either route.",
    ),
    factRow("package-payment-terms", "Paying for a package"),
    factRow("cancellation-ladder", "Cancelling a package"),
    factRow("name-change-window", "Name changes"),
    {
      id: "unofficial-resale",
      term: "One resale route only",
      detail:
        "The Exchange Desk is the only official resale route. A listing anywhere else is not a " +
        "sale either: nobody is obliged to buy, so an unsold listing returns nothing at all.",
      sources: [desk.source],
      lastVerified: desk.lastVerified,
    },
  ];
}

/** The Winter catalogue: the one published ticket price, the unpublished options, packages. */
export function buildWinterCatalogue(): EditionCatalogue {
  const year = editionYear("winter");

  const priced: CatalogueItem[] = winterTickets.map((ticket) => ({
    id: ticket.id,
    categoryId: "festival-tickets",
    name: ticket.name,
    ...(ticket.nights > 0 ? { qualifier: `${ticket.nights} nights` } : {}),
    includes: ticket.includes,
    ...(ticket.notes === undefined ? {} : { note: ticket.notes }),
    tiers: [
      {
        key: "published",
        label: "Published 2027 price",
        year,
        currency: "EUR",
        amount: ticket.priceEur,
        source: ticket.source,
        lastVerified: ticket.lastVerified,
      },
    ],
    priceStatus: "published",
    badges: [],
    source: ticket.source,
    lastVerified: ticket.lastVerified,
  }));

  const unpriced: CatalogueItem[] = WINTER_UNPRICED.map((product) => {
    const record = winterRecordFor(product);
    return {
      id: product.id,
      categoryId: "festival-tickets",
      name: product.name,
      qualifier: product.qualifier,
      includes: [],
      tiers: [],
      priceStatus: "unpublished",
      missingReason: product.missingReason,
      officialUrl: product.officialUrl,
      badges: ["Price not published"],
      source: record.source,
      lastVerified: record.lastVerified,
    };
  });

  return {
    edition: "winter",
    label: EDITION_LABELS.winter,
    year,
    categories: [
      {
        id: "festival-tickets",
        kicker: "01 · Festival tickets",
        label: "Festival tickets",
        description:
          "Every Winter ticket includes the lift and ski pass, because the mountain stages " +
          "cannot be reached without one.",
        icon: "gift",
        items: sortItems([...priced, ...unpriced]),
      },
      {
        id: "packages",
        kicker: "02 · Packages",
        label: "Ticket and accommodation packages",
        description:
          "Festival access, the lift and ski pass and lodging in Alpe d'Huez or Oz 3300, sold as " +
          "one booking in four accommodation categories.",
        icon: "key",
        items: [],
        emptyNote:
          "No 2027 package price is published: the package sale showed as sold out with no " +
          "minimum price. Lodging is sold only inside a package, so no accommodation price can be " +
          "listed either.",
        emptyUrl: "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation/",
      },
    ],
    windows: sortWindows(winterSaleWindows.map(windowFromShared)),
    explainer: winterExplainer(),
    officialLinks: [
      { label: "Festival tickets", url: WINTER_TICKET_PAGE },
      {
        label: "Ticket and accommodation packages",
        url: "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation/",
      },
      { label: "Add-ons", url: "https://winter.tomorrowland.com/en/add-ons/" },
    ],
    checkedOn: latestVerified(
      [...winterTickets, ...winterAccommodation, ...winterSaleWindows, ...winterFacts],
      CHECKED_ON,
    ),
  };
}

/* ---------------------------------------------------------------------------------------------
 * Brasil
 * ------------------------------------------------------------------------------------------- */

/**
 * Price variants in the order the official price list presents them: the standard
 * pass, the two discounts, then the Bybit early-bird equivalents.
 */
const BRASIL_VARIANT_ORDER: readonly string[] = [
  "standard",
  "half-price",
  "social",
  "bybit-early-bird",
  "bybit-early-bird-half-price",
  "bybit-early-bird-social",
];

const BRASIL_VARIANT_LABELS: Readonly<Record<string, string>> = {
  standard: "Standard",
  "half-price": "Half-price (meia-entrada)",
  social: "Social",
  "bybit-early-bird": "Bybit early bird",
  "bybit-early-bird-half-price": "Bybit early bird, half-price",
  "bybit-early-bird-social": "Bybit early bird, Social",
};

const BRASIL_TIER_LABELS: Readonly<Record<string, string>> = {
  standard: "Standard",
  comfort: "Comfort",
  no1: "N°1",
};

function brasilVariantRank(key: string): number {
  const index = BRASIL_VARIANT_ORDER.indexOf(key);
  return index === -1 ? 99 : index;
}

/**
 * Groups by a key derived from each record, preserving the dataset's order.
 */
function groupBy<T>(records: readonly T[], keyOf: (record: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const key = keyOf(record);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [record]);
    } else {
      group.push(record);
    }
  }
  return groups;
}

/**
 * The product name and URL id for a Brasil DreamVille record.
 *
 * The records name a variant in a suffix: "Solaris 2P Comfort" and "Magnificent
 * Greens 1P — Bybit Early Bird" are variants of "Solaris 2P" and "Magnificent
 * Greens 1P". Stripping those suffixes groups the variants of one unit and nothing
 * else, which grouping by family and capacity would not do if the line-up ever
 * held two 2P units in the same family.
 */
export function brasilPackageKey(name: string): { productName: string; id: string } {
  const withoutMoment = name.replace(/ — Bybit Early Bird$/, "").trim();
  const productName = withoutMoment.replace(/ (?:Comfort|N°1)$/, "").trim();
  const id = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return { productName, id };
}

function brasilTierLabel(saleMoment: string, tier: string): string {
  const tierLabel = BRASIL_TIER_LABELS[tier] ?? tier;
  return saleMoment === "bybit-early-bird" ? `Bybit early bird — ${tierLabel}` : tierLabel;
}

/** The Brasil catalogue: festival passes by product, DreamVille packages by family and size. */
export function buildBrasilCatalogue(): EditionCatalogue {
  const year = editionYear("brasil");
  const { tickets, dreamvillePackages, facts, saleWindows } = brasilData;

  const ticketGroups = groupBy(tickets, (record) => record.product);
  const ticketItems: CatalogueItem[] = [...ticketGroups.values()].map((group) => {
    const tiers: PriceTier[] = [...group]
      .sort((a, b) => brasilVariantRank(a.variant) - brasilVariantRank(b.variant))
      .map((record) => ({
        key: record.variant,
        label: BRASIL_VARIANT_LABELS[record.variant] ?? record.variant,
        year,
        currency: "BRL" as const,
        amount: record.price.amount,
        note: record.notes,
        source: record.source,
        lastVerified: record.lastVerified,
      }));

    const [first] = group;
    const soldOut = group.every((record) => record.availability === "sold-out");
    return {
      id: first.product,
      categoryId: "festival-tickets",
      name: baseName(first.name),
      qualifier: `${first.validDays} ${first.validDays === 1 ? "day" : "days"}`,
      includes: [],
      note: first.notes,
      tiers,
      priceStatus: "published",
      badges: soldOut ? ["Sold out"] : [],
      source: first.source,
      lastVerified: latestVerified(group, first.lastVerified),
    };
  });

  const packageGroups = groupBy(
    dreamvillePackages,
    (record) => brasilPackageKey(record.name).id,
  );
  const packageItems: CatalogueItem[] = [...packageGroups.values()].map((group) => {
    const [first] = group;
    const { productName, id } = brasilPackageKey(first.name);
    const tiers: PriceTier[] = [...group]
      .sort((a, b) => {
        const momentA = a.saleMoment === "bybit-early-bird" ? 1 : 0;
        const momentB = b.saleMoment === "bybit-early-bird" ? 1 : 0;
        if (momentA !== momentB) return momentA - momentB;
        const rank = (tier: string) => ["standard", "comfort", "no1"].indexOf(tier);
        return rank(a.tier) - rank(b.tier);
      })
      .map((record) => ({
        key: `${record.saleMoment}-${record.tier}`,
        label: brasilTierLabel(record.saleMoment, record.tier),
        year,
        currency: "BRL" as const,
        amount: record.price.amount,
        unit: `for ${record.capacity} ${record.capacity === 1 ? "person" : "people"}`,
        note: record.notes,
        source: record.source,
        lastVerified: record.lastVerified,
      }));

    const soldOut = group.every((record) => record.availability === "sold-out");
    return {
      id,
      categoryId: "dreamville",
      name: productName,
      qualifier: `${first.capacity} ${first.capacity === 1 ? "person" : "people"}`,
      includes: [],
      note: first.notes,
      tiers,
      priceStatus: "published",
      badges: soldOut ? ["Sold out"] : [],
      source: first.source,
      lastVerified: latestVerified(group, first.lastVerified),
    };
  });

  const fact = (id: string) => {
    const record = facts.find((entry) => entry.id === id);
    if (record === undefined) throw new Error(`buildBrasilCatalogue: no Brasil fact "${id}"`);
    return record;
  };

  const preRegistration = saleWindows.find((record) => record.id === "pre-registration-2027");
  const cap = fact("ticket-cap");
  const halfPrice = fact("half-price-rule");
  const social = fact("social-ticket-donation");
  const payment = fact("payment-methods");

  const explainer: ExplainerRow[] = [];
  if (preRegistration !== undefined) {
    const closesAt = preRegistration.closesAt ?? preRegistration.opensAt;
    explainer.push({
      id: "pre-registration",
      term: "Pre-registration came first",
      detail:
        "The 2027 pre-registration window ran from " +
        `${formatInstantProse(preRegistration.opensAt, SAO_PAULO)} to ` +
        `${formatInstantProse(closesAt, SAO_PAULO)}. Pre-registration was required to take part ` +
        "in any 2027 Brasil sale moment.",
      sources: [preRegistration.source],
      lastVerified: preRegistration.lastVerified,
    });
  }
  explainer.push(
    {
      id: "ticket-cap",
      term: "Cap per buyer",
      detail: cap.statement,
      sources: [cap.source],
      lastVerified: cap.lastVerified,
    },
    {
      id: "half-price",
      term: "Half-price (meia-entrada)",
      detail:
        "Open to Brazilian citizens only, because the benefit is granted under Brazilian law, and " +
        "proof is checked at the gate. It is a flat R$1,580 off rather than a percentage, so it is " +
        "exactly half on the standard Full Madness pass but about 71% of the Comfort price.",
      sources: [halfPrice.source],
      lastVerified: halfPrice.lastVerified,
    },
    {
      id: "social-ticket",
      term: "The Social ticket",
      detail:
        "Bundles a R$30 donation to the Tomorrowland Foundation and sits a flat R$1,235 below the " +
        "matching standard ticket: 39% on Full Madness, 22% on Full Madness Comfort.",
      sources: [social.source],
      lastVerified: social.lastVerified,
    },
    {
      id: "payment",
      term: "Payment",
      detail: payment.statement,
      sources: [payment.source],
      lastVerified: payment.lastVerified,
    },
    {
      id: "where-to-buy",
      term: "Where to buy",
      detail:
        "Brasil tickets are sold through the official Tomorrowland Brasil ticket pages, which also " +
        "link to the ByInti platform for shuttle passes. Every price on this page comes from those " +
        "official pages; this guide does not check or endorse listings anywhere else.",
      sources: [fact("shuttle-platform-byinti").source, fact("ticket-cap").source],
      lastVerified: fact("shuttle-platform-byinti").lastVerified,
    },
  );

  return {
    edition: "brasil",
    label: EDITION_LABELS.brasil,
    year,
    categories: [
      {
        id: "festival-tickets",
        kicker: "01 · Festival passes",
        label: "Festival passes",
        description:
          "Three-day and one-day passes, each with the price variants Tomorrowland Brasil " +
          "publishes: Standard, Half-price, Social and Bybit early bird.",
        icon: "gift",
        items: sortItems(ticketItems),
      },
      {
        id: "dreamville",
        kicker: "02 · DreamVille",
        label: "DreamVille packages",
        description:
          "Magnificent Greens pitches, Easy Tents and Mística glamping units, sold per person or " +
          "per tent depending on the product.",
        icon: "map-pin",
        items: sortItems(packageItems),
      },
    ],
    windows: sortWindows(
      saleWindows.map((record) => ({
        id: record.id,
        name: record.name,
        opensAt: record.opensAt,
        ...(record.closesAt === undefined ? {} : { closesAt: record.closesAt }),
        timeZone: record.timeZone,
        audience: record.audience,
        notes: record.notes,
        statusLabel:
          record.status === "past" ? "Passed" : record.status === "open" ? "Open" : "Upcoming",
        source: record.source,
        lastVerified: record.lastVerified,
      })),
    ),
    explainer,
    officialLinks: [
      {
        label: "Festival tickets and prices",
        url: "https://brasil.tomorrowland.com/en/tickets/festival-tickets/",
      },
      { label: "All Brasil tickets", url: "https://brasil.tomorrowland.com/en/tickets/" },
    ],
    checkedOn: latestVerified([...tickets, ...dreamvillePackages, ...saleWindows], CHECKED_ON),
  };
}

/* ---------------------------------------------------------------------------------------------
 * Lookup
 * ------------------------------------------------------------------------------------------- */

/**
 * Builds the catalogue for one edition.
 *
 * @throws Error when the edition is not one the page covers.
 */
export function buildCatalogue(edition: TicketEditionId): EditionCatalogue {
  switch (edition) {
    case "belgium":
      return buildBelgiumCatalogue();
    case "winter":
      return buildWinterCatalogue();
    case "brasil":
      return buildBrasilCatalogue();
    default: {
      // Exhaustiveness guard: a new edition must be added above.
      const unreachable: never = edition;
      throw new Error(`buildCatalogue: unsupported edition ${String(unreachable)}`);
    }
  }
}
