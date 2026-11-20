import { z } from "zod";

/**
 * The packing catalogue.
 *
 * Three rules govern every entry here, and the schema enforces two of them:
 *
 * 1. An `official` item must trace to a page that is already in this repo's
 *    data or guide content, and it carries that page's URL and the date the
 *    page was checked. `packing-catalogue.test.ts` asserts that both values are
 *    present in the underlying record, so an entry cannot cite a page the rest
 *    of the site does not already rely on.
 * 2. A `suggestion` is ordinary travel common sense, is labelled as such in the
 *    interface, and may not carry a rule or a citation. Nothing here presents a
 *    suggestion as a requirement.
 * 3. Nothing states a quantity, a bag size, a fee or a banned item unless the
 *    source data states it. Where the data says a figure is not published, it is
 *    quoted as unpublished rather than filled in.
 *
 * The catalogue is plain data so it can be imported by the client component,
 * reviewed in a diff, and tested without a browser.
 */

/* -------------------------------------------------------------------------- */
/* Editions and stays                                                          */
/* -------------------------------------------------------------------------- */

export const packingEditionSchema = z.enum(["belgium", "winter", "brasil"], {
  error: 'edition must be "belgium", "winter" or "brasil"',
});
export type PackingEdition = z.infer<typeof packingEditionSchema>;

export const PACKING_EDITIONS: readonly PackingEdition[] = packingEditionSchema.options;

/**
 * Which kind of stay the reader has booked. A stay is edition-specific because
 * the answers are: a Belgium campsite and a Winter resort have nothing in
 * common except that both involve a bed.
 */
export const packingStaySchema = z.enum(
  [
    "belgium-dreamville",
    "belgium-hotel-day",
    "winter-resort",
    "winter-outside",
    "brasil-dreamville",
    "brasil-offsite",
  ],
  {
    error:
      "stay must be one of the documented stay types (belgium-dreamville, belgium-hotel-day, winter-resort, winter-outside, brasil-dreamville, brasil-offsite)",
  },
);
export type PackingStay = z.infer<typeof packingStaySchema>;

export interface PackingStayOption {
  readonly id: PackingStay;
  readonly edition: PackingEdition;
  readonly label: string;
  /** One sentence naming what the choice changes. Shown under the group. */
  readonly hint: string;
}

export const PACKING_STAYS: readonly PackingStayOption[] = [
  {
    id: "belgium-dreamville",
    edition: "belgium",
    label: "DreamVille campsite",
    hint: "A DreamVille package, whether you pitch your own tent or buy a pre-erected one.",
  },
  {
    id: "belgium-hotel-day",
    edition: "belgium",
    label: "Hotel or day visitor",
    hint: "A bed off site, a day pass, or both. No campsite gear is listed for this choice.",
  },
  {
    id: "winter-resort",
    edition: "winter",
    label: "Alpe d'Huez resort",
    hint: "A package in the resort itself, where the main festival area is.",
  },
  {
    id: "winter-outside",
    edition: "winter",
    label: "Oz 3300 or a surrounding village",
    hint: "A bed away from the resort, which needs the paid evening service to get back.",
  },
  {
    id: "brasil-dreamville",
    edition: "brasil",
    label: "DreamVille campsite",
    hint: "A campsite package next to Parque Maeda, pitched by you or pre-pitched.",
  },
  {
    id: "brasil-offsite",
    edition: "brasil",
    label: "Staying off site",
    hint: "A hotel or a day trip, with the official shuttle or your own transport.",
  },
];

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

export const packingSectionSchema = z.enum(
  ["tickets", "money", "health", "sleeping", "campsite", "clothing", "winter-gear", "storage", "travel", "tech"],
  { error: "section must be one of the documented section ids" },
);
export type PackingSectionId = z.infer<typeof packingSectionSchema>;

/**
 * Section titles and their reading order. An edition shows only the sections it
 * has items in, so a reader never meets an empty heading.
 */
