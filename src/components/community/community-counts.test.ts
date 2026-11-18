import { describe, expect, it } from "vitest";
import { partners, resources, whatsappGroups } from "@/data/community";
import { communityCounts, groupsByEdition, whatsappSummary } from "./community-counts";

describe("communityCounts", () => {
  it("counts each collection", () => {
    const counts = communityCounts(whatsappGroups, resources, partners);
    expect(counts.whatsappGroups).toBe(whatsappGroups.length);
    expect(counts.resources).toBe(resources.length);
    expect(counts.partners).toBe(partners.length);
  });

  it("counts the records that genuinely claim official provenance", () => {
    const counts = communityCounts(whatsappGroups, resources, partners);
    expect(counts.officialResources).toBe(
      resources.filter((resource) => resource.confidence === "official").length,
    );
    // A real number, not zero: the badge is on the page because some records earn it.
    expect(counts.officialResources).toBeGreaterThan(0);
    expect(counts.officialResources).toBeLessThan(counts.resources);
  });

  it("handles empty collections", () => {
    expect(communityCounts([], [], [])).toEqual({
      whatsappGroups: 0,
      resources: 0,
      partners: 0,
      officialResources: 0,
    });
  });
});

describe("groupsByEdition", () => {
  it("reports a count for every edition value, including zero", () => {
    const counts = groupsByEdition(whatsappGroups);
    expect(Object.keys(counts).sort()).toEqual(["all", "belgium", "brasil", "winter"]);
    for (const value of Object.values(counts)) expect(value).toBeGreaterThanOrEqual(0);
  });

  it("adds up to the whole collection", () => {
    const counts = groupsByEdition(whatsappGroups);
    const total = counts.belgium + counts.winter + counts.brasil + counts.all;
    expect(total).toBe(whatsappGroups.length);
  });

  it("finds the records that belong to no single edition", () => {
    expect(groupsByEdition(whatsappGroups).all).toBeGreaterThan(0);
  });
});

describe("whatsappSummary", () => {
  it("states the number of groups and regions", () => {
    const summary = whatsappSummary(whatsappGroups);
    expect(summary).toContain(String(whatsappGroups.length));
    expect(summary).toContain("checked");
  });

  it("uses the singular for one region", () => {
    expect(whatsappSummary([whatsappGroups[0]])).toContain("1 region");
  });

  it("has an honest line for an empty publication", () => {
    expect(whatsappSummary([])).toBe("No community groups are published yet.");
  });
});
