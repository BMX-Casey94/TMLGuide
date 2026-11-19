import type { GuideChapter } from "../schema";

/**
 * Winter chapter 2 of 8: the four ticket products, what the published 7-day
 * price buys, the payment terms, the Comfort rule, and the prices Tomorrowland
 * has not published.
 *
 * Prices appear only as `data` blocks so they render from
 * `src/data/winter/tickets.ts` and can never drift from the verified record.
 */
const CHECKED = "2026-11-18";

const TICKET = "https://winter.tomorrowland.com/en/tickets/festival-ticket/";
const TICKET_FR = "https://winter.tomorrowland.com/fr/tickets/ticket-festival/";
const TICKETS_HUB = "https://winter.tomorrowland.com/en/tickets/";
const PACKAGE = "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation/";
const TRANSPORT_PACKAGES =
  "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation-transport/";
const PAYMENT = "https://winter.tomorrowland.com/en/sales-info/payment-methods-and-conditions/";
const HOW_TO_ORDER = "https://winter.tomorrowland.com/en/sales-info/how-to-order/";
const BRACELET =
  "https://winter.tomorrowland.com/en/practical/your-tomorrowland-bracelet/";
const CANCEL_FAQ =
  "https://faq.tomorrowlandwinter.com/hc/en-us/articles/360038500631-Can-I-cancel-my-Tomorrowland-Winter-order";
const BOOKING_FAQ =
  "https://faq.tomorrowlandwinter.com/hc/en-us/articles/360038123752-Can-I-change-personal-information-in-my-booking";
const SIMULATOR_PRESS =
  "https://press.winter.tomorrowland.com/tomorrowland-winter-2027-alpe-dhuez-where-the-mountains-meet-magic";

