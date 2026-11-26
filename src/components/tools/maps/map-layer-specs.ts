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
 * 6. Route ends, drawn larger, then the labels last so no marker covers one.
 *
 * Labels use `text-allow-overlap: false`, which is MapLibre's collision engine:
 * it hides a label that would collide with one already placed rather than letting
 * two print over each other. Route ends are placed first through `symbol-sort-key`,
 * so the two labels that matter most survive a collision.
 */

import type { LayerSpecification } from "maplibre-gl";

import { GROUND_COLOUR, LAYER_IDS, ROUTE_COLOUR, SOURCE_IDS } from "./map-layers";
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
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 4.5, 17, 9],
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
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 8, 17, 15],
        "circle-color": ["get", "colour"],
        "circle-stroke-color": GROUND_COLOUR,
        "circle-stroke-width": 2.6,
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
        "text-offset": [0, 0.9],
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
  ];
}

/** Layer ids that carry a node id in their feature properties, for click handling. */
export const INTERACTIVE_NODE_LAYERS: readonly string[] = [
  LAYER_IDS.nodeCircle,
  LAYER_IDS.endpointCircle,
];
