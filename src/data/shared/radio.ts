/**
 * One World Radio — verified station and distribution data.
 *
 * No shared schema covers a radio station, so the schemas live here, built on
 * `verifiedBase` from `../schemas`: every record keeps a source, a verification
 * date and a confidence level, unknown keys are rejected, and the stream URL
 * must be https.
 *
 * Two facts are deliberately excluded, both because the ledger marks them
 * contradicted or changed in a way the research notes still get wrong:
 * - Romanian FM 92.1 is not published. The 2026 distribution release lists no
 *   Romanian carriage at all, and the licence reverted to another broadcaster
 *   on 1 January 2026.
 * - Switzerland is online only, through the my105 website and app. It is not a
 *   DAB+ country in the 2026 release.
 * See `docs/data/brasil-shared-omissions.md`.
 */
import { z } from "zod";
import { httpsUrlSchema, verifiedBase, type Source } from "../schemas";

const VERIFIED_ON = "2026-11-18";

/** How a listener can reach the station. */
export const radioChannelKindSchema = z.enum(
  ["stream", "app", "web", "video", "aggregator", "satellite"],
  {
    error: 'kind must be "stream", "app", "web", "video", "aggregator" or "satellite"',
  },
);
export type RadioChannelKind = z.infer<typeof radioChannelKindSchema>;

/**
 * A documented way to listen. `url` is present for anything a reader can open;
 * native apps and satellite carriage have no single public stream endpoint, so
 * the URL stays optional.
 */
export const radioChannelSchema = verifiedBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(120, { error: "name must be 120 characters or fewer" }),
    kind: radioChannelKindSchema,
    description: z
      .string({ error: "description is required" })
      .trim()
      .min(1, { error: "description is required" })
      .max(400, { error: "description must be 400 characters or fewer" }),
    url: httpsUrlSchema.optional(),
  })
  .strict();
export type RadioChannel = z.infer<typeof radioChannelSchema>;

/**
 * A country whose listeners can receive the station. `method` is free text
 * because the official release mixes DAB+, FM, syndication and online carriage.
 */
export const radioBroadcastSchema = verifiedBase
  .extend({
    country: z
      .string({ error: "country is required" })
      .trim()
      .min(1, { error: "country is required" })
      .max(80, { error: "country must be 80 characters or fewer" }),
    method: z
      .string({ error: "method is required" })
      .trim()
      .min(1, { error: "method is required" })
      .max(120, { error: "method must be 120 characters or fewer" }),
    detail: z
      .string({ error: "detail is required" })
      .trim()
      .min(1, { error: "detail is required" })
      .max(400, { error: "detail must be 400 characters or fewer" }),
  })
  .strict();
export type RadioBroadcast = z.infer<typeof radioBroadcastSchema>;

/** A dated moment in the station's history. */
export const radioMilestoneSchema = verifiedBase
  .extend({
    happenedOn: z.iso.date({ error: "happenedOn must be a real calendar date" }),
    statement: z
      .string({ error: "statement is required" })
      .trim()
      .min(1, { error: "statement is required" })
      .max(400, { error: "statement must be 400 characters or fewer" }),
  })
  .strict();
export type RadioMilestone = z.infer<typeof radioMilestoneSchema>;

/** The station's own facts: what it is, when it started and how big it is. */
export const radioStationSchema = verifiedBase
  .extend({
    name: z
      .string({ error: "name is required" })
      .trim()
      .min(1, { error: "name is required" })
      .max(80, { error: "name must be 80 characters or fewer" }),
    tagline: z
      .string({ error: "tagline is required" })
      .trim()
      .min(1, { error: "tagline is required" })
      .max(200, { error: "tagline must be 200 characters or fewer" }),
    description: z
      .string({ error: "description is required" })
      .trim()
      .min(1, { error: "description is required" })
      .max(1200, { error: "description must be 1200 characters or fewer" }),
    streamUrl: httpsUrlSchema,
    audience: z
      .string({ error: "audience is required" })
      .trim()
      .min(1, { error: "audience is required" })
      .max(300, { error: "audience must be 300 characters or fewer" }),
  })
  .strict();
