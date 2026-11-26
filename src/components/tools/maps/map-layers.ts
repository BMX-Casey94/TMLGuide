/**
 * Turns the venue data in `src/lib/maps/geo-data.ts` into the GeoJSON that
 * MapLibre draws, and holds the one place each overlay colour is decided.
 *
 * Everything here is pure: data in, plain objects out. That is what lets the
 * styling be unit-tested without a canvas, and it keeps colour literals out of
 * the JSX.
 *
 * ## The colour scheme
 *
 * The ground overlays are the guide's own drawing of the site, so they carry the
 * meaning while the basemap stays quiet underneath.
 *
 * | kind | colour | why |
 * | --- | --- | --- |
 * | park footprint / site boundary | faint cream wash | defines the site without competing |
 * | water | muted teal | the clay-pit lakes are the site's strongest landmark |
 * | woodland | deep forest green | separates the Core valley from the lakes |
 * | stage bowl | warm gold | the amphitheatre is where the crowd ends up |
 * | district | one tint per campsite field | so five camping zones stay tellable apart |
 * | walking spine / walkway | dashed cream | the signed route, distinct from the gold A→B line |
 *
 * The route is gold and nothing else is, so the answer to "how do I get there"
 * is the only gold line on the map.
 */

import type {
  GeoJsonFeature,
  GeoJsonPosition,
  GeoMap,
  GeoMapNode,
  GeoRoute,
  MapNodeCategory,
  MapOverlayKind,
  MapOverlayProperties,
} from "@/lib/maps/geo-types";

/** Marker colour per category, shared by the map layers and the list legend. */
export const CATEGORY_COLOURS: Readonly<Record<MapNodeCategory, string>> = {
  stage: "#ffc83d",
  entrance: "#f4ece0",
  camp: "#7ec8a1",
  facility: "#8edbff",
  transport: "#f0527f",
};

/**
 * One letter per category, printed on every marker and on every legend swatch.
 *
 * Colour alone does not distinguish five categories for a visitor with a colour
 * vision deficiency, and this map is often read on a phone in the dark. The
 * letter is a second, independent channel: a disc says "this is a place", the
 * letter says what kind, and the legend prints the same letter so the key is
 * never a matter of matching shades. `S` for a stage, `E` for an entrance, `C`
 * for a camp, `F` for a facility, `T` for transport. Route ends use `A` and `B`,
 * which are outside that set.
 */
export const CATEGORY_LETTERS: Readonly<Record<MapNodeCategory, string>> = {
  stage: "S",
  entrance: "E",
  camp: "C",
  facility: "F",
  transport: "T",
};

/** Human label per category, used by the chips and the legend. */
export const CATEGORY_LABELS: Readonly<Record<MapNodeCategory, string>> = {
  stage: "Stages",
  entrance: "Entrances",
  camp: "Camp zones",
  facility: "Facilities",
  transport: "Transport",
};

/** The route colour. Used only for the walk being planned. */
export const ROUTE_COLOUR = "#ffc83d";

/** The destination end's colour, so A and B are distinguishable without the letters. */
export const DESTINATION_COLOUR = "#2bc4b4";

/** The warm-black ground the map is drawn on, used for halos and strokes. */
export const GROUND_COLOUR = "#0d0b0a";

/** Source ids. One source per kind of thing the map draws. */
export const SOURCE_IDS = {
  overlay: "tml-overlay",
  route: "tml-route",
  nodes: "tml-nodes",
  endpoints: "tml-endpoints",
  inspected: "tml-inspected",
  locate: "tml-locate",
} as const;

/** Layer ids, in one place so a handler cannot mistype the one it listens on. */
export const LAYER_IDS = {
  overlayFill: "tml-overlay-fill",
  overlayEdge: "tml-overlay-edge",
  overlayLine: "tml-overlay-line",
  routeGlow: "tml-route-glow",
  routeLine: "tml-route-line",
  inspectedRing: "tml-node-inspected",
  nodeCircle: "tml-node-circle",
  nodeBadge: "tml-node-badge",
  endpointCircle: "tml-endpoint-circle",
  nodeLabel: "tml-node-label",
  endpointLabel: "tml-endpoint-label",
  locateHalo: "tml-locate-halo",
  locateDot: "tml-locate-dot",
} as const;

/**
 * The visitor's own position marker.
 *
 * Deliberately unlike every category colour: a saturated white core inside a
 * teal halo, so it reads as "you are here" rather than as one more place. Teal
 * is used nowhere else on the map at full strength, and the marker carries no
 * letter, so it cannot be mistaken for a badge.
 */
export const LOCATE_COLOUR = "#2bc4b4";
export const LOCATE_CORE_COLOUR = "#f4ece0";

