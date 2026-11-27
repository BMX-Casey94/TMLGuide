import { z } from "zod";
import { editionIdSchema, httpsUrlSchema, isoDateSchema } from "../schemas";

/**
 * Unofficial food-stall types and drink price ranges for Tomorrowland
 * Belgium, Winter and Brasil.
 *
 * Nothing here is a Tomorrowland price list. Each figure is the span printed
 * by one public report, checked on 27 November 2026. A single listed amount
 * is not stretched into a range, and no currency is converted.
 *
 * `low` and `high` are integers in minor units:
 * - EUR: euro cents
 * - BRL: centavos
 * - pearls: hundredths of a Pearl, so 150 means 1.50 Pearls and 375 means
 *   3.75 Pearls. Whole Pearl counts cannot hold the quarters these menus use.
 *   The human amount is repeated in `summary`.
 *
 * Deliberately left without a stored range, because the source did not give
 * one: Belgium pizza and waffles in the Festileaks article (a floor only;
 * the ranges below come from the 2026 rows on festivalviewer instead);
 * Belgium coffee in the July 2026 attendee thread; Winter fries (one
 * approximate figure); Winter tartiflette; Brasil pizza and mineral water
 * (one amount each). Winter has no sourced water or coffee price. Brasil has
 * no sourced waffle or coffee-stall price. A YouTube transcript that rendered
 * a chicken burger as "750 pearls" was not used.
 */

const CHECKED_ON = "2026-11-27";

const foodEstimateSourceSchema = z.strictObject({
  url: httpsUrlSchema,
  title: z
    .string({ error: "source title is required" })
    .trim()
    .min(1, { error: "source title is required" })
    .max(200, { error: "source title must be 200 characters or fewer" }),
  publishedOn: isoDateSchema.nullable(),
  checkedOn: isoDateSchema,
});

const boundSchema = z
  .int({ error: "a price bound must be an integer in minor units" })
  .positive({ error: "a price bound must be greater than zero" })
  .nullable();

export const foodEstimateSchema = z
  .strictObject({
    edition: editionIdSchema,
    kind: z.enum(["stall-type", "price-range"], {
      error: 'kind must be "stall-type" or "price-range"',
    }),
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    summary: z
      .string({ error: "summary is required" })
      .trim()
      .min(1, { error: "summary is required" })
      .max(900, { error: "summary must be 900 characters or fewer" }),
    currency: z.enum(["EUR", "BRL", "pearls"]).nullable(),
    low: boundSchema,
    high: boundSchema,
    source: foodEstimateSourceSchema,
    confidence: z.literal("community-estimate", {
      error: 'confidence must be "community-estimate"',
    }),
  })
  .superRefine((record, ctx) => {
    const priced = record.currency !== null;
    if (priced !== (record.low !== null) || priced !== (record.high !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["currency"],
        message: "currency, low and high must all be set, or all be empty",
      });
    }
    if (record.low !== null && record.high !== null && record.low > record.high) {
      ctx.addIssue({
        code: "custom",
        path: ["high"],
        message: "low must not be greater than high",
      });
    }
    if (record.kind === "price-range" && !priced) {
      ctx.addIssue({
        code: "custom",
        path: ["kind"],
        message: "a price range needs a currency and both bounds",
      });
    }
    if (record.currency === "EUR" && record.edition === "brasil") {
      ctx.addIssue({
        code: "custom",
        path: ["currency"],
        message: "euro ranges are only for Belgium and Winter",
      });
    }
    if (record.currency === "BRL" && record.edition !== "brasil") {
      ctx.addIssue({
        code: "custom",
        path: ["currency"],
        message: "real ranges are only for Brasil",
      });
    }
  });

export type FoodEstimate = z.infer<typeof foodEstimateSchema>;

export const foodEstimatesSchema = z.array(foodEstimateSchema);

export const FOOD_ESTIMATE_DISCLAIMER =
  "These are community estimates, not official Tomorrowland prices. They change by stall and by year, so check the price on site before you pay. Where a range is stored, low and high are integers in minor units: euro cents, Brazilian centavos, or hundredths of a Pearl, so 150 means 1.50 Pearls. A record with no currency has no sourced range.";

const FESTILEAKS_2026 = {
  url: "https://festileaks.com/2026/07/dit-is-de-prijslijst-van-tomorrowland-2026/",
  title: "Dit is de prijslijst van Tomorrowland 2026",
  publishedOn: "2026-07-16",
  checkedOn: CHECKED_ON,
} as const;

