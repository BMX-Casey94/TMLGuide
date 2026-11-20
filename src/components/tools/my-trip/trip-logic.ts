import { currencyForEdition, type ToolCurrency, type ToolEdition } from "../editions";
import { formatMoney } from "../format";
import type { TripField, TripState } from "./trip-state";
import { FREE_TEXT_MAX, MAX_PARTY_SIZE, MIN_PARTY_SIZE } from "./trip-state";

/**
 * Everything the trip sheet derives from the data layer, and nothing it makes up.
 *
 * The page narrows the validated data into {@link TripData} on the server, so
 * the browser never receives the whole dataset and this module never imports
 * it. Every function here is pure: data in, value out, no clock, no storage and
 * no DOM. That is what lets the test suite check printed figures against the
 * real data files.
 *
 * Two rules run through the module:
 *
 * - A figure is printed only when the data holds it. A record with no price
 *   prints "Price not published"; a record that names no year prints "Price year
 *   not published". Neither is filled in with a guess.
 * - A reference the data no longer holds is cleared, never remapped. A stored
 *   weekend that has dropped out of the data becomes "nothing chosen", and the
 *   page says which fields it cleared.
 */

/* ---------------------------------------------------------------------------------------------
 * Narrowed data handed to the browser
 * ------------------------------------------------------------------------------------------- */

/** A dated weekend or week, from the shared editions overview. */
export interface TripSlot {
  readonly id: string;
  /** The record's own name, for example "Tomorrowland Belgium 2027 — Weekend 1". */
  readonly name: string;
  /** The name with the record's dates appended, for the control. */
  readonly label: string;
  readonly startsOn: string;
  readonly endsOn: string;
  /** The calendar year the dates fall in, read from `startsOn`. */
  readonly year: number;
  /** A weekend runs four days or fewer; a Winter week runs longer. */
  readonly kind: "weekend" | "week";
}

/** A ticket the edition publishes. */
export interface TripTicket {
  readonly id: string;
  readonly name: string;
  /**
   * Price for one person in minor units of the edition's currency, or null when
   * the record carries no figure this tool can print.
   */
  readonly priceMinor: number | null;
  /** The year the record attributes the price to, or null when it names none. */
  readonly priceYear: number | null;
  /** The record's own inclusion list, joined for display. */
  readonly detail: string;
  /** True when the data marks the product as sold out. */
  readonly soldOut: boolean;
  readonly sourceUrl: string;
  /** The source page's own title, exactly as the record cites it. */
  readonly sourceTitle: string;
  readonly lastVerified: string;
}

/** A verified accommodation package the edition publishes. */
export interface TripPackage {
  readonly id: string;
  readonly name: string;
  readonly priceMinor: number | null;
  readonly priceYear: number | null;
  /** How many people the package covers, as published. */
  readonly capacity: number;
  /** The record's own description, or a plain note about what the price covers. */
  readonly detail: string;
  readonly soldOut: boolean;
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  readonly lastVerified: string;
}

/** A published sale window, as the dates panel needs it. */
export interface TripSaleWindow {
  readonly id: string;
  readonly name: string;
  readonly opensAtIso: string;
  /** The zone the organisers quote the time in. */
  readonly timeZone: string;
  readonly audience: string;
  readonly notes?: string;
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  readonly lastVerified: string;
}

/** A guide chapter link, resolved on the server so the browser receives a path only. */
export interface TripChapterLink {
  readonly href: string;
  readonly label: string;
  readonly why: string;
}

/** One edition's share of the trip sheet. */
export interface EditionTripData {
  readonly edition: ToolEdition;
  readonly label: string;
  readonly currency: ToolCurrency;
  readonly slots: readonly TripSlot[];
  readonly tickets: readonly TripTicket[];
  readonly packages: readonly TripPackage[];
  /** Why the package list is short or empty, in the data's own terms. */
  readonly packagesNote: string;
  readonly saleWindows: readonly TripSaleWindow[];
  readonly chapters: readonly TripChapterLink[];
}

/** The whole sheet's data: one entry per edition. */
export type TripData = Readonly<Record<ToolEdition, EditionTripData>>;

/** The currency an edition's figures use. */
export function tripCurrency(edition: ToolEdition): ToolCurrency {
  return currencyForEdition(edition);
}

