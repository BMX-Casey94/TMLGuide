// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ALL_VENUE_MAP,
  CROSS_VENUE_ALIAS_ID,
  CROSS_VENUE_NODE_ID,
  DE_SCHORRE_MAP,
  DREAMVILLE_MAP,
  FESTIVAL_PACE_MPH,
  FOOTPATH_WINDING_FACTOR,
  GEO_DATA_DISCLAIMER,
  PHYSICAL_VENUE_MAPS,
  VENUE_BOUNDS,
  VENUE_MAPS,
  physicalVenueOfNode,
  walkingMinutesFor,
} from "./geo-data";
import {
  distanceToBoundsMiles,
  filterNodes,
  findShortestRoute,
  haversineMiles,
  nearestNode,
  nodeById,
  routeBetween,
} from "./geo-routing";
import type {
  GeoJsonPosition,
  GeoMap,
  GeoMapEdge,
  GeoMapNode,
  MapNodeCategory,
  PhysicalVenueId,
  VenueMapId,
} from "./geo-types";

/** The two physical venues. The combined view is checked separately. */
const MAPS: readonly GeoMap[] = [DE_SCHORRE_MAP, DREAMVILLE_MAP];

/** Every view the switcher offers, combined one included. */
const ALL_VIEWS: readonly GeoMap[] = [DE_SCHORRE_MAP, DREAMVILLE_MAP, ALL_VENUE_MAP];

/** The window the data must stay inside: Boom and Rumst, and nothing else. */
const BOUNDS = { south: 51.08, west: 4.36, north: 51.11, east: 4.42 } as const;

/** Two decimal places, matching the rounding the data module applies. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positionOf(node: GeoMapNode): GeoJsonPosition {
  return [node.lng, node.lat];
}

function inBounds(position: GeoJsonPosition): boolean {
  const [lng, lat] = position;
  return lat >= BOUNDS.south && lat <= BOUNDS.north && lng >= BOUNDS.west && lng <= BOUNDS.east;
}

/** The straight-line length of an edge, recomputed from the node coordinates. */
function straightLineMiles(map: GeoMap, edge: GeoMapEdge): number {
  const from = nodeById(map, edge.from);
  const to = nodeById(map, edge.to);
  if (from === null || to === null) throw new Error(`edge ${edge.from} → ${edge.to} is dangling`);
  return haversineMiles(positionOf(from), positionOf(to));
}

/** An undirected neighbour list built from a map's edges, for brute-force checks. */
function neighbours(map: GeoMap): ReadonlyMap<string, readonly { id: string; edge: GeoMapEdge }[]> {
  const list = new Map<string, { id: string; edge: GeoMapEdge }[]>();
  for (const edge of map.edges) {
    if (!list.has(edge.from)) list.set(edge.from, []);
    if (!list.has(edge.to)) list.set(edge.to, []);
    list.get(edge.from)?.push({ id: edge.to, edge });
    list.get(edge.to)?.push({ id: edge.from, edge });
  }
  return list;
}

/**
 * The cheapest walk between two nodes, found by enumerating every simple path.
 * Exponential, but the graphs here are small enough that it is instant, and it
 * gives an independent answer to check Dijkstra against.
 */
function bruteForceMiles(map: GeoMap, fromId: string, toId: string): number | null {
  const adjacency = neighbours(map);
  let best: number | null = null;

  const walk = (current: string, cost: number, seen: ReadonlySet<string>): void => {
    if (current === toId) {
      if (best === null || cost < best) best = cost;
      return;
    }
    for (const link of adjacency.get(current) ?? []) {
      if (seen.has(link.id)) continue;
      const next = new Set(seen);
      next.add(link.id);
      walk(link.id, cost + link.edge.distanceMiles, next);
    }
  };

  walk(fromId, 0, new Set([fromId]));
  return best;
}

/** Ray casting: true when `point` lies inside the ring. */
function pointInRing(point: GeoJsonPosition, ring: readonly GeoJsonPosition[]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i] as GeoJsonPosition;
    const b = ring[j] as GeoJsonPosition;
    const crosses = a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }

  return inside;
}

/** A map with two nodes and no edge between them, for the unreachable case. */
const DISCONNECTED_MAP: GeoMap = {
  id: "de-schorre",
  name: "Disconnected fixture",
  disclaimer: "Test fixture.",
  centre: [4.38, 51.09],
  bounds: { south: 51.085, west: 4.375, north: 51.095, east: 4.385 },
  nodes: [
    {
      id: "island-a",
      name: "Island A",
      shortLabel: "A",
      category: "facility",
      lng: 4.377,
      lat: 51.089,
      summary: "A test node.",
      typicalZoneNote: "Quiet.",
    },
    {
      id: "island-b",
      name: "Island B",
      shortLabel: "B",
      category: "facility",
      lng: 4.383,
      lat: 51.091,
      summary: "A second test node.",
      typicalZoneNote: "Quieter.",
    },
  ],
  edges: [],
  overlays: { type: "FeatureCollection", features: [] },
};

/** A map with no nodes at all, for the empty-graph branch of `nearestNode`. */
const DISCONNECTED_MAP_EMPTY: GeoMap = {
  id: "all",
  name: "Empty fixture",
  disclaimer: "Test fixture.",
  centre: [4.38, 51.09],
  bounds: { south: 51.085, west: 4.375, north: 51.095, east: 4.385 },
  nodes: [],
  edges: [],
  overlays: { type: "FeatureCollection", features: [] },
};

