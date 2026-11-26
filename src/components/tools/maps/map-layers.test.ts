// @vitest-environment node
import { describe, expect, it } from "vitest";

import { DE_SCHORRE_MAP, DREAMVILLE_MAP } from "@/lib/maps/geo-data";
import {
  buildEndpointCollection,
  buildInspectedCollection,
  buildNodeCollection,
  buildOverlayCollection,
  buildRouteCollection,
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
  overlayStyleFor,
  nodeFocus,
  venueBoundsPair,
} from "./map-layers";
import { findShortestRoute, nodeById } from "@/lib/maps/geo-routing";
import { MAP_NODE_CATEGORIES, VENUE_MAP_IDS } from "@/lib/maps/geo-types";

/*
  These are pure functions: data in, GeoJSON out. Testing them here is what makes
  the drawing verifiable at all, because a WebGL canvas cannot be asserted on in
  jsdom.
*/

describe("CATEGORY_COLOURS and CATEGORY_LABELS", () => {
  it("cover every category the routing layer defines", () => {
    expect(Object.keys(CATEGORY_COLOURS).sort()).toEqual([...MAP_NODE_CATEGORIES].sort());
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual([...MAP_NODE_CATEGORIES].sort());
  });

  it("gives every category a distinct colour, so the map legend means something", () => {
    const colours = Object.values(CATEGORY_COLOURS);
    expect(new Set(colours).size).toBe(colours.length);
  });

  it("uses only solid hex colours MapLibre can parse", () => {
    for (const colour of Object.values(CATEGORY_COLOURS)) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("overlayStyleFor", () => {
  it("paints water in a muted teal and woodland in a deep green", () => {
    const water = overlayStyleFor("de-schorre-lakes", "water");
    const woodland = overlayStyleFor("de-schorre-core-wood", "woodland");
    expect(water.fill).toBe("#134e4a");
    expect(woodland.fill).toBe("#122a17");
    expect(water.fill).not.toBe(woodland.fill);
  });

  it("paints the Mainstage bowl in warm gold rather than a district tint", () => {
    const bowl = overlayStyleFor("de-schorre-mainstage-bowl", "stage-bowl");
    expect(bowl.fill).toBe("#e9c46a");
  });

  it("gives each DreamVille district its own tint", () => {
    const ids = [
      "dreamville-montagoe",
      "dreamville-easy-tent",
      "dreamville-marketplace",
      "dreamville-magnificent-greens",
      "dreamville-friendship-garden",
    ];
    const tints = ids.map((id) => overlayStyleFor(id, "district").fill);
    expect(new Set(tints).size).toBe(ids.length);
    for (const tint of tints) expect(tint).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("falls back rather than returning nothing for an unknown district", () => {
    const style = overlayStyleFor("a-district-added-later", "district");
    expect(style.fill).toBeDefined();
    expect(style.fillOpacity).toBeGreaterThan(0);
  });

  it("keeps every areal wash translucent, so the basemap still shows through", () => {
    for (const kind of ["water", "woodland", "stage-bowl", "park-footprint", "site-boundary"] as const) {
      const style = overlayStyleFor(undefined, kind);
      expect(style.fillOpacity, kind).toBeGreaterThan(0);
      expect(style.fillOpacity, kind).toBeLessThanOrEqual(0.8);
    }
  });
});

describe("buildOverlayCollection", () => {
  it("returns one feature per overlay, with its own venue on it", () => {
    for (const map of [DE_SCHORRE_MAP, DREAMVILLE_MAP]) {
      const collection = buildOverlayCollection(map);
      expect(collection.type).toBe("FeatureCollection");
      expect(collection.features).toHaveLength(map.overlays.features.length);
    }
  });

  it("carries a resolved paint style on every feature", () => {
    const collection = buildOverlayCollection(DE_SCHORRE_MAP);
    for (const feature of collection.features) {
      expect(feature.properties.fill).toMatch(/^(#[0-9a-f]{6}|transparent)$/i);
      expect(feature.properties.edge).toMatch(/^#[0-9a-f]{6}$/i);
      expect(feature.properties.opacity).toBeGreaterThanOrEqual(0);
      expect(feature.properties.edgeWidth).toBeGreaterThan(0);
      expect(feature.properties.name.trim()).not.toBe("");
    }
  });

  it("keeps the geometry exactly as the data file has it", () => {
    const collection = buildOverlayCollection(DE_SCHORRE_MAP);
    for (const [index, feature] of collection.features.entries()) {
      expect(feature.geometry).toEqual(DE_SCHORRE_MAP.overlays.features[index]?.geometry);
    }
  });

  it("draws the walking spine as a line, so it renders dashed", () => {
    const collection = buildOverlayCollection(DE_SCHORRE_MAP);
    const spine = collection.features.find((feature) => feature.properties.kind === "walking-spine");
    expect(spine?.geometry.type).toBe("LineString");
  });
});

describe("buildNodeCollection", () => {
  it("marks one point per node, at that node's own position", () => {
    const collection = buildNodeCollection(DE_SCHORRE_MAP.nodes, "ds-main-entrance", "ds-mainstage");
    expect(collection.features).toHaveLength(DE_SCHORRE_MAP.nodes.length);

    for (const [index, node] of DE_SCHORRE_MAP.nodes.entries()) {
      const feature = collection.features[index];
      expect(feature?.geometry).toEqual({ type: "Point", coordinates: [node.lng, node.lat] });
      expect(feature?.properties.id).toBe(node.id);
    }
  });

  it("labels the two route ends A and B, and nothing else", () => {
    const collection = buildNodeCollection(DE_SCHORRE_MAP.nodes, "ds-main-entrance", "ds-mainstage");
    const tagged = collection.features.filter((feature) => feature.properties.endpoint !== "");
    expect(tagged.map((feature) => feature.properties.endpoint).sort()).toEqual(["A", "B"]);

    const start = collection.features.find((feature) => feature.properties.id === "ds-main-entrance");
    expect(start?.properties.endpoint).toBe("A");
    expect(start?.properties.priority).toBe(1);
  });

  it("gives each marker its category colour", () => {
    const collection = buildNodeCollection(DREAMVILLE_MAP.nodes, "dv-main-entrance", "dv-festival-gate");
    for (const feature of collection.features) {
      expect(feature.properties.colour).toBe(CATEGORY_COLOURS[feature.properties.category]);
    }
  });

  it("returns an empty collection for an empty filter", () => {
    expect(buildNodeCollection([], "a", "b").features).toEqual([]);
  });
});

describe("buildRouteCollection", () => {
  it("draws the shortest walk as one LineString", () => {
    const route = findShortestRoute(DE_SCHORRE_MAP, "ds-main-entrance", "ds-mainstage");
    const collection = buildRouteCollection(route);

    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.geometry.type).toBe("LineString");
    expect(collection.features[0]?.geometry).toEqual(route?.geometry);
  });

  it("returns an empty collection rather than a broken line when there is no route", () => {
    expect(buildRouteCollection(null).features).toEqual([]);
  });

  it("names the walk after its two ends", () => {
    const route = findShortestRoute(DREAMVILLE_MAP, "dv-montagoe", "dv-festival-gate");
    const name = buildRouteCollection(route).features[0]?.properties.name;
    expect(name).toBe("Montagoe to De Schorre Festival Gate");
  });
});

describe("buildEndpointCollection", () => {
  it("produces an A marker and a B marker with distinct colours", () => {
    const route = findShortestRoute(DE_SCHORRE_MAP, "ds-main-entrance", "ds-mainstage");
    const collection = buildEndpointCollection(route);

    expect(collection.features).toHaveLength(2);
    const [a, b] = collection.features;
    expect(a?.properties.endpoint).toBe("A");
    expect(b?.properties.endpoint).toBe("B");
    expect(a?.properties.colour).not.toBe(b?.properties.colour);
  });

  it("places each marker on its own node", () => {
    const route = findShortestRoute(DE_SCHORRE_MAP, "ds-main-entrance", "ds-mainstage");
    const from = nodeById(DE_SCHORRE_MAP, "ds-main-entrance");
    const to = nodeById(DE_SCHORRE_MAP, "ds-mainstage");

    const collection = buildEndpointCollection(route);
    expect(collection.features[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [from?.lng, from?.lat],
    });
    expect(collection.features[1]?.geometry).toEqual({
      type: "Point",
      coordinates: [to?.lng, to?.lat],
    });
  });

  it("draws only one marker when both ends are the same zone", () => {
    const route = findShortestRoute(DE_SCHORRE_MAP, "ds-core", "ds-core");
    const collection = buildEndpointCollection(route);
    // Two markers on one spot would print B over A.
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.properties.endpoint).toBe("A");
  });

  it("returns an empty collection when there is no route", () => {
    expect(buildEndpointCollection(null).features).toEqual([]);
  });
});

describe("buildInspectedCollection", () => {
  it("rings the one node being inspected", () => {
    const node = nodeById(DE_SCHORRE_MAP, "ds-core");
    const collection = buildInspectedCollection(node);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [node?.lng, node?.lat],
    });
  });

  it("returns an empty collection when nothing is selected", () => {
    expect(buildInspectedCollection(null).features).toEqual([]);
  });
});

describe("venueBoundsPair", () => {
  it("returns the west/south and east/north corners fitBounds expects", () => {
    for (const id of VENUE_MAP_IDS) {
      const map = id === "de-schorre" ? DE_SCHORRE_MAP : DREAMVILLE_MAP;
      expect(venueBoundsPair(map)).toEqual([
        [map.bounds.west, map.bounds.south],
        [map.bounds.east, map.bounds.north],
      ]);
    }
  });

  it("produces a usable box: west before east, south before north", () => {
    for (const map of [DE_SCHORRE_MAP, DREAMVILLE_MAP]) {
      const [[west, south], [east, north]] = venueBoundsPair(map);
      expect(west).toBeLessThan(east);
      expect(south).toBeLessThan(north);
    }
  });
});

describe("nodeFocus", () => {
  it("aims at the node and zooms in far enough to read its label", () => {
    const node = nodeById(DREAMVILLE_MAP, "dv-marketplace");
    const focus = nodeFocus(node as NonNullable<typeof node>);
    expect(focus.center).toEqual([node?.lng, node?.lat]);
    // The style keeps node labels from zoom 13.5, so anything less would hide the
    // very label the fly-to is meant to reveal.
    expect(focus.zoom).toBeGreaterThan(13.5);
    expect(focus.zoom).toBeLessThanOrEqual(18);
  });

  it("returns a mutable pair, which is what MapLibre's LngLatLike requires", () => {
    const node = nodeById(DE_SCHORRE_MAP, "ds-core");
    const focus = nodeFocus(node as NonNullable<typeof node>);
    expect(Array.isArray(focus.center)).toBe(true);
    expect(focus.center).toHaveLength(2);
  });
});