/* ---------------------------------------------------------------------------------------------
 * Turning validated records into what the page prints
 * ------------------------------------------------------------------------------------------- */

/** Converts a euro figure from the data into exact minor units. */
export function euroToMinor(priceEur: number): number {
  return Math.round(priceEur * 100);
}

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Reads a YYYY-MM-DD date without going through the local-time `Date` parser. */
function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** "16–18 July 2027", or "30 April 2027 to 2 May 2027" across a month boundary. */
export function formatDateRange(startsOn: string, endsOn: string): string {
  const start = parseIsoDate(startsOn);
  const end = parseIsoDate(endsOn);
  if (start === null || end === null) return `${startsOn} to ${endsOn}`;

  const startMonth = MONTHS_LONG[start.month - 1];
  if (start.year === end.year && start.month === end.month) {
    return `${start.day}–${end.day} ${startMonth} ${start.year}`;
  }
  return `${start.day} ${startMonth} ${start.year} to ${end.day} ${MONTHS_LONG[end.month - 1]} ${end.year}`;
}

/** Reduces a shared-editions record to a slot. */
export function toSlot(record: {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
}): TripSlot {
  const start = Date.parse(`${record.startsOn}T00:00:00Z`);
  const end = Date.parse(`${record.endsOn}T00:00:00Z`);
  const days = Math.max(1, Math.round((end - start) / 86_400_000) + 1);
  return {
    id: record.id,
    name: record.name,
    label: `${record.name} — ${formatDateRange(record.startsOn, record.endsOn)}`,
    startsOn: record.startsOn,
    endsOn: record.endsOn,
    year: Number(record.startsOn.slice(0, 4)),
    kind: days > 4 ? "week" : "weekend",
  };
}

/**
 * The year a price belongs to, read from the record's own wording.
 *
 * Every priced record names its year somewhere: in the product name ("Day Pass
 * — 2027 edition"), in the source page's title ("… 2027 prices"), or in the
 * notes ("The published 2027 price is…"). The three are checked in that order,
 * because the name sits closest to the figure and the notes are where a
 * correction is explained.
 *
 * Returns null when nothing names a year, so the page prints that the year is
 * unpublished. A year supplied by this tool would be its own claim rather than
 * the data's.
 */
export function priceYearFromRecord(record: {
  readonly name: string;
  readonly notes?: string | undefined;
  readonly source: { readonly title: string };
}): number | null {
  for (const text of [record.name, record.source.title, record.notes ?? ""]) {
    const match = /\b(20\d{2})\b/.exec(text);
    if (match !== null) return Number(match[1]);
  }
  return null;
}

/** Reduces a ticket-package record to a ticket. */
export function toTicket(
  record: {
    id: string;
    name: string;
    includes: readonly string[];
    source: { url: string; title: string };
    lastVerified: string;
    notes?: string | undefined;
  },
  priceMinor: number | null,
  soldOut = false,
): TripTicket {
  return {
    id: record.id,
    name: record.name,
    priceMinor,
    priceYear: priceYearFromRecord(record),
    detail: record.includes.join("; "),
    soldOut,
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    lastVerified: record.lastVerified,
  };
}

/**
 * The dated slots offered for an edition: its own weekends or week, in date
 * order, and nothing else.
 *
 * A record for a festival that has already happened is not a trip a reader can
 * plan, so past editions are excluded. What is left is whatever the organisers
 * have dated for the edition the guide covers.
 */
