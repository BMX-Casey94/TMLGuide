import type { GuideChapter } from "../schema";

/**
 * Belgium chapter 2 of 5 (part A).
 *
 * Dates, audiences and caps come from the 2027 sales pages and the two FAQ
 * articles the ledger checked. The three sale moments are shown from the
 * `sale-windows` collection rather than retyped, so a changed date can only
 * come from the data file.
 *
 * The Exchange Desk closing time is deliberately given as a date only: two
 * official pages quote 12:00 and 23:59 CEST for the same day.
 */
export const datesAndSalesChapter = {
  edition: "belgium",
  slug: "dates-and-sales",
  order: 2,
  title: "Dates and sales",
  summary:
    "Pre-registration, the three 2027 sale moments and who can buy at each, the caps per account, what to prepare, and the only official resale route.",
  lastVerified: "2026-11-18",
  related: [
    "belgium/overview",
    "belgium/tickets",
    "belgium/accommodation",
    "belgium/global-journey",
  ],
  sources: [
    {
      id: "s1",
      title: "What is Pre-Registration",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/43968145412372-What-is-Pre-Registration",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "What is the difference between the different sales moments",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037219532-What-is-the-difference-between-the-different-sales-moments",
      checkedOn: "2026-11-18",
    },
    {
      id: "s3",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s4",
      title: "Can I cancel or resell my tickets",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588571-Can-I-cancel-or-resell-my-tickets",
      checkedOn: "2026-11-18",
    },
    {
      id: "s5",
      title: "What are the Official Sales Channels",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037586711-What-are-the-Official-Sales-Channels",
      checkedOn: "2026-11-18",
    },
    {
      id: "s6",
      title: "Tomorrowland Belgium — Exchange Desk",
      url: "https://belgium.tomorrowland.com/en/sales-info/exchange-desk/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s7",
      title: "Can I resell my tickets at the online Exchange Desk",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037811911-Can-I-resell-my-tickets-at-the-online-Exchange-Desk",
      checkedOn: "2026-11-18",
    },
    {
      id: "s8",
      title: "Tomorrowland Belgium — official ticket channels",
      url: "https://belgium.tomorrowland.com/en/sales-info/official-ticket-channels/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s9",
      title: "Can I enter if the registered name on the Bracelet is not my own",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588511-Can-I-enter-if-the-registered-name-on-the-Bracelet-is-not-my-own",
      checkedOn: "2026-11-18",
    },
    {
      id: "s10",
      title: "Tomorrowland Belgium — official homepage, 2027 edition",
      url: "https://belgium.tomorrowland.com/en/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s11",
      title: "Tomorrowland Belgium — Add-On Sale hub",
      url: "https://belgium.tomorrowland.com/en/add-on-sale/",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    { type: "h2", id: "pre-registration", text: "Pre-registration" },
    {
      type: "p",
      text: "Pre-registration opens on 2 December 2026 at 15:00 CET and closes on 12 February 2027 at 15:00 CET. It happens inside a Tomorrowland Account and it is the entry requirement for every sale: without it, you cannot join any of them. It does not reserve a ticket.",
      sources: ["s1"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Registering is not buying",
      text: "Pre-registration does not guarantee a ticket. Everything that follows is still a race for stock, so register early and then plan the sale days as if you had no ticket at all.",
      sources: ["s1"],
    },
    { type: "h2", id: "sale-moments", text: "The three sale moments" },
    {
      type: "p",
      text: "The 2027 cycle publishes three sale moments, each opening at 17:00 CET on a Saturday. Everyone who pre-registered may join all three. There is no Belgian-only sale and no separately dated Friends sale in this cycle; Friendship Garden remains a product name rather than a sale date.",
      sources: ["s2", "s3"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "sale-windows",
      caption: "2027 sale moments, with the audience for each and the official page behind it",
    },
    {
      type: "ul",
      items: [
        "**30 January 2027, 17:00 CET — Global Journey Travel Packages Sale.** Packages that combine a festival ticket with transport, accommodation, or both. The cap in this sale is six people per account.",
        "**6 February 2027, 17:00 CET — WorldWide Pre-Sale.** Tickets and DreamVille packages, at the pre-sale prices.",
        "**13 February 2027, 17:00 CET — WorldWide Ticket Sale.** The general sale of tickets and DreamVille packages, at the WorldWide Ticket Sale prices.",
      ],
      sources: ["s2", "s3"],
    },
    {
      type: "p",
      text: "Those two price columns are not the same. The tickets chapter shows both beside each product, and the difference is worth checking before the pre-sale, because it decides whether a second attempt in the general sale costs more than the first.",
      sources: ["s2", "s3"],
    },
    { type: "h2", id: "caps-per-account", text: "Caps per account" },
    {
      type: "p",
      text: "The limit is four people per Tomorrowland Account, counted across all sale moments together rather than per order. Buying two places in the pre-sale therefore leaves two for the general sale.",
      sources: ["s3"],
    },
    {
      type: "facts",
      caption: "Purchase caps for the 2027 cycle",
      rows: [
        {
          label: "Tickets and DreamVille packages",
          value: "4 people per Tomorrowland Account, cumulated across all sale moments",
          sources: ["s3"],
        },
        {
          label: "Friendship Garden packages",
          value: "Exempt from the four-person cap",
          sources: ["s3"],
        },
        {
          label: "Global Journey packages",
          value: "6 people per Tomorrowland Account, and 2 during the NFT Global Journey sale",
          sources: ["s3"],
        },
        {
          label: "NFT sale, where it runs",
          value: "2 people per Tomorrowland Account",
          sources: ["s3"],
        },
      ],
    },
    { type: "h2", id: "before-each-sale", text: "Before each sale" },
    {
      type: "p",
      text: "Four things decide whether a sale goes well, and all of them are done beforehand. Tomorrowland strongly recommends creating the account at least two hours before a sale starts.",
      sources: ["s3"],
    },
    {
      type: "ol",
      items: [
        "Create the Tomorrowland Account and pre-register inside it, well before the window closes on 12 February 2027 at 15:00 CET.",
        "Decide which weekend and which pass type you want, and know your second choice. Weekend 1 and Weekend 2 are separate products.",
        "Have a payment card ready that your bank allows to make international payments to Belgium.",
        "Collect the full name of every attendee. Each festival ticket must be personalised, and names cannot be changed once personalisation is done.",
      ],
      sources: ["s1", "s3", "s9"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Nothing can be changed after purchase",
      text: "Tickets cannot be changed, upgraded or cancelled once bought, and names cannot be changed after personalisation. Check the weekend, the tier and the spelling of every name at checkout, because the only exit afterwards is the Exchange Desk.",
      sources: ["s3", "s9"],
    },
    { type: "h2", id: "exchange-desk", text: "The Exchange Desk" },
    {
      type: "p",
      text: "The Exchange Desk is the official resale mechanism, and it sits inside the main buyer's own Tomorrowland Account. It opens on 13 February 2027 and closes on 29 April 2027. Listing is final and cannot be undone, and a €10 fee per ticket is deducted from any refund. Tickets themselves cannot be cancelled, so a listing is the only way back out.",
      sources: ["s4", "s6", "s3"],
    },
    {
      type: "p",
      text: "Two official pages give different closing times for 29 April 2027, one saying 12:00 CEST and the other 23:59 CEST. Treat the date as the firm part and aim to be finished well before midday. Listing is also not a sale: nobody is obliged to buy the ticket, and an unsold listing returns nothing.",
      sources: ["s4", "s3"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Global Journey has no Exchange Desk",
      text: "Global Journey packages are excluded from the Exchange Desk entirely. They follow the published cancellation conditions instead, so the resale route that exists for a normal ticket does not exist here. A name change on a Global Journey package is possible only in urgent cases, at €350 per name, until 29 April 2027 at 23:59 CEST.",
      sources: ["s7", "s3"],
    },
    { type: "h2", id: "official-channels", text: "Official channels and resale risk" },
    {
      type: "p",
      text: "Tomorrowland lists three authorised sales channels: the ticket shop reached through your Tomorrowland Account, the Official Travel Shop for Global Journey packages, and Official External Travel Partners. Anything else is a secondary market.",
      sources: ["s5"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Buy only through an official channel",
      text: "Resale outside the Exchange Desk is prohibited, and tickets that have been resold illegitimately are cancelled. TicketSwap and similar marketplaces are not official channels. A cancelled ticket is refused at the gate regardless of what was paid for it.",
      sources: ["s8", "s5"],
    },
    {
      type: "p",
      text: "The same rule covers the person-to-person case: because the name on a bracelet is checked against identification and cannot be changed after personalisation, buying a ticket privately leaves the entry decision with the gate staff rather than with the seller.",
      sources: ["s9", "s8"],
    },
    { type: "h2", id: "what-is-not-published", text: "What is not published" },
    {
      type: "p",
      text: "One thing a buyer might expect is missing from the 2027 pages: an add-on sale date. The add-on sale is a separate event from the three ticket moments and it has not been given a 2027 date, so nothing about its timing should be assumed yet. The add-ons chapter covers what the sale contains.",
      sources: ["s10", "s11"],
    },
  ],
} satisfies GuideChapter;
