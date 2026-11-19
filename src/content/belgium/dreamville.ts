import type { GuideChapter } from "../schema";

/**
 * Belgium chapter 5 of 5 (part A).
 *
 * DreamVille rules as the official opening-hours and forbidden-objects pages
 * state them. The 2027 Thursday opening dates are deliberately absent: the
 * ledger marks them inferred from the standing "Thursday 11:00 to Monday
 * 12:00" rule rather than published for 2027, so the chapter says so instead
 * of asserting a date.
 */
export const dreamvilleChapter = {
  edition: "belgium",
  slug: "dreamville",
  order: 5,
  title: "DreamVille",
  summary:
    "Check-in and check-out windows, moving between DreamVille and the festival, what you may and may not bring, and the campsite facilities the official pages confirm.",
  lastVerified: "2026-11-18",
  related: [
    "belgium/accommodation",
    "belgium/tickets",
    "belgium/add-ons",
    "belgium/transport",
  ],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Belgium — opening hours",
      url: "https://belgium.tomorrowland.com/en/practical/opening-hours/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "Tomorrowland Belgium — discover DreamVille",
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s3",
      title: "What are the opening hours of the festival site",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037582731-What-are-the-opening-hours-of-the-festival-site",
      checkedOn: "2026-11-18",
    },
    {
      id: "s4",
      title: "Can I re-enter the festival",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037215812-Can-I-re-enter-the-festival",
      checkedOn: "2026-11-18",
    },
    {
      id: "s5",
      title: "Tomorrowland Belgium — forbidden objects",
      url: "https://belgium.tomorrowland.com/en/practical/forbidden-objects/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s6",
      title: "Tomorrowland Belgium — how to get there",
      url: "https://belgium.tomorrowland.com/en/practical/how-to-get-there/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s7",
      title: "Tomorrowland Belgium — The Marketplace",
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/the-marketplace/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s8",
      title: "Tomorrowland Belgium — Magnificent Greens area",
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/magnificent-greens-area/",
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
      title: "Tomorrowland Belgium — at the festival site",
      url: "https://belgium.tomorrowland.com/en/practical/at-the-festival-site/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s11",
      title: "Tomorrowland Belgium — reusable cups",
      url: "https://belgium.tomorrowland.com/en/practical/reusable-cups/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s12",
      title: "Tomorrowland Belgium — Easy Tent 2P packages, 2027",
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/easy-tent/easy-tent-packages/easy-tent-2p-packages/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s13",
      title: "Tomorrowland Belgium — Camp2Camp area",
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/camp2camp-area/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s14",
      title: "Can I enter if the registered name on the Bracelet is not my own",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588511-Can-I-enter-if-the-registered-name-on-the-Bracelet-is-not-my-own",
      checkedOn: "2026-11-18",
    },
    {
      id: "s15",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s16",
      title: "Tomorrowland Belgium — cashless general terms and conditions",
      url: "https://belgium.tomorrowland.com/en/my-bracelet/cashless-general-terms-conditions/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s17",
      title: "Tomorrowland Belgium — your Tomorrowland bracelet",
      url: "https://belgium.tomorrowland.com/en/practical/your-tomorrowland-bracelet/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s18",
      title: "Tomorrowland Belgium — top up your bracelet",
      url: "https://belgium.tomorrowland.com/en/my-bracelet/top-up/",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    { type: "h2", id: "what-dreamville-is", text: "What DreamVille is" },
    {
      type: "p",
      text: "DreamVille is the campsite attached to the festival site. It is open to guests of the five accommodation areas only, and it keeps its own opening hours, which are not the festival's. DreamVille access comes with a DreamVille package; the festival passes are sold as festival access, and the standalone Full Madness pass carries no DreamVille access.",
      sources: ["s2", "s1", "s15"],
    },
    {
      type: "p",
      text: "The standing rule is that DreamVille opens on the Thursday before each festival weekend at 11:00 and closes on the Monday at 12:00, and that it stays open continuously in between. The Thursday and Monday dates for the 2027 weekends are not published as 2027 lines; the rule and hours are, so a Thursday arrival is the assumption the timetable is built on rather than a dated 2027 statement.",
      sources: ["s1"],
    },
    { type: "h2", id: "check-in-and-check-out", text: "Check-in and check-out" },
    {
      type: "p",
      text: "Check-in has its own timetable per day, and the Sunday gap is the part that catches people. Check-out closes at Monday 12:00 with no exceptions.",
      sources: ["s1"],
    },
    {
      type: "facts",
      caption: "DreamVille check-in and check-out",
      rows: [
        { label: "Thursday", value: "From 11:00 at both DreamVille entrances", sources: ["s1"] },
        { label: "Friday", value: "Around the clock", sources: ["s1"] },
        {
          label: "Saturday",
          value: "At both entrances until 12:00, then Entrance 1 only",
          sources: ["s1"],
        },
        { label: "Sunday", value: "No check-in at all", sources: ["s1"] },
        {
          label: "Check-out",
          value: "Monday by 12:00, with no exceptions",
          sources: ["s1"],
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "There is no Sunday check-in",
      text: "Arriving on the Sunday of your weekend means having nowhere to check in. If your travel cannot reach Boom by the Saturday, change the travel rather than the plan.",
      sources: ["s1"],
    },
    {
      type: "p",
      text: "The two entrances are not interchangeable on the Saturday. Entrance 1 is on Nachtegaalstraat in 2850 Boom and keeps checking people in after midday; Entrance 2 is on Rumstsestraat in 2840 Rumst and serves Magnificent Greens.",
      sources: ["s6"],
    },
    { type: "h2", id: "moving-between-sites", text: "Moving between DreamVille and the festival" },
    {
      type: "p",
      text: "Leaving the festival site ends your day: there is no re-entry on the same day, even on a three-day Full Madness pass. A Full Madness pass allows re-entry on a later day of the same weekend, never on the same one, and a day pass needs a new ticket.",
      sources: ["s4"],
    },
    {
      type: "p",
      text: "Two crossings survive that rule, and they apply to every DreamVille guest. You may go back into DreamVille from the festival site from 17:00 onwards, and you may come back into the festival from DreamVille until two hours before closing time. Inside DreamVille you are free to come and go at any hour.",
      sources: ["s3"],
    },
    {
      type: "callout",
      tone: "tip",
      title: "Two cut-offs, so plan the last walk in carefully",
      text: "The DreamVille crossing closes two hours before the festival does, which works out at 23:00 on Friday and Saturday and 22:00 on Sunday. The festival separately refuses new entry at 22:00 on Friday and Saturday and 21:00 on Sunday. The official pages state both rules without saying how they interact for a DreamVille guest, so the safe reading is the earlier time.",
      sources: ["s3", "s1"],
    },
    {
      type: "facts",
      caption: "Festival hours and last entry, both weekends",
      rows: [
        { label: "Friday", value: "12:00–01:00, last entry 22:00", sources: ["s1"] },
        { label: "Saturday", value: "12:00–01:00, last entry 22:00", sources: ["s1"] },
        { label: "Sunday", value: "12:00–00:00, last entry 21:00", sources: ["s1"] },
        {
          label: "DreamVille to festival",
          value: "Re-entry until two hours before closing",
          sources: ["s3"],
        },
        { label: "Festival to DreamVille", value: "Re-entry from 17:00 onwards", sources: ["s3"] },
      ],
    },
    { type: "h2", id: "what-is-allowed", text: "What is allowed and what is not" },
    {
      type: "p",
      text: "The two prohibited-items lists differ, and the difference matters. Your own food and drink may go into DreamVille but not onto the festival site. Glass is banned in both, with one qualification: perfume and deodorant are allowed in containers of 100 ml or less.",
      sources: ["s5"],
    },
    {
      type: "ul",
      items: [
        "**Banned on the festival site:** your own food and drinks, plastic bottles, cans, sticks, and glass. Prescribed medication is allowed only with a medical certificate.",
        "**Banned in DreamVille:** glass, sticks or walking sticks, gas installations over 500 g, and campers or caravans. Sleeping in a car is not allowed either.",
        "**Barbecues:** cooking happens only at the dedicated barbecue areas, which is why the gas limit matters.",
        "**Drugs:** prohibited, other than prescribed medication presented with a medical certificate. There is no workaround at the gate.",
      ],
      sources: ["s5"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Campers and caravans are refused",
      text: "Motorhomes and caravans are not allowed in or at DreamVille, and they are not allowed in the DreamVille car parks either. Sleeping in a car is prohibited as well, so a van trip has nowhere to stay on site.",
      sources: ["s5"],
    },
    {
      type: "p",
      text: "Access may be refused if the name on the bracelet does not match your identification, and a name cannot be changed after personalisation. Valid identification means an identity card, passport or driving licence; copies and mandates are not accepted.",
      sources: ["s14"],
    },
    { type: "h2", id: "money-on-site", text: "Money on site" },
    {
      type: "p",
      text: "The bracelet is the only way to pay for food and drinks, on the festival site and in DreamVille. You load it with Pearls through your Tomorrowland Account before the festival or on site, and each reusable cup carries a one-Pearl deposit that comes back when you return the cup to a Cup Return station.",
      sources: ["s10", "s11", "s18"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "The 2027 Pearl value is not published",
      text: "Tomorrowland states that the value of one Pearl will be made available as soon as Pearls can be purchased, and its bracelet page puts that at around June. Any euro-per-Pearl figure quoted for 2027 before then is unconfirmed, including anything carried over from an earlier edition.",
      sources: ["s10", "s16", "s17"],
    },
    { type: "h2", id: "camping-facilities", text: "Camping facilities" },
    {
      type: "p",
      text: "The Marketplace is the campsite's service centre. The official page names a mini-supermarket, a hair salon, a bakery, a camping store, phone repair and a battery swap, and it does not name a supermarket brand.",
      sources: ["s7"],
    },
    {
      type: "p",
      text: "Washing is split by area. In Magnificent Greens, sinks, toilets and open-air showers are available at any time and free of charge. Montagoe's sanitary facilities are also free and open at all times, and its lobby is staffed around the clock. Toilet facilities across the site are free and cleaned regularly.",
      sources: ["s8", "s9", "s10"],
    },
    {
      type: "p",
      text: "Easy Tent guests get a lock for the tent as part of the package, which is worth knowing before buying a padlock. Camp2Camp guests can swap an empty battery for a charged one at the Camp2Camp lobby.",
      sources: ["s12", "s13"],
    },
    {
      type: "p",
      text: "Some things people expect from a campsite are not confirmed officially and are left out here rather than guessed at: laundry and gym facilities, an ATM, paid-shower prices and timetables, and a DreamVille capacity figure. None appears on the official pages the ledger checked.",
      sources: ["s7", "s8", "s10"],
    },
    { type: "h2", id: "the-gathering", text: "The Gathering" },
    {
      type: "p",
      text: "The Gathering is the Thursday opening party inside DreamVille, and it is for DreamVille guests only. It runs in both weekends from 13:30 until 00:00, so an early Thursday check-in lands you at the start of it.",
      sources: ["s1"],
    },
  ],
} satisfies GuideChapter;