export type RadioStation = z.infer<typeof radioStationSchema>;

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const STATION_SITE: Source = {
  url: "https://oneworldradio.tomorrowland.com/",
  title: "One World Radio — official site",
  retrievedOn: VERIFIED_ON,
};

const ANNIVERSARY_RELEASE: Source = {
  url: "https://press.oneworldradio.tomorrowland.com/one-world-radio-is-celebrating-its-1st-anniversary",
  title: "One World Radio is celebrating its first anniversary",
  retrievedOn: VERIFIED_ON,
};

const SEVEN_YEARS_RELEASE: Source = {
  url: "https://press.oneworldradio.tomorrowland.com/seven-years-of-one-world-radio-from-festival-fadio-to-a-global-electronic-music-platform",
  title: "Seven years of One World Radio: from festival radio to a global electronic music platform",
  retrievedOn: VERIFIED_ON,
};

const COUNTRIES_ARTICLE: Source = {
  url: "https://www.tomorrowland.com/article/one-world-radio-countries/",
  title: "Where to listen to One World Radio",
  retrievedOn: VERIFIED_ON,
};

const SIRIUSXM_RELEASE: Source = {
  url: "https://press.oneworldradio.tomorrowland.com/tomorrowlands-one-world-radio-joins-siriusxm",
  title: "Tomorrowland's One World Radio joins SiriusXM",
  retrievedOn: VERIFIED_ON,
};

