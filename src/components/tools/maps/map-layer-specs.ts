/**
 * The MapLibre layers drawn on top of the basemap from {@link buildMapStyle}.
 *
 * Kept apart from the style because they are added once the map has loaded and
 * their data changes as the visitor picks categories, searches and plans a walk.
 * The style is the static world; this is the interactive drawing on top of it.
 *
 * ## Order
 *
 * 1. Overlay washes (polygons) — the lakes, the woods, the bowl, the campsite fields.
 * 2. Overlay outlines, so a district reads as a shape rather than a smudge.
 * 3. The dashed walking spine, under everything else that moves.
 * 4. A wide, blurred gold casing under the route, then the route itself.
 * 5. Node markers, with the inspected node's ring beneath them.
 * 6. The category letter inside each marker, so the kind of place survives a
 *    colour-blind reader, a dark screen and a printed page.
 * 7. Route ends, drawn larger, then the visitor's own position.
 * 8. Labels last, so no marker covers one.
 *
 * Labels use `text-allow-overlap: false`, which is MapLibre's collision engine:
 * it hides a label that would collide with one already placed rather than letting
 * two print over each other. Route ends are placed first through `symbol-sort-key`,
 * so the two labels that matter most survive a collision.
 *
 * The badge letters go the other way. Two letters must never print over each
 * other, so they take MapLibre's collision engine rather than escaping it: a
 * letter that would touch one already placed is dropped, and the disc beneath it
 * is still painted, so the marker never loses its category colour. A whole-venue
 * zoom may therefore show one of the two closest markers without its letter;
 * the legend and every list row still name every category in words.
 */

import type { LayerSpecification } from "maplibre-gl";

import { GROUND_COLOUR, LAYER_IDS, LOCATE_COLOUR, LOCATE_CORE_COLOUR, ROUTE_COLOUR, SOURCE_IDS } from "./map-layers";
import { MAP_FONT } from "./map-style";

