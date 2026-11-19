import type { GuideChapter } from "../schema";

/**
 * Winter chapter 1 of 8: what the edition is, when it runs, how a day is shaped
 * and what a package actually contains.
 *
 * Every figure here is either a ledger-confirmed fact or a value the validated
 * dataset already holds; prices are shown only through `data` blocks.
 */
const CHECKED = "2026-11-18";

const HOMEPAGE = "https://winter.tomorrowland.com/en/";
const RETURNS_PRESS =
  "https://press.winter.tomorrowland.com/tomorrowland-winter-returns-to-alpe-dhuez-from-march-20-27-2027";
const HOURS = "https://winter.tomorrowland.com/en/practical/opening-hours/";
const TICKET = "https://winter.tomorrowland.com/en/tickets/festival-ticket/";
const PACKAGE = "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation/";
const SKI_AREA = "https://skipass.alpedhuez.com/";
const BOOKING =
  "https://faq.tomorrowlandwinter.com/hc/en-us/articles/360038123752-Can-I-change-personal-information-in-my-booking";
const ADDONS = "https://winter.tomorrowland.com/en/add-ons/";

export const winterOverviewChapter = {
  edition: "winter",
  slug: "overview",
  order: 1,
  title: "The Winter week",
  summary:
    "Tomorrowland Winter 2027 runs 20–27 March at Alpe d'Huez: stages on the mountain by day, stages in the village at night, and a MainStage that opens midweek.",
  lastVerified: CHECKED,
  related: [
    "winter/tickets-and-packages",
    "winter/stages-and-hours",
    "winter/accommodation",
    "general/editions",
  ],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Winter: MARCH 20–27, 2027 | ALPE D'HUEZ, FRANCE",
      url: HOMEPAGE,
      checkedOn: CHECKED,
    },
    {
      id: "s2",
      title: "Tomorrowland Winter returns to Alpe d'Huez from March 20–27, 2027",
      url: RETURNS_PRESS,
      checkedOn: CHECKED,
    },
    {
      id: "s3",
      title: "Tomorrowland Winter: opening hours",
      url: HOURS,
      checkedOn: CHECKED,
    },
    {
      id: "s4",
      title: "Tomorrowland Winter: festival ticket",
      url: TICKET,
      checkedOn: CHECKED,
    },
    {
      id: "s5",
      title: "Tomorrowland Winter: festival ticket and accommodation",
      url: PACKAGE,
      checkedOn: CHECKED,
    },
    {
      id: "s6",
      title: "Alpe d'Huez: ski area",
      url: SKI_AREA,
      checkedOn: CHECKED,
    },
    {
      id: "s7",
      title: "Can I change personal information in my booking?",
      url: BOOKING,
      checkedOn: CHECKED,
    },
    {
      id: "s8",
      title: "Tomorrowland Winter 2027 add-ons",
      url: ADDONS,
      checkedOn: CHECKED,
    },
  ],
  blocks: [
    { type: "h2", id: "what-winter-is", text: "What Winter is" },
    {
      type: "p",
      text: "Tomorrowland Winter takes place at Alpe d'Huez, a ski resort in the French Alps, over a single week in March. The 2027 edition is the seventh, and it runs from Saturday 20 to Saturday 27 March 2027.",
      sources: ["s1", "s2"],
    },
    {
      type: "p",
      text: "The resort sits at 1,860 m and the ski area reaches 3,330 m at the Pic Blanc. Every festival ticket includes a lift and ski pass, and the pass is required rather than optional: the lifts are how you reach the stages that sit on the mountain above the village.",
      sources: ["s4", "s6"],
    },
    { type: "h2", id: "the-dates", text: "The 2027 dates" },
    {
      type: "p",
      text: "The week splits in two. Saturday 20 to Monday 22 March are the pre-days: the mountain stages and the main festival area run, but the MainStage stays closed. Tuesday 23 to Friday 26 March are the main festival days, when the MainStage opens.",
      sources: ["s3"],
    },
    {
      type: "p",
      text: "The ticket range follows that split. Packages are sold as a 7-day week from 20 March or a 4-day week from 23 March, and the two 1-day tickets are divided the same way: one for a day between 20 and 22 March, one for a day between 23 and 26 March.",
      sources: ["s4", "s5"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "A pre-day ticket cannot reach the MainStage",
      text: "The MainStage is closed from Saturday 20 to Monday 22 March. If the MainStage is why you are going, book a day between 23 and 26 March, a 4-day package or a 7-day package. A 1-day ticket for the first weekend does not admit you to it.",
      sources: ["s3", "s4"],
    },
    { type: "h2", id: "how-a-day-runs", text: "How a day runs" },
    {
      type: "p",
      text: "The daytime programme is on the mountain and the evening programme is in the village. Mountain stages close in the late afternoon, the daytime Moosebar slot carries on into the early evening, and the main festival area opens at 19:00.",
      sources: ["s3"],
    },
    {
      type: "facts",
      caption: "Winter 2027 hours and setting",
      rows: [
        {
          label: "Mountain stages",
          value: "12:00–17:00 Saturday to Monday; 12:00–17:30 Tuesday to Friday",
          sources: ["s3"],
        },
        {
          label: "Main festival area",
          value: "19:00–00:00 Saturday to Monday; 19:00–01:30 Tuesday to Friday",
          sources: ["s3"],
        },
        {
          label: "Last admission to the main area",
          value: "23:30 Saturday to Monday; 00:30 Tuesday to Friday",
          sources: ["s3"],
        },
        {
          label: "Moosebar by Day",
          value: "15:00–19:30, Saturday to Friday",
          sources: ["s3"],
        },
        {
          label: "MainStage",
          value: "Open Tuesday 23 to Friday 26 March; closed Saturday 20 to Monday 22 March",
          sources: ["s3"],
        },
        {
          label: "Resort and summit",
          value: "Resort at 1,860 m; Pic Blanc at 3,330 m",
          sources: ["s6"],
        },
      ],
    },
    { type: "h2", id: "what-a-package-includes", text: "What a package includes" },
    {
      type: "p",
      text: "A package combines festival access, the lift and ski pass, and accommodation. Lodging is in Alpe d'Huez or in Oz 3300, and the package price already covers city tax, the service fee, the SGR guarantee-fund fee, the payment cost and one Treasure Case per person.",
      sources: ["s5"],
    },
    {
      type: "p",
      text: "Flight, bus and train packages add travel to that bundle, each with a restriction that decides which package length you can book. Buying a ticket without accommodation is the other route, and it carries a separate Treasure Case delivery fee.",
      sources: ["s5"],
    },
    { type: "h2", id: "what-is-not-published", text: "What is not published" },
    {
      type: "p",
      text: "One 2027 ticket price is published: the 7-Day Festival Ticket. The 4-Day and 1-Day tickets exist as products with no readable price, the package sale shows as sold out with no minimum, and no accommodation, equipment-hire or locker price has been published. Budget from what is published and treat the rest as unknown rather than reuse an earlier season's figure.",
      sources: ["s4", "s5"],
    },
    { type: "h2", id: "order-of-work", text: "What to settle, in order" },
    {
      type: "ol",
      items: [
        "Choose the 7-day week from 20 March or the 4-day week from 23 March, because the package length decides which transport packages you may book.",
        "Choose between a package and a ticket-only booking. Packages include accommodation; ticket-only buyers pay the Treasure Case delivery fee separately.",
        "Decide on the Comfort upgrade before you reach the ticket shop, because it cannot be added after purchase.",
        "Check the names and the shipping address on the booking: personalisation is free only until 30 November 2026, and a package address locks on 30 December 2026.",
        "Plan the add-ons for the 2027 Add-On Sale, which opens on 26 November 2026 at 15:00 CET.",
      ],
      sources: ["s4", "s5", "s7", "s8"],
    },
  ],
} satisfies GuideChapter;