export const winterTicketsAndPackagesChapter = {
  edition: "winter",
  slug: "tickets-and-packages",
  order: 2,
  title: "Tickets and packages",
  summary:
    "The four Winter ticket products, the published 7-day price, the 40% prepayment with its cap, the Comfort upgrade deadline and the prices not yet published.",
  lastVerified: CHECKED,
  related: [
    "winter/overview",
    "winter/accommodation",
    "winter/add-ons",
    "winter/transport",
  ],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Winter: festival ticket",
      url: TICKET,
      checkedOn: CHECKED,
    },
    {
      id: "s2",
      title: "Tomorrowland Winter 2027 ticket festival",
      url: TICKET_FR,
      checkedOn: CHECKED,
    },
    {
      id: "s3",
      title: "Tomorrowland Winter: festival ticket and accommodation",
      url: PACKAGE,
      checkedOn: CHECKED,
    },
    {
      id: "s4",
      title: "Tomorrowland Winter: payment methods and conditions",
      url: PAYMENT,
      checkedOn: CHECKED,
    },
    {
      id: "s5",
      title: "Tomorrowland Winter: how to order",
      url: HOW_TO_ORDER,
      checkedOn: CHECKED,
    },
    {
      id: "s6",
      title: "Tomorrowland Winter: your Tomorrowland Bracelet",
      url: BRACELET,
      checkedOn: CHECKED,
    },
    {
      id: "s7",
      title: "Tomorrowland Winter: tickets and packages",
      url: TICKETS_HUB,
      checkedOn: CHECKED,
    },
    {
      id: "s8",
      title: "Tomorrowland Winter: festival ticket, accommodation and transport",
      url: TRANSPORT_PACKAGES,
      checkedOn: CHECKED,
    },
    {
      id: "s9",
      title: "Can I cancel my Tomorrowland Winter order?",
      url: CANCEL_FAQ,
      checkedOn: CHECKED,
    },
    {
      id: "s10",
      title: "Can I change personal information in my booking?",
      url: BOOKING_FAQ,
      checkedOn: CHECKED,
    },
    {
      id: "s11",
      title: "Tomorrowland Winter 2027: where the mountains meet magic",
      url: SIMULATOR_PRESS,
      checkedOn: CHECKED,
    },
  ],
  blocks: [
    { type: "h2", id: "the-range", text: "The ticket and package range" },
    {
      type: "p",
      text: "Winter 2027 sells four ticket products and two package lengths. The ticket is festival access plus the lift and ski pass; the package is that same pair plus accommodation. Nothing shorter than a day is sold, and a ticket on its own does not include a bed.",
      sources: ["s1", "s3", "s7"],
    },
    {
      type: "facts",
      caption: "Winter 2027 products and what each covers",
      rows: [
        {
          label: "7-Day Festival Ticket",
          value: "Festival access for the whole week, 20–27 March 2027, plus the lift and ski pass.",
          sources: ["s1", "s2"],
        },
        {
          label: "4-Day Festival Ticket",
          value: "Festival access from 23 to 26 March 2027, plus the lift and ski pass. Published as a product without a price.",
          sources: ["s1"],
        },
        {
          label: "1-Day Festival Ticket, 20–22 March",
          value: "One day between 20 and 22 March 2027, with the MainStage closed. Published as a product without a price.",
          sources: ["s1"],
        },
        {
          label: "1-Day Festival Ticket, 23–26 March",
          value: "One day between 23 and 26 March 2027, with the MainStage open. Published as a product without a price.",
          sources: ["s1"],
        },
        {
          label: "7-Day and 4-Day Packages",
          value: "Festival access, the lift and ski pass, and accommodation in Alpe d'Huez or Oz 3300. The 2027 package sale shows as sold out, with no minimum price published.",
          sources: ["s3"],
        },
      ],
    },
    { type: "h2", id: "the-published-price", text: "The one published price" },
    {
      type: "p",
      text: "The 7-Day Festival Ticket is the only 2027 ticket price Tomorrowland has published. It divides into a festival element and a lift and ski pass element, and both parts are shown below.",
      sources: ["s2"],
    },
    {
      type: "data",
      edition: "winter",
      collection: "tickets",
      idPrefix: "seven-day-festival-ticket",
      caption: "Winter 2027 ticket prices as published",
    },
    {
      type: "p",
      text: "The lift and ski pass is not an optional extra that a non-skier can drop: it is how pedestrians reach the mountain stages, and the official ticket page states that it is required to get there.",
      sources: ["s1"],
    },
    { type: "h2", id: "what-is-not-published", text: "What is not published" },
    {
      type: "p",
      text: "The 4-Day and 1-Day Festival Tickets are listed for 2027 but render no price to a reader who is not signed in, and the 4- and 7-Day Package sale shows as sold out with no minimum. That leaves three of the four products unpriced, plus every package minimum.",
      sources: ["s1", "s3"],
    },
    {
      type: "p",
      text: "Treat those figures as unknown. Anything quoted for an earlier season belongs to that season, and the 2027 pages price the products afresh: the Comfort upgrade carries a new 2027 figure, published separately from the 2025 one.",
      sources: ["s2", "s3"],
    },
    {
      type: "callout",
      tone: "note",
      title: "The simulator is the way to price a package",
      text: "Packages are planned through the official simulator, which opened on 9 September 2026 and shows the available accommodation and the price for a given group size. With no published package minimum, the simulator is the only official source of a package figure.",
      sources: ["s5", "s11"],
    },
    { type: "h2", id: "payment", text: "Payment" },
    {
      type: "p",
      text: "A package is not paid in full at checkout. You pay a prepayment of at least 40% at purchase, capped at €2,500 however large the order, and the balance falls due within 30 days.",
      sources: ["s4"],
    },
    {
      type: "facts",
      caption: "Payment and fee rules for 2027",
      rows: [
        {
          label: "Prepayment",
          value: "At least 40% of the order at purchase, capped at €2,500",
          sources: ["s4"],
        },
        {
          label: "Balance",
          value: "Due within 30 days of purchase",
          sources: ["s4"],
        },
        {
          label: "Included in a package price",
          value: "City tax, service fee, SGR guarantee-fund fee, payment cost and one Treasure Case per person",
          sources: ["s3"],
        },
        {
          label: "Treasure Case fee, ticket-only, EU delivery",
          value: "€15",
          sources: ["s6"],
        },
        {
          label: "Treasure Case fee, ticket-only, worldwide delivery",
          value: "€22",
          sources: ["s6"],
        },
        {
          label: "Package cancellation charge",
          value: "70% before 1 November 2026; 80% before 1 December 2026; 90% before 1 February 2027; 100% from 1 February 2027",
          sources: ["s4"],
        },
      ],
    },
    {
      type: "p",
      text: "The 40% cap is worth understanding before you buy a large group booking. A prepayment of 40% of a five-figure order would exceed €2,500, so the cap applies and the balance is correspondingly larger, but it still falls due inside the same 30 days.",
      sources: ["s4"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "From 1 February 2027 a cancelled package refunds nothing",
      text: "The cancellation ladder reaches 100% of the booking on 1 February 2027. A package cancelled from that date returns no money, and there is no Exchange Desk route for packages: ticket-only buyers have the Exchange Desk, package holders have this ladder.",
      sources: ["s4", "s9"],
    },
    { type: "h2", id: "comfort", text: "The Comfort upgrade" },
    {
      type: "p",
      text: "Comfort costs €390 for 2027 and has to be chosen in the ticket shop at the moment of purchase. It is not an add-on: it cannot be bought afterwards through the Add-On Sale or in Manage My Booking.",
      sources: ["s3"],
    },
    {
      type: "ul",
      items: [
        "Access to the Comfort area at one of the mountain stages, plus the MainStage Comfort area.",
        "A private cloakroom and dedicated toilets at the MainStage.",
        "Savoury bites and snacks, with dedicated bottle service.",
        "Unlimited access to the outdoor swimming pool and the ice-skating rink in Alpe d'Huez.",
        "One free sledging ride at the resort's Alpine coaster.",
      ],
      sources: ["s1", "s3"],
    },
    {
      type: "p",
      text: "The 2027 wording names the mountain Comfort area generically rather than naming a venue, so do not assume a particular mountain bar. Only one Comfort price is published for 2027; there is no separate 1-day Comfort price.",
      sources: ["s1", "s3"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Comfort cannot be added later",
      text: "Decide before checkout. The official package page describes Comfort as something added on top of the ticket at purchase, and no later route to buy it is published. A ticket bought without it stays without it.",
      sources: ["s3"],
    },
    { type: "h2", id: "names-and-resale", text: "Names, addresses and resale" },
    {
      type: "p",
      text: "Personalisation is free until 30 November 2026. Between 1 December 2026 and 15 January 2027 a name change costs €350 per name, and that is the only window in which one is offered. A package shipping address can be edited in Manage My Booking until 30 December 2026; after that date it is locked.",
      sources: ["s10"],
    },
    {
      type: "p",
      text: "Ticket-only buyers who need out can list on the Exchange Desk, open for Winter from 10 October 2026 to 20 January 2027, with a €10 fee per ticket deducted from the refund. Listing is not a sale and resale is not guaranteed.",
      sources: ["s9"],
    },
    {
      type: "p",
      text: "The Exchange Desk, inside the main buyer's Tomorrowland Account, is the only official resale route. Marketplaces such as TicketSwap are not official channels and carry no protection from Tomorrowland.",
      sources: ["s9"],
    },
    { type: "h2", id: "transport-package-restrictions", text: "Travel packages restrict your ticket length" },
    {
      type: "p",
      text: "A travel package is a package with transport attached, and the three modes do not offer the same lengths. Flight packages work with either a 4-day or a 7-day package, bus packages are sold with the 4-day package only, and train packages with the 7-day package only.",
      sources: ["s8"],
    },
    {
      type: "p",
      text: "That restriction decides your week before you look at accommodation: if the bus from Belgium is your plan, you are booking 23–27 March, not the full week.",
      sources: ["s8"],
    },
  ],
} satisfies GuideChapter;
