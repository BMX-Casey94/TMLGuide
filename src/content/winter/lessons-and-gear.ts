import type { GuideChapter } from "../schema";

/**
 * Winter chapter 7 of 8: lessons and gear.
 *
 * All 2027 lesson products carry a published price, so they are shown through
 * `data` blocks rather than retyped. Equipment hire has no 2027 price at all —
 * the official page describes contents and pick-up points only — so the chapter
 * says that and shows nothing priced.
 */
const CHECKED = "2026-11-18";

const SLOPE = "https://winter.tomorrowland.com/en/add-ons/slope-experiences/";
const EQUIPMENT =
  "https://winter.tomorrowland.com/en/add-ons/ski-and-snowboard-equipment/";
const ADDONS = "https://winter.tomorrowland.com/en/add-ons/";
const ADDON_TERMS =
  "https://winter.tomorrowland.com/en/add-ons/terms-conditions-tomorrowland-winter-activities/";
const ADDON_FAQ =
  "https://faq.tomorrowlandwinter.com/hc/en-us/articles/31732293795092-When-is-the-Add-On-Sale";
const HOURS = "https://winter.tomorrowland.com/en/practical/opening-hours/";
const TICKET = "https://winter.tomorrowland.com/en/tickets/festival-ticket/";
const RESORT_MAP =
  "https://www.alpedhuez.com/wp-content/uploads/2026/11/PLAN-Station_alpedhuez-hiver_2026_2027.pdf";