export const PACKING_SECTIONS: readonly { id: PackingSectionId; title: string }[] = [
  { id: "tickets", title: "Tickets and documents" },
  { id: "money", title: "Money and payments" },
  { id: "health", title: "Health and safety" },
  { id: "sleeping", title: "Sleeping and your room" },
  { id: "campsite", title: "At the campsite" },
  { id: "clothing", title: "Clothing" },
  { id: "winter-gear", title: "Winter gear" },
  { id: "storage", title: "Lockers and storage" },
  { id: "travel", title: "Travel and driving" },
  { id: "tech", title: "Tech" },
];

/** The exact wording used wherever a suggestion appears, so it is never softened. */
export const SUGGESTION_LABEL = "Suggestion, not an official requirement";
export const OFFICIAL_LABEL = "Official";

/* -------------------------------------------------------------------------- */
/* Items                                                                       */
/* -------------------------------------------------------------------------- */

const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "id must be a kebab-case slug" });

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "checkedOn must be YYYY-MM-DD" });

const httpsUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.username === "" && url.password === "";
    } catch {
      return false;
    }
  }, { error: "sourceUrl must be an absolute https URL without credentials" });

const itemBase = {
  id: slug,
  section: packingSectionSchema,
  label: z.string().trim().min(3).max(90),
  editions: z.array(packingEditionSchema).min(1).max(3),
  /** Absent means every stay of the listed editions. */
  stays: z.array(packingStaySchema).min(1).max(6).optional(),
};

const officialItemSchema = z.strictObject({
  ...itemBase,
  basis: z.literal("official"),
  /** What the cited page actually says, in one sentence. */
  rule: z.string().trim().min(10).max(400),
  sourceUrl: httpsUrl,
  checkedOn: isoDate,
  /** A qualification the reader needs, such as an unpublished price. */
  caveat: z.string().trim().min(1).max(240).optional(),
});

const suggestionItemSchema = z.strictObject({
  ...itemBase,
  basis: z.literal("suggestion"),
});

export const packingItemSchema = z.discriminatedUnion("basis", [
  officialItemSchema,
  suggestionItemSchema,
]);
export type PackingItem = z.infer<typeof packingItemSchema>;
export type PackingOfficialItem = Extract<PackingItem, { basis: "official" }>;

/* -------------------------------------------------------------------------- */
/* Per-edition guidance: what is banned, what is included, what is unpublished  */
/* -------------------------------------------------------------------------- */

/** A line of official guidance with the page it comes from. */
export const packingNoteSchema = z.strictObject({
  text: z.string().trim().min(3).max(300),
  sourceUrl: httpsUrl,
  checkedOn: isoDate,
});
export type PackingNote = z.infer<typeof packingNoteSchema>;

/**
 * A statement about the data rather than about the festival: something no page
 * in this repository publishes. It carries no citation because there is nothing
 * to cite, and it never asserts a value.
 */
export const packingGapSchema = z.strictObject({
  text: z.string().trim().min(3).max(300),
});
export type PackingGap = z.infer<typeof packingGapSchema>;

export const packingGuideSchema = z.strictObject({
  edition: packingEditionSchema,
  /** Shown above the checklist for this edition. */
  summary: z.string().trim().min(10).max(300),
  notAllowed: z.array(packingNoteSchema).max(12),
  /** Shown instead of the list when the data has no prohibited-items page. */
  notAllowedGap: z.string().trim().min(3).max(300).optional(),
  included: z.array(packingNoteSchema).max(12),
  unpublished: z.array(packingGapSchema).max(12),
});
export type PackingGuide = z.infer<typeof packingGuideSchema>;

/* -------------------------------------------------------------------------- */
/* Sources                                                                     */
/* -------------------------------------------------------------------------- */

