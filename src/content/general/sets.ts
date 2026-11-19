import { guideChapterSchema } from "../schema";

const VERIFIED_ON = "2026-11-18";

/**
 * Where official sets are published and which full sets were confirmed on an
 * official channel. Video identifiers are limited to the ones the ledger row
 * confirms by channel; fan counting figures and unverified IDs are excluded.
 */
export const generalSetsChapter = guideChapterSchema.parse({
  edition: "general",
  slug: "sets",
  order: 3,
  title: "Sets and recordings",
  summary:
    "Where Tomorrowland publishes full sets and DJ recordings, which official channels carry them, and how to tell an official upload from a fan copy.",
  lastVerified: VERIFIED_ON,
  related: ["general/radio", "general/nft", "general/editions"],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland official YouTube channel",
      url: "https://www.youtube.com/@Tomorrowland",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s2",
      title: "The Avicii Tribute — official add-on page (archived)",
      url: "https://belgium.tomorrowland.com/en/add-on-sale/tomorrowland-add-ons/the-avicii-tribute/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s3",
      title: "Tomorrowland Belgium 2026 aftermovie",
      url: "https://www.tomorrowland.com/article/tomorrowland-belgium-2026-aftermovie/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s4",
      title: "Martin Garrix — Live at Tomorrowland 2018",
      url: "https://www.youtube.com/watch?v=06eSsOWcKYA",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s5",
      title: "Martin Garrix — Live at Tomorrowland 2017",
      url: "https://www.youtube.com/watch?v=g_s17HMFaug",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s6",
      title: "Martin Garrix — Live at Tomorrowland 2022",
      url: "https://www.youtube.com/watch?v=GdMtN5Ifm-I",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s7",
      title: "Dimitri Vegas & Like Mike — Live at Tomorrowland 2015 Mainstage",
      url: "https://www.youtube.com/watch?v=MxQ1HM8RKbY",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s8",
      title: "Swedish House Mafia — Tomorrowland 2024, Weekend 2",
      url: "https://www.youtube.com/watch?v=dSK13X9oGi8",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s9",
      title: "Armin van Buuren — live at Tomorrowland 2024, Weekend 2",
      url: "https://www.youtube.com/watch?v=o8cZPumXJsk",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s10",
      title: "Hardwell — Tomorrowland 2024, Mainstage Weekend 2",
      url: "https://www.youtube.com/watch?v=Ne-nZA2bZMg",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s11",
      title: "Tomorrowland 2011 official aftermovie",
      url: "https://www.youtube.com/watch?v=M7CdTAiaLes",
      checkedOn: VERIFIED_ON,
    },
  ],
  blocks: [
    { type: "h2", id: "where-sets-live", text: "Where official sets are published" },
    {
      type: "p",
      text: "Full sets are published by Tomorrowland itself on its official YouTube channel, in the Tomorrowland App and on Apple Music. Artists also publish their own sets on their own channels, which is why the same performance can appear twice and why the channel name matters more than the title.",
      sources: ["s1", "s2"],
    },
    {
      type: "p",
      text: "Tomorrowland also publishes aftermovies. The 2011 aftermovie is on the official channel, and the 2026 edition closed with one of its own.",
      sources: ["s11", "s3"],
    },
    {
      type: "callout",
      tone: "note",
      title: "Check the channel, not the title",
      text: "An official upload can stop working when rights change or a video is made private, so a dead link is not evidence that the set never existed. If an upload sits on a channel that is not Tomorrowland or the artist in question, treat it as a fan copy regardless of what the thumbnail claims.",
      sources: ["s1", "s2"],
    },
    { type: "h2", id: "avicii", text: "Avicii" },
    {
      type: "p",
      text: "Avicii's Tomorrowland performances from 2012, 2014 and 2015 have been remastered and released officially, and they stream through Apple Music and the Tomorrowland App. Avicii debuted on the Mainstage in 2011 and returned in 2012, 2013, 2014 and 2015, the last of those his final Mainstage appearance.",
      sources: ["s2"],
    },
    {
      type: "p",
      text: "Older claims that only aftermovies survive are out of date. The remastered recordings are the official route to those sets.",
      sources: ["s2"],
    },
    { type: "h2", id: "confirmed-sets", text: "Confirmed full sets" },
    {
      type: "p",
      text: "The uploads below were each confirmed on an official channel. The list is a starting point rather than a catalogue: Tomorrowland has published far more than this, and every entry here resolves to a real video.",
      sources: ["s1", "s2", "s8"],
    },
    {
      type: "facts",
      caption: "Full sets confirmed on an official channel",
      rows: [
        {
          label: "Swedish House Mafia, 2024 Weekend 2",
          value: "Full set on Tomorrowland's own channel",
          sources: ["s8"],
        },
        {
          label: "Armin van Buuren, 2024 Weekend 2",
          value: "Full set on Armin van Buuren's own channel",
          sources: ["s9"],
        },
        {
          label: "Hardwell, 2024 Weekend 2",
          value:
            "Mainstage set on Hardwell's own channel rather than Tomorrowland's; the video title names Mainstage Weekend 2",
          sources: ["s10"],
        },
        {
          label: "Martin Garrix, 2018",
          value: "Full set on Martin Garrix's own channel",
          sources: ["s4"],
        },
        {
          label: "Martin Garrix, 2017",
          value: "Full set on Martin Garrix's own channel",
          sources: ["s5"],
        },
        {
          label: "Martin Garrix, 2022",
          value:
            "Full set from the 2022 edition on Martin Garrix's own channel; the title does not name the weekend",
          sources: ["s6"],
        },
        {
          label: "Dimitri Vegas & Like Mike, 2015",
          value: "Mainstage full set on the duo's own channel; the video title names Mainstage",
          sources: ["s7"],
        },
        {
          label: "Tomorrowland 2011 aftermovie",
          value: "Official aftermovie on Tomorrowland's channel, a film rather than a set",
          sources: ["s11"],
        },
      ],
    },
    { type: "h2", id: "what-not-to-trust", text: "Limits of this page" },
    {
      type: "ul",
      items: [
        "No set count per edition. Figures describing how many sets were released in a year come from press or fan counting rather than a Tomorrowland statement.",
        "No view counts. Those change daily and the video metadata does not fix them.",
        "No livestream archive links. Two 2024 livestream uploads in the research notes no longer resolve, so nothing here depends on them.",
        "No metadata conventions. Tomorrowland publishes no tagging scheme for its uploads, so any claim about how sets are labelled is unverified.",
      ],
      sources: ["s1", "s3"],
    },
  ],
});
