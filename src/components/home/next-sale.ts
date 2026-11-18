/**
 * The next ticket sale across every edition.
 *
 * Each edition publishes its sale moments in its own file, in its own zone:
 * Belgium and Winter quote Belgian local time, Brasil quotes São Paulo time.
 * This module merges the three lists into one shape, picks the soonest moment
 * that has not yet opened, and formats it in the zone it was published in.
 *
 * The comparison itself is delegated to `nextSale` in `@/lib/tools`, which
 * parses only instants that carry an explicit offset and breaks ties by id. The
 * ids are namespaced with the edition here so a tie across two editions is also
 * resolved deterministically, rather than by whichever array happened to be
 * read first.
 */
import { belgiumData } from "@/data/belgium";
import { brasilData } from "@/data/brasil";
import { winterData } from "@/data/winter";
import type { Source } from "@/data/schemas";
import { countdown, formatInZone, nextSale, type Countdown } from "@/lib/tools";

/** The three editions TMLGuide covers. */
export type SaleEditionId = "belgium" | "winter" | "brasil";

/** A sale moment with the edition it belongs to. */
export interface EditionSaleWindow {
  readonly edition: SaleEditionId;
  readonly id: string;
  readonly name: string;
  readonly opensAtIso: string;
  readonly timeZone: string;
  readonly audience: string;
  readonly source: Source;
  readonly lastVerified: string;
}

/** Display name for each edition, used in the strip's copy. */
export const SALE_EDITION_LABELS: Record<SaleEditionId, string> = {
  belgium: "Belgium",
  winter: "Winter",
  brasil: "Brasil",
};

/** The soonest unopened sale, with its times in both zones and a countdown. */
export interface NextSale {
  readonly window: EditionSaleWindow;
  /** The opening moment in the sale's own zone, for example "Thu 26 Nov 2026, 15:00 CET". */
  readonly localLabel: string;
  /** The same moment in London, so a UK reader can plan around it. */
  readonly londonLabel: string;
  readonly countdown: Countdown;
}

/**
 * Every sale moment the guide has verified, newest edition data first, each
 * tagged with its edition. Order does not affect the result: the soonest
 * instant wins.
 */
export function editionSaleWindows(): readonly EditionSaleWindow[] {
  const belgium: EditionSaleWindow[] = belgiumData.saleWindows.map((window) => ({
    edition: "belgium",
    id: window.id,
    name: window.name,
    opensAtIso: window.opensAt,
    timeZone: window.timeZone,
    audience: window.audience,
    source: window.source,
    lastVerified: window.lastVerified,
  }));

  const winter: EditionSaleWindow[] = winterData.saleWindows.map((window) => ({
    edition: "winter",
    id: window.id,
    name: window.name,
    opensAtIso: window.opensAt,
    timeZone: window.timeZone,
    audience: window.audience,
    source: window.source,
    lastVerified: window.lastVerified,
  }));

  const brasil: EditionSaleWindow[] = brasilData.saleWindows.map((window) => ({
    edition: "brasil",
    id: window.id,
    name: window.name,
    opensAtIso: window.opensAt,
    timeZone: window.timeZone,
    audience: window.audience,
    source: window.source,
    lastVerified: window.lastVerified,
  }));

  return [...belgium, ...winter, ...brasil];
}

/** Namespaced id, so two editions cannot collide on a plain record id. */
function compositeId(window: EditionSaleWindow): string {
  return `${window.edition}:${window.id}`;
}

/**
 * The soonest sale still ahead of `now`, or null when every verified moment has
 * opened. A sale that opens exactly at `now` counts as opened, which is the
 * same rule `countdown` uses, so the strip and its timer never disagree.
 *
 * @throws RangeError when a stored opening time is not a valid instant.
 */
export function nextSaleFrom(
  windows: readonly EditionSaleWindow[],
  now: Date,
): NextSale | null {
  const soonest = nextSale(
    windows.map((window) => ({
      id: compositeId(window),
      name: window.name,
      opensAtIso: window.opensAtIso,
    })),
    now,
  );

  if (soonest === null) return null;

  const match = windows.find((window) => compositeId(window) === soonest.id);
  if (match === undefined) {
    // Unreachable unless `nextSale` invents an id, but a silent null here would
    // hide a real bug behind an empty strip.
    throw new Error(`nextSaleFrom: no window matches the chosen id "${soonest.id}"`);
  }

  return {
    window: match,
    localLabel: formatInZone(match.opensAtIso, match.timeZone),
    londonLabel: formatInZone(match.opensAtIso, "Europe/London"),
    countdown: countdown(match.opensAtIso, now),
  };
}

/** The next sale across every edition, against the current clock. */
export function nextSaleNow(now: Date): NextSale | null {
  return nextSaleFrom(editionSaleWindows(), now);
}
