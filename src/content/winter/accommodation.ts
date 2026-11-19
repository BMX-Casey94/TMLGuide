import type { GuideChapter } from "../schema";

/**
 * Winter chapter 3 of 8: accommodation.
 *
 * The honest state of this topic in November 2026 is that Tomorrowland publishes
 * the structure of Winter lodging and none of its prices. `src/data/winter/accommodation.ts`
 * is deliberately empty for that reason, so the chapter explains the structure,
 * says plainly that no price exists, and links the official page.
 */
const CHECKED = "2026-11-18";

const PACKAGE = "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation/";
const TRANSPORT_PACKAGES =
  "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation-transport/";
const TRANSPORT_PASS =
  "https://winter.tomorrowland.com/en/practical/how-to-get-there/transportation-pass/";
const GET_THERE = "https://winter.tomorrowland.com/en/practical/how-to-get-there/";
const HOURS = "https://winter.tomorrowland.com/en/practical/opening-hours/";
const RESORT_MAP =
  "https://www.alpedhuez.com/wp-content/uploads/2026/11/PLAN-Station_alpedhuez-hiver_2026_2027.pdf";
const VILLAGE_FAQ =
  "https://faq.tomorrowlandwinter.com/hc/en-us/articles/4406896729876-Can-I-book-a-package-in-one-of-the-surrounding-villages-of-Alpe-d-Huez";
const GROUP_FAQ =
  "https://faq.tomorrowlandwinter.com/hc/en-us/articles/4406578859924-How-do-we-place-a-group-booking";
const ADDONS = "https://winter.tomorrowland.com/en/add-ons/";
const SIMULATOR_PRESS =
  "https://press.winter.tomorrowland.com/tomorrowland-winter-2027-alpe-dhuez-where-the-mountains-meet-magic";

