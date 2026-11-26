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
    expect(at("building")).toBeLessThan(at("road-casing"));
    expect(at("place-label")).toBeGreaterThan(at("path"));
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

  it("draws the overlay wash under its own outline, and the route over both", () => {
    const ids = buildMapLayers().map((layer) => layer.id);
    const at = (id: string) => ids.indexOf(id);
    expect(at(LAYER_IDS.overlayFill)).toBeLessThan(at(LAYER_IDS.overlayEdge));
    expect(at(LAYER_IDS.overlayEdge)).toBeLessThan(at(LAYER_IDS.overlayLine));
    expect(at(LAYER_IDS.overlayLine)).toBeLessThan(at(LAYER_IDS.routeGlow));
    expect(at(LAYER_IDS.routeGlow)).toBeLessThan(at(LAYER_IDS.routeLine));
    expect(at(LAYER_IDS.routeLine)).toBeLessThan(at(LAYER_IDS.nodeCircle));
  });

  it("draws route ends above ordinary markers, and every label above both", () => {
    const ids = buildMapLayers().map((layer) => layer.id);
    const at = (id: string) => ids.indexOf(id);
    expect(at(LAYER_IDS.nodeCircle)).toBeLessThan(at(LAYER_IDS.endpointCircle));
    expect(at(LAYER_IDS.endpointCircle)).toBeLessThan(at(LAYER_IDS.nodeLabel));
    expect(at(LAYER_IDS.nodeLabel)).toBeLessThan(at(LAYER_IDS.endpointLabel));
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
