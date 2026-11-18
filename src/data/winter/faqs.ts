import type { Faq } from "../schemas";

/**
 * Winter 2027 FAQ entries.
 *
 * Every answer is limited to what `docs/factcheck/winter.md` and
 * `docs/factcheck/conflicts.md` record as confirmed, corrected for 2027, or
 * verified against an official page in the ledger's Gaps section. Anything the
 * ledger could not confirm is absent, and listed in
 * `docs/data/winter-omissions.md`.
 */
export const winterFaqs: readonly Faq[] = [
  {
    id: "faq-festival-dates-2027",
    edition: "winter",
    question: "When is Tomorrowland Winter 2027?",
    answer:
      "Tomorrowland Winter 2027 runs from **Saturday 20 to Saturday 27 March 2027** at Alpe d'Huez in France.\n\nThe festival opens with the pre-days from Saturday 20 to Monday 22 March, when the MainStage is closed, and the main festival days run Tuesday 23 to Friday 26 March. The MainStage is covered and heated, and it only opens on those main festival days.",
    tags: ["dates", "2027", "overview"],
    related: ["faq-mainstage-open-days", "faq-mountain-stage-hours", "faq-mainstage-hours-last-entry"],
    source: {
      url: "https://winter.tomorrowland.com/en/",
      title: "Tomorrowland Winter: MARCH 20–27, 2027 | ALPE D'HUEZ, FRANCE",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-mainstage-open-days",
    edition: "winter",
    question: "Which days does the MainStage open in 2027?",
    answer:
      "For 2027 the MainStage is open from **Tuesday 23 to Friday 26 March** and closed from **Saturday 20 to Monday 22 March**.\n\nThat split drives the week: the mountain stages and the village programme run from the Saturday, but the MainStage only opens on the Tuesday. It is also why the ticket page sells two separate 1-day products, one for a day between 20 and 22 March with the MainStage closed and one for a day between 23 and 26 March with it open.",
    tags: ["dates", "mainstage", "tickets"],
    related: ["faq-festival-dates-2027", "faq-mainstage-hours-last-entry", "faq-comfort-upgrade-timing"],
    source: {
      url: "https://winter.tomorrowland.com/en/practical/opening-hours/",
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-tickets-include-ski-pass",
    edition: "winter",
    question: "Does a festival ticket include the ski pass?",
    answer:
      "Yes. Every Winter ticket includes a lift and ski pass, and the pass is required rather than optional: the official ticket page states that the lift and ski pass is needed to reach the mountain stages.\n\nThe same applies inside a package, which bundles festival access, the lift and ski pass, and accommodation. The 7-Day Festival Ticket for 2027 is published at €735, made up of a €346 festival element and a €389 lift and ski pass.",
    tags: ["tickets", "ski pass", "packages"],
    related: ["faq-seven-day-ticket-price", "faq-mountain-stage-pedestrian-access"],
    source: {
      url: "https://winter.tomorrowland.com/en/tickets/festival-ticket/",
      title: "Tomorrowland Winter: festival ticket",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-seven-day-ticket-price",
    edition: "winter",
    question: "How much is the 7-Day Festival Ticket for 2027, and why are the other prices missing?",
    answer:
      "The 7-Day Festival Ticket for 2027 is **€735**: a €346 festival element plus a €389 lift and ski pass.\n\nNo 4-Day or 1-Day ticket price and no package minimum are published. The 4-Day and 1-Day tickets are listed for 2027 on the official page, but the page renders no figure to a reader who is not signed in, and the 4- and 7-Day Package sale shows as sold out with no minimum price. Our guidance is to treat those figures as unknown rather than reuse an older season's price.",
    tags: ["tickets", "prices", "2027"],
    related: ["faq-tickets-include-ski-pass", "faq-comfort-upgrade-timing"],
    source: {
      url: "https://winter.tomorrowland.com/fr/tickets/ticket-festival/",
      title: "Tomorrowland Winter 2027 ticket festival",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-comfort-upgrade-timing",
    edition: "winter",
    question: "Can I add the Comfort upgrade after buying my ticket?",
    answer:
      "No. The Comfort upgrade costs **€390 for 2027** and must be chosen in the ticket shop at the moment of purchase. The official package page describes it as something that has to be added on top of the existing ticket, and it cannot be bought later as an add-on.\n\nWhat the upgrade includes: access to the Comfort area at one of the mountain stages and at the MainStage, a private cloakroom, dedicated toilets, savoury bites and snacks, dedicated bottle service, unlimited access to the outdoor swimming pool and the ice-skating rink in Alpe d'Huez, and one free sledging ride at the resort's Alpine coaster. The 2027 wording no longer names Amare as the mountain venue.",
    tags: ["tickets", "comfort", "upgrades"],
    related: ["faq-seven-day-ticket-price", "faq-tickets-include-ski-pass"],
    source: {
      url: "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation/",
      title: "Tomorrowland Winter: festival ticket and accommodation",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-payment-terms",
    edition: "winter",
    question: "How does payment work when I buy a package?",
    answer:
      "You pay a prepayment of at least **40% of the order at purchase, capped at €2,500**, and the remaining balance is due **within 30 days**.\n\nPackage prices include city tax, the service fee, the SGR guarantee-fund fee and the payment cost, so the total you are quoted is the total you owe. Festival tickets bought without accommodation also carry a Treasure Case fee of €15 within the EU and €22 worldwide, separate from the ticket price.",
    tags: ["booking", "payment", "packages"],
    related: ["faq-package-cancellation", "faq-treasure-case-fee"],
    source: {
      url: "https://winter.tomorrowland.com/en/sales-info/payment-methods-and-conditions/",
      title: "Tomorrowland Winter: payment methods and conditions",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-treasure-case-fee",
    edition: "winter",
    question: "What is the Treasure Case fee?",
    answer:
      "If you buy a festival ticket without accommodation, a Treasure Case fee applies on top: **€15 for delivery within the EU and €22 worldwide**.\n\nPackage buyers do not pay it separately, because one Treasure Case per person is already included in the package price alongside city tax, the service fee, the SGR guarantee-fund fee and the payment cost.",
    tags: ["tickets", "delivery", "fees"],
    related: ["faq-payment-terms", "faq-tickets-include-ski-pass"],
    source: {
      url: "https://winter.tomorrowland.com/en/practical/your-tomorrowland-bracelet/",
      title: "Tomorrowland Winter: your Tomorrowland Bracelet",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-name-changes",
    edition: "winter",
    question: "Can I change the name on my booking?",
    answer:
      "Personalisation is free until **30 November 2026**. Between **1 December 2026 and 15 January 2027** a name change costs **€350 per name**, and that is the only window in which one is offered.\n\nThe shipping address can be edited in Manage My Booking until **30 December 2026** for packages. After that date the address is locked, so check it before you buy rather than afterwards.",
    tags: ["booking", "names", "deadlines"],
    related: ["faq-payment-terms", "faq-package-cancellation"],
    source: {
      url: "https://faq.tomorrowlandwinter.com/hc/en-us/articles/360038123752-Can-I-change-personal-information-in-my-booking",
      title: "Can I change personal information in my booking?",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-package-cancellation",
    edition: "winter",
    question: "What does it cost to cancel a package?",
    answer:
      "The package cancellation ladder is charged as a percentage of the booking:\n\n- **70%** before 1 November 2026\n- **80%** before 1 December 2026\n- **90%** before 1 February 2027\n- **100%** from 1 February 2027\n\nA package cancelled from 1 February 2027 therefore refunds nothing.",
    tags: ["booking", "cancellation", "refunds"],
    related: ["faq-payment-terms", "faq-exchange-desk", "faq-name-changes"],
    source: {
      url: "https://winter.tomorrowland.com/en/sales-info/payment-methods-and-conditions/",
      title: "Tomorrowland Winter: payment methods and conditions",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-exchange-desk",
    edition: "winter",
    question: "How can I resell a Winter festival ticket?",
    answer:
      "Ticket-only buyers can list a ticket on the Exchange Desk, which for Winter is open from **10 October 2026 to 20 January 2027**. A **€10 fee per ticket** is deducted from the refund, and resale is not guaranteed — listing is not a sale.\n\nPackage bookings are governed by the cancellation ladder instead, and no name change is possible after 15 January 2027 on either route.",
    tags: ["booking", "resale", "refunds"],
    related: ["faq-package-cancellation", "faq-name-changes"],
    source: {
      url: "https://faq.tomorrowlandwinter.com/hc/en-us/articles/360038500631-Can-I-cancel-my-Tomorrowland-Winter-order",
      title: "Can I cancel my Tomorrowland Winter order?",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-add-on-sale-date",
    edition: "winter",
    question: "When does the 2027 Add-On Sale open?",
    answer:
      "The 2027 Add-On Sale opens on **26 November 2026 at 15:00 CET**.\n\nIt covers activities, lockers, slope experiences, ski and snowboard equipment, ski insurance, shuttles, the Transportation Pass and towels. Note two omissions from the 2027 index: there is no restaurant category this year, and no Recharge Hub. The Comfort upgrade is not sold here either, because it must be bought with the ticket.",
    tags: ["add-ons", "dates", "2027"],
    related: ["faq-comfort-upgrade-timing", "faq-transportation-pass", "faq-ski-lessons-2027"],
    source: {
      url: "https://winter.tomorrowland.com/en/add-ons/",
      title: "Tomorrowland Winter 2027 add-ons",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-mountain-stage-hours",
    edition: "winter",
    question: "What time do the mountain stages open and close?",
    answer:
      "Mountain stages run **12:00 to 17:00 on Saturday, Sunday and Monday**, and **12:00 to 17:30 on Tuesday to Friday**.\n\nThe daytime programme ends in the late afternoon and the festival moves into the village for the evening, where the main area opens at 19:00. The lifts from the mountain stages back down to Alpe d'Huez run until the stages close; the lifts out to the surrounding villages have fixed last departures and do not.",
    tags: ["stages", "timings", "mountains"],
    related: ["faq-lift-last-departures", "faq-mountain-stage-pedestrian-access", "faq-mainstage-hours-last-entry"],
    source: {
      url: "https://winter.tomorrowland.com/en/practical/opening-hours/",
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-mainstage-hours-last-entry",
    edition: "winter",
    question: "What are the main festival area hours, and when is last entry?",
    answer:
      "The main festival area opens at **19:00**. It closes at **00:00 on Saturday to Monday** and at **01:30 on Tuesday to Friday**.\n\nLast admission is **23:30 on Saturday to Monday** and **00:30 on Tuesday to Friday** — the official page states plainly that entry after that time is not possible. The MainStage itself is covered and heated, and it only opens on the Tuesday-to-Friday main festival days.",
    tags: ["stages", "timings", "mainstage"],
    related: ["faq-mountain-stage-hours", "faq-mainstage-open-days"],
    source: {
      url: "https://winter.tomorrowland.com/en/practical/opening-hours/",
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-moosebar-by-day-hours",
    edition: "winter",
    question: "When is Moosebar by Day open?",
    answer:
      "Moosebar by Day runs **15:00 to 19:30, Saturday to Friday**.\n\nThe 2027 opening-hours page publishes only that daytime slot. No night-time Moosebar hours are published for 2027.",
    tags: ["stages", "timings", "moosebar"],
    related: ["faq-mainstage-hours-last-entry", "faq-mountain-stage-hours"],
    source: {
      url: "https://winter.tomorrowland.com/en/practical/opening-hours/",
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-mountain-stage-pedestrian-access",
    edition: "winter",
    question: "Can I reach the mountain stages without skiing?",
    answer:
      "Yes. The official festival page states that all mountain stages can be accessed by pedestrians.\n\nYou still need the lift and ski pass, which every ticket includes, because the lifts are how you get up and down. The stages sit at altitude on snow, and the return trip has to fit inside the 17:00 or 17:30 stage closing time.",
    tags: ["stages", "access", "mountains"],
    related: ["faq-mountain-stage-hours", "faq-lift-last-departures", "faq-tickets-include-ski-pass"],
    source: {
      url: "https://winter.tomorrowland.com/en/practical/at-the-festival/",
      title: "Tomorrowland Winter: at the festival",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-lift-last-departures",
    edition: "winter",
    question: "Do the lifts keep running after the last set on the mountain?",
    answer:
      "Only the lifts that run from the mountain stages back down to Alpe d'Huez keep operating until the stages close. Lifts that connect to the surrounding villages have fixed last departures, published between 16:30 and 17:50 depending on the village, and they do not wait for the music.\n\nIf you are staying in a village rather than in Alpe d'Huez, that fixed departure is your real curfew for the daytime programme, and the evening return is a separate paid service — see the Transportation Pass entry.",
    tags: ["lifts", "timings", "villages"],
    related: ["faq-mountain-stage-hours", "faq-transportation-pass", "faq-mountain-stage-pedestrian-access"],
    source: {
      url: "https://winter.tomorrowland.com/en/practical/opening-hours/",
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-transportation-pass",
    edition: "winter",
    question: "How do I get back to a surrounding village at night?",
    answer:
      "With the **Transportation Pass, €40**, which covers the evening service: a 20-minute night lift for Oz 3300 between 18:30 and 21:00 and between 22:30 and 00:30, extended to 02:00 on MainStage days, and dedicated night coaches to Bourg d'Oisans, Vaujany, Villard-Reculas and Auris-en-Oisans.\n\nThe pass is included automatically in packages sold in Oz 3300. The Villard-Reculas and Auris coaches run only on the days the MainStage is open, so they do not cover the Saturday-to-Monday pre-days. Walking between Alpe d'Huez and the surrounding villages is prohibited by the organiser, so the pass is the only sanctioned way back at night.",
    tags: ["transport", "villages", "night"],
    related: ["faq-lift-last-departures", "faq-covered-parking", "faq-add-on-sale-date"],
    source: {
      url: "https://winter.tomorrowland.com/en/practical/how-to-get-there/transportation-pass/",
      title: "Tomorrowland Winter: Transportation Pass",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-covered-parking",
    edition: "winter",
    question: "How much is covered parking in Alpe d'Huez, and how many spaces are there?",
    answer:
      "Covered parking for the 2026–27 season costs **€18 per day or €95 per week**, with the first hour free.\n\nThere are six covered car parks: Coulet (95 spaces), Cristal de l'Alpe (165), Éclose (319), Bergers (260), Rif Nel (230) and Jeux (120). Éclose is the largest.",
    tags: ["parking", "driving", "prices"],
    related: ["faq-winter-tyre-rule", "faq-transportation-pass"],
    source: {
      url: "https://skipass.alpedhuez.com/acces-station-alpe-dhuez/parking/",
      title: "Alpe d'Huez: parking",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-winter-tyre-rule",
    edition: "winter",
    question: "Do I have to carry snow chains to drive to Alpe d'Huez?",
    answer:
      "No — chains are one way to comply, not the only way. In the Isère mountain zones, from **1 November to 31 March**, a vehicle must either carry removable anti-slip devices for at least two driven wheels **or** be fitted with **four winter tyres**. Four 3PMSF winter tyres satisfy the rule on their own, with no chains carried.",
    tags: ["driving", "safety", "winter"],
    related: ["faq-covered-parking", "faq-resort-altitude"],
    source: {
      url: "https://www.service-public.gouv.fr/particuliers/actualites/A14389",
      title: "Service-public.fr: winter equipment requirements",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-ski-lessons-2027",
    edition: "winter",
    question: "How do ski and snowboard lessons work in 2027?",
    answer:
      "All 2027 lessons are **morning-only**. Group lessons run 10:00 to 12:30 with a maximum of 8 people per class; private lessons run 09:30 to 12:30 or 10:30 to 13:30 for up to 5 people. Lessons are offered at two levels only, beginner and intermediate.\n\nPublished 2027 prices: a half-day group lesson is €74 per person, three half days €222, six half days €275, and a half-day private lesson €244 per group. The Off-Slope Experience is €124 per person for a half day, Sarenne First Track is €28 and Sarenne Sunset, which includes a gourmet break in a mountain refuge, is €64.",
    tags: ["lessons", "skiing", "add-ons"],
    related: ["faq-equipment-hire-2027", "faq-add-on-sale-date", "faq-la-sarenne"],
    source: {
      url: "https://winter.tomorrowland.com/en/add-ons/slope-experiences/",
      title: "Tomorrowland Winter 2027 slope experiences",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-equipment-hire-2027",
    edition: "winter",
    question: "Can I hire skis or a snowboard through Tomorrowland?",
    answer:
      "Yes — equipment is booked in advance through the Add-On Sale and collected in **Alpe d'Huez or Oz 3300**. Every ski package includes skis, boots and poles; a snowboard package includes the board and boots.\n\nA helmet, goggles and clothing are **not** included, so those still have to be brought or rented locally. No 2027 equipment prices are published, so check the price in the Add-On Sale after it opens on 26 November 2026 rather than budgeting from an older season.",
    tags: ["equipment", "rental", "add-ons"],
    related: ["faq-ski-lessons-2027", "faq-add-on-sale-date"],
    source: {
      url: "https://winter.tomorrowland.com/en/add-ons/ski-and-snowboard-equipment/",
      title: "Tomorrowland Winter 2027 ski and snowboard equipment",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-resort-altitude",
    edition: "winter",
    question: "How high is Alpe d'Huez, and how big is the ski area?",
    answer:
      "The resort sits at **1,860 m**, and the ski area reaches **3,330 m** at the Pic Blanc, with **250 km of piste** across the domain.\n\nThe mountain stages sit above the village at altitude, and the daytime programme ends in the late afternoon, at 17:00 or 17:30 depending on the day.",
    tags: ["resort", "skiing", "altitude"],
    related: ["faq-winter-tyre-rule", "faq-mountain-stage-hours", "faq-la-sarenne"],
    source: {
      url: "https://skipass.alpedhuez.com/",
      title: "Alpe d'Huez: ski area",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-la-sarenne",
    edition: "winter",
    question: "What is La Sarenne?",
    answer:
      "La Sarenne is a **16 km black run** from the Pic Blanc, described officially as Europe's longest black run. Tomorrowland sells two experiences on it.\n\nSarenne First Track runs on the Monday from 08:00 to 09:30 at €28 and is open to average and advanced skiers. Sarenne Sunset runs on the Sunday from 16:30 to 21:30 at €64 and includes a gourmet break in a mountain refuge. The separate Off-Slope Experience is open to skiers at ease on black slopes.",
    tags: ["skiing", "sarenne", "add-ons"],
    related: ["faq-ski-lessons-2027", "faq-resort-altitude"],
    source: {
      url: "https://winter.tomorrowland.com/en/add-ons/slope-experiences/",
      title: "Tomorrowland Winter 2027 slope experiences",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-free-resort-buses",
    edition: "winter",
    question: "Are the buses around the resort free?",
    answer:
      "Yes. Four free Resalp lines serve the resort during the winter season, and no ticket is needed.\n\nThese are the village buses, not the paid inter-village night service: for evening travel to Oz 3300, Bourg d'Oisans, Vaujany, Villard-Reculas or Auris-en-Oisans you need the Transportation Pass.",
    tags: ["transport", "buses", "resort"],
    related: ["faq-transportation-pass", "faq-lift-last-departures"],
    source: {
      url: "https://skipass.alpedhuez.com/acces-station-alpe-dhuez/transports-urbains-gratuits/",
      title: "Alpe d'Huez: free urban transport",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "faq-getting-to-alpe-dhuez",
    edition: "winter",
    question: "How do I get to Alpe d'Huez?",
    answer:
      "By road, the resort is reached by the famous climb of **21 hairpin turns**. Tomorrowland quotes **about 90 minutes** from Grenoble station by transfer; Transaltitude's own timetable for the same coach route quotes 1 h 45.\n\nBy air, Lyon Airport is 148 km away and about 2 hours 30 minutes by road, Grenoble Airport about 2 hours, and Geneva Airport about 3 hours 15 minutes by road (Altibus quotes 4 hours by coach). Flight packages include the Lyon Airport transfer. Coach and shuttle fares vary by operator, so book against the fare the operator quotes for your date rather than a figure from an earlier season.",
    tags: ["transport", "travel", "airports"],
    related: ["faq-transportation-pass", "faq-winter-tyre-rule"],
    source: {
      url: "https://winter.tomorrowland.com/en/practical/how-to-get-there/",
      title: "Tomorrowland Winter: how to get there",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
];