const FESTIVALVIEWER_2026 = {
  url: "https://festivalviewer.com/tomorrowland/prices",
  title: "Food & Drink Prices — Tomorrowland 2026",
  publishedOn: null,
  checkedOn: CHECKED_ON,
} as const;

const RETAILDETAIL_LIDL = {
  url: "https://www.retaildetail.eu/news/food/in-pictures-lidl-at-tomorrowland-from-pastries-to-camping-gear/",
  title: "Lidl at Tomorrowland: from pastries to camping gear",
  publishedOn: "2026-07-17",
  checkedOn: CHECKED_ON,
} as const;

const REDDIT_COFFEE_2026 = {
  url: "https://www.reddit.com/r/Tomorrowland/comments/1v1ctsn/for_all_w2_coffee_lovers/",
  title: "For all W2 coffee lovers",
  publishedOn: "2026-07-20",
  checkedOn: CHECKED_ON,
} as const;

const TML_GUIDE_DRINKS_2025 = {
  url: "https://www.tml.guide/guides/summer-drinks",
  title: "Tomorrowland Belgium — Drinks & Beverages",
  publishedOn: "2025-06-03",
  checkedOn: CHECKED_ON,
} as const;

const WINTER_QUICK_GUIDE = {
  url: "https://www.tml.guide/guides/winter-quickguide",
  title: "Tomorrowland Winter — Quick Reference Guide",
  publishedOn: "2024-12-04",
  checkedOn: CHECKED_ON,
} as const;

const WINTER_STAGES = {
  url: "https://www.tml.guide/guides/winter-stages",
  title: "Tomorrowland Winter — Stages, Food & Opening Times",
  publishedOn: "2024-12-04",
  checkedOn: CHECKED_ON,
} as const;

const BRASIL_FAN_MENU = {
  url: "https://fastomorrow.com/lab/precos-no-festival/",
  title: "Preços no Festival — Fãs Tomorrow Lab",
  publishedOn: null,
  checkedOn: CHECKED_ON,
} as const;

const BRASIL_DREAMVILLE_GUIDE = {
  url: "https://dropdaily.com.br/agenda/festival/guia-completo-tomorrowland-brasil-2025/",
  title: "Guia completo Tomorrowland Brasil 2025",
  publishedOn: "2025-09-30",
  checkedOn: CHECKED_ON,
} as const;

const COMMUNITY = "community-estimate" as const;

function say(...parts: readonly string[]): string {
  return parts.join(" ");
}

