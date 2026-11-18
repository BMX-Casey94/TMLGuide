import { accommodation as belgiumAccommodation } from "@/data/belgium";
import { winterAccommodation } from "@/data/winter";
import { brasilData } from "@/data/brasil";
import type { Accommodation } from "@/data/schemas";
import { formatEuro, formatReal } from "../format";
import { ticketsRoute } from "../routes";
import { editionYear, joinSnippet } from "./types";
import type { SourceEntry } from "./types";
import { pairTiers, productName, tierLabel } from "./tiers";

/**
 * Places to stay, from the three editions.
 *
 * Belgium has DreamVille packages priced per person for the whole stay, one
 * record per sale tier. Winter publishes no accommodation price at all — its
 * `winterAccommodation` array is empty by design, because lodging is sold only
 * inside a sold-out package with no minimum published — so Winter contributes no
 * rows rather than a guessed one. Brasil sells DreamVille packages in reais per
 * unit: one person, a two-person tent, a four-person Grande.
 *
 * All of them link to the tickets page, which is where the site prices them.
 */

const KIND_TEXT: Readonly<Record<Accommodation["kind"], string>> = {
  "dreamville-tent": "DreamVille tent",
  "dreamville-lodge": "DreamVille lodge",
  hotel: "Hotel",
  camping: "Campsite",
  other: "Accommodation",
};

const belgiumYear = editionYear("belgium");

const belgiumEntries: SourceEntry[] = pairTiers(belgiumAccommodation).map(
  ({ productId, records }) => {
    const [first] = records;
    const pricing = first.record.pricing === "per-stay" ? "for the whole stay" : "per night";
    const prices = records
      .map(({ tierKey, record }) =>
        tierKey === "single"
          ? formatEuro(record.nightlyOrTotalEur)
          : `${formatEuro(record.nightlyOrTotalEur)} ${tierLabel(tierKey)}`,
      )
      .join(" · ");

    return {
      slug: `belgium-stay-${productId}`,
      title: productName(first.record.name),
      snippet: joinSnippet([
        String(belgiumYear),
        prices,
        pricing,
        KIND_TEXT[first.record.kind],
        `${first.record.capacity} ${first.record.capacity === 1 ? "person" : "people"}`,
      ]),
      edition: "belgium" as const,
      href: ticketsRoute("belgium"),
      source: "src/data/belgium/accommodation.ts",
      sourceUrl: first.record.source.url,
      lastVerified: first.record.lastVerified,
    };
  },
);

const brasilYear = editionYear("brasil");

/** Which sale a Brasil package's price belongs to. */
const BRASIL_SALE_MOMENT: Readonly<Record<string, string>> = {
  worldwide: "WorldWide sale",
  "bybit-early-bird": "Bybit Early Bird",
};

const brasilEntries: SourceEntry[] = brasilData.dreamvillePackages.map((stay) => ({
  slug: `brasil-stay-${stay.id}`,
  title: stay.name,
  snippet: joinSnippet([
    String(brasilYear),
    formatReal(stay.price.amount),
    BRASIL_SALE_MOMENT[stay.saleMoment] ?? stay.saleMoment,
    `${stay.capacity} ${stay.capacity === 1 ? "person" : "people"}`,
    stay.availability === "sold-out" ? "Sold out" : "On sale",
  ]),
  edition: "brasil" as const,
  href: ticketsRoute("brasil"),
  source: "src/data/brasil/facts.ts",
  sourceUrl: stay.source.url,
  lastVerified: stay.lastVerified,
}));

/**
 * Winter is still mapped from its array rather than omitted outright. The array
 * is validated and empty today, so the cost is nil, and if a Winter price is ever
 * published it appears here with no change to this file.
 */
const winterYear = editionYear("winter");

const winterEntries: SourceEntry[] = winterAccommodation.map((record) => ({
  slug: `winter-stay-${record.id}`,
  title: record.name,
  snippet: joinSnippet([
    String(winterYear),
    formatEuro(record.nightlyOrTotalEur),
    record.pricing === "per-stay" ? "for the whole stay" : "per night",
    record.notes,
  ]),
  edition: "winter" as const,
  href: ticketsRoute("winter"),
  source: "src/data/winter/accommodation.ts",
  sourceUrl: record.source.url,
  lastVerified: record.lastVerified,
}));

export const accommodationEntries: SourceEntry[] = [
  ...belgiumEntries,
  ...winterEntries,
  ...brasilEntries,
];