/** Every page cited below, with the date it was read. */
const BE_FORBIDDEN = "https://belgium.tomorrowland.com/en/practical/forbidden-objects/";
const BE_TOP_UP = "https://belgium.tomorrowland.com/en/my-bracelet/top-up/";
const BE_FACILITIES = "https://belgium.tomorrowland.com/en/practical/facilities/";
const BE_NAME_FAQ =
  "https://faq.tomorrowland.com/hc/en-us/articles/360037588511-Can-I-enter-if-the-registered-name-on-the-Bracelet-is-not-my-own";
const BE_MG_PITCH =
  "https://belgium.tomorrowland.com/en/tickets/accommodations/magnificent-greens/magnificent-greens-1p-packages/";
const BE_GET_THERE = "https://belgium.tomorrowland.com/en/practical/how-to-get-there/";
const BE_EASY_TENT =
  "https://belgium.tomorrowland.com/en/tickets/accommodations/easy-tent/easy-tent-packages/easy-tent-2p-packages/";
const BE_MARKETPLACE =
  "https://belgium.tomorrowland.com/en/practical/discover-dreamville/the-marketplace/";
const BE_CUPS = "https://belgium.tomorrowland.com/en/practical/reusable-cups/";

const WI_TICKET = "https://winter.tomorrowland.com/en/tickets/festival-ticket/";
const WI_BRACELET = "https://winter.tomorrowland.com/en/practical/your-tomorrowland-bracelet/";
const WI_EQUIPMENT =
  "https://winter.tomorrowland.com/en/add-ons/ski-and-snowboard-equipment/";
const WI_ADDONS = "https://winter.tomorrowland.com/en/add-ons/";
const WI_LOCKERS = "https://winter.tomorrowland.com/en/add-ons/lockers/";
const WI_TRANSPORT_PASS =
  "https://winter.tomorrowland.com/en/practical/how-to-get-there/transportation-pass/";
const WI_TRANSPORT_PACKAGES =
  "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation-transport/";
const WI_TYRE_RULE = "https://www.service-public.gouv.fr/particuliers/actualites/A14389";

const BR_HALF_PRICE = "https://tomorrowlandbrasil.zendesk.com/hc/en-us/articles/13511256421780";
const BR_SHUTTLE_VOUCHER =
  "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/17510657026964";
const BR_MG_ARTICLE = "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/53208584907028";
const BR_EASY_TENT_ARTICLE =
  "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/53208964543764";
const BR_MG_PACKAGE =
  "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/magnificent-greens/";

/** Every record in `src/data` was read on this date. */
const CHECKED = "2026-11-18";

/* -------------------------------------------------------------------------- */
/* Items                                                                       */
/* -------------------------------------------------------------------------- */