/** The feature properties the overlay layers read. */
export interface OverlayFeatureProperties {
  readonly kind: MapOverlayKind;
  readonly name: string;
  readonly fill: string;
  readonly opacity: number;
  readonly edge: string;
  readonly edgeWidth: number;
}

/** A style wash for one overlay. */
export interface OverlayStyle {
  readonly fill?: string;
  readonly fillOpacity?: number;
  readonly edge?: string;
  readonly edgeWidth?: number;
}

/**
 * The wash for each overlay kind.
 *
 * `district` is absent on purpose: the five campsite fields need five colours, so
 * they go through {@link districtTint} instead, keyed by the feature's own id.
 */
const OVERLAY_STYLES: Readonly<Record<Exclude<MapOverlayKind, "district">, OverlayStyle>> = {
  water: { fill: "#134e4a", fillOpacity: 0.55, edge: "#2bc4b4", edgeWidth: 1.4 },
  woodland: { fill: "#122a17", fillOpacity: 0.75, edge: "#1f4a28", edgeWidth: 1 },
  "stage-bowl": { fill: "#e9c46a", fillOpacity: 0.16, edge: "#e9c46a", edgeWidth: 1.6 },
  "park-footprint": { fill: "#f4ece0", fillOpacity: 0.03, edge: "#f4ece0", edgeWidth: 1 },
  "site-boundary": { fill: "#f4ece0", fillOpacity: 0.03, edge: "#f4ece0", edgeWidth: 1.2 },
  // Line overlays take their colour from `edge` and ignore the wash.
  "walking-spine": { edge: "#f4ece0", edgeWidth: 2.2 },
  walkway: { edge: "#f4ece0", edgeWidth: 2 },
};

/**
 * One tint per DreamVille district, keyed by feature id.
 *
 * Five translucent washes at 0.18 opacity: enough to tell the fields apart under
 * a marker, never enough to hide the basemap or the labels.
 */
const DISTRICT_TINTS: Readonly<Record<string, string>> = {
  "dreamville-montagoe": "#8edbff",
  "dreamville-easy-tent": "#c9a0ff",
  "dreamville-marketplace": "#ffc83d",
  "dreamville-magnificent-greens": "#7ec8a1",
  "dreamville-friendship-garden": "#f0527f",
};

/** A fallback for a district feature added without a registered tint. */
const DISTRICT_FALLBACK_TINT = "#f4ece0";

/** Resolves the style for one overlay feature. */
export function overlayStyleFor(
  featureId: string | undefined,
  kind: MapOverlayKind,
): OverlayStyle {
  if (kind === "district") {
    const tint =
      (featureId === undefined ? undefined : DISTRICT_TINTS[featureId]) ?? DISTRICT_FALLBACK_TINT;
    return { fill: tint, fillOpacity: 0.18, edge: tint, edgeWidth: 1.2 };
  }
  return OVERLAY_STYLES[kind];
}

/** A collection shaped exactly as MapLibre's GeoJSON source accepts one. */
export interface FeatureCollectionLike<P> {
  readonly type: "FeatureCollection";
  readonly features: readonly GeoJsonFeature<P>[];
}

/** Every styled overlay for one venue, polygons and lines in one collection. */
export function buildOverlayCollection(
  map: GeoMap,
): FeatureCollectionLike<OverlayFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: map.overlays.features.map((feature: GeoJsonFeature<MapOverlayProperties>) => {
      const style = overlayStyleFor(feature.id, feature.properties.kind);
      return {
        type: "Feature" as const,
        id: feature.id,
        properties: {
          kind: feature.properties.kind,
          name: feature.properties.name,
          fill: style.fill ?? "transparent",
          opacity: style.fillOpacity ?? 0,
          edge: style.edge ?? "#f4ece0",
          edgeWidth: style.edgeWidth ?? 1,
        },
        geometry: feature.geometry,
      };
    }),
  };
}

/** Properties carried by a node marker, all of which the layers and handlers read. */
export interface NodeFeatureProperties {
  readonly id: string;
  readonly name: string;
  readonly shortLabel: string;
  readonly category: MapNodeCategory;
  readonly colour: string;
  /** The category letter printed inside the marker: S, E, C, F or T. */
  readonly badge: string;
  /** 1 for the two route ends, 0 otherwise. Drives label priority. */
  readonly priority: number;
  /** "A", "B" or "" — printed on the marker when it is a route end. */
  readonly endpoint: string;
}

