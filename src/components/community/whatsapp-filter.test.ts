import { describe, expect, it } from "vitest";
import type { WhatsappGroup } from "@/data/schemas";
import { whatsappGroups } from "@/data/community";
import {
  EDITION_LABELS,
  NO_WHATSAPP_FILTERS,
  compareRegions,
  countGroups,
  describeWhatsappResults,
  filterWhatsappGroups,
  groupWhatsappByRegion,
  hasActiveWhatsappFilters,
  matchesWhatsappFilters,
  normaliseSearchText,
  whatsappRegionOptions,
} from "./whatsapp-filter";

function group(overrides: Partial<WhatsappGroup> & Pick<WhatsappGroup, "id">): WhatsappGroup {
  return {
    edition: "belgium",
    title: "Example chat 💬",
    region: "Worldwide",
    inviteUrl: "https://chat.whatsapp.com/example",
    linkStatus: "ok",
    lastLinkCheck: "2026-11-18",
    lastVerified: "2026-11-18",
    confidence: "community",
    source: {
      url: "https://chat.whatsapp.com/example",
      title: "Example chat",
      retrievedOn: "2026-11-18",
    },
    ...overrides,
  };
}

const sample: readonly WhatsappGroup[] = [
  group({ id: "g-world", title: "Solo Travellers ✨", region: "Worldwide", edition: "belgium" }),
  group({
    id: "g-boom",
    title: "DreamVille (Easy Tent) - W1 Group Camp ⛺️",
    region: "DreamVille, Boom, Belgium",
    edition: "belgium",
  }),
  group({
    id: "g-alpe",
    title: "Winter (Alp d'Huez, FR) 🇫🇷",
    region: "Alpe d'Huez, France",
    edition: "winter",
  }),
  group({ id: "g-dubai", title: "Terra Solis (Dubai) 🇦🇪", region: "Dubai, UAE", edition: "all" }),
];

describe("normaliseSearchText", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normaliseSearchText("  Alpe   d'Huez  ")).toBe("alpe d'huez");
  });

  it("leaves an empty string empty", () => {
    expect(normaliseSearchText("   ")).toBe("");
  });
});

describe("matchesWhatsappFilters", () => {
  it("matches everything when no filter is set", () => {
    for (const record of sample) {
      expect(matchesWhatsappFilters(record, NO_WHATSAPP_FILTERS)).toBe(true);
    }
  });

  it("filters by edition, treating 'any' as no filter", () => {
    expect(
      filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, edition: "winter" }).map((g) => g.id),
    ).toEqual(["g-alpe"]);
    expect(filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, edition: "any" })).toHaveLength(4);
  });

  it("reaches the records whose edition is 'all'", () => {
    // "all" is a real data value for city meet-ups, not a synonym for "no filter".
    expect(
      filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, edition: "all" }).map((g) => g.id),
    ).toEqual(["g-dubai"]);
  });

  it("filters by region", () => {
    expect(
      filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, region: "Dubai, UAE" }).map((g) => g.id),
    ).toEqual(["g-dubai"]);
  });

  it("searches titles case-insensitively and ignores padding", () => {
    expect(
      filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, q: "  EASY   TENT " }).map((g) => g.id),
    ).toEqual(["g-boom"]);
  });

  it("requires every search token to appear, so extra words narrow the list", () => {
    expect(filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, q: "dreamville easy" })).toHaveLength(1);
    expect(filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, q: "dreamville dubai" })).toHaveLength(0);
  });

  it("searches the region and the edition label as well as the title", () => {
    expect(
      filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, q: "alpe" }).map((g) => g.id),
    ).toEqual(["g-alpe"]);
    expect(
      filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, q: "other events" }).map((g) => g.id),
    ).toEqual(["g-dubai"]);
  });

  it("combines filters as AND, not OR", () => {
    const result = filterWhatsappGroups(sample, {
      q: "camp",
      edition: "winter",
      region: null,
    });
    expect(result).toHaveLength(0);
  });

  it("returns no records for a query that matches nothing", () => {
    expect(filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, q: "zzzz" })).toHaveLength(0);
  });

  it("never mutates the input array", () => {
    const copy = [...sample];
    filterWhatsappGroups(sample, { ...NO_WHATSAPP_FILTERS, q: "winter" });
    expect(sample).toEqual(copy);
  });
});

