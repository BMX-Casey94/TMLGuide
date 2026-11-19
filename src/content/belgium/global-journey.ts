import { guideChapterSchema } from "../schema";

/**
 * Global Journey.
 *
 * The ledger confirms the 2027 sale instant, the six-person cap, the transport
 * and experience package families, the three exclusive traveller events, the
 * no-parking rule and the outbound-flight cancellation rule. It also records
 * that the DJ Academy package is gone. Departure cities, per-package prices and
 * activity lists are not published, so none is stated.
 */
export const globalJourneyChapter = guideChapterSchema.parse({
  edition: "belgium",
  slug: "global-journey",
  order: 7,
  title: "Global Journey packages",
  summary:
    "Tomorrowland's own travel-package sale: what it bundles, which package families exist for 2027, who may buy, the account cap, and what to check before the January sale.",
  lastVerified: "2026-11-18",
  related: ["belgium/dates-and-sales", "belgium/transport", "belgium/faq"],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "Tomorrowland Belgium — Global Journey",
      url: "https://belgium.tomorrowland.com/en/tickets/global-journey/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s3",
      title: "Tomorrowland Belgium — Global Journey packages, 2027 line-up",
      url: "https://belgium.tomorrowland.com/en/passes-packages/global-journey/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s4",
      title: "Tomorrowland — flight packages",
      url: "https://belgium.tomorrowland.com/en/passes-packages/travel-packages/flight-packages/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s5",
      title: "Tomorrowland — hotel packages",
      url: "https://belgium.tomorrowland.com/en/passes-packages/travel-packages/hotel-packages/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s6",
      title: "Can I resell my tickets at the online Exchange Desk",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037811911-Can-I-resell-my-tickets-at-the-online-Exchange-Desk",
      checkedOn: "2026-11-18",
    },
    {
      id: "s7",
      title: "Tomorrowland — Relax Room 2P package",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/montagoe/relax-room-2p-packages/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s8",
      title: "Tomorrowland — Surprise Package",
      url: "https://belgium.tomorrowland.com/en/passes-packages/travel-packages/surprise-package/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s9",
      title: "What is Pre-Registration",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/43968145412372-What-is-Pre-Registration",
      checkedOn: "2026-11-18",
    },
    {
      id: "s10",
      title: "Tomorrowland Belgium — festival pass and accommodation",
      url: "https://belgium.tomorrowland.com/en/tickets/festival-pass-accommodation/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s11",
      title: "Tomorrowland — Friendship Travel packages",
      url: "https://belgium.tomorrowland.com/en/passes-packages/travel-packages/friendship-travel-packages/",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    {
      type: "p",
      text: "Global Journey is Tomorrowland's own travel-package sale. A package combines a Full Madness pass, or a Full Madness Comfort pass, with transport and accommodation, and it is sold in its own sale ahead of the ticket sales.",
      sources: ["s1", "s2"],
    },
    {
      type: "facts",
      caption: "Global Journey at a glance",
      rows: [
        { label: "Sale opens", value: "Saturday 30 January 2027 at 17:00 CET.", sources: ["s1"] },
        { label: "What is sold", value: "Travel packages only, not standalone tickets.", sources: ["s1"] },
        {
          label: "Account cap",
          value: "Six people per Tomorrowland Account, and two during the NFT Global Journey sale.",
          sources: ["s1"],
        },
        {
          label: "Pass in the bundle",
          value: "A Full Madness pass or a Full Madness Comfort pass.",
          sources: ["s2"],
        },
        { label: "Exchange Desk", value: "Not available for Global Journey packages.", sources: ["s6"] },
        {
          label: "Parking",
          value:
            "Not included, even where the accommodation is a Montagoe unit that comes with a parking voucher in the normal sale.",
          sources: ["s7"],
        },
      ],
    },
    { type: "h2", id: "package-families", text: "Package families" },
    {
      type: "p",
      text: "Three transport families are sold: flight, train and bus. Alongside them sit the experience packages, which are tied to a weekend or to a themed programme rather than to a departure city.",
      sources: ["s3"],
    },
    {
      type: "ul",
      items: [
        "Flight packages, with either a regular flight or a Party Flight carrying a Tomorrowland act.",
        "Train packages.",
        "Bus packages.",
      ],
      sources: ["s2", "s4"],
    },
    {
      type: "ul",
      items: [
        "Weekend 1 experience packages: Discover Belgium, Discover Europe and Discover Ibiza.",
        "The Surprise Package, sold for Weekend 2.",
        "The Youth Package, which for 2027 runs in both weekends.",
        "Three packages new for 2027: Wellbeing, Love Tomorrow, and Tomorrowland x Formula 1 Belgian Thrill.",
      ],
      sources: ["s1", "s8", "s3"],
    },
    {
      type: "p",
      text: "Hotel-based packages range from a hostel through Bronze, Silver and Gold hotels to a Concept Hotel, with the Tomorrowland Theme Hotel available in Brussels only. Brussels hotels transfer to the festival by bus, while Antwerp hotels and hostels transfer by train.",
      sources: ["s5"],
    },
    { type: "h2", id: "no-dj-academy-in-2027", text: "No DJ Academy package in 2027" },
    {
      type: "p",
      text: "The DJ Academy package does not appear on the 2027 Global Journey line-up, which lists the flight, train and bus families plus the experience packages and nothing else. Guides that still list an Academy package, and any price attached to it, describe an earlier edition.",
      sources: ["s3", "s2"],
    },
    { type: "h2", id: "what-the-package-includes", text: "What the package includes" },
    {
      type: "p",
      text: "Global Journey travellers get the Tomorrowland Today newspaper each day and a souvenir bag. The programme also runs three exclusive events for package holders: the Belgian Journey, Invited, and The Garden of Elements.",
      sources: ["s11", "s2"],
    },
    {
      type: "p",
      text: "Friendship Travel is the group product: it collects and returns the group at a location within about 125 miles of the accommodation, which helps when a group lands at an airport together.",
      sources: ["s10"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Skipping the outbound flight cancels the return",
      text: "If you do not take the inbound flight, the outbound flight is cancelled automatically. Tomorrowland's wording is that you must inform Global Journey in advance, and the page gives no address for doing so. Treat a package flight as one journey in two halves rather than two independent legs.",
      sources: ["s4"],
    },
    { type: "h2", id: "who-may-buy-and-the-caps", text: "Who may buy, and the caps" },
    {
      type: "p",
      text: "The sale is entered through a Tomorrowland Account, and pre-registration is mandatory before you can enter any sale. Registering does not guarantee that you will be able to buy. The cap is six people per account, cumulated across the sale rather than applied per order, and it tightens to two during the NFT Global Journey sale.",
      sources: ["s1", "s9"],
    },
    {
      type: "p",
      text: "Packages are personalised when you buy them. Name changes are possible only in urgent cases, only until 29 April 2027 at 23:59 CEST, and cost €350 per name. Ordinary festival tickets have no equivalent route.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "The Exchange Desk does not accept Global Journey packages at all. There is no listing route for one, so a package can only be refunded under its own cancellation conditions.",
      sources: ["s6"],
    },
    { type: "h2", id: "what-to-check-before-the-sale", text: "What to check before the sale" },
    {
      type: "ol",
      items: [
        "Confirm that your departure city appears on the 2027 list. The pages checked here name the package families but publish no city list.",
        "Check the arrival and departure days for your transport family. The package fixes them, and the airport shuttles sold separately run on Thursday and Monday only.",
        "Read the cancellation conditions for the package you intend to buy. The Exchange Desk is closed to you, and no name change is possible after 29 April 2027 except at €350 per name.",
        "Check where parking sits. On a Global Journey package it is never included, even for a Montagoe unit that comes with a parking voucher in the normal sale.",
        "Create the Tomorrowland Account and pre-register before the sale day.",
      ],
      sources: ["s1", "s6", "s7", "s9"],
    },
    {
      type: "p",
      text: "Package prices are not published on the pages checked here, and neither is the 2027 departure city list. The official [Global Journey page](https://belgium.tomorrowland.com/en/tickets/global-journey/) and the [2027 package line-up](https://belgium.tomorrowland.com/en/passes-packages/global-journey/) are where both appear first.",
      sources: ["s2", "s3"],
    },
  ],
});