export const winterLessonsAndGearChapter = {
  edition: "winter",
  slug: "lessons-and-gear",
  order: 7,
  title: "Lessons and gear",
  summary:
    "Winter 2027 lessons are morning-only, at two levels, with published prices. Equipment hire is booked in advance and collected in resort, but no hire price is published.",
  lastVerified: CHECKED,
  related: [
    "winter/add-ons",
    "winter/clothing-and-lockers",
    "winter/stages-and-hours",
    "winter/tickets-and-packages",
  ],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Winter 2027 slope experiences",
      url: SLOPE,
      checkedOn: CHECKED,
    },
    {
      id: "s2",
      title: "Tomorrowland Winter 2027 ski and snowboard equipment",
      url: EQUIPMENT,
      checkedOn: CHECKED,
    },
    { id: "s3", title: "Tomorrowland Winter 2027 add-ons", url: ADDONS, checkedOn: CHECKED },
    {
      id: "s4",
      title: "Tomorrowland Winter: activities terms and conditions",
      url: ADDON_TERMS,
      checkedOn: CHECKED,
    },
    {
      id: "s5",
      title: "When is the Add-On Sale?",
      url: ADDON_FAQ,
      checkedOn: CHECKED,
    },
    { id: "s6", title: "Tomorrowland Winter: opening hours", url: HOURS, checkedOn: CHECKED },
    {
      id: "s7",
      title: "Tomorrowland Winter: festival ticket",
      url: TICKET,
      checkedOn: CHECKED,
    },
    {
      id: "s8",
      title: "Alpe d'Huez: winter resort map 2026–2027",
      url: RESORT_MAP,
      checkedOn: CHECKED,
    },
  ],
  blocks: [
    { type: "h2", id: "lessons", text: "Lessons" },
    {
      type: "p",
      text: "Ski and snowboard lessons are sold through the Add-On Sale and run in the morning only. Group lessons run from 10:00 to 12:30; private lessons run from 09:30 to 12:30 or from 10:30 to 13:30.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "The 2027 programme is narrower than earlier editions. Group classes take between 1 and 8 people and are offered at two levels only, beginner and intermediate; a private lesson takes up to 5 people as one group.",
      sources: ["s1"],
    },
    {
      type: "facts",
      caption: "How Winter 2027 lessons are structured",
      rows: [
        {
          label: "Time of day",
          value: "Morning only: group 10:00–12:30; private 09:30–12:30 or 10:30–13:30",
          sources: ["s1"],
        },
        {
          label: "Group class size",
          value: "1 to 8 people, priced per person",
          sources: ["s1"],
        },
        {
          label: "Private lesson size",
          value: "Up to 5 people, priced per group",
          sources: ["s1"],
        },
        {
          label: "Levels",
          value: "Beginner and intermediate",
          sources: ["s1"],
        },
        {
          label: "Group options",
          value: "1 half day, 3 half days or 6 half days",
          sources: ["s1"],
        },
        {
          label: "Private options",
          value: "1 half day; no multi-day or full-day private option is published",
          sources: ["s1"],
        },
      ],
    },
    {
      type: "data",
      edition: "winter",
      collection: "add-ons",
      idPrefix: "group-lesson",
      caption: "Group lesson prices for 2027, per person",
    },
    {
      type: "data",
      edition: "winter",
      collection: "add-ons",
      idPrefix: "private-lesson",
      caption: "Private lesson price for 2027, per group",
    },
    {
      type: "p",
      text: "Three half days are sold as Sunday to Tuesday or Wednesday to Friday. Six half days run from Sunday to Friday, which covers two of the three pre-days and all four main festival days, but neither the opening Saturday nor the closing Saturday.",
      sources: ["s1"],
    },
    {
      type: "callout",
      tone: "note",
      title: "Morning lessons compete with the mountain programme",
      text: "A lesson finishing at 12:30 or 13:30 meets the mountain stages opening at 12:00. That is workable, but a private lesson to 13:30 leaves less of a day on the mountain before the 17:00 or 17:30 close.",
      sources: ["s1", "s6"],
    },
    { type: "h2", id: "slope-experiences", text: "Slope experiences" },
    {
      type: "p",
      text: "Beyond lessons, 2027 sells three guided experiences: an Off-Slope Experience for a half day, Sarenne First Track on the Monday morning, and Sarenne Sunset on the Sunday afternoon with a gourmet break in a mountain refuge.",
      sources: ["s1"],
    },
    {
      type: "data",
      edition: "winter",
      collection: "add-ons",
      idPrefix: "off-slope",
      caption: "Off-Slope Experience, 2027",
    },
    {
      type: "data",
      edition: "winter",
      collection: "add-ons",
      idPrefix: "sarenne",
      caption: "Sarenne experiences, 2027",
    },
    {
      type: "p",
      text: "The Off-Slope Experience requires comfort on black slopes, and Sarenne First Track is open to average and advanced skiers. These are not beginner products: both run on the terrain behind La Sarenne's black classification.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "La Sarenne runs about 10 miles from the Pic Blanc and is described officially as Europe's longest black run. Sarenne First Track covers the top of it before the lifts open to the public; Sarenne Sunset is the same terrain at the end of the day.",
      sources: ["s1"],
    },
    { type: "h2", id: "equipment", text: "Equipment hire" },
    {
      type: "p",
      text: "Skis, snowboards and boots are booked in advance through the Add-On Sale and collected in Alpe d'Huez or Oz 3300. A ski package includes skis, boots and poles; a snowboard package includes the board and boots.",
      sources: ["s2"],
    },
    {
      type: "facts",
      caption: "What equipment hire covers",
      rows: [
        {
          label: "Ski package",
          value: "Skis, boots and poles",
          sources: ["s2"],
        },
        {
          label: "Snowboard package",
          value: "Board and boots",
          sources: ["s2"],
        },
        {
          label: "Not included",
          value: "Helmet, goggles and clothing",
          sources: ["s2"],
        },
        {
          label: "Pick-up",
          value: "In Alpe d'Huez or Oz 3300",
          sources: ["s2"],
        },
        {
          label: "Price",
          value: "Not published for 2027",
          sources: ["s2"],
        },
      ],
    },
    {
      type: "p",
      text: "No equipment price is published for 2027. The official page describes what a package contains and where to collect it, and gives no price table, so this guide shows none. The official page is [ski and snowboard equipment](https://winter.tomorrowland.com/en/add-ons/ski-and-snowboard-equipment/), and the price appears in the Add-On Sale.",
      sources: ["s2"],
    },
    {
      type: "p",
      text: "The hiring shops named in the activities terms are Alpe Sport ADH, Altitude Sport ADH and Intersport ADH in Alpe d'Huez, and SkiSet Oz, Sport 2000 Oz, 2G Sport Oz and La Cabane à ski in Oz. They are the operators behind the packages, and their terms sit behind the Add-On Sale rather than in a separate booking route.",
      sources: ["s4"],
    },
    { type: "h2", id: "local-schools", text: "Local ski schools" },
    {
      type: "p",
      text: "ESF and ESI both appear on the official resort map, so lessons can also be arranged directly with a school in the resort rather than through the Add-On Sale. A direct booking is a separate contract with the school, and this guide cannot verify its prices or terms.",
      sources: ["s8"],
    },
    {
      type: "p",
      text: "Booking through the Add-On Sale keeps the lesson inside Tomorrowland's own terms, which is the only route this guide can describe with a source.",
      sources: ["s3", "s4"],
    },
    { type: "h2", id: "when-to-book", text: "When to book" },
    {
      type: "ol",
      items: [
        "Decide whether you need a lift and ski pass to ski or only to reach the stages: every ticket includes one either way, so the pass is not a separate purchase.",
        "Book lessons and equipment in the Add-On Sale, which opens on 26 November 2026 at 15:00 CET.",
        "Book the equipment with the lesson dates in mind, because lessons are morning-only and the hire has to cover the day you ski.",
        "Collect the equipment in Alpe d'Huez or Oz 3300 before your first morning lesson rather than on the morning itself.",
      ],
      sources: ["s7", "s1", "s2", "s3"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Add-on purchases are final",
      text: "The official Add-On Sale FAQ states that all purchases are final. A lesson or a hire booked for the wrong morning is not refundable through the sale, so check the day and the level before paying.",
      sources: ["s5"],
    },
  ],
} satisfies GuideChapter;
