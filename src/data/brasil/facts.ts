/**
 * Tomorrowland Brasil — verified data.
 *
 * CURRENCY DECISION. The shared schemas (`schemas/ticket-package.ts`,
 * `schemas/shuttle.ts`, `schemas/accommodation.ts`) store money only as
 * `priceEur`. Tomorrowland Brasil publishes every price in Brazilian reais and
 * no official source states a euro equivalent, so converting would invent an
 * exchange rate. This file therefore defines local schemas that store a price
 * as a whole number of reais with the currency literal "BRL". No reais figure
 * is forced into `priceEur`, and no euro value is derived anywhere.
 *
 * Every record below comes from a `confirmed` or `changed` row of
 * `docs/factcheck/brasil-general.md`, or from a rule `docs/factcheck/conflicts.md`
 * records as resolved. Claims that were unverifiable, outdated or contradicted
 * by their sources are listed in `docs/data/brasil-shared-omissions.md` instead
 * of being published here.
 */
import { z } from "zod";
import { isoInstantSchema, verifiedBase, type Source } from "../schemas";

/** The single verification date for this data set. */
const VERIFIED_ON = "2026-11-18";

/**
 * A price in Brazilian reais, stored as a whole number of reais.
 *
 * Reais are not dealt with in minor units here: Tomorrowland Brasil publishes
 * round figures such as R$3,160.00 with no centavos, so an integer count of
 * reais is lossless and rejects a stray decimal instead of rounding it.
 */
export const brlAmountSchema = z
  .number({ error: "price must be a whole number of Brazilian reais" })
  .int({ error: "price must be a whole number of Brazilian reais" })
  .nonnegative({ error: "price must not be negative" });

export const brlPriceSchema = z.strictObject({
  currency: z.literal("BRL", { error: 'currency must be "BRL"' }),
  amount: brlAmountSchema,
});
export type BrlPrice = z.infer<typeof brlPriceSchema>;

/** Every record in this file describes the Brasil edition. */
const brasilBase = verifiedBase.extend({
  edition: z.literal("brasil", { error: 'edition must be "brasil"' }),
});

/**
 * A published fact that is not a price, a sale moment or a package: venue,
 * history, rules and transport arrangements. `topic` lets a page group records
 * without parsing prose.
 */
export const brasilFactTopicSchema = z.enum(
  ["edition", "venue", "history", "tickets", "half-price", "dreamville", "transport", "sales"],
  {
    error:
      'topic must be "edition", "venue", "history", "tickets", "half-price", "dreamville", "transport" or "sales"',
  },
);
export type BrasilFactTopic = z.infer<typeof brasilFactTopicSchema>;

export const brasilFactSchema = brasilBase
  .extend({
    topic: brasilFactTopicSchema,
    statement: z
      .string({ error: "statement is required" })
      .trim()
      .min(1, { error: "statement is required" })
      .max(2000, { error: "statement must be 2000 characters or fewer" }),
  })
  .strict();
export type BrasilFact = z.infer<typeof brasilFactSchema>;

/** The product a ticket buys, independent of its price variant. */
export const brasilTicketProductSchema = z.enum(
  ["full-madness", "full-madness-comfort", "day-pass", "day-pass-comfort", "day-pass-no1"],
  {
    error:
      'product must be "full-madness", "full-madness-comfort", "day-pass", "day-pass-comfort" or "day-pass-no1"',
  },
);
export type BrasilTicketProduct = z.infer<typeof brasilTicketProductSchema>;

/**
 * The price variant. Early-bird rows stay separate from standard rows because a
 * Bybit price is a different sale moment, not a different pass, and because the
 * half-price and Social prices are flat discounts that do not scale by
 * percentage.
 */
export const brasilTicketVariantSchema = z.enum(
  [
    "standard",
    "half-price",
    "social",
    "bybit-early-bird",
    "bybit-early-bird-half-price",
    "bybit-early-bird-social",
  ],
  {
    error:
      'variant must be "standard", "half-price", "social", "bybit-early-bird", "bybit-early-bird-half-price" or "bybit-early-bird-social"',
  },
);
export type BrasilTicketVariant = z.infer<typeof brasilTicketVariantSchema>;

export const brasilAvailabilitySchema = z.enum(["sold-out", "on-sale"], {
  error: 'availability must be "sold-out" or "on-sale"',
});
export type BrasilAvailability = z.infer<typeof brasilAvailabilitySchema>;

export const brasilTicketSchema = brasilBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    product: brasilTicketProductSchema,
    variant: brasilTicketVariantSchema,
    validDays: z
      .int({ error: "validDays must be a whole number" })
      .min(1, { error: "validDays must be at least 1" })
      .max(3, { error: "validDays must be 3 or fewer" }),
    price: brlPriceSchema,
    availability: brasilAvailabilitySchema,
    notes: z
      .string({ error: "notes are required" })
      .trim()
      .min(1, { error: "notes are required" })
      .max(600, { error: "notes must be 600 characters or fewer" }),
  })
  .strict();
export type BrasilTicket = z.infer<typeof brasilTicketSchema>;

/** The accommodation family a DreamVille package belongs to. */
export const brasilDreamvilleFamilySchema = z.enum(["magnificent-greens", "easy-tent", "mistica"], {
  error: 'family must be "magnificent-greens", "easy-tent" or "mistica"',
});
export type BrasilDreamvilleFamily = z.infer<typeof brasilDreamvilleFamilySchema>;

