import { guideChapterSchema } from "../schema";

const VERIFIED_ON = "2026-11-18";

/**
 * General Pearls chapter. Mechanism only: no euro rate per Pearl is stated,
 * because the 2027 value is unpublished and the 2026 rate could not be
 * re-confirmed on the check date.
 */
export const generalPearlsChapter = guideChapterSchema.parse({
  edition: "general",
  slug: "pearls",
  order: 1,
  title: "Pearls",
  summary:
    "How the cashless system works, what happens to unspent Pearls and why no euro rate per Pearl is published for 2027.",
  lastVerified: VERIFIED_ON,
  related: ["general/radio", "belgium/add-ons", "winter/add-ons"],
  sources: [
    {
      id: "s1",
      title: "Cashless general terms and conditions",
      url: "https://belgium.tomorrowland.com/en/my-bracelet/cashless-general-terms-conditions/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s2",
      title: "Your Tomorrowland bracelet",
      url: "https://belgium.tomorrowland.com/en/practical/your-tomorrowland-bracelet/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s3",
      title: "Facilities at the festival",
      url: "https://belgium.tomorrowland.com/en/practical/facilities/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s4",
      title: "What is the Pearls exchange rate? (behind a sign-in wall when checked)",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/4401948627988-What-is-the-Pearls-exchange-rate",
      checkedOn: VERIFIED_ON,
    },
  ],
  blocks: [
    { type: "h2", id: "what-pearls-are", text: "What Pearls are" },
    {
      type: "p",
      text: "Pearls are the festival's own currency. Tomorrowland runs a fully cashless site: you load Pearls onto your bracelet, and the bracelet is the only payment method for food and drinks. A card or cash is not a fallback at the bars.",
      sources: ["s3", "s1"],
    },
    {
      type: "p",
      text: "Top-ups are made online through your Tomorrowland Account before the festival, or at top-up booths on site. Loading before you travel avoids queueing at a booth when the site is busiest.",
      sources: ["s1", "s3"],
    },
    { type: "h2", id: "the-rate", text: "The exchange rate" },
    {
      type: "p",
      text: "Tomorrowland has not published a euro value for one Pearl for the 2027 edition. This is the operator's policy rather than a gap in research: the cashless terms state that the value of one Pearl is made available to the visitor as soon as Pearls can be purchased, and the bracelet page says more information will follow around June before a July festival.",
      sources: ["s1", "s2"],
    },
    {
      type: "p",
      text: "The 2026 rate could not be re-confirmed either, because the official exchange-rate article sits behind a sign-in wall. Any figure for a past edition that you find elsewhere should be treated as that edition's rate and no guide should carry it forward as the 2027 rate.",
      sources: ["s4"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Do not budget from a quoted rate",
      text: "A guide that gives a firm euro-per-Pearl figure for 2027 is quoting an older edition. Wait for the official rate to be published, then work out your budget from that figure and the price in Pearls at the bar.",
      sources: ["s1", "s2"],
    },
    { type: "h2", id: "refunds", text: "Unspent Pearls" },
    {
      type: "ul",
      items: [
        "Unspent Pearls from an online top-up are refunded automatically after the festival.",
        "A manual refund is capped by a published deadline, can take up to six weeks to process, and is subject to a fee.",
        "Bonus Pearls and pre-loaded Pearls are not refundable.",
      ],
      sources: ["s1"],
    },
    {
      type: "p",
      text: "Because refunds carry a fee, a large top-up you do not spend costs you money on the way back out. Load what you expect to use and top up again on site if you run short.",
      sources: ["s1"],
    },
    { type: "h2", id: "budgeting", text: "Budgeting" },
    {
      type: "ol",
      items: [
        "Wait for the official rate for your edition to be published, then note it down with the date you read it.",
        "Work out your daily food and drink budget in Pearls rather than in money, because the bracelet is what you pay with at the bar.",
        "Top up online before you travel for the bulk of it, so you are not queueing at a booth on the first evening.",
        "Check the refund conditions before you load a figure well above what you expect to spend.",
      ],
      sources: ["s1", "s2", "s3"],
    },
  ],
});
