import type { TicketPackage } from "../schemas";

/**
 * Winter 2027 tickets.
 *
 * One record exists because exactly one Winter 2027 ticket price is published:
 * the 7-Day Festival Ticket at EUR 735. The 4-Day and 1-Day Festival Tickets
 * are listed for 2027 on the official ticket page, but no price is rendered to
 * an unauthenticated reader (ledger verdict `unverifiable`), and the 2027
 * package minimum is not published at all (the package sale shows "Sold out").
 * Those products are therefore absent rather than guessed; see
 * `docs/data/winter-omissions.md`.
 */
export const winterTickets: readonly TicketPackage[] = [
  {
    id: "seven-day-festival-ticket-2027",
    edition: "winter",
    name: "7-Day Festival Ticket",
    tier: "regular",
    nights: 0,
    priceEur: 735,
    includes: [
      "Festival access from 20 to 27 March 2027",
      "Lift and ski pass, required to reach the mountain stages",
    ],
    notes:
      "The published 2027 price is EUR 735, made up of a EUR 346 festival element and a EUR 389 lift and ski pass. No 4-Day or 1-Day price is published, so neither is recorded.",
    source: {
      url: "https://winter.tomorrowland.com/fr/tickets/ticket-festival/",
      title: "Tomorrowland Winter 2027 ticket festival",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
];