export const brasilDreamvilleTierSchema = z.enum(["standard", "comfort", "no1"], {
  error: 'tier must be "standard", "comfort" or "no1"',
});
export type BrasilDreamvilleTier = z.infer<typeof brasilDreamvilleTierSchema>;

export const brasilSaleMomentSchema = z.enum(["worldwide", "bybit-early-bird"], {
  error: 'saleMoment must be "worldwide" or "bybit-early-bird"',
});
export type BrasilSaleMoment = z.infer<typeof brasilSaleMomentSchema>;

export const brasilDreamvillePackageSchema = brasilBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    family: brasilDreamvilleFamilySchema,
    tier: brasilDreamvilleTierSchema,
    saleMoment: brasilSaleMomentSchema,
    capacity: z
      .int({ error: "capacity must be a whole number of people" })
      .min(1, { error: "capacity must be at least one person" })
      .max(8, { error: "capacity must be 8 people or fewer" }),
    price: brlPriceSchema,
    availability: brasilAvailabilitySchema,
    notes: z
      .string({ error: "notes are required" })
      .trim()
      .min(1, { error: "notes are required" })
      .max(600, { error: "notes must be 600 characters or fewer" }),
  })
  .strict();
export type BrasilDreamvillePackage = z.infer<typeof brasilDreamvillePackageSchema>;

/**
 * A shuttle service. Per-city fares are not published: the official shop is
 * rendered entirely in JavaScript, so only the published floor price is known,
 * and that lives on a `transport` fact rather than on the service record.
 */
export const brasilShuttleTypeSchema = z.enum(["festival", "dreamville"], {
  error: 'type must be "festival" or "dreamville"',
});
export type BrasilShuttleType = z.infer<typeof brasilShuttleTypeSchema>;

export const brasilShuttleSchema = brasilBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    type: brasilShuttleTypeSchema,
    departureCities: z
      .array(
        z
          .string({ error: "each departure city must be text" })
          .trim()
          .min(1, { error: "a departure city must not be empty" })
          .max(80, { error: "a departure city must be 80 characters or fewer" }),
        { error: "departureCities must be a list of cities" },
      )
      .min(1, { error: "departureCities must list at least one city" })
      .max(12, { error: "departureCities must list 12 cities or fewer" }),
    boardingPoints: z
      .array(
        z
          .string({ error: "each boarding point must be text" })
          .trim()
          .min(1, { error: "a boarding point must not be empty" })
          .max(120, { error: "a boarding point must be 120 characters or fewer" }),
        { error: "boardingPoints must be a list of boarding points" },
      )
      .max(12, { error: "boardingPoints must list 12 points or fewer" }),
    notes: z
      .string({ error: "notes are required" })
      .trim()
      .min(1, { error: "notes are required" })
      .max(600, { error: "notes must be 600 characters or fewer" }),
  })
  .strict();
export type BrasilShuttle = z.infer<typeof brasilShuttleSchema>;

/**
 * A sale moment. This is deliberately local rather than the shared
 * `saleWindowSchema`, which pins `timeZone` to "Europe/Brussels": Brasil sales
 * are announced in BRT (America/Sao_Paulo, UTC-03:00 year round because Brazil
 * abolished daylight saving in 2019).
 */
export const brasilSaleStatusSchema = z.enum(["past", "open", "upcoming"], {
  error: 'status must be "past", "open" or "upcoming"',
});
export type BrasilSaleStatus = z.infer<typeof brasilSaleStatusSchema>;

export const brasilSaleWindowSchema = brasilBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    opensAt: isoInstantSchema,
    closesAt: isoInstantSchema.optional(),
    timeZone: z.literal("America/Sao_Paulo", {
      error: 'timeZone must be "America/Sao_Paulo"',
    }),
    audience: z
      .string({ error: "audience is required" })
      .trim()
      .min(1, { error: "audience is required" })
      .max(160, { error: "audience must be 160 characters or fewer" }),
    status: brasilSaleStatusSchema,
    notes: z
      .string({ error: "notes are required" })
      .trim()
      .min(1, { error: "notes are required" })
      .max(600, { error: "notes must be 600 characters or fewer" }),
  })
  .strict();
export type BrasilSaleWindow = z.infer<typeof brasilSaleWindowSchema>;

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const BRASIL_SITE: Source = {
  url: "https://brasil.tomorrowland.com/",
  title: "Tomorrowland Brasil — official site",
  retrievedOn: VERIFIED_ON,
};

const BRASIL_GUIDE_ARTICLE: Source = {
  url: "https://www.tomorrowland.com/article/tomorrowland-brasil-2027-all-you-need-to-know/",
  title: "Tomorrowland Brasil 2027: all you need to know",
  retrievedOn: VERIFIED_ON,
};

const BRASIL_2025_REVIEW: Source = {
  url: "https://press.brasil.tomorrowland.com/relive-the-magic-of-tomorrowland-brasil-2025",
  title: "Relive the magic of Tomorrowland Brasil 2025",
  retrievedOn: VERIFIED_ON,
};

const BRASIL_BYBIT_PRESALE: Source = {
  url: "https://press.brasil.tomorrowland.com/tomorrowland-brasil-2027",
  title: "Tomorrowland Brasil 2027 press release (Bybit Pre-Sale)",
  retrievedOn: VERIFIED_ON,
};

