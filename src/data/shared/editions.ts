/**
 * Edition-dates overview for every Tomorrowland edition TMLGUIDE covers, plus
 * the two editions immediately behind us.
 *
 * Each record carries one official source for the dates, so a reader can check
 * the claim without hunting. Thailand is included because the 2026–27 narrative
 * runs through it, even though TMLGUIDE does not publish a Thailand guide; its
 * record therefore has no `guideEdition` link.
 *
 * Deliberately absent: any DreamVille capacity figure (never published), and the
 * "over 200 countries" line, which contradicts the official statistic block.
 */
import { z } from "zod";
import { editionIdSchema, isoDateSchema, verifiedBase, type Source } from "../schemas";

const VERIFIED_ON = "2026-11-18";

/** Where an edition stands as of the verification date. */
export const editionStatusSchema = z.enum(["past", "sold-out", "on-sale", "upcoming"], {
  error: 'status must be "past", "sold-out", "on-sale" or "upcoming"',
});
export type EditionStatus = z.infer<typeof editionStatusSchema>;

/**
 * One edition's dates and setting.
 *
 * `edition` is "all" because the record belongs to the festival-wide overview
 * rather than to a single edition's guide. `guideEdition` names the edition the
 * guide itself covers, and is absent for an edition with no TMLGUIDE section.
 */
export const editionOverviewSchema = verifiedBase
  .extend({
    edition: z.literal("all", { error: 'edition must be "all" for the overview' }),
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    guideEdition: editionIdSchema.optional(),
    startsOn: isoDateSchema,
    endsOn: isoDateSchema,
    venue: z
      .string({ error: "venue is required" })
      .trim()
      .min(1, { error: "venue is required" })
      .max(120, { error: "venue must be 120 characters or fewer" }),
    location: z
      .string({ error: "location is required" })
      .trim()
      .min(1, { error: "location is required" })
      .max(120, { error: "location must be 120 characters or fewer" }),
    status: editionStatusSchema,
    notes: z
      .string()
      .trim()
      .min(1, { error: "notes must not be empty when present" })
      .max(600, { error: "notes must be 600 characters or fewer" })
      .optional(),
  })
  .strict()
  .refine((record) => Date.parse(record.endsOn) >= Date.parse(record.startsOn), {
    error: "endsOn must not be before startsOn",
    path: ["endsOn"],
  });
export type EditionOverview = z.infer<typeof editionOverviewSchema>;

const BELGIUM_SITE: Source = {
  url: "https://belgium.tomorrowland.com/en/",
  title: "Tomorrowland Belgium — official site with 2027 weekend dates",
  retrievedOn: VERIFIED_ON,
};

const BELGIUM_2026_RELEASE: Source = {
  url: "https://press.belgium.tomorrowland.com/tomorrowland-belgium-returns-in-2026",
  title: "Tomorrowland Belgium returns in 2026",
  retrievedOn: VERIFIED_ON,
};

const WINTER_SITE: Source = {
  url: "https://winter.tomorrowland.com/en/",
  title: "Tomorrowland Winter — official site with 2027 dates",
  retrievedOn: VERIFIED_ON,
};

const WINTER_2026_RELEASE: Source = {
  url: "https://press.winter.tomorrowland.com/this-was-tomorrowland-winter-2026",
  title: "This was Tomorrowland Winter 2026",
  retrievedOn: VERIFIED_ON,
};

const THAILAND_SITE: Source = {
  url: "https://thailand.tomorrowland.com/",
  title: "Tomorrowland Thailand — official site",
  retrievedOn: VERIFIED_ON,
};

const BRASIL_SITE: Source = {
  url: "https://brasil.tomorrowland.com/",
  title: "Tomorrowland Brasil — official site with 2027 dates",
  retrievedOn: VERIFIED_ON,
};

/** Every edition in the overview, newest cycle first. */
export const editions: readonly EditionOverview[] = [
  {
    id: "belgium-2027",
    edition: "all",
    name: "Tomorrowland Belgium 2027 — Weekend 1",
    guideEdition: "belgium",
    startsOn: "2027-07-16",
    endsOn: "2027-07-18",
    venue: "De Schorre recreation area",
    location: "Boom, Belgium",
    status: "upcoming",
    notes: "The first of the two 2027 weekends.",
    source: BELGIUM_SITE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "belgium-2027-weekend-2",
    edition: "all",
    name: "Tomorrowland Belgium 2027 — Weekend 2",
    guideEdition: "belgium",
    startsOn: "2027-07-23",
    endsOn: "2027-07-25",
    venue: "De Schorre recreation area",
    location: "Boom, Belgium",
    status: "upcoming",
    notes: "The second of the two 2027 weekends, one week after Weekend 1.",
    source: BELGIUM_SITE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "winter-2027",
    edition: "all",
    name: "Tomorrowland Winter 2027",
    guideEdition: "winter",
    startsOn: "2027-03-20",
    endsOn: "2027-03-27",
    venue: "Alpe d'Huez",
    location: "Alpe d'Huez, France",
    status: "upcoming",
    notes: "A single week in the Alps, as every Winter edition has been.",
    source: WINTER_SITE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "thailand-2026",
    edition: "all",
    name: "Tomorrowland Thailand 2026",
    startsOn: "2026-12-11",
    endsOn: "2026-12-13",
    venue: "Wisdom Valley",
    location: "Pattaya, Thailand",
    status: "sold-out",
    notes:
      "The first Thailand edition and the middle chapter of the 2026–27 narrative. Officially sold out.",
    source: THAILAND_SITE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "brasil-2027",
    edition: "all",
    name: "Tomorrowland Brasil 2027",
    guideEdition: "brasil",
    startsOn: "2027-04-30",
    endsOn: "2027-05-02",
    venue: "Parque Maeda",
    location: "Itu, São Paulo, Brazil",
    status: "upcoming",
    notes:
      'Themed "Consciência". No edition was held in 2026; DreamVille opens on Thursday 29 April 2027.',
    source: BRASIL_SITE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "belgium-2026",
    edition: "all",
    name: "Tomorrowland Belgium 2026",
    guideEdition: "belgium",
    startsOn: "2026-07-17",
    endsOn: "2026-07-19",
    venue: "De Schorre recreation area",
    location: "Boom, Belgium",
    status: "past",
    notes:
      "Weekend 1 ran 17–19 July 2026 and Weekend 2 ran 24–26 July 2026. Both weekends sold out before the festival.",
    source: BELGIUM_2026_RELEASE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "winter-2026",
    edition: "all",
    name: "Tomorrowland Winter 2026",
    guideEdition: "winter",
    startsOn: "2026-03-21",
    endsOn: "2026-03-28",
    venue: "Alpe d'Huez",
    location: "Alpe d'Huez, France",
    status: "past",
    notes: "The sixth Winter edition, held over a single week in March 2026.",
    source: WINTER_2026_RELEASE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
];

export const editionsCollections = { editions } as const;
