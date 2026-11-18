import type { SaleWindow } from "../schemas";

/**
 * Belgium 2027 sale moments.
 *
 * The official 2027 pages publish three sale moments: the Global Journey
 * Travel Package Sale, the WorldWide Pre-Sale and the WorldWide Ticket Sale.
 * There is no Belgian-only sale and no separately dated Friends sale in the
 * 2027 cycle, so none is recorded here. Pre-registration is not a sale and is
 * recorded in `facts.ts` instead.
 *
 * Every instant is Belgian local time (CET, +01:00) on a Saturday at 17:00,
 * exactly as published.
 */
export const saleWindows: readonly SaleWindow[] = [
  {
    id: "global-journey-sale",
    edition: "belgium",
    name: "Global Journey Travel Packages Sale",
    opensAt: "2027-01-30T17:00:00+01:00",
    timeZone: "Europe/Brussels",
    audience: "Global Journey packages only",
    notes:
      "Travel packages that combine a festival ticket with transport and/or accommodation. Global Journey packages have no Exchange Desk; they follow the published cancellation conditions instead.",
    source: {
      url: "https://belgium.tomorrowland.com/en/sales-info/how-to-order/",
      title: "Tomorrowland Belgium — how to order, 2027 sales",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "worldwide-pre-sale",
    edition: "belgium",
    name: "WorldWide Pre-Sale",
    opensAt: "2027-02-06T17:00:00+01:00",
    timeZone: "Europe/Brussels",
    audience: "Everyone who pre-registered in a Tomorrowland Account",
    notes:
      "Tickets and DreamVille packages. Pre-registration opened on 2 December 2026 and does not guarantee a ticket.",
    source: {
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037219532-What-is-the-difference-between-the-different-sales-moments",
      title: "What is the difference between the different sales moments",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "worldwide-ticket-sale",
    edition: "belgium",
    name: "WorldWide Ticket Sale",
    opensAt: "2027-02-13T17:00:00+01:00",
    timeZone: "Europe/Brussels",
    audience: "Everyone who pre-registered in a Tomorrowland Account",
    notes:
      "General sale of tickets and DreamVille packages. The Exchange Desk opens on the same day.",
    source: {
      url: "https://faq.tomorrowland.com/hc/en-us/articles/360037219532-What-is-the-difference-between-the-different-sales-moments",
      title: "What is the difference between the different sales moments",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
];
