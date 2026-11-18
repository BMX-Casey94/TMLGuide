// @vitest-environment node
import { describe, expect, it } from "vitest";

import { editionFestivals, weekendLabel, type OverviewRecord } from "./editions-summary";
import { formatDateRange, formatLongDate } from "./format";

/** Builds an overview record shaped like `src/data/shared/editions.ts`. */
function record(overrides: Partial<OverviewRecord> & { id: string }): OverviewRecord {
  return {
    name: "Tomorrowland Belgium 2027",
    guideEdition: "belgium",
    startsOn: "2027-07-16",
    endsOn: "2027-07-18",
    venue: "De Schorre recreation area",
    location: "Boom, Belgium",
    status: "upcoming",
    ...overrides,
  };
}

describe("weekendLabel", () => {
  it("takes the label the record's own name carries", () => {
    expect(weekendLabel("Tomorrowland Belgium 2027 — Weekend 1")).toBe("Weekend 1");
    expect(weekendLabel("Tomorrowland Belgium 2027 — Weekend 2")).toBe("Weekend 2");
  });

  it("returns null when the name carries no suffix, rather than labelling by position", () => {
    expect(weekendLabel("Tomorrowland Winter 2027")).toBeNull();
    expect(weekendLabel("Tomorrowland Brasil 2027 — ")).toBeNull();
  });
});

describe("editionFestivals", () => {
  it("groups the two Belgium weekends under one edition", () => {
    const festivals = editionFestivals([
      record({ id: "belgium-2027", name: "Tomorrowland Belgium 2027 — Weekend 1" }),
      record({
        id: "belgium-2027-weekend-2",
        name: "Tomorrowland Belgium 2027 — Weekend 2",
        startsOn: "2027-07-23",
        endsOn: "2027-07-25",
      }),
    ]);

    const belgium = festivals.find((festival) => festival.id === "belgium");
    expect(belgium?.dates).toHaveLength(2);
    expect(belgium?.dates.map((entry) => entry.label)).toEqual(["Weekend 1", "Weekend 2"]);
    expect(belgium?.location).toBe("Boom, Belgium");
  });

  it("keeps the three editions in a fixed order regardless of input order", () => {
    const festivals = editionFestivals([
      record({ id: "brasil", guideEdition: "brasil", location: "Itu, São Paulo, Brazil" }),
      record({ id: "winter", guideEdition: "winter", location: "Alpe d'Huez, France" }),
      record({ id: "belgium" }),
    ]);

    expect(festivals.map((festival) => festival.id)).toEqual(["belgium", "winter", "brasil"]);
  });

  it("drops a record that belongs to no edition guide", () => {
    const festivals = editionFestivals([
      record({ id: "thailand", guideEdition: undefined }),
      record({ id: "belgium" }),
    ]);

    const belgium = festivals.find((festival) => festival.id === "belgium");
    expect(belgium?.dates).toHaveLength(1);
    expect(festivals.some((festival) => festival.dates.length === 0)).toBe(true);
  });

  it("drops a past edition, so the page lists only dates a reader can plan around", () => {
    const festivals = editionFestivals([
      record({ id: "belgium-2026", status: "past", startsOn: "2026-07-17", endsOn: "2026-07-19" }),
      record({ id: "belgium-2027" }),
    ]);

    const belgium = festivals.find((festival) => festival.id === "belgium");
    expect(belgium?.dates).toHaveLength(1);
    expect(belgium?.dates[0].startsOn).toBe("2027-07-16");
  });

  it("omits the location when the edition's records disagree, rather than picking one", () => {
    const festivals = editionFestivals([
      record({ id: "belgium-2027", location: "Boom, Belgium" }),
      record({ id: "belgium-2027-weekend-2", location: "Rumst, Belgium" }),
    ]);

    expect(festivals.find((festival) => festival.id === "belgium")?.location).toBeNull();
  });

  it("accepts a sold-out edition, because its dates are still real", () => {
    const festivals = editionFestivals([
      record({ id: "thailand", guideEdition: "brasil", status: "sold-out" }),
    ]);
    expect(festivals.find((festival) => festival.id === "brasil")?.dates).toHaveLength(1);
  });

  it("returns all three editions even with no records at all", () => {
    expect(editionFestivals([])).toHaveLength(3);
  });
});

describe("formatDateRange", () => {
  it("repeats only the parts that differ within one month", () => {
    expect(formatDateRange("2027-07-16", "2027-07-18")).toBe("16–18 July 2027");
  });

  it("names both months when the run crosses a month boundary", () => {
    expect(formatDateRange("2027-04-30", "2027-05-02")).toBe("30 April – 2 May 2027");
  });

  it("names both years when the run crosses a year boundary", () => {
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("30 December 2026 – 2 January 2027");
  });

  it("collapses a single-day run", () => {
    expect(formatDateRange("2027-07-16", "2027-07-16")).toBe("16 July 2027");
  });

  it("abbreviates the month on request", () => {
    expect(formatDateRange("2027-07-16", "2027-07-18", { month: "short" })).toBe("16–18 Jul 2027");
  });

  it("reads the date in UTC, so no reader sees the day shift", () => {
    // A date-only string parsed as local midnight would show 15 July west of UTC.
    expect(formatDateRange("2027-07-16", "2027-07-18")).toContain("16");
    expect(formatLongDate("2026-11-18")).toBe("18 November 2026");
  });

  it("rejects an impossible date instead of rolling it into the next month", () => {
    expect(() => formatDateRange("2027-02-30", "2027-03-02")).toThrow(RangeError);
    expect(() => formatDateRange("2027-13-01", "2027-13-02")).toThrow(RangeError);
    expect(() => formatLongDate("not-a-date")).toThrow(RangeError);
  });
});
