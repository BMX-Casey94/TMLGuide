import type { GuideChapter } from "../schema";

/**
 * Belgium chapter 1 of 5 (part A).
 *
 * Only figures the fact-check ledgers publish as confirmed or corrected appear
 * here: the two 2027 weekends, the venue, the headline statistics block, the
 * festival hours and the DreamVille opening rule. The official page's
 * "over 200 countries" line contradicts its own statistics block, so it is not
 * used. No price is typed into this chapter; prices live in `data` blocks.
 */
export const overviewChapter = {
  edition: "belgium",
  slug: "overview",
  order: 1,
  title: "Tomorrowland Belgium",
  summary:
    "What Tomorrowland Belgium is: the two weekends in Boom in July 2027, the headline numbers the official site publishes, and how tickets, sleep and travel fit together.",
  lastVerified: "2026-11-18",
  related: [
    "belgium/dates-and-sales",
    "belgium/tickets",
    "belgium/accommodation",
    "belgium/transport",
  ],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Belgium — official homepage, 2027 edition",
      url: "https://belgium.tomorrowland.com/en/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "Tomorrowland Belgium — how to get there",
      url: "https://belgium.tomorrowland.com/en/practical/how-to-get-there/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s3",
      title: "Tomorrowland Belgium — opening hours",
      url: "https://belgium.tomorrowland.com/en/practical/opening-hours/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s4",
      title: "Tomorrowland Belgium — day passes",
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s5",
      title: "Tomorrowland Belgium — Full Madness pass",
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s6",
      title: "Tomorrowland Belgium — accommodation",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s7",
      title: "Tomorrowland Belgium — Global Journey",
      url: "https://belgium.tomorrowland.com/en/tickets/global-journey/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s8",
      title: "What is Pre-Registration",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/43968145412372-What-is-Pre-Registration",
      checkedOn: "2026-11-18",
    },
    {
      id: "s9",
      title: "What is the difference between the different sales moments",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037219532-What-is-the-difference-between-the-different-sales-moments",
      checkedOn: "2026-11-18",
    },
    {
      id: "s10",
      title: "Tomorrowland Belgium — line-up",
      url: "https://belgium.tomorrowland.com/en/line-up/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s11",
      title: "Tomorrowland Belgium — your Tomorrowland bracelet",
      url: "https://belgium.tomorrowland.com/en/practical/your-tomorrowland-bracelet/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s12",
      title: "Tomorrowland Belgium — facilities",
      url: "https://belgium.tomorrowland.com/en/practical/facilities/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s13",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    { type: "h2", id: "the-festival", text: "The festival" },
    {
      type: "p",
      text: "Tomorrowland Belgium 2027 takes place at the De Schorre recreation area in Boom, a town between Antwerp and Brussels. It runs over two weekends, 16–18 July 2027 and 23–25 July 2027, each from Friday to Sunday. DreamVille, the campsite beside the festival site, keeps its own opening hours rather than the festival's, so its timetable needs checking separately.",
      sources: ["s2", "s1", "s3"],
    },
    {
      type: "facts",
      caption: "Tomorrowland Belgium 2027 at a glance",
      rows: [
        {
          label: "Venue",
          value: "De Schorre recreation area, Boom, Belgium",
          sources: ["s2"],
        },
        { label: "Weekend 1", value: "16–18 July 2027, Friday to Sunday", sources: ["s1"] },
        { label: "Weekend 2", value: "23–25 July 2027, Friday to Sunday", sources: ["s1"] },
        { label: "Stages", value: "16", sources: ["s1"] },
        { label: "People of Tomorrow", value: "400,000", sources: ["s1"] },
        { label: "Nationalities", value: "191", sources: ["s1"] },
        { label: "Festival hours, Friday and Saturday", value: "12:00–01:00", sources: ["s3"] },
        { label: "Festival hours, Sunday", value: "12:00–00:00", sources: ["s3"] },
        {
          label: "DreamVille opening rule",
          value: "Open continuously from Thursday 11:00 to Monday 12:00",
          sources: ["s3"],
        },
      ],
    },
    { type: "h2", id: "how-a-visit-fits-together", text: "How a visit fits together" },
    {
      type: "p",
      text: "A visit divides into three questions: which pass, where you sleep, and how you reach Boom. The pass is either a day pass for Friday, Saturday or Sunday, or a Full Madness pass covering all three days of one weekend. A DreamVille package answers the first two at once, because it bundles a Full Madness pass with a place in one of the campsite areas.",
      sources: ["s4", "s5", "s6"],
    },
    {
      type: "ul",
      items: [
        "**Tickets.** Five pass types, each published at a pre-sale price and a WorldWide Ticket Sale price. The tickets chapter sets out what each tier includes and shows the 2027 figures.",
        "**Sleeping.** A DreamVille package adds a place in one of the campsite's five areas to a Full Madness pass. A hotel bed can also be part of a Global Journey package.",
        "**Travel.** Boom is served by train, bus, car, bicycle and airport shuttle. Global Journey packages bundle a ticket with hotel and/or DreamVille, with or without transport, and the transport chapter covers the routes confirmed for 2027.",
      ],
      sources: ["s6", "s7", "s2"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "One pass covers one weekend",
      text: "A Full Madness pass covers all three days of one weekend, not both weekends, and no purchase can be changed, upgraded or cancelled afterwards. Choosing the weekend comes before every other decision, because the only route out of a mistaken purchase is the Exchange Desk.",
      sources: ["s5", "s13"],
    },
    { type: "h2", id: "key-dates", text: "Key dates" },
    {
      type: "p",
      text: "Pre-registration opens on 2 December 2026 and closes on 12 February 2027. Three sale moments follow, each at 17:00 CET on a Saturday. Pre-registration is required for all three and does not guarantee a ticket.",
      sources: ["s8", "s9"],
    },
    {
      type: "facts",
      caption: "2027 sale moments",
      rows: [
        {
          label: "Pre-registration opens",
          value: "2 December 2026, 15:00 CET",
          sources: ["s8"],
        },
        {
          label: "Pre-registration closes",
          value: "12 February 2027, 15:00 CET",
          sources: ["s8"],
        },
        {
          label: "Global Journey Travel Packages Sale",
          value: "30 January 2027, 17:00 CET",
          sources: ["s9"],
        },
        { label: "WorldWide Pre-Sale", value: "6 February 2027, 17:00 CET", sources: ["s9"] },
        { label: "WorldWide Ticket Sale", value: "13 February 2027, 17:00 CET", sources: ["s9"] },
      ],
    },
    { type: "h2", id: "what-is-not-published", text: "What is not published yet" },
    {
      type: "p",
      text: "Several things a traveller plans around are not published yet: the 2027 line-up, the 2027 Pearl value, the add-on sale date, locker prices, shuttle fares and the DreamVille capacity. Each chapter names the gap where it applies rather than filling it with an estimate.",
      sources: ["s10", "s11", "s12", "s2"],
    },
    {
      type: "callout",
      tone: "note",
      title: "Unpublished is not the same as unplanned",
      text: "Tomorrowland states that locker prices and the Pearl value will be published later, and that the 2027 line-up will be revealed at a later stage. Treat any figure you see elsewhere for those items as unconfirmed until the official page carries it.",
      sources: ["s12", "s11", "s10"],
    },
  ],
} satisfies GuideChapter;