const STREAM_SOURCE: Source = {
  url: "https://playerservices.streamtheworld.com/api/livestream-redirect/OWR_INTERNATIONAL.mp3",
  title: "One World Radio international MP3 stream (checked for HTTP 200 and audio/mpeg)",
  retrievedOn: VERIFIED_ON,
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/** The station itself. One record, because there is only one station. */
export const radioStation: RadioStation = {
  id: "one-world-radio",
  edition: "all",
  name: "One World Radio",
  tagline: "Tomorrowland's dance music radio station, broadcasting around the clock",
  description:
    "One World Radio is Tomorrowland's own radio station and content platform, on air continuously. It plays exclusive mixes, unique tracks and live sets recorded across more than two decades of Tomorrowland, alongside international hosts, shows and specials, all produced by the team behind the festival. During festival periods it broadcasts live from Tomorrowland Winter, Belgium, Brasil and Thailand, more than 400 hours a year in total.",
  streamUrl: "https://playerservices.streamtheworld.com/api/livestream-redirect/OWR_INTERNATIONAL.mp3",
  audience:
    "1.4 million unique monthly listeners across more than 130 countries, as reported by Tomorrowland in March 2026.",
  source: STATION_SITE,
  lastVerified: VERIFIED_ON,
  confidence: "official",
};

/** The named moments a page can put on a timeline. */
export const radioMilestones: readonly RadioMilestone[] = [
  {
    id: "launch",
    edition: "all",
    happenedOn: "2019-02-18",
    statement:
      "One World Radio launched on 18 February 2019 to mark Tomorrowland's fifteenth anniversary, as a temporary anniversary project that was then made permanent.",
    source: ANNIVERSARY_RELEASE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "siriusxm-north-america",
    edition: "all",
    happenedOn: "2025-03-04",
    statement:
      "From 4 March 2025 the station has been carried on SiriusXM in North America, reaching 33 million subscribers.",
    source: SIRIUSXM_RELEASE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "seven-years",
    edition: "all",
    happenedOn: "2026-02-18",
    statement:
      "Seven years after launch the station reported 1.4 million unique monthly listeners across more than 130 countries, five daily hosts and more than 20 monthly shows.",
    source: SEVEN_YEARS_RELEASE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
];

/** Every documented way to listen. */
export const radioChannels: readonly RadioChannel[] = [
  {
    id: "international-stream",
    edition: "all",
    name: "International MP3 stream",
    kind: "stream",
    description:
      "The public international stream. It answered HTTP 200 with an audio/mpeg content type when checked, so it plays in a browser player or any MP3-capable app.",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/OWR_INTERNATIONAL.mp3",
    source: STREAM_SOURCE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "tomorrowland-app",
    edition: "all",
    name: "Tomorrowland App",
    kind: "app",
    description:
      "The official app streams the station and supports Apple CarPlay and Android Auto, so it can be used in a car.",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "tomorrowland-website",
    edition: "all",
    name: "Tomorrowland website player",
    kind: "web",
    description: "The station plays in the web player on tomorrowland.com, with no account needed.",
    url: "https://www.tomorrowland.com/article/one-world-radio-countries/",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "youtube",
    edition: "all",
    name: "YouTube live stream",
    kind: "video",
    description: "The official Tomorrowland channel carries the station as a live video stream.",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "radioplayer-tunein",
    edition: "all",
    name: "Radioplayer and TuneIn",
    kind: "aggregator",
    description:
      "Third-party radio aggregators Radioplayer and TuneIn both carry the station, useful where a native app is unavailable.",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "siriusxm",
    edition: "all",
    name: "SiriusXM",
    kind: "satellite",
    description:
      "Carried on SiriusXM in North America since 4 March 2025 for its 33 million subscribers, heard through the SiriusXM app or web player.",
    source: SIRIUSXM_RELEASE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
];

/**
 * Over-the-air, syndicated and online carriage by country.
 *
 * A country appears only where an official page states the carriage. Romania is
 * absent because the official 2026 list omits it entirely, and Switzerland
 * appears as an online-only route because that is what the 2026 list says.
 */
export const radioBroadcasts: readonly RadioBroadcast[] = [
  {
    id: "belgium",
    edition: "all",
    country: "Belgium",
    method: "DAB+ nationwide",
    detail: "Nationwide digital radio coverage across Belgium.",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "netherlands",
    edition: "all",
    country: "Netherlands",
    method: "DAB+, plus an online subchannel",
    detail: "Received on DAB+ and as an online subchannel carried by Radio 538.",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "united-kingdom",
    edition: "all",
    country: "United Kingdom",
    method: "DAB+ in southern England",
    detail: "Terrestrial coverage is limited to the south of England.",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "malta",
    edition: "all",
    country: "Malta",
    method: "DAB+",
    detail: "Carried nationally on DAB+.",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "spain",
    edition: "all",
    country: "Spain",
    method: "DAB+ and FM 100.5 in Ibiza",
    detail: "Ibiza only: DAB+ and 100.5 FM. No mainland or Mallorca carriage is published.",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "austria",
    edition: "all",
    country: "Austria",
    method: "Syndicated carriage",
    detail: "Syndicated through Kronehit rather than as a dedicated DAB+ or FM service.",
    source: SEVEN_YEARS_RELEASE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "switzerland",
    edition: "all",
    country: "Switzerland",
    method: "Online only",
    detail:
      "No DAB+ or FM carriage is published for Switzerland; listeners reach the station through the my105 website and app.",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "germany",
    edition: "all",
    country: "Germany",
    method: "Online via bigFM and I Love Music",
    detail: "Online carriage through bigFM and I Love Music.",
    source: COUNTRIES_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "france",
    edition: "all",
    country: "France",
    method: "Online only",
    detail: "Online carriage through Fun Radio.",
    source: SEVEN_YEARS_RELEASE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "united-states",
    edition: "all",
    country: "United States",
    method: "Online and satellite",
    detail: "Available online and through the SiriusXM app and web player.",
    source: SEVEN_YEARS_RELEASE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
];

/** Collections for callers that want everything at once. */
export const radioCollections = {
  station: radioStation,
  milestones: radioMilestones,
  channels: radioChannels,
  broadcasts: radioBroadcasts,
} as const;
