import type { Faq } from "../schemas";

/**
 * Belgium FAQs, 2027 cycle.
 *
 * Only claims whose ledger verdict is `confirmed`, or `changed` with the
 * corrected value applied, are represented. Each answer stays inside the claims
 * its own cited page supports, so a page that only covers re-entry does not
 * also stand as the source for opening hours. Where a useful fact needed a
 * second page, it became its own entry.
 *
 * Questions the notes raise but no official source settles (bracelet shipping
 * waves, will-call desks, ATMs, walking times between stages, dietary matrices,
 * taxi fares, locker prices, paid-shower prices, ATM locations) are absent and
 * listed in `docs/data/belgium-omissions.md`.
 *
 * Answers are Markdown source. No third-party resale site is named except to
 * say it is not an official channel.
 */
export const faqs: readonly Faq[] = [
  {
    id: "re-entry-after-leaving",
    edition: "belgium",
    question: "Can I leave the festival and come back the same day?",
    answer:
      "No. Once you leave the festival site you cannot re-enter on the same day, even with a three-day Full Madness Pass. Tomorrowland's wording is blunt: out is out.\n\nA Full Madness Pass does allow re-entry on a later day of the same weekend, never on the same day. A day pass has no return at all and needs a new entry ticket.\n\nThe two crossings between DreamVille and the festival site survive this rule, and they are covered separately.",
    tags: ["tickets", "festival", "rules"],
    related: ["dreamville-to-festival-crossings", "festival-opening-hours"],
    source: {
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037215812-Can-I-re-enter-the-festival",
      title: "Can I re-enter the festival",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "dreamville-to-festival-crossings",
    edition: "belgium",
    question: "When can I move between DreamVille and the festival?",
    answer:
      "Two windows are open, and both apply to every DreamVille guest:\n\n- You may re-enter DreamVille from the festival from 17:00 onwards.\n- You may re-enter the festival from DreamVille until two hours before the site closes.\n\nThese are the crossings that survive the no-re-entry rule. Treat 17:00 as the earliest you can go back to your tent for the evening, and work backwards from the closing time to judge your last walk in.",
    tags: ["dreamville", "festival", "rules"],
    related: ["re-entry-after-leaving", "festival-opening-hours"],
    source: {
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037582731-What-are-the-opening-hours-of-the-festival-site",
      title: "What are the opening hours of the festival site",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "festival-opening-hours",
    edition: "belgium",
    question: "What are the festival opening hours?",
    answer:
      "The hours are the same across both weekends. Friday and Saturday run from 12:00 to 01:00; Sunday runs from 12:00 to 00:00.\n\nEntry closes earlier than the music does. The last entry is 22:00 on Friday and Saturday and 21:00 on Sunday, and access is refused after that, so a late arrival needs planning.",
    tags: ["festival", "planning"],
    related: ["re-entry-after-leaving", "dreamville-check-in-and-check-out"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/opening-hours/",
      title: "Tomorrowland Belgium — opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "dreamville-check-in-and-check-out",
    edition: "belgium",
    question: "When can I check in to and out of DreamVille?",
    answer:
      "DreamVille opens on the Thursday before each festival weekend and stays open continuously until Monday at 12:00, when check-out closes with no exceptions.\n\nCheck-in follows its own timetable:\n\n- Thursday: from 11:00 at both DreamVille entrances.\n- Friday: around the clock.\n- Saturday: at both entrances until 12:00, then Entrance 1 on Nachtegaalstraat only.\n- Sunday: no check-in at all.\n\nArriving on the Sunday therefore means having nowhere to check in, so plan to reach Boom by Saturday.",
    tags: ["dreamville", "planning"],
    related: ["the-gathering", "festival-opening-hours"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/opening-hours/",
      title: "Tomorrowland Belgium — opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "the-gathering",
    edition: "belgium",
    question: "What is The Gathering?",
    answer:
      "It is the Thursday opening party inside DreamVille, open to DreamVille guests only, and it runs in both weekends from 13:30 until 00:00.\n\nYou need a DreamVille package to attend, because The Gathering is part of DreamVille rather than the festival site. If you arrive on the Thursday, the party starts the same afternoon as check-in.",
    tags: ["dreamville", "festival"],
    related: ["dreamville-check-in-and-check-out"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/opening-hours/",
      title: "Tomorrowland Belgium — opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "how-many-tickets-per-account",
    edition: "belgium",
    question: "How many tickets can I buy?",
    answer:
      "Four people per Tomorrowland Account. The cap is cumulated across all sale moments rather than applied per order, so buying two in the pre-sale leaves two for the general sale.\n\nTwo exceptions sit alongside it:\n\n- Friendship Garden packages are exempt from the four-person cap.\n- Global Journey packages allow six people per account.\n\nDuring the NFT sale the cap tightens to two people per account.",
    tags: ["tickets", "sales"],
    related: ["pre-registration", "exchange-desk-window"],
    source: {
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "pre-registration",
    edition: "belgium",
    question: "Do I have to pre-register for the 2027 sale?",
    answer:
      "Yes. Pre-registration opens on 2 December 2026 at 15:00 CET and closes on 12 February 2027 at 15:00 CET.\n\nRegistering is mandatory before you can enter any sale, and it does not guarantee a ticket. Treat it as the entry requirement for the sale rather than a reservation.",
    tags: ["tickets", "sales"],
    related: ["sale-dates-2027", "how-many-tickets-per-account"],
    source: {
      url: "https://faq.tomorrowland.com/hc/en-us/articles/43968145412372-What-is-Pre-Registration",
      title: "What is Pre-Registration",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "sale-dates-2027",
    edition: "belgium",
    question: "When do 2027 tickets go on sale?",
    answer:
      "There are three sale moments, all at 17:00 CET:\n\n- Saturday 30 January 2027: Global Journey travel packages.\n- Saturday 6 February 2027: the WorldWide Pre-Sale, for tickets and DreamVille packages.\n- Saturday 13 February 2027: the WorldWide Ticket Sale, for tickets and DreamVille packages.\n\nThere is no separate Belgian-only sale and no separately dated Friends sale in the 2027 cycle. Everyone who pre-registered can join all three moments.",
    tags: ["tickets", "sales", "planning"],
    related: ["pre-registration", "how-many-tickets-per-account"],
    source: {
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037219532-What-is-the-difference-between-the-different-sales-moments",
      title: "What is the difference between the different sales moments",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "exchange-desk-window",
    edition: "belgium",
    question: "When does the Exchange Desk open and close?",
    answer:
      "It opens on 13 February 2027 and closes on 29 April 2027. Tickets cannot be cancelled, and all purchases are final.\n\nTwo official pages quote different closing times, 12:00 and 23:59 CEST, so aim to be finished well before midday on 29 April rather than relying on the later figure. What listing actually does is covered in the next answer.",
    tags: ["tickets", "safety"],
    related: ["exchange-desk-fee", "global-journey-and-the-exchange-desk"],
    source: {
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588571-Can-I-cancel-or-resell-my-tickets",
      title: "Can I cancel or resell my tickets",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "exchange-desk-fee",
    edition: "belgium",
    question: "What does listing on the Exchange Desk cost, and can I undo it?",
    answer:
      "A listing is final and cannot be undone, and a €10 fee per ticket is deducted from the refund.\n\nThe refund is processed within eight weeks of the sale. Listing is also not a sale: nobody is obliged to buy the ticket, so an unsold listing returns nothing at all. Because a ticket cannot be cancelled once bought, the Exchange Desk is the only route back out, which is why the fee is worth weighing before you commit.",
    tags: ["tickets", "money"],
    related: ["exchange-desk-window", "global-journey-and-the-exchange-desk"],
    source: {
      url: "https://belgium.tomorrowland.com/en/sales-info/exchange-desk/",
      title: "Tomorrowland Belgium — Exchange Desk",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "global-journey-and-the-exchange-desk",
    edition: "belgium",
    question: "Can I resell a Global Journey package on the Exchange Desk?",
    answer:
      "No. The Exchange Desk is not available for Global Journey packages at all, so there is no listing route for one.\n\nA Global Journey package therefore needs to be treated as a committed purchase rather than something to trade later. If you may need to cancel, check the package's own cancellation conditions before you buy.",
    tags: ["tickets", "transport", "safety"],
    related: ["global-journey-explained", "exchange-desk-window"],
    source: {
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037811911-Can-I-resell-my-tickets-at-the-online-Exchange-Desk",
      title: "Can I resell my tickets at the online Exchange Desk",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "official-sales-channels",
    edition: "belgium",
    question: "Which websites sell Tomorrowland tickets officially?",
    answer:
      "There are three official routes and no others:\n\n- The Paylogic ticket shop, reached through my.tomorrowland.com.\n- The Official Travel Shop, also through my.tomorrowland.com, for Global Journey packages.\n- Official External Travel Partners, listed on the Tomorrowland site by country and region.\n\nIf a site is not one of those three, it is a secondary-market seller, however official it looks.",
    tags: ["tickets", "safety"],
    related: ["secondary-marketplaces-not-official", "exchange-desk-window"],
    source: {
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037586711-What-are-the-Official-Sales-Channels",
      title: "What are the Official Sales Channels",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "secondary-marketplaces-not-official",
    edition: "belgium",
    question: "Is TicketSwap an official resale partner?",
    answer:
      "No. Tomorrowland's own guidance is not to buy tickets through the secondary market, and nothing on the official ticket-channel page lists a marketplace as authorised.\n\nTickets that have been resold illegitimately are cancelled, so a cheap ticket from a marketplace can end up as a bracelet refused at the gate. The only official resale route is the Exchange Desk inside the main buyer's Tomorrowland Account.",
    tags: ["tickets", "safety"],
    related: ["official-sales-channels", "exchange-desk-window"],
    source: {
      url: "https://belgium.tomorrowland.com/en/sales-info/official-ticket-channels/",
      title: "Tomorrowland Belgium — official ticket channels",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "changing-the-name-on-a-ticket",
    edition: "belgium",
    question: "Can I change the name on my ticket?",
    answer:
      "No. Once a ticket or bracelet carries a registered name, that name cannot be changed, and access may be refused if it does not match your ID.\n\nA valid identity card, passport or driving licence is accepted. Copies and mandates are not. Global Journey bookings have a separate, narrower exception, which is covered in its own answer.",
    tags: ["tickets", "rules"],
    related: ["global-journey-name-changes", "minimum-age"],
    source: {
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588511-Can-I-enter-if-the-registered-name-on-the-Bracelet-is-not-my-own",
      title: "Can I enter if the registered name on the Bracelet is not my own",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "global-journey-name-changes",
    edition: "belgium",
    question: "Can I change a name on a Global Journey package?",
    answer:
      "Only in urgent cases, and only until 29 April 2027 at 23:59 CEST. The fee is €350 per name.\n\nThat deadline is the same date as the Exchange Desk closing, which is deliberate: after it, the booking is locked. Ordinary tickets have no equivalent route at all.",
    tags: ["tickets", "rules", "transport"],
    related: ["changing-the-name-on-a-ticket", "global-journey-explained"],
    source: {
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "minimum-age",
    edition: "belgium",
    question: "Is there a minimum age?",
    answer:
      "Yes. You must be at least 18 before the festival starts. The rule sits in Tomorrowland's festival policies rather than in the ticket FAQ, and it is enforced at the entrance with ID.",
    tags: ["rules", "tickets"],
    related: ["changing-the-name-on-a-ticket"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/policies/",
      title: "Tomorrowland Belgium — festival policies",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "is-the-festival-cashless",
    edition: "belgium",
    question: "Is the festival cashless?",
    answer:
      "Yes. Tomorrowland describes the bracelet as your only payment method for food and drinks, so both the festival site and DreamVille run on Pearls loaded onto it.\n\nThat makes topping up before you travel the sensible default, and it means a lost or unactivated bracelet is a payment problem as well as an entry problem.",
    tags: ["money", "pearls"],
    related: ["how-to-top-up-pearls", "pearl-refunds-and-fees"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/facilities/",
      title: "Tomorrowland Belgium — facilities",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "how-to-top-up-pearls",
    edition: "belgium",
    question: "How do I top up Pearls?",
    answer:
      "Activate the bracelet first and link it to your Tomorrowland Account; top-ups do not work before that.\n\nYou can then add Pearls online through your account using Visa, Mastercard, Bancontact, iDeal, Google Pay or Apple Pay.",
    tags: ["money", "pearls"],
    related: ["is-the-festival-cashless", "pearl-refunds-and-fees", "pearl-value-for-2027"],
    source: {
      url: "https://belgium.tomorrowland.com/en/my-bracelet/top-up/",
      title: "Tomorrowland Belgium — top up your bracelet",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "pearl-refunds-and-fees",
    edition: "belgium",
    question: "Do I get unspent Pearls back?",
    answer:
      "Yes, with two conditions.\n\n- If your first top-up was online, unspent Pearls are refunded automatically after the festival.\n- If your first top-up was on site, you must fill in the manual refund form in your Tomorrowland Account after the festival.\n\nA flat fee of two Pearls is charged per refund, and bonus Pearls are excluded from refunds. Pearls are also valid only for the weekend you bought them for, so a Weekend 1 balance cannot be carried into Weekend 2 or transferred to anyone else.",
    tags: ["money", "pearls"],
    related: ["how-to-top-up-pearls", "pearl-value-for-2027"],
    source: {
      url: "https://belgium.tomorrowland.com/en/my-bracelet/cashless-information/",
      title: "Tomorrowland Belgium — cashless information",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "pearl-value-for-2027",
    edition: "belgium",
    question: "How much is one Pearl worth in 2027?",
    answer:
      "Not published yet. Tomorrowland states that the value of one Pearl will be made available as soon as Pearls can be bought, and the bracelet page puts that at around June before the festival.\n\nAny euro value quoted for 2027 before that page publishes one is unconfirmed. The confirmed rates from earlier editions, kept only as a sense of scale, are in a separate answer.",
    tags: ["money", "pearls"],
    related: ["how-to-top-up-pearls", "pearl-refunds-and-fees"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/your-tomorrowland-bracelet/",
      title: "Tomorrowland Belgium — your Tomorrowland bracelet",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "historic-pearl-rates",
    edition: "belgium",
    question: "What did a Pearl cost in previous years?",
    answer:
      "€1.82 in 2025, when €20 bought 11 Pearls, and €1.90 in 2026, when €20 bought 10.5.\n\nThese are historical figures, not a 2027 price, and they are useful mainly as a scale: the rate has risen from one edition to the next, so a 2027 budget built on the 2026 figure will probably come up short.",
    tags: ["money", "pearls"],
    related: ["pearl-value-for-2027", "how-to-top-up-pearls"],
    source: {
      url: "https://belgium.tomorrowland.com/en/my-bracelet/cashless-information/",
      title: "Tomorrowland Belgium — cashless information, 2025 and 2026 archive",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "reusable-cup-deposit",
    edition: "belgium",
    question: "Do I have to pay a deposit on cups?",
    answer:
      "Yes, one Pearl per reusable cup. You get it back by returning the cup to a Cup Return station rather than leaving it on a table or dropping it in a bin.",
    tags: ["money", "pearls", "festival"],
    related: ["is-the-festival-cashless"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/reusable-cups/",
      title: "Tomorrowland Belgium — reusable cups",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "bringing-food-and-drink",
    edition: "belgium",
    question: "Can I bring my own food and drink?",
    answer:
      "Into DreamVille, yes. Onto the festival site, no: your own food and drinks are on the festival's prohibited list.\n\nGlass is banned in both places. The one qualification is perfume and deodorant, which are allowed up to 100 ml; larger bottles count as glass and are refused.\n\nGas installations over 500 g are banned in DreamVille and cooking is only allowed at the dedicated public barbecue areas. Campers and caravans are not allowed in or at DreamVille at all.",
    tags: ["rules", "dreamville", "festival"],
    related: ["what-is-banned-on-site"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/forbidden-objects/",
      title: "Tomorrowland Belgium — forbidden objects",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "what-is-banned-on-site",
    edition: "belgium",
    question: "What is banned at the festival and at DreamVille?",
    answer:
      "The two lists differ slightly, but the main prohibitions are:\n\n- Drugs, other than prescribed medication presented with a medical certificate.\n- Your own food and drinks on the festival site.\n- Glass, including perfume and deodorant bottles over 100 ml.\n- Sticks, which covers the selfie sticks and totems people often ask about.\n- Plastic bottles and cans on the festival site.\n- Campers and caravans in or at DreamVille, and gas installations over 500 g.\n\nCarry the medical certificate for any prescription medicine. It is checked at the entrance and there is no workaround on the day.",
    tags: ["rules", "safety"],
    related: ["bringing-food-and-drink", "minimum-age"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/forbidden-objects/",
      title: "Tomorrowland Belgium — forbidden objects",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "montagoe-area-facilities",
    edition: "belgium",
    question: "What do Montagoe guests get in their area?",
    answer:
      "The Montagoe area has a restaurant, a bar, a swimming pool and a lobby crew on duty 24 hours a day. Its sanitary facilities are open at all times and free of charge, which is the main difference from the paid covered showers elsewhere in DreamVille.",
    tags: ["dreamville", "accommodation"],
    related: ["showers-and-toilets", "global-journey-explained"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/montagoe-area/",
      title: "Tomorrowland Belgium — Montagoe area",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "montagoe-parking",
    edition: "belgium",
    question: "Is parking included with Montagoe accommodation?",
    answer:
      "Yes, with one exception. Every Montagoe page lists a parking voucher among the inclusions, and every one of those pages adds that parking is not included in Global Journey packages.\n\nSo if you buy a Montagoe unit through the normal sale, parking comes with it. If you buy through Global Journey, it does not, because travel is provided instead.",
    tags: ["accommodation", "parking", "dreamville"],
    related: ["montagoe-area-facilities", "driving-and-parking"],
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/montagoe/relax-room-2p-packages/",
      title: "Tomorrowland Belgium — Relax Room 2P package",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "getting-to-the-site-by-train",
    edition: "belgium",
    question: "How do I get to the festival by train?",
    answer:
      "Take the train to Boom station and walk. The official 2026 guidance puts the walk from Boom station to the festival site at 20 minutes.\n\nA free shuttle also runs between Boom station and DreamVille, but only inbound on Thursday and Friday, with the return on Monday. There is no Saturday inbound shuttle and none on Sunday.\n\nAfter the music ends, extra night trains run only to Antwerpen-Centraal and offer no connection onward to other cities, so the last leg to Brussels or anywhere else is yours to arrange. Boarding without a ticket carries a €90 fine.",
    tags: ["transport", "planning"],
    related: ["discounted-train-tickets", "airport-shuttles"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/how-to-get-there/",
      title: "Tomorrowland Belgium — how to get there",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "discounted-train-tickets",
    edition: "belgium",
    question: "Is there a discount on the train to Boom?",
    answer:
      "Yes, through Belgian rail. The discount is 40% on a return journey, and the codes sit in the main buyer's Tomorrowland Account.\n\nOne code is issued per Day Pass or DreamVille package, and three per Full Madness Pass. Global Journey buyers are excluded because travel is already part of their package.",
    tags: ["transport", "tickets"],
    related: ["getting-to-the-site-by-train"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/how-to-get-there/",
      title: "Tomorrowland Belgium — how to get there",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "airport-shuttles",
    edition: "belgium",
    question: "Are there shuttles from the airports?",
    answer:
      "Yes, from three airports: Brussels Airport, Brussels South Charleroi and Eindhoven. They run to DreamVille on the Thursday and back on the Monday.\n\nTomorrowland does not publish the fares on its practical pages, and the 2027 sale has not opened, so treat any price you see quoted for these routes as unconfirmed. The city shuttles are a separate product: they run from stops in several Belgian and Dutch cities and drop passengers close to the Main Entrance rather than at DreamVille.",
    tags: ["transport", "dreamville"],
    related: ["getting-to-the-site-by-train", "driving-and-parking"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/how-to-get-there/",
      title: "Tomorrowland Belgium — how to get there",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "driving-and-parking",
    edition: "belgium",
    question: "Can I drive, and where do I park?",
    answer:
      "You can drive, and the site is signposted into separate festival and DreamVille car parks.\n\nThree points matter more than the route:\n\n- Parking vouchers are sold in the Add-On Sale. Tomorrowland does not publish 2027 prices on its practical pages.\n- There are no charging facilities in the car parks, so arrive with a full battery if you drive an electric car.\n- The Kiss & Ride zone is for dropping off and picking up only. Parking there is not allowed, and pre-booked Uber and Bolt cars wait there with limited space.\n\nFree, supervised bicycle parking is available near the festival main entrance and near DreamVille Entrance 1, and the free Park & Bike scheme lets you leave the car in a remote car park and cycle in.",
    tags: ["transport", "parking"],
    related: ["airport-shuttles", "getting-to-the-site-by-train"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/how-to-get-there/",
      title: "Tomorrowland Belgium — how to get there",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "lockers-and-storage",
    edition: "belgium",
    question: "Are there lockers?",
    answer:
      "Yes, at both the festival site and DreamVille, in several sizes, and the voucher is bought in advance through the Add-On Sale.\n\nTomorrowland states that more detail, including the price table, will appear on the locker add-on page later, so no 2027 prices or dimensions are confirmed yet. A DreamVille locker and a festival locker are not interchangeable, because the two sites keep different opening hours.",
    tags: ["practical", "dreamville"],
    related: ["is-the-festival-cashless"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/facilities/",
      title: "Tomorrowland Belgium — facilities",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "showers-and-toilets",
    edition: "belgium",
    question: "Are showers free in Magnificent Greens?",
    answer:
      "Yes. The open-air showers there are available at any time and cost nothing, as do the sinks and toilets.\n\nCovered showers are the paid option in this area. Tomorrowland does not publish their price or timetable on the area page, so any figure quoted for them is unconfirmed.",
    tags: ["dreamville", "practical"],
    related: ["dreamville-check-in-and-check-out"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/magnificent-greens-area/",
      title: "Tomorrowland Belgium — Magnificent Greens area",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "global-journey-explained",
    edition: "belgium",
    question: "What is Global Journey?",
    answer:
      "It is Tomorrowland's own travel-package sale: a festival pass combined with transport and/or accommodation, sold in its own sale before the general ones. For 2027 that sale is Saturday 30 January at 17:00 CET.\n\nThe cap is different from a normal ticket: six people per account rather than four, and two during the NFT Global Journey sale. The Exchange Desk does not apply to these packages, which is covered in its own answer.",
    tags: ["tickets", "transport", "sales"],
    related: ["sale-dates-2027", "global-journey-and-the-exchange-desk", "global-journey-name-changes"],
    source: {
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "ticket-types-explained",
    edition: "belgium",
    question: "What is the difference between Regular, Pleasure and Comfort tickets?",
    answer:
      "A Regular ticket gives general festival access. The two upgrades both add Comfort areas, and the difference is which ones:\n\n- Pleasure covers every Comfort area except the MainStage Comfort area.\n- Comfort covers the MainStage, the Great Library and Freedom.\n\nSo Pleasure is the cheaper middle tier, and Comfort is the one that includes the MainStage area. Neither changes your access to the festival itself.",
    tags: ["tickets"],
    related: ["how-many-tickets-per-account"],
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
      title: "Tomorrowland Belgium — day passes",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "dreamville-entrances",
    edition: "belgium",
    question: "Where are the DreamVille entrances?",
    answer:
      "There are two. Entrance 1 is at Nachtegaalstraat, 2850 Boom. Entrance 2 serves Magnificent Greens and is at Rumstsestraat, 2840 Rumst.\n\nThe addresses matter for a taxi or a friend collecting you, because the two entrances sit in different municipalities: Boom and Rumst.",
    tags: ["dreamville", "transport"],
    related: ["dreamville-check-in-and-check-out"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/how-to-get-there/",
      title: "Tomorrowland Belgium — how to get there",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "dreamville-marketplace",
    edition: "belgium",
    question: "What is at the DreamVille Marketplace?",
    answer:
      "Tomorrowland lists a mini-supermarket, a hair salon, a bakery, a phone repair and SIM service, and the official Camping Store, among other things.\n\nThe Camping Store is the place to buy tents, sleeping bags and air mattresses if your gear did not survive the journey. Tomorrowland does not publish a brand name for the supermarket or a price list for the store, so neither is quoted here.",
    tags: ["dreamville", "practical"],
    related: ["dreamville-entrances", "bringing-food-and-drink"],
    source: {
      url: "https://belgium.tomorrowland.com/en/practical/discover-dreamville/the-marketplace/",
      title: "Tomorrowland Belgium — the Marketplace",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "easy-tent-lock",
    edition: "belgium",
    question: "Do Easy Tents come with a lock?",
    answer:
      "Yes. A lock for the tent is part of the Easy Tent 2P package, so you do not need to bring one or buy a padlock on site.\n\nThat covers the tent itself, not your valuables, so a separate locker is still worth considering for passports and electronics.",
    tags: ["accommodation", "dreamville"],
    related: ["lockers-and-storage"],
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/accommodations/easy-tent/easy-tent-packages/easy-tent-2p-packages/",
      title: "Tomorrowland Belgium — Easy Tent 2P package",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "when-the-line-up-is-announced",
    edition: "belgium",
    question: "When is the 2027 line-up announced?",
    answer:
      "Not yet. Tomorrowland states that the full Belgium 2027 line-up will be revealed at a later stage, so in November 2026 there is nothing official to plan around. Ticket sales open before the line-up, which is normal for this festival.",
    tags: ["line-up", "planning"],
    related: ["pre-registration", "sale-dates-2027"],
    source: {
      url: "https://belgium.tomorrowland.com/en/line-up/",
      title: "Tomorrowland Belgium — line-up",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
];
