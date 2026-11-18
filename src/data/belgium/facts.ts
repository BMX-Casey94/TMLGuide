import { z } from "zod";
import { isoDateSchema, isoInstantSchema, moneyEurSchema, sourceSchema } from "../schemas";

/**
 * Verified headline facts for Tomorrowland Belgium 2027.
 *
 * Each leaf is a `{ value, source, lastVerified }` tuple, so no figure can be
 * rendered without the citation that backs it. The schema lives here rather
 * than in `src/data/schemas` because it describes one edition's summary
 * object, not a reusable record type.
 *
 * Every citation is the page the ledger checked that claim against, so a claim
 * drawn from the festival-hours article is not filed under the DreamVille
 * hours page.
 *
 * Deliberately absent, because no permitted source states them:
 * - a DreamVille capacity figure (the official statistics block has none);
 * - the "over 200 countries" line, which contradicts the 191-nationality stat;
 * - any 2027 ticket, package, add-on or Pearl price;
 * - a Belgian-only or Friends sale date (the 2027 cycle publishes neither);
 * - an Exchange Desk closing time: the two official pages disagree (12:00
 *   against 23:59 CEST), so only the date is recorded.
 *
 * `exchangeDeskListingNotASale.saleGuaranteed` rests on the resolved value in
 * `docs/factcheck/conflicts.md` §3 ("Listing is not a sale"); the other claims
 * in that group come from the Exchange Desk page itself.
 */

const verifiedFact = <T extends z.ZodType>(value: T) =>
  z.strictObject({
    value,
    source: sourceSchema,
    lastVerified: isoDateSchema,
  });

const timeOfDay = z
  .string()
  .regex(/^\d{2}:\d{2}$/, { error: "time must be HH:MM in 24-hour form" });

export const belgiumFactsSchema = z.strictObject({
  edition: z.literal("belgium"),
  festival: z.strictObject({
    venue: verifiedFact(
      z.strictObject({
        name: z.string().trim().min(1).max(120),
        locality: z.string().trim().min(1).max(120),
        country: z.literal("Belgium"),
      }),
    ),
    weekendOne: verifiedFact(z.strictObject({ startsOn: isoDateSchema, endsOn: isoDateSchema })),
    weekendTwo: verifiedFact(z.strictObject({ startsOn: isoDateSchema, endsOn: isoDateSchema })),
  }),
  preRegistration: verifiedFact(
    z.strictObject({
      opensAt: isoInstantSchema,
      closesAt: isoInstantSchema,
      guaranteesTicket: z.literal(false),
    }),
  ),
  ticketCaps: verifiedFact(
    z.strictObject({
      perAccount: z.int().min(1).max(100),
      globalJourneyPerAccount: z.int().min(1).max(100),
      duringNftSalePerAccount: z.int().min(1).max(100),
      friendshipGardenExempt: z.literal(true),
      scope: z.literal("cumulated across all sale moments"),
    }),
  ),
  dreamville: z.strictObject({
    openingWindow: verifiedFact(
      z.strictObject({
        opensOnDay: z.literal("Thursday"),
        opensAt: timeOfDay,
        closesOnDay: z.literal("Monday"),
        closesAt: timeOfDay,
        opensEachWeekend: z.literal(true),
      }),
    ),
    checkIn: verifiedFact(
      z.strictObject({
        thursday: z.string().trim().min(1).max(200),
        friday: z.string().trim().min(1).max(200),
        saturday: z.string().trim().min(1).max(200),
        sunday: z.string().trim().min(1).max(200),
      }),
    ),
    checkOut: verifiedFact(
      z.strictObject({
        byDay: z.literal("Monday"),
        byTime: timeOfDay,
        exceptionsAllowed: z.literal(false),
      }),
    ),
    gathering: verifiedFact(
      z.strictObject({
        day: z.literal("Thursday"),
        opensAt: timeOfDay,
        closesAt: timeOfDay,
        guestsOnly: z.literal(true),
      }),
    ),
  }),
  festivalHours: verifiedFact(
    z.strictObject({
      friday: z.string().trim().min(1).max(40),
      saturday: z.string().trim().min(1).max(40),
      sunday: z.string().trim().min(1).max(40),
      lastEntryFriday: timeOfDay,
      lastEntrySaturday: timeOfDay,
      lastEntrySunday: timeOfDay,
      sameBothWeekends: z.literal(true),
    }),
  ),
  reEntry: verifiedFact(
    z.strictObject({
      sameDayReEntry: z.literal(false),
      appliesToAllTickets: z.literal(true),
      fullMadnessNextDayOnly: z.literal(true),
      dayPassNeedsNewTicket: z.literal(true),
      summary: z.string().trim().min(1).max(400),
    }),
  ),
  dreamvilleCrossings: verifiedFact(
    z.strictObject({
      dreamvilleFromFestivalFrom: timeOfDay,
      festivalFromDreamvilleUntil: z.string().trim().min(1).max(80),
    }),
  ),
  headlineStats: verifiedFact(
    z.strictObject({
      stages: z.int().min(1).max(200),
      peopleOfTomorrow: z.int().min(1).max(1_000_000),
      nationalities: z.int().min(1).max(300),
    }),
  ),
  exchangeDeskWindow: verifiedFact(
    z.strictObject({
      opensOn: isoDateSchema,
      closesOn: isoDateSchema,
      ticketsCancellable: z.literal(false),
    }),
  ),
  exchangeDeskListing: verifiedFact(
    z.strictObject({
      holdsInMainBuyerAccount: z.literal(true),
      listingIsFinal: z.literal(true),
    }),
  ),
  exchangeDeskListingNotASale: verifiedFact(z.strictObject({ saleGuaranteed: z.literal(false) })),
  exchangeDeskFee: verifiedFact(z.strictObject({ feeEur: moneyEurSchema })),
  exchangeDeskGlobalJourney: verifiedFact(z.strictObject({ globalJourneyEligible: z.literal(false) })),
  nameChanges: verifiedFact(z.strictObject({ allowedOnTickets: z.literal(false) })),
  globalJourneyNameChanges: verifiedFact(
    z.strictObject({
      exceptionsAllowedInUrgentCases: z.literal(true),
      feeEur: moneyEurSchema,
      deadline: isoDateSchema,
      deadlineClock: z.literal("23:59 CEST"),
    }),
  ),
});

