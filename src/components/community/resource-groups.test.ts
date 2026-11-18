import { describe, expect, it } from "vitest";
import { resources } from "@/data/community";
import {
  RESOURCE_CATEGORY_LABELS,
  groupResourcesByCategory,
  isDocumentLink,
  resourceBadge,
  resourceProvenance,
} from "./resource-groups";

describe("resourceProvenance", () => {
  it("calls a record official only when its confidence says so", () => {
    for (const resource of resources) {
      if (resource.confidence === "official") {
        expect(resourceProvenance(resource)).toBe("official");
      } else {
        expect(resourceProvenance(resource)).not.toBe("official");
      }
    }
  });

  it("does not promote a record just because its category is 'official'", () => {
    // resource-apps sits in the official category but points at a lnk.to shortener.
    const apps = resources.find((resource) => resource.id === "resource-apps");
    expect(apps).toBeDefined();
    expect(apps?.category).toBe("official");
    expect(apps?.confidence).not.toBe("official");
    expect(resourceProvenance(apps!)).toBe("third-party");
  });

  it("separates community chats from third-party tools", () => {
    const fraud = resources.find((resource) => resource.id === "resource-fraud");
    expect(resourceProvenance(fraud!)).toBe("community");
  });
});

describe("resourceBadge", () => {
  it("labels third-party tools with the exact required wording", () => {
    const thirdParty = resources.filter((resource) => resourceProvenance(resource) === "third-party");
    expect(thirdParty.length).toBeGreaterThan(0);
    for (const resource of thirdParty) {
      expect(resourceBadge(resource)).toBe("Unofficial third-party tool");
    }
  });

  it("gives official records the Official badge and nothing else", () => {
    const official = resources.filter((resource) => resourceProvenance(resource) === "official");
    expect(official.length).toBeGreaterThan(0);
    for (const resource of official) {
      expect(resourceBadge(resource)).toBe("Official");
    }
  });

  it("never returns an empty string for a badge", () => {
    for (const resource of resources) {
      const badge = resourceBadge(resource);
      expect(badge === null || badge.length > 0).toBe(true);
    }
  });
});

describe("groupResourcesByCategory", () => {
  it("includes every record exactly once", () => {
    const grouped = groupResourcesByCategory(resources).flatMap((group) => group.resources);
    expect(grouped).toHaveLength(resources.length);
    expect(new Set(grouped.map((resource) => resource.id)).size).toBe(resources.length);
  });

  it("omits empty categories", () => {
    for (const group of groupResourcesByCategory(resources)) {
      expect(group.resources.length).toBeGreaterThan(0);
    }
  });

  it("puts the official group first", () => {
    const groups = groupResourcesByCategory(resources);
    expect(groups[0].category).toBe("official");
  });

  it("gives each group a human label", () => {
    for (const group of groupResourcesByCategory(resources)) {
      expect(group.label).toBe(RESOURCE_CATEGORY_LABELS[group.category]);
      expect(group.label.length).toBeGreaterThan(0);
    }
  });

  it("returns nothing for an empty list", () => {
    expect(groupResourcesByCategory([])).toEqual([]);
  });
});

describe("isDocumentLink", () => {
  it("recognises Drive documents", () => {
    const packing = resources.find((resource) => resource.id === "resource-packing");
    expect(isDocumentLink(packing!)).toBe(true);
  });

  it("does not treat an ordinary site as a document", () => {
    const site = resources.find((resource) => resource.id === "resource-official");
    expect(isDocumentLink(site!)).toBe(false);
  });
});

describe("resource data invariants the page relies on", () => {
  it("gives every record an https link", () => {
    for (const resource of resources) {
      expect(resource.url.startsWith("https://")).toBe(true);
    }
  });

  it("gives every record a title and description to print", () => {
    for (const resource of resources) {
      expect(resource.title.trim().length).toBeGreaterThan(0);
      expect(resource.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("badges every third-party record as an unofficial tool", () => {
    // The wording is what carries the claim; the description is where the
    // record's own caveat lives, and several are Drive documents rather than
    // tools, so they say "not re-checked" instead of repeating "third-party".
    for (const resource of resources) {
      if (resourceProvenance(resource) !== "third-party") continue;
      expect(resourceBadge(resource)).toBe("Unofficial third-party tool");
    }
  });

  it("says 'third-party' in the description of each third-party site the data marks that way", () => {
    const thirdPartySites = resources.filter((resource) =>
      resource.url.includes("festivalviewer.com"),
    );
    expect(thirdPartySites.length).toBeGreaterThan(0);
    for (const resource of thirdPartySites) {
      expect(resource.description.toLowerCase()).toContain("third-party");
    }
  });
});
