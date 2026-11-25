import { describe, expect, it } from "vitest";
import { DE_SCHORRE_MAP, DREAMVILLE_MAP } from "./maps-data";
import { estimateWalkRoute, formatMiles, isEdgeInPath } from "./maps-logic";

describe("formatMiles", () => {
  it("formats singular and plural miles cleanly without km", () => {
    expect(formatMiles(0)).toBe("0 miles");
    expect(formatMiles(1)).toBe("1 mile");
    expect(formatMiles(0.45)).toBe("0.45 miles");
    expect(formatMiles(0.5)).toBe("0.5 miles");
    expect(formatMiles(1.234)).toBe("1.23 miles");
  });
});

describe("estimateWalkRoute", () => {
  it("computes the shortest footpath across De Schorre", () => {
    const result = estimateWalkRoute(DE_SCHORRE_MAP, "main-entrance", "mainstage");
    expect(result).not.toBeNull();
    expect(result?.isSameZone).toBe(false);
    expect(result?.pathNodeIds[0]).toBe("main-entrance");
    expect(result?.pathNodeIds[result.pathNodeIds.length - 1]).toBe("mainstage");
    expect(result?.normalMinutes).toBeGreaterThan(0);
    expect(result?.distanceMiles).toBeGreaterThan(0);
    expect(result?.peakMinutesMin).toBeGreaterThan(result?.normalMinutes ?? 0);
    expect(result?.peakMinutesMax).toBeGreaterThan(result?.peakMinutesMin ?? 0);
  });

  it("is symmetric for undirected walking paths", () => {
    const forward = estimateWalkRoute(DE_SCHORRE_MAP, "freedom", "mainstage");
    const reverse = estimateWalkRoute(DE_SCHORRE_MAP, "mainstage", "freedom");
    expect(forward?.normalMinutes).toBe(reverse?.normalMinutes);
    expect(forward?.distanceMiles).toBe(reverse?.distanceMiles);
  });

  it("computes DreamVille walking routes from Magnificent Greens to Festival Entrance", () => {
    const result = estimateWalkRoute(DREAMVILLE_MAP, "magnificent-greens", "festival-entrance");
    expect(result).not.toBeNull();
    expect(result?.pathNodeIds[0]).toBe("magnificent-greens");
    expect(result?.pathNodeIds[result.pathNodeIds.length - 1]).toBe("festival-entrance");
    expect(result?.normalMinutes).toBeGreaterThanOrEqual(20);
    expect(result?.distanceMiles).toBeGreaterThan(0.7);
  });

  it("handles same-zone selection gracefully", () => {
    const result = estimateWalkRoute(DE_SCHORRE_MAP, "core", "core");
    expect(result?.isSameZone).toBe(true);
    expect(result?.normalMinutes).toBe(0);
    expect(result?.distanceMiles).toBe(0);
    expect(result?.edges).toHaveLength(0);
  });

  it("returns null for unknown zone IDs", () => {
    expect(estimateWalkRoute(DE_SCHORRE_MAP, "unknown", "mainstage")).toBeNull();
    expect(estimateWalkRoute(DREAMVILLE_MAP, "montagoe", "missing")).toBeNull();
  });

  it("connects every pair of nodes on both maps", () => {
    for (const map of [DE_SCHORRE_MAP, DREAMVILLE_MAP]) {
      for (const a of map.nodes) {
        for (const b of map.nodes) {
          const estimate = estimateWalkRoute(map, a.id, b.id);
          expect(estimate, `${map.id}: ${a.id} -> ${b.id}`).not.toBeNull();
        }
      }
    }
  });
});

describe("isEdgeInPath", () => {
  it("matches edges in either direction along a path", () => {
    const path = ["main-entrance", "crystal-garden", "mainstage"];
    expect(isEdgeInPath({ from: "main-entrance", to: "crystal-garden" }, path)).toBe(true);
    expect(isEdgeInPath({ from: "crystal-garden", to: "main-entrance" }, path)).toBe(true);
    expect(isEdgeInPath({ from: "freedom", to: "atmosphere" }, path)).toBe(false);
  });
});
