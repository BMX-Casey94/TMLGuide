import { guideChapterSchema } from "../schema";

const VERIFIED_ON = "2026-11-18";

/**
 * Brasil overview: dates, site, prices and the four decisions a reader has to
 * make first. Every price is rendered from `src/data/brasil`, never retyped.
 */
export const brasilOverviewChapter = guideChapterSchema.parse({
  edition: "brasil",
  slug: "overview",
  order: 1,
  title: "Tomorrowland Brasil 2027",
  summary:
    "Dates, venue, theme and every published 2027 price for Tomorrowland Brasil, plus what to settle before you book travel to Itu.",
  lastVerified: VERIFIED_ON,
  related: ["brasil/tickets", "brasil/dreamville", "brasil/transport", "general/editions"],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Brasil — official site",
      url: "https://brasil.tomorrowland.com/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s2",
      title: "Tomorrowland Brasil 2027: all you need to know",
      url: "https://www.tomorrowland.com/article/tomorrowland-brasil-2027-all-you-need-to-know/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s3",
      title: "Tomorrowland Brasil 2027 — the official countdown has begun",
      url: "https://press.brasil.tomorrowland.com/tomorrowland-brasil-2027-the-official-countdown-has-begun",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s4",
      title: "Tomorrowland Brasil will not hold a 2026 edition (official statement reproduced)",
      url: "https://gshow.globo.com/festivais/tomorrowland-brasil/noticia/tomorrowland-brasil-nao-tera-edicao-em-2026-apos-incendio-na-belgica.ghtml",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s5",
      title: "Tomorrowland Brasil 2027 festival tickets and prices",
      url: "https://brasil.tomorrowland.com/en/tickets/festival-tickets/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s6",
      title: "Parque Maeda — contact and address",
      url: "https://parquemaeda.com.br/contato/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s7",
      title: "Relive the magic of Tomorrowland Brasil 2025",
      url: "https://press.brasil.tomorrowland.com/relive-the-magic-of-tomorrowland-brasil-2025",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s8",
      title: "Alok makes history at Tomorrowland Brasil with a drone show",
      url: "https://press.brasil.tomorrowland.com/alok-makes-history-at-tomorrowland-brazil-breaking-latin-american-record-with-drone-show",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s9",
      title: "Who is entitled to a half-price (meia-entrada) ticket?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/en-us/articles/13511256421780",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s10",
      title: "Magnificent Greens packages",
      url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/magnificent-greens/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s11",
      title: "Do I need a shuttle voucher for every festival day?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/17510657026964",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s12",
      title: "How does the DreamVille stay work?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/13510975314708",
      checkedOn: VERIFIED_ON,
    },
  ],
  blocks: [
    { type: "h2", id: "the-2027-edition", text: "The 2027 edition" },
    {
      type: "p",
      text: "Tomorrowland Brasil 2027 runs from Friday 30 April to Sunday 2 May 2027 at Parque Maeda in Itu, São Paulo state. The theme is Consciência, told as one narrative across Belgium 2026, Thailand in December 2026 and Brasil last. DreamVille opens on Thursday 29 April, the day before the festival.",
      sources: ["s1", "s2", "s12"],
    },
    {
      type: "p",
      text: "No Brasil edition was held in 2026. Tomorrowland's own pages describe 2026 as a year without a local edition. In the statement the company issued at the time, reproduced in full by the Brazilian outlet Gshow, the gap was called a postponement rather than a cancellation: the Orbyz Mainstage, the stage planned to travel to Brazil, was lost in the July 2025 fire.",
      sources: ["s3", "s4"],
    },
    { type: "h2", id: "prices-in-reais", text: "Prices in reais" },
    {
      type: "p",
      text: "Every Brasil price is in Brazilian reais and is shown here in reais, never converted. The figures below are the ones the official ticket page published, and every pass was marked sold out when it was checked on 18 November 2026.",
      sources: ["s5"],
    },
    {
      type: "data",
      edition: "brasil",
      collection: "tickets",
      idPrefix: "full-madness",
      caption: "Full Madness and Full Madness Comfort passes: 2027 prices (sold out)",
    },
    {
      type: "data",
      edition: "brasil",
      collection: "tickets",
      idPrefix: "bybit",
      caption: "Bybit Early Bird Full Madness passes: 2027 prices (sold out)",
    },
    {
      type: "data",
      edition: "brasil",
      collection: "tickets",
      idPrefix: "day-pass",
      caption: "Day passes: 2027 prices (sold out)",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Nothing is on general sale",
      text: "Every 2027 Brasil pass shows as sold out on the official ticket page. The official Waiting List notice says a place on it does not guarantee the opportunity to purchase, so do not book flights or hotels on the strength of a place in a queue.",
      sources: ["s5", "s1"],
    },
    { type: "h2", id: "the-site", text: "The site" },
    {
      type: "p",
      text: "Parque Maeda is in Itu. The venue operator gives the address as Rodovia Deputado Archimedes Lammoglia, KM 18, Zona Rural, Itu-SP.",
      sources: ["s6"],
    },
    {
      type: "p",
      text: "Every Brasil edition has been held at Parque Maeda: 2015 and 2016, the return in 2023, then 2024 and 2025, and now 2027. The 2025 edition was the fifth, themed LIFE, held from 10 to 12 October 2025 with more than 150 artists across six stages. Alok's set on 12 October 2025 included a display of more than 1,000 drones above the Mainstage.",
      sources: ["s1", "s7", "s8"],
    },
    { type: "h2", id: "what-to-settle-first", text: "What to settle first" },
    {
      type: "ol",
      items: [
        "Check the official ticket page before anything else. Every 2027 pass is sold out, and that page is where a further release would appear.",
        "If you are not a Brazilian citizen, budget the full price. The half-price rate is restricted to Brazilian citizens and has to be proved at the gate.",
        "Choose a camping family before comparing totals: a Magnificent Greens pitch is sold per person, an Easy Tent per tent for two, and a Grande unit per accommodation for four.",
        "Count one shuttle voucher for every festival day you plan to travel, so three for a Full Madness pass.",
      ],
      sources: ["s5", "s9", "s10", "s11"],
    },
    {
      type: "p",
      text: "The pass types and the meia-entrada rules are set out in [Tickets and prices](/guides/brasil/tickets), the campsite in [DreamVille](/guides/brasil/dreamville) and the shuttle in [Getting there](/guides/brasil/transport).",
      sources: ["s5"],
    },
  ],
});
