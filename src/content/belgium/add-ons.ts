import { guideChapterSchema } from "../schema";

/**
 * Add-ons.
 *
 * The 2026 add-on categories are confirmed, as is the 2026 sale instant. No
 * 2027 price exists for anything except Treasure Case shipping, which is drawn
 * from the data collection rather than typed here. Shuttle, locker and Pearl
 * bundle prices are absent from the data because they are unpublished, so the
 * chapter says so and links the official pages.
 */
export const addOnsChapter = guideChapterSchema.parse({
  edition: "belgium",
  slug: "add-ons",
  order: 8,
  title: "Add-ons and vouchers",
  summary:
    "Which add-ons Tomorrowland sells, how the sale works and when it has run, what is confirmed for 2027, and which prices are still unpublished.",
  lastVerified: "2026-11-18",
  related: ["belgium/tickets", "belgium/transport", "belgium/faq"],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Belgium — Add-On Sale hub",
      url: "https://belgium.tomorrowland.com/en/add-on-sale/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "Tomorrowland Belgium — Tomorrowland add-ons",
      url: "https://belgium.tomorrowland.com/en/add-on-sale/tomorrowland-addons/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s3",
      title: "Tomorrowland Belgium — DreamVille add-ons",
      url: "https://belgium.tomorrowland.com/en/add-on-sale/dreamville-add-ons/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s4",
      title: "Tomorrowland Belgium — the Avicii Tribute",
      url: "https://belgium.tomorrowland.com/en/add-on-sale/tomorrowland-add-ons/the-avicii-tribute/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s5",
      title: "Tomorrowland Belgium — facilities",
      url: "https://belgium.tomorrowland.com/en/practical/facilities/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s6",
      title: "Tomorrowland Belgium — at the festival site",
      url: "https://belgium.tomorrowland.com/en/practical/at-the-festival-site/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s7",
      title: "Tomorrowland Belgium — how to get there",
      url: "https://belgium.tomorrowland.com/en/practical/how-to-get-there/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s8",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s9",
      title: "Tomorrowland Belgium — Montagoe area",
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/montagoe-area/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s10",
      title: "Tomorrowland Belgium — DreamLodge 2P package",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/montagoe/dreamlodge-2p-packages/",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    {
      type: "p",
      text: "Add-ons are the extras sold separately from a ticket: dining experiences, DreamVille breakfasts, lockers, parking, gear rental, drinks and a few experiences. They are bought per weekend, and none of them includes festival or DreamVille entry.",
      sources: ["s1", "s3"],
    },
    {
      type: "p",
      text: "A DreamVille add-on also requires DreamVille access. Tomorrowland states that these products can only be enjoyed if you have access to the specific DreamVille area they belong to.",
      sources: ["s3"],
    },
    { type: "h2", id: "what-is-sold", text: "What is sold" },
    {
      type: "p",
      text: "The 2026 hub split the sale into four categories: Tomorrowland, DreamVille, Global Journey and Discover Europe. Those categories are the closest published guide to the shape of the 2027 sale, because the 2027 hub has not opened.",
      sources: ["s1"],
    },
    {
      type: "ul",
      items: [
        "Three dining experiences at the festival: the Tomorrowland Dining Experience, the Brasa BBQ Experience and the Belgian Classics Experience.",
        "DreamVille breakfasts, bought through the Add-On Sale and tied to the accommodation area they serve.",
        "Lockers at the festival site and in DreamVille, in several sizes.",
        "Parking vouchers, bought in advance through the Add-On Sale.",
        "Camping gear rental, collected on site at Magnificent Greens or Friendship Garden.",
        "A drinks product listed on the DreamVille add-ons page, the Cold Beer Pick-Up.",
        "The Avicii Tribute, plus the yoga and reading-session products listed on the DreamVille add-ons page.",
      ],
      sources: ["s2", "s3", "s4", "s9"],
    },
    { type: "h2", id: "when-the-sale-happens", text: "When the sale happens" },
    {
      type: "p",
      text: "The 2026 Add-On Sale opened on Tuesday 16 June 2026 at 15:00 CEST. The 2025 sale opened on 17 June 2025. Both dates fell in mid-June, and no 2027 date is published.",
      sources: ["s3", "s7"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "No 2027 add-on date is published",
      text: "Do not plan around a mid-June date. The two dates above are history, from the 2025 and 2026 cycles. Tomorrowland has not announced the 2027 sale, so the Add-On Sale hub is the page to check rather than a date carried over from last year.",
      sources: ["s1", "s3"],
    },
    {
      type: "p",
      text: "The shop is linked from the Tomorrowland add-on hub and runs one shop per weekend, so you choose Weekend 1 or Weekend 2 before you browse. Lockers and parking are both bought through the Add-On Sale, and Tomorrowland's guidance is to buy the locker voucher in advance.",
      sources: ["s1", "s6"],
    },
    { type: "h2", id: "prices-that-are-published", text: "Prices that are published" },
    {
      type: "p",
      text: "Treasure Case shipping is the one add-on with a published 2027 price. The fee is charged per person and varies by shipping address, so the three bands below are the only confirmed add-on figures for 2027.",
      sources: ["s8"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "add-ons",
      idPrefix: "belgium-2027-treasure-case",
      caption: "Treasure Case shipping fees, 2027 edition",
    },
    { type: "h2", id: "prices-that-are-not-published", text: "Prices that are not published" },
    {
      type: "p",
      text: "No 2027 price is published for dining experiences, breakfasts, parking, camping gear, drinks, yoga or the reading session. The 2026 figures in circulation are not printed on the official pages, so this guide does not reproduce them.",
      sources: ["s2", "s3"],
    },
    {
      type: "p",
      text: "Lockers are confirmed to exist at both the festival site and DreamVille, in several sizes, with the voucher bought in advance. Tomorrowland states that more detail, including the price table, will appear on the locker add-on page later, so no 2027 locker price or dimension is confirmed.",
      sources: ["s5", "s6"],
    },
    {
      type: "p",
      text: "Shuttle fares are in the same position. The routes and days are confirmed, but no fare is published and the 2027 shop has not opened. The [How to get there](https://belgium.tomorrowland.com/en/practical/how-to-get-there/) page is the one to watch, and the transport chapter covers which routes run on which days.",
      sources: ["s7"],
    },
    { type: "h2", id: "the-avicii-tribute", text: "The Avicii Tribute" },
    {
      type: "p",
      text: "The tribute is free to enter, but a €10 deposit is charged when you book a slot and is refunded in full when you attend. A booking that is never scanned donates the deposit to the Tomorrowland Foundation and the Tim Bergling Foundation.",
      sources: ["s4"],
    },
    {
      type: "p",
      text: "It is a ten-minute experience inside a dedicated installation between the Melodia and Freedom stages, entered by booked slot rather than by queueing.",
      sources: ["s4"],
    },
    { type: "h2", id: "how-to-approach-the-sale", text: "How to approach the sale" },
    {
      type: "ol",
      items: [
        "Decide which add-ons you need before the day. The dining experiences are pre-set menus with the main course chosen at booking, so they shape your evening rather than sitting alongside it.",
        "Check your accommodation before buying a locker. Some lodgings are themselves lockable and the DreamLodge has a locker in the room, so read the inclusion list rather than assuming you need one. A DreamVille locker and a festival locker are also not interchangeable, because the two sites keep different opening hours.",
        "Buy for the right weekend. The shop separates the two, and each add-on belongs to the weekend it was bought for.",
        "Read the eligibility line on each product. DreamVille items need DreamVille access, and the breakfasts are tied to the area that serves them.",
        "If you carry prescribed medicine, bring the certificate. That is a rule rather than a purchase, and it is covered in the FAQ chapter.",
      ],
      sources: ["s3", "s6", "s10", "s9"],
    },
  ],
});
