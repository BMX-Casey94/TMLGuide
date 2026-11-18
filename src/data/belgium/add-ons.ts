import type { AddOn } from "../schemas";

/**
 * Belgium 2027 add-ons.
 *
 * The Treasure Case is the only add-on whose 2027 price the ledger publishes.
 * Its 2027 figures (Belgium €15, EU €22, Worldwide €31) replace 2025's
 * €13.50/€19.50/€27.00 and are recorded here as three records because the
 * charge varies by shipping address.
 *
 * Everything else stays empty, with a reason:
 *
 * - Dining experiences, breakfasts, parking, camping gear, drinks and yoga have
 *   no published 2027 price. The ledger marks every one `unverifiable`, so the
 *   corrected column holds no figure to publish.
 * - The Avicii Tribute is free against a refundable €10 deposit, and the schema
 *   has one non-negative price with no deposit field, so recording either €0 or
 *   €10 would misstate it.
 * - Hospitality prices are `unverifiable` for 2027, and the Mansion is
 *   quote-only.
 *
 * See `docs/data/belgium-omissions.md`.
 */
export const addOns: readonly AddOn[] = [
  {
    id: "belgium-2027-treasure-case-belgium",
    edition: "belgium",
    name: "Treasure Case shipping — Belgium, 2027 edition",
    priceEur: 15,
    category: "other",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-treasure-case-eu",
    edition: "belgium",
    name: "Treasure Case shipping — rest of the EU, 2027 edition",
    priceEur: 22,
    category: "other",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "belgium-2027-treasure-case-worldwide",
    edition: "belgium",
    name: "Treasure Case shipping — worldwide, 2027 edition",
    priceEur: 31,
    category: "other",
    source: {
      url: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/",
      title: "Tomorrowland Belgium — Full Madness pass, 2027 prices",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
];
