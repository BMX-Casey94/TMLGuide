import { z } from "zod";
import {
  confidenceSchema,
  isoDateSchema,
  moneyEurSchema,
  slugSchema,
  sourceSchema,
} from "../schemas";

/**
 * Headline verified facts for Tomorrowland Winter 2027.
 *
 * These are the single values the site quotes repeatedly — dates, hours, the few
 * published prices, payment terms and the driving rule. They are kept out of the
 * entity arrays because they are not products: a parking tariff is not a locker,
 * and a percentage is not a ticket. Each one carries its own source so a changed
 * official page invalidates exactly the fact that quoted it.
 *
 * The schema is defined here rather than in `src/data/schemas` because it
 * belongs to this edition's presentation of already-schema-checked primitives:
 * it reuses the shared `source`, `lastVerified`, `confidence` and money rules
 * and adds nothing that another edition would want to inherit.
 */
export const winterFactCategorySchema = z.enum(
  ["dates", "hours", "prices", "booking", "transport", "driving", "resort", "access"],
  {
    error:
      'category must be "dates", "hours", "prices", "booking", "transport", "driving", "resort" or "access"',
  },
);
export type WinterFactCategory = z.infer<typeof winterFactCategorySchema>;

export const winterFactSchema = z.strictObject({
  id: slugSchema,
  edition: z.literal("winter", { error: 'edition must be "winter"' }),
  category: winterFactCategorySchema,
  label: z
    .string({ error: "label is required" })
    .trim()
    .min(1, { error: "label is required" })
    .max(160, { error: "label must be 160 characters or fewer" }),
  /** The fact itself, short enough to be rendered as a single line. */
  value: z
    .string({ error: "value is required" })
    .trim()
    .min(1, { error: "value is required" })
    .max(240, { error: "value must be 240 characters or fewer" }),
  /** The qualifying sentence a reader needs; omitted when the value stands alone. */
  detail: z
    .string()
    .trim()
    .min(1, { error: "detail must not be empty when present" })
    .max(600, { error: "detail must be 600 characters or fewer" })
    .optional(),
  /** Present only when the fact is a single euro amount, so it can be formatted. */
  amountEur: moneyEurSchema.optional(),
  source: sourceSchema,
  lastVerified: isoDateSchema,
  confidence: confidenceSchema,
});
export type WinterFact = z.infer<typeof winterFactSchema>;

const OPENING_HOURS_URL = "https://winter.tomorrowland.com/en/practical/opening-hours/";
const WINTER_HOME_URL = "https://winter.tomorrowland.com/en/";
const PAYMENT_URL = "https://winter.tomorrowland.com/en/sales-info/payment-methods-and-conditions/";
const PACKAGE_URL = "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation/";
const TICKET_URL = "https://winter.tomorrowland.com/en/tickets/festival-ticket/";
const ADDONS_URL = "https://winter.tomorrowland.com/en/add-ons/";
const ACTIVITIES_URL = "https://winter.tomorrowland.com/en/add-ons/activities/";
const SLOPE_URL = "https://winter.tomorrowland.com/en/add-ons/slope-experiences/";
const TRANSPORT_PASS_URL =
  "https://winter.tomorrowland.com/en/practical/how-to-get-there/transportation-pass/";
const GET_THERE_URL = "https://winter.tomorrowland.com/en/practical/how-to-get-there/";
const PARKING_URL = "https://skipass.alpedhuez.com/acces-station-alpe-dhuez/parking/";
const TYRE_RULE_URL = "https://www.service-public.gouv.fr/particuliers/actualites/A14389";
const SKI_AREA_URL = "https://skipass.alpedhuez.com/";
const BUSES_URL = "https://skipass.alpedhuez.com/acces-station-alpe-dhuez/transports-urbains-gratuits/";
const BRACELET_URL = "https://winter.tomorrowland.com/en/practical/your-tomorrowland-bracelet/";
const FAQ_BOOKING_URL =
  "https://faq.tomorrowlandwinter.com/hc/en-us/articles/360038123752-Can-I-change-personal-information-in-my-booking";
const FAQ_CANCEL_URL =
  "https://faq.tomorrowlandwinter.com/hc/en-us/articles/360038500631-Can-I-cancel-my-Tomorrowland-Winter-order";
const ALTIBUS_URL = "https://www.altibus.com/stations-desservies/navettes-alpe-dhuez/";
const TRANSPORT_PACKAGES_URL =
  "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation-transport/";

