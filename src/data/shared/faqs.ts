/**
 * General FAQs that apply wherever the reader is, verified against official
 * pages.
 *
 * The shared `faqSchema` is reused unchanged, so each entry carries a source, a
 * verification date and a confidence level, and unknown keys are rejected.
 *
 * Two deliberate gaps, both listed in `docs/data/brasil-shared-omissions.md`:
 * - No Pearl-to-euro rate is stated. The 2027 value is published only when
 *   top-ups open, and the 2026 article sits behind a sign-in wall, so no figure
 *   here could be re-confirmed on 2026-11-18.
 * - No NFT ticket guarantee is stated. The guaranteed-four-tickets wording on the
 *   official FAQ dates from the 2024 sale, and the newer per-Medallion claims
 *   rest on fan guides only.
 */
import { type Source } from "../schemas";
import { faqSchema, type Faq } from "../schemas/faq";

const VERIFIED_ON = "2026-11-18";

const RE_ENTRY_ARTICLE: Source = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037215812-Can-I-re-enter-the-festival",
  title: "Can I re-enter the festival?",
  retrievedOn: VERIFIED_ON,
};

const OPENING_HOURS_ARTICLE: Source = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037582731-What-are-the-opening-hours-of-the-festival-site",
  title: "What are the opening hours of the festival site?",
  retrievedOn: VERIFIED_ON,
};

const NAME_ON_BRACELET_ARTICLE: Source = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588511-Can-I-enter-if-the-registered-name-on-the-Bracelet-is-not-my-own",
  title: "Can I enter if the registered name on the bracelet is not my own?",
  retrievedOn: VERIFIED_ON,
};

const OFFICIAL_CHANNELS_ARTICLE: Source = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037586711-What-are-the-Official-Sales-Channels",
  title: "What are the official sales channels?",
  retrievedOn: VERIFIED_ON,
};

const RESALE_ARTICLE: Source = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037588571-Can-I-cancel-or-resell-my-tickets",
  title: "Can I cancel or resell my tickets?",
  retrievedOn: VERIFIED_ON,
};

const EXCHANGE_DESK_ARTICLE: Source = {
  url: "https://faq.tomorrowland.com/hc/en-us/articles/360037811911-Can-I-resell-my-tickets-at-the-online-Exchange-Desk",
  title: "Can I resell my tickets at the online Exchange Desk?",
  retrievedOn: VERIFIED_ON,
};

const HOW_TO_ORDER: Source = {
  url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
  title: "How to order — ticket cap, Exchange Desk fee and name changes",
  retrievedOn: VERIFIED_ON,
};

const CASH_TERMS: Source = {
  url: "https://belgium.tomorrowland.com/en/my-bracelet/cashless-general-terms-conditions/",
  title: "Cashless general terms and conditions",
  retrievedOn: VERIFIED_ON,
};

const BRACELET_PAGE: Source = {
  url: "https://belgium.tomorrowland.com/en/practical/your-tomorrowland-bracelet/",
  title: "Your Tomorrowland bracelet",
  retrievedOn: VERIFIED_ON,
};

const FACILITIES_PAGE: Source = {
  url: "https://belgium.tomorrowland.com/en/practical/facilities/",
  title: "Facilities at the festival",
  retrievedOn: VERIFIED_ON,
};

const NFT_SITE: Source = {
  url: "https://nft.tomorrowland.com/",
  title: "Tomorrowland NFT — official site",
  retrievedOn: VERIFIED_ON,
};

const NFT_FAQ: Source = {
  url: "https://nft.tomorrowland.com/faq",
  title: "Tomorrowland NFT — frequently asked questions",
  retrievedOn: VERIFIED_ON,
};

const NFT_MEDALLION_SALES: Source = {
  url: "https://nft.tomorrowland.com/medallion-sales",
  title: "Tomorrowland NFT — Medallion sales",
  retrievedOn: VERIFIED_ON,
};

