import { compareTimes, countdown, getSaleStatus, nextSale, type Countdown, type SaleWindow } from "@/lib/tools";

/**
 * Sale timeline logic.
 *
 * The tested library works in absolute instants, so this module's job is to
 * adapt the data layer's records to it and to decide what a reader sees: which
 * sales are past, open or upcoming, which one the countdown follows, and how a
 * sale time is presented in the reader's own zone beside Brussels time.
 *
 * The visitor's local zone is read from the runtime and passed to `Intl` by
 * name, which is why nothing here hard-codes a zone.
 */

/** A sale as the timeline presents it. */
export interface TimelineSale {
  readonly id: string;
  readonly name: string;
  readonly audience: string;
  readonly notes: string | undefined;
  /** The opening instant, as an ISO string with an offset. */
  readonly opensAtIso: string;
  /** The zone the organisers quote the time in. */
  readonly sourceZone: string;
  readonly status: "past" | "open" | "upcoming";
  readonly sourceUrl: string;
  readonly lastVerified: string;
  /** Calendar action metadata, so the UI does not re-derive it. */
  readonly calendarUid: string;
  readonly calendarSummary: string;
}

/** Which edition a timeline belongs to. */
export type TimelineEdition = "belgium" | "winter" | "brasil";

/** The zone each edition's sale times are published in. */
export const EDITION_SALE_ZONE: Readonly<Record<TimelineEdition, string>> = {
  belgium: "Europe/Brussels",
  winter: "Europe/Brussels",
  brasil: "America/Sao_Paulo",
};

/** A data record, reduced to the fields the timeline needs. */
export interface SaleRecord {
  readonly id: string;
  readonly name: string;
  readonly audience: string;
  readonly notes?: string;
  readonly opensAt: string;
  readonly source: { readonly url: string };
  readonly lastVerified: string;
}

/**
 * Classifies a sale relative to `now`.
 *
 * "past" is anything whose opening has gone by, "open" is one that opened within
 * the last 24 hours, and "upcoming" is everything still ahead. The library's
 * `getSaleStatus` only distinguishes before from at-or-after the opening, so the
 * 24-hour window is applied here and exists so a reader who arrives during a
 * sale sees "open" rather than a list of past events.
 */
export const SALE_OPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

export function saleStatusAt(opensAtIso: string, now: Date): "past" | "open" | "upcoming" {
  const libraryStatus = getSaleStatus({ id: "sale", name: "Sale", opensAtIso }, now);
  if (libraryStatus === "upcoming") return "upcoming";

  const openedAt = Date.parse(opensAtIso);
  const elapsed = now.getTime() - openedAt;
  return elapsed <= SALE_OPEN_WINDOW_MS ? "open" : "past";
}

/**
 * Builds the timeline for an edition.
 *
 * Records are sorted by opening instant so past, open and upcoming interleave
 * chronologically rather than by the order the data file happens to use.
 */
export function buildTimeline(
  records: readonly SaleRecord[],
  edition: TimelineEdition,
  now: Date,
): readonly TimelineSale[] {
  const zone = EDITION_SALE_ZONE[edition];

  return records
    .map((record): TimelineSale => {
      const status = saleStatusAt(record.opensAt, now);
      return {
        id: record.id,
        name: record.name,
        audience: record.audience,
        notes: record.notes,
        opensAtIso: record.opensAt,
        sourceZone: zone,
        status,
        sourceUrl: record.source.url,
        lastVerified: record.lastVerified,
        calendarUid: `${record.id}@tmlguide.com`,
        calendarSummary: `${record.name} — Tomorrowland ${
          edition === "belgium" ? "Belgium" : edition === "winter" ? "Winter" : "Brasil"
        }`,
      };
    })
    .sort((a, b) => Date.parse(a.opensAtIso) - Date.parse(b.opensAtIso));
}

/**
 * The sale the countdown follows: the soonest that has not yet opened.
 *
 * Returns null once every sale has opened, which the UI renders as "no further
 * sales announced" rather than a countdown to zero.
 *
 * @throws RangeError when a record's opening instant is invalid, which the data
 *   schemas already prevent.
 */
export function countdownTarget(
  sales: readonly TimelineSale[],
  now: Date,
): TimelineSale | null {
  const windows: SaleWindow[] = sales.map((sale) => ({
    id: sale.id,
    name: sale.name,
    opensAtIso: sale.opensAtIso,
  }));
  const next = nextSale(windows, now);
  if (next === null) return null;
  return sales.find((sale) => sale.id === next.id) ?? null;
}

/** The countdown to a sale, from the tested `countdown`. */
export function countdownTo(opensAtIso: string, now: Date): Countdown {
  return countdown(opensAtIso, now);
}

/**
 * The instant as two readable strings: the reader's own zone and Brussels.
 *
 * The reader's zone is taken from the browser at call time. If the runtime
 * cannot resolve it, the Brussels form is shown twice rather than throwing.
 */
export interface LocalAndBrussels {
  readonly local: string;
  readonly localZone: string;
  readonly brussels: string;
  /** True when the reader's zone shows a different day from Brussels. */
  readonly dayDiffers: boolean;
}

/**
 * Formats an instant in a named zone in the same shape the tools library uses:
 * "Sat 13 Feb 2027, 17:00 CET".
 *
 * Built from `formatToParts` rather than a single pattern because the pattern
 * differs between ICU versions: en-GB inserts a comma after the weekday in some
 * versions and not others, which would make the two columns of the timeline
 * disagree on punctuation.
 */
function formatInZoneShape(epochMs: number, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
    timeZoneName: "short",
  });

  const parts = formatter.formatToParts(new Date(epochMs));
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${pick("weekday")} ${pick("day")} ${pick("month")} ${pick("year")}, ${pick("hour")}:${pick(
    "minute",
  )} ${pick("timeZoneName")}`;
}

export function describeSaleTime(opensAtIso: string, localZone: string): LocalAndBrussels {
  let brussels: string;
  try {
    brussels = compareTimes(opensAtIso).brussels;
  } catch {
    brussels = opensAtIso;
  }

  const epoch = Date.parse(opensAtIso);

  let local = brussels;
  try {
    local = formatInZoneShape(epoch, localZone);
  } catch {
    // An unknown zone falls back to the festival's own time.
    local = brussels;
  }

  let dayDiffers = false;
  try {
    const comparison = compareTimes(opensAtIso);
    const localDay = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: localZone,
    }).format(new Date(opensAtIso));
    dayDiffers = localDay !== comparison.brusselsDate;
  } catch {
    dayDiffers = false;
  }

  return { local, localZone, brussels, dayDiffers };
}

/** The reader's IANA zone, or UTC when the runtime cannot say. */
export function detectLocalZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