export function slotsForEdition(
  editions: readonly {
    id: string;
    name: string;
    startsOn: string;
    endsOn: string;
    guideEdition?: ToolEdition | undefined;
    status: "past" | "sold-out" | "on-sale" | "upcoming";
  }[],
  edition: ToolEdition,
): readonly TripSlot[] {
  return editions
    .filter((record) => record.guideEdition === edition && record.status !== "past")
    .map((record) => toSlot(record))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

/** A price with its currency, or the honest alternative when there is none. */
export function priceLabel(
  record: { readonly priceMinor: number | null },
  currency: ToolCurrency,
): string {
  if (record.priceMinor === null) return "Price not published";
  return formatMoney(record.priceMinor, currency);
}

/** The year a price belongs to, or the honest alternative when there is none. */
export function priceYearLabel(priceYear: number | null): string {
  return priceYear === null ? "Price year not published" : `${priceYear} price`;
}

/* ---------------------------------------------------------------------------------------------
 * Repairing a sheet against the data
 * ------------------------------------------------------------------------------------------- */

export interface TripRepair {
  readonly state: TripState;
  readonly repaired: readonly TripField[];
}

/**
 * Clears any reference the edition's data no longer holds, and bounds the rest.
 *
 * This runs on every read from storage and on every import, so a weekend or
 * ticket that has been withdrawn becomes "nothing chosen" instead of a name
 * printed from a stale copy. It also clamps the party size and trims free text,
 * so a hand-edited file cannot put a 5,000-character note on the page.
 *
 * The edition itself is left alone: a sheet naming another edition is switched
 * to that edition by the page, not silently rewritten here.
 */
export function repairTripAgainstEdition(state: TripState, data: EditionTripData): TripRepair {
  const repaired: TripField[] = [];
  let next = state;

  if (state.slotId !== null && !data.slots.some((slot) => slot.id === state.slotId)) {
    next = { ...next, slotId: null };
    repaired.push("slotId");
  }
  if (state.ticketId !== null && !data.tickets.some((ticket) => ticket.id === state.ticketId)) {
    next = { ...next, ticketId: null };
    repaired.push("ticketId");
  }
  if (state.packageId !== null && !data.packages.some((pkg) => pkg.id === state.packageId)) {
    next = { ...next, packageId: null };
    repaired.push("packageId");
  }

  if (
    !Number.isInteger(next.partySize) ||
    next.partySize < MIN_PARTY_SIZE ||
    next.partySize > MAX_PARTY_SIZE
  ) {
    const bounded = Number.isFinite(next.partySize)
      ? Math.min(MAX_PARTY_SIZE, Math.max(MIN_PARTY_SIZE, Math.trunc(next.partySize)))
      : MIN_PARTY_SIZE;
    next = { ...next, partySize: bounded };
    repaired.push("partySize");
  }

  for (const field of ["accommodationNote", "travelNote", "notes"] as const) {
    const value = next[field];
    if (typeof value !== "string") {
      next = { ...next, [field]: "" };
      repaired.push(field);
      continue;
    }
    if (value.length > FREE_TEXT_MAX) {
      next = { ...next, [field]: value.slice(0, FREE_TEXT_MAX) };
      repaired.push(field);
    }
  }

  return { state: next, repaired };
}

/* ---------------------------------------------------------------------------------------------
 * Sale windows
 * ------------------------------------------------------------------------------------------- */

export type WindowStatus = "past" | "open" | "upcoming";

/** How long after opening a window still counts as open, matching the timeline. */
export const OPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

/** One sale window, ready to print. */
export interface TripWindowView {
  readonly id: string;
  readonly name: string;
  /** The opening instant exactly as the data states it, for a `<time>` element. */
  readonly opensAtIso: string;
  readonly audience: string;
  readonly notes: string | undefined;
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  readonly lastVerified: string;
  /** The instant in the reader's own zone, or null until the browser has been read. */
  readonly local: string | null;
  readonly localZone: string | null;
  /** The instant in the zone the organisers published it in, with that zone's abbreviation. */
  readonly source: string;
  readonly sourceZone: string;
  /** True when the reader's zone and the published zone fall on different days. */
  readonly dayDiffers: boolean;
  /** Null until the browser's clock is available. */
  readonly status: WindowStatus | null;
}

/**
 * Formats an instant in a named zone as "Sat 13 Feb 2027, 17:00 CET".
 *
 * Assembled from `formatToParts` for the reason the sale timeline does it: a
 * single pattern drifts between ICU versions, and two columns of dates that
 * disagree on a comma read like two different events.
 */
export function formatInstantInZone(epochMs: number, timeZone: string): string {
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
  return `${pick("weekday")} ${pick("day")} ${pick("month")} ${pick("year")}, ${pick(
    "hour",
  )}:${pick("minute")} ${pick("timeZoneName")}`;
}

/** The calendar day an instant falls on in a zone, as YYYY-MM-DD. */
function dayInZone(epochMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(epochMs));
}

