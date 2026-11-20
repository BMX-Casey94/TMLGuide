import { describe, expect, it } from "vitest";
import { allChapters, chapterPath } from "@/content";
import { accommodation as belgiumAccommodation, saleWindows as belgiumSaleWindows, tickets as belgiumTickets } from "@/data/belgium";
import { brasilDreamvillePackages, brasilSaleWindows, brasilTickets } from "@/data/brasil";
import { editions } from "@/data/shared";
import { winterAccommodation, winterSaleWindows, winterTickets } from "@/data/winter";
import { buildTripData } from "./trip-data";

/**
 * Every fact the sheet prints, traced back to the record it came from.
 *
 * The tool's promise is that a figure on screen is the published figure, with
 * the published name and the page it was read from. These tests hold that
 * promise mechanically: they walk the narrowed data the page hands the browser
 * and look each value up in the source collection, so a hand-typed price or a
 * renamed product fails here rather than in front of a reader.
 *
 * The data is narrowed on the server, so this suite reads the same function the
 * page calls.
 */

const data = buildTripData();

describe("dated slots", () => {
  it("offers only editions the shared overview dates, and only live ones", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      for (const slot of data[edition].slots) {
        const record = editions.find((candidate) => candidate.id === slot.id);
        expect(record, `${slot.id} is not in the editions overview`).toBeDefined();
        expect(record?.guideEdition).toBe(edition);
        expect(record?.startsOn).toBe(slot.startsOn);
        expect(record?.endsOn).toBe(slot.endsOn);
        expect(record?.name).toBe(slot.name);
        // A festival that has already happened is not a trip to plan.
        expect(record?.status).not.toBe("past");
      }
    }
  });

  it("offers every live dated record for the edition, so nothing published is hidden", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      const expected = editions
        .filter((record) => record.guideEdition === edition && record.status !== "past")
        .map((record) => record.id);
      expect(data[edition].slots.map((slot) => slot.id)).toEqual(expected);
    }
  });

  it("reads the year from the record's own start date", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      for (const slot of data[edition].slots) {
        expect(slot.year).toBe(Number(slot.startsOn.slice(0, 4)));
      }
    }
  });

  it("marks Winter's single week as a week and Belgium's weekends as weekends", () => {
    for (const slot of data.belgium.slots) expect(slot.kind).toBe("weekend");
    for (const slot of data.winter.slots) expect(slot.kind).toBe("week");
    for (const slot of data.brasil.slots) expect(slot.kind).toBe("weekend");
  });
});

describe("tickets", () => {
  it("carries every published Belgium ticket with its exact published price", () => {
    expect(data.belgium.tickets).toHaveLength(belgiumTickets.length);
    for (const ticket of data.belgium.tickets) {
      const record = belgiumTickets.find((candidate) => candidate.id === ticket.id);
      expect(record, `${ticket.id} is not a Belgium ticket record`).toBeDefined();
      expect(ticket.name).toBe(record?.name);
      expect(ticket.priceMinor).toBe(Math.round((record?.priceEur ?? 0) * 100));
      expect(ticket.sourceUrl).toBe(record?.source.url);
      expect(ticket.sourceTitle).toBe(record?.source.title);
      expect(ticket.lastVerified).toBe(record?.lastVerified);
    }
  });

  it("carries the single published Winter ticket and no invented one", () => {
    expect(data.winter.tickets).toHaveLength(winterTickets.length);
    const winter = data.winter.tickets[0];
    expect(winter?.id).toBe("seven-day-festival-ticket-2027");
    expect(winter?.priceMinor).toBe(73_500);
  });

  it("keeps Brasil prices in reais and never converts them", () => {
    expect(data.brasil.currency).toBe("BRL");
    expect(data.brasil.tickets).toHaveLength(brasilTickets.length);
    for (const ticket of data.brasil.tickets) {
      const record = brasilTickets.find((candidate) => candidate.id === ticket.id);
      expect(record, `${ticket.id} is not a Brasil ticket record`).toBeDefined();
      expect(record?.price.currency).toBe("BRL");
      // A whole number of reais scaled to centavos, which is exact.
      expect(ticket.priceMinor).toBe((record?.price.amount ?? 0) * 100);
    }
  });

  it("states the year only where the record names one", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      for (const ticket of data[edition].tickets) {
        if (ticket.priceYear === null) continue;
        const recordText = `${ticket.name} ${ticket.sourceTitle} ${ticket.detail}`;
        expect(recordText).toContain(String(ticket.priceYear));
      }
    }
    // Every Belgium and Winter 2027 product names its year, so none is unknown.
    for (const ticket of [...data.belgium.tickets, ...data.winter.tickets]) {
      expect(ticket.priceYear).toBe(2027);
    }
  });

  it("marks a sold-out product as sold out and leaves the others alone", () => {
    for (const ticket of data.belgium.tickets) expect(ticket.soldOut).toBe(false);
    for (const ticket of data.winter.tickets) expect(ticket.soldOut).toBe(false);
    for (const ticket of data.brasil.tickets) {
      const record = brasilTickets.find((candidate) => candidate.id === ticket.id);
      expect(ticket.soldOut).toBe(record?.availability === "sold-out");
    }
  });

  it("never prints a price it does not have", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      for (const ticket of data[edition].tickets) {
        expect(ticket.priceMinor).not.toBeNull();
        expect(Number.isInteger(ticket.priceMinor)).toBe(true);
      }
    }
  });
});