/** A point marker for one node. */
export function nodeMarker(
  node: GeoMapNode,
  fromId: string,
  toId: string,
): GeoJsonFeature<NodeFeatureProperties> {
  const endpoint = node.id === fromId ? "A" : node.id === toId ? "B" : "";
  return {
    type: "Feature",
    id: node.id,
    properties: {
      id: node.id,
      name: node.name,
      shortLabel: node.shortLabel,
      category: node.category,
      colour: CATEGORY_COLOURS[node.category],
      badge: CATEGORY_LETTERS[node.category],
      priority: endpoint === "" ? 0 : 1,
      endpoint,
    },
    geometry: { type: "Point", coordinates: [node.lng, node.lat] },
  };
}

/**
 * Every node the map should mark, as one collection.
 *
 * The two route ends are always included even when a category or search filter
 * has hidden them, because a route whose ends are invisible cannot be read.
 */
export function buildNodeCollection(
  nodes: readonly GeoMapNode[],
  fromId: string,
  toId: string,
): FeatureCollectionLike<NodeFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: nodes.map((node) => nodeMarker(node, fromId, toId)),
  };
}

/** The active walk as a single LineString, or an empty collection when there is none. */
export function buildRouteCollection(
  route: GeoRoute | null,
): FeatureCollectionLike<{ readonly name: string }> {
  if (route === null) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "active-route",
        properties: { name: `${route.from.name} to ${route.to.name}` },
        geometry: route.geometry,
      },
    ],
  };
}

/** One endpoint marker, so A and B can be drawn larger than the other nodes. */
export interface EndpointFeatureProperties {
  readonly endpoint: string;
  readonly name: string;
  readonly colour: string;
}

/**
 * A and B as two points, or an empty collection when the two ends are the same
 * node — two markers on one spot would print "A" over "B".
 */
export function buildEndpointCollection(
  route: GeoRoute | null,
): FeatureCollectionLike<EndpointFeatureProperties> {
  if (route === null) return { type: "FeatureCollection", features: [] };

  const start: GeoJsonFeature<EndpointFeatureProperties> = {
    type: "Feature",
    id: "endpoint-a",
    properties: { endpoint: "A", name: route.from.name, colour: ROUTE_COLOUR },
    geometry: { type: "Point", coordinates: [route.from.lng, route.from.lat] },
  };

  if (route.from.id === route.to.id) {
    return { type: "FeatureCollection", features: [start] };
  }

  return {
    type: "FeatureCollection",
    features: [
      start,
      {
        type: "Feature",
        id: "endpoint-b",
        properties: { endpoint: "B", name: route.to.name, colour: DESTINATION_COLOUR },
        geometry: { type: "Point", coordinates: [route.to.lng, route.to.lat] },
      },
    ],
  };
}

/** The single inspected node as a ring layer, or an empty collection. */
export function buildInspectedCollection(
  node: GeoMapNode | null,
): FeatureCollectionLike<{ readonly name: string }> {
  if (node === null) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "inspected",
        properties: { name: node.name },
        geometry: { type: "Point", coordinates: [node.lng, node.lat] },
      },
    ],
  };
}

/**
 * One venue's bounding box, as the `[[west, south], [east, north]]` pair
 * MapLibre's `fitBounds` takes.
 */
export function venueBoundsPair(map: GeoMap): [[number, number], [number, number]] {
  const { west, south, east, north } = map.bounds;
  return [
    [west, south],
    [east, north],
  ];
}

/**
 * The centre and a sensible zoom for one node, for a fly-to.
 *
 * The tuple is mutable because MapLibre's `LngLatLike` is a mutable pair and a
 * `readonly` one is not assignable to it.
 */
export function nodeFocus(node: GeoMapNode): {
  readonly center: [number, number];
  readonly zoom: number;
} {
  return { center: [node.lng, node.lat], zoom: 16.4 };
}

/** Properties carried by the visitor's own position marker. */
export interface LocateFeatureProperties {
  readonly label: string;
}

/**
 * The visitor's position as a single point, or an empty collection.
 *
 * The coordinate is held in React state and passed straight here; nothing is
 * written to storage, sent anywhere, or kept after the page is closed. An empty
 * collection is the "not located" state, so the layers need no visibility flag.
 *
 * The position is validated before it is turned into geometry: a browser is
 * allowed to hand back a nonsense coordinate, and a longitude of 500 would make
 * MapLibre throw rather than draw nothing.
 */
export function buildLocateCollection(
  position: GeoJsonPosition | null,
): FeatureCollectionLike<LocateFeatureProperties> {
  if (position === null) return { type: "FeatureCollection", features: [] };

  const [lng, lat] = position;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return { type: "FeatureCollection", features: [] };
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "visitor-location",
        properties: { label: "Your location" },
        geometry: { type: "Point", coordinates: [lng, lat] },
      },
    ],
  };
}