/** The confirmed general questions. */
export const generalFaqs: readonly Faq[] = [
  {
    id: "re-entry",
    edition: "all",
    question: "Can I leave the festival and come back in the same day?",
    answer:
      "No. Leaving ends your day: after you leave Tomorrowland you cannot re-enter on the same day, even with a three-day bracelet. Tomorrowland states the rule in capitals, **OUT = OUT**, and gives safety as the reason.\n\nWhat does work:\n\n- A Full Madness pass lets you return on the following day, never the same day.\n- A Day Pass includes no re-entry at all; you would need a new ticket.\n- DreamVille guests can cross between campsite and festival within set windows: back into DreamVille from the festival site from 17:00, and back into Tomorrowland from DreamVille until two hours before the site closes.\n\nPlan the day as one continuous visit, and carry everything you need for the whole session.",
    tags: ["entry", "practical", "bracelet"],
    related: ["wristband-id", "bracelet-hours"],
    source: RE_ENTRY_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "bracelet-hours",
    edition: "all",
    question: "What are the festival and DreamVille opening hours?",
    answer:
      "For the Belgium edition the site opens at 12:00 on all three days and closes at 01:00 on Friday and Saturday and 00:00 on Sunday. Last entry is 22:00 on Friday and Saturday and 21:00 on Sunday; after that, access is refused.\n\nDreamVille runs continuously from Thursday 11:00 to Monday 12:00, with no exceptions on check-out. Check-in is open from 11:00 at both entrances on Thursday, around the clock on Friday, until 12:00 on Saturday at both entrances and then at DreamVille Entrance 1 only, and not at all on Sunday.\n\nHours are set per edition, so check the edition you are attending before you rely on these times.",
    tags: ["entry", "dreamville", "practical"],
    related: ["re-entry", "wristband-id"],
    source: OPENING_HOURS_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "wristband-id",
    edition: "all",
    question: "Does the name on my ticket or bracelet have to match my ID?",
    answer:
      "Yes. If the name on the bracelet or ticket does not match the ID you present, access can be refused. Accepted ID is an identity card, a passport or a driving licence; copies and signed mandates are not accepted.\n\nPersonalisation is the point of no return. Once a ticket is personalised the name cannot be changed, which is why a ticket bought second-hand cannot be repaired later and why the Exchange Desk exists.",
    tags: ["bracelet", "entry", "tickets"],
    related: ["re-entry", "resale-exchange-desk"],
    source: NAME_ON_BRACELET_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "official-sales-channels",
    edition: "all",
    question: "Where can I legitimately buy tickets?",
    answer:
      "There are three official channels: the Paylogic ticket shop reached through your Tomorrowland Account, the Official Travel Shop for Global Journey packages, again through your account, and Official External Travel Partners.\n\nNothing else is official. Tomorrowland asks buyers to order only through these channels, and any other site selling a ticket is a reseller taking a risk with your money.",
    tags: ["tickets", "safety"],
    related: ["resale-exchange-desk", "wristband-id"],
    source: OFFICIAL_CHANNELS_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "resale-exchange-desk",
    edition: "all",
    question: "Is TicketSwap the official resale platform?",
    answer:
      "No. The Exchange Desk is the only official way to offer a ticket for resale, and it sits inside the main buyer's Tomorrowland Account. TicketSwap, Viagogo, StubHub and similar marketplaces are not official channels; a search of the official help centre returns nothing for TicketSwap at all.\n\nTickets themselves cannot be cancelled, and all purchases are final, so buying from an unofficial seller leaves you with no route back.",
    tags: ["tickets", "resale", "safety"],
    related: ["official-sales-channels", "wristband-id", "exchange-desk-timing"],
    source: RESALE_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "exchange-desk-timing",
    edition: "all",
    question: "When does the Exchange Desk open and close?",
    answer:
      "For Belgium 2027 the Exchange Desk opens on 13 February 2027, the day of the general sale, and closes on 29 April 2027. Two official pages quote different clock times for the closing moment, 12:00 and 23:59 CEST, so treat the date as firm and the time as approximate.\n\nListing is not a sale: registering a ticket does not guarantee that anyone buys it, and a listing cannot be undone. A €10 fee per ticket is deducted from the refund, which is processed within eight weeks of the sale.",
    tags: ["tickets", "resale"],
    related: ["resale-exchange-desk", "exchange-desk-fee"],
    source: RESALE_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "exchange-desk-fee",
    edition: "all",
    question: "What does it cost to resell, and can I change the name on a ticket?",
    answer:
      "The Exchange Desk charges a €10 fee per ticket, deducted from the refund, and the refund is processed within eight weeks of the sale. Listing is final.\n\nName changes are not permitted on ordinary tickets at all. Global Journey is the exception: an urgent case can be changed until 29 April 2027 at €350 per name.",
    tags: ["tickets", "resale", "names"],
    related: ["exchange-desk-timing", "resale-exchange-desk", "global-journey-refunds"],
    source: HOW_TO_ORDER,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "global-journey-refunds",
    edition: "all",
    question: "Can I resell a Global Journey package on the Exchange Desk?",
    answer:
      "No. The Exchange Desk is not available for Global Journey packages at all, so a travel package cannot be listed there even though an ordinary ticket can.\n\nA Global Journey booking is refundable only under the published cancellation conditions. Changes of transport, accommodation or ticket type are impossible once the booking is made, so check the package carefully before you pay.",
    tags: ["tickets", "resale", "global-journey"],
    related: ["resale-exchange-desk", "exchange-desk-fee"],
    source: EXCHANGE_DESK_ARTICLE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "pearls",
    edition: "all",
    question: "What are Pearls?",
    answer:
      "Pearls are the festival's own currency. The site is fully cashless: you load Pearls onto your bracelet, and the bracelet is the only way to pay for food and drinks. Top-ups are made online through your Tomorrowland Account before the festival, or at top-up booths on site.\n\nBonus Pearls and pre-loaded Pearls are not refundable. Unspent Pearls from an online top-up are refunded automatically. Any manual refund is capped by a published deadline and can take up to six weeks to process, and refunds are subject to a fee.\n\n**The euro value of a Pearl is not published here.** Tomorrowland publishes the rate only once Pearls can be bought, which for a July festival means around June, and states the value in the cashless terms as something made available at that point. Check the official rate page for your edition before budgeting.",
    tags: ["pearls", "cashless", "budget"],
    related: [],
    source: CASH_TERMS,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "pearls-rate-timing",
    edition: "all",
    question: "When is the Pearl exchange rate announced?",
    answer:
      "The rate is published shortly before Pearls go on sale. The bracelet page says more information will be available around June ahead of a July festival, and the cashless terms say the value of one Pearl is made available to the visitor as soon as Pearls can be purchased.\n\nThat means there is no confirmed rate for the 2027 edition at the time of writing. Any guide quoting a firm figure for 2027 is quoting an older edition's rate.",
    tags: ["pearls", "cashless", "budget"],
    related: ["pearls"],
    source: BRACELET_PAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "pearls-acceptance",
    edition: "all",
    question: "Do I need Pearls for everything on site?",
    answer:
      "For food and drink, yes. The bracelet is your only payment method for food and drinks across the festival site and DreamVille, so a card or cash is not a fallback at the bars.\n\nTop-ups themselves can be made several ways: online through your Tomorrowland Account before you travel, or at top-up booths on site.\n\nCarry a card for anything outside the cashless system, and load Pearls before the festival so you are not queueing at a booth when the site is busy.",
    tags: ["pearls", "cashless", "practical"],
    related: ["pearls", "pearls-rate-timing"],
    source: FACILITIES_PAGE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "nft-collections",
    edition: "all",
    question: "What are the Tomorrowland NFT collections?",
    answer:
      "There are three: **A Letter from the Universe**, **The Reflection of Love** and **The Symbol of Love and Unity**. They run on Solana, so they are held in a Solana wallet and bought with SOL.\n\nThe first two are also labelled by edition year on the marketing pages, as the Tomorrowland Winter 2022 collection and the Tomorrowland Belgium 2022 collection; the collection names themselves are the three above. The official launch took place on Magic Eden's launchpad on 15 July 2022.",
    tags: ["nft"],
    related: ["nft-medallion", "nft-wallet-safety"],
    source: NFT_FAQ,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "nft-medallion",
    edition: "all",
    question: "What is the Medallion of Memoria?",
    answer:
      "The Medallion is a holder status, not a token. You earn it by holding at least one NFT from each of the three collections in a single wallet. Tomorrowland states plainly that there is no Medallion NFT, so anything called a Medallion that appears in your wallet is not official.\n\nThe status brings access to an NFT-holder pre-sale. Access is not automatic: you pre-register for each sale, and a snapshot checks that the qualifying NFTs are still in the wallet when the snapshot is taken. Miss the snapshot and you cannot buy in that sale.",
    tags: ["nft"],
    related: ["nft-collections", "nft-portal-status", "nft-wallet-safety"],
    source: NFT_FAQ,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "nft-portal-status",
    edition: "all",
    question: "Why does the Medallion portal show nothing for my wallet?",
    answer:
      "The Medallion sales page on the NFT website is a placeholder. It carries a notice saying it will soon be updated with fresh information, so a wallet that should qualify can show an empty or zero count without anything being wrong with the NFTs.\n\nLive communication runs through the official Discord, and verification through Matrica. Check your holdings there rather than trusting the portal figure.",
    tags: ["nft"],
    related: ["nft-medallion", "nft-wallet-safety"],
    source: NFT_MEDALLION_SALES,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
  {
    id: "nft-wallet-safety",
    edition: "all",
    question: "How do I keep an NFT holding valid, and what scams should I watch for?",
    answer:
      "Keep the NFTs in the wallet, with no active marketplace listing, between registration and the sale: an active sale listing removes the holder role just as transferring the token out does. Verification runs through Matrica, Tomorrowland's named partner, and support is handled through ticket channels in the official Discord, at tomorrow.land/discord.\n\nA scam token named **Medallion of Memoria** has been airdropped to wallets. It is not official; do not click the link in its description. Send it to the trash wallet `tmltrash.sol` (address `CxjMGSjrvNLKUj441mADACP7Nu7p79DYvkGQEAZDJfMA`) or burn it.\n\nNever buy or verify through a platform other than Matrica and a reputable Solana marketplace.",
    tags: ["nft", "safety"],
    related: ["nft-medallion", "nft-collections"],
    source: NFT_SITE,
    lastVerified: VERIFIED_ON,
    confidence: "official",
  },
];

/** Parses every FAQ entry, so a malformed one fails at import time. */
export const validatedGeneralFaqs: readonly Faq[] = generalFaqs.map((entry) =>
  faqSchema.parse(entry),
);

export const faqCollections = { general: validatedGeneralFaqs } as const;
