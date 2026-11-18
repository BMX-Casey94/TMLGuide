import { tickets as belgiumTickets } from "@/data/belgium";
import { winterTickets } from "@/data/winter";
import { brasilData } from "@/data/brasil";
import type { TicketPackage } from "@/data/schemas";
import { formatEuro, formatReal } from "../format";
import { ticketsRoute } from "../routes";
import { editionYear, joinSnippet } from "./types";
import type { SourceEntry } from "./types";
import { pairTiers, productName, tierLabel } from "./tiers";

/**
 * Ticket and package products, from the three validated ticket collections.
 *
 * Belgium and Winter price in euros and store one record per product per sale
 * tier, so those records are paired into one row per product with both prices in
 * the snippet. Brasil prices in reais and uses its own record type, where each
 * record is a distinct product or price variant (standard, half-price, Social,
 * Bybit Early Bird), so each becomes its own row rather than being paired.
 *
 * No figure is converted between currencies. The year in a snippet comes from
 * the shared editions overview, not from the record's name, so a price cannot be
 * labelled with a year the overview disagrees with.
 */

/** "€144.00" per tier, joined in the order the sale happens. */
function euroPrices(records: readonly { tierKey: string; record: TicketPackage }[]): string {
  return records
    .map(({ tierKey, record }) =>
      // A record with no sale-tier suffix is the only price there is, so naming
      // a tier beside it would invent a distinction the data does not make.
      tierKey === "single"
        ? formatEuro(record.priceEur)
        : `${formatEuro(record.priceEur)} ${tierLabel(tierKey)}`,
    )
    .join(" · ");
}

function euroTicketEntries(
  collection: readonly TicketPackage[],
  edition: "belgium" | "winter",
): SourceEntry[] {
  const year = editionYear(edition);

  return pairTiers(collection).map(({ productId, records }) => {
    const [first] = records;
    const nights = Math.max(...records.map(({ record }) => record.nights));

    return {
      slug: `${edition}-${productId}`,
      title: productName(first.record.name),
      snippet: joinSnippet([
        String(year),
        euroPrices(records),
        "per person",
        nights === 0 ? undefined : `${nights} nights`,
        first.record.includes.join("; "),
      ]),
      edition,
      href: ticketsRoute(edition),
      source: `src/data/${edition}/tickets.ts`,
      sourceUrl: first.record.source.url,
      lastVerified: first.record.lastVerified,
    };
  });
}

const brasilYear = editionYear("brasil");

const brasilTicketEntries: SourceEntry[] = brasilData.tickets.map((ticket) => ({
  slug: `brasil-ticket-${ticket.id}`,
  title: ticket.name,
  snippet: joinSnippet([
    String(brasilYear),
    formatReal(ticket.price.amount),
    ticket.validDays === 1 ? "1 day" : `${ticket.validDays} days`,
    ticket.availability === "sold-out" ? "Sold out" : "On sale",
    ticket.notes,
  ]),
  edition: "brasil",
  href: ticketsRoute("brasil"),
  source: "src/data/brasil/facts.ts",
  sourceUrl: ticket.source.url,
  lastVerified: ticket.lastVerified,
}));

export const ticketEntries: SourceEntry[] = [
  ...euroTicketEntries(belgiumTickets, "belgium"),
  ...euroTicketEntries(winterTickets, "winter"),
  ...brasilTicketEntries,
];