/** Every layer the venue map adds, in draw order. */
export function buildMapLayers(): LayerSpecification[] {
  return [
    {
      id: LAYER_IDS.overlayFill,
      type: "fill",
      source: SOURCE_IDS.overlay,
      filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
      paint: {
        "fill-color": ["get", "fill"],
        "fill-opacity": ["get", "opacity"],
        "fill-antialias": true,
      },
    },
    {
      id: LAYER_IDS.overlayEdge,
      type: "line",
      source: SOURCE_IDS.overlay,
      filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ["get", "edge"],
        "line-width": ["get", "edgeWidth"],
        "line-opacity": 0.7,
      },
    },
    {
      id: LAYER_IDS.overlayLine,
      type: "line",
      source: SOURCE_IDS.overlay,
      filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
      layout: { "line-join": "round", "line-cap": "butt" },
      paint: {
        "line-color": ["get", "edge"],
        "line-width": ["get", "edgeWidth"],
        "line-opacity": 0.55,
        "line-dasharray": [1.6, 1.8],
      },
    },
    {
      id: LAYER_IDS.routeGlow,
      type: "line",
      source: SOURCE_IDS.route,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ROUTE_COLOUR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 10, 17, 26],
        "line-opacity": 0.16,
        "line-blur": ["interpolate", ["linear"], ["zoom"], 13, 4, 17, 10],
      },
    },
    {
      id: LAYER_IDS.routeLine,
      type: "line",
      source: SOURCE_IDS.route,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ROUTE_COLOUR,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2.5, 17, 7],
        "line-opacity": 0.95,
      },
    },
    {
      id: LAYER_IDS.inspectedRing,
      type: "circle",
      source: SOURCE_IDS.inspected,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 14, 17, 30],
        "circle-color": "transparent",
        "circle-stroke-color": ROUTE_COLOUR,
        "circle-stroke-width": 2,
        "circle-stroke-opacity": 0.85,
      },
    },
    {
      id: LAYER_IDS.nodeCircle,
      type: "circle",
      source: SOURCE_IDS.nodes,
      paint: {
        // Sized to hold a letter legibly: the badge below is the second channel
        // that carries the category, so the disc has to be big enough to read.
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 6.5, 17, 11],
        "circle-color": ["get", "colour"],
        "circle-stroke-color": GROUND_COLOUR,
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 13, 1.4, 17, 2.4],
        "circle-opacity": 0.95,
      },
    },
    {
      id: LAYER_IDS.endpointCircle,
      type: "circle",
      source: SOURCE_IDS.endpoints,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 9, 17, 16],
        "circle-color": ["get", "colour"],
        "circle-stroke-color": GROUND_COLOUR,
        "circle-stroke-width": 2.6,
      },
    },
    {
      /*
        The visitor's own position, drawn only when they have asked for it. The
        halo and the white core are unlike any category marker on purpose: this
        point is not a place in the guide, it is where the reader is standing.
      */
      id: LAYER_IDS.locateHalo,
      type: "circle",
      source: SOURCE_IDS.locate,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 13, 17, 26],
        "circle-color": LOCATE_COLOUR,
        "circle-opacity": 0.22,
        "circle-stroke-color": LOCATE_COLOUR,
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: LAYER_IDS.locateDot,
      type: "circle",
      source: SOURCE_IDS.locate,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 5.5, 17, 9],
        "circle-color": LOCATE_CORE_COLOUR,
        "circle-stroke-color": LOCATE_COLOUR,
        "circle-stroke-width": 3,
      },
    },
    {
      id: LAYER_IDS.nodeLabel,
      type: "symbol",
      source: SOURCE_IDS.nodes,
      minzoom: 13.5,
      layout: {
        "text-field": ["get", "shortLabel"],
        "text-font": [MAP_FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], 13.5, 10.5, 17, 13],
        // Collision handling: a label that would overlap one already drawn is
        // dropped rather than overprinted. Route ends sort first, so they win.
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-optional": true,
        "symbol-sort-key": ["-", 0, ["get", "priority"]],
        "text-anchor": "top",
        /*
          Clear of the disc at every zoom: the offset is in ems of the label's own
          size, so at 10.5–13px it is 12–15px, against a disc radius of 7–11px.
          That leaves 4–5px of daylight, which is why a label never touches its
          own badge. `map-style.test.ts` recomputes the pair rather than trusting
          these figures.
        */
        "text-offset": [0, 1.15],
        "text-max-width": 9,
        "text-padding": 4,
      },
      paint: {
        "text-color": "#f4ece0",
        "text-halo-color": GROUND_COLOUR,
        "text-halo-width": 1.8,
        "text-halo-blur": 0.4,
      },
    },
    {
      id: LAYER_IDS.endpointLabel,
      type: "symbol",
      source: SOURCE_IDS.endpoints,
      layout: {
        "text-field": ["get", "endpoint"],
        "text-font": [MAP_FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 17, 13],
        "text-allow-overlap": true,
        "text-anchor": "center",
      },
      paint: {
        "text-color": GROUND_COLOUR,
      },
    },
    {
      id: LAYER_IDS.nodeBadge,
      type: "symbol",
      source: SOURCE_IDS.nodes,
      /*
        The category letter inside each marker: the second channel to colour, so a
        reader who cannot separate the five hues can still tell a stage from a
        camp.

        Collision is handled by MapLibre rather than by a hand-tuned zoom floor.
        `text-allow-overlap: false` means a letter that would touch one already
        placed is dropped, so two letters can never print over each other at any
        zoom. The nearest two zones on the site are Elixir and The Rave Cave,
        about 23 metres apart on the bridge landing, so at a whole-venue zoom
        one of that pair loses its letter and keeps its colour; zoom in and
        both return.

        This layer comes *after* the place labels on purpose. MapLibre places
        symbols in layer order and a placed symbol reserves its box, so putting
        the letters last means the names of places win a collision and a letter
        yields. A reader who loses an "S" still has the place's name and its
        colour; a reader who lost "Mainstage" would have lost the thing itself.

        Drawing the letter separately from the disc is what makes that safe: the
        disc is a circle layer painted unconditionally, so every marker always
        carries its category colour and the legend always explains it.
      */
      minzoom: 14,
      // Route ends print their own A/B letter on a larger disc, so their
      // category badge would be a second letter on the same marker.
      filter: ["==", ["get", "endpoint"], ""],
      layout: {
        "text-field": ["get", "badge"],
        "text-font": [MAP_FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], 14, 7.5, 17, 10],
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-optional": true,
        "text-anchor": "center",
        "text-padding": 1,
      },
      paint: {
        /*
          Warm black on every category colour. Measured contrast against the five
          fills: 5.82:1 on the rose transport badge (the worst case), 9.97:1 on
          the camp green, and better on the rest — all above the 4.5:1 that AA
          asks of text this size. Cream or white would fail on the pale badges.
        */
        "text-color": GROUND_COLOUR,
      },
    },
  ];
}

/** Layer ids that carry a node id in their feature properties, for click handling. */
export const INTERACTIVE_NODE_LAYERS: readonly string[] = [
  LAYER_IDS.nodeCircle,
  LAYER_IDS.endpointCircle,
];