export const packingCatalogue: readonly PackingItem[] = [
  /* ------------------------------- Belgium ------------------------------- */
  {
    id: "belgium-photo-id",
    section: "tickets",
    basis: "official",
    label: "Photo ID in the name on the bracelet",
    rule: "A valid identity card, passport or driving licence is accepted, and access may be refused if the name does not match. Copies and mandates are not accepted.",
    sourceUrl: BE_NAME_FAQ,
    checkedOn: CHECKED,
    editions: ["belgium"],
  },
  {
    id: "belgium-medical-certificate",
    section: "tickets",
    basis: "official",
    label: "Medical certificate for any prescribed medicine",
    rule: "Prescribed medication is the only exception to the drug prohibition. The certificate is checked at the entrance and there is no workaround on the day.",
    sourceUrl: BE_FORBIDDEN,
    checkedOn: CHECKED,
    editions: ["belgium"],
  },
  {
    id: "belgium-bracelet",
    section: "tickets",
    basis: "official",
    label: "Tomorrowland bracelet, activated and linked to your account",
    rule: "Top-ups do not work until the bracelet is activated and linked to your Tomorrowland Account, so that is done before you travel.",
    sourceUrl: BE_TOP_UP,
    checkedOn: CHECKED,
    editions: ["belgium"],
  },
  {
    id: "belgium-booking-confirmation",
    section: "tickets",
    basis: "suggestion",
    label: "Your booking confirmation, saved offline",
    editions: ["belgium"],
  },
  {
    id: "belgium-pearls",
    section: "money",
    basis: "official",
    label: "Pearls loaded onto the bracelet",
    rule: "The bracelet is the only payment method for food and drinks, on the festival site and in DreamVille.",
    sourceUrl: BE_FACILITIES,
    checkedOn: CHECKED,
    editions: ["belgium"],
  },
  {
    id: "belgium-top-up-card",
    section: "money",
    basis: "official",
    label: "A card that can top up Pearls",
    rule: "Online top-ups take Visa, Mastercard, Bancontact, iDeal, Google Pay or Apple Pay.",
    sourceUrl: BE_TOP_UP,
    checkedOn: CHECKED,
    editions: ["belgium"],
  },
  {
    id: "belgium-perfume",
    section: "health",
    basis: "official",
    label: "Perfume or deodorant in a small container",
    rule: "Glass is banned on the festival site and in DreamVille. Perfume and deodorant are the one qualification: allowed up to 100 ml, and anything larger counts as glass and is refused.",
    sourceUrl: BE_FORBIDDEN,
    checkedOn: CHECKED,
    editions: ["belgium"],
  },
  {
    id: "belgium-plasters",
    section: "health",
    basis: "suggestion",
    label: "Plasters and blister plasters",
    editions: ["belgium"],
  },
  {
    id: "belgium-sunscreen",
    section: "health",
    basis: "suggestion",
    label: "Sunscreen",
    editions: ["belgium"],
  },
  {
    id: "belgium-tent",
    section: "campsite",
    basis: "official",
    label: "Tent and bedding, if you booked a Magnificent Greens pitch",
    rule: "A Magnificent Greens pitch is pitch-your-own camping: you bring the tent, or buy a 1P or 2P tent package that includes a pop-up tent and bedding.",
    sourceUrl: BE_MG_PITCH,
    checkedOn: CHECKED,
    editions: ["belgium"],
    stays: ["belgium-dreamville"],
  },
  {
    id: "belgium-campsite-food",
    section: "campsite",
    basis: "official",
    label: "Food and drink for the campsite",
    rule: "Your own food and drink may go into DreamVille but not onto the festival site, where they are on the prohibited list.",
    sourceUrl: BE_FORBIDDEN,
    checkedOn: CHECKED,
    editions: ["belgium"],
    stays: ["belgium-dreamville"],
  },
  {
    id: "belgium-torch",
    section: "campsite",
    basis: "suggestion",
    label: "A torch or head torch",
    editions: ["belgium"],
    stays: ["belgium-dreamville"],
  },
  {
    id: "belgium-rain-jacket",
    section: "clothing",
    basis: "suggestion",
    label: "Waterproof jacket",
    editions: ["belgium"],
  },
  {
    id: "belgium-shoes",
    section: "clothing",
    basis: "suggestion",
    label: "Shoes you can walk and dance in",
    editions: ["belgium"],
  },
  {
    id: "belgium-charger",
    section: "tech",
    basis: "suggestion",
    label: "Phone charger",
    editions: ["belgium"],
  },
  {
    id: "belgium-power-bank",
    section: "tech",
    basis: "suggestion",
    label: "A charged power bank",
    editions: ["belgium"],
  },
  {
    id: "belgium-parking-voucher",
    section: "travel",
    basis: "official",
    label: "Parking voucher, if you are driving",
    rule: "Parking vouchers are sold in advance through the Add-On Sale rather than at the gate.",
    sourceUrl: BE_GET_THERE,
    checkedOn: CHECKED,
    editions: ["belgium"],
    caveat: "No 2027 parking price is published on the practical pages.",
  },
  {
    id: "belgium-ev-charge",
    section: "travel",
    basis: "official",
    label: "A full charge before you drive in, if the car is electric",
    rule: "There are no charging facilities in the festival or DreamVille car parks, so the car arrives charged.",
    sourceUrl: BE_GET_THERE,
    checkedOn: CHECKED,
    editions: ["belgium"],
  },

  /* -------------------------------- Winter ------------------------------- */
  {
    id: "winter-ticket",
    section: "tickets",
    basis: "official",
    label: "Festival ticket, which includes the lift and ski pass",
    rule: "Every Winter ticket includes a lift and ski pass, and the pass is required rather than optional: it is how the mountain stages are reached.",
    sourceUrl: WI_TICKET,
    checkedOn: CHECKED,
    editions: ["winter"],
  },
  {
    id: "winter-bracelet",
    section: "tickets",
    basis: "official",
    label: "Tomorrowland bracelet, posted ahead of the festival",
    rule: "A festival ticket bought without accommodation carries a Treasure Case delivery fee of €15 within the EU or €22 worldwide. A package includes one Treasure Case per person.",
    sourceUrl: WI_BRACELET,
    checkedOn: CHECKED,
    editions: ["winter"],
  },
  {
    id: "winter-baggage",
    section: "tickets",
    basis: "official",
    label: "Bags within your package allowance",
    rule: "Winter sports equipment carried on a package has to be declared in Manage My Booking. Hand luggage is 2 kg on a bus package and 10 to 12 kg on a flight package.",
    sourceUrl: WI_TRANSPORT_PACKAGES,
    checkedOn: CHECKED,
    editions: ["winter"],
  },
  {
    id: "winter-helmet",
    section: "winter-gear",
    basis: "official",
    label: "Helmet",
    rule: "A helmet is not included in a ski or snowboard equipment package, so it comes with you or is bought locally.",
    sourceUrl: WI_EQUIPMENT,
    checkedOn: CHECKED,
    editions: ["winter"],
  },
  {
    id: "winter-goggles",
    section: "winter-gear",
    basis: "official",
    label: "Goggles",
    rule: "Goggles are not included in a ski or snowboard equipment package, so they come with you or are bought locally.",
    sourceUrl: WI_EQUIPMENT,
    checkedOn: CHECKED,
    editions: ["winter"],
  },
  {
    id: "winter-ski-clothing",
    section: "winter-gear",
    basis: "official",
    label: "Ski or snowboard clothing",
    rule: "Clothing is not included in a ski or snowboard equipment package, so it comes with you or is bought locally.",
    sourceUrl: WI_EQUIPMENT,
    checkedOn: CHECKED,
    editions: ["winter"],
  },
  {
    id: "winter-ski-kit",
    section: "winter-gear",
    basis: "official",
    label: "Skis, boots and poles, or a hire booking to collect in resort",
    rule: "A ski package includes skis, boots and poles; a snowboard package includes the board and boots. Hire is collected in Alpe d'Huez or Oz 3300.",
    sourceUrl: WI_EQUIPMENT,
    checkedOn: CHECKED,
    editions: ["winter"],
    caveat: "No 2027 equipment hire price is published.",
  },
  {
    id: "winter-gloves",
    section: "winter-gear",
    basis: "suggestion",
    label: "Gloves and a hat",
    editions: ["winter"],
  },
  {
    id: "winter-layers",
    section: "winter-gear",
    basis: "suggestion",
    label: "Warm layers for the evening",
    editions: ["winter"],
  },
  {
    id: "winter-towel",
    section: "sleeping",
    basis: "official",
    label: "Towel",
    rule: "Towels are sold as an add-on rather than listed with the room, so bring one or buy it in the Add-On Sale.",
    sourceUrl: WI_ADDONS,
    checkedOn: CHECKED,
    editions: ["winter"],
  },
  {
    id: "winter-locker",
    section: "storage",
    basis: "official",
    label: "Locker, booked in advance",
    rule: "Lockers are rentable in advance for 4 or 7 days, at the Main Entrance, the Cage and the MainStage. Single-day lockers can be reserved in advance only for the Saturday-to-Monday pre-days; on the Tuesday-to-Friday main days they are sold on site and availability is not guaranteed.",
    sourceUrl: WI_LOCKERS,
    checkedOn: CHECKED,
    editions: ["winter"],
    caveat: "No 2027 locker price is published.",
  },
  {
    id: "winter-tyres",
    section: "travel",
    basis: "official",
    label: "Four winter tyres, or removable anti-slip devices",
    rule: "In the Isère mountain zones, from 1 November to 31 March, a vehicle must carry anti-slip devices for at least two driven wheels or be fitted with four winter tyres. Either arrangement satisfies the rule.",
    sourceUrl: WI_TYRE_RULE,
    checkedOn: CHECKED,
    editions: ["winter"],
  },
  {
    id: "winter-transport-pass",
    section: "travel",
    basis: "official",
    label: "Transportation Pass, if you sleep outside the resort",
    rule: "€40, covering the Oz 3300 night lift and the night coaches to Bourg d'Oisans, Vaujany, Villard-Reculas and Auris-en-Oisans. Walking between the resort and the villages is prohibited, so the pass is the only sanctioned way back at night.",
    sourceUrl: WI_TRANSPORT_PASS,
    checkedOn: CHECKED,
    editions: ["winter"],
    stays: ["winter-outside"],
    caveat: "Included automatically in packages sold in Oz 3300.",
  },
  {
    id: "winter-medication",
    section: "health",
    basis: "suggestion",
    label: "Any medication you take regularly",
    editions: ["winter"],
  },
  {
    id: "winter-sunscreen",
    section: "health",
    basis: "suggestion",
    label: "Sunscreen and lip balm",
    editions: ["winter"],
  },
  {
    id: "winter-charger",
    section: "tech",
    basis: "suggestion",
    label: "Phone charger",
    editions: ["winter"],
  },

  /* -------------------------------- Brasil ------------------------------- */
  {
    id: "brasil-half-price-proof",
    section: "tickets",
    basis: "official",
    label: "Proof of meia-entrada eligibility, if your ticket is half price",
    rule: "The half-price rate is open only to Brazilian citizens, and eligibility is proved at the gate; without proof you pay the difference up to the full price. Students need the standardised student ID, and bank slips, enrolment letters and screenshots are refused.",
    sourceUrl: BR_HALF_PRICE,
    checkedOn: CHECKED,
    editions: ["brasil"],
  },
  {
    id: "brasil-shuttle-voucher",
    section: "tickets",
    basis: "official",
    label: "A shuttle voucher for every festival day you travel",
    rule: "A shuttle voucher is valid for a single festival day, so a Full Madness pass needs three.",
    sourceUrl: BR_SHUTTLE_VOUCHER,
    checkedOn: CHECKED,
    editions: ["brasil"],
  },
  {
    id: "brasil-own-gear",
    section: "campsite",
    basis: "official",
    label: "Your own tent and camping equipment, for a Magnificent Greens pitch",
    rule: "A Magnificent Greens pitch is bring-your-own: campers bring their own equipment and choose where to pitch.",
    sourceUrl: BR_MG_ARTICLE,
    checkedOn: CHECKED,
    editions: ["brasil"],
    stays: ["brasil-dreamville"],
  },
  {
    id: "brasil-torch",
    section: "campsite",
    basis: "suggestion",
    label: "A torch or head torch",
    editions: ["brasil"],
    stays: ["brasil-dreamville"],
  },
  {
    id: "brasil-medication",
    section: "health",
    basis: "suggestion",
    label: "Any medication you take regularly",
    editions: ["brasil"],
  },
  {
    id: "brasil-sunscreen",
    section: "health",
    basis: "suggestion",
    label: "Sunscreen",
    editions: ["brasil"],
  },
  {
    id: "brasil-shoes",
    section: "clothing",
    basis: "suggestion",
    label: "Shoes you can walk and dance in",
    editions: ["brasil"],
  },
  {
    id: "brasil-charger",
    section: "tech",
    basis: "suggestion",
    label: "Phone charger and a power bank",
    editions: ["brasil"],
  },
  {
    id: "brasil-water-bottle",
    section: "tech",
    basis: "suggestion",
    label: "A refillable water bottle",
    editions: ["brasil"],
  },
];

