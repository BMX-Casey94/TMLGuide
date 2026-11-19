import { guideChapterSchema } from "../schema";

const VERIFIED_ON = "2026-11-18";

/**
 * One World Radio chapter. Distribution follows the official 2026 list: Romania
 * is absent and Switzerland is online only, both because the ledger records the
 * older descriptions as superseded.
 */
export const generalRadioChapter = guideChapterSchema.parse({
  edition: "general",
  slug: "radio",
  order: 2,
  title: "One World Radio",
  summary:
    "Tomorrowland's own radio station: what it broadcasts, how to listen from anywhere, and which countries carry it on DAB+ or FM.",
  lastVerified: VERIFIED_ON,
  related: ["general/pearls", "general/sets", "general/editions"],
  sources: [
    {
      id: "s1",
      title: "One World Radio — official site",
      url: "https://oneworldradio.tomorrowland.com/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s2",
      title: "One World Radio is celebrating its first anniversary",
      url: "https://press.oneworldradio.tomorrowland.com/one-world-radio-is-celebrating-its-1st-anniversary",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s3",
      title: "Seven years of One World Radio",
      url: "https://press.oneworldradio.tomorrowland.com/seven-years-of-one-world-radio-from-festival-fadio-to-a-global-electronic-music-platform",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s4",
      title: "Where to listen to One World Radio",
      url: "https://www.tomorrowland.com/article/one-world-radio-countries/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s5",
      title: "Tomorrowland's One World Radio joins SiriusXM",
      url: "https://press.oneworldradio.tomorrowland.com/tomorrowlands-one-world-radio-joins-siriusxm",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s6",
      title: "One World Radio international MP3 stream (checked for HTTP 200 and audio/mpeg)",
      url: "https://playerservices.streamtheworld.com/api/livestream-redirect/OWR_INTERNATIONAL.mp3",
      checkedOn: VERIFIED_ON,
    },
  ],
  blocks: [
    { type: "h2", id: "the-station", text: "The station" },
    {
      type: "p",
      text: "One World Radio is Tomorrowland's own radio station, on air continuously. It plays exclusive mixes, unique tracks and live sets recorded across more than two decades of the festival, alongside international hosts, shows and specials, all produced by the team behind Tomorrowland.",
      sources: ["s1", "s4", "s5"],
    },
    {
      type: "p",
      text: "It launched on 18 February 2019 to mark Tomorrowland's fifteenth anniversary, as a temporary anniversary project that was then made permanent.",
      sources: ["s2"],
    },
    {
      type: "facts",
      caption: "One World Radio by the numbers",
      rows: [
        {
          label: "Audience",
          value:
            "1.4 million unique monthly listeners across more than 130 countries, as reported by Tomorrowland in March 2026",
          sources: ["s3"],
        },
        {
          label: "Live festival hours",
          value:
            "More than 400 hours a year, broadcast live from Winter, Belgium, Brasil and Thailand",
          sources: ["s3"],
        },
        {
          label: "Shows",
          value: "Five daily hosts and more than 20 monthly shows, as reported in February 2026",
          sources: ["s3"],
        },
        {
          label: "North America",
          value: "Carried on SiriusXM since 4 March 2025, reaching 33 million subscribers",
          sources: ["s5"],
        },
      ],
    },
    { type: "h2", id: "how-to-listen", text: "How to listen" },
    {
      type: "p",
      text: "Several routes work anywhere in the world: the Tomorrowland App, the web player on tomorrowland.com, the official YouTube channel and the public international MP3 stream. Radioplayer and TuneIn also carry the station where a native app is unavailable.",
      sources: ["s4", "s6"],
    },
    {
      type: "facts",
      caption: "Ways to listen worldwide",
      rows: [
        {
          label: "Tomorrowland App",
          value:
            "Streams the station and supports Apple CarPlay and Android Auto, so it works in a car",
          sources: ["s4"],
        },
        {
          label: "Web player",
          value: "Plays on tomorrowland.com in a browser, with no account needed",
          sources: ["s4"],
        },
        {
          label: "YouTube",
          value: "A live video stream on the official Tomorrowland channel",
          sources: ["s4"],
        },
        {
          label: "International MP3 stream",
          value:
            "The public stream answered HTTP 200 with an audio/mpeg content type when checked on 18 November 2026, so it plays in any MP3-capable player",
          sources: ["s6"],
        },
        {
          label: "Radioplayer and TuneIn",
          value: "Third-party aggregators that both carry the station",
          sources: ["s4"],
        },
      ],
    },
    {
      type: "callout",
      tone: "tip",
      title: "Use the stream if a player blocks you",
      text: "Some countries have no terrestrial carriage and some apps are region-limited. The public MP3 stream is the fallback that works anywhere, and it needs nothing more than a browser tab or a media player.",
      sources: ["s6", "s4"],
    },
    { type: "h2", id: "by-country", text: "Carriage by country" },
    {
      type: "p",
      text: "Terrestrial coverage is narrower than the online reach. The official 2026 distribution list names DAB+ in Belgium, the Netherlands, Malta and the United Kingdom, FM in Ibiza, and online or syndicated carriage in several other countries. Where a country is not listed, the online routes above are the way in.",
      sources: ["s4", "s3"],
    },
    {
      type: "facts",
      caption: "Published carriage, as of the March 2026 official release",
      rows: [
        { label: "Belgium", value: "DAB+ nationwide", sources: ["s4"] },
        {
          label: "Netherlands",
          value: "DAB+, plus an online subchannel carried by Radio 538",
          sources: ["s4"],
        },
        {
          label: "United Kingdom",
          value: "DAB+ in southern England only",
          sources: ["s4"],
        },
        { label: "Malta", value: "DAB+ nationally", sources: ["s4"] },
        {
          label: "Spain",
          value: "Ibiza only: DAB+ and 100.5 FM. No mainland or Mallorca carriage is published",
          sources: ["s4"],
        },
        { label: "Austria", value: "Syndicated through Kronehit", sources: ["s3"] },
        {
          label: "Switzerland",
          value: "Online only, through the my105 website and app; no DAB+ or FM carriage is published",
          sources: ["s4"],
        },
        {
          label: "Germany",
          value: "Online through bigFM and I Love Music",
          sources: ["s4"],
        },
        { label: "France", value: "Online through Fun Radio", sources: ["s3"] },
        {
          label: "United States",
          value: "Online, plus the SiriusXM app and web player",
          sources: ["s3", "s5"],
        },
      ],
    },
    {
      type: "p",
      text: "Carriage changes between releases. A country that carried the station a year ago may not appear in the current list, in which case the honest answer is that no carriage is published and the online routes are the way to listen.",
      sources: ["s3", "s4"],
    },
    { type: "h2", id: "official-sources", text: "Sources" },
    {
      type: "ul",
      items: [
        "The station's own site for what it is and its continuous schedule.",
        "The anniversary press releases for launch date, audience, hosts, show count and the current distribution groups.",
        "The official country article for DAB+, FM and online carriage by country.",
        "The SiriusXM release for the North American satellite detail and its start date.",
      ],
      sources: ["s1", "s3", "s4", "s5"],
    },
  ],
});