describe("packages", () => {
  it("carries every Belgium accommodation record at its published total", () => {
    expect(data.belgium.packages).toHaveLength(belgiumAccommodation.length);
    for (const pkg of data.belgium.packages) {
      const record = belgiumAccommodation.find((candidate) => candidate.id === pkg.id);
      expect(record, `${pkg.id} is not a Belgium accommodation record`).toBeDefined();
      expect(pkg.name).toBe(record?.name);
      expect(pkg.priceMinor).toBe(Math.round((record?.nightlyOrTotalEur ?? 0) * 100));
      expect(pkg.capacity).toBe(record?.capacity);
      expect(pkg.sourceUrl).toBe(record?.source.url);
      expect(pkg.sourceTitle).toBe(record?.source.title);
    }
  });

  it("offers no Winter package, because the data publishes no Winter price", () => {
    expect(winterAccommodation).toHaveLength(0);
    expect(data.winter.packages).toHaveLength(0);
    // The panel explains the absence rather than leaving an empty control.
    expect(data.winter.packagesNote).toMatch(/no Winter 2027 accommodation price is published/i);
  });

  it("carries every Brasil DreamVille package in reais", () => {
    expect(data.brasil.packages).toHaveLength(brasilDreamvillePackages.length);
    for (const pkg of data.brasil.packages) {
      const record = brasilDreamvillePackages.find((candidate) => candidate.id === pkg.id);
      expect(record, `${pkg.id} is not a Brasil package record`).toBeDefined();
      expect(pkg.priceMinor).toBe((record?.price.amount ?? 0) * 100);
      expect(pkg.capacity).toBe(record?.capacity);
      expect(pkg.soldOut).toBe(record?.availability === "sold-out");
    }
  });

  it("prints the capacity the record publishes, not the party size", () => {
    for (const pkg of data.belgium.packages) {
      const record = belgiumAccommodation.find((candidate) => candidate.id === pkg.id);
      expect(pkg.capacity).toBe(record?.capacity);
    }
  });
});

describe("sale windows", () => {
  it("carries every Belgium sale window, unchanged", () => {
    expect(data.belgium.saleWindows).toHaveLength(belgiumSaleWindows.length);
    for (const window of data.belgium.saleWindows) {
      const record = belgiumSaleWindows.find((candidate) => candidate.id === window.id);
      expect(record, `${window.id} is not a Belgium sale window`).toBeDefined();
      expect(window.opensAtIso).toBe(record?.opensAt);
      expect(window.timeZone).toBe(record?.timeZone);
      expect(window.name).toBe(record?.name);
      expect(window.sourceUrl).toBe(record?.source.url);
    }
  });

  it("carries the Winter add-on sale and every Brasil window", () => {
    expect(data.winter.saleWindows).toHaveLength(winterSaleWindows.length);
    expect(data.brasil.saleWindows).toHaveLength(brasilSaleWindows.length);
    for (const window of data.brasil.saleWindows) {
      const record = brasilSaleWindows.find((candidate) => candidate.id === window.id);
      expect(window.timeZone).toBe(record?.timeZone);
      expect(window.opensAtIso).toBe(record?.opensAt);
    }
  });

  it("keeps the published zone, so the CET/CEST wording is the organisers' own", () => {
    for (const window of data.belgium.saleWindows) expect(window.timeZone).toBe("Europe/Brussels");
    for (const window of data.winter.saleWindows) expect(window.timeZone).toBe("Europe/Brussels");
    for (const window of data.brasil.saleWindows) expect(window.timeZone).toBe("America/Sao_Paulo");
  });

  it("reads from the same records the sale timeline reads", () => {
    // Both tools read `saleWindows` from the edition module, so an id present in
    // one is present in the other.
    const timelineIds = new Set(belgiumSaleWindows.map((window) => window.id));
    for (const window of data.belgium.saleWindows) {
      expect(timelineIds.has(window.id)).toBe(true);
    }
  });
});

describe("guide chapters", () => {
  it("links only chapters that exist in the content registry", () => {
    const paths = new Set(allChapters().map((chapter) => chapterPath(chapter)));
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      for (const chapter of data[edition].chapters) {
        expect(paths.has(chapter.href), `${chapter.href} is not a chapter`).toBe(true);
        expect(chapter.href.startsWith(`/guides/${edition}/`)).toBe(true);
      }
    }
  });

  it("takes each label from the chapter's own title", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      for (const link of data[edition].chapters) {
        const chapter = allChapters().find((candidate) => chapterPath(candidate) === link.href);
        expect(link.label).toBe(chapter?.title);
      }
    }
  });

  it("has at least one chapter per edition", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      expect(data[edition].chapters.length).toBeGreaterThan(0);
    }
  });
});

describe("sources", () => {
  it("cites an https page and a check date for every priced record", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      for (const record of [...data[edition].tickets, ...data[edition].packages]) {
        expect(record.sourceUrl.startsWith("https://")).toBe(true);
        expect(record.sourceTitle.length).toBeGreaterThan(0);
        expect(record.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      for (const window of data[edition].saleWindows) {
        expect(window.sourceUrl.startsWith("https://")).toBe(true);
        expect(window.sourceTitle.length).toBeGreaterThan(0);
      }
    }
  });
});