export const foodEstimates: readonly FoodEstimate[] = foodEstimatesSchema.parse([
  {
    edition: "belgium",
    kind: "stall-type",
    name: "Frites",
    summary: say(
      "Festileaks lists a small portion at €6.65 and a large portion at €9.03 for Belgium 2026.",
      "Those printed euro amounts are stored as 665 to 903 cents.",
      "The article also states that one Pearl costs €1.90.",
      "Loaded fries are not in this table.",
    ),
    currency: "EUR",
    low: 665,
    high: 903,
    source: FESTILEAKS_2026,
    confidence: COMMUNITY,
  },
  {
    edition: "belgium",
    kind: "stall-type",
    name: "Burgers",
    summary: say(
      "Festileaks lists a chicken burger at €12.35 and a Tomorrowland burger at €13.30 for Belgium 2026.",
      "Those are the only two burgers in the table, stored as 1235 to 1330 cents.",
      "Other burgers on site are outside this span.",
    ),
    currency: "EUR",
    low: 1235,
    high: 1330,
    source: FESTILEAKS_2026,
    confidence: COMMUNITY,
  },
  {
    edition: "belgium",
    kind: "stall-type",
    name: "Pizza",
    summary: say(
      "Rows tagged 2026 whose name contains Pizza run from 5.50 Pearls for a festival-site margherita to 8.75 Pearls for the DreamVille pulled pork, salami and serrano pizzas.",
      "Stored as 550 to 875 hundredths of a Pearl.",
      "Pinsa, pasta and half portions are left out.",
      "The page header says one Pearl equals €1.82, which does not match the euro amounts printed beside the rows, so euros are not stored.",
    ),
    currency: "pearls",
    low: 550,
    high: 875,
    source: FESTIVALVIEWER_2026,
    confidence: COMMUNITY,
  },
  {
    edition: "belgium",
    kind: "stall-type",
    name: "Waffles",
    summary: say(
      "Waffle rows tagged 2026 on the festival site run from a plain waffle at 3.25 Pearls to a Dubai chocolate waffle at 6.25 Pearls.",
      "Stored as 325 to 625 hundredths of a Pearl.",
      "Older waffle rows on the same page are ignored.",
      "The page header says one Pearl equals €1.82, which does not match the euro amounts printed beside the rows, so euros are not stored.",
    ),
    currency: "pearls",
    low: 325,
    high: 625,
    source: FESTIVALVIEWER_2026,
    confidence: COMMUNITY,
  },
  {
    edition: "belgium",
    kind: "stall-type",
    name: "Vegetarian food",
    summary: say(
      "Dishes tagged 2026 whose names say vegan, veggie, vegetarian or falafel run from a vegan ice cream at 2.50 Pearls to a vegan ball with a side at 9.50 Pearls, on the festival site and in DreamVille.",
      "Stored as 250 to 950 hundredths of a Pearl.",
      "This is the span of those named dishes, not the menu of one stall.",
      "The page header says one Pearl equals €1.82, which does not match the euro amounts printed beside the rows, so euros are not stored.",
    ),
    currency: "pearls",
    low: 250,
    high: 950,
    source: FESTIVALVIEWER_2026,
    confidence: COMMUNITY,
  },
  {
    edition: "belgium",
    kind: "stall-type",
    name: "DreamVille marketplace supermarket and bakery",
    summary: say(
      "RetailDetail reports a Lidl supermarket and a separate bakery at DreamVille for the Belgium 2026 weekends, and says the prices match a regular Lidl nearby.",
      "The article gives no item price, so no range is stored.",
    ),
    currency: null,
    low: null,
    high: null,
    source: RETAILDETAIL_LIDL,
    confidence: COMMUNITY,
  },
  {
    edition: "belgium",
    kind: "stall-type",
    name: "Coffee stands",
    summary: say(
      "A weekend-two thread, posted on 20 July 2026, names coffee stands at Papillon and at Brasa.",
      "Two attendees each report 6 Pearls for a medium or double cappuccino.",
      "One also writes €11.90 and another writes almost €12, while a further comment calls a double espresso nearly €6.",
      "Those notes do not make one precise range, so no price is stored.",
    ),
    currency: null,
    low: null,
    high: null,
    source: REDDIT_COFFEE_2026,
    confidence: COMMUNITY,
  },
  {
    edition: "belgium",
    kind: "price-range",
    name: "Coffee",
    summary: say(
      "The fan guide's coffee table, updated on 3 June 2025, runs from an espresso at 1.50 Pearls to a latte macchiato with syrup at 4.00 Pearls.",
      "Tea is left out.",
      "Stored as 150 to 400 hundredths of a Pearl.",
      "The page calls the list partial and drawn from previous editions.",
      "It states that one Pearl equals €1.82 and does not print a euro price for these coffees, so euros are not stored.",
      "This is not a 2026 menu.",
    ),
    currency: "pearls",
    low: 150,
    high: 400,
    source: TML_GUIDE_DRINKS_2025,
    confidence: COMMUNITY,
  },
  {
    edition: "belgium",
    kind: "price-range",
    name: "Beer",
    summary: say(
      "Festileaks lists Belgium 2026 beers from a Jupiler at €3.80 to a large Jupiler at €7.33, including the alcohol-free can, Hoegaarden rosé and Corona.",
      "Stored as 380 to 733 cents, using the euro figures printed on those rows.",
      "Flying Fish is left out.",
      "The article states that one Pearl costs €1.90.",
    ),
    currency: "EUR",
    low: 380,
    high: 733,
    source: FESTILEAKS_2026,
    confidence: COMMUNITY,
  },
  {
    edition: "belgium",
    kind: "price-range",
    name: "Soft drinks",
    summary: say(
      "On rows tagged 2026 in the main beverage list, cola, lemonade, iced tea and tonic are 2.00 Pearls, and orange juice, Aquarius and Red Bull are 2.50 Pearls.",
      "Stored as 200 to 250 hundredths of a Pearl.",
      "Water, and the higher VIP rows on the same page, are left out.",
      "The page header says one Pearl equals €1.82, which does not match the euro amounts printed beside the rows, so euros are not stored.",
    ),
    currency: "pearls",
    low: 200,
    high: 250,
    source: FESTIVALVIEWER_2026,
    confidence: COMMUNITY,
  },
  {
    edition: "belgium",
    kind: "price-range",
    name: "Water",
    summary: say(
      "On rows tagged 2026 in the main beverage list, still and sparkling 33 cl water are 2.00 Pearls and 50 cl still water is 2.50 Pearls.",
      "Stored as 200 to 250 hundredths of a Pearl.",
      "A higher VIP row on the same page is left out.",
      "The page header says one Pearl equals €1.82, which does not match the euro amounts printed beside the rows, so euros are not stored.",
    ),
    currency: "pearls",
    low: 200,
    high: 250,
    source: FESTIVALVIEWER_2026,
    confidence: COMMUNITY,
  },
  {
    edition: "winter",
    kind: "stall-type",
    name: "Food stalls",
    summary: say(
      "The quick guide gives food at the stalls as 3 to 7 Pearls.",
      "Stored as 300 to 700 hundredths of a Pearl.",
      "The page states that one Pearl equals €2.77 and does not print a euro price for the food, so euros are not stored.",
      "It was last updated on 4 December 2024 and is not a 2026 menu.",
    ),
    currency: "pearls",
    low: 300,
    high: 700,
    source: WINTER_QUICK_GUIDE,
    confidence: COMMUNITY,
  },
  {
    edition: "winter",
    kind: "stall-type",
    name: "Belgian frites",
    summary: say(
      "The stages guide names classic Belgian fries and says they are about 3 Pearls.",
      "That is one approximate figure, so no range is stored.",
      "The page was last updated on 4 December 2024.",
    ),
    currency: null,
    low: null,
    high: null,
    source: WINTER_STAGES,
    confidence: COMMUNITY,
  },
  {
    edition: "winter",
    kind: "stall-type",
    name: "Tartiflette",
    summary: say(
      "The stages guide names tartiflette, a local cheese dish, among the food at Winter.",
      "It gives no price, so no range is stored.",
    ),
    currency: null,
    low: null,
    high: null,
    source: WINTER_STAGES,
    confidence: COMMUNITY,
  },
  {
    edition: "winter",
    kind: "stall-type",
    name: "Burgers and curries",
    summary: say(
      "The stages guide puts burgers, curries and similar plates at around 7 to 8 Pearls.",
      "Stored as 700 to 800 hundredths of a Pearl.",
      "The quick guide, updated the same day, stops the food-stall band at 7 Pearls, so the two pages do not agree at the top end.",
      "The stages page states a 2025 rate of €2.77 per Pearl and does not print a euro price for these dishes, so euros are not stored.",
    ),
    currency: "pearls",
    low: 700,
    high: 800,
    source: WINTER_STAGES,
    confidence: COMMUNITY,
  },
  {
    edition: "winter",
    kind: "price-range",
    name: "Beer",
    summary: say(
      "The quick guide gives beer as 2 to 3.75 Pearls.",
      "Stored as 200 to 375 hundredths of a Pearl.",
      "The stages guide, updated the same day, says 2 to 3 Pearls instead.",
      "The quick guide states that one Pearl equals €2.77 and does not print a euro price for beer, so euros are not stored.",
      "Neither page is a 2026 menu.",
    ),
    currency: "pearls",
    low: 200,
    high: 375,
    source: WINTER_QUICK_GUIDE,
    confidence: COMMUNITY,
  },
  {
    edition: "winter",
    kind: "price-range",
    name: "Soft drinks",
    summary: say(
      "The quick guide gives soft drinks as 1.5 to 1.80 Pearls.",
      "Stored as 150 to 180 hundredths of a Pearl.",
      "The stages guide, updated the same day, says about 2 Pearls, which sits above this span.",
      "The quick guide states that one Pearl equals €2.77 and does not print a euro price for soft drinks, so euros are not stored.",
    ),
    currency: "pearls",
    low: 150,
    high: 180,
    source: WINTER_QUICK_GUIDE,
    confidence: COMMUNITY,
  },
  {
    edition: "brasil",
    kind: "stall-type",
    name: "Frites",
    summary: say(
      "The fan menu labels these figures as Tomorrowland Brasil 2025 and says the current edition has not published prices.",
      "It lists a plain portion of fries at R$ 31.20 and a cheddar-and-bacon portion at R$ 38.40.",
      "Stored as 3120 to 3840 centavos.",
      "The page states that one Pearl equals R$ 9.60, and it shows no publication date.",
    ),
    currency: "BRL",
    low: 3120,
    high: 3840,
    source: BRASIL_FAN_MENU,
    confidence: COMMUNITY,
  },
  {
    edition: "brasil",
    kind: "stall-type",
    name: "Burgers",
    summary: say(
      "The fan menu for Tomorrowland Brasil 2025 lists a cheese burger and a veggie burger at R$ 48.00 and a cheddar burger at R$ 55.20.",
      "Those are the only burgers on the list, stored as 4800 to 5520 centavos.",
      "The page says the current edition has not published prices, and it shows no publication date.",
    ),
    currency: "BRL",
    low: 4800,
    high: 5520,
    source: BRASIL_FAN_MENU,
    confidence: COMMUNITY,
  },
  {
    edition: "brasil",
    kind: "stall-type",
    name: "Pizza",
    summary: say(
      "Every pizza on the Tomorrowland Brasil 2025 fan menu, including the vegetarian pizza, is listed at R$ 57.60.",
      "That is one amount, so no range is stored.",
      "The page says the current edition has not published prices.",
    ),
    currency: null,
    low: null,
    high: null,
    source: BRASIL_FAN_MENU,
    confidence: COMMUNITY,
  },
  {
    edition: "brasil",
    kind: "stall-type",
    name: "Vegetarian food",
    summary: say(
      "Dishes the Tomorrowland Brasil 2025 fan menu labels vegetarian, vegan, veggie or falafel run from a vegetarian samosa at R$ 9.60 to a vegan paella at R$ 86.40.",
      "Stored as 960 to 8640 centavos.",
      "This is the span of those named dishes, not the menu of one stall.",
      "The page says the current edition has not published prices.",
    ),
    currency: "BRL",
    low: 960,
    high: 8640,
    source: BRASIL_FAN_MENU,
    confidence: COMMUNITY,
  },
  {
    edition: "brasil",
    kind: "stall-type",
    name: "Water",
    summary: say(
      "The Tomorrowland Brasil 2025 fan menu lists mineral water at R$ 9.60 and no second water price.",
      "No range is stored.",
      "The page says the current edition has not published prices.",
    ),
    currency: null,
    low: null,
    high: null,
    source: BRASIL_FAN_MENU,
    confidence: COMMUNITY,
  },
  {
    edition: "brasil",
    kind: "stall-type",
    name: "DreamVille marketplace",
    summary: say(
      "A 30 September 2025 guide describes a market inside DreamVille where campers can buy essentials such as sunscreen, repellent and snacks, and calls the prices festival prices.",
      "It publishes no item range, so no price is stored.",
    ),
    currency: null,
    low: null,
    high: null,
    source: BRASIL_DREAMVILLE_GUIDE,
    confidence: COMMUNITY,
  },
  {
    edition: "brasil",
    kind: "stall-type",
    name: "DreamVille donuts",
    summary: say(
      "Donuts marked as DreamVille only on the Tomorrowland Brasil 2025 fan menu run from a plain donut at R$ 19.20 to the savoury donuts at R$ 40.80.",
      "Stored as 1920 to 4080 centavos.",
      "The page does not call this the marketplace bakery, and it says the current edition has not published prices.",
    ),
    currency: "BRL",
    low: 1920,
    high: 4080,
    source: BRASIL_FAN_MENU,
    confidence: COMMUNITY,
  },
  {
    edition: "brasil",
    kind: "price-range",
    name: "Beer",
    summary: say(
      "Beers on the Tomorrowland Brasil 2025 fan menu run from Budweiser at R$ 19.20 to the Hocus Pocus beers at R$ 38.40, including Corona, Stella Artois and Patagonia.",
      "Stored as 1920 to 3840 centavos.",
      "Beats is left out.",
      "The page says the current edition has not published prices, states that one Pearl equals R$ 9.60, and shows no publication date.",
    ),
    currency: "BRL",
    low: 1920,
    high: 3840,
    source: BRASIL_FAN_MENU,
    confidence: COMMUNITY,
  },
  {
    edition: "brasil",
    kind: "price-range",
    name: "Soft drinks",
    summary: say(
      "On the Tomorrowland Brasil 2025 fan menu, bottled soft drinks are R$ 14.40, tonic and juice cartons are R$ 19.20, and Red Bull is R$ 24.00.",
      "Stored as 1440 to 2400 centavos.",
      "Water is left out.",
      "The page says the current edition has not published prices.",
    ),
    currency: "BRL",
    low: 1440,
    high: 2400,
    source: BRASIL_FAN_MENU,
    confidence: COMMUNITY,
  },
]);
