import { chapterPath, getChapter } from "@/content";
import {
  accommodation as belgiumAccommodation,
  saleWindows as belgiumSaleWindows,
  tickets as belgiumTickets,
} from "@/data/belgium";
import {
  brasilDreamvillePackages,
  brasilSaleWindows,
  brasilTickets,
} from "@/data/brasil";
import { editions } from "@/data/shared";
import { winterAccommodation, winterSaleWindows, winterTickets } from "@/data/winter";
import { EDITION_LABEL, type ToolEdition } from "@/components/tools/editions";
import {
  euroToMinor,
  priceYearFromRecord,
  resolveChapterLinks,
  slotsForEdition,
  toTicket,
  type EditionTripData,
  type TripData,
  type TripPackage,
  type TripSaleWindow,
} from "@/components/tools/my-trip/trip-logic";

/**
 * Builds the trip sheet's data on the server, from the validated data layer.
 *
 * This module runs only in a Server Component, so the browser receives three
 * small objects rather than three editions' worth of records. Every value below
 * comes from `src/data/**` except the `why` sentences for guide chapters, which
 * are prose about what a chapter covers, not a fact about the festival.
 *
 * Nothing is inferred where the data is silent. A Winter trip offers no
 * accommodation package because `winterAccommodation` is empty, and the panel
 * says so in `packagesNote` instead of listing a guessed hotel.
 */

/** Belgium tickets, priced from the record's euro figure. */
function belgiumTicketRows(): EditionTripData["tickets"] {
  return belgiumTickets.map((ticket) => toTicket(ticket, euroToMinor(ticket.priceEur)));
}

/** Winter tickets: one published price, and one record. */
function winterTicketRows(): EditionTripData["tickets"] {
  return winterTickets.map((ticket) => toTicket(ticket, euroToMinor(ticket.priceEur)));
}

/**
 * Brasil tickets, priced in reais.
 *
 * `price.amount` is a whole number of reais, so multiplying by 100 gives
 * centavos exactly. Every 2027 Brasil product is currently sold out, which the
 * record states and the control shows; the figure is still published, so it is
 * still printed.
 */
function brasilTicketRows(): EditionTripData["tickets"] {
  return brasilTickets.map((ticket) =>
    toTicket(
      {
        id: ticket.id,
        name: ticket.name,
        includes: [ticket.notes],
        notes: ticket.notes,
        source: ticket.source,
        lastVerified: ticket.lastVerified,
      },
      ticket.price.amount * 100,
      ticket.availability === "sold-out",
    ),
  );
}

/** Belgium DreamVille packages, each a whole-stay total for its stated capacity. */
function belgiumPackages(): readonly TripPackage[] {
  return belgiumAccommodation.map((record) => ({
    id: record.id,
    name: record.name,
    priceMinor: euroToMinor(record.nightlyOrTotalEur),
    priceYear: priceYearFromRecord(record),
    capacity: record.capacity,
    detail: record.pricing === "per-stay" ? "Total for the whole stay" : "Price per night",
    soldOut: false,
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    lastVerified: record.lastVerified,
  }));
}

/**
 * Winter packages.
 *
 * Mapped from `winterAccommodation` rather than written as an empty list, so
 * the control fills itself the day the organisers publish a Winter
 * accommodation price. Today that collection is empty, which the panel explains
 * in `packagesNote`.
 */
function winterPackages(): readonly TripPackage[] {
  return winterAccommodation.map((record) => ({
    id: record.id,
    name: record.name,
    priceMinor: euroToMinor(record.nightlyOrTotalEur),
    priceYear: priceYearFromRecord(record),
    capacity: record.capacity,
    detail: record.pricing === "per-stay" ? "Total for the whole stay" : "Price per night",
    soldOut: false,
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    lastVerified: record.lastVerified,
  }));
}