/** Classifies a window against a clock, or returns null when there is no clock yet. */
export function windowStatusAt(opensAtIso: string, now: Date | null): WindowStatus | null {
  if (now === null) return null;
  const opensAt = Date.parse(opensAtIso);
  if (!Number.isFinite(opensAt)) return null;
  const elapsed = now.getTime() - opensAt;
  if (elapsed < 0) return "upcoming";
  return elapsed <= OPEN_WINDOW_MS ? "open" : "past";
}

/**
 * Builds the dates panel's rows.
 *
 * Nothing is read from the clock here: `now` and `localZone` are supplied by the
 * caller, which keeps the server render deterministic. Before the browser has
 * been read, `localZone` is null and each row shows the published zone alone,
 * labelled as such rather than presented as the reader's own.
 */
export function buildWindowViews(
  windows: readonly TripSaleWindow[],
  localZone: string | null,
  now: Date | null,
): readonly TripWindowView[] {
  return [...windows]
    .sort((a, b) => Date.parse(a.opensAtIso) - Date.parse(b.opensAtIso))
    .map((window): TripWindowView => {
      const epoch = Date.parse(window.opensAtIso);
      const valid = Number.isFinite(epoch);

      let source = window.opensAtIso;
      let local: string | null = null;
      let dayDiffers = false;

      if (valid) {
        try {
          source = formatInstantInZone(epoch, window.timeZone);
        } catch {
          source = window.opensAtIso;
        }
        if (localZone !== null) {
          try {
            local = formatInstantInZone(epoch, localZone);
            dayDiffers = dayInZone(epoch, localZone) !== dayInZone(epoch, window.timeZone);
          } catch {
            // An unknown zone falls back to the published one, labelled as such.
            local = null;
          }
        }
      }

      return {
        id: window.id,
        name: window.name,
        opensAtIso: window.opensAtIso,
        audience: window.audience,
        notes: window.notes,
        sourceUrl: window.sourceUrl,
        sourceTitle: window.sourceTitle,
        lastVerified: window.lastVerified,
        local,
        localZone: local === null ? null : localZone,
        source,
        sourceZone: window.timeZone,
        dayDiffers,
        status: windowStatusAt(window.opensAtIso, now),
      };
    });
}

/** A window's state in words. Always printed, so colour is never the only signal. */
export const WINDOW_STATUS_LABEL: Readonly<Record<WindowStatus, string>> = {
  past: "Closed",
  open: "Open now",
  upcoming: "Upcoming",
};

/* ---------------------------------------------------------------------------------------------
 * Next steps
 * ------------------------------------------------------------------------------------------- */

/** One link in the next-steps panel. */
export interface TripLink {
  readonly href: string;
  readonly label: string;
  readonly why: string;
}

/**
 * Tools that answer the next question about a trip, and exist today.
 *
 * A typed constant rather than literal JSX, so a test can assert every `href` is
 * a `/tools/` route and that no pending route leaks into the rendered list.
 */
export const TOOL_STEPS: readonly TripLink[] = [
  {
    href: "/tools/budget",
    label: "Budget calculator",
    why: "Price the ticket, the journey and everything on site before you commit.",
  },
  {
    href: "/tools/pearls",
    label: "Pearl calculator",
    why: "Work out what a top-up buys, at a rate you supply, because no 2027 rate is published.",
  },
  {
    href: "/tools/sale-timeline",
    label: "Ticket sale timeline",
    why: "Every published sale with a countdown, and a calendar file you can download.",
  },
  {
    href: "/tools/journey",
    label: "Journey planner",
    why: "Work out how to get to Belgium or Winter from the published shuttle, rail and parking facts.",
  },
  {
    href: "/tools/packing",
    label: "Packing list",
    why: "What to bring, by edition, separating official rules from ordinary travel suggestions.",
  },
];

/**
 * Tools planned for later waves that are not live yet.
 *
 * Kept here, typed, and deliberately **not** rendered until their pages land.
 */
export const PENDING_TOOL_LINKS: readonly TripLink[] = [];

