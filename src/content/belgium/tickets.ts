import type { GuideChapter } from "../schema";

/**
 * Belgium chapter 3 of 5 (part A).
 *
 * The tier definitions are the ones the 2027 ticket pages publish and the
 * ledger confirms: Regular is general access, Pleasure covers every Comfort
 * area except the MainStage Comfort area, Comfort includes the MainStage
 * Comfort area. No price is typed here; each group is a `data` block that
 * renders straight from `src/data/belgium/tickets.ts`.
 */
export const ticketsChapter = {
  edition: "belgium",
  slug: "tickets",
  order: 3,
  title: "Tickets",
  summary:
    "The five Belgium pass types, what each tier actually includes, how the 2027 prices divide between the pre-sale and the WorldWide Ticket Sale, and the Treasure Case fee.",
  lastVerified: "2026-11-18",
  related: [
    "belgium/dates-and-sales",
    "belgium/accommodation",
    "belgium/dreamville",
    "belgium/add-ons",
  ],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Belgium — day passes, 2027 prices",
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s3",
      title: "Tomorrowland Belgium — festival tickets",
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s4",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s5",
      title: "Can I enter if the registered name on the Bracelet is not my own",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588511-Can-I-enter-if-the-registered-name-on-the-Bracelet-is-not-my-own",
      checkedOn: "2026-11-18",
    },
    {
      id: "s6",
      title: "Tomorrowland Belgium — policies",
      url: "https://belgium.tomorrowland.com/en/practical/policies/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s7",
      title: "Can I cancel or resell my tickets",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588571-Can-I-cancel-or-resell-my-tickets",
      checkedOn: "2026-11-18",
    },
    {
      id: "s8",
      title: "Tomorrowland — hospitality packages",
      url: "https://belgium.tomorrowland.com/hospitality/welcome/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s9",
      title: "Tomorrowland Belgium — accommodation",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    { type: "h2", id: "the-five-passes", text: "The five passes" },
    {
      type: "p",
      text: "Belgium sells two lengths of ticket in three access tiers. The length decides how many days you get; the tier decides which Comfort areas you may use on top of the general festival site.",
      sources: ["s1", "s2"],
    },
    {
      type: "facts",
      caption: "Pass types and what the 2027 pages include",
      rows: [
        {
          label: "Day Pass (Regular)",
          value: "Festival access for one day: Friday, Saturday or Sunday. General festival access only.",
          sources: ["s1"],
        },
        {
          label: "Pleasure Day Pass",
          value: "Festival access for one day, plus all Comfort areas except the MainStage Comfort area.",
          sources: ["s1"],
        },
        {
          label: "Comfort Day Pass",
          value: "Festival access for one day, plus the Comfort areas at the MainStage, the Great Library and Freedom.",
          sources: ["s1"],
        },
        {
          label: "Full Madness Pass (Regular)",
          value: "Festival access for all three days of one weekend. General festival access only, and no DreamVille access on its own.",
          sources: ["s2"],
        },
        {
          label: "Full Madness Comfort Pass",
          value: "All three days of one weekend, plus the Comfort areas at the MainStage, the Great Library and Freedom.",
          sources: ["s2"],
        },
      ],
    },
    {
      type: "p",
      text: "The tier ladder is the part people misread. Pleasure and Comfort are not the same thing at different prices: Pleasure covers every Comfort area except the MainStage Comfort area, and Comfort is the only tier whose inclusion list names MainStage, the Great Library and Freedom together. If the MainStage area is the reason for buying up, Pleasure does not get you there.",
      sources: ["s1"],
    },
    {
      type: "callout",
      tone: "note",
      title: "A festival pass does not include a bed",
      text: "Every pass above is a festival ticket only. DreamVille access comes with a DreamVille package, which bundles an accommodation element with a Full Madness pass. The accommodation chapter sets out the areas and how the package total is built.",
      sources: ["s2", "s9"],
    },
    { type: "h2", id: "day-pass-prices", text: "Day pass prices" },
    {
      type: "p",
      text: "Each day pass is published at two prices: the pre-sale price and the WorldWide Ticket Sale price. The second is the one you pay if you buy on 13 February 2027 rather than 6 February, and the two are separate records below rather than a range.",
      sources: ["s1"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "tickets",
      idPrefix: "belgium-2027-day-pass",
      caption: "Day Pass, 2027 prices",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "tickets",
      idPrefix: "belgium-2027-pleasure-day-pass",
      caption: "Pleasure Day Pass, 2027 prices",
    },
    {
      type: "data",
      edition: "belgium",
      collection: "tickets",
      idPrefix: "belgium-2027-comfort-day-pass",
      caption: "Comfort Day Pass, 2027 prices",
    },
    { type: "h2", id: "weekend-pass-prices", text: "Weekend pass prices" },
    {
      type: "p",
      text: "The Full Madness pass and the Full Madness Comfort pass each cover all three days of one weekend, and each carries a pre-sale price and a WorldWide Ticket Sale price.",
      sources: ["s2"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "tickets",
      idPrefix: "belgium-2027-full-madness",
      caption: "Full Madness and Full Madness Comfort, 2027 prices",
    },
    {
      type: "p",
      text: "A DreamVille package prices its pass element below the standalone pass, so a package total is not the standalone pass price plus a tent. The accommodation chapter and the [tickets explorer](/guides/tickets) both show the package totals as published.",
      sources: ["s2", "s9"],
    },
    { type: "h2", id: "treasure-case", text: "The Treasure Case" },
    {
      type: "p",
      text: "The fee for the Treasure Case is charged per person and depends on the shipping address, so the checkout total moves with where the bracelet is sent rather than with how many days you bought.",
      sources: ["s2"],
    },
    {
      type: "p",
      text: "Every ticket price on this page already includes payment and service fees. The Treasure Case fee sits outside them, which is why the checkout total is higher than the figure shown against the pass.",
      sources: ["s2"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "add-ons",
      idPrefix: "belgium-2027-treasure-case",
      caption: "Treasure Case fee by shipping region, 2027",
    },
    { type: "h2", id: "before-you-pay", text: "Before you pay" },
    {
      type: "ul",
      items: [
        "The minimum age is 18 before the festival starts.",
        "Each festival ticket must be personalised with an attendee name, and names cannot be changed after personalisation. If the name does not match your identification, access may be refused.",
        "Tickets cannot be changed, upgraded or cancelled once bought. The Exchange Desk is the only official way back out.",
        "Four people per Tomorrowland Account is the cap, counted across every sale moment rather than per order.",
      ],
      sources: ["s6", "s5", "s4", "s7"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "The tier cannot be upgraded later",
      text: "Buying a Regular pass and planning to move up to Comfort on the day is not an option: the official sales page states that a ticket cannot be changed or upgraded after purchase. Choose the tier at checkout.",
      sources: ["s4"],
    },
    { type: "h2", id: "compare-every-price", text: "Compare every price" },
    {
      type: "p",
      text: "The [tickets and packages explorer](/guides/tickets) shows all three editions side by side, with the source link and checked date beside every figure. Use it to compare a day pass against a DreamVille package before committing: both are bought in the same sale, and both count towards the same four-person allowance.",
      sources: ["s3", "s4"],
    },
    { type: "h2", id: "hospitality", text: "Hospitality packages" },
    {
      type: "p",
      text: "Hospitality is a separate line sold to companies only, with a minimum of ten guests. The 2027 hospitality pages describe the packages but publish no prices, and hospitality does not include DreamVille access.",
      sources: ["s8"],
    },
  ],
} satisfies GuideChapter;
