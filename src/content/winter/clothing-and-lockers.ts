import type { GuideChapter } from "../schema";

/**
 * Winter chapter 6 of 8: clothing and lockers.
 *
 * The ledger confirms very little about clothing — the altitude, the heated
 * MainStage, and that no temperature or layering guidance is published — so the
 * chapter says exactly that rather than repeating the fan-site figures. The
 * locker mechanics and dimensions are confirmed in `conflicts.md` item 4; no
 * 2027 locker price is published, and `src/data/winter/lockers.ts` is empty for
 * that reason, so there is no locker price to show.
 */
const CHECKED = "2026-11-18";

const AT_FESTIVAL = "https://winter.tomorrowland.com/en/practical/at-the-festival/";
const SKI_AREA = "https://skipass.alpedhuez.com/";
const ALTIBUS = "https://www.altibus.com/stations-desservies/navettes-alpe-dhuez/";
const LOCKERS = "https://winter.tomorrowland.com/en/add-ons/lockers/";
const HOURS = "https://winter.tomorrowland.com/en/practical/opening-hours/";
const EQUIPMENT =
  "https://winter.tomorrowland.com/en/add-ons/ski-and-snowboard-equipment/";
const ADDONS = "https://winter.tomorrowland.com/en/add-ons/";
const ADDON_FAQ =
  "https://faq.tomorrowlandwinter.com/hc/en-us/articles/31732293795092-When-is-the-Add-On-Sale";
const RESORT_AGENDA = "https://www.alpedhuez.com/en/agenda/tomorrowland-winter/";

