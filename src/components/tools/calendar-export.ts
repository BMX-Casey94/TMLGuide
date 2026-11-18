import { buildIcs, icsFilename, type IcsEvent } from "@/lib/tools";
import type { TimelineSale } from "./timeline-logic";

/**
 * Calendar export for the sale timeline.
 *
 * The writer is the tested `buildIcs`, which produces RFC 5545 text with UTC
 * date-times, escaped text fields and folded lines. This module's job is only to
 * describe a sale as an event: when it opens, what to call it, where it points,
 * and the two reminders the brief asks for.
 *
 * Reminders are 30 minutes and 1 day before the opening, which is when a reader
 * needs to be at a screen: sale queues form at the opening instant, not after it.
 */

export const ICAL_PRODUCT_ID = "-//TMLGuide//Sale timeline//EN";

/** 30 minutes, and 1 day, before the opening. */
export const SALE_REMINDERS_MINUTES: readonly number[] = [30, 24 * 60];

/** How long the calendar block lasts. A sale opening is a single moment. */
const EVENT_DURATION_MS = 30 * 60 * 1000;

/** Formats a millisecond timestamp as an ISO instant with `Z`. */
function toIsoZ(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

/** Turns one sale into a calendar event. */
export function saleToEvent(sale: TimelineSale): IcsEvent {
  const start = Date.parse(sale.opensAtIso);
  if (!Number.isFinite(start)) {
    // The data schemas already guarantee a parseable instant; this keeps the
    // failure loud rather than exporting an event at the epoch.
    throw new RangeError(`sale "${sale.id}" has an invalid opening instant`);
  }

  return {
    uid: `${sale.id}-${start}@tmlguide.com`,
    summary: sale.calendarSummary,
    description: [
      `Opens ${sale.audience.toLowerCase()}.`,
      sale.notes ?? "",
      "Times in this file are absolute, so your calendar shows them in your own zone.",
      "An independent reminder from TMLGuide, not an official Tomorrowland calendar.",
    ]
      .filter((part) => part !== "")
      .join("\n"),
    location: "Online ticket sale",
    startIso: toIsoZ(start),
    endIso: toIsoZ(start + EVENT_DURATION_MS),
    alarmMinutesBefore: SALE_REMINDERS_MINUTES,
    url: sale.sourceUrl,
  };
}

/** Builds a calendar file holding one sale. */
export function buildSaleCalendar(sale: TimelineSale, now: Date): string {
  return buildIcs({
    productId: ICAL_PRODUCT_ID,
    events: [saleToEvent(sale)],
    now,
  });
}

/**
 * Builds a calendar file holding every sale in the list.
 *
 * Sales that have already opened are included: a reader may want the record in
 * their calendar, and dropping them would silently change what "all sales"
 * means between one visit and the next.
 */
export function buildEditionCalendar(sales: readonly TimelineSale[], now: Date): string {
  return buildIcs({
    productId: ICAL_PRODUCT_ID,
    events: sales.map(saleToEvent),
    now,
  });
}

/** The download name for one sale, for example "sale-worldwide-ticket-sale.ics". */
export function saleFilename(sale: TimelineSale): string {
  return icsFilename(`tomorrowland-${sale.id}`);
}

/** The download name for an edition's whole calendar. */
export function editionFilename(edition: string): string {
  return icsFilename(`tomorrowland-${edition}-sales`);
}
