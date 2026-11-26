/**
 * The MapLibre style for the venue maps: OpenFreeMap vector tiles, painted in the
 * Dusk Programme's warm blacks rather than a stock dark theme.
 *
 * ## Why a hand-written style rather than `https://tiles.openfreemap.org/styles/dark`
 *
 * The stock dark style is a city basemap. At zoom 15 over a 400-metre recreation
 * park it draws residential landuse, buildings, and a road hierarchy that has
 * nothing to do with the festival, and its neutral grey (#0c0c0c, rgb(32,32,32))
 * sits beside this site's warm black (#0d0b0a, #15110f) as a different colour
 * family. Two dozen layers here, tuned for one park at zoom 13–17, keep the
 * ground quiet so the gold route and the category markers are the only things
 * that read at a glance.
 *
 * Everything below is data, not code: {@link buildMapStyle} returns a plain
 * `StyleSpecification` object, so the structure can be tested without WebGL.
 *
 * ## Sources
 *
 * One vector source, from OpenFreeMap's OpenMapTiles schema. The tile URL is the
 * un-dated `planet` template rather than the dated TileJSON document's URL,
 * because the dated path changes when OpenFreeMap rebuilds the planet and a
 * hard-coded copy of it would go stale. The glyph endpoint is the same host.
 *
 * No sprite sheet is used. Every symbol layer here draws text with a glyph font
 * or a circle layer, so there is no icon to fetch and no third-party image to
 * allow.
 */

import type { StyleSpecification } from "maplibre-gl";

/** The tile host. Must match {@link MAP_TILE_ORIGIN} in `src/lib/security/csp.ts`. */
export const MAP_TILE_HOST = "https://tiles.openfreemap.org";

/**
 * The TileJSON document for the OpenMapTiles planet build.
 *
 * Pointing the source at this document, rather than at a tile template, is the one
 * way to be sure the tiles exist. Measured on 26 November 2026:
 *
 * - `{tiles: ["…/planet/{z}/{x}/{y}.pbf"]}` answers **`200` with zero bytes** for
 *   every coordinate, and reports `x-ofm-debug: empty tile wildcard`. A status
 *   check passes; the map renders bare ground. This is the trap.
 * - The un-dated path in this document is
 *   `…/planet/20261122_124456_pt/{z}/{x}/{y}.pbf`, which returns real data
 *   (124 kB for a Boom tile at z14).
 *
 * Hard-coding that dated path would work today and break when OpenFreeMap rebuilds
 * the planet, so the document is fetched instead: it always names the current
 * build. It costs one extra same-origin-to-the-tile-host request, cached by the
 * browser for an hour.
 */
export const MAP_TILEJSON_URL = `${MAP_TILE_HOST}/planet`;

/**
 * The tile template, for documentation and tests only.
 *
 * Not used by the style. It is the shape the TileJSON resolves to, kept so a test
 * can assert the host and the `.pbf` extension without hard-coding a build stamp.
 */
export const MAP_TILE_URL_PATTERN = `${MAP_TILE_HOST}/planet/{build}/{z}/{x}/{y}.pbf`;

/** Glyph ranges, which MapLibre requests as `{fontstack}/{range}.pbf`. */
export const MAP_GLYPHS_URL = `${MAP_TILE_HOST}/fonts/{fontstack}/{range}.pbf`;

/**
 * The only font stack the style uses.
 *
 * It is the one OpenFreeMap publishes, so a label can never request a font the
 * server does not have — which shows as a blank label rather than an error.
 */
export const MAP_FONT = "Noto Sans Regular";

/** Source id for the vector basemap. */
export const BASE_SOURCE_ID = "openfreetiles";

/**
 * Colour tokens, in one place.
 *
 * They are literal values rather than CSS custom properties because MapLibre
 * paints into a canvas and cannot read a CSS variable. The values match the Dusk
 * Programme palette in `globals.css`: `--ground: #0c0a09`, `--surface: #15110f`,
 * `--cream: #f4ece0`, `--ea: #ffc83d`, `--teal: #2bc4b4`.
 */
export const MAP_PALETTE = {
  /** Warm black ground, a shade lighter than the page so the map reads as a panel. */
  ground: "#0d0b0a",
  /** Woodland and park fill: a deep warm green, distinct from the page black. */
  woodland: "#141c14",
  /** Residential landuse, kept barely above the ground. */
  residential: "#141110",
  /** Water: muted teal-black, matching the overlay teal without shouting. */
  water: "#101b1c",
  /** Water outlines, for the edge of a lake against woodland. */
  waterEdge: "#1e2f31",
  /** Buildings, a hair above the ground so they texture the site without competing. */
  building: "#191512",
  buildingEdge: "#241d18",
  /** The road and path casing, and the lighter fill inside it. */
  roadCasing: "#221c17",
  roadFill: "#2c241d",
  /** Paths, drawn dashed and quieter than roads. */
  path: "#241e19",
  /** Place and water labels: the cream, held well back. */
  label: "#f4ece0",
  labelHalo: "#0d0b0a",
  /** Route and marker gold, matching `--ea`. */
  gold: "#ffc83d",
} as const;