const PORTAL_OF_TOMORROW: Source = {
  url: "https://press.brasil.tomorrowland.com/tomorrowland-brings-magic-ahead-of-schedule-with-portal-of-tomorrow-by-bybit-paving-the-way-to-tomorrowland-brasil-2027",
  title: "Portal of Tomorrow by Bybit paves the way to Tomorrowland Brasil 2027",
  retrievedOn: VERIFIED_ON,
};

const EARLY_BIRD_PAGE: Source = {
  url: "https://portaldoamanha.tomorrowlandbrasil.com/en",
  title: "Portal do Amanhã — Bybit Early Bird sale information",
  retrievedOn: VERIFIED_ON,
};

const GSHOW_POSTPONEMENT: Source = {
  url: "https://gshow.globo.com/festivais/tomorrowland-brasil/noticia/tomorrowland-brasil-nao-tera-edicao-em-2026-apos-incendio-na-belgica.ghtml",
  title: "Tomorrowland Brasil will not hold a 2026 edition (official statement reproduced by Gshow)",
  retrievedOn: VERIFIED_ON,
};

const FESTIVAL_TICKETS: Source = {
  url: "https://brasil.tomorrowland.com/en/tickets/festival-tickets/",
  title: "Tomorrowland Brasil 2027 festival tickets and prices",
  retrievedOn: VERIFIED_ON,
};

const TICKETS_INDEX: Source = {
  url: "https://brasil.tomorrowland.com/en/tickets/",
  title: "Tomorrowland Brasil 2027 tickets",
  retrievedOn: VERIFIED_ON,
};

const SOCIAL_TICKET_ARTICLE: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/13511236435348",
  title: "What is a Social Ticket?",
  retrievedOn: VERIFIED_ON,
};

const HALF_PRICE_ARTICLE: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/en-us/articles/13511256421780",
  title: "Who is entitled to a half-price (meia-entrada) ticket?",
  retrievedOn: VERIFIED_ON,
};

const TICKET_CAP_ARTICLE: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/14233074960916",
  title: "How many tickets can I buy?",
  retrievedOn: VERIFIED_ON,
};

const PARQUE_MAEDA: Source = {
  url: "https://parquemaeda.com.br/contato/",
  title: "Parque Maeda — contact and address",
  retrievedOn: VERIFIED_ON,
};

const ALOK_DRONE_SHOW: Source = {
  url: "https://press.brasil.tomorrowland.com/alok-makes-history-at-tomorrowland-brazil-breaking-latin-american-record-with-drone-show",
  title: "Alok makes history at Tomorrowland Brasil with a drone show",
  retrievedOn: VERIFIED_ON,
};

const ARRIVAL_OPTIONS: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/41036738826516",
  title: "How do I get to Parque Maeda?",
  retrievedOn: VERIFIED_ON,
};

const DREAMVILLE_STAY: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/13510975314708",
  title: "How does the DreamVille stay work?",
  retrievedOn: VERIFIED_ON,
};

const MAGNIFICENT_GREENS: Source = {
  url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/magnificent-greens/",
  title: "Magnificent Greens packages",
  retrievedOn: VERIFIED_ON,
};

const MAGNIFICENT_GREENS_ARTICLE: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/53208584907028",
  title: "What is included in a Magnificent Greens package?",
  retrievedOn: VERIFIED_ON,
};

const EASY_TENT_ARTICLE: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/53208964543764",
  title: "What is included in an Easy Tent package?",
  retrievedOn: VERIFIED_ON,
};

const EASY_TENT_PACKAGE: Source = {
  url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/easy-tent-package/",
  title: "Easy Tent 2P package",
  retrievedOn: VERIFIED_ON,
};

const MISTICA_INDEX: Source = {
  url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/mistica-packages/",
  title: "Mística packages — 2027 line-up",
  retrievedOn: VERIFIED_ON,
};

const SOLARIS_PACKAGE: Source = {
  url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/mistica-packages/solaris-2p-package/",
  title: "Solaris 2P package",
  retrievedOn: VERIFIED_ON,
};

const GRANDE_PACKAGE: Source = {
  url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/mistica-packages/grande-4p-package/",
  title: "Grande 4P package",
  retrievedOn: VERIFIED_ON,
};

const ADD_ON_INDEX: Source = {
  url: "https://brasil.tomorrowland.com/en/add-on-sale/",
  title: "Tomorrowland Brasil 2027 add-ons",
  retrievedOn: VERIFIED_ON,
};

const FESTIVAL_SHUTTLE: Source = {
  url: "https://brasil.tomorrowland.com/en/add-on-sale/tomorrowland-brasil-shuttle/",
  title: "Tomorrowland Brasil Shuttle",
  retrievedOn: VERIFIED_ON,
};

const DREAMVILLE_SHUTTLE: Source = {
  url: "https://brasil.tomorrowland.com/en/add-on-sale/dreamville-shuttle/",
  title: "DreamVille Shuttle",
  retrievedOn: VERIFIED_ON,
};

const SHUTTLE_FARES: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/17509855783700",
  title: "How much does the official shuttle cost?",
  retrievedOn: VERIFIED_ON,
};

const SHUTTLE_VOUCHER: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/17510657026964",
  title: "Do I need a shuttle voucher for every festival day?",
  retrievedOn: VERIFIED_ON,
};

const SHUTTLE_BOARDING: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/17510505217940",
  title: "Where are the shuttle boarding points?",
  retrievedOn: VERIFIED_ON,
};

const BOX_OFFICE: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/14408278973588",
  title: "Where is the box office?",
  retrievedOn: VERIFIED_ON,
};

