// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ALL_VENUE_MAP, DE_SCHORRE_MAP, DREAMVILLE_MAP, VENUE_MAPS } from "@/lib/maps/geo-data";
import {
  buildEndpointCollection,
  buildInspectedCollection,
  buildLocateCollection,
  buildNodeCollection,
  buildOverlayCollection,
  buildRouteCollection,
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
  CATEGORY_LETTERS,
  GROUND_COLOUR,
  LOCATE_COLOUR,
  LOCATE_CORE_COLOUR,
  overlayStyleFor,
  nodeFocus,
  venueBoundsPair,
} from "./map-layers";
import { findShortestRoute, nodeById } from "@/lib/maps/geo-routing";
import { MAP_NODE_CATEGORIES, VENUE_MAP_IDS, type GeoJsonPosition } from "@/lib/maps/geo-types";

/** Every venue id mapped to its own map, so the loops below cannot fall back wrongly. */
const VIEWS = VENUE_MAP_IDS.map((id) => ({ id, map: VENUE_MAPS[id] }));

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

describe("CATEGORY_LETTERS", () => {
  it("covers every category, so no marker is left without a badge", () => {
    expect(Object.keys(CATEGORY_LETTERS).sort()).toEqual([...MAP_NODE_CATEGORIES].sort());
  });

  it("gives each category its own single letter", () => {
    const letters = Object.values(CATEGORY_LETTERS);
    expect(new Set(letters).size).toBe(letters.length);
    for (const letter of letters) expect(letter).toMatch(/^[A-Z]$/);
  });

  it("never uses A or B, which the route ends already own", () => {
    const letters = Object.values(CATEGORY_LETTERS);
    expect(letters).not.toContain("A");
    expect(letters).not.toContain("B");
  });

  it("spells out the mnemonic the legend prints", () => {
    // S stage, E entrance, C camp, F facility, T transport.
    expect(CATEGORY_LETTERS.stage).toBe("S");
    expect(CATEGORY_LETTERS.entrance).toBe("E");
    expect(CATEGORY_LETTERS.camp).toBe("C");
    expect(CATEGORY_LETTERS.facility).toBe("F");
    expect(CATEGORY_LETTERS.transport).toBe("T");
  });

  it("keeps the badge letter legible on every category colour", () => {
    /*
      The letters are printed in the warm black, so each of the five fills has to
      carry dark text at 4.5:1 or better. Computed rather than assumed: a future
      palette change that made a badge too light or too dark fails here instead of
      shipping unreadable text on a phone in the dark.
    */
    const channel = (value: number): number => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const luminance = (hex: string): number => {
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const contrast = (a: string, b: string): number => {
      const la = luminance(a);
      const lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };

    for (const category of MAP_NODE_CATEGORIES) {
      const ratio = contrast(GROUND_COLOUR, CATEGORY_COLOURS[category]);
      expect(ratio, `${category} badge is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("the locate marker colours", () => {
  it("uses a pair that is not any category colour, so it cannot be misread", () => {
    const categoryColours = new Set(Object.values(CATEGORY_COLOURS));
    expect(categoryColours.has(LOCATE_COLOUR)).toBe(false);
    expect(categoryColours.has(LOCATE_CORE_COLOUR)).toBe(true);
    // The core is the cream every category already uses; the halo is what marks it.
    expect(LOCATE_COLOUR).not.toBe(LOCATE_CORE_COLOUR);
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

  it("prints each marker's category letter, so colour is not the only channel", () => {
    for (const { map } of VIEWS) {
      const collection = buildNodeCollection(map.nodes, map.nodes[0]?.id as string, map.nodes[1]?.id as string);
      for (const feature of collection.features) {
        expect(feature.properties.badge, feature.properties.id).toBe(
          CATEGORY_LETTERS[feature.properties.category],
        );
        expect(feature.properties.badge).toMatch(/^[A-Z]$/);
      }
    }
  });

  it("gives every category a badge that differs from every other category's", () => {
    const collection = buildNodeCollection(ALL_VENUE_MAP.nodes, "", "");
    const byCategory = new Map<string, Set<string>>();
    for (const feature of collection.features) {
      const badges = byCategory.get(feature.properties.category) ?? new Set<string>();
      badges.add(feature.properties.badge);
      byCategory.set(feature.properties.category, badges);
    }

    // One letter per category, and one category per letter.
    const seen = new Set<string>();
    for (const [category, badges] of byCategory) {
      expect(badges.size, `${category} has more than one badge`).toBe(1);
      const [letter] = [...badges] as string[];
      expect(seen.has(letter as string), `${letter} is used by two categories`).toBe(false);
      seen.add(letter as string);
    }
    expect(byCategory.size).toBe(MAP_NODE_CATEGORIES.length);
  });

  it("marks every zone of the combined view, from both venues", () => {
    const collection = buildNodeCollection(ALL_VENUE_MAP.nodes, "dv-montagoe", "ds-mainstage");
    expect(collection.features).toHaveLength(ALL_VENUE_MAP.nodes.length);

    const ids = collection.features.map((feature) => feature.properties.id);
    expect(ids).toContain("dv-montagoe");
    expect(ids).toContain("ds-mainstage");
    expect(new Set(ids).size).toBe(ids.length);
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
    for (const { map } of VIEWS) {
      expect(venueBoundsPair(map)).toEqual([
        [map.bounds.west, map.bounds.south],
        [map.bounds.east, map.bounds.north],
      ]);
    }
  });

  it("produces a usable box for every view, including the combined one", () => {
    for (const { map } of VIEWS) {
      const [[west, south], [east, north]] = venueBoundsPair(map);
      expect(west).toBeLessThan(east);
      expect(south).toBeLessThan(north);
    }
  });

  it("gives the combined view a box wide enough to hold both venues", () => {
    const [[west, south], [east, north]] = venueBoundsPair(ALL_VENUE_MAP);
    expect(west).toBeLessThanOrEqual(DE_SCHORRE_MAP.bounds.west);
    expect(east).toBeGreaterThanOrEqual(DREAMVILLE_MAP.bounds.east);
    expect(south).toBeLessThanOrEqual(DE_SCHORRE_MAP.bounds.south);
    expect(north).toBeGreaterThanOrEqual(DREAMVILLE_MAP.bounds.north);
  });
});

describe("buildLocateCollection", () => {
  it("draws one point at the position the visitor gave", () => {
    const collection = buildLocateCollection([4.3968, 51.0922]);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [4.3968, 51.0922],
    });
  });

  it("draws nothing until the visitor asks to be located", () => {
    expect(buildLocateCollection(null).features).toEqual([]);
  });

  it("refuses a coordinate MapLibre would throw on", () => {
    for (const position of [
      [Number.NaN, 51.09],
      [4.38, Number.POSITIVE_INFINITY],
      [181, 51.09],
      [4.38, -91],
      [999, 999],
    ] as const) {
      expect(buildLocateCollection(position as unknown as GeoJsonPosition).features, `${position}`).toEqual(
        [],
      );
    }
  });

  it("returns a collection MapLibre will accept as a source", () => {
    const collection = buildLocateCollection([4.3868, 51.0928]);
    expect(collection.type).toBe("FeatureCollection");
    expect(collection.features[0]?.type).toBe("Feature");
    expect(JSON.parse(JSON.stringify(collection))).toEqual(collection);
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