export const winterClothingAndLockersChapter = {
  edition: "winter",
  slug: "clothing-and-lockers",
  order: 6,
  title: "Clothing and lockers",
  summary:
    "What the official pages say about the cold, which stage is heated, and how the three 2027 locker areas work — with no price published for any of them.",
  lastVerified: CHECKED,
  related: [
    "winter/stages-and-hours",
    "winter/lessons-and-gear",
    "winter/overview",
    "winter/transport",
  ],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Winter: at the festival",
      url: AT_FESTIVAL,
      checkedOn: CHECKED,
    },
    { id: "s2", title: "Alpe d'Huez: ski area", url: SKI_AREA, checkedOn: CHECKED },
    { id: "s3", title: "Altibus: navettes Alpe d'Huez", url: ALTIBUS, checkedOn: CHECKED },
    {
      id: "s4",
      title: "Tomorrowland Winter 2027 lockers",
      url: LOCKERS,
      checkedOn: CHECKED,
    },
    { id: "s5", title: "Tomorrowland Winter: opening hours", url: HOURS, checkedOn: CHECKED },
    {
      id: "s6",
      title: "Tomorrowland Winter 2027 ski and snowboard equipment",
      url: EQUIPMENT,
      checkedOn: CHECKED,
    },
    { id: "s7", title: "Tomorrowland Winter 2027 add-ons", url: ADDONS, checkedOn: CHECKED },
    {
      id: "s8",
      title: "When is the Add-On Sale?",
      url: ADDON_FAQ,
      checkedOn: CHECKED,
    },
    {
      id: "s9",
      title: "Alpe d'Huez: Tomorrowland Winter",
      url: RESORT_AGENDA,
      checkedOn: CHECKED,
    },
  ],
  blocks: [
    { type: "h2", id: "the-cold", text: "What the altitude means" },
    {
      type: "p",
      text: "The village sits at 1,860 m and the ski area runs from 1,300 m to 3,330 m at the Pic Blanc. The mountain stages sit above the village, so the daytime is spent higher up than the resort itself.",
      sources: ["s2", "s3"],
    },
    {
      type: "p",
      text: "This guide found no temperature figures for festival week and no clothing guidance on Tomorrowland's own practical pages: they describe the site, the stages and the rules, but not what to wear or how cold it gets. Any specific temperature range you see quoted for the week comes from somewhere other than the official site.",
      sources: ["s1"],
    },
    {
      type: "callout",
      tone: "note",
      title: "Plan for a cold evening, not a measured one",
      text: "The one thing the official pages confirm about warmth is that the MainStage is covered and heated. Nothing else on site is described that way, so assume the walk between stages and the other stages themselves are outdoor conditions in March at altitude.",
      sources: ["s1"],
    },
    { type: "h2", id: "dressing-for-the-day", text: "Dressing for the two halves of the day" },
    {
      type: "p",
      text: "The day divides into a mountain half and a village half. The mountain stages close at 17:00 or 17:30 and the main area opens at 19:00, which leaves a gap in the late afternoon.",
      sources: ["s5"],
    },
    {
      type: "ul",
      items: [
        "Treat the daytime as a day on the snow: the mountain stages are above the village, and no official page describes them as covered or heated.",
        "Treat the evening as a cold outdoor evening with one heated venue, the MainStage, rather than an indoor night.",
        "Leave the heaviest layer at your accommodation for the evening, because the MainStage is heated and the other village stages are not described as heated.",
        "Carry gloves and a hat for the walk between the village stages, which is outdoors whatever the stage.",
      ],
      sources: ["s1", "s5"],
    },
    {
      type: "p",
      text: "Equipment hire does not solve clothing. The official equipment page states that a helmet, goggles and clothing are not included in a ski or snowboard package, so those come with you or are bought locally.",
      sources: ["s6"],
    },
    { type: "h2", id: "lockers", text: "Lockers" },
    {
      type: "p",
      text: "There are three locker areas for 2027: at the Main Entrance, at the Cage and at the MainStage. A locker can be rented in advance for either 4 days or 7 days, which matches the two package lengths.",
      sources: ["s4"],
    },
    {
      type: "facts",
      caption: "Winter 2027 lockers: locations, sizes and access",
      rows: [
        {
          label: "Locker areas",
          value: "Main Entrance, Cage and MainStage",
          sources: ["s4"],
        },
        {
          label: "Rental durations",
          value: "4 days or 7 days, booked in advance",
          sources: ["s4"],
        },
        {
          label: "Single-day lockers, Saturday to Monday",
          value: "Can be reserved in advance for the pre-days",
          sources: ["s4"],
        },
        {
          label: "Single-day lockers, Tuesday to Friday",
          value: "On site only during the main festival days; on-site availability is not guaranteed",
          sources: ["s4"],
        },
        {
          label: "Main Entrance sizes",
          value: "Medium 30 × 22 × 40 cm; Large 30 × 36 × 40 cm; Extra Large 39 × 40 × 40 cm",
          sources: ["s4"],
        },
        {
          label: "Cage size",
          value: "Medium 30 × 30 × 45 cm",
          sources: ["s4"],
        },
        {
          label: "MainStage size",
          value: "Medium 30 × 22 × 40 cm",
          sources: ["s4"],
        },
        {
          label: "Access, Main Entrance",
          value: "08:00 until 30 minutes after the main area closes",
          sources: ["s4"],
        },
        {
          label: "Access, Cage and MainStage",
          value: "During festival opening hours",
          sources: ["s4"],
        },
        {
          label: "USB charging",
          value: "Built in at the Main Entrance and the MainStage",
          sources: ["s4"],
        },
        {
          label: "Price",
          value: "Not published for 2027",
          sources: ["s4"],
        },
      ],
    },
    {
      type: "p",
      text: "The Main Entrance is the only area with three sizes and the only one that opens before the festival does, at 08:00. That makes it the locker to book if you want to leave a bag in the morning and collect it after the evening.",
      sources: ["s4"],
    },
    {
      type: "p",
      text: "The Cage and MainStage lockers open with the festival and are offered in one size each, both Medium: 30 × 22 × 40 cm at the MainStage and 30 × 30 × 45 cm at the Cage. Only the Main Entrance offers a Large and an Extra Large as well.",
      sources: ["s4"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Do not rely on an on-site single-day locker midweek",
      text: "Single-day lockers can be reserved in advance only for Saturday to Monday. From Tuesday to Friday they are sold on site, and the official page states that on-site availability is not guaranteed. If you need a locker on a main festival day, book a 4-day or 7-day locker instead.",
      sources: ["s4"],
    },
    { type: "h2", id: "locker-prices", text: "No 2027 locker price" },
    {
      type: "p",
      text: "No locker price is published for 2027. The official locker page gives the locations, sizes, durations and access hours and states no figure, so there is nothing to quote above the mechanics.",
      sources: ["s4"],
    },
    {
      type: "p",
      text: "That is why this guide shows no locker price table. The official page is [Tomorrowland Winter 2027 lockers](https://winter.tomorrowland.com/en/add-ons/lockers/), and the price appears there or in the Add-On Sale when it opens rather than in any older figure.",
      sources: ["s4"],
    },
    {
      type: "p",
      text: "Lockers are bought in advance through the Add-On Sale, which opens on 26 November 2026 at 15:00 CET. Purchases in that sale are final.",
      sources: ["s7", "s8"],
    },
  ],
} satisfies GuideChapter;
