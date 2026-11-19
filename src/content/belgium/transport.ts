import { guideChapterSchema } from "../schema";

/**
 * How to reach De Schorre.
 *
 * Every sentence traces to a `confirmed` ledger row, or to the corrected value
 * of a `changed` row. Shuttle fares, timetables and parking prices are not
 * published for 2027, so the chapter names the gap instead of filling it: the
 * shuttle and locker data collections are deliberately empty for the same
 * reason.
 */
export const transportChapter = guideChapterSchema.parse({
  edition: "belgium",
  slug: "transport",
  order: 6,
  title: "Getting to Boom",
  summary:
    "Routes to De Schorre by plane, train, car, coach and bike, the shuttle pattern the official site confirms, and what it has not published for 2027.",
  lastVerified: "2026-11-18",
  related: ["belgium/global-journey", "belgium/faq", "belgium/dreamville"],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Belgium — how to get there",
      url: "https://belgium.tomorrowland.com/en/practical/how-to-get-there/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "Belgian rail — Tomorrowland travel discount",
      url: "https://www.belgiantrain.be/en/leisure/music-events/tomorrowland",
      checkedOn: "2026-11-18",
    },
    {
      id: "s3",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    {
      type: "p",
      text: "The festival is at the De Schorre recreation area in Boom, between Antwerp and Brussels. The routes to it are not interchangeable: the airport shuttles serve DreamVille on Thursday and Monday only, the city shuttles drop near the Main Entrance, and the train leaves you a 20-minute walk from the site.",
      sources: ["s1"],
    },
    { type: "h2", id: "what-the-official-page-confirms", text: "What the official page confirms" },
    {
      type: "facts",
      caption: "Confirmed route facts",
      rows: [
        {
          label: "Airport shuttles",
          value:
            "From Brussels Airport, Brussels South Charleroi and Eindhoven, to DreamVille on Thursday and back on Monday.",
          sources: ["s1"],
        },
        {
          label: "City shuttles",
          value:
            "Stops in several cities in Belgium and the Netherlands, sold as a round trip, dropping close to the Main Entrance.",
          sources: ["s1"],
        },
        {
          label: "Boom station",
          value: "A 20-minute walk from the station to the festival site, in the official wording.",
          sources: ["s1"],
        },
        {
          label: "Rail discount",
          value:
            "In the 2026 cycle, 40% off a return journey, with codes held in the main buyer's Tomorrowland Account.",
          sources: ["s2", "s1"],
        },
        {
          label: "Night trains",
          value: "Run to Antwerpen-Centraal only, with no connection onward to other cities.",
          sources: ["s1"],
        },
        {
          label: "Parking vouchers",
          value: "Sold in advance in the Add-On Sale, not at the gate.",
          sources: ["s1"],
        },
      ],
    },
    { type: "h2", id: "arriving-by-plane", text: "Arriving by plane" },
    {
      type: "p",
      text: "Tomorrowland sells airport shuttles from three airports: Brussels Airport, Brussels South Charleroi and Eindhoven. They run to DreamVille on the Thursday and back on the Monday, so a Friday arrival or a Sunday departure needs your own arrangements.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "No fare is published on the practical page, and the 2027 sale has not opened. Any price you see quoted for these routes is unconfirmed, which is why this guide quotes none. The official page is [How to get there](https://belgium.tomorrowland.com/en/practical/how-to-get-there/).",
      sources: ["s1"],
    },
    { type: "h2", id: "arriving-by-train", text: "Arriving by train" },
    {
      type: "p",
      text: "Rail brings you to Boom station, and the official 2026 wording puts the walk from there to the festival site at 20 minutes. That walk is the last leg of the journey, so it is the number to plan around in rain or with luggage.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "Belgian rail offers a discount on a return journey to the festival: 40% in the 2026 cycle. The codes sit in the main buyer's Tomorrowland Account, one per Day Pass or DreamVille package and three per Full Madness Pass. Global Journey buyers are excluded, because travel is already part of their package.",
      sources: ["s2", "s1"],
    },
    {
      type: "p",
      text: "After the music ends, extra night trains run to Antwerpen-Centraal only and offer no connection onward to other cities. In the 2026 cycle, boarding a train without a ticket carried a €90 fine.",
      sources: ["s1"],
    },
    { type: "h2", id: "the-shuttle-pattern", text: "The shuttle pattern" },
    {
      type: "p",
      text: "City shuttles are a round-trip product with stops in several Belgian and Dutch cities. They drop passengers close to the Main Entrance rather than at DreamVille, which is the fact that matters when you are deciding between a hotel and a tent.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "The free shuttle between Boom station and DreamVille is inbound on Thursday and Friday only, with the return on the Monday. Both the 2025 and the 2026 versions of the official page name those two inbound days.",
      sources: ["s1"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "No 2027 fares or timetables are published",
      text: "The official page confirms the airport routes, the city-shuttle product and the Thursday-in/Monday-out pattern. It publishes no fare and no departure timetable for either, so this guide gives neither. Budget for the shuttle from the price shown in the Add-On Sale when it opens, not from a figure in an older guide.",
      sources: ["s1"],
    },
    { type: "h2", id: "driving-parking-and-drop-off", text: "Driving, parking and drop-off" },
    {
      type: "ul",
      items: [
        "Parking vouchers are bought in advance through the Add-On Sale. No 2027 price is published on the practical page.",
        "Follow the signs for 'Parking Festival' or 'Parking DreamVille'. The two are signposted as separate routes.",
        "There are no facilities to charge a car in the car parks, so arrive with a full battery.",
        "The Kiss & Ride zone is for drop-off and pick-up only, and parking there is not allowed. Pre-booked Uber and Bolt cars wait there, where space is limited.",
        "In the 2026 cycle, taxis dropped at a signposted taxi zone and places there were first come, first served.",
        "A coach you organise yourself must be registered in advance. In the 2026 cycle the deadline was 14 July.",
        "Bicycle parking is free and supervised near the festival main entrance and near DreamVille Entrance 1. The free Park & Bike scheme pairs the free remote car parks with a cycle route to the site.",
      ],
      sources: ["s1"],
    },
    { type: "h2", id: "what-is-not-published", text: "What is not published" },
    {
      type: "p",
      text: "Four things a traveller wants are still missing for 2027: the fares for the airport and city shuttles, their departure times, the departure times of the extra night trains, and the price of the parking vouchers. The pages checked here confirm which routes run and on which days, and nothing more.",
      sources: ["s1"],
    },
    { type: "h2", id: "order-of-decisions", text: "Order of decisions" },
    {
      type: "ol",
      items: [
        "Decide where you sleep. The airport shuttles and the free Boom shuttle both serve DreamVille on Thursday and Monday, so they fit a DreamVille stay far better than a hotel with day tickets.",
        "Fix the days before the route. If you fly, plan a Thursday arrival and a Monday departure, or use the train, because the airport shuttles do not run on other days.",
        "If you would rather buy transport and accommodation in one purchase, the Global Journey sale is on Saturday 30 January 2027 at 17:00 CET.",
        "If you travel by rail, take the discount codes from the main buyer's Tomorrowland Account before booking.",
        "Buy parking and shuttle places in the Add-On Sale. The 2027 date is not published yet, and no fare is quoted on the practical page.",
        "Register any coach you organise before the published deadline.",
      ],
      sources: ["s1", "s3"],
    },
  ],
});
