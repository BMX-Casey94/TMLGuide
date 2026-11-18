// @vitest-environment node
import { describe, expect, it } from "vitest";

import { belgiumData } from "@/data/belgium";
import { brasilData } from "@/data/brasil";
import { winterData } from "@/data/winter";
import {
  SALE_EDITION_LABELS,
  editionSaleWindows,
  nextSaleFrom,
  nextSaleNow,
  type EditionSaleWindow,
} from "./next-sale";

/** A sale window shaped like the real records, for hand-made cases. */
function window(overrides: Partial<EditionSaleWindow> & { opensAtIso: string }): EditionSaleWindow {
  return {
    edition: "belgium",
    id: "test-sale",
    name: "Test sale",
    timeZone: "Europe/Brussels",
    audience: "Everyone",
    source: {
      url: "https://belgium.tomorrowland.com/en/",
      title: "Official",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    ...overrides,
  };
}

describe("editionSaleWindows", () => {
  it("merges every edition's verified sale moments", () => {
    const windows = editionSaleWindows();

    expect(windows).toHaveLength(
      belgiumData.saleWindows.length +
        winterData.saleWindows.length +
        brasilData.saleWindows.length,
    );
    expect(new Set(windows.map((entry) => entry.edition))).toEqual(
      new Set(["belgium", "winter", "brasil"]),
    );
  });

  it("carries each window's own zone and source through unchanged", () => {
    const windows = editionSaleWindows();
    const belgium = windows.find((entry) => entry.id === "worldwide-ticket-sale");
    const brasil = windows.find((entry) => entry.id === "worldwide-ticket-sale-2026");

    expect(belgium?.timeZone).toBe("Europe/Brussels");
    expect(belgium?.opensAtIso).toBe("2027-02-13T17:00:00+01:00");
    expect(brasil?.timeZone).toBe("America/Sao_Paulo");
    expect(brasil?.source.url).toMatch(/^https:\/\//);
  });

  it("has a display label for every edition it can return", () => {
    for (const entry of editionSaleWindows()) {
      expect(SALE_EDITION_LABELS[entry.edition]).toBeTruthy();
    }
  });
});

describe("nextSaleFrom", () => {
  const past = window({ id: "past", opensAtIso: "2026-01-01T17:00:00+01:00" });
  const soon = window({ id: "soon", opensAtIso: "2027-01-30T17:00:00+01:00" });
  const later = window({ id: "later", opensAtIso: "2027-02-13T17:00:00+01:00" });

  it("picks the soonest window still ahead of now", () => {
    const result = nextSaleFrom([later, past, soon], new Date("2026-11-18T12:00:00Z"));
    expect(result?.window.id).toBe("soon");
  });

  it("ignores a sale that has already opened", () => {
    const result = nextSaleFrom([past, later], new Date("2026-11-18T12:00:00Z"));
    expect(result?.window.id).toBe("later");
  });

  it("treats a sale opening exactly now as already open, matching the countdown", () => {
    const now = new Date("2027-01-30T16:00:00Z");
    const result = nextSaleFrom([soon, later], now);
    expect(result?.window.id).toBe("later");
    expect(result?.countdown.totalSeconds).toBeGreaterThan(0);
  });

  it("returns null when every window has opened", () => {
    expect(nextSaleFrom([past], new Date("2026-11-18T12:00:00Z"))).toBeNull();
    expect(nextSaleFrom([], new Date("2026-11-18T12:00:00Z"))).toBeNull();
  });

  it("breaks a tie by id, so the answer does not depend on array order", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    const alpha = window({ id: "alpha", opensAtIso: "2027-01-30T17:00:00+01:00" });
    const bravo = window({ id: "bravo", opensAtIso: "2027-01-30T17:00:00+01:00" });

    expect(nextSaleFrom([alpha, bravo], now)?.window.id).toBe("alpha");
    expect(nextSaleFrom([bravo, alpha], now)?.window.id).toBe("alpha");
  });

  it("breaks a tie across editions rather than by which edition was read first", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    const belgium = window({ edition: "belgium", id: "same", opensAtIso: "2027-01-30T17:00:00+01:00" });
    const winter = window({
      edition: "winter",
      id: "same",
      opensAtIso: "2027-01-30T17:00:00+01:00",
      timeZone: "Europe/Brussels",
    });

    // "belgium:same" sorts before "winter:same", whichever way the list arrives.
    expect(nextSaleFrom([belgium, winter], now)?.window.edition).toBe("belgium");
    expect(nextSaleFrom([winter, belgium], now)?.window.edition).toBe("belgium");
  });

  it("compares absolute instants, so a later wall clock in another zone loses", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    // 17:00 in Brussels (+01:00) is 16:00Z; 11:00 in São Paulo (-03:00) is 14:00Z, so Brazil is first.
    const brussels = window({ id: "brussels", opensAtIso: "2027-01-30T17:00:00+01:00" });
    const saoPaulo = window({
      edition: "brasil",
      id: "sao-paulo",
      timeZone: "America/Sao_Paulo",
      opensAtIso: "2027-01-30T11:00:00-03:00",
    });

    expect(nextSaleFrom([brussels, saoPaulo], now)?.window.id).toBe("sao-paulo");
  });

  it("formats the opening in the sale's own zone and in London", () => {
    const result = nextSaleFrom([soon], new Date("2026-11-18T12:00:00Z"));

    // 17:00 CET in Brussels, 16:00 GMT in London: winter, so an hour apart.
    expect(result?.localLabel).toContain("17:00");
    expect(result?.localLabel).toContain("CET");
    expect(result?.londonLabel).toContain("16:00");
    expect(result?.londonLabel).toContain("GMT");
  });

  it("reports a countdown whose units match the distance", () => {
    const result = nextSaleFrom([soon], new Date("2027-01-30T15:00:00Z"));
    expect(result?.countdown.days).toBe(0);
    expect(result?.countdown.hours).toBe(1);
    expect(result?.countdown.minutes).toBe(0);
    expect(result?.countdown.isPast).toBe(false);
  });

  it("rejects a stored opening time with no offset rather than guessing a zone", () => {
    const broken = window({ opensAtIso: "2027-01-30T17:00:00" });
    expect(() => nextSaleFrom([broken], new Date("2026-11-18T12:00:00Z"))).toThrow(RangeError);
  });
});

describe("nextSaleNow", () => {
  it("finds the next real sale from the site's own data", () => {
    // 18 November 2026: the Winter add-on sale on 26 November is the next moment.
    const result = nextSaleNow(new Date("2026-11-18T12:00:00Z"));

    expect(result).not.toBeNull();
    expect(result?.window.id).toBe("add-on-sale-2027");
    expect(result?.window.edition).toBe("winter");
    expect(result?.localLabel).toContain("26 Nov 2026");
  });

  it("moves to the next edition once the Winter add-on sale has opened", () => {
    // One minute after the Winter add-on sale opens, Belgium's Global Journey sale is next.
    const result = nextSaleNow(new Date("2026-11-26T14:01:00Z"));

    expect(result?.window.id).toBe("global-journey-sale");
    expect(result?.window.edition).toBe("belgium");
  });

  it("returns null once every verified sale has opened", () => {
    expect(nextSaleNow(new Date("2027-06-01T12:00:00Z"))).toBeNull();
  });
});
