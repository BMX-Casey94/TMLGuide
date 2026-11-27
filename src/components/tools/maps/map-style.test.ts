// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BASE_SOURCE_ID,
  buildMapStyle,
  MAP_FONT,
  MAP_GLYPHS_URL,
  MAP_PALETTE,
  MAP_TILE_HOST,
  MAP_TILE_URL_PATTERN,
  MAP_TILEJSON_URL,
} from "./map-style";
import { buildMapLayers, INTERACTIVE_NODE_LAYERS } from "./map-layer-specs";
import { LAYER_IDS, SOURCE_IDS } from "./map-layers";
import {
  GROUND_COLOUR,
  LOCATE_COLOUR,
  LOCATE_CORE_COLOUR,
} from "./map-layers";
import { DE_SCHORRE_MAP } from "@/lib/maps/geo-data";
import { haversineMiles, nodeById } from "@/lib/maps/geo-routing";
import type { GeoMapNode } from "@/lib/maps/geo-types";

/*
  The style and the layers are plain data, so they can be checked without a
  canvas. These tests are about the two things a data mistake would cost: a tile
  request the CSP forbids, and a layer that refers to a source that does not
  exist — both of which show as a blank map with no error a reader could see.
*/

describe("buildMapStyle", () => {
  it("is a valid MapLibre style version", () => {
    const style = buildMapStyle();
    expect(style.version).toBe(8);
    expect(style.sources).toBeDefined();
    expect(Array.isArray(style.layers)).toBe(true);
    expect(style.layers.length).toBeGreaterThan(5);
  });

  it("points the vector source at the TileJSON document, not a tile template", () => {
    const style = buildMapStyle();
    const source = style.sources?.[BASE_SOURCE_ID];

    expect(source).toBeDefined();
    if (source === undefined || source.type !== "vector") throw new Error("expected a vector source");

    /*
      This is the assertion that matters most in this file. The un-dated tile
      template `/planet/{z}/{x}/{y}.pbf` answers 200 with a zero-byte body for
      every coordinate (`x-ofm-debug: empty tile wildcard`), so a source built on a
      template draws bare ground while every network check passes. The TileJSON
      document always names the current dated build.
    */
    expect(source.url).toBe(MAP_TILEJSON_URL);
    expect(source.tiles).toBeUndefined();
  });

  it("never builds a tile template with a hard-coded build stamp", () => {
    // A dated path would work until OpenFreeMap rebuilt the planet, then 404.
    expect(MAP_TILE_URL_PATTERN).not.toMatch(/planet\/\d{8}_/);
    expect(MAP_TILEJSON_URL).toBe(`${MAP_TILE_HOST}/planet`);
    expect(MAP_TILE_URL_PATTERN.endsWith(".pbf")).toBe(true);
  });

  it("only ever names the tile host the CSP allows", () => {
    // The origin here has to match `MAP_TILE_ORIGIN` in `src/lib/security/csp.ts`,
    // or every tile is refused and the canvas stays empty.
    expect(MAP_TILEJSON_URL.startsWith("https://tiles.openfreemap.org/")).toBe(true);
    expect(MAP_GLYPHS_URL.startsWith("https://tiles.openfreemap.org/")).toBe(true);

    const serialised = JSON.stringify(buildMapStyle());
    const urls = serialised.match(/https?:\/\/[^"]+/g) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.startsWith("https://tiles.openfreemap.org/")).toBe(true);
    }
  });

  it("requests glyphs, so labels can actually be drawn", () => {
    const style = buildMapStyle();
    expect(style.glyphs).toBe(MAP_GLYPHS_URL);
    expect(style.glyphs).toContain("{fontstack}");
    expect(style.glyphs).toContain("{range}");
  });

  it("uses no sprite sheet, so there is no third-party image to allow", () => {
    expect(buildMapStyle().sprite).toBeUndefined();
  });

  it("paints the warm-black ground the Dusk Programme uses", () => {
    const style = buildMapStyle();
    const background = style.layers.find((layer) => layer.type === "background");
    expect(background).toBeDefined();
    if (background === undefined || background.type !== "background") return;
    expect(background.paint?.["background-color"]).toBe(MAP_PALETTE.ground);
    expect(MAP_PALETTE.ground).toBe("#0d0b0a");
  });

  it("returns a fresh object each call, because MapLibre mutates the spec", () => {
    const first = buildMapStyle();
    const second = buildMapStyle();
    expect(first).not.toBe(second);
    expect(first.layers).not.toBe(second.layers);
    expect(first).toEqual(second);
  });

  it("gives every layer a unique id", () => {
    const ids = buildMapStyle().layers.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("refers every non-background layer to the source it declared", () => {
    const style = buildMapStyle();
    for (const layer of style.layers) {
      if (layer.type === "background") continue;
      expect(layer.source, layer.id).toBe(BASE_SOURCE_ID);
    }
  });

  it("orders the layers so water sits above land and buildings above water", () => {
    const ids = buildMapStyle().layers.map((layer) => layer.id);
    const at = (id: string) => ids.indexOf(id);
    expect(at("background")).toBeLessThan(at("landcover-wood"));
    expect(at("landcover-wood")).toBeLessThan(at("water"));
    expect(at("water")).toBeLessThan(at("building"));
    expect(at("building")).toBeLessThan(at("building-3d"));
    expect(at("building-3d")).toBeLessThan(at("road-casing"));
    expect(at("place-label")).toBeGreaterThan(at("path"));
  });

  it("extrudes the buildings so the 3D view has walls as well as ground", () => {
    const style = buildMapStyle();
    const extrusion = style.layers.find((layer) => layer.type === "fill-extrusion");
    expect(extrusion, "no fill-extrusion layer").toBeDefined();
    if (extrusion === undefined || extrusion.type !== "fill-extrusion") return;

    expect(extrusion.source).toBe(BASE_SOURCE_ID);
    expect(extrusion["source-layer"]).toBe("building");
    // A height expression, so a real building height is used where OpenMapTiles
    // has one and a plausible fallback where it does not. A literal height here
    // would make every shed the same tall box.
    expect(extrusion.paint?.["fill-extrusion-height"]).toBeDefined();
    const height = JSON.stringify(extrusion.paint?.["fill-extrusion-height"]);
    expect(height).toContain("render_height");
    expect(height).toContain("coalesce");
  });

  it("declares no elevation source, because the ground is probed at runtime", () => {
    /*
      The DEM and its hillshade are added by `attachSurveyedGround` only after a
      real Boom tile comes back as image bytes, so a blocked host leaves a clean
      flat map rather than a terrain mesh with no heights under it. A DEM source
      in the static style would remove that fallback and also collide with the one
      the probe adds, which MapLibre rejects as a duplicate id.
    */
    const sources = buildMapStyle().sources ?? {};
    for (const [id, source] of Object.entries(sources)) {
      expect(source.type, `${id} is a DEM in the static style`).not.toBe("raster-dem");
    }
    expect(buildMapStyle().layers.some((layer) => layer.type === "hillshade")).toBe(false);
  });

  it("uses the one font stack OpenFreeMap publishes", () => {
    const style = buildMapStyle();
    const symbolLayers = style.layers.filter((layer) => layer.type === "symbol");
    expect(symbolLayers.length).toBeGreaterThan(0);

    for (const layer of symbolLayers) {
      if (layer.type !== "symbol") continue;
      expect(layer.layout?.["text-font"]).toEqual([MAP_FONT]);
    }
    expect(MAP_FONT).toBe("Noto Sans Regular");
  });

  it("keeps the whole world requestable, because the TileJSON bounds come from OpenFreeMap", () => {
    /*
      The document states world bounds, and the style must not narrow them: a
      tighter `bounds` on a vector source makes MapLibre discard tiles outside it,
      which is the same blank-map failure in a different disguise. The camera is
      constrained instead, through `maxBounds` in the component.
    */
    const source = buildMapStyle().sources?.[BASE_SOURCE_ID];
    if (source === undefined || source.type !== "vector") throw new Error("expected a vector source");
    expect(source.bounds).toBeUndefined();
    expect(source.minzoom).toBeUndefined();
    expect(source.maxzoom).toBeUndefined();
  });
});

describe("buildMapLayers", () => {
  it("adds every source the component creates, and reads only declared ones", () => {
    const layers = buildMapLayers();
    const declared = new Set<string>(Object.values(SOURCE_IDS));

    for (const layer of layers) {
      if (!("source" in layer) || layer.source === undefined) continue;
      expect(declared.has(layer.source), layer.id).toBe(true);
    }
  });

  it("keeps every layer id unique and matches the exported constants", () => {
    const ids = buildMapLayers().map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of Object.values(LAYER_IDS)) {
      expect(ids).toContain(id);
    }
  });

  it("orders the badge after the place labels, so a name beats a letter", () => {
    const ids = buildMapLayers().map((layer) => layer.id);
    // MapLibre places symbols in layer order and reserves each placed box, so the
    // later layer yields. Losing an "S" costs less than losing "Mainstage".
    expect(ids.indexOf(LAYER_IDS.nodeBadge)).toBeGreaterThan(ids.indexOf(LAYER_IDS.nodeLabel));
  });

  it("draws the overlay wash under its own outline, and the route over both", () => {
    const ids = buildMapLayers().map((layer) => layer.id);
    const at = (id: string) => ids.indexOf(id);
    expect(at(LAYER_IDS.overlayFill)).toBeLessThan(at(LAYER_IDS.overlayEdge));
    expect(at(LAYER_IDS.overlayEdge)).toBeLessThan(at(LAYER_IDS.overlayLine));
    expect(at(LAYER_IDS.overlayLine)).toBeLessThan(at(LAYER_IDS.routeGlow));
    expect(at(LAYER_IDS.routeGlow)).toBeLessThan(at(LAYER_IDS.routeLine));
    expect(at(LAYER_IDS.routeLine)).toBeLessThan(at(LAYER_IDS.nodeCircle));
  });

  it("draws route ends above ordinary markers, and place names above everything", () => {
    const ids = buildMapLayers().map((layer) => layer.id);
    const at = (id: string) => ids.indexOf(id);
    expect(at(LAYER_IDS.nodeCircle)).toBeLessThan(at(LAYER_IDS.endpointCircle));
    expect(at(LAYER_IDS.endpointCircle)).toBeLessThan(at(LAYER_IDS.nodeLabel));
    expect(at(LAYER_IDS.nodeLabel)).toBeLessThan(at(LAYER_IDS.endpointLabel));
    // Badges come last so the place labels win any collision with a letter.
    expect(at(LAYER_IDS.endpointLabel)).toBeLessThan(at(LAYER_IDS.nodeBadge));
  });

  it("prints a category letter inside each marker, as a second channel to colour", () => {
    const layers = buildMapLayers();
    const badge = layers.find((layer) => layer.id === LAYER_IDS.nodeBadge);
    if (badge === undefined || badge.type !== "symbol") throw new Error("badge layer missing");

    expect(badge.source).toBe(SOURCE_IDS.nodes);
    expect(badge.layout?.["text-field"]).toEqual(["get", "badge"]);
    expect(badge.layout?.["text-font"]).toEqual([MAP_FONT]);
    // Two letters must never print over each other, so collision drops one.
    expect(badge.layout?.["text-allow-overlap"]).toBe(false);
    expect(badge.layout?.["text-anchor"]).toBe("center");
    // Dark ink on every category colour, which is the only combination that
    // stays legible on the pale cream and the pale green as well as the gold.
    expect(badge.paint?.["text-color"]).toBe(GROUND_COLOUR);
  });

  it("leaves the route ends' own A and B letters as the only letter on those markers", () => {
    const badge = buildMapLayers().find((layer) => layer.id === LAYER_IDS.nodeBadge);
    if (badge === undefined || badge.type !== "symbol") throw new Error("badge layer missing");
    // Route ends draw a larger circle with "A"/"B" on it; a second letter under
    // it would be unreadable.
    expect(badge.filter).toBeDefined();
    const serialised = JSON.stringify(badge.filter);
    expect(serialised).toContain("endpoint");
    expect(serialised).toContain('""');
  });

  it("draws the visitor's own position only when they have asked for it", () => {
    const layers = buildMapLayers();
    const halo = layers.find((layer) => layer.id === LAYER_IDS.locateHalo);
    const dot = layers.find((layer) => layer.id === LAYER_IDS.locateDot);
    if (halo === undefined || halo.type !== "circle") throw new Error("locate halo missing");
    if (dot === undefined || dot.type !== "circle") throw new Error("locate dot missing");

    expect(halo.source).toBe(SOURCE_IDS.locate);
    expect(dot.source).toBe(SOURCE_IDS.locate);
    // A white core inside a saturated halo: unlike every category badge, so the
    // reader's own position cannot be mistaken for a place in the guide.
    expect(dot.paint?.["circle-color"]).toBe(LOCATE_CORE_COLOUR);
    expect(halo.paint?.["circle-color"]).toBe(LOCATE_COLOUR);
    expect(dot.paint?.["circle-stroke-color"]).toBe(LOCATE_COLOUR);
  });

  it("draws the visitor's marker above every zone, but below the labels", () => {
    const ids = buildMapLayers().map((layer) => layer.id);
    const at = (id: string) => ids.indexOf(id);
    expect(at(LAYER_IDS.endpointCircle)).toBeLessThan(at(LAYER_IDS.locateHalo));
    expect(at(LAYER_IDS.locateHalo)).toBeLessThan(at(LAYER_IDS.locateDot));
    expect(at(LAYER_IDS.locateDot)).toBeLessThan(at(LAYER_IDS.nodeLabel));
  });

  it("keeps node labels clear of the badge they sit under", () => {
    const layers = buildMapLayers();
    const label = layers.find((layer) => layer.id === LAYER_IDS.nodeLabel);
    const circle = layers.find((layer) => layer.id === LAYER_IDS.nodeCircle);
    if (label === undefined || label.type !== "symbol") throw new Error("label layer missing");
    if (circle === undefined || circle.type !== "circle") throw new Error("node circle missing");

    /*
      Recomputed rather than eyeballed. The offset is in ems of the label's own
      size, so the pair has to be compared as pixels at each zoom where both are
      drawn; a later tweak to either interpolation would otherwise put the label
      on top of the badge with nothing to catch it.
    */
    const labelSize = label.layout?.["text-size"] as unknown as [
      "interpolate",
      unknown,
      unknown,
      number,
      number,
      number,
      number,
    ];
    const radius = circle.paint?.["circle-radius"] as unknown as [
      "interpolate",
      unknown,
      unknown,
      number,
      number,
      number,
      number,
    ];
    const [, , , zLow, labelLow, zHigh, labelHigh] = labelSize;
    const [, , , rLow, radiusLow, rHigh, radiusHigh] = radius;

    const [, vertical] = label.layout?.["text-offset"] as [number, number];
    expect(vertical).toBeGreaterThan(0);

    for (const zoom of [zLow, (zLow + zHigh) / 2, zHigh]) {
      const size = labelLow + ((labelHigh - labelLow) * (zoom - zLow)) / (zHigh - zLow);
      const disc = radiusLow + ((radiusHigh - radiusLow) * (zoom - rLow)) / (rHigh - rLow);
      expect(vertical * size, `label at zoom ${zoom} touches its disc`).toBeGreaterThan(
        disc + 2,
      );
    }
  });

  it("never lets two category letters print over each other", () => {
    const badge = buildMapLayers().find((layer) => layer.id === LAYER_IDS.nodeBadge);
    if (badge === undefined || badge.type !== "symbol") throw new Error("badge layer missing");

    /*
      The collision guarantee is MapLibre's, not a hand-tuned zoom floor: with
      overlap disallowed, a letter that would touch one already placed is dropped
      instead of overprinted. That is the same mechanism that keeps the place
      labels apart, and it holds at every zoom rather than above a threshold.
    */
    expect(badge.layout?.["text-allow-overlap"]).toBe(false);
    expect(badge.layout?.["text-ignore-placement"]).toBe(false);
    expect(badge.minzoom).toBeDefined();

    // The letter is a separate layer from the disc, so a dropped letter never
    // costs the marker its category colour.
    const circle = buildMapLayers().find((layer) => layer.id === LAYER_IDS.nodeCircle);
    if (circle === undefined || circle.type !== "circle") throw new Error("node circle missing");
    expect(circle.minzoom).toBeUndefined();
  });

  it("keeps the badges clear of the closest pair on the site at a readable zoom", () => {
    const circle = buildMapLayers().find((layer) => layer.id === LAYER_IDS.nodeCircle);
    if (circle === undefined || circle.type !== "circle") throw new Error("node circle missing");

    // Elixir and The Rave Cave are closer than this pair. The gate and its
    // lockers are still a tight pair, and this records their geometry so a
    // future change that made the discs overlap is visible here.
    const gate = nodeById(DE_SCHORRE_MAP, "ds-dreamville-gate") as GeoMapNode;
    const lockers = nodeById(DE_SCHORRE_MAP, "ds-lockers-dreamville") as GeoMapNode;
    const metres = haversineMiles([gate.lng, gate.lat], [lockers.lng, lockers.lat]) * 1609.344;
    expect(metres).toBeGreaterThan(20);

    const radius = circle.paint?.["circle-radius"] as unknown as [
      "interpolate",
      unknown,
      unknown,
      number,
      number,
      number,
      number,
    ];
    const [, , , zLow, radiusLow, zHigh, radiusHigh] = radius;
    const discAtSeventeen = 2 * (radiusLow + ((radiusHigh - radiusLow) * (17 - zLow)) / (zHigh - zLow));
    const metresPerPixel = (156543.03392 * Math.cos((gate.lat * Math.PI) / 180)) / Math.pow(2, 17);
    // By zoom 17 the pair is comfortably wider apart than a disc, so both letters
    // are placed and the collision engine has nothing to drop.
    expect(metres / metresPerPixel).toBeGreaterThan(discAtSeventeen * 2);
  });

  it("stops node labels colliding rather than overprinting them", () => {
    const labels = buildMapLayers().find((layer) => layer.id === LAYER_IDS.nodeLabel);
    if (labels === undefined || labels.type !== "symbol") throw new Error("label layer missing");

    expect(labels.layout?.["text-allow-overlap"]).toBe(false);
    expect(labels.layout?.["text-ignore-placement"]).toBe(false);
    // Route ends sort first, so they win a collision.
    expect(labels.layout?.["symbol-sort-key"]).toBeDefined();
  });

  it("keeps the endpoint letters solid, because they are two characters of information", () => {
    const endpoints = buildMapLayers().find((layer) => layer.id === LAYER_IDS.endpointLabel);
    if (endpoints === undefined || endpoints.type !== "symbol") throw new Error("endpoint layer missing");
    expect(endpoints.layout?.["text-allow-overlap"]).toBe(true);
  });

  it("draws the route in the one gold the brief names, and nothing else in gold", () => {
    const layers = buildMapLayers();
    const route = layers.find((layer) => layer.id === LAYER_IDS.routeLine);
    if (route === undefined || route.type !== "line") throw new Error("route layer missing");
    expect(route.paint?.["line-color"]).toBe("#ffc83d");

    // The glow is the same colour, so the whole route reads as one line.
    const glow = layers.find((layer) => layer.id === LAYER_IDS.routeGlow);
    if (glow === undefined || glow.type !== "line") throw new Error("glow layer missing");
    expect(glow.paint?.["line-color"]).toBe("#ffc83d");
  });

  it("filters polygons and lines into separate layers, so MapLibre accepts both", () => {
    const layers = buildMapLayers();
    const fill = layers.find((layer) => layer.id === LAYER_IDS.overlayFill);
    const line = layers.find((layer) => layer.id === LAYER_IDS.overlayLine);

    if (fill === undefined || fill.type === "background") throw new Error("fill layer missing");
    if (line === undefined || line.type === "background") throw new Error("line layer missing");

    expect(fill.filter).toEqual([
      "match",
      ["geometry-type"],
      ["Polygon", "MultiPolygon"],
      true,
      false,
    ]);
    expect(line.filter).toEqual([
      "match",
      ["geometry-type"],
      ["LineString", "MultiLineString"],
      true,
      false,
    ]);
  });

  it("names only layers that exist for the click handler to query", () => {
    const ids = new Set(buildMapLayers().map((layer) => layer.id));
    for (const id of INTERACTIVE_NODE_LAYERS) {
      expect(ids.has(id), id).toBe(true);
    }
    expect(INTERACTIVE_NODE_LAYERS).toContain(LAYER_IDS.nodeCircle);
  });
});