/**
 * Builds the complete style specification for the venue maps.
 *
 * The layers are ordered deliberately: background, then ground cover, then water,
 * then buildings, then the transport network, then labels. Ground overlays and
 * the walking route are added on top of this at runtime from
 * `src/lib/maps/geo-data.ts`, so nothing here knows about the festival.
 *
 * @returns a fresh object each call, because MapLibre mutates the spec it is given
 *   and two maps sharing one object would fight over it.
 */
export function buildMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: "TMLGuide venue dark",
    glyphs: MAP_GLYPHS_URL,
    sources: {
      [BASE_SOURCE_ID]: {
        type: "vector",
        /*
          The TileJSON document, not a tile template. The un-dated template
          (`/planet/{z}/{x}/{y}.pbf`) answers 200 with zero bytes for every
          coordinate, so a template-based source draws bare ground and nothing
          reports an error. See `MAP_TILEJSON_URL`.
        */
        url: MAP_TILEJSON_URL,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": MAP_PALETTE.ground },
      },
      {
        id: "landcover-wood",
        type: "fill",
        source: BASE_SOURCE_ID,
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "wood"],
        paint: { "fill-color": MAP_PALETTE.woodland, "fill-opacity": 0.9 },
      },
      {
        id: "landuse-park",
        type: "fill",
        source: BASE_SOURCE_ID,
        "source-layer": "landuse",
        filter: ["==", ["get", "class"], "park"],
        paint: { "fill-color": MAP_PALETTE.woodland, "fill-opacity": 0.55 },
      },
      {
        id: "landuse-residential",
        type: "fill",
        source: BASE_SOURCE_ID,
        "source-layer": "landuse",
        maxzoom: 12,
        filter: ["==", ["get", "class"], "residential"],
        paint: { "fill-color": MAP_PALETTE.residential, "fill-opacity": 0.6 },
      },
      {
        id: "water",
        type: "fill",
        source: BASE_SOURCE_ID,
        "source-layer": "water",
        filter: [
          "all",
          ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false],
          ["!=", ["get", "brunnel"], "tunnel"],
        ],
        paint: { "fill-color": MAP_PALETTE.water, "fill-antialias": false },
      },
      {
        id: "water-outline",
        type: "line",
        source: BASE_SOURCE_ID,
        "source-layer": "water",
        filter: ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false],
        paint: { "line-color": MAP_PALETTE.waterEdge, "line-width": 0.8 },
      },
      {
        id: "waterway",
        type: "line",
        source: BASE_SOURCE_ID,
        "source-layer": "waterway",
        filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
        paint: { "line-color": MAP_PALETTE.waterEdge, "line-width": 1 },
      },
      {
        id: "building",
        type: "fill",
        source: BASE_SOURCE_ID,
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-color": MAP_PALETTE.building,
          "fill-outline-color": MAP_PALETTE.buildingEdge,
        },
      },
      {
        id: "road-casing",
        type: "line",
        source: BASE_SOURCE_ID,
        "source-layer": "transportation",
        minzoom: 12,
        filter: [
          "all",
          ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
          ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_PALETTE.roadCasing,
          "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 12, 3, 17, 14],
        },
      },
      {
        id: "road-fill",
        type: "line",
        source: BASE_SOURCE_ID,
        "source-layer": "transportation",
        minzoom: 12,
        filter: [
          "all",
          ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
          ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_PALETTE.roadFill,
          "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 12, 1.5, 17, 9],
        },
      },
      {
        id: "road-minor",
        type: "line",
        source: BASE_SOURCE_ID,
        "source-layer": "transportation",
        minzoom: 13,
        filter: [
          "all",
          ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
          ["match", ["get", "class"], ["minor", "service", "track"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_PALETTE.path,
          "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 13, 1, 17, 5],
        },
      },
      {
        id: "path",
        type: "line",
        source: BASE_SOURCE_ID,
        "source-layer": "transportation",
        minzoom: 14,
        filter: [
          "all",
          ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
          ["match", ["get", "class"], ["path", "pedestrian"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": MAP_PALETTE.path,
          "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 14, 1, 17, 3.5],
          "line-dasharray": [2, 1.6],
        },
      },
      {
        id: "place-label",
        type: "symbol",
        source: BASE_SOURCE_ID,
        "source-layer": "place",
        minzoom: 12,
        filter: ["match", ["get", "class"], ["village", "town", "suburb"], true, false],
        layout: {
          "text-field": ["get", "name"],
          "text-font": [MAP_FONT],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 16, 14],
          "text-letter-spacing": 0.08,
          "text-transform": "uppercase",
          "text-max-width": 8,
        },
        paint: {
          "text-color": MAP_PALETTE.label,
          "text-opacity": 0.42,
          "text-halo-color": MAP_PALETTE.labelHalo,
          "text-halo-width": 1.4,
        },
      },
      {
        id: "water-label",
        type: "symbol",
        source: BASE_SOURCE_ID,
        "source-layer": "water_name",
        minzoom: 13,
        layout: {
          "text-field": ["get", "name"],
          "text-font": [MAP_FONT],
          "text-size": 11,
          "text-letter-spacing": 0.1,
          "symbol-placement": "line",
        },
        paint: {
          "text-color": MAP_PALETTE.label,
          "text-opacity": 0.34,
          "text-halo-color": MAP_PALETTE.labelHalo,
          "text-halo-width": 1.2,
        },
      },
    ],
  };
}