/**
 * The guide chapters that continue each edition's trip.
 *
 * Slugs only: the link text and the check that the chapter exists both come from
 * `src/content` on the server, so a chapter that is renamed or withdrawn drops
 * out of the panel instead of becoming a dead link.
 */
export const EDITION_CHAPTER_SLUGS: Readonly<
  Record<ToolEdition, readonly { readonly slug: string; readonly why: string }[]>
> = {
  belgium: [
    { slug: "tickets", why: "Which pass covers which days, and what each one includes." },
    { slug: "dreamville", why: "How the campsite works: check-in, opening hours and the walk in." },
    { slug: "transport", why: "Getting to Boom, including the official shuttle and train routes." },
    { slug: "dates-and-sales", why: "The sale moments, the Exchange Desk and the ticket cap." },
  ],
  winter: [
    { slug: "tickets-and-packages", why: "The festival ticket and the package structure." },
    { slug: "accommodation", why: "How lodging is sold, and why no 2027 price is published." },
    { slug: "transport", why: "Getting up the mountain, and the transportation pass." },
    { slug: "clothing-and-lockers", why: "What to wear on the mountain and what to store." },
  ],
  brasil: [
    { slug: "tickets", why: "Every published pass and package, priced in reais." },
    { slug: "dreamville", why: "The campsite next to Parque Maeda, and how a stay runs." },
    { slug: "transport", why: "Shuttle passes and how arrivals work at Itu." },
    { slug: "overview", why: "The dates, the venue and the 2027 theme." },
  ],
};

/** What the server returns for a chapter slug that exists. */
export interface ResolvedChapter {
  readonly href: string;
  readonly title: string;
}

/** Resolves an edition's chapter links, dropping any slug the registry lacks. */
export function resolveChapterLinks(
  edition: ToolEdition,
  resolve: (slug: string) => ResolvedChapter | null,
): readonly TripChapterLink[] {
  const links: TripChapterLink[] = [];
  for (const entry of EDITION_CHAPTER_SLUGS[edition]) {
    const chapter = resolve(entry.slug);
    if (chapter === null) continue;
    links.push({ href: chapter.href, label: chapter.title, why: entry.why });
  }
  return links;
}

/** Every next-step link the panel renders: tools first, then guide chapters. */
export function nextStepsFor(data: EditionTripData): readonly TripLink[] {
  return [...TOOL_STEPS, ...data.chapters];
}

/* ---------------------------------------------------------------------------------------------
 * What the sheet currently holds
 * ------------------------------------------------------------------------------------------- */

/** The chosen slot, or null. */
export function selectedSlot(state: TripState, data: EditionTripData): TripSlot | null {
  if (state.slotId === null) return null;
  return data.slots.find((slot) => slot.id === state.slotId) ?? null;
}

/** The chosen ticket, or null. */
export function selectedTicket(state: TripState, data: EditionTripData): TripTicket | null {
  if (state.ticketId === null) return null;
  return data.tickets.find((ticket) => ticket.id === state.ticketId) ?? null;
}

/** The chosen package, or null. */
export function selectedPackage(state: TripState, data: EditionTripData): TripPackage | null {
  if (state.packageId === null) return null;
  return data.packages.find((pkg) => pkg.id === state.packageId) ?? null;
}

/** True when the sheet holds nothing a reader chose or typed. */
export function isTripEmpty(state: TripState): boolean {
  return (
    state.slotId === null &&
    state.ticketId === null &&
    state.packageId === null &&
    state.accommodationNote === "" &&
    state.travelNote === "" &&
    state.notes === "" &&
    state.partySize === MIN_PARTY_SIZE
  );
}

/**
 * What a sheet has not got yet, as sentences a reader can act on.
 *
 * Deliberately not a score or a percentage: a trip is not a form to finish, and
 * a number would imply this tool knows when a plan is ready.
 */
export function missingParts(state: TripState): readonly string[] {
  const missing: string[] = [];
  if (state.slotId === null) missing.push("Choose the weekend or week you are going to.");
  if (state.ticketId === null) {
    missing.push("Choose the ticket you hold, or leave it and come back when you have one.");
  }
  if (state.accommodationNote === "" && state.packageId === null) {
    missing.push("Note where you are staying.");
  }
  if (state.travelNote === "") missing.push("Note how you are getting there.");
  return missing;
}
