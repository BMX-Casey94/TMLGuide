import { guideChapterSchema } from "../schema";

const VERIFIED_ON = "2026-11-18";

/**
 * Brasil transport: the four published ways to reach Parque Maeda, the shuttle
 * cities and boarding points, the one-voucher-per-day rule and the 300 m walk
 * from the shuttle stop to the Main Entrance.
 */
export const brasilTransportChapter = guideChapterSchema.parse({
  edition: "brasil",
  slug: "transport",
  order: 4,
  title: "Getting there",
  summary:
    "How to reach Parque Maeda: the official shuttle and its cities, the one-voucher-per-day rule, the 300 m walk to the gate and the Itu circular bus.",
  lastVerified: VERIFIED_ON,
  related: ["brasil/overview", "brasil/tickets", "brasil/dreamville", "belgium/transport"],
  sources: [
    {
      id: "s1",
      title: "How do I get to Parque Maeda?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/41036738826516",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s2",
      title: "Tomorrowland Brasil Shuttle",
      url: "https://brasil.tomorrowland.com/en/add-on-sale/tomorrowland-brasil-shuttle/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s3",
      title: "How much does the official shuttle cost?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/17509855783700",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s4",
      title: "Do I need a shuttle voucher for every festival day?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/17510657026964",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s5",
      title: "Where are the shuttle boarding points?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/17510505217940",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s6",
      title: "DreamVille Shuttle",
      url: "https://brasil.tomorrowland.com/en/add-on-sale/dreamville-shuttle/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s7",
      title: "Tomorrowland Brasil 2027 tickets",
      url: "https://brasil.tomorrowland.com/en/tickets/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s8",
      title: "Tomorrowland Brasil 2027: all you need to know",
      url: "https://www.tomorrowland.com/article/tomorrowland-brasil-2027-all-you-need-to-know/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s9",
      title: "Tomorrowland Brasil 2027 add-ons",
      url: "https://brasil.tomorrowland.com/en/add-on-sale/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s10",
      title: "Parque Maeda — contact and address",
      url: "https://parquemaeda.com.br/contato/",
      checkedOn: VERIFIED_ON,
    },
  ],
  blocks: [
    { type: "h2", id: "the-site", text: "Where the site is" },
    {
      type: "p",
      text: "Parque Maeda sits in Zona Rural, Itu, in São Paulo state. The venue operator gives the address as Rodovia Deputado Archimedes Lammoglia, KM 18. Tomorrowland publishes no distance or journey time from São Paulo city, so plan the journey from a route planner rather than from a figure quoted on a fan site.",
      sources: ["s10"],
    },
    { type: "h2", id: "arrival-options", text: "Ways in" },
    {
      type: "ul",
      items: [
        "The official shuttle, sold as an add-on and run by Tomorrowland.",
        "The Ônibus Circular de Itu, listed by the official help centre as an arrival option alongside the shuttle.",
        "Your own vehicle.",
        "Ride-hailing apps, which Tomorrowland names as an accepted option.",
      ],
      sources: ["s1"],
    },
    {
      type: "p",
      text: "The add-on shop listed only two products when it was checked on 18 November 2026: the Tomorrowland Brasil Shuttle and the DreamVille Shuttle, with a note that more products would follow. No parking product appeared.",
      sources: ["s9"],
    },
    { type: "h2", id: "shuttle", text: "The official shuttle" },
    {
      type: "p",
      text: "The festival shuttle runs to and from the site for day and Full Madness ticket holders. The stop is 300 metres from the Main Entrance, so the transfer ends with a short walk rather than a second bus.",
      sources: ["s2"],
    },
    {
      type: "facts",
      caption: "Festival shuttle: departure cities and boarding points, 2027",
      rows: [
        {
          label: "Departure cities",
          value:
            "São Paulo, Barueri, Campinas, São Bernardo and Rio de Janeiro — Rio de Janeiro is a departure city for 2027",
          sources: ["s2"],
        },
        {
          label: "São Paulo boarding points",
          value: "Hotel Holiday Inn Anhembi and Hotel Hilton Morumbi",
          sources: ["s5"],
        },
        {
          label: "DreamVille boarding points",
          value:
            "Hotel Holiday Inn Anhembi, Guarulhos International Airport (GRU) and Campinas",
          sources: ["s5"],
        },
        {
          label: "Fare",
          value:
            "From R$220 per person, priced by departure city; per-city fares are shown only inside the ticket shop",
          sources: ["s3", "s2"],
        },
        {
          label: "Drop-off",
          value: "300 metres from the Main Entrance",
          sources: ["s2"],
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "One voucher, one festival day",
      text: "A shuttle voucher covers a single festival day. A Full Madness holder travelling by shuttle therefore needs three vouchers, one for each day. At the 2027 floor of R$220 that is from R$660 for the weekend from São Paulo, not R$220.",
      sources: ["s4", "s3"],
    },
    {
      type: "p",
      text: "Exact departure and return times are not published on the information page. The official page directs readers to the ticket shop for travel times, and the shop runs on the ByInti platform, which the tickets page links to, so the times first appear once you are in the purchase flow.",
      sources: ["s2", "s7"],
    },
    { type: "h2", id: "dreamville-shuttle", text: "The DreamVille shuttle" },
    {
      type: "p",
      text: "DreamVille guests have a separate service: a round trip from São Paulo or Campinas on the Thursday before the festival. The fare is shown only inside the ticket shop.",
      sources: ["s6"],
    },
    {
      type: "p",
      text: "It is a separate product from the festival shuttle, sold as its own add-on, so buying one does not cover the other.",
      sources: ["s6", "s2"],
    },
    { type: "h2", id: "buying", text: "Buying a shuttle pass" },
    {
      type: "ol",
      items: [
        "Buy the shuttle pass in the same sale as your ticket. Shuttle passes went on sale in the WorldWide Ticket Sale on 24 September 2026.",
        "Buy one pass per festival day you intend to travel, not one per weekend.",
        "Check the departure city and boarding point when you buy, because the fare depends on the city and the boarding points differ between the festival and DreamVille services.",
        "Read the travel times from the ticket shop, the only place they are published.",
      ],
      sources: ["s8", "s4", "s5", "s2"],
    },
    {
      type: "p",
      text: "The published floor fare is R$220 per person for 2027, and the actual fare depends on the departure city. A single-city figure quoted as the whole weekend cost understates the trip, because the voucher does not cover a second day.",
      sources: ["s3", "s2"],
    },
  ],
});