/* -------------------------------------------------------------------------- */
/* Per-edition guidance                                                        */
/* -------------------------------------------------------------------------- */

export const packingGuides: readonly PackingGuide[] = [
  {
    edition: "belgium",
    summary:
      "Belgium publishes a prohibited-items list, a cashless rule and the contents of each DreamVille package, so most of this list is traceable to an official page.",
    notAllowed: [
      {
        text: "Your own food and drink on the festival site. They are allowed in DreamVille.",
        sourceUrl: BE_FORBIDDEN,
        checkedOn: CHECKED,
      },
      {
        text: "Glass, including perfume and deodorant bottles over 100 ml, in DreamVille as well as on site.",
        sourceUrl: BE_FORBIDDEN,
        checkedOn: CHECKED,
      },
      {
        text: "Sticks, which covers the selfie sticks and totems people ask about.",
        sourceUrl: BE_FORBIDDEN,
        checkedOn: CHECKED,
      },
      {
        text: "Plastic bottles and cans on the festival site.",
        sourceUrl: BE_FORBIDDEN,
        checkedOn: CHECKED,
      },
      {
        text: "Campers and caravans in or at DreamVille, and sleeping in a car.",
        sourceUrl: BE_FORBIDDEN,
        checkedOn: CHECKED,
      },
      {
        text: "Gas installations over 500 g in DreamVille. Cooking is allowed only at the public barbecue areas.",
        sourceUrl: BE_FORBIDDEN,
        checkedOn: CHECKED,
      },
      {
        text: "Drugs, other than prescribed medication presented with a medical certificate.",
        sourceUrl: BE_FORBIDDEN,
        checkedOn: CHECKED,
      },
    ],
    included: [
      {
        text: "An Easy Tent 2P package includes a lock for the tent, so a padlock is not needed for that package.",
        sourceUrl: BE_EASY_TENT,
        checkedOn: CHECKED,
      },
      {
        text: "A reusable cup carries a one-Pearl deposit, which comes back when the cup is returned to a Cup Return station.",
        sourceUrl: BE_CUPS,
        checkedOn: CHECKED,
      },
      {
        text: "The DreamVille Marketplace has a mini-supermarket, a bakery and the official Camping Store, which sells tents, sleeping bags and air mattresses.",
        sourceUrl: BE_MARKETPLACE,
        checkedOn: CHECKED,
      },
    ],
    unpublished: [
      {
        text: "No 2027 locker price or size table is published. Tomorrowland states that more detail, including the price table, will appear on the locker add-on page later.",
      },
      {
        text: "The value of one Pearl for 2027 is not published, so a top-up cannot be turned into a euro figure here.",
      },
    ],
  },
  {
    edition: "winter",
    summary:
      "Winter publishes what equipment hire excludes, the locker areas and the driving rule. The cold itself is not measured anywhere official, and no clothing guidance is published.",
    notAllowed: [],
    notAllowedGap:
      "The data behind this tool has no Winter page listing prohibited items, so nothing here is presented as banned. Check the official Winter practical pages before you pack.",
    included: [
      {
        text: "Lockers at the Main Entrance and the MainStage have USB charging built in.",
        sourceUrl: WI_LOCKERS,
        checkedOn: CHECKED,
      },
      {
        text: "A ski package includes skis, boots and poles; a snowboard package includes the board and boots.",
        sourceUrl: WI_EQUIPMENT,
        checkedOn: CHECKED,
      },
    ],
    unpublished: [
      {
        text: "No 2027 locker price is published, although the locations, sizes and rental durations are.",
      },
      {
        text: "No equipment hire price is published for 2027. The official page describes what a package contains and where to collect it.",
      },
      {
        text: "No temperature figures and no clothing guidance are published for festival week. The only official statement about warmth is that the MainStage is covered and heated; no other venue on site is described that way.",
      },
    ],
  },
  {
    edition: "brasil",
    summary:
      "Brasil's data covers the meia-entrada proof, the shuttle voucher and what a campsite package contains. It publishes no prohibited-items list, so none is claimed here.",
    notAllowed: [],
    notAllowedGap:
      "The data behind this tool has no Brasil page listing prohibited items, so nothing here is presented as banned. Check the official Brasil help centre before you pack.",
    included: [
      {
        text: "An Easy Tent arrives pre-pitched with a double air mattress and two sleeping bags ready on arrival.",
        sourceUrl: BR_EASY_TENT_ARTICLE,
        checkedOn: CHECKED,
      },
      {
        text: "A Magnificent Greens pitch is sold per person, while a Grande unit is sold per accommodation for four.",
        sourceUrl: BR_MG_PACKAGE,
        checkedOn: CHECKED,
      },
    ],
    unpublished: [
      {
        text: "No on-site payment information for Brasil is in this guide's data, so no payment item is listed. Buying a ticket is separate: Mastercard, Visa, Elo and Google Pay are the confirmed methods.",
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

export const packingCatalogueSchema = z
  .strictObject({
    items: z.array(packingItemSchema).min(1),
    guides: z.array(packingGuideSchema).length(3),
  })
  .superRefine(({ items, guides }, ctx) => {
    const ids = new Set<string>();
    items.forEach((item, index) => {
      if (ids.has(item.id)) {
        ctx.addIssue({ code: "custom", path: ["items", index, "id"], message: "duplicate item id" });
      }
      ids.add(item.id);

      if (item.stays === undefined) return;
      for (const stay of item.stays) {
        const option = PACKING_STAYS.find((candidate) => candidate.id === stay);
        if (option === undefined || !item.editions.includes(option.edition)) {
          ctx.addIssue({
            code: "custom",
            path: ["items", index, "stays"],
            message: `stay "${stay}" does not belong to the editions this item covers`,
          });
        }
      }
    });

    const editions = new Set(guides.map((guide) => guide.edition));
    if (editions.size !== PACKING_EDITIONS.length) {
      ctx.addIssue({
        code: "custom",
        path: ["guides"],
        message: "there must be exactly one guide per edition",
      });
    }

    for (const edition of PACKING_EDITIONS) {
      if (!items.some((item) => item.editions.includes(edition))) {
        ctx.addIssue({
          code: "custom",
          path: ["items"],
          message: `no item covers the ${edition} edition`,
        });
      }
    }
  });

/**
 * The catalogue, validated once at module load.
 *
 * Parsing here rather than in a test alone means a malformed entry fails the
 * build, exactly as a malformed data record does.
 */
export const validatedPackingCatalogue = packingCatalogueSchema.parse({
  items: packingCatalogue,
  guides: packingGuides,
});

/** Every item, already through the schema. */
export const packingItems: readonly PackingItem[] = validatedPackingCatalogue.items;

/** The guidance for one edition. */
export function guideForEdition(edition: PackingEdition): PackingGuide {
  const guide = validatedPackingCatalogue.guides.find((candidate) => candidate.edition === edition);
  // The schema proves one guide per edition exists, so this cannot be undefined.
  if (guide === undefined) throw new Error(`No packing guide for "${edition}"`);
  return guide;
}