describe("venue maps", () => {
  it("exposes both venues under their ids, plus the combined site view", () => {
    expect(VENUE_MAPS["de-schorre"]).toBe(DE_SCHORRE_MAP);
    expect(VENUE_MAPS.dreamville).toBe(DREAMVILLE_MAP);
    expect(VENUE_MAPS.all).toBe(ALL_VENUE_MAP);
    expect(Object.keys(VENUE_MAPS).sort()).toEqual(["all", "de-schorre", "dreamville"]);
  });

  it("keeps the stored-favourites lookup to the two physical venues", () => {
    // A favourite is a place, not a view, so the combined map gets no bucket.
    expect(Object.keys(PHYSICAL_VENUE_MAPS).sort()).toEqual(["de-schorre", "dreamville"]);
    expect(PHYSICAL_VENUE_MAPS["de-schorre"]).toBe(DE_SCHORRE_MAP);
    expect(PHYSICAL_VENUE_MAPS.dreamville).toBe(DREAMVILLE_MAP);
  });

  it("attributes every node of the combined view to one of the two venues", () => {
    for (const node of ALL_VENUE_MAP.nodes) {
      const venue = physicalVenueOfNode(node.id);
      expect(venue, `${node.id} belongs to neither venue`).not.toBeNull();
      expect(["de-schorre", "dreamville"]).toContain(venue);
    }
    expect(physicalVenueOfNode("not-a-node")).toBeNull();
    expect(physicalVenueOfNode("ds-mainstage")).toBe("de-schorre");
    expect(physicalVenueOfNode("dv-montagoe")).toBe("dreamville");
  });

  it("carries the honesty disclaimer on every view", () => {
    for (const map of ALL_VIEWS) {
      expect(map.disclaimer).toBe(GEO_DATA_DISCLAIMER);
      expect(map.disclaimer).toContain("2027");
      expect(map.disclaimer.toLowerCase()).toContain("not published");
    }
  });

  it("names the towns each venue sits in", () => {
    expect(DE_SCHORRE_MAP.name).toContain("Boom");
    expect(DREAMVILLE_MAP.name).toContain("Rumst");
  });

  it("gives every node a unique id and the text the UI needs", () => {
    for (const map of MAPS) {
      const ids = map.nodes.map((node) => node.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => id.trim() !== "")).toBe(true);

      for (const node of map.nodes) {
        expect(node.name.trim()).not.toBe("");
        expect(node.shortLabel.trim()).not.toBe("");
        expect(node.summary.trim().length).toBeGreaterThan(20);
        expect(node.typicalZoneNote.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it("covers every category the legend offers", () => {
    const all = new Set<MapNodeCategory>(MAPS.flatMap((map) => map.nodes.map((node) => node.category)));
    expect([...all].sort()).toEqual(["camp", "entrance", "facility", "stage", "transport"]);
  });

  it("puts De Schorre's stages and the campsite's fields on the right maps", () => {
    const deSchorreCamps = DE_SCHORRE_MAP.nodes.filter((node) => node.category === "camp");
    expect(deSchorreCamps).toHaveLength(0);

    const campIds = DREAMVILLE_MAP.nodes.filter((node) => node.category === "camp").map((node) => node.id);
    expect(campIds).toEqual(
      expect.arrayContaining([
        "dv-montagoe",
        "dv-easy-tent",
        "dv-magnificent-greens",
        "dv-friendship-garden",
      ]),
    );
  });

  it("keeps the requested places on both sides", () => {
    const deSchorreIds = DE_SCHORRE_MAP.nodes.map((node) => node.id);
    expect(deSchorreIds).toEqual(
      expect.arrayContaining([
        "ds-mainstage",
        "ds-freedom",
        "ds-atmosphere",
        "ds-crystal-garden",
        "ds-library",
        "ds-core",
        "ds-rose-garden",
        "ds-main-entrance",
        "ds-dreamville-gate",
        "ds-first-aid",
        "ds-lockers-main",
        "ds-lockers-dreamville",
      ]),
    );

    const dreamvilleIds = DREAMVILLE_MAP.nodes.map((node) => node.id);
    expect(dreamvilleIds).toEqual(
      expect.arrayContaining([
        "dv-main-entrance",
        "dv-marketplace",
        "dv-magnificent-greens",
        "dv-easy-tent",
        "dv-montagoe",
        "dv-friendship-garden",
        "dv-gathering-stage",
        "dv-rainbow-walkway",
      ]),
    );
  });
});

describe("coordinates", () => {
  it("places every node inside the Boom and Rumst window", () => {
    for (const map of MAPS) {
      for (const node of map.nodes) {
        expect(inBounds(positionOf(node)), `${node.id} at ${node.lng},${node.lat}`).toBe(true);
      }
    }
  });

  it("places every overlay vertex inside the Boom and Rumst window", () => {
    for (const map of MAPS) {
      for (const feature of map.overlays.features) {
        const { geometry } = feature;
        const positions: GeoJsonPosition[] =
          geometry.type === "Point"
            ? [geometry.coordinates]
            : geometry.type === "LineString"
              ? [...geometry.coordinates]
              : geometry.type === "Polygon"
                ? geometry.coordinates.flatMap((ring) => [...ring])
                : geometry.coordinates.flatMap((polygon) => polygon.flatMap((ring) => [...ring]));

        expect(positions.length).toBeGreaterThan(0);
        for (const position of positions) {
          expect(inBounds(position), `${feature.id ?? "feature"} at ${position[0]},${position[1]}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("keeps each venue's declared bounds around its own content", () => {
    for (const map of MAPS) {
      for (const node of map.nodes) {
        expect(node.lat).toBeGreaterThanOrEqual(map.bounds.south);
        expect(node.lat).toBeLessThanOrEqual(map.bounds.north);
        expect(node.lng).toBeGreaterThanOrEqual(map.bounds.west);
        expect(node.lng).toBeLessThanOrEqual(map.bounds.east);
      }

      const [centreLng, centreLat] = map.centre;
      expect(centreLng).toBeGreaterThanOrEqual(map.bounds.west);
      expect(centreLng).toBeLessThanOrEqual(map.bounds.east);
      expect(centreLat).toBeGreaterThanOrEqual(map.bounds.south);
      expect(centreLat).toBeLessThanOrEqual(map.bounds.north);
    }
  });

  it("keeps DreamVille east of De Schorre, and the two venues apart", () => {
    const westernmostDreamville = Math.min(...DREAMVILLE_MAP.nodes.map((node) => node.lng));
    const easternmostDeSchorre = Math.max(...DE_SCHORRE_MAP.nodes.map((node) => node.lng));

    // The campsite's own fields start east of the festival's own ground, while
    // the two touching gates sit within a short walk of each other.
    expect(westernmostDreamville).toBeGreaterThan(easternmostDeSchorre - 0.001);

    const festivalGate = nodeById(DE_SCHORRE_MAP, "ds-dreamville-gate");
    const campsiteGate = nodeById(DREAMVILLE_MAP, "dv-festival-gate");
    expect(festivalGate).not.toBeNull();
    expect(campsiteGate).not.toBeNull();

    const gateGap = haversineMiles(positionOf(festivalGate as GeoMapNode), positionOf(campsiteGate as GeoMapNode));
    expect(gateGap).toBeLessThan(0.5);
  });

  it("matches the expected spread of each venue to within a few hundred metres", () => {
    const mainstage = nodeById(DE_SCHORRE_MAP, "ds-mainstage") as GeoMapNode;
    const freedom = nodeById(DE_SCHORRE_MAP, "ds-freedom") as GeoMapNode;
    expect(haversineMiles(positionOf(mainstage), positionOf(freedom))).toBeGreaterThan(0.3);
    expect(haversineMiles(positionOf(mainstage), positionOf(freedom))).toBeLessThan(0.9);

    const entrance = nodeById(DREAMVILLE_MAP, "dv-main-entrance") as GeoMapNode;
    const greens = nodeById(DREAMVILLE_MAP, "dv-magnificent-greens") as GeoMapNode;
    expect(haversineMiles(positionOf(entrance), positionOf(greens))).toBeLessThan(0.75);
  });
});

describe("footpath edges", () => {
  it("only references nodes that exist on the same map", () => {
    for (const map of MAPS) {
      const ids = new Set(map.nodes.map((node) => node.id));
      for (const edge of map.edges) {
        expect(ids.has(edge.from), `${edge.from} is not on ${map.id}`).toBe(true);
        expect(ids.has(edge.to), `${edge.to} is not on ${map.id}`).toBe(true);
        expect(edge.from).not.toBe(edge.to);
      }
    }
  });

  it("links each pair once and never duplicates an edge", () => {
    for (const map of MAPS) {
      const seen = new Set<string>();
      for (const edge of map.edges) {
        const key = [edge.from, edge.to].sort().join("|");
        expect(seen.has(key), `${key} appears twice on ${map.id}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("gives every edge a positive distance no shorter than the straight line", () => {
    for (const map of MAPS) {
      for (const edge of map.edges) {
        const straight = straightLineMiles(map, edge);
        expect(edge.distanceMiles, `${edge.from} → ${edge.to}`).toBeGreaterThan(0);
        expect(edge.distanceMiles, `${edge.from} → ${edge.to}`).toBeGreaterThanOrEqual(straight - 1e-9);
      }
    }
  });

  it("inflates the straight line by the stated winding factor, to two decimal places", () => {
    for (const map of MAPS) {
      for (const edge of map.edges) {
        const straight = straightLineMiles(map, edge);
        const expected = round2(straight * FOOTPATH_WINDING_FACTOR);
        expect(Math.abs(edge.distanceMiles - expected), `${edge.from} → ${edge.to}`).toBeLessThanOrEqual(0.02);
        expect(edge.distanceMiles).toBe(Math.round(edge.distanceMiles * 100) / 100);
      }
    }
  });

  it("gives every edge a walking time that matches festival pace", () => {
    for (const map of MAPS) {
      for (const edge of map.edges) {
        expect(Number.isInteger(edge.walkMinutes), `${edge.from} → ${edge.to}`).toBe(true);
        expect(edge.walkMinutes).toBeGreaterThan(0);
        expect(edge.walkMinutes).toBe(walkingMinutesFor(edge.distanceMiles));
      }
    }
  });

  it("rates every bottleneck at 1 or worse, and explains the ones above 1.5", () => {
    for (const map of MAPS) {
      for (const edge of map.edges) {
        expect(edge.peakMultiplier).toBeGreaterThanOrEqual(1);
        if (edge.peakMultiplier >= 1.5) {
          expect(edge.bottleneckNote, `${edge.from} → ${edge.to} needs a note`).toBeDefined();
        }
        if (edge.bottleneckNote !== undefined) {
          expect(edge.bottleneckNote.trim().length).toBeGreaterThan(20);
        }
      }
    }
  });

  it("joins every node into one walkable network per venue", () => {
    for (const map of MAPS) {
      const adjacency = neighbours(map);
      const seen = new Set<string>();
      const start = map.nodes[0]?.id;
      expect(start).toBeDefined();

      const stack = [start as string];
      while (stack.length > 0) {
        const current = stack.pop() as string;
        if (seen.has(current)) continue;
        seen.add(current);
        for (const link of adjacency.get(current) ?? []) stack.push(link.id);
      }

      expect(seen.size, `${map.id} has unreachable nodes`).toBe(map.nodes.length);
    }
  });

  it("keeps the whole festival walk within a plausible few miles", () => {
    const total = DE_SCHORRE_MAP.edges.reduce((sum, edge) => sum + edge.distanceMiles, 0);
    expect(total).toBeGreaterThan(0.5);
    expect(total).toBeLessThan(6);
  });
});

describe("ground overlays", () => {
  it("are GeoJSON feature collections tagged with their own map", () => {
    for (const map of MAPS) {
      expect(map.overlays.type).toBe("FeatureCollection");
      expect(map.overlays.features.length).toBeGreaterThan(0);

      for (const feature of map.overlays.features) {
        expect(feature.type).toBe("Feature");
        expect(feature.properties.mapId).toBe(map.id);
        expect(feature.properties.name.trim()).not.toBe("");
        expect(feature.properties.notes.trim()).not.toBe("");
        expect(["Point", "LineString", "Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
      }
    }
  });

  it("closes every polygon ring", () => {
    let polygonRings = 0;

    for (const map of MAPS) {
      for (const feature of map.overlays.features) {
        const rings =
          feature.geometry.type === "Polygon"
            ? feature.geometry.coordinates
            : feature.geometry.type === "MultiPolygon"
              ? feature.geometry.coordinates.flatMap((polygon) => polygon)
              : [];

        for (const ring of rings) {
          polygonRings += 1;
          expect(ring.length, `${feature.id ?? "feature"}`).toBeGreaterThanOrEqual(4);
          const first = ring[0];
          const last = ring[ring.length - 1];
          expect(first).toBeDefined();
          expect(last).toBeDefined();
          expect((first as GeoJsonPosition)[0]).toBe((last as GeoJsonPosition)[0]);
          expect((first as GeoJsonPosition)[1]).toBe((last as GeoJsonPosition)[1]);
        }
      }
    }

    // Both venues have areal overlays, so the check above must have had work to do.
    expect(polygonRings).toBeGreaterThan(4);
  });

  it("gives every line overlay at least two distinct positions", () => {
    for (const map of MAPS) {
      for (const feature of map.overlays.features) {
        if (feature.geometry.type !== "LineString") continue;

        const coordinates = feature.geometry.coordinates;
        expect(coordinates.length, `${feature.id ?? "feature"}`).toBeGreaterThanOrEqual(2);
        expect(coordinates[0]).not.toEqual(coordinates[coordinates.length - 1]);
      }
    }
  });

  it("draws the pieces the map description promises", () => {
    const deSchorreKinds = DE_SCHORRE_MAP.overlays.features.map((feature) => feature.properties.kind);
    expect(deSchorreKinds).toEqual(
      expect.arrayContaining(["park-footprint", "water", "woodland", "stage-bowl", "walking-spine"]),
    );

    const dreamvilleKinds = DREAMVILLE_MAP.overlays.features.map((feature) => feature.properties.kind);
    expect(dreamvilleKinds).toEqual(
      expect.arrayContaining(["site-boundary", "district", "walkway", "walking-spine"]),
    );

    const districts = DREAMVILLE_MAP.overlays.features
      .filter((feature) => feature.properties.kind === "district")
      .map((feature) => feature.properties.name);
    expect(districts).toEqual(
      expect.arrayContaining([
        "Montagoe",
        "Easy Tent",
        "Marketplace",
        "Magnificent Greens",
        "Friendship Garden",
      ]),
    );
  });

  it("puts a polygon of area behind every camping district", () => {
    const districts = DREAMVILLE_MAP.overlays.features.filter(
      (feature) => feature.properties.kind === "district",
    );
    for (const feature of districts) {
      expect(["Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
    }
  });

  it("keeps each campsite node inside its own district outline", () => {
    const districtFor = new Map<string, string>([
      ["dv-montagoe", "dreamville-montagoe"],
      ["dv-easy-tent", "dreamville-easy-tent"],
      ["dv-marketplace", "dreamville-marketplace"],
      ["dv-magnificent-greens", "dreamville-magnificent-greens"],
      ["dv-friendship-garden", "dreamville-friendship-garden"],
    ]);

    for (const [nodeId, featureId] of districtFor) {
      const node = nodeById(DREAMVILLE_MAP, nodeId);
      expect(node, `${nodeId} is missing`).not.toBeNull();

      const feature = DREAMVILLE_MAP.overlays.features.find((candidate) => candidate.id === featureId);
      expect(feature, `${featureId} is missing`).toBeDefined();
      if (feature === undefined || node === null) continue;

      expect(feature.geometry.type).toBe("Polygon");
      if (feature.geometry.type !== "Polygon") continue;

      const [outer] = feature.geometry.coordinates;
      expect(outer).toBeDefined();
      expect(pointInRing([node.lng, node.lat], outer as readonly GeoJsonPosition[]), `${nodeId}`).toBe(true);
    }
  });
});

describe("haversineMiles", () => {
  it("measures a degree of latitude as roughly 69 miles", () => {
    const miles = haversineMiles([4.38, 51.0], [4.38, 52.0]);
    expect(miles).toBeGreaterThan(68);
    expect(miles).toBeLessThan(70);
  });

  it("returns zero for a point measured against itself", () => {
    expect(haversineMiles([4.3854, 51.0912], [4.3854, 51.0912])).toBe(0);
  });

  it("is symmetric", () => {
    const a: GeoJsonPosition = [4.3745, 51.0898];
    const b: GeoJsonPosition = [4.3868, 51.0928];
    expect(haversineMiles(a, b)).toBeCloseTo(haversineMiles(b, a), 12);
  });

  it("rejects malformed points", () => {
    expect(() => haversineMiles([4.38] as unknown as GeoJsonPosition, [4.38, 51.09])).toThrow(RangeError);
    expect(() => haversineMiles([4.38, 51.09], [4.38, Number.NaN])).toThrow(RangeError);
    expect(() => haversineMiles([4.38, 91], [4.38, 51.09])).toThrow(RangeError);
    expect(() => haversineMiles([181, 51], [4.38, 51.09])).toThrow(RangeError);
  });
});

describe("findShortestRoute", () => {
  it("routes from the main entrance to the Mainstage on De Schorre", () => {
    const route = findShortestRoute(DE_SCHORRE_MAP, "ds-main-entrance", "ds-mainstage");
    expect(route).not.toBeNull();
    if (route === null) return;

    expect(route.mapId).toBe("de-schorre");
    expect(route.from.id).toBe("ds-main-entrance");
    expect(route.to.id).toBe("ds-mainstage");
    expect(route.nodes[0]?.id).toBe("ds-main-entrance");
    expect(route.nodes[route.nodes.length - 1]?.id).toBe("ds-mainstage");
    expect(route.edges.length).toBe(route.nodes.length - 1);
    expect(route.totalDistanceMiles).toBeGreaterThan(0.5);
    expect(route.totalDistanceMiles).toBeLessThan(2);
    expect(route.normalWalkMinutes).toBeGreaterThan(route.totalDistanceMiles * 15);
    expect(route.peakWalkMinutes).toBeGreaterThanOrEqual(route.normalWalkMinutes);
  });

  it("returns edges that join consecutive nodes, in either direction", () => {
    for (const map of MAPS) {
      for (const target of map.nodes) {
        const route = findShortestRoute(map, map.nodes[0]?.id as string, target.id);
        expect(route, `${map.id}: ${target.id}`).not.toBeNull();
        if (route === null) continue;

        for (let index = 0; index < route.edges.length; index += 1) {
          const edge = route.edges[index] as GeoMapEdge;
          const here = route.nodes[index] as GeoMapNode;
          const next = route.nodes[index + 1] as GeoMapNode;
          const ends = [edge.from, edge.to].sort();
          expect(ends).toEqual([here.id, next.id].sort());
        }
      }
    }
  });

  it("sums the edge distances and times into the totals", () => {
    for (const map of MAPS) {
      const route = findShortestRoute(map, map.nodes[0]?.id as string, map.nodes[map.nodes.length - 1]?.id as string);
      expect(route).not.toBeNull();
      if (route === null) continue;

      const distance = route.edges.reduce((sum, edge) => sum + edge.distanceMiles, 0);
      const minutes = route.edges.reduce((sum, edge) => sum + edge.walkMinutes, 0);
      const peak = route.edges.reduce(
        (sum, edge) => sum + edge.walkMinutes * Math.max(1, edge.peakMultiplier),
        0,
      );

      expect(route.totalDistanceMiles).toBeCloseTo(distance, 6);
      expect(route.normalWalkMinutes).toBe(minutes);
      expect(route.peakWalkMinutes).toBeGreaterThanOrEqual(Math.floor(peak - 1e-9));
      expect(route.peakWalkMinutes).toBeGreaterThanOrEqual(route.normalWalkMinutes);
    }
  });

  it("agrees with an exhaustive search for the shortest walk", () => {
    const pairs: readonly (readonly [string, string])[] = [
      ["ds-main-entrance", "ds-mainstage"],
      ["ds-transport", "ds-core"],
      ["ds-lockers-main", "ds-dreamville-gate"],
      ["ds-atmosphere", "ds-core"],
      ["ds-freedom", "ds-library"],
    ];

    for (const [from, to] of pairs) {
      const route = findShortestRoute(DE_SCHORRE_MAP, from, to);
      const expected = bruteForceMiles(DE_SCHORRE_MAP, from, to);
      expect(route, `${from} → ${to}`).not.toBeNull();
      expect(expected).not.toBeNull();
      expect(route?.totalDistanceMiles, `${from} → ${to}`).toBeCloseTo(expected as number, 6);
    }
  });

  it("does not lengthen a route when a rival path ties on rounded minutes", () => {
    // Every possible pair, checked against the exhaustive answer, so a tie in
    // whole-minute totals can never smuggle in a longer walk.
    for (const map of MAPS) {
      for (const start of map.nodes) {
        for (const end of map.nodes) {
          const route = findShortestRoute(map, start.id, end.id);
          const expected = bruteForceMiles(map, start.id, end.id);
          expect(route, `${map.id}: ${start.id} → ${end.id}`).not.toBeNull();
          expect(expected, `${map.id}: ${start.id} → ${end.id}`).not.toBeNull();
          expect(route?.totalDistanceMiles, `${map.id}: ${start.id} → ${end.id}`).toBeCloseTo(
            expected as number,
            6,
          );
        }
      }
    }
  });

  it("is deterministic across repeated calls", () => {
    const first = findShortestRoute(DE_SCHORRE_MAP, "ds-transport", "ds-library");
    const second = findShortestRoute(DE_SCHORRE_MAP, "ds-transport", "ds-library");
    expect(first?.nodes.map((node) => node.id)).toEqual(second?.nodes.map((node) => node.id));
  });

  it("prefers the shorter way round rather than the first edge it meets", () => {
    // Library to Rose Garden can go via Crystal Garden or via the Mainstage; the
    // route must be no longer than the best single alternative.
    const route = findShortestRoute(DE_SCHORRE_MAP, "ds-library", "ds-rose-garden");
    expect(route).not.toBeNull();
    if (route === null) return;

    const edgeBetween = (a: string, b: string): GeoMapEdge | undefined =>
      DE_SCHORRE_MAP.edges.find((edge) => [edge.from, edge.to].sort().join("|") === [a, b].sort().join("|"));

    const libraryToCrystal = edgeBetween("ds-library", "ds-crystal-garden");
    const crystalToRose = edgeBetween("ds-crystal-garden", "ds-rose-garden");
    expect(libraryToCrystal).toBeDefined();
    expect(crystalToRose).toBeDefined();

    const crystalWay = (libraryToCrystal as GeoMapEdge).distanceMiles + (crystalToRose as GeoMapEdge).distanceMiles;
    expect(route.totalDistanceMiles).toBeLessThanOrEqual(crystalWay + 1e-9);
  });

  it("collects each bottleneck note once, in walking order", () => {
    const route = findShortestRoute(DE_SCHORRE_MAP, "ds-main-entrance", "ds-dreamville-gate");
    expect(route).not.toBeNull();
    if (route === null) return;

    const expected = route.edges
      .map((edge) => edge.bottleneckNote)
      .filter((note): note is string => note !== undefined);

    expect(route.bottleneckNotes).toEqual([...new Set(expected)]);
    expect(route.bottleneckNotes.length).toBeGreaterThan(0);

    for (const note of route.bottleneckNotes) {
      expect(expected).toContain(note);
    }
  });

  it("returns valid GeoJSON geometry whose first and last points are the endpoints", () => {
    for (const map of MAPS) {
      const route = findShortestRoute(map, map.nodes[0]?.id as string, map.nodes[3]?.id as string);
      expect(route).not.toBeNull();
      if (route === null) continue;

      expect(route.geometry.type).toBe("LineString");
      expect(route.geometry.coordinates.length).toBe(route.nodes.length);
      expect(route.geometry.coordinates.length).toBeGreaterThanOrEqual(2);

      const first = route.geometry.coordinates[0] as GeoJsonPosition;
      const last = route.geometry.coordinates[route.geometry.coordinates.length - 1] as GeoJsonPosition;
      expect(first).toEqual([route.from.lng, route.from.lat]);
      expect(last).toEqual([route.to.lng, route.to.lat]);

      for (const [index, position] of route.geometry.coordinates.entries()) {
        const node = route.nodes[index] as GeoMapNode;
        expect(position[0]).toBe(node.lng);
        expect(position[1]).toBe(node.lat);
        expect(inBounds(position)).toBe(true);
      }
    }
  });

  it("returns a zero-length walk when the two ends are the same node", () => {
    const route = findShortestRoute(DREAMVILLE_MAP, "dv-marketplace", "dv-marketplace");
    expect(route).not.toBeNull();
    if (route === null) return;

    expect(route.nodes).toHaveLength(1);
    expect(route.edges).toHaveLength(0);
    expect(route.totalDistanceMiles).toBe(0);
    expect(route.normalWalkMinutes).toBe(0);
    expect(route.peakWalkMinutes).toBe(0);
    expect(route.bottleneckNotes).toEqual([]);
    expect(route.geometry.coordinates).toHaveLength(2);
    expect(route.geometry.coordinates[0]).toEqual([route.from.lng, route.from.lat]);
    expect(route.geometry.coordinates[1]).toEqual([route.from.lng, route.from.lat]);
  });

  it("throws for ids that are not on the map", () => {
    expect(() => findShortestRoute(DE_SCHORRE_MAP, "ds-mainstage", "nowhere")).toThrow(RangeError);
    expect(() => findShortestRoute(DE_SCHORRE_MAP, "nowhere", "ds-mainstage")).toThrow(RangeError);
    expect(() => findShortestRoute(DREAMVILLE_MAP, "", "dv-marketplace")).toThrow(RangeError);
  });

  it("throws when a node from the other venue is used as an endpoint", () => {
    expect(() => findShortestRoute(DE_SCHORRE_MAP, "dv-marketplace", "ds-mainstage")).toThrow(RangeError);
    expect(() => findShortestRoute(DREAMVILLE_MAP, "dv-marketplace", "ds-mainstage")).toThrow(RangeError);
  });

  it("returns null when no walk connects the two nodes", () => {
    expect(findShortestRoute(DISCONNECTED_MAP, "island-a", "island-b")).toBeNull();
  });

  it("reports a short campsite walk to the festival gate", () => {
    const route = findShortestRoute(DREAMVILLE_MAP, "dv-montagoe", "dv-festival-gate");
    expect(route).not.toBeNull();
    if (route === null) return;

    expect(route.totalDistanceMiles).toBeGreaterThan(0.2);
    expect(route.totalDistanceMiles).toBeLessThan(1.2);
    expect(route.peakWalkMinutes).toBeGreaterThan(route.normalWalkMinutes);
    expect(route.bottleneckNotes.join(" ")).toMatch(/one way/i);
  });
});

describe("the combined site view", () => {
  it("holds every zone of both venues, and the shared crossing only once", () => {
    const combined = new Set(ALL_VENUE_MAP.nodes.map((node) => node.id));

    for (const map of MAPS) {
      for (const node of map.nodes) {
        if (node.id === CROSS_VENUE_ALIAS_ID) continue;
        expect(combined.has(node.id), `${node.id} is missing from the combined view`).toBe(true);
      }
    }

    // The one DreamVille id that is folded into the De Schorre gate.
    expect(combined.has(CROSS_VENUE_ALIAS_ID)).toBe(false);
    expect(combined.has(CROSS_VENUE_NODE_ID)).toBe(true);
    expect(ALL_VENUE_MAP.nodes.filter((node) => node.id === CROSS_VENUE_NODE_ID)).toHaveLength(1);

    // Every node accounted for, with one fold and no losses.
    expect(ALL_VENUE_MAP.nodes).toHaveLength(
      DE_SCHORRE_MAP.nodes.length + DREAMVILLE_MAP.nodes.length - 1,
    );
  });

  it("gives the shared crossing both venues' wording, since it belongs to both", () => {
    const crossing = nodeById(ALL_VENUE_MAP, CROSS_VENUE_NODE_ID);
    expect(crossing).not.toBeNull();
    expect(crossing?.name).toMatch(/DreamVille Gate/i);
    expect(crossing?.summary).toMatch(/campsite/i);
    expect(crossing?.category).toBe("entrance");
  });

  it("joins the two venues into one walkable network", () => {
    const adjacency = neighbours(ALL_VENUE_MAP);
    const seen = new Set<string>();
    const start = ALL_VENUE_MAP.nodes[0]?.id as string;
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const link of adjacency.get(current) ?? []) stack.push(link.id);
    }

    expect(seen.size).toBe(ALL_VENUE_MAP.nodes.length);
  });

  it("crosses the venue boundary exactly once, at the shared gate", () => {
    const crossingEdges = ALL_VENUE_MAP.edges.filter((edge) => {
      const from = physicalVenueOfNode(edge.from);
      const to = physicalVenueOfNode(edge.to);
      return from !== null && to !== null && from !== to;
    });

    /*
      One edge, not two and not none. DreamVille's Rainbow Walkway reaches the
      merged gate, which carries the De Schorre node id, so this single edge is
      the join between the two venue graphs. Anything more would mean an invented
      bridge; anything less would mean the combined map could not route across it.
    */
    expect(crossingEdges).toHaveLength(1);

    const [join] = crossingEdges;
    expect([join?.from, join?.to].sort()).toEqual(["dv-rainbow-walkway", CROSS_VENUE_NODE_ID].sort());
    expect(join?.distanceMiles).toBeGreaterThan(0);
    expect(join?.bottleneckNote).toBeDefined();
  });

  it("keeps every combined edge consistent with its two node positions", () => {
    for (const edge of ALL_VENUE_MAP.edges) {
      const from = nodeById(ALL_VENUE_MAP, edge.from);
      const to = nodeById(ALL_VENUE_MAP, edge.to);
      expect(from, `${edge.from} is missing`).not.toBeNull();
      expect(to, `${edge.to} is missing`).not.toBeNull();
      if (from === null || to === null) continue;

      const straight = haversineMiles([from.lng, from.lat], [to.lng, to.lat]);
      expect(edge.distanceMiles, `${edge.from} → ${edge.to}`).toBeGreaterThan(0);
      expect(edge.distanceMiles, `${edge.from} → ${edge.to}`).toBeGreaterThanOrEqual(straight - 1e-9);
      expect(edge.walkMinutes).toBe(walkingMinutesFor(edge.distanceMiles));
      expect(edge.peakMultiplier).toBeGreaterThanOrEqual(1);
    }
  });

  it("never repeats an edge, and never links a node to itself", () => {
    const seen = new Set<string>();
    for (const edge of ALL_VENUE_MAP.edges) {
      expect(edge.from).not.toBe(edge.to);
      const key = [edge.from, edge.to].sort().join("|");
      expect(seen.has(key), `${key} appears twice`).toBe(false);
      seen.add(key);
    }
  });

  it("draws both venues' ground beneath the combined route", () => {
    const kinds = ALL_VENUE_MAP.overlays.features.map((feature) => feature.properties.kind);
    // De Schorre's pieces and DreamVille's, in one collection.
    expect(kinds).toEqual(expect.arrayContaining(["park-footprint", "stage-bowl", "walking-spine"]));
    expect(kinds).toEqual(expect.arrayContaining(["site-boundary", "district", "walkway"]));

    const mapIds = new Set(ALL_VENUE_MAP.overlays.features.map((feature) => feature.properties.mapId));
    expect(mapIds).toEqual(new Set(["de-schorre", "dreamville"]));

    expect(ALL_VENUE_MAP.overlays.features).toHaveLength(
      DE_SCHORRE_MAP.overlays.features.length + DREAMVILLE_MAP.overlays.features.length,
    );
  });

  it("spans both towns in its bounds and centre", () => {
    expect(ALL_VENUE_MAP.bounds.west).toBeLessThanOrEqual(DE_SCHORRE_MAP.bounds.west);
    expect(ALL_VENUE_MAP.bounds.east).toBeGreaterThanOrEqual(DREAMVILLE_MAP.bounds.east);
    expect(ALL_VENUE_MAP.bounds.south).toBeLessThanOrEqual(DE_SCHORRE_MAP.bounds.south);
    expect(ALL_VENUE_MAP.bounds.north).toBeGreaterThanOrEqual(DREAMVILLE_MAP.bounds.north);

    const [lng, lat] = ALL_VENUE_MAP.centre;
    expect(lng).toBeGreaterThan(ALL_VENUE_MAP.bounds.west);
    expect(lng).toBeLessThan(ALL_VENUE_MAP.bounds.east);
    expect(lat).toBeGreaterThan(ALL_VENUE_MAP.bounds.south);
    expect(lat).toBeLessThan(ALL_VENUE_MAP.bounds.north);
  });
});

describe("cross-venue routes", () => {
  /** Asserts the figure a reader would be shown: miles, minutes, and a LineString. */
  function expectUsableRoute(route: ReturnType<typeof findShortestRoute>, label: string): void {
    expect(route, label).not.toBeNull();
    if (route === null) return;

    expect(route.mapId, label).toBe("all");
    expect(route.nodes.length, label).toBeGreaterThanOrEqual(2);
    expect(route.edges.length, label).toBe(route.nodes.length - 1);

    expect(route.totalDistanceMiles, label).toBeGreaterThan(0.1);
    expect(Number.isFinite(route.totalDistanceMiles), label).toBe(true);
    expect(route.totalDistanceMiles, label).toBe(Math.round(route.totalDistanceMiles * 100) / 100);

    expect(route.normalWalkMinutes, label).toBeGreaterThan(0);
    expect(Number.isInteger(route.normalWalkMinutes), label).toBe(true);
    expect(route.peakWalkMinutes, label).toBeGreaterThanOrEqual(route.normalWalkMinutes);

    expect(route.geometry.type, label).toBe("LineString");
    expect(route.geometry.coordinates.length, label).toBeGreaterThanOrEqual(2);
    expect(route.geometry.coordinates.length, label).toBe(route.nodes.length);
    expect(route.geometry.coordinates[0], label).toEqual([route.from.lng, route.from.lat]);
    expect(route.geometry.coordinates[route.geometry.coordinates.length - 1], label).toEqual([
      route.to.lng,
      route.to.lat,
    ]);

    for (const position of route.geometry.coordinates) {
      expect(inBounds(position), label).toBe(true);
    }
  }

  it("walks from Montagoe to the Mainstage across the shared gate", () => {
    const route = findShortestRoute(ALL_VENUE_MAP, "dv-montagoe", "ds-mainstage");
    expectUsableRoute(route, "Montagoe → Mainstage");

    // The crossing is unavoidable, so it must appear on the way.
    const ids = route?.nodes.map((node) => node.id) ?? [];
    expect(ids).toContain(CROSS_VENUE_NODE_ID);
    expect(ids[0]).toBe("dv-montagoe");
    expect(ids[ids.length - 1]).toBe("ds-mainstage");

    // A camper's whole journey is a plausible length, in miles.
    expect(route?.totalDistanceMiles).toBeGreaterThan(0.4);
    expect(route?.totalDistanceMiles).toBeLessThan(2.5);
  });

  it("walks from Magnificent Greens to Freedom across the shared gate", () => {
    const route = findShortestRoute(ALL_VENUE_MAP, "dv-magnificent-greens", "ds-freedom");
    expectUsableRoute(route, "Magnificent Greens → Freedom");

    const ids = route?.nodes.map((node) => node.id) ?? [];
    expect(ids).toContain(CROSS_VENUE_NODE_ID);
    expect(ids[0]).toBe("dv-magnificent-greens");
    expect(ids[ids.length - 1]).toBe("ds-freedom");
  });

  it("works in the other direction too, because a footpath is not one-way", () => {
    const out = findShortestRoute(ALL_VENUE_MAP, "ds-mainstage", "dv-montagoe");
    const back = findShortestRoute(ALL_VENUE_MAP, "dv-montagoe", "ds-mainstage");
    expectUsableRoute(out, "Mainstage → Montagoe");
    expect(out?.totalDistanceMiles).toBeCloseTo(back?.totalDistanceMiles as number, 6);
  });

  it("routes between any camp and any stage on the combined view", () => {
    const camps = ALL_VENUE_MAP.nodes.filter((node) => node.category === "camp");
    const stages = ALL_VENUE_MAP.nodes.filter(
      (node) => node.category === "stage" && physicalVenueOfNode(node.id) === "de-schorre",
    );
    expect(camps.length).toBeGreaterThan(0);
    expect(stages.length).toBeGreaterThan(0);

    for (const camp of camps) {
      for (const stage of stages) {
        const route = findShortestRoute(ALL_VENUE_MAP, camp.id, stage.id);
        expectUsableRoute(route, `${camp.id} → ${stage.id}`);
      }
    }
  });

  it("agrees with an exhaustive search across the whole site", () => {
    for (const [from, to] of [
      ["dv-montagoe", "ds-mainstage"],
      ["dv-easy-tent", "ds-core"],
      ["dv-friendship-garden", "ds-rose-garden"],
      ["ds-transport", "dv-marketplace"],
    ] as const) {
      const route = findShortestRoute(ALL_VENUE_MAP, from, to);
      const expected = bruteForceMiles(ALL_VENUE_MAP, from, to);
      expect(route, `${from} → ${to}`).not.toBeNull();
      expect(expected, `${from} → ${to}`).not.toBeNull();
      expect(route?.totalDistanceMiles, `${from} → ${to}`).toBeCloseTo(expected as number, 6);
    }
  });

  it("quotes a longer walk across the site than within the campsite", () => {
    const withinSite = findShortestRoute(ALL_VENUE_MAP, "dv-montagoe", "ds-dreamville-gate");
    const acrossSite = findShortestRoute(ALL_VENUE_MAP, "dv-montagoe", "ds-freedom");
    expect(withinSite?.totalDistanceMiles).toBeDefined();
    expect(acrossSite?.totalDistanceMiles).toBeDefined();
    expect(acrossSite?.totalDistanceMiles as number).toBeGreaterThan(
      withinSite?.totalDistanceMiles as number,
    );
  });
});

describe("routeBetween", () => {
  it("uses the venue's own graph when both ends are on it", () => {
    const route = routeBetween([DE_SCHORRE_MAP, ALL_VENUE_MAP], "ds-main-entrance", "ds-mainstage");
    expect(route).not.toBeNull();
    // The single-venue figures are unchanged: the fallback was never used.
    expect(route?.mapId).toBe("de-schorre");
    expect(route?.totalDistanceMiles).toBe(
      findShortestRoute(DE_SCHORRE_MAP, "ds-main-entrance", "ds-mainstage")?.totalDistanceMiles,
    );
  });

  it("falls back to the combined map when one end is on the other venue", () => {
    const route = routeBetween([DE_SCHORRE_MAP, ALL_VENUE_MAP], "ds-mainstage", "dv-montagoe");
    expect(route).not.toBeNull();
    expect(route?.mapId).toBe("all");
    expect(route?.from.id).toBe("ds-mainstage");
    expect(route?.to.id).toBe("dv-montagoe");
  });

  it("falls back in the other direction as well", () => {
    const route = routeBetween([DREAMVILLE_MAP, ALL_VENUE_MAP], "dv-montagoe", "ds-mainstage");
    expect(route?.mapId).toBe("all");
    expect(route?.geometry.type).toBe("LineString");
  });

  it("returns null rather than throwing when nothing connects the pair", () => {
    expect(routeBetween([DE_SCHORRE_MAP, ALL_VENUE_MAP], "ds-mainstage", "nowhere")).toBeNull();
    expect(routeBetween([], "ds-mainstage", "ds-core")).toBeNull();
  });

  it("does not use a candidate map that holds only one end", () => {
    const route = routeBetween([DE_SCHORRE_MAP], "dv-montagoe", "ds-mainstage");
    expect(route).toBeNull();
  });
});

describe("nearestNode", () => {
  it("finds the closest zone to a point beside it", () => {
    const montagoe = nodeById(ALL_VENUE_MAP, "dv-montagoe") as GeoMapNode;
    const nearest = nearestNode(ALL_VENUE_MAP, [montagoe.lng + 0.0004, montagoe.lat + 0.0004]);

    expect(nearest).not.toBeNull();
    expect(nearest?.node.id).toBe("dv-montagoe");
    expect(nearest?.straightLineMiles).toBeGreaterThan(0);
    expect(nearest?.straightLineMiles).toBeLessThan(0.1);
  });

  it("returns zero miles for a point standing on a zone", () => {
    const mainstage = nodeById(DE_SCHORRE_MAP, "ds-mainstage") as GeoMapNode;
    const nearest = nearestNode(DE_SCHORRE_MAP, [mainstage.lng, mainstage.lat]);
    expect(nearest?.node.id).toBe("ds-mainstage");
    expect(nearest?.straightLineMiles).toBe(0);
  });

  it("picks the nearest across both venues when given the combined map", () => {
    const greens = nodeById(ALL_VENUE_MAP, "dv-magnificent-greens") as GeoMapNode;
    const nearest = nearestNode(ALL_VENUE_MAP, [greens.lng, greens.lat + 0.0002]);
    expect(nearest?.node.id).toBe("dv-magnificent-greens");
    expect(physicalVenueOfNode(nearest?.node.id as string)).toBe("dreamville");
  });

  it("returns null for a map with no nodes", () => {
    expect(nearestNode(DISCONNECTED_MAP_EMPTY, [4.38, 51.09])).toBeNull();
  });

  it("rejects an invalid position", () => {
    expect(() => nearestNode(DE_SCHORRE_MAP, [4.38] as unknown as GeoJsonPosition)).toThrow(
      RangeError,
    );
    expect(() => nearestNode(DE_SCHORRE_MAP, [Number.NaN, 51.09])).toThrow(RangeError);
  });
});

describe("distanceToBoundsMiles", () => {
  it("is zero inside the box", () => {
    expect(distanceToBoundsMiles([4.39, 51.092], VENUE_BOUNDS)).toBe(0);
    // A point just inside an edge is still inside.
    expect(distanceToBoundsMiles([VENUE_BOUNDS.west + 1e-6, 51.092], VENUE_BOUNDS)).toBe(0);
  });

  it("measures from the nearest edge, not from the centre", () => {
    const insideButEast = VENUE_BOUNDS.east + 0.01;
    const distance = distanceToBoundsMiles([insideButEast, 51.092], VENUE_BOUNDS);

    // Roughly 0.01 degrees of longitude at this latitude is about 0.43 miles.
    expect(distance).toBeGreaterThan(0.3);
    expect(distance).toBeLessThan(0.6);
  });

  it("grows as the point moves away", () => {
    const near = distanceToBoundsMiles([VENUE_BOUNDS.east + 0.01, 51.092], VENUE_BOUNDS);
    const far = distanceToBoundsMiles([VENUE_BOUNDS.east + 0.1, 51.092], VENUE_BOUNDS);
    expect(far).toBeGreaterThan(near);
  });

  it("rejects an invalid position", () => {
    expect(() => distanceToBoundsMiles([4.38, 91], VENUE_BOUNDS)).toThrow(RangeError);
  });
});

describe("filterNodes", () => {
  it("returns every node when given no filter", () => {
    for (const map of MAPS) {
      expect(filterNodes(map)).toHaveLength(map.nodes.length);
      expect(filterNodes(map, {})).toHaveLength(map.nodes.length);
      expect(filterNodes(map, { query: "" })).toHaveLength(map.nodes.length);
      expect(filterNodes(map, { query: "   " })).toHaveLength(map.nodes.length);
    }
  });

  it("matches the start of a name case-insensitively", () => {
    const lower = filterNodes(DE_SCHORRE_MAP, { query: "mainstage" });
    const upper = filterNodes(DE_SCHORRE_MAP, { query: "MAINSTAGE" });
    const mixed = filterNodes(DE_SCHORRE_MAP, { query: "MaInStAgE" });

    expect(lower.map((node) => node.id)).toContain("ds-mainstage");
    expect(upper.map((node) => node.id)).toEqual(lower.map((node) => node.id));
    expect(mixed.map((node) => node.id)).toEqual(lower.map((node) => node.id));
  });

  it("matches anywhere in the name, the short label or the summary", () => {
    const byShortLabel = filterNodes(DE_SCHORRE_MAP, { query: "dv gate" });
    expect(byShortLabel.map((node) => node.id)).toContain("ds-dreamville-gate");

    const bySummary = filterNodes(DREAMVILLE_MAP, { query: "bakery" });
    expect(bySummary.map((node) => node.id)).toContain("dv-marketplace");
  });

  it("requires every word of a multi-word query to match", () => {
    const both = filterNodes(DE_SCHORRE_MAP, { query: "first aid" });
    expect(both.map((node) => node.id)).toEqual(["ds-first-aid"]);

    const mismatch = filterNodes(DE_SCHORRE_MAP, { query: "mainstage bakery" });
    expect(mismatch).toHaveLength(0);
  });

  it("ignores accents so an English keyboard finds the place", () => {
    // Accents typed into the query are stripped, so an accented spelling still
    // finds the plain name stored in the data.
    const plain = filterNodes(DREAMVILLE_MAP, { query: "magnificent" });
    const accented = filterNodes(DREAMVILLE_MAP, { query: "màgnificent" });
    expect(plain.map((node) => node.id)).toContain("dv-magnificent-greens");
    expect(accented.map((node) => node.id)).toEqual(plain.map((node) => node.id));
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(filterNodes(DE_SCHORRE_MAP, { query: "helipad" })).toHaveLength(0);
    expect(filterNodes(DREAMVILLE_MAP, { query: "zzzz" })).toHaveLength(0);
  });

  it("filters by one category or several", () => {
    const stages = filterNodes(DE_SCHORRE_MAP, { categories: ["stage"] });
    expect(stages.length).toBeGreaterThan(0);
    expect(stages.every((node) => node.category === "stage")).toBe(true);

    const gates = filterNodes(DE_SCHORRE_MAP, { categories: ["entrance", "transport"] });
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.every((node) => node.category === "entrance" || node.category === "transport")).toBe(true);

    const everything = filterNodes(DE_SCHORRE_MAP, { categories: [] });
    expect(everything).toHaveLength(DE_SCHORRE_MAP.nodes.length);

    const none = filterNodes(DE_SCHORRE_MAP, { categories: ["camp"] });
    expect(none).toHaveLength(0);
  });

  it("filters to favourites, and to nothing when there are none", () => {
    const favourites = ["ds-mainstage", "ds-rose-garden", "dv-marketplace"];

    const onlyFavourites = filterNodes(DE_SCHORRE_MAP, { favouritesOnly: true, favouriteIds: favourites });
    expect(onlyFavourites.map((node) => node.id)).toEqual(["ds-mainstage", "ds-rose-garden"]);

    expect(filterNodes(DE_SCHORRE_MAP, { favouritesOnly: true })).toHaveLength(0);
    expect(filterNodes(DE_SCHORRE_MAP, { favouritesOnly: true, favouriteIds: ["unknown-id"] })).toHaveLength(0);
  });

  it("combines a query, a category and favourites", () => {
    const result = filterNodes(DE_SCHORRE_MAP, {
      query: "gate",
      categories: ["entrance"],
      favouritesOnly: true,
      favouriteIds: ["ds-dreamville-gate", "ds-main-entrance", "ds-mainstage"],
    });
    expect(result.map((node) => node.id)).toEqual(["ds-main-entrance", "ds-dreamville-gate"]);
  });

  it("keeps the map's own order so the list does not jump as the query changes", () => {
    const result = filterNodes(DREAMVILLE_MAP, { categories: ["camp"] });
    const order = DREAMVILLE_MAP.nodes.map((node) => node.id);
    const positions = result.map((node) => order.indexOf(node.id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("rejects something that is not a map", () => {
    expect(() => filterNodes(null as unknown as GeoMap)).toThrow(RangeError);
    expect(() => filterNodes({} as GeoMap)).toThrow(RangeError);
  });
});

describe("nodeById", () => {
  it("finds a node and returns null for an unknown id", () => {
    expect(nodeById(DE_SCHORRE_MAP, "ds-core")?.name).toBe("Core");
    expect(nodeById(DE_SCHORRE_MAP, "nope")).toBeNull();
    expect(nodeById(DREAMVILLE_MAP, "ds-core")).toBeNull();
  });
});

describe("constants", () => {
  it("uses a festival pace in miles per hour", () => {
    expect(FESTIVAL_PACE_MPH).toBeGreaterThan(2);
    expect(FESTIVAL_PACE_MPH).toBeLessThan(4);
    expect(walkingMinutesFor(1)).toBe(21);
    expect(walkingMinutesFor(0.01)).toBe(1);
  });

  it("winds footpaths by a modest factor above the straight line", () => {
    expect(FOOTPATH_WINDING_FACTOR).toBeGreaterThan(1);
    expect(FOOTPATH_WINDING_FACTOR).toBeLessThanOrEqual(1.5);
  });

  it("keeps the shared search window wider than every view", () => {
    expect(VENUE_BOUNDS.south).toBeLessThan(BOUNDS.south + 0.0001);
    expect(VENUE_BOUNDS.north).toBeGreaterThanOrEqual(BOUNDS.north - 0.0001);
    for (const map of ALL_VIEWS) {
      expect(map.bounds.south).toBeGreaterThanOrEqual(VENUE_BOUNDS.south);
      expect(map.bounds.north).toBeLessThanOrEqual(VENUE_BOUNDS.north);
      expect(map.bounds.west).toBeGreaterThanOrEqual(VENUE_BOUNDS.west);
      expect(map.bounds.east).toBeLessThanOrEqual(VENUE_BOUNDS.east);
    }
  });

  it("types the map ids as the union the UI switches on", () => {
    const ids: VenueMapId[] = ALL_VIEWS.map((map) => map.id);
    expect(ids.sort()).toEqual(["all", "de-schorre", "dreamville"]);
  });

  it("types the favourite keys as the two physical venues", () => {
    const ids: PhysicalVenueId[] = MAPS.map((map) => map.id as PhysicalVenueId);
    expect(ids.sort()).toEqual(["de-schorre", "dreamville"]);
  });
});