export const winterAccommodationChapter = {
  edition: "winter",
  slug: "accommodation",
  order: 3,
  title: "Accommodation",
  summary:
    "Winter lodging is sold inside a package, in four categories across hotels, apartments and chalets. No 2027 price is published, so the simulator is the only official figure.",
  lastVerified: CHECKED,
  related: [
    "winter/tickets-and-packages",
    "winter/transport",
    "winter/overview",
    "belgium/accommodation",
  ],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Winter: festival ticket and accommodation",
      url: PACKAGE,
      checkedOn: CHECKED,
    },
    {
      id: "s2",
      title: "Tomorrowland Winter: festival ticket, accommodation and transport",
      url: TRANSPORT_PACKAGES,
      checkedOn: CHECKED,
    },
    {
      id: "s3",
      title: "Tomorrowland Winter: Transportation Pass",
      url: TRANSPORT_PASS,
      checkedOn: CHECKED,
    },
    {
      id: "s4",
      title: "Tomorrowland Winter: how to get there",
      url: GET_THERE,
      checkedOn: CHECKED,
    },
    {
      id: "s5",
      title: "Tomorrowland Winter: opening hours",
      url: HOURS,
      checkedOn: CHECKED,
    },
    {
      id: "s6",
      title: "Alpe d'Huez: winter resort map 2026–2027",
      url: RESORT_MAP,
      checkedOn: CHECKED,
    },
    {
      id: "s7",
      title: "Can I book a package in one of the surrounding villages of Alpe d'Huez?",
      url: VILLAGE_FAQ,
      checkedOn: CHECKED,
    },
    {
      id: "s8",
      title: "How do we place a group booking?",
      url: GROUP_FAQ,
      checkedOn: CHECKED,
    },
    {
      id: "s9",
      title: "Tomorrowland Winter 2027 add-ons",
      url: ADDONS,
      checkedOn: CHECKED,
    },
    {
      id: "s10",
      title: "Tomorrowland Winter 2027: where the mountains meet magic",
      url: SIMULATOR_PRESS,
      checkedOn: CHECKED,
    },
  ],
  blocks: [
    { type: "h2", id: "how-lodging-is-sold", text: "How lodging is sold" },
    {
      type: "p",
      text: "Winter accommodation is not sold on its own. It comes inside a package, together with festival access and the lift and ski pass, so there is no room-only rate to compare against and no separate booking route.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "Tomorrowland sells packages in Alpe d'Huez itself and in Oz 3300. Villages other than those two are sold exclusively through Sunweb, the official booking provider, and a package in a surrounding village comes with access to the mountain stages only.",
      sources: ["s1", "s7"],
    },
    { type: "h2", id: "the-four-categories", text: "The four categories" },
    {
      type: "p",
      text: "Package lodging is grouped into four categories, and each category spans three property types: hotels, apartments and chalets. The category is a band rather than a property type, so the same band can put you in a hotel room or a self-contained flat.",
      sources: ["s1"],
    },
    {
      type: "facts",
      caption: "Winter 2027 package accommodation",
      rows: [
        {
          label: "Categories",
          value: "Wood, Bronze, Silver and Gold",
          sources: ["s1"],
        },
        {
          label: "Property types",
          value: "Hotels, apartments and chalets",
          sources: ["s1"],
        },
        {
          label: "Where Tomorrowland sells",
          value: "Alpe d'Huez and Oz 3300",
          sources: ["s1"],
        },
        {
          label: "Other surrounding villages",
          value: "Sold exclusively by Sunweb, with access to the mountain stages only",
          sources: ["s1", "s7"],
        },
        {
          label: "Oz 3300 packages",
          value: "A Transportation Pass is included in the package price",
          sources: ["s1", "s3"],
        },
      ],
    },
    {
      type: "p",
      text: "A chalet is listed as a category, not a room type. The official pages describe the four categories and the three property types but publish nothing about bed layouts, bathroom arrangements or what a shared chalet shares, so those details have to be read on the individual listing.",
      sources: ["s1"],
    },
    { type: "h2", id: "prices-not-published", text: "No 2027 accommodation price is published" },
    {
      type: "p",
      text: "No accommodation price exists for 2027. The 4- and 7-Day Package sale shows as sold out with no minimum price, lodging is only sold inside a package, and nothing on the official pages prices an individual property. That is why this guide shows no accommodation price table: there is no verified figure to show.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "The official page behind that statement is the [festival ticket and accommodation page](https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation/). Read the price there, or in the simulator, rather than from a figure quoted for an earlier season.",
      sources: ["s1"],
    },
    {
      type: "callout",
      tone: "note",
      title: "Price a package in the simulator, not from an old figure",
      text: "The official simulator opened on 9 September 2026 and shows the accommodation available for a given group size with its price. With no published package minimum, it is the only official way to turn the four categories into a number.",
      sources: ["s10"],
    },
    { type: "h2", id: "choosing-where-to-stay", text: "Alpe d'Huez or a village" },
    {
      type: "p",
      text: "Alpe d'Huez is where the main festival area and the MainStage are, so staying in the resort removes the nightly journey. Oz 3300 is a separate resort reached by lift, and its packages include the Transportation Pass that covers the evening service.",
      sources: ["s1", "s3"],
    },
    {
      type: "p",
      text: "If you stay in a village, the daytime return matters as much as the evening one. Lifts connecting Alpe d'Huez to the surrounding villages have fixed last departures between 16:30 and 17:50, and only the lifts from the mountain stages back down to Alpe d'Huez keep running until the stages close.",
      sources: ["s5"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Walking between the resort and the villages is prohibited",
      text: "The organiser prohibits walking between Alpe d'Huez and the surrounding villages, so a village bed means using the lift or the paid night service. Do not plan on a walk back after the MainStage closes.",
      sources: ["s4", "s3"],
    },
    {
      type: "p",
      text: "Two estate agents in the resort, Alpe d'Huez Houses and Giverdon Immobilier / Maeva Home, are listed on the official resort map. They are resort businesses rather than Tomorrowland partners, and the map publishes no festival-week rate for either.",
      sources: ["s6"],
    },
    { type: "h2", id: "group-bookings", text: "Group bookings" },
    {
      type: "p",
      text: "A group that wants to share accommodation has to place the entire booking in a single order. The official FAQ describes that as essential for placing a group booking, which means one person buys and one payment covers the group rather than each person booking separately and hoping to be placed together.",
      sources: ["s8"],
    },
    {
      type: "p",
      text: "That also concentrates the payment and the cancellation risk in one buyer: the 40% prepayment, the 30-day balance and the cancellation ladder all apply to the single order.",
      sources: ["s8", "s1"],
    },
    { type: "h2", id: "what-to-bring", text: "What the room will not have" },
    {
      type: "p",
      text: "Towels are sold separately from the room. The 2027 Add-On index lists towels among the products, so treat a towel as something to buy or bring rather than something the accommodation supplies.",
      sources: ["s9"],
    },
    {
      type: "p",
      text: "What a given apartment or chalet provides beyond that — linen, cleaning, kitchen equipment — is not described on the official package pages, so check it on the specific listing before you book.",
      sources: ["s1"],
    },
  ],
} satisfies GuideChapter;
