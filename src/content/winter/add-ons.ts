import type { GuideChapter } from "../schema";

/**
 * Winter chapter 8 of 8: add-ons.
 *
 * The Add-On Sale date is the one sale window with a `confirmed` ledger verdict,
 * so it is shown through a `data` block from `src/data/winter/sale-windows.ts`.
 * Prices are shown the same way from `src/data/winter/add-ons.ts`.
 */
const CHECKED = "2026-11-18";

const ADDONS = "https://winter.tomorrowland.com/en/add-ons/";
const ACTIVITIES = "https://winter.tomorrowland.com/en/add-ons/activities/";
const SLOPE = "https://winter.tomorrowland.com/en/add-ons/slope-experiences/";
const EQUIPMENT =
  "https://winter.tomorrowland.com/en/add-ons/ski-and-snowboard-equipment/";
const LOCKERS = "https://winter.tomorrowland.com/en/add-ons/lockers/";
const SHUTTLES = "https://winter.tomorrowland.com/en/add-ons/shuttles/";
const ADDON_TERMS =
  "https://winter.tomorrowland.com/en/add-ons/terms-conditions-tomorrowland-winter-activities/";
const ADDON_FAQ =
  "https://faq.tomorrowlandwinter.com/hc/en-us/articles/31732293795092-When-is-the-Add-On-Sale";
const TRANSPORT_PASS =
  "https://winter.tomorrowland.com/en/practical/how-to-get-there/transportation-pass/";
const PACKAGE = "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation/";
const ALTIBUS = "https://www.altibus.com/stations-desservies/navettes-alpe-dhuez/";