export type BelgiumFacts = z.infer<typeof belgiumFactsSchema>;

const HOMEPAGE_SOURCE = {
  url: "https://belgium.tomorrowland.com/en/",
  title: "Tomorrowland Belgium — official homepage, 2027 edition",
  retrievedOn: "2026-11-18",
} as const;

const HOW_TO_ORDER_SOURCE = {
  url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
  title: "Tomorrowland Belgium — how to order, 2027 sales",
  retrievedOn: "2026-11-18",
} as const;

const OPENING_HOURS_SOURCE = {
  url: "https://belgium.tomorrowland.com/en/practical/opening-hours/",
  title: "Tomorrowland Belgium — opening hours",
  retrievedOn: "2026-11-18",
} as const;

const PRE_REGISTRATION_SOURCE = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/43968145412372-What-is-Pre-Registration",
  title: "What is Pre-Registration",
  retrievedOn: "2026-11-18",
} as const;

const RE_ENTRY_SOURCE = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037215812-Can-I-re-enter-the-festival",
  title: "Can I re-enter the festival",
  retrievedOn: "2026-11-18",
} as const;

const FESTIVAL_HOURS_SOURCE = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037582731-What-are-the-opening-hours-of-the-festival-site",
  title: "What are the opening hours of the festival site",
  retrievedOn: "2026-11-18",
} as const;

const CANCELLATION_SOURCE = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588571-Can-I-cancel-or-resell-my-tickets",
  title: "Can I cancel or resell my tickets",
  retrievedOn: "2026-11-18",
} as const;

const EXCHANGE_DESK_SOURCE = {
  url: "https://belgium.tomorrowland.com/en/sales-info/exchange-desk/",
  title: "Tomorrowland Belgium — Exchange Desk",
  retrievedOn: "2026-11-18",
} as const;

const WJ_NAME_SOURCE = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588511-Can-I-enter-if-the-registered-name-on-the-Bracelet-is-not-my-own",
  title: "Can I enter if the registered name on the Bracelet is not my own",
  retrievedOn: "2026-11-18",
} as const;

const GJ_EXCHANGE_SOURCE = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037811911-Can-I-resell-my-tickets-at-the-online-Exchange-Desk",
  title: "Can I resell my tickets at the online Exchange Desk",
  retrievedOn: "2026-11-18",
} as const;

const GET_THERE_SOURCE = {
  url: "https://belgium.tomorrowland.com/en/practical/how-to-get-there/",
  title: "Tomorrowland Belgium — how to get there",
  retrievedOn: "2026-11-18",
} as const;

const LAST_VERIFIED = "2026-11-18";

