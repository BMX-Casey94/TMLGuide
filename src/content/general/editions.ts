import { guideChapterSchema } from "../schema";

const VERIFIED_ON = "2026-11-18";

/**
 * Editions overview: the dates and status of every edition TMLGUIDE tracks.
 * Source URLs come from the shared editions data, which the ledger covers.
 */
export const generalEditionsChapter = guideChapterSchema.parse({
  edition: "general",
  slug: "editions",
  order: 5,
  title: "Editions and dates",
  summary:
    "Every Tomorrowland edition in the current cycle with its dates, venue and status, from Thailand in December 2026 to Belgium in July 2027.",
  lastVerified: VERIFIED_ON,
  related: ["general/pearls", "general/radio", "brasil/overview", "belgium/overview"],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Thailand — official site",
      url: "https://thailand.tomorrowland.com/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s2",
      title: "Tomorrowland announces its first ever Thailand edition",
      url: "https://press.thailand.tomorrowland.com/tomorrowland-announces-its-first-ever-thailand-edition-launching-as-a-full-scale-festival-in-december-2026",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s3",
      title: "Tomorrowland Brasil — official site with 2027 dates",
      url: "https://brasil.tomorrowland.com/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s4",
      title: "Tomorrowland Belgium — official site with 2027 weekend dates",
      url: "https://belgium.tomorrowland.com/en/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s5",
      title: "Tomorrowland Winter — official site with 2027 dates",
      url: "https://winter.tomorrowland.com/en/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s6",
      title: "Tomorrowland Belgium returns in 2026",
      url: "https://press.belgium.tomorrowland.com/tomorrowland-belgium-returns-in-2026",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s7",
      title: "This was Tomorrowland Winter 2026",
      url: "https://press.winter.tomorrowland.com/this-was-tomorrowland-winter-2026",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s8",
      title: "Tomorrowland Belgium 2026 aftermovie",
      url: "https://www.tomorrowland.com/article/tomorrowland-belgium-2026-aftermovie/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s9",
      title: "Tomorrowland Belgium 2026 line-up",
      url: "https://www.tomorrowland.com/article/tomorrowland-belgium-lineup-2026/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s10",
      title: "Relive the magic of Tomorrowland Brasil 2025",
      url: "https://press.brasil.tomorrowland.com/relive-the-magic-of-tomorrowland-brasil-2025",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s11",
      title: "What is the difference between the different sales moments?",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037219532-What-is-the-difference-between-the-different-sales-moments",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s13",
      title: "Tomorrowland Brasil will not hold a 2026 edition (official statement reproduced)",
      url: "https://gshow.globo.com/festivais/tomorrowland-brasil/noticia/tomorrowland-brasil-nao-tera-edicao-em-2026-apos-incendio-na-belgica.ghtml",
      checkedOn: VERIFIED_ON,
    },
  ],
  blocks: [
    { type: "h2", id: "the-cycle", text: "The current cycle" },
    {
      type: "p",
      text: "Three editions make up the 2026–27 narrative, themed Consciência and told in order: Tomorrowland Belgium in July 2026, Tomorrowland Thailand in December 2026 and Tomorrowland Brasil in April 2027. Tomorrowland Winter runs separately in the Alps, over a single week in March 2027.",
      sources: ["s1", "s3", "s5"],
    },
    { type: "h2", id: "ahead", text: "Editions ahead" },
    {
      type: "facts",
      caption: "Upcoming and sold-out editions",
      rows: [
        {
          label: "Thailand 2026",
          value:
            "11 to 13 December 2026, Wisdom Valley, Pattaya. The first Thailand edition, and officially sold out",
          sources: ["s1", "s2"],
        },
        {
          label: "Winter 2027",
          value: "20 to 27 March 2027, Alpe d'Huez, France, one week",
          sources: ["s5"],
        },
        {
          label: "Brasil 2027",
          value:
            "30 April to 2 May 2027, Parque Maeda, Itu, São Paulo. DreamVille opens Thursday 29 April",
          sources: ["s3"],
        },
        {
          label: "Belgium 2027, Weekend 1",
          value: "16 to 18 July 2027, De Schorre recreation area, Boom",
          sources: ["s4"],
        },
        {
          label: "Belgium 2027, Weekend 2",
          value: "23 to 25 July 2027, De Schorre recreation area, Boom",
          sources: ["s4"],
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Thailand is closed",
      text: "Thailand sold out, so there is no ticket to buy for the December 2026 edition. Treat any offer of a Thailand ticket as a resale rather than a sale, and check the official channels rather than a marketplace.",
      sources: ["s1"],
    },
    { type: "h2", id: "behind", text: "Editions just past" },
    {
      type: "facts",
      caption: "Recent editions",
      rows: [
        {
          label: "Winter 2026",
          value:
            "21 to 28 March 2026, Alpe d'Huez, the sixth Winter edition, held over a single week",
          sources: ["s7"],
        },
        {
          label: "Belgium 2026",
          value:
            "Weekend 1 ran 17 to 19 July 2026 and Weekend 2 ran 24 to 26 July 2026. Both weekends sold out beforehand",
          sources: ["s6", "s9"],
        },
        {
          label: "Belgium 2026, the 20th edition",
          value: "Tomorrowland describes the 2026 edition as its twentieth, which has now finished",
          sources: ["s8"],
        },
        {
          label: "Brasil 2025",
          value:
            "10 to 12 October 2025 at Parque Maeda, the fifth Brasil edition, themed LIFE",
          sources: ["s10"],
        },
      ],
    },
    {
      type: "p",
      text: "Brasil did not run in 2026. In the statement issued at the time and reproduced in full by the Brazilian outlet Gshow, the gap was called a postponement rather than a cancellation, after the stage planned to travel to Brazil was lost in the July 2025 fire. The edition returns in April 2027.",
      sources: ["s3", "s13"],
    },
    { type: "h2", id: "planning", text: "Planning across editions" },
    {
      type: "ul",
      items: [
        "Sale calendars differ by edition and do not follow one pattern: Brasil's 2027 sale moments ran from April to September 2026, while the European editions run their own cycles. Check the edition you are attending rather than assuming a shared calendar.",
        "Prices are set per edition and per currency. Brasil publishes in reais; the European editions publish in euros. This guide never converts between them.",
        "Winter is a single week in March; Belgium is two weekends in July; Brasil is one weekend in late April.",
        "Camping differs by edition. DreamVille operates at Belgium and Brasil, with different package families and different rules on whether a pitch is sold per person.",
      ],
      sources: ["s3", "s4", "s5", "s11"],
    },
    {
      type: "p",
      text: "The Belgium edition is covered in [Belgium](/guides/belgium/overview), the Alpine week in [Winter](/guides/winter/overview) and the Brazilian edition in [Brasil](/guides/brasil/overview).",
      sources: ["s3", "s4", "s5"],
    },
  ],
});