export const winterAddOnsChapter = {
  edition: "winter",
  slug: "add-ons",
  order: 8,
  title: "Add-ons",
  summary:
    "The 2027 Add-On Sale opens on 26 November 2026 at 15:00 CET. What it sells, which prices are published, and the two things it does not sell.",
  lastVerified: CHECKED,
  related: [
    "winter/lessons-and-gear",
    "winter/transport",
    "winter/clothing-and-lockers",
    "winter/tickets-and-packages",
  ],
  sources: [
    { id: "s1", title: "Tomorrowland Winter 2027 add-ons", url: ADDONS, checkedOn: CHECKED },
    {
      id: "s2",
      title: "Tomorrowland Winter 2027 activities",
      url: ACTIVITIES,
      checkedOn: CHECKED,
    },
    {
      id: "s3",
      title: "Tomorrowland Winter 2027 slope experiences",
      url: SLOPE,
      checkedOn: CHECKED,
    },
    {
      id: "s4",
      title: "Tomorrowland Winter 2027 ski and snowboard equipment",
      url: EQUIPMENT,
      checkedOn: CHECKED,
    },
    {
      id: "s5",
      title: "Tomorrowland Winter 2027 lockers",
      url: LOCKERS,
      checkedOn: CHECKED,
    },
    {
      id: "s6",
      title: "Tomorrowland Winter 2027 shuttles",
      url: SHUTTLES,
      checkedOn: CHECKED,
    },
    {
      id: "s7",
      title: "Tomorrowland Winter: activities terms and conditions",
      url: ADDON_TERMS,
      checkedOn: CHECKED,
    },
    {
      id: "s8",
      title: "When is the Add-On Sale?",
      url: ADDON_FAQ,
      checkedOn: CHECKED,
    },
    {
      id: "s9",
      title: "Tomorrowland Winter: Transportation Pass",
      url: TRANSPORT_PASS,
      checkedOn: CHECKED,
    },
    {
      id: "s10",
      title: "Tomorrowland Winter: festival ticket and accommodation",
      url: PACKAGE,
      checkedOn: CHECKED,
    },
    {
      id: "s11",
      title: "Altibus: navettes Alpe d'Huez",
      url: ALTIBUS,
      checkedOn: CHECKED,
    },
  ],
  blocks: [
    { type: "h2", id: "the-sale", text: "The 2027 Add-On Sale" },
    {
      type: "p",
      text: "The Add-On Sale is a separate sale that follows the ticket and package sales. For 2027 it opens on 26 November 2026 at 15:00 CET, eight days after the fact-check behind this guide.",
      sources: ["s1"],
    },
    {
      type: "data",
      edition: "winter",
      collection: "sale-windows",
      caption: "Winter 2027 sale window",
    },
    {
      type: "p",
      text: "It is the route for everything bought on top of a ticket: activities, lockers, slope experiences, ski and snowboard equipment, ski insurance, shuttles, the Transportation Pass and towels.",
      sources: ["s1"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Two things are not in this sale",
      text: "The Comfort upgrade is not sold here: it must be chosen in the ticket shop at purchase, and nobody who bought a ticket without it can add it later. Restaurant experiences are not sold either; the 2027 add-on index has no restaurant category at all.",
      sources: ["s10", "s1"],
    },
    { type: "h2", id: "published-prices", text: "Every published price" },
    {
      type: "p",
      text: "The sale has a published price for most of what it sells: the activities, the lesson and slope products, and the Transportation Pass. Activity prices run from the Alpine Coaster at the low end to paragliding at the high end, and the condition attached to each matters more than the price.",
      sources: ["s2", "s3", "s9"],
    },
    {
      type: "data",
      edition: "winter",
      collection: "add-ons",
      caption: "Every Winter 2027 add-on with a published price",
    },
    { type: "h2", id: "activities", text: "Activities" },
    {
      type: "p",
      text: "Paragliding requires ski or snowboard equipment and has a maximum weight of 90 kg, so it is not open to a pedestrian. The Alpine Coaster voucher covers two rides rather than one, the dogsled carries two people per sled, and the DJ workshop runs Monday to Friday.",
      sources: ["s2"],
    },
    { type: "h2", id: "lessons-and-slope", text: "Lessons and slope experiences" },
    {
      type: "p",
      text: "Lessons run in the morning only: group classes 10:00 to 12:30 for 1 to 8 people, private lessons 09:30 to 12:30 or 10:30 to 13:30 for up to 5 people. Both are offered at beginner and intermediate level only. Group bookings run as 1, 3 or 6 half days; private is sold as a single half day.",
      sources: ["s3"],
    },
    {
      type: "p",
      text: "The steepest restriction sits on the Off-Slope Experience, which is open only to skiers at ease on black slopes. Sarenne First Track is for average and advanced skiers and runs on the Monday from 08:00 to 09:30; Sarenne Sunset runs on the Sunday from 16:30 to 21:30 and includes a gourmet break in a mountain refuge.",
      sources: ["s3"],
    },
    { type: "h2", id: "transport-add-ons", text: "Transport and the Transportation Pass" },
    {
      type: "p",
      text: "Two transport products sit in or alongside the sale. The Transportation Pass covers evening travel to the surrounding villages and is priced in the table above, and the shuttles cover the journey from a departure city to the resort.",
      sources: ["s9", "s6"],
    },
    {
      type: "p",
      text: "The Transportation Pass is included automatically in a package sold in Oz 3300, so buying it separately is only needed if you are staying elsewhere or travelling independently.",
      sources: ["s9"],
    },
    {
      type: "p",
      text: "The 2027 shuttle departure points are published — Antwerp, Brussels, Paris, Metz, Lyon, Grenoble, Amsterdam, Rotterdam, Düsseldorf, Luxembourg and Geneva — but no 2027 shuttle price is. The shuttles page is [Tomorrowland Winter shuttles](https://winter.tomorrowland.com/en/add-ons/shuttles/); read the fare there when the sale opens.",
      sources: ["s6"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Geneva is a departure point, not a confirmed service",
      text: "Altibus, the operator Tomorrowland names for Geneva, states that the Geneva to Alpe d'Huez shuttle did not run in the 2025/26 winter season. Confirm with the operator before you buy a Geneva shuttle or book a flight into Geneva.",
      sources: ["s11"],
    },
    { type: "h2", id: "equipment-towels-insurance", text: "Equipment, towels and insurance" },
    {
      type: "p",
      text: "Equipment hire is sold through the sale but has no published 2027 price. A ski package includes skis, boots and poles, a snowboard package includes board and boots, and a helmet, goggles and clothing are not included. The equipment is collected in Alpe d'Huez or Oz 3300.",
      sources: ["s4"],
    },
    {
      type: "p",
      text: "Lockers, towels and ski insurance are in the same position: all three are sold, and none has a published 2027 price. The locker sizes, areas and durations are in the clothing and lockers chapter.",
      sources: ["s1", "s5"],
    },
    { type: "h2", id: "before-you-buy", text: "Before you buy" },
    {
      type: "ul",
      items: [
        "Add-on purchases are final: the official FAQ states that all purchases are final, so a wrong date or level is not recoverable through the sale.",
        "The sale covers activities, lockers, slope experiences, equipment, ski insurance, shuttles, the Transportation Pass and towels.",
        "It does not cover Comfort, which can only be bought with the ticket, or restaurant experiences, which are absent from the 2027 index.",
        "Equipment vendor terms sit with the operators named in the activities terms, so the contract for a hire or an activity is the operator's.",
      ],
      sources: ["s8", "s1", "s10", "s7"],
    },
    {
      type: "p",
      text: "The practical order is to settle the ticket first, including any Comfort decision, then buy the add-ons against the days you will actually be on the mountain. A lesson or a dogsled booked for a morning you spend travelling is money that cannot be recovered.",
      sources: ["s10", "s8", "s2"],
    },
  ],
} satisfies GuideChapter;
