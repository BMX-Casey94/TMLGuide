/**
 * The single date the site's facts were last checked.
 *
 * Rather than hard-code "18 November 2026" in the copy, the date is read from
 * the data the page actually renders. If one collection is re-verified and the
 * rest are not, this returns the oldest date, because the page as a whole is only
 * as current as its stalest figure.
 */
import { belgiumData } from "@/data/belgium";
import { brasilData } from "@/data/brasil";
import { winterData } from "@/data/winter";
import { sharedData } from "@/data/shared";

/**
 * Every `lastVerified` value the home and About pages rely on. Each entry is a
 * collection the pages read, so a new collection is a one-line addition here.
 */
export function verifiedDates(): readonly string[] {
  return [
    ...sharedData.editions.map((record) => record.lastVerified),
    ...sharedData.faqs.map((record) => record.lastVerified),
    ...belgiumData.tickets.map((record) => record.lastVerified),
    ...belgiumData.faqs.map((record) => record.lastVerified),
    ...belgiumData.saleWindows.map((record) => record.lastVerified),
    ...winterData.tickets.map((record) => record.lastVerified),
    ...winterData.saleWindows.map((record) => record.lastVerified),
    ...brasilData.tickets.map((record) => record.lastVerified),
    ...brasilData.saleWindows.map((record) => record.lastVerified),
  ];
}

/**
 * The oldest verification date among the records the pages render, as
 * `YYYY-MM-DD`.
 *
 * @throws Error when there is nothing to read, which would mean the page is
 *   claiming a check date it cannot evidence.
 */
export function oldestVerifiedOn(dates: readonly string[] = verifiedDates()): string {
  if (dates.length === 0) {
    throw new Error("oldestVerifiedOn: no verification dates to read");
  }
  // ISO dates sort lexicographically in calendar order, so this avoids parsing.
  return dates.reduce((oldest, candidate) => (candidate < oldest ? candidate : oldest));
}
