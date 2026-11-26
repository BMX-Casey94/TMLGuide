/**
 * Type vocabulary for the Tomorrowland venue maps.
 *
 * Two venues sit either side of the Boom–Rumst boundary: De Schorre, the
 * provincial recreation park where the festival is held, and DreamVille, the
 * campsite to its east. Everything here is plain TypeScript with no map-library
 * dependency, so the same declarations serve the data layer, the routing layer
 * and any GeoJSON consumer (MapLibre GL, a static export, a test fixture).
 *
 * Coordinates are WGS84 longitude/latitude pairs in GeoJSON order, which is
 * longitude first. Keeping that one order everywhere avoids a whole class of
 * swapped-axis bugs at the boundary between the data and the renderer.
 */

/** The two mapped venues. */
export type VenueMapId = "de-schorre" | "dreamville";

/** Every venue id, in the order the map switcher should list them. */
export const VENUE_MAP_IDS = ["de-schorre", "dreamville"] as const satisfies readonly VenueMapId[];

/** What a map node represents on the ground. */
export type MapNodeCategory = "stage" | "entrance" | "camp" | "facility" | "transport";

/** Every node category, in the order a legend should list them. */
export const MAP_NODE_CATEGORIES = [
  "stage",
  "entrance",
  "camp",
  "facility",
  "transport",
] as const satisfies readonly MapNodeCategory[];

/** A single longitude/latitude pair, `[lng, lat]`, in decimal degrees. */
export type GeoJsonPosition = readonly [lng: number, lat: number];

export interface GeoJsonPointGeometry {
  readonly type: "Point";
  readonly coordinates: GeoJsonPosition;
}

export interface GeoJsonLineStringGeometry {
  readonly type: "LineString";
  readonly coordinates: readonly GeoJsonPosition[];
}

/**
 * A polygon. The first ring is the exterior; any further rings are holes.
 * Rings are closed (first position repeated last) and exterior rings wind
 * anticlockwise, as RFC 7946 requires.
 */
export interface GeoJsonPolygonGeometry {
  readonly type: "Polygon";
  readonly coordinates: readonly (readonly GeoJsonPosition[])[];
}

export interface GeoJsonMultiPolygonGeometry {
  readonly type: "MultiPolygon";
  readonly coordinates: readonly (readonly (readonly GeoJsonPosition[])[])[];
}

export type GeoJsonGeometry =
  | GeoJsonPointGeometry
  | GeoJsonLineStringGeometry
  | GeoJsonPolygonGeometry
  | GeoJsonMultiPolygonGeometry;

/** The geometries that describe ground area rather than a line or a point. */
export type GeoJsonArealGeometry = GeoJsonPolygonGeometry | GeoJsonMultiPolygonGeometry;

export interface GeoJsonFeature<P = Record<string, unknown>> {
  readonly type: "Feature";
  readonly id?: string;
  readonly properties: P;
  readonly geometry: GeoJsonGeometry;
}

export interface GeoJsonFeatureCollection<P = Record<string, unknown>> {
  readonly type: "FeatureCollection";
  readonly features: readonly GeoJsonFeature<P>[];
}

/** What a ground overlay draws. */
export type MapOverlayKind =
  | "park-footprint"
  | "site-boundary"
  | "water"
  | "woodland"
  | "stage-bowl"
  | "district"
  | "walking-spine"
  | "walkway";

/**
 * Properties carried by every overlay feature, so a renderer can style a
 * feature without knowing anything beyond GeoJSON.
 */
export interface MapOverlayProperties {
  /** The venue this overlay belongs to. */
  readonly mapId: VenueMapId;
  readonly kind: MapOverlayKind;
  /** Human-readable name for a tooltip or legend entry. */
  readonly name: string;
  /** How exact the outline is, in plain words. */
  readonly notes: string;
}

/** A place a visitor can walk to or from. */
export interface GeoMapNode {
  /** Stable identifier, unique within its map. */
  readonly id: string;
  /** Full name as the guide writes it. */
  readonly name: string;
  /** Two or three words for a map label or a compact list row. */
  readonly shortLabel: string;
  readonly category: MapNodeCategory;
  /** Longitude in decimal degrees, WGS84. */
  readonly lng: number;
  /** Latitude in decimal degrees, WGS84. */
  readonly lat: number;
  /** One sentence on what the place is. */
  readonly summary: string;
  /** One sentence on what the crowd is usually like there. */
  readonly typicalZoneNote: string;
}

/**
 * A walkable link between two nodes. Edges are undirected: the footpath between
 * two places is the same length whichever way the visitor walks it.
 */
export interface GeoMapEdge {
  /** Node id at one end. */
  readonly from: string;
  /** Node id at the other end. */
  readonly to: string;
  /**
   * Walking distance in miles, already inflated from the straight line to
   * follow the footpath, rounded to two decimal places. Never kilometres.
   */
  readonly distanceMiles: number;
  /** Unhurried walking time in whole minutes at festival pace. */
  readonly walkMinutes: number;
  /** How much longer the link takes when it is jammed, as a multiple of 1 or more. */
  readonly peakMultiplier: number;
  /** Why the link jams, when it does. Absent on open paths. */
  readonly bottleneckNote?: string;
}

/** A latitude/longitude window, for `map.fitBounds` and bounds tests. */
export interface GeoBounds {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

/** One venue: its nodes, its footpaths and its ground overlays. */
export interface GeoMap {
  readonly id: VenueMapId;
  readonly name: string;
  /** Shown wherever the map is displayed. See `GEO_DATA_DISCLAIMER`. */
  readonly disclaimer: string;
  /** Where to point the camera: the middle of `bounds`. */
  readonly centre: GeoJsonPosition;
  readonly bounds: GeoBounds;
  readonly nodes: readonly GeoMapNode[];
  readonly edges: readonly GeoMapEdge[];
  readonly overlays: GeoJsonFeatureCollection<MapOverlayProperties>;
}

/** The result of routing between two nodes of one venue. */
export interface GeoRoute {
  readonly mapId: VenueMapId;
  readonly from: GeoMapNode;
  readonly to: GeoMapNode;
  /** Nodes in walking order, starting at `from` and ending at `to`. */
  readonly nodes: readonly GeoMapNode[];
  /** Edges in walking order, so `edges[i]` joins `nodes[i]` to `nodes[i + 1]`. */
  readonly edges: readonly GeoMapEdge[];
  /** Sum of the edge distances, in miles, to two decimal places. */
  readonly totalDistanceMiles: number;
  /** Sum of the per-edge walking times at normal pace. */
  readonly normalWalkMinutes: number;
  /** Sum of the per-edge walking times with each bottleneck applied. */
  readonly peakWalkMinutes: number;
  /** Distinct bottleneck notes along the route, in walking order. */
  readonly bottleneckNotes: readonly string[];
  /** The route drawn as a GeoJSON LineString, ready for MapLibre. */
  readonly geometry: GeoJsonLineStringGeometry;
}

/** Narrowing applied by `filterNodes`. Every field is optional. */
export interface GeoNodeFilter {
  /** Free text. Case- and accent-insensitive; every word must match. */
  readonly query?: string;
  /** Keep only these categories. An empty or absent list keeps all of them. */
  readonly categories?: readonly MapNodeCategory[];
  /** Keep only nodes whose id appears in `favouriteIds`. */
  readonly favouritesOnly?: boolean;
  /** The visitor's saved node ids, for this venue or any other. */
  readonly favouriteIds?: readonly string[];
}