/** Brasil DreamVille packages, priced in reais for the published capacity. */
function brasilPackages(): readonly TripPackage[] {
  return brasilDreamvillePackages.map((record) => ({
    id: record.id,
    name: record.name,
    priceMinor: record.price.amount * 100,
    priceYear: priceYearFromRecord(record),
    capacity: record.capacity,
    detail: record.notes,
    soldOut: record.availability === "sold-out",
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    lastVerified: record.lastVerified,
  }));
}

/** Belgium sale windows, narrowed to the fields the dates panel prints. */
function belgiumWindows(): readonly TripSaleWindow[] {
  return belgiumSaleWindows.map((window) => ({
    id: window.id,
    name: window.name,
    opensAtIso: window.opensAt,
    timeZone: window.timeZone,
    audience: window.audience,
    ...(window.notes === undefined ? {} : { notes: window.notes }),
    sourceUrl: window.source.url,
    sourceTitle: window.source.title,
    lastVerified: window.lastVerified,
  }));
}

function winterWindows(): readonly TripSaleWindow[] {
  return winterSaleWindows.map((window) => ({
    id: window.id,
    name: window.name,
    opensAtIso: window.opensAt,
    timeZone: window.timeZone,
    audience: window.audience,
    ...(window.notes === undefined ? {} : { notes: window.notes }),
    sourceUrl: window.source.url,
    sourceTitle: window.source.title,
    lastVerified: window.lastVerified,
  }));
}

function brasilWindows(): readonly TripSaleWindow[] {
  return brasilSaleWindows.map((window) => ({
    id: window.id,
    name: window.name,
    opensAtIso: window.opensAt,
    timeZone: window.timeZone,
    audience: window.audience,
    ...(window.notes === undefined ? {} : { notes: window.notes }),
    sourceUrl: window.source.url,
    sourceTitle: window.source.title,
    lastVerified: window.lastVerified,
  }));
}

/**
 * Resolves an edition's chapter links against the live content registry.
 *
 * A slug absent from `src/content` is dropped, so a chapter that is renamed or
 * withdrawn leaves a shorter list rather than a 404.
 */
function chaptersFor(edition: ToolEdition): EditionTripData["chapters"] {
  return resolveChapterLinks(edition, (slug: string) => {
    const chapter = getChapter(edition, slug);
    if (chapter === null) return null;
    return { href: chapterPath(chapter), title: chapter.title };
  });
}

function slots(edition: ToolEdition) {
  return slotsForEdition(editions, edition);
}

/** Assembles the whole data object. */
export function buildTripData(): TripData {
  return {
    belgium: {
      edition: "belgium",
      label: EDITION_LABEL.belgium,
      currency: "EUR",
      slots: slots("belgium"),
      tickets: belgiumTicketRows(),
      packages: belgiumPackages(),
      packagesNote:
        "DreamVille packages are sold as one purchase that includes a festival pass. A package price is therefore not added to a ticket price in the budget tool; it replaces it.",
      saleWindows: belgiumWindows(),
      chapters: chaptersFor("belgium"),
    },
    winter: {
      edition: "winter",
      label: EDITION_LABEL.winter,
      currency: "EUR",
      slots: slots("winter"),
      tickets: winterTicketRows(),
      packages: winterPackages(),
      packagesNote:
        "No Winter 2027 accommodation price is published: lodging is sold only inside a package, and the package sale shows sold out with no minimum. There is nothing to choose here rather than a list to fill in.",
      saleWindows: winterWindows(),
      chapters: chaptersFor("winter"),
    },
    brasil: {
      edition: "brasil",
      label: EDITION_LABEL.brasil,
      currency: "BRL",
      slots: slots("brasil"),
      tickets: brasilTicketRows(),
      packages: brasilPackages(),
      packagesNote:
        "DreamVille package prices are in reais for the whole stay, for the number of people the package states. Every 2027 Brasil package is currently sold out.",
      saleWindows: brasilWindows(),
      chapters: chaptersFor("brasil"),
    },
  };
}
