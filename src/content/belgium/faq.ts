import { guideChapterSchema } from "../schema";

/**
 * Rules, grouped by the decision they affect.
 *
 * Only confirmed claims (or the corrected value of a changed one) appear. Re-
 * entry, hours, name matching, age, the prohibited lists, the sale caps and the
 * Exchange Desk all come from official pages; the Mansion is quote-only and the
 * Pearl rate is unpublished, so both are stated as gaps rather than filled.
 */
export const faqChapter = guideChapterSchema.parse({
  edition: "belgium",
  slug: "faq",
  order: 10,
  title: "Rules and answers",
  summary:
    "The confirmed rules that decide a trip: re-entry and hours, what you may carry in, tickets and resale, and the DreamVille crossings worth knowing before you book.",
  lastVerified: "2026-11-18",
  related: ["belgium/overview", "belgium/tickets", "belgium/dreamville", "belgium/food-drinks"],
  sources: [
    {
      id: "s1",
      title: "Tomorrowland Belgium — opening hours",
      url: "https://belgium.tomorrowland.com/en/practical/opening-hours/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s2",
      title: "Can I re-enter the festival",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037215812-Can-I-re-enter-the-festival",
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
      title: "Tomorrowland Belgium — forbidden objects",
      url: "https://belgium.tomorrowland.com/en/practical/forbidden-objects/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s5",
      title: "Tomorrowland Belgium — festival policies",
      url: "https://belgium.tomorrowland.com/en/practical/policies/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s6",
      title: "Can I enter if the registered name on the Bracelet is not my own",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588511-Can-I-enter-if-the-registered-name-on-the-Bracelet-is-not-my-own",
      checkedOn: "2026-11-18",
    },
    {
      id: "s7",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s8",
      title: "Tomorrowland Belgium — Exchange Desk",
      url: "https://belgium.tomorrowland.com/en/sales-info/exchange-desk/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s9",
      title: "Can I cancel or resell my tickets",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588571-Can-I-cancel-or-resell-my-tickets",
      checkedOn: "2026-11-18",
    },
    {
      id: "s10",
      title: "Tomorrowland Belgium — official ticket channels",
      url: "https://belgium.tomorrowland.com/en/sales-info/official-ticket-channels/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s11",
      title: "What are the Official Sales Channels",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037586711-What-are-the-Official-Sales-Channels",
      checkedOn: "2026-11-18",
    },
    {
      id: "s12",
      title: "What is Pre-Registration",
      url: "https://faq.tomorrowland.com/hc/en-us/articles/43968145412372-What-is-Pre-Registration",
      checkedOn: "2026-11-18",
    },
    {
      id: "s13",
      title: "Tomorrowland Belgium — Mansions",
      url: "https://belgium.tomorrowland.com/hospitality/mansions/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s14",
      title: "Tomorrowland Belgium — the Avicii Tribute",
      url: "https://belgium.tomorrowland.com/en/add-on-sale/tomorrowland-add-ons/the-avicii-tribute/",
      checkedOn: "2026-11-18",
    },
    {
      id: "s15",
      title: "Tomorrowland — official YouTube channel",
      url: "https://www.youtube.com/@Tomorrowland",
      checkedOn: "2026-11-18",
    },
  ],
  blocks: [
    {
      type: "p",
      text: "These are the rules that change a plan rather than merely constrain it: the re-entry rule, the entry deadlines, the items refused at the gate, the sale caps, and the crossings between DreamVille and the festival site. Every answer here rests on an official page read on 18 November 2026.",
      sources: ["s1", "s2"],
    },
    { type: "h2", id: "entering-and-leaving", text: "Entering and leaving" },
    {
      type: "facts",
      caption: "Entry and hours",
      rows: [
        {
          label: "Same-day re-entry",
          value:
            "Not allowed. Once you leave the festival you cannot re-enter that day, even with a three-day Full Madness Pass. Tomorrowland's wording is 'OUT = OUT'.",
          sources: ["s2"],
        },
        {
          label: "Later days",
          value: "A Full Madness Pass allows re-entry on a later day of the same weekend, never on the same day.",
          sources: ["s2"],
        },
        {
          label: "Day passes",
          value: "No return at all; a day pass needs a new entry ticket to come back in.",
          sources: ["s2"],
        },
        {
          label: "Festival hours",
          value: "Friday and Saturday 12:00–01:00; Sunday 12:00–00:00. The same at both weekends.",
          sources: ["s1"],
        },
        {
          label: "Last entry",
          value: "22:00 on Friday and Saturday, 21:00 on Sunday. Access is refused after that.",
          sources: ["s1"],
        },
        {
          label: "Minimum age",
          value: "18 before the festival starts.",
          sources: ["s5"],
        },
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Leave once and the day is over",
      text: "The no-re-entry rule applies to everyone, including three-day pass holders, so a midday trip back to the car or the tent for a forgotten item ends your festival day. The two DreamVille crossings below are the only exceptions, and they have their own hours.",
      sources: ["s2", "s3"],
    },
    { type: "h2", id: "banned-and-allowed-items", text: "Banned and allowed items" },
    {
      type: "facts",
      caption: "What is refused at the gate",
      rows: [
        {
          label: "Perfume and deodorant",
          value: "Allowed up to 100 ml. Anything larger is refused as glass.",
          sources: ["s4"],
        },
        {
          label: "Selfie sticks",
          value: "Prohibited. 'Sticks' appear on the festival's prohibited list, and there is no length allowance.",
          sources: ["s4"],
        },
        {
          label: "Own food and drink",
          value: "Banned on the festival site. Not banned in DreamVille.",
          sources: ["s4"],
        },
        {
          label: "Plastic bottles and cans",
          value: "Prohibited on the festival site.",
          sources: ["s4"],
        },
        {
          label: "Glass",
          value: "Banned at the festival and in DreamVille.",
          sources: ["s4"],
        },
        {
          label: "Drugs",
          value:
            "Zero tolerance, except prescribed medication presented with a medical certificate. Carry the certificate to the gate.",
          sources: ["s4"],
        },
        {
          label: "Gas and cooking",
          value:
            "Gas installations over 500 g are banned in DreamVille. Cooking is allowed only at the dedicated public barbecue areas.",
          sources: ["s4"],
        },
        {
          label: "Campers and caravans",
          value: "Not allowed in or at DreamVille, and sleeping in cars is banned.",
          sources: ["s4"],
        },
      ],
    },
    {
      type: "p",
      text: "Two further rules turn on damage rather than possession. Prescribed medicine needs the certificate described above, and tearing or breaking festival decorations leads to removal from the festival and no access for the rest of it.",
      sources: ["s4", "s5"],
    },
    { type: "h2", id: "tickets-and-resale", text: "Tickets and resale" },
    {
      type: "facts",
      caption: "Buying, capping and reselling",
      rows: [
        {
          label: "Pre-registration",
          value:
            "Opens 2 December 2026 at 15:00 CET and closes 12 February 2027 at 15:00 CET. Mandatory for every sale, and no guarantee of a ticket.",
          sources: ["s12"],
        },
        {
          label: "Cap per account",
          value:
            "Four people, cumulated across all sale moments rather than per order. Friendship Garden packages are exempt.",
          sources: ["s7"],
        },
        {
          label: "Global Journey cap",
          value: "Six people per account, and two during the NFT Global Journey sale.",
          sources: ["s7"],
        },
        {
          label: "Ticket name",
          value:
            "Cannot be changed after personalisation. Access may be refused if the name does not match your ID.",
          sources: ["s6"],
        },
        {
          label: "Accepted ID",
          value: "Identity card, passport or driving licence. Copies and mandates are not accepted.",
          sources: ["s6"],
        },
        {
          label: "Exchange Desk",
          value:
            "Opens 13 February 2027 and closes 29 April 2027. A listing is final and cannot be undone, and a €10 fee per ticket is deducted from the refund.",
          sources: ["s9", "s8", "s7"],
        },
        {
          label: "Global Journey resale",
          value: "The Exchange Desk does not accept Global Journey packages at all.",
          sources: ["s9"],
        },
        {
          label: "Global Journey name changes",
          value: "Only in urgent cases, until 29 April 2027 at 23:59 CEST, at €350 per name.",
          sources: ["s7"],
        },
      ],
    },
    {
      type: "p",
      text: "The Exchange Desk, inside the main buyer's Tomorrowland Account, is the only official way to offer a ticket for resale. Three channels sell officially: the Paylogic ticket shop through my.tomorrowland.com, the Official Travel Shop for Global Journey packages, and the travel partners listed on the Tomorrowland site. Nothing else is authorised, and tickets resold outside those channels are cancelled.",
      sources: ["s11", "s10"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "A listing is not a sale",
      text: "Registering a ticket on the Exchange Desk guarantees nothing. If nobody buys it, the ticket stays yours and the money stays spent, which matters because all purchases are final and tickets cannot be cancelled.",
      sources: ["s9"],
    },
    { type: "h2", id: "dreamville-pointers", text: "DreamVille pointers" },
    {
      type: "facts",
      caption: "DreamVille rules that catch people out",
      rows: [
        {
          label: "Opening window",
          value: "Thursday from 11:00 until Monday 12:00, continuous, at both weekends.",
          sources: ["s1"],
        },
        {
          label: "Check-in",
          value:
            "Thursday from 11:00 at both entrances; Friday around the clock; Saturday at both entrances until 12:00 and then Entrance 1 only; no check-in at all on Sunday.",
          sources: ["s1"],
        },
        {
          label: "Check-out",
          value: "By Monday 12:00, with no exceptions.",
          sources: ["s1"],
        },
        {
          label: "Festival to DreamVille",
          value: "You may re-enter DreamVille from the festival from 17:00 onwards.",
          sources: ["s3"],
        },
        {
          label: "DreamVille to festival",
          value: "You may re-enter the festival from DreamVille until two hours before closing time.",
          sources: ["s3"],
        },
        {
          label: "The Gathering",
          value: "Thursday 13:30–00:00, in both weekends, for DreamVille guests only.",
          sources: ["s1"],
        },
        {
          label: "Entrances",
          value:
            "Entrance 1 at Nachtegaalstraat, 2850 Boom; Entrance 2 at Rumstsestraat, 2840 Rumst, for Magnificent Greens.",
          sources: ["s1"],
        },
        {
          label: "Mansion",
          value:
            "No published price. Availability and pricing are by enquiry to table@tomorrowland.com, and festival access is not included.",
          sources: ["s13"],
        },
      ],
    },
    {
      type: "p",
      text: "The two crossings above are the only movement between the tent and the arena that the no-re-entry rule permits, so they are the ones to remember when planning an evening. Moving between DreamVille and the festival is otherwise unaffected: you may always leave and return to DreamVille itself.",
      sources: ["s2", "s3"],
    },
    { type: "h2", id: "sets-and-streaming", text: "Sets and streaming" },
    {
      type: "p",
      text: "Full sets are published through Tomorrowland's own channels: the official YouTube channel, the Tomorrowland App and Apple Music.",
      sources: ["s15", "s14"],
    },
    {
      type: "p",
      text: "Avicii's Tomorrowland performances are available officially. Remastered recordings of three of his sets stream on Apple Music and in the Tomorrowland App, so the older claim that only aftermovies survive is out of date.",
      sources: ["s14"],
    },
    { type: "h2", id: "verified-answers", text: "The verified answers in full" },
    {
      type: "p",
      text: "The sections above are summaries. Every confirmed answer this site holds, with its own source, is reproduced below from the validated data rather than retyped, so it cannot drift from the page it came from.",
      sources: ["s1", "s9"],
    },
    {
      type: "data",
      edition: "belgium",
      collection: "faqs",
      caption: "Verified Belgium answers, checked 18 November 2026",
    },
  ],
});