export const winterFacts: readonly WinterFact[] = [
  {
    id: "festival-dates-2027",
    edition: "winter",
    category: "dates",
    label: "Festival dates",
    value: "20–27 March 2027",
    detail: "At Alpe d'Huez, France. The official homepage headline reads \"MARCH 20–27, 2027 | ALPE D'HUEZ, FRANCE\".",
    source: {
      url: WINTER_HOME_URL,
      title: "Tomorrowland Winter: MARCH 20–27, 2027 | ALPE D'HUEZ, FRANCE",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "mainstage-open-days",
    edition: "winter",
    category: "dates",
    label: "MainStage opening days",
    value: "Open Tuesday 23 to Friday 26 March; closed Saturday 20 to Monday 22 March",
    detail:
      "The MainStage is covered and heated. The ticket page sells separate 1-day options for 20–22 March, when the MainStage is closed.",
    source: {
      url: OPENING_HOURS_URL,
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "mountain-stage-opening-hours",
    edition: "winter",
    category: "hours",
    label: "Mountain stage hours",
    value: "12:00–17:00 Saturday to Monday; 12:00–17:30 Tuesday to Friday",
    source: {
      url: OPENING_HOURS_URL,
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "main-area-hours",
    edition: "winter",
    category: "hours",
    label: "Main festival area hours",
    value: "19:00–00:00 Saturday to Monday; 19:00–01:30 Tuesday to Friday",
    source: {
      url: OPENING_HOURS_URL,
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "main-area-last-admission",
    edition: "winter",
    category: "hours",
    label: "Last admission to the main festival area",
    value: "23:30 Saturday to Monday; 00:30 Tuesday to Friday",
    detail: "The official page states that entry after these times is not possible.",
    source: {
      url: OPENING_HOURS_URL,
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "moosebar-day-slot",
    edition: "winter",
    category: "hours",
    label: "Moosebar by Day hours",
    value: "15:00–19:30, Saturday to Friday",
    detail: "The 2027 opening-hours page publishes no night-time Moosebar slot.",
    source: {
      url: OPENING_HOURS_URL,
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "package-payment-terms",
    edition: "winter",
    category: "booking",
    label: "Package payment terms",
    value: "Prepayment of at least 40% at purchase, capped at €2,500; balance within 30 days",
    detail:
      "The cap applies however large the order: prepayment is 40% of the total or €2,500, whichever is lower. The balance is due within 30 days.",
    amountEur: 2500,
    source: {
      url: PAYMENT_URL,
      title: "Tomorrowland Winter: payment methods and conditions",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "package-inclusions",
    edition: "winter",
    category: "booking",
    label: "What a package price includes",
    value: "City tax, service fee, SGR guarantee-fund fee and payment cost",
    detail:
      "A 7-day package bundles festival access, the lift and ski pass, and accommodation in Alpe d'Huez or Oz 3300.",
    source: {
      url: PACKAGE_URL,
      title: "Tomorrowland Winter: festival ticket and accommodation",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "cancellation-ladder",
    edition: "winter",
    category: "booking",
    label: "Package cancellation charges",
    value: "70% before 1 November 2026; 80% before 1 December 2026; 90% before 1 February 2027; 100% from 1 February 2027",
    detail: "Charged as a percentage of the booking, so a cancellation from 1 February 2027 refunds nothing.",
    source: {
      url: PAYMENT_URL,
      title: "Tomorrowland Winter: payment methods and conditions",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "name-change-window",
    edition: "winter",
    category: "booking",
    label: "Name changes",
    value: "Free until 30 November 2026; €350 per name from 1 December 2026 to 15 January 2027",
    detail:
      "Packages can have their shipping address changed in Manage My Booking until 30 December 2026; after that date no changes are accepted.",
    amountEur: 350,
    source: {
      url: FAQ_BOOKING_URL,
      title: "Can I change personal information in my booking?",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "exchange-desk-window",
    edition: "winter",
    category: "booking",
    label: "Exchange Desk for ticket-only buyers",
    value: "Open 10 October 2026 to 20 January 2027, €10 fee per ticket",
    detail: "Listing is final and resale is not guaranteed.",
    amountEur: 10,
    source: {
      url: FAQ_CANCEL_URL,
      title: "Can I cancel my Tomorrowland Winter order?",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "seven-day-ticket-figure",
    edition: "winter",
    category: "prices",
    label: "7-Day Festival Ticket price for 2027",
    value: "€735, made up of a €346 festival element and a €389 lift and ski pass",
    detail:
      "The only 2027 ticket price published. No 4-day or 1-day ticket price and no package minimum are published.",
    amountEur: 735,
    source: {
      url: "https://winter.tomorrowland.com/fr/tickets/ticket-festival/",
      title: "Tomorrowland Winter 2027 ticket festival",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "comfort-upgrade-price",
    edition: "winter",
    category: "prices",
    label: "Comfort upgrade",
    value: "€390",
    detail:
      "Must be bought in the ticket shop at purchase and cannot be added afterwards. Includes a mountain-stage Comfort area, MainStage cloakroom, dedicated toilets, snacks, bottle service, unlimited pool and ice-rink access, and one Alpine coaster ride.",
    amountEur: 390,
    source: {
      url: PACKAGE_URL,
      title: "Tomorrowland Winter: festival ticket and accommodation",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "treasure-case-fee-eu",
    edition: "winter",
    category: "prices",
    label: "Treasure Case fee, EU delivery",
    value: "€15",
    detail: "Charged on festival tickets bought without accommodation. Worldwide delivery is €22.",
    amountEur: 15,
    source: {
      url: BRACELET_URL,
      title: "Tomorrowland Winter: your Tomorrowland Bracelet",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "treasure-case-fee-worldwide",
    edition: "winter",
    category: "prices",
    label: "Treasure Case fee, worldwide delivery",
    value: "€22",
    detail: "Charged on festival tickets bought without accommodation. EU delivery is €15.",
    amountEur: 22,
    source: {
      url: BRACELET_URL,
      title: "Tomorrowland Winter: your Tomorrowland Bracelet",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "transportation-pass-price",
    edition: "winter",
    category: "transport",
    label: "Transportation Pass",
    value: "€40",
    detail:
      "Buys the Oz 3300 night lift, about 20 minutes, between 18:30 and 21:00 and 22:30 and 00:30, running to 02:00 on MainStage days, plus dedicated night coaches to Bourg d'Oisans, Vaujany, Villard-Reculas and Auris-en-Oisans. Included automatically in Oz 3300 packages.",
    amountEur: 40,
    source: {
      url: TRANSPORT_PASS_URL,
      title: "Tomorrowland Winter: Transportation Pass",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "covered-parking-daily",
    edition: "winter",
    category: "prices",
    label: "Covered parking, daily rate",
    value: "€18 per day",
    detail: "2026–27 season tariff; the first hour is free. The weekly rate is €95.",
    amountEur: 18,
    source: {
      url: PARKING_URL,
      title: "Alpe d'Huez: parking",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "covered-parking-weekly",
    edition: "winter",
    category: "prices",
    label: "Covered parking, weekly rate",
    value: "€95 per week",
    detail: "2026–27 season tariff; the first hour is free. The daily rate is €18.",
    amountEur: 95,
    source: {
      url: PARKING_URL,
      title: "Alpe d'Huez: parking",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "covered-parking-spaces",
    edition: "winter",
    category: "driving",
    label: "Covered car parks in the resort",
    value: "Six covered car parks: Coulet 95, Cristal de l'Alpe 165, Éclose 319, Bergers 260, Rif Nel 230, Jeux 120",
    detail: "Éclose is the largest of the six.",
    source: {
      url: PARKING_URL,
      title: "Alpe d'Huez: parking",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "winter-equipment-rule",
    edition: "winter",
    category: "driving",
    label: "Winter equipment rule in the Isère mountain zones",
    value: "From 1 November to 31 March: four 3PMSF winter tyres, or removable anti-slip devices for at least two driven wheels",
    detail:
      "Either arrangement satisfies the rule, so a car on four 3PMSF winter tyres needs no chains. Chains are not mandatory to carry if the car is properly tyred.",
    source: {
      url: TYRE_RULE_URL,
      title: "Service-public.fr: winter equipment requirements",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "resort-altitude-and-ski-area",
    edition: "winter",
    category: "resort",
    label: "Resort altitude and ski area",
    value: "Resort at 1,860 m; Pic Blanc at 3,330 m; 250 km of piste",
    source: {
      url: SKI_AREA_URL,
      title: "Alpe d'Huez: ski area",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "la-sarenne-length",
    edition: "winter",
    category: "resort",
    label: "La Sarenne black run",
    value: "16 km, described officially as Europe's longest black run",
    detail:
      "Sarenne First Track runs on the Monday from 08:00 to 09:30 at €28; Sarenne Sunset runs on the Sunday from 16:30 to 21:30 at €64 with a gourmet break in a mountain refuge.",
    source: {
      url: SLOPE_URL,
      title: "Tomorrowland Winter 2027 slope experiences",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "hairpin-count",
    edition: "winter",
    category: "driving",
    label: "The climb to Alpe d'Huez",
    value: "21 hairpin turns",
    source: {
      url: GET_THERE_URL,
      title: "Tomorrowland Winter: how to get there",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "grenoble-transfer-time",
    edition: "winter",
    category: "transport",
    label: "Transfer time from Grenoble station",
    value: "About 90 minutes per Tomorrowland; 1 h 45 on the Transaltitude timetable",
    detail:
      "Tomorrowland quotes the shorter figure for the transfer from Grenoble station; the coach operator's own timetable for the same route quotes 1 h 45, so plan on the longer one.",
    source: {
      url: GET_THERE_URL,
      title: "Tomorrowland Winter: how to get there",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "airport-journey-times",
    edition: "winter",
    category: "transport",
    label: "Road journey times from the airports",
    value: "Grenoble Airport about 2 h; Lyon Airport about 2 h 30 over 148 km; Geneva Airport about 3 h 15",
    detail: "Altibus quotes 4 hours by coach from Geneva.",
    source: {
      url: "https://www.bensbus.co.uk/ski-transfer/alpe-dhuez-airport-transfers/",
      title: "Ben's Bus: Alpe d'Huez airport transfers",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "village-lift-last-departures",
    edition: "winter",
    category: "transport",
    label: "Last daytime lift to the surrounding villages",
    value: "Between 16:30 and 17:50 depending on the village",
    detail:
      "Auris 16:30 and Villard-Reculas 16:40 for skiers only, Vaujany 16:30, Oz 3300 and Allemond 16:45, Huez 17:50. Only the lifts from the mountain stages down to Alpe d'Huez keep running until the stages close. The lift and ski pass covers daytime access to the surrounding villages.",
    source: {
      url: OPENING_HOURS_URL,
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "free-village-buses",
    edition: "winter",
    category: "transport",
    label: "Village buses",
    value: "Four free Resalp lines in winter, no ticket needed",
    detail:
      "These are the resort buses. Evening travel to the surrounding villages is the paid Transportation Pass instead.",
    source: {
      url: BUSES_URL,
      title: "Alpe d'Huez: free urban transport",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "flight-package-cities",
    edition: "winter",
    category: "transport",
    label: "Flight package departure cities",
    value: "Amsterdam, Brussels and Barcelona, flying into Lyon",
    detail:
      "Flight packages are bookable with a 4-day or 7-day package and include the transfer between Lyon Airport and Alpe d'Huez.",
    source: {
      url: TRANSPORT_PACKAGES_URL,
      title: "Tomorrowland Winter: festival ticket, accommodation and transport",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "package-mode-matrix",
    edition: "winter",
    category: "transport",
    label: "Which package goes with which transport",
    value: "Bus packages 4 days only; train packages 7 days only",
    detail:
      "Flight packages are the flexible option, bookable with either a 4-day or a 7-day package. Bus packages are not sold with the 7-day package and train packages are not sold with the 4-day one.",
    source: {
      url: TRANSPORT_PACKAGES_URL,
      title: "Tomorrowland Winter: festival ticket, accommodation and transport",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "add-on-sale-opens",
    edition: "winter",
    category: "booking",
    label: "2027 Add-On Sale opening",
    value: "26 November 2026 at 15:00 CET",
    detail:
      "Covers activities, lockers, slope experiences, equipment, ski insurance, shuttles, the Transportation Pass and towels. No restaurant category in the 2027 index.",
    source: {
      url: ADDONS_URL,
      title: "Tomorrowland Winter 2027 add-ons",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "pedestrian-mountain-access",
    edition: "winter",
    category: "access",
    label: "Reaching the mountain stages on foot",
    value: "All mountain stages can be accessed by pedestrians",
    detail:
      "The lift and ski pass, included with every ticket, is required to reach the mountain stages.",
    source: {
      url: "https://winter.tomorrowland.com/en/practical/at-the-festival/",
      title: "Tomorrowland Winter: at the festival",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "walking-between-villages-prohibited",
    edition: "winter",
    category: "access",
    label: "Walking between Alpe d'Huez and the surrounding villages",
    value: "Prohibited by the organiser",
    detail:
      "Use the Transportation Pass night service instead. Villard-Reculas and Auris shuttles run only on the days the MainStage is open.",
    source: {
      url: GET_THERE_URL,
      title: "Tomorrowland Winter: how to get there",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "geneva-shuttle-not-operated",
    edition: "winter",
    category: "transport",
    label: "Altibus Geneva shuttle",
    value: "Did not run in the last winter season, although Tomorrowland still lists it",
    detail:
      'Past-season context: Altibus states "La navette Genève – Alpe d\'Huez ne circulera pas pendant la saison d\'hiver 2025/2026", so the route was suspended rather than merely quiet. Confirm operation with the operator before booking a Geneva arrival.',
    source: {
      url: ALTIBUS_URL,
      title: "Altibus: navettes Alpe d'Huez",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "day-pass-mainstage-split",
    edition: "winter",
    category: "booking",
    label: "1-Day Festival Ticket options",
    value: "One day between 20 and 22 March with the MainStage closed; one day between 23 and 26 March with the MainStage open",
    detail:
      "Both 2027 options are published without a price, so neither is recorded as a priced product.",
    source: {
      url: TICKET_URL,
      title: "Tomorrowland Winter: festival ticket",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "activity-price-range-2027",
    edition: "winter",
    category: "prices",
    label: "2027 activities priced from €14 to €135",
    value: "Alpine Coaster 2 rides €14; Snake Gliss €27; yoga €29; snowshoeing €52; dogsled €60; e-bike €74; DJ workshop €89; paragliding €135",
    detail:
      "Prices published on the 2027 activities page. Paragliding requires ski or snowboard equipment and a maximum weight of 90 kg.",
    source: {
      url: ACTIVITIES_URL,
      title: "Tomorrowland Winter 2027 activities",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "package-simulator",
    edition: "winter",
    category: "booking",
    label: "Package simulator",
    value: "Opened 9 September 2026 to preview accommodation and pricing",
    detail:
      "Packages are planned through the simulator before the sale: it shows the available accommodation and the price for a given group size.",
    source: {
      url: "https://press.winter.tomorrowland.com/tomorrowland-winter-2027-alpe-dhuez-where-the-mountains-meet-magic",
      title: "Tomorrowland Winter 2027: where the mountains meet magic",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "package-accommodation-categories",
    edition: "winter",
    category: "booking",
    label: "Package accommodation",
    value: "Hotels, apartments and shared chalets in four categories: Wood, Bronze, Silver and Gold",
    detail:
      "Tomorrowland sells packages in Alpe d'Huez and in Oz 3300; the surrounding villages are sold exclusively through Sunweb and come with mountain-stage access only. No 2027 accommodation price is published.",
    source: {
      url: PACKAGE_URL,
      title: "Tomorrowland Winter: festival ticket and accommodation",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "discover-paris",
    edition: "winter",
    category: "booking",
    label: "Discover Paris",
    value: "Three nights in Paris before the festival, bookable only with a 4-day or 7-day package",
    detail:
      "A hosted stay at the 4-star Aparthotel Adagio Paris Centre Tour Eiffel, with breakfast, a welcome drink and a surprise activity. Arrive in Paris on 17 March with a 7-day package or 20 March with a 4-day package; the return transport ends in Paris, Lyon Airport, Geneva Airport or Grenoble. No price is published for 2027.",
    source: {
      url: "https://winter.tomorrowland.com/en/tickets/discover-paris/",
      title: "Tomorrowland Winter: Discover Paris",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "free-town-lifts",
    edition: "winter",
    category: "transport",
    label: "Free lifts inside the resort",
    value: "Télécentre, Alpe Express and Huez Express are free in winter",
    detail:
      "Télécentre runs from Place Paganon via Avenue des Jeux to Grandes Rousses 1800 and the snow front. Alpe Express runs from Place Paganon to Éclose and Bergers. Huez Express links Huez village and Alpe d'Huez. No 2026–27 opening hours are published; the last published timetable was for 2024–25.",
    source: {
      url: "https://www.alpedhuez.com/fr/votre-sejour/transports-sur-place/transports-vers-la-station/",
      title: "Alpe d'Huez: transport to the resort",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "locker-areas-and-durations",
    edition: "winter",
    category: "booking",
    label: "Lockers",
    value: "Three locker areas — Main Entrance, Cage and MainStage — rentable in advance for 4 or 7 days",
    detail:
      "Single-day lockers can be reserved in advance only for the Saturday-to-Monday pre-days; on the Tuesday-to-Friday main festival days they are sold on site only, and on-site availability is not guaranteed. Main Entrance lockers are open from 08:00 until 30 minutes after the main area closes; Cage and MainStage lockers during festival hours. Main Entrance and MainStage lockers have USB charging. No 2027 locker price is published.",
    source: {
      url: "https://winter.tomorrowland.com/en/add-ons/lockers/",
      title: "Tomorrowland Winter 2027 lockers",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
];