const PAYMENT_METHODS: Source = {
  url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/13511229008916",
  title: "Which payment methods are accepted?",
  retrievedOn: VERIFIED_ON,
};

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

export const brasilFacts: readonly BrasilFact[] = [
  {
    id: "no-2026-edition",
    edition: "brasil",
    topic: "edition",
    statement:
      "There is no Tomorrowland Brasil edition in 2026. Tomorrowland calls it a postponement rather than a cancellation: the Orbyz Mainstage was lost in the July 2025 fire, and that was the stage planned to travel to Brazil.",
    source: GSHOW_POSTPONEMENT,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "edition-dates-2027",
    edition: "brasil",
    topic: "edition",
    statement:
      "Tomorrowland Brasil 2027 runs from Friday 30 April to Sunday 2 May 2027 at Parque Maeda, Itu, São Paulo, Brazil.",
    source: BRASIL_SITE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "edition-theme-2027",
    edition: "brasil",
    topic: "edition",
    statement:
      'The 2027 theme is "Consciência", told as one narrative across Tomorrowland Belgium 2026, Tomorrowland Thailand in December 2026 and finally Brasil in 2027.',
    source: BRASIL_GUIDE_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "venue-parque-maeda",
    edition: "brasil",
    topic: "venue",
    statement:
      "Parque Maeda is a rural leisure park in Itu, São Paulo state. The venue operator gives its address as Rodovia Deputado Archimedes Lammoglia, KM 18, Zona Rural, Itu-SP.",
    source: PARQUE_MAEDA,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "venue-history",
    edition: "brasil",
    topic: "history",
    statement:
      "Parque Maeda has hosted every Tomorrowland Brasil edition: the first in 2015, announced by David Guetta at Tomorrowland Belgium in 2014, then 2016, and after a pause the return in 2023, followed by 2024 and 2025. The 2027 edition returns to the same site.",
    source: BRASIL_SITE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "edition-2025",
    edition: "brasil",
    topic: "history",
    statement:
      'The 2025 edition was the fifth, themed "LIFE", held from 10 to 12 October 2025 at Parque Maeda with more than 150 artists across six stages.',
    source: BRASIL_2025_REVIEW,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "edition-2025-drone-show",
    edition: "brasil",
    topic: "history",
    statement:
      "Alok's set on 12 October 2025 closed with a display of more than 1,000 drones above the Mainstage.",
    source: ALOK_DRONE_SHOW,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "portal-of-tomorrow-2026",
    edition: "brasil",
    topic: "history",
    statement:
      "Tomorrowland marked one year to go with Portal of Tomorrow by Bybit on 1 May 2026 at Parque Villa-Lobos in São Paulo.",
    source: PORTAL_OF_TOMORROW,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "half-price-rule",
    edition: "brasil",
    topic: "half-price",
    statement:
      "The meia-entrada (half-price) rate is open only to Brazilian citizens, because the benefit is granted under Brazilian law: a visitor from the UK or the EU cannot buy it. Eligibility follows federal and São Paulo state law and has to be proved at the gate; without proof, the difference up to the full price in force on the festival day is charged. The discount is a flat R$1,580 off the full price, not a percentage. On the R$3,160 Full Madness pass that is exactly half, but the R$3,955 Full Madness Comfort half-price pass is about 71% of the R$5,535 Comfort price, and the R$1,380 Bybit half-price pass is about 47% of the R$2,960 Bybit price. Treat 'half-price' as an accurate label for the standard pass only.",
    source: HALF_PRICE_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "half-price-categories",
    edition: "brasil",
    topic: "half-price",
    statement:
      "Verified meia-entrada categories, all restricted to Brazilian citizens: students with a nationally standardised CIE digital student ID or an equivalent card from an authorised body, where bank slips, enrolment letters and website screenshots are refused; people aged 60 or over with photo ID; people with disabilities plus one companion where assistance is needed, with BPC or INSS documentation and the companion's declaration of need; São Paulo state public-school administrative staff; São Paulo state public-school teachers; and low-income young adults aged 18 to 29 registered in Cadastro Único with family income up to two minimum wages and a valid ID Jovem. Federal Law 12,933/2013 sets the low-income band at 15 to 29, where the operator's own article says 18 to 29.",
    source: HALF_PRICE_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "social-ticket-donation",
    edition: "brasil",
    topic: "tickets",
    statement:
      "The Social ticket bundles a R$30 donation to the Tomorrowland Foundation. The official article calls it a 40% discount, but the published price list is a flat R$1,235 below the matching standard ticket: R$1,925 against R$3,160 on Full Madness, which is 39%, and R$4,300 against R$5,535 on Full Madness Comfort, which is 22%. The site contradicts itself, and the flat figures are the ones on the price list.",
    source: SOCIAL_TICKET_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "ticket-cap",
    edition: "brasil",
    topic: "sales",
    statement:
      "The cap is six tickets per buyer, counted per CPF and per Tomorrowland Account across every sale moment. Two official help-centre articles disagree on whether a separate, lower cap applied during the Bybit Pre-Sale, so no Bybit sub-limit is published here.",
    source: TICKET_CAP_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "comfort-perks-2027",
    edition: "brasil",
    topic: "tickets",
    statement:
      'The 2027 Comfort passes are described officially as offering "premium views, covered terraces, table service, and dedicated waitstaff", with wave-style dining at the MainStage. The earlier description of snack stations and dedicated toilets does not appear in the 2027 wording.',
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "dreamville-site",
    edition: "brasil",
    topic: "dreamville",
    statement:
      "DreamVille is the official campsite next to the Parque Maeda festival grounds. A stay runs five days, Thursday to Monday, and opens with The Gathering on Thursday 29 April 2027, the day before the festival starts.",
    source: DREAMVILLE_STAY,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "dreamville-per-person",
    edition: "brasil",
    topic: "dreamville",
    statement:
      'DreamVille access is sold per person only for Magnificent Greens 1P. An Easy Tent is sold per tent for two people, and a Grande unit is sold per accommodation for four, so the "per person, not per tent" rule does not hold across the whole campsite.',
    source: MAGNIFICENT_GREENS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "dreamville-magnificent-greens",
    edition: "brasil",
    topic: "dreamville",
    statement:
      "A Magnificent Greens pitch is bring-your-own: campers bring their own equipment and choose where to put their tent.",
    source: MAGNIFICENT_GREENS_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "dreamville-easy-tent",
    edition: "brasil",
    topic: "dreamville",
    statement:
      "An Easy Tent arrives pre-pitched: a limited-edition Tomorrowland tent with a double air mattress and two sleeping bags ready on arrival.",
    source: EASY_TENT_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "dreamville-mistica-lineup",
    edition: "brasil",
    topic: "dreamville",
    statement:
      "The 2027 Mística glamping line-up is Solaris 2P, Luna 2P, Luna 2P Supreme, Dreamlodge, Nomade, Orion, Argo and Grande 4P. That is the whole list published on the Mística package index.",
    source: MISTICA_INDEX,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "dreamville-luna-prices",
    edition: "brasil",
    topic: "dreamville",
    statement:
      "The 2027 Mística index lists the Luna line as R$20,049, R$24,599 and R$32,959, with the product names Luna 2P and Luna 2P Supreme. The page does not say which of the three figures belongs to which Luna variant, so the prices are recorded here exactly as published rather than being split into per-tier package records.",
    source: MISTICA_INDEX,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "dreamville-tiers",
    edition: "brasil",
    topic: "dreamville",
    statement:
      "DreamVille packages come in three tiers. Comfort variants include Full Madness Comfort passes and the Comfort areas; N°1 variants are the top hospitality tier and include all Comfort areas plus the N°1 Area.",
    source: GRANDE_PACKAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "add-on-shop-2027",
    edition: "brasil",
    topic: "transport",
    statement:
      "At the time of checking, the 2027 add-on shop listed only two products, the Tomorrowland Brasil Shuttle and the DreamVille Shuttle, and said more products would follow. No parking, locker or breakfast product appeared in the listing.",
    source: ADD_ON_INDEX,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "arrival-options",
    edition: "brasil",
    topic: "transport",
    statement:
      "The official help centre lists four ways to reach Parque Maeda: the official shuttle, the Ônibus Circular de Itu, your own vehicle, and ride-hailing apps.",
    source: ARRIVAL_OPTIONS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "shuttle-meeting-point",
    edition: "brasil",
    topic: "transport",
    statement: "The festival shuttle stop is 300 metres from the Main Entrance.",
    source: FESTIVAL_SHUTTLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "shuttle-fares",
    edition: "brasil",
    topic: "transport",
    statement:
      "Festival shuttle fares start at R$220 and depend on the departure city. Because one voucher covers one festival day, a three-day attendee leaving from São Paulo pays from R$660 in total, not R$220.",
    source: SHUTTLE_FARES,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "shuttle-voucher-per-day",
    edition: "brasil",
    topic: "transport",
    statement:
      "A shuttle voucher is valid for a single festival day. Anyone holding a Full Madness pass needs three vouchers, one per day, so the fare is never a single weekend price.",
    source: SHUTTLE_VOUCHER,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "shuttle-boarding-points",
    edition: "brasil",
    topic: "transport",
    statement:
      "Festival shuttle boarding points are Hotel Holiday Inn Anhembi and Hotel Hilton Morumbi in São Paulo, plus Barueri, São Bernardo do Campo, Campinas and Rio de Janeiro. DreamVille travellers board at Hotel Holiday Inn Anhembi, Guarulhos International Airport or Campinas.",
    source: SHUTTLE_BOARDING,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "shuttle-platform-byinti",
    edition: "brasil",
    topic: "transport",
    statement:
      "Shuttle passes are sold through the ByInti ticket platform, which the official tickets page links to. Fares and timings are shown only inside that shop.",
    source: TICKETS_INDEX,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "box-office",
    edition: "brasil",
    topic: "sales",
    statement:
      "The box office is at Teatro Renault, Avenida Brigadeiro Luís Antônio 411, República, São Paulo.",
    source: BOX_OFFICE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "payment-methods",
    edition: "brasil",
    topic: "sales",
    statement:
      "Accepted payment is Mastercard, Visa, Elo and Google Pay, and the box office also takes debit cards; corporate cards are refused. American Express appears on no official page, and Pix appears on the ticket page but not in the payment help article, so treat Pix as unconfirmed.",
    source: PAYMENT_METHODS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
];

// ---------------------------------------------------------------------------
// Festival tickets
// ---------------------------------------------------------------------------

export const brasilTickets: readonly BrasilTicket[] = [
  {
    id: "full-madness",
    edition: "brasil",
    name: "Full Madness Pass",
    product: "full-madness",
    variant: "standard",
    validDays: 3,
    price: { currency: "BRL", amount: 3160 },
    availability: "sold-out",
    notes: "Three-day pass covering Friday, Saturday and Sunday.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "full-madness-half-price",
    edition: "brasil",
    name: "Full Madness Pass — Half-Price (Meia-Entrada)",
    product: "full-madness",
    variant: "half-price",
    validDays: 3,
    price: { currency: "BRL", amount: 1580 },
    availability: "sold-out",
    notes:
      "Brazilian citizens only, with proof of eligibility at the gate. On this pass alone the flat R$1,580 discount works out at exactly half the standard price.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "full-madness-social",
    edition: "brasil",
    name: "Full Madness Pass — Social",
    product: "full-madness",
    variant: "social",
    validDays: 3,
    price: { currency: "BRL", amount: 1925 },
    availability: "sold-out",
    notes:
      "Includes the R$30 donation to the Tomorrowland Foundation and sits 39% below the R$3,160 standard pass.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "full-madness-comfort",
    edition: "brasil",
    name: "Full Madness Comfort Pass",
    product: "full-madness-comfort",
    variant: "standard",
    validDays: 3,
    price: { currency: "BRL", amount: 5535 },
    availability: "sold-out",
    notes:
      "Three-day pass with the Comfort areas: premium views, covered terraces, table service and dedicated waitstaff.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "full-madness-comfort-half-price",
    edition: "brasil",
    name: "Full Madness Comfort Pass — Half-Price (Meia-Entrada)",
    product: "full-madness-comfort",
    variant: "half-price",
    validDays: 3,
    price: { currency: "BRL", amount: 3955 },
    availability: "sold-out",
    notes:
      "Brazilian citizens only. The flat R$1,580 discount leaves this at about 71% of the R$5,535 Comfort price, so the half-price label misleads on this tier.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "full-madness-comfort-social",
    edition: "brasil",
    name: "Full Madness Comfort Pass — Social",
    product: "full-madness-comfort",
    variant: "social",
    validDays: 3,
    price: { currency: "BRL", amount: 4300 },
    availability: "sold-out",
    notes:
      "Comfort pass with the R$30 Tomorrowland Foundation donation, R$1,235 below the standard Comfort price.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "bybit-full-madness",
    edition: "brasil",
    name: "Full Madness Pass — Bybit Early Bird",
    product: "full-madness",
    variant: "bybit-early-bird",
    validDays: 3,
    price: { currency: "BRL", amount: 2960 },
    availability: "sold-out",
    notes:
      "Early-bird price from the 12 May 2026 Bybit sale, a flat R$200 below the R$3,160 standard pass. The advertised 20% headline does not describe this discount.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "bybit-full-madness-half-price",
    edition: "brasil",
    name: "Full Madness Pass — Bybit Early Bird, Half-Price (Meia-Entrada)",
    product: "full-madness",
    variant: "bybit-early-bird-half-price",
    validDays: 3,
    price: { currency: "BRL", amount: 1380 },
    availability: "sold-out",
    notes:
      "Brazilian citizens only. At R$1,380 against R$2,960 this is about 47% of the early-bird price, and well under half of the R$3,160 standard price.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "bybit-full-madness-social",
    edition: "brasil",
    name: "Full Madness Pass — Bybit Early Bird, Social",
    product: "full-madness",
    variant: "bybit-early-bird-social",
    validDays: 3,
    price: { currency: "BRL", amount: 1725 },
    availability: "sold-out",
    notes:
      "Early-bird Social pass, a flat R$1,235 below the matching standard product and including the R$30 donation.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "bybit-full-madness-comfort",
    edition: "brasil",
    name: "Full Madness Comfort Pass — Bybit Early Bird",
    product: "full-madness-comfort",
    variant: "bybit-early-bird",
    validDays: 3,
    price: { currency: "BRL", amount: 5335 },
    availability: "sold-out",
    notes: "Early-bird Comfort pass, a flat R$200 below the R$5,535 standard Comfort price.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "bybit-full-madness-comfort-half-price",
    edition: "brasil",
    name: "Full Madness Comfort Pass — Bybit Early Bird, Half-Price (Meia-Entrada)",
    product: "full-madness-comfort",
    variant: "bybit-early-bird-half-price",
    validDays: 3,
    price: { currency: "BRL", amount: 3755 },
    availability: "sold-out",
    notes:
      "Brazilian citizens only. About 70% of the R$5,335 early-bird Comfort price, so not a true half.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "bybit-full-madness-comfort-social",
    edition: "brasil",
    name: "Full Madness Comfort Pass — Bybit Early Bird, Social",
    product: "full-madness-comfort",
    variant: "bybit-early-bird-social",
    validDays: 3,
    price: { currency: "BRL", amount: 4100 },
    availability: "sold-out",
    notes:
      "Early-bird Comfort Social pass, a flat R$1,235 below the matching standard Comfort product.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "day-pass",
    edition: "brasil",
    name: "Day Pass",
    product: "day-pass",
    variant: "standard",
    validDays: 1,
    price: { currency: "BRL", amount: 1270 },
    availability: "sold-out",
    notes: "Single-day pass.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "day-pass-half-price",
    edition: "brasil",
    name: "Day Pass — Half-Price (Meia-Entrada)",
    product: "day-pass",
    variant: "half-price",
    validDays: 1,
    price: { currency: "BRL", amount: 635 },
    availability: "sold-out",
    notes: "Brazilian citizens only, with proof of eligibility at the gate.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "day-pass-comfort",
    edition: "brasil",
    name: "Day Comfort Pass",
    product: "day-pass-comfort",
    variant: "standard",
    validDays: 1,
    price: { currency: "BRL", amount: 2220 },
    availability: "sold-out",
    notes: "Single day with Comfort-area access.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "day-pass-no1",
    edition: "brasil",
    name: "Day N°1 Pass",
    product: "day-pass-no1",
    variant: "standard",
    validDays: 1,
    price: { currency: "BRL", amount: 3455 },
    availability: "sold-out",
    notes: "Single day at the top N°1 hospitality tier.",
    source: FESTIVAL_TICKETS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
];

// ---------------------------------------------------------------------------
// DreamVille packages
// ---------------------------------------------------------------------------

export const brasilDreamvillePackages: readonly BrasilDreamvillePackage[] = [
  {
    id: "magnificent-greens-1p",
    edition: "brasil",
    name: "Magnificent Greens 1P",
    family: "magnificent-greens",
    tier: "standard",
    saleMoment: "worldwide",
    capacity: 1,
    price: { currency: "BRL", amount: 2565 },
    availability: "sold-out",
    notes: "One person, bringing their own tent and choosing a pitch.",
    source: MAGNIFICENT_GREENS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "magnificent-greens-1p-comfort",
    edition: "brasil",
    name: "Magnificent Greens 1P Comfort",
    family: "magnificent-greens",
    tier: "comfort",
    saleMoment: "worldwide",
    capacity: 1,
    price: { currency: "BRL", amount: 4940 },
    availability: "sold-out",
    notes: "One person in a Magnificent Greens pitch with a Full Madness Comfort pass.",
    source: MAGNIFICENT_GREENS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "magnificent-greens-1p-bybit",
    edition: "brasil",
    name: "Magnificent Greens 1P — Bybit Early Bird",
    family: "magnificent-greens",
    tier: "standard",
    saleMoment: "bybit-early-bird",
    capacity: 1,
    price: { currency: "BRL", amount: 2365 },
    availability: "sold-out",
    notes: "One person at the early-bird price, a flat R$200 below the standard package.",
    source: MAGNIFICENT_GREENS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "magnificent-greens-1p-bybit-comfort",
    edition: "brasil",
    name: "Magnificent Greens 1P Comfort — Bybit Early Bird",
    family: "magnificent-greens",
    tier: "comfort",
    saleMoment: "bybit-early-bird",
    capacity: 1,
    price: { currency: "BRL", amount: 4740 },
    availability: "sold-out",
    notes: "One person with Comfort access at the early-bird price.",
    source: MAGNIFICENT_GREENS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "easy-tent-2p",
    edition: "brasil",
    name: "Easy Tent 2P",
    family: "easy-tent",
    tier: "standard",
    saleMoment: "worldwide",
    capacity: 2,
    price: { currency: "BRL", amount: 7609 },
    availability: "sold-out",
    notes:
      "Priced for two people sharing one pre-pitched tent, with a double air mattress and two sleeping bags.",
    source: EASY_TENT_PACKAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "easy-tent-2p-comfort",
    edition: "brasil",
    name: "Easy Tent 2P Comfort",
    family: "easy-tent",
    tier: "comfort",
    saleMoment: "worldwide",
    capacity: 2,
    price: { currency: "BRL", amount: 12359 },
    availability: "sold-out",
    notes: "Two people in a pre-pitched tent with Full Madness Comfort passes.",
    source: EASY_TENT_PACKAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "easy-tent-2p-no1",
    edition: "brasil",
    name: "Easy Tent 2P N°1",
    family: "easy-tent",
    tier: "no1",
    saleMoment: "worldwide",
    capacity: 2,
    price: { currency: "BRL", amount: 20719 },
    availability: "sold-out",
    notes: "Two people in a pre-pitched tent with Full Madness N°1 passes.",
    source: EASY_TENT_PACKAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "solaris-2p",
    edition: "brasil",
    name: "Solaris 2P",
    family: "mistica",
    tier: "standard",
    saleMoment: "worldwide",
    capacity: 2,
    price: { currency: "BRL", amount: 14205 },
    availability: "sold-out",
    notes: "Two-person Mística glamping unit.",
    source: SOLARIS_PACKAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "solaris-2p-comfort",
    edition: "brasil",
    name: "Solaris 2P Comfort",
    family: "mistica",
    tier: "comfort",
    saleMoment: "worldwide",
    capacity: 2,
    price: { currency: "BRL", amount: 18955 },
    availability: "sold-out",
    notes: "Two-person Mística unit with Full Madness Comfort passes.",
    source: SOLARIS_PACKAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "solaris-2p-no1",
    edition: "brasil",
    name: "Solaris 2P N°1",
    family: "mistica",
    tier: "no1",
    saleMoment: "worldwide",
    capacity: 2,
    price: { currency: "BRL", amount: 27315 },
    availability: "sold-out",
    notes: "Two-person Mística unit with Full Madness N°1 passes.",
    source: SOLARIS_PACKAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "grande-4p",
    edition: "brasil",
    name: "Grande 4P",
    family: "mistica",
    tier: "standard",
    saleMoment: "worldwide",
    capacity: 4,
    price: { currency: "BRL", amount: 25599 },
    availability: "sold-out",
    notes: "Four-person Mística accommodation, priced for the whole unit.",
    source: GRANDE_PACKAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "grande-4p-comfort",
    edition: "brasil",
    name: "Grande 4P Comfort",
    family: "mistica",
    tier: "comfort",
    saleMoment: "worldwide",
    capacity: 4,
    price: { currency: "BRL", amount: 35099 },
    availability: "sold-out",
    notes: "Four-person unit with Full Madness Comfort passes.",
    source: GRANDE_PACKAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "grande-4p-no1",
    edition: "brasil",
    name: "Grande 4P N°1",
    family: "mistica",
    tier: "no1",
    saleMoment: "worldwide",
    capacity: 4,
    price: { currency: "BRL", amount: 51819 },
    availability: "sold-out",
    notes: "Four-person unit with Full Madness N°1 passes and the N°1 Area.",
    source: GRANDE_PACKAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
];

// ---------------------------------------------------------------------------
// Shuttles
// ---------------------------------------------------------------------------

export const brasilShuttles: readonly BrasilShuttle[] = [
  {
    id: "festival-shuttle",
    edition: "brasil",
    name: "Tomorrowland Brasil Shuttle",
    type: "festival",
    departureCities: ["São Paulo", "Barueri", "Campinas", "São Bernardo", "Rio de Janeiro"],
    boardingPoints: ["Hotel Holiday Inn Anhembi, São Paulo", "Hotel Hilton Morumbi, São Paulo"],
    notes:
      "Runs to and from the festival for day and Full Madness ticket holders. One voucher covers one festival day; the stop is 300 metres from the Main Entrance; fares start at R$220 per person and depend on the departure city.",
    source: FESTIVAL_SHUTTLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "dreamville-shuttle",
    edition: "brasil",
    name: "DreamVille Shuttle",
    type: "dreamville",
    departureCities: ["São Paulo", "Campinas"],
    boardingPoints: [
      "Hotel Holiday Inn Anhembi, São Paulo",
      "Guarulhos International Airport (GRU)",
      "Campinas",
    ],
    notes:
      "A round trip from São Paulo or Campinas on the Thursday before the festival, for DreamVille guests. The fare is shown only inside the ticket shop.",
    source: DREAMVILLE_SHUTTLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
];

// ---------------------------------------------------------------------------
// Sale windows
// ---------------------------------------------------------------------------

export const brasilSaleWindows: readonly BrasilSaleWindow[] = [
  {
    id: "pre-registration-2027",
    edition: "brasil",
    name: "2027 pre-registration window",
    opensAt: "2026-04-30T10:00:00-03:00",
    closesAt: "2026-09-23T23:59:00-03:00",
    timeZone: "America/Sao_Paulo",
    audience: "Everyone intending to buy, through a Tomorrowland Account",
    status: "past",
    notes:
      "Ran from 30 April 2026 at 10:00 BRT to 23 September 2026 at 23:59 BRT. Pre-registration was required to take part in any 2027 Brasil sale moment.",
    source: BRASIL_GUIDE_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "bybit-early-bird-2026",
    edition: "brasil",
    name: "Bybit Early Bird sale",
    opensAt: "2026-05-12T10:00:00-03:00",
    timeZone: "America/Sao_Paulo",
    audience: "Bybit users, for Full Madness and Magnificent Greens products",
    status: "past",
    notes:
      "Opened on 12 May 2026 at 10:00 BRT (15:00 CEST) and ran for 48 hours or until sold out. The page advertised up to 20% off capped at R$400, but the published early-bird Full Madness price is a flat R$200 below standard, so that headline does not describe the Full Madness discount.",
    source: EARLY_BIRD_PAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "global-journey-2026",
    edition: "brasil",
    name: "Global Journey travel package sale",
    opensAt: "2026-09-15T10:00:00-03:00",
    timeZone: "America/Sao_Paulo",
    audience: "Global Journey travel package buyers",
    status: "past",
    notes:
      "Opened on 15 September 2026 at 10:00 BRT (15:00 CEST). 17 September was the originally announced date and still appears on two official pages, but the definitive 2027 article and the 4 September 2026 release both give 15 September, which is the corrected date.",
    source: BRASIL_GUIDE_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "bybit-pre-sale-2026",
    edition: "brasil",
    name: "Bybit Pre-Sale",
    opensAt: "2026-09-21T10:00:00-03:00",
    closesAt: "2026-09-23T23:59:00-03:00",
    timeZone: "America/Sao_Paulo",
    audience: "Bybit users, for festival passes and DreamVille packages",
    status: "past",
    notes:
      "Ran from 21 to 23 September 2026, opening at 10:00 BRT. Two official help-centre articles disagree on whether a separate per-account cap applied in this window, so no Bybit sub-limit is published.",
    source: BRASIL_BYBIT_PRESALE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "worldwide-ticket-sale-2026",
    edition: "brasil",
    name: "WorldWide Ticket Sale",
    opensAt: "2026-09-24T10:00:00-03:00",
    timeZone: "America/Sao_Paulo",
    audience: "General sale: festival passes, DreamVille packages and shuttle passes",
    status: "past",
    notes:
      "Opened on 24 September 2026 at 10:00 BRT. Shuttle passes went on sale in the same moment.",
    source: BRASIL_GUIDE_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
];

/** Every Brasil collection, for callers that want one object. */
export const brasilCollections = {
  facts: brasilFacts,
  tickets: brasilTickets,
  dreamvillePackages: brasilDreamvillePackages,
  shuttles: brasilShuttles,
  saleWindows: brasilSaleWindows,
} as const;

/** The one date every Brasil record was checked against. */
export const BRASIL_LAST_VERIFIED = VERIFIED_ON;
