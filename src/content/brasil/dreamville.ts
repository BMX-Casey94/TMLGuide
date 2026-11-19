import { guideChapterSchema } from "../schema";

const VERIFIED_ON = "2026-11-18";

/**
 * Brasil DreamVille: the three camping families, the 2027 Mística line-up and
 * what each package is priced for. DreamVille package records live in a
 * Brasil-specific array that the `data` block cannot name, so the amounts are
 * published as facts rows with sources, in reais exactly as the ledger gives
 * them and never converted.
 */
export const brasilDreamvilleChapter = guideChapterSchema.parse({
  edition: "brasil",
  slug: "dreamville",
  order: 3,
  title: "DreamVille",
  summary:
    "The campsite next to Parque Maeda: Magnificent Greens, Easy Tent and the 2027 Mística line-up, with what each package is priced for and who it covers.",
  lastVerified: VERIFIED_ON,
  related: ["brasil/overview", "brasil/tickets", "brasil/transport", "belgium/dreamville"],
  sources: [
    {
      id: "s1",
      title: "How does the DreamVille stay work?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/13510975314708",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s2",
      title: "Magnificent Greens packages",
      url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/magnificent-greens/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s3",
      title: "What is included in a Magnificent Greens package?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/53208584907028",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s4",
      title: "What is included in an Easy Tent package?",
      url: "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/53208964543764",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s5",
      title: "Easy Tent 2P package",
      url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/easy-tent-packages/easy-tent-package/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s6",
      title: "Mística packages — 2027 line-up",
      url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/mistica-packages/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s7",
      title: "Solaris 2P package",
      url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/mistica-packages/solaris-2p-package/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s8",
      title: "Grande 4P package",
      url: "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/mistica-packages/grande-4p-package/",
      checkedOn: VERIFIED_ON,
    },
    {
      id: "s9",
      title: "Tomorrowland Brasil 2027 — the official countdown has begun",
      url: "https://press.brasil.tomorrowland.com/tomorrowland-brasil-2027-the-official-countdown-has-begun",
      checkedOn: VERIFIED_ON,
    },
  ],
  blocks: [
    { type: "h2", id: "the-campsite", text: "The campsite" },
    {
      type: "p",
      text: "DreamVille is the official campsite, right next to the Parque Maeda festival grounds. A stay runs five days, Thursday to Monday, and opens with The Gathering, the campsite's own opening party, on Thursday 29 April 2027, the day before the festival starts.",
      sources: ["s9", "s1"],
    },
    {
      type: "callout",
      tone: "note",
      title: "Priced per person, per tent or per unit",
      text: "Only a Magnificent Greens 1P package is sold per person. An Easy Tent is sold per tent for two people, and a Grande unit is sold per accommodation for four. Compare totals only after checking which unit a price covers.",
      sources: ["s2"],
    },
    { type: "h2", id: "packages", text: "The three families" },
    { type: "h3", id: "magnificent-greens", text: "Magnificent Greens" },
    {
      type: "p",
      text: "Magnificent Greens is bring-your-own: campers bring their own equipment and choose where to pitch. It is the only family priced per person.",
      sources: ["s3", "s2"],
    },
    {
      type: "data",
      edition: "brasil",
      collection: "accommodation",
      idPrefix: "magnificent-greens",
      caption: "Magnificent Greens 1P: 2027 prices in reais, per person (sold out)",
    },
    { type: "h3", id: "easy-tent", text: "Easy Tent" },
    {
      type: "p",
      text: "An Easy Tent arrives pre-pitched: a limited-edition Tomorrowland tent with a double air mattress and two sleeping bags ready on arrival. It is a two-person product, so the price covers the tent.",
      sources: ["s4", "s5"],
    },
    {
      type: "data",
      edition: "brasil",
      collection: "accommodation",
      idPrefix: "easy-tent",
      caption: "Easy Tent 2P: 2027 prices in reais for the tent, sleeping two (sold out)",
    },
    { type: "h3", id: "mistica", text: "Mística glamping" },
    {
      type: "p",
      text: "Mística is the glamping side of DreamVille. The 2027 line-up is Solaris 2P, Luna 2P, Luna 2P Supreme, Dreamlodge, Nomade, Orion, Argo and Grande 4P. That is the whole list published on the Mística index, and it changes between editions, so re-read it rather than reusing an older table.",
      sources: ["s6"],
    },
    {
      type: "data",
      edition: "brasil",
      collection: "accommodation",
      idPrefix: "solaris",
      caption: "Solaris 2P: 2027 prices in reais (sold out)",
    },
    {
      type: "data",
      edition: "brasil",
      collection: "accommodation",
      idPrefix: "grande",
      caption: "Grande 4P: 2027 prices in reais for the whole unit (sold out)",
    },
    {
      type: "p",
      text: "The Luna line is the exception. The index publishes three figures against two product names and does not say which figure belongs to which variant, so the amounts are recorded here exactly as printed rather than split into per-tier rows.",
      sources: ["s6"],
    },
    {
      type: "facts",
      caption: "Luna 2P and Luna 2P Supreme: 2027 prices in reais, as published (sold out)",
      rows: [
        {
          label: "Luna line",
          value: "R$20,049, R$24,599 and R$32,959, with no published mapping of figure to variant",
          sources: ["s6"],
        },
      ],
    },
    { type: "h2", id: "tiers", text: "Comfort and N°1" },
    {
      type: "p",
      text: "The tier matters as much as the tent. Comfort variants include Full Madness Comfort passes and the Comfort areas, and N°1 variants are the top hospitality tier, including all Comfort areas plus the N°1 Area. Magnificent Greens is offered in standard and Comfort; an N°1 pass is available with the Easy Tent, Solaris and Grande packages.",
      sources: ["s2", "s5", "s7", "s8"],
    },
    {
      type: "p",
      text: "That is why two packages in the same family can differ by several thousand reais: the tier changes the pass bundled with the bed, not the size of the accommodation.",
      sources: ["s5", "s7", "s8"],
    },
    { type: "h2", id: "practical", text: "Practical points" },
    {
      type: "ul",
      items: [
        "DreamVille opens on Thursday 29 April 2027 with The Gathering, the evening before the festival's first day.",
        "A stay covers five days, Thursday to Monday.",
        "The DreamVille Shuttle runs from São Paulo and Campinas on the Thursday and is a round trip; it is a separate purchase from the campsite package.",
        "Every 2027 DreamVille package shown on 18 November 2026 was marked sold out.",
      ],
      sources: ["s1", "s2", "s6", "s8"],
    },
    {
      type: "callout",
      tone: "warning",
      title: "Prices are in reais and are not converted",
      text: "Every figure on this page is the amount the official Brasil pages publish, in Brazilian reais. No official source states a euro equivalent, and this guide does not invent an exchange rate.",
      sources: ["s2", "s5", "s7"],
    },
  ],
});
