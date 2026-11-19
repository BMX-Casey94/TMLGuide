import { guideChapterSchema } from "../schema";

/**
 * Food and drink.
 *
 * No stall price is published anywhere official, so none is stated and no rate
 * is given: the 2027 Pearl value is unpublished and the 2026 figure was not
 * re-confirmed. The chapter covers what Pearls are, how paying and refunds
 * work, and the rules that decide what you may carry in.
 */
export const foodDrinksChapter = guideChapterSchema.parse({
  edition: "belgium",
  slug: "food-drinks",
  order: 9,
  title: "Food, drink and Pearls",
  summary:
    "How paying works at the festival and in DreamVille, how refunds and the cup deposit work, the food and drink rules, and why no stall price is quoted here.",
  lastVerified: "2026-11-18",
  related: ["general/pearls", "belgium/faq", "belgium/dreamville"],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Belgium — facilities",
      url: "https://belgium.tomorrowland.com/en/practical/facilities/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "Tomorrowland Belgium — at the festival site",
      url: "https://belgium.tomorrowland.com/en/practical/at-the-festival-site/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s3",
      title: "Tomorrowland Belgium — top up your bracelet",
      url: "https://belgium.tomorrowland.com/en/my-bracelet/top-up/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s4",
      title: "Tomorrowland Belgium — cashless information",
      url: "https://belgium.tomorrowland.com/en/my-bracelet/cashless-information/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s5",
      title: "Tomorrowland Belgium — reusable cups",
      url: "https://belgium.tomorrowland.com/en/practical/reusable-cups/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s6",
      title: "Tomorrowland Belgium — forbidden objects",
      url: "https://belgium.tomorrowland.com/en/practical/forbidden-objects/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s7",
      title: "Tomorrowland Belgium — your Tomorrowland bracelet",
      url: "https://belgium.tomorrowland.com/en/practical/your-tomorrowland-bracelet/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s8",
      title: "Tomorrowland Belgium — Tomorrowland add-ons",
      url: "https://belgium.tomorrowland.com/en/add-on-sale/tomorrowland-addons/",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    {
      type: "p",
      text: "The festival site and DreamVille are cashless. Tomorrowland describes the bracelet as your only payment method for food and drinks, so the practical work is done before you arrive: activate the bracelet, then load it with Pearls.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "Pearls are Tomorrowland's own unit, not euros. Their euro value is set per edition and is not yet published for 2027, which is why this chapter quotes no rate.",
      sources: ["s7", "s4"],
    },
    { type: "h2", id: "how-paying-works", text: "How paying works" },
    {
      type: "facts",
      caption: "Paying at the festival and in DreamVille",
      rows: [
        {
          label: "Payment method",
          value:
            "The bracelet, loaded with Pearls. Tomorrowland calls it your only payment method for food and drinks.",
          sources: ["s1"],
        },
        {
          label: "Before you can top up",
          value: "The bracelet must be activated before it can take a top-up.",
          sources: ["s3"],
        },
        {
          label: "How to top up online",
          value: "Through your Tomorrowland Account with Visa, Mastercard, Bancontact, iDeal, Google Pay or Apple Pay.",
          sources: ["s3"],
        },
        {
          label: "Unspent Pearls",
          value:
            "Refunded automatically after the festival if your first top-up was online. If your first top-up was on site, you must file the manual refund form in your account.",
          sources: ["s4"],
        },
        {
          label: "Refund fee",
          value: "A flat fee of two Pearls is charged per refund.",
          sources: ["s4"],
        },
        {
          label: "Bonus Pearls",
          value: "Excluded from refunds. They are spent after the regular Pearls from the same top-up.",
          sources: ["s4"],
        },
        {
          label: "Pearls per weekend",
          value:
            "A balance is valid for one weekend only and cannot be transferred to another weekend or to another person.",
          sources: ["s4"],
        },
        {
          label: "Cup deposit",
          value: "One Pearl per reusable cup, returned at a Cup Return station rather than left behind.",
          sources: ["s5"],
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "The Pearl rate is not published for 2027",
      text: "Tomorrowland states that the value of one Pearl is made available as soon as Pearls can be purchased, and the bracelet page puts that at around June before the festival. Until that page publishes a rate, any figure you see is unconfirmed, so budget a margin rather than a precise sum.",
      sources: ["s7", "s4"],
    },
    { type: "h2", id: "food-and-drink-rules", text: "Food and drink rules" },
    {
      type: "p",
      text: "Your own food and drinks are on the festival's prohibited list. DreamVille's list does not ban them, so provisions bought on the way belong at the campsite rather than in the arena. Glass is banned in both places, and plastic bottles and cans are banned on the festival site.",
      sources: ["s6"],
    },
    {
      type: "ul",
      items: [
        "Perfume and deodorant are allowed up to 100 ml. Anything larger counts as glass and is refused.",
        "Cooking is allowed only at the dedicated public barbecue areas.",
        "Gas installations over 500 g are banned in DreamVille.",
        "Campers and caravans are not allowed in or at DreamVille at all, and sleeping in cars is banned.",
      ],
      sources: ["s6"],
    },
    {
      type: "p",
      text: "The dining experiences are a separate purchase, sold in the Add-On Sale. Tomorrowland states that the restaurants cannot accommodate special dietary requirements, because the menus are set and a main course is chosen at booking.",
      sources: ["s8"],
    },
    { type: "h2", id: "why-no-prices", text: "Why no stall prices" },
    {
      type: "p",
      text: "Tomorrowland does not publish a price list for food and drink stalls. The only official figures are the Pearl mechanics above; the menu prices that circulate in fan guides come from earlier editions and change each year. This guide therefore gives no stall price, and a budget built on a remembered figure will drift.",
      sources: ["s1", "s4"],
    },
    {
      type: "p",
      text: "The wider Pearl mechanics, including the rates published for earlier editions and how tops-ups and refunds work across editions, are covered in [Pearls](/guides/general/pearls).",
      sources: ["s4"],
    },
    { type: "h2", id: "practical-order", text: "Practical order" },
    {
      type: "ol",
      items: [
        "Activate the bracelet as soon as it arrives. Nothing can be loaded before that.",
        "Top up online before you travel. That single choice decides whether the leftover balance comes back automatically or needs a form.",
        "Check the balance against the weekend you are attending. A Weekend 1 balance does not follow you into Weekend 2.",
        "Keep your cups and hand them in at a Cup Return station. Each one carries a Pearl of your money.",
        "If you take prescribed medicine, carry the medical certificate, because the festival's drug rule turns on it.",
      ],
      sources: ["s3", "s4", "s5", "s6"],
    },
  ],
});
