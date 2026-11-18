import type { SaleWindow } from "../schemas";

/**
 * Winter 2027 sale windows.
 *
 * Only one window has a ledger verdict of `confirmed` for Winter: the Add-On
 * Sale date. The October 2026 package and ticket sale dates appear in
 * `docs/factcheck/winter.md` only inside the corrected value of a
 * `contradicted-by-sources` row (the claim under test was the fan site's
 * "sales always run in September" pattern), so no record is derived from them.
 * See `docs/data/winter-omissions.md`.
 */
export const winterSaleWindows: readonly SaleWindow[] = [
  {
    id: "add-on-sale-2027",
    edition: "winter",
    name: "Winter 2027 Add-On Sale",
    opensAt: "2026-11-26T15:00:00+01:00",
    timeZone: "Europe/Brussels",
    audience: "General sale",
    notes:
      "The 2027 Add-On Sale covers activities, lockers, slope experiences, ski and snowboard equipment, ski insurance, shuttles, the Transportation Pass and towels. The 2027 add-on index has no restaurant category.",
    source: {
      url: "https://winter.tomorrowland.com/en/add-ons/",
      title: "Tomorrowland Winter 2027 add-ons",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
];
