import type { TicketPackage } from "../schemas";

/**
 * Belgium 2027 festival tickets.
 *
 * Every price here is the **corrected 2027 value** from the "correct value"
 * column of `docs/factcheck/belgium.md`, read from the official 2027 pages on
 * 2026-11-18. Rows that still carried a 2025 figure were superseded by those
 * values; the 2025 figures themselves are discarded and never appear here.
 *
 * The ticket schema holds a single `priceEur`, so each product is split into
 * one record per sale tier, with ids ending `-presale` and `-worldwide`.
 * "Pre-sale" is the WorldWide and Belgian Pre-Sale; "worldwide" is the
 * WorldWide Ticket Sale.
 *
 * Prices include payment and service fees but exclude the Treasure Case fee,
 * which is a separate per-person charge recorded in `add-ons.ts`.
 */
export const tickets: readonly TicketPackage[] = [
  {
    id: "belgium-2027-day-pass-presale",
    edition: "belgium",
    name: "Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale",
    tier: "regular",
    nights: 0,
    priceEur: 144,
    includes: ["Festival access for one day: Friday, Saturday or Sunday"],
    notes:
      "Regular tier: general festival access only. Price shown is the 2027 pre-sale price per person and excludes the Treasure Case fee.",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
      title: "Tomorrowland Belgium — day passes, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-day-pass-worldwide",
    edition: "belgium",
    name: "Day Pass — 2027 edition, WorldWide Ticket Sale",
    tier: "regular",
    nights: 0,
    priceEur: 159,
    includes: ["Festival access for one day: Friday, Saturday or Sunday"],
    notes:
      "Regular tier: general festival access only. Price shown is the 2027 WorldWide Ticket Sale price per person and excludes the Treasure Case fee.",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
      title: "Tomorrowland Belgium — day passes, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-pleasure-day-pass-presale",
    edition: "belgium",
    name: "Pleasure Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale",
    tier: "premium",
    nights: 0,
    priceEur: 194,
    includes: [
      "Festival access for one day",
      "All Comfort areas except the MainStage Comfort area",
    ],
    notes:
      "Pleasure is the middle tier. The schema has no dedicated value for it, so it is stored as premium: Pleasure covers every Comfort area except the MainStage Comfort area. Price is the 2027 pre-sale price per person, excluding the Treasure Case fee.",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
      title: "Tomorrowland Belgium — day passes, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-pleasure-day-pass-worldwide",
    edition: "belgium",
    name: "Pleasure Day Pass — 2027 edition, WorldWide Ticket Sale",
    tier: "premium",
    nights: 0,
    priceEur: 224,
    includes: [
      "Festival access for one day",
      "All Comfort areas except the MainStage Comfort area",
    ],
    notes:
      "Pleasure is the middle tier, stored as premium because the schema has no dedicated value for it. Price is the 2027 WorldWide Ticket Sale price per person, excluding the Treasure Case fee.",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
      title: "Tomorrowland Belgium — day passes, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-comfort-day-pass-presale",
    edition: "belgium",
    name: "Comfort Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale",
    tier: "comfort",
    nights: 0,
    priceEur: 256,
    includes: [
      "Festival access for one day",
      "Comfort areas at the MainStage, the Great Library and Freedom",
    ],
    notes:
      "Comfort is the tier that includes the MainStage Comfort area. Price is the 2027 pre-sale price per person, excluding the Treasure Case fee.",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
      title: "Tomorrowland Belgium — day passes, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-comfort-day-pass-worldwide",
    edition: "belgium",
    name: "Comfort Day Pass — 2027 edition, WorldWide Ticket Sale",
    tier: "comfort",
    nights: 0,
    priceEur: 275,
    includes: [
      "Festival access for one day",
      "Comfort areas at the MainStage, the Great Library and Freedom",
    ],
    notes:
      "Comfort is the tier that includes the MainStage Comfort area. Price is the 2027 WorldWide Ticket Sale price per person, excluding the Treasure Case fee.",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
      title: "Tomorrowland Belgium — day passes, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-full-madness-presale",
    edition: "belgium",
    name: "Full Madness Pass — 2027 edition, WorldWide and Belgian Pre-Sale",
    tier: "regular",
    nights: 0,
    priceEur: 335,
    includes: ["Festival access for all three days of one weekend"],
    notes:
      "Festival pass only, with no DreamVille access. Price is the 2027 pre-sale price per person, excluding the Treasure Case fee. Inside a DreamVille package the pass component is priced at €328 in the pre-sale and €394 in the WorldWide Sale rather than at this standalone figure.",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-full-madness-worldwide",
    edition: "belgium",
    name: "Full Madness Pass — 2027 edition, WorldWide Ticket Sale",
    tier: "regular",
    nights: 0,
    priceEur: 410,
    includes: ["Festival access for all three days of one weekend"],
    notes:
      "Festival pass only, with no DreamVille access. Price is the 2027 WorldWide Ticket Sale price per person, excluding the Treasure Case fee.",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-full-madness-comfort-presale",
    edition: "belgium",
    name: "Full Madness Comfort Pass — 2027 edition, WorldWide and Belgian Pre-Sale",
    tier: "comfort",
    nights: 0,
    priceEur: 581,
    includes: [
      "Festival access for all three days of one weekend",
      "Comfort areas at the MainStage, the Great Library and Freedom",
    ],
    notes:
      "Festival pass only, with no DreamVille access. Price is the 2027 pre-sale price per person, excluding the Treasure Case fee.",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-full-madness-comfort-worldwide",
    edition: "belgium",
    name: "Full Madness Comfort Pass — 2027 edition, WorldWide Ticket Sale",
    tier: "comfort",
    nights: 0,
    priceEur: 700,
    includes: [
      "Festival access for all three days of one weekend",
      "Comfort areas at the MainStage, the Great Library and Freedom",
    ],
    notes:
      "Festival pass only, with no DreamVille access. Price is the 2027 WorldWide Ticket Sale price per person, excluding the Treasure Case fee.",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
];