describe("edition labels", () => {
  it("labels 'all' as other events rather than claiming every edition", () => {
    expect(EDITION_LABELS.all).toBe("Other events");
    expect(EDITION_LABELS.belgium).toBe("Belgium");
    expect(EDITION_LABELS.winter).toBe("Winter");
    expect(EDITION_LABELS.brasil).toBe("Brasil");
  });
});

describe("compareRegions", () => {
  it("puts Worldwide first and sorts the rest alphabetically", () => {
    const regions = ["Dubai, UAE", "Worldwide", "Alpe d'Huez, France", "Belgium"];
    expect([...regions].sort(compareRegions)).toEqual([
      "Worldwide",
      "Alpe d'Huez, France",
      "Belgium",
      "Dubai, UAE",
    ]);
  });

  it("treats equal regions as equal", () => {
    expect(compareRegions("Belgium", "Belgium")).toBe(0);
  });
});

describe("whatsappRegionOptions", () => {
  it("returns each region once, in display order", () => {
    expect(whatsappRegionOptions(sample)).toEqual([
      "Worldwide",
      "Alpe d'Huez, France",
      "DreamVille, Boom, Belgium",
      "Dubai, UAE",
    ]);
  });

  it("returns an empty list for no groups", () => {
    expect(whatsappRegionOptions([])).toEqual([]);
  });

  it("covers every region in the published data", () => {
    const options = whatsappRegionOptions(whatsappGroups);
    expect(new Set(options).size).toBe(options.length);
    expect(options).toContain("Worldwide");
    for (const group of whatsappGroups) expect(options).toContain(group.region);
  });
});

describe("groupWhatsappByRegion", () => {
  it("buckets records by region and keeps the data order inside each", () => {
    const grouped = groupWhatsappByRegion(sample);
    expect(grouped.map((section) => section.region)).toEqual([
      "Worldwide",
      "Alpe d'Huez, France",
      "DreamVille, Boom, Belgium",
      "Dubai, UAE",
    ]);
    expect(grouped[0].groups.map((g) => g.id)).toEqual(["g-world"]);
  });

  it("accounts for every record it was given", () => {
    const grouped = groupWhatsappByRegion(sample);
    const flat = grouped.flatMap((section) => section.groups);
    expect(flat).toHaveLength(sample.length);
    expect(new Set(flat.map((g) => g.id))).toEqual(new Set(sample.map((g) => g.id)));
  });

  it("returns no sections for no records", () => {
    expect(groupWhatsappByRegion([])).toEqual([]);
  });
});

describe("counts and announcements", () => {
  it("pluralises the group count", () => {
    expect(countGroups(1)).toBe("1 group");
    expect(countGroups(0)).toBe("0 groups");
    expect(countGroups(24)).toBe("24 groups");
  });

  it("says when everything is shown", () => {
    expect(describeWhatsappResults(24, 24)).toBe("Showing all 24 groups.");
  });

  it("names both numbers once a filter hides something", () => {
    expect(describeWhatsappResults(1, 24)).toBe("Showing 1 of 24 groups.");
    expect(describeWhatsappResults(0, 24)).toBe("Showing 0 of 24 groups.");
  });

  it("handles an empty publication without dividing by anything", () => {
    expect(describeWhatsappResults(0, 0)).toBe("No groups are published yet.");
  });
});

describe("hasActiveWhatsappFilters", () => {
  it("is false for the default state", () => {
    expect(hasActiveWhatsappFilters(NO_WHATSAPP_FILTERS)).toBe(false);
  });

  it("ignores a whitespace-only query", () => {
    expect(hasActiveWhatsappFilters({ ...NO_WHATSAPP_FILTERS, q: "   " })).toBe(false);
  });

  it("is true for each filter on its own", () => {
    expect(hasActiveWhatsappFilters({ ...NO_WHATSAPP_FILTERS, q: "x" })).toBe(true);
    expect(hasActiveWhatsappFilters({ ...NO_WHATSAPP_FILTERS, edition: "winter" })).toBe(true);
    expect(hasActiveWhatsappFilters({ ...NO_WHATSAPP_FILTERS, region: "Belgium" })).toBe(true);
  });
});