export const belgiumFacts: BelgiumFacts = belgiumFactsSchema.parse({
  edition: "belgium",
  festival: {
    venue: {
      value: { name: "De Schorre recreation area", locality: "Boom", country: "Belgium" },
      source: GET_THERE_SOURCE,
      lastVerified: LAST_VERIFIED,
    },
    weekendOne: {
      value: { startsOn: "2027-07-16", endsOn: "2027-07-18" },
      source: HOMEPAGE_SOURCE,
      lastVerified: LAST_VERIFIED,
    },
    weekendTwo: {
      value: { startsOn: "2027-07-23", endsOn: "2027-07-25" },
      source: HOMEPAGE_SOURCE,
      lastVerified: LAST_VERIFIED,
    },
  },
  preRegistration: {
    value: {
      opensAt: "2026-12-02T15:00:00+01:00",
      closesAt: "2027-02-12T15:00:00+01:00",
      guaranteesTicket: false,
    },
    source: PRE_REGISTRATION_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  ticketCaps: {
    value: {
      perAccount: 4,
      globalJourneyPerAccount: 6,
      duringNftSalePerAccount: 2,
      friendshipGardenExempt: true,
      scope: "cumulated across all sale moments",
    },
    source: HOW_TO_ORDER_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  dreamville: {
    openingWindow: {
      value: {
        opensOnDay: "Thursday",
        opensAt: "11:00",
        closesOnDay: "Monday",
        closesAt: "12:00",
        opensEachWeekend: true,
      },
      source: OPENING_HOURS_SOURCE,
      lastVerified: LAST_VERIFIED,
    },
    checkIn: {
      value: {
        thursday: "From 11:00 at both DreamVille entrances",
        friday: "Around the clock",
        saturday: "At both entrances until 12:00, then Entrance 1 only",
        sunday: "No check-in at all",
      },
      source: OPENING_HOURS_SOURCE,
      lastVerified: LAST_VERIFIED,
    },
    checkOut: {
      value: { byDay: "Monday", byTime: "12:00", exceptionsAllowed: false },
      source: OPENING_HOURS_SOURCE,
      lastVerified: LAST_VERIFIED,
    },
    gathering: {
      value: { day: "Thursday", opensAt: "13:30", closesAt: "00:00", guestsOnly: true },
      source: OPENING_HOURS_SOURCE,
      lastVerified: LAST_VERIFIED,
    },
  },
  festivalHours: {
    value: {
      friday: "12:00–01:00",
      saturday: "12:00–01:00",
      sunday: "12:00–00:00",
      lastEntryFriday: "22:00",
      lastEntrySaturday: "22:00",
      lastEntrySunday: "21:00",
      sameBothWeekends: true,
    },
    source: OPENING_HOURS_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  reEntry: {
    value: {
      sameDayReEntry: false,
      appliesToAllTickets: true,
      fullMadnessNextDayOnly: true,
      dayPassNeedsNewTicket: true,
      summary:
        "Leaving the festival ends the day: no re-entry, even on a three-day Full Madness Pass. A Full Madness Pass allows re-entry on a later day of the same weekend, never on the same day.",
    },
    source: RE_ENTRY_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  dreamvilleCrossings: {
    value: {
      dreamvilleFromFestivalFrom: "17:00",
      festivalFromDreamvilleUntil: "2 hours before closing time",
    },
    source: FESTIVAL_HOURS_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  headlineStats: {
    value: { stages: 16, peopleOfTomorrow: 400_000, nationalities: 191 },
    source: HOMEPAGE_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  exchangeDeskWindow: {
    value: {
      opensOn: "2027-02-13",
      closesOn: "2027-04-29",
      ticketsCancellable: false,
    },
    source: CANCELLATION_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  exchangeDeskListing: {
    value: {
      holdsInMainBuyerAccount: true,
      listingIsFinal: true,
    },
    source: EXCHANGE_DESK_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  exchangeDeskListingNotASale: {
    value: { saleGuaranteed: false },
    source: CANCELLATION_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  exchangeDeskFee: {
    value: { feeEur: 10 },
    source: HOW_TO_ORDER_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  exchangeDeskGlobalJourney: {
    value: { globalJourneyEligible: false },
    source: GJ_EXCHANGE_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  nameChanges: {
    value: { allowedOnTickets: false },
    source: WJ_NAME_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
  globalJourneyNameChanges: {
    value: {
      exceptionsAllowedInUrgentCases: true,
      feeEur: 350,
      deadline: "2027-04-29",
      deadlineClock: "23:59 CEST",
    },
    source: HOW_TO_ORDER_SOURCE,
    lastVerified: LAST_VERIFIED,
  },
});
