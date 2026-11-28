/**
 * Surveyed ground under the venue map: a keyless elevation model, and the
 * Flanders winter orthophoto where its licence allows a public site.
 *
 * Neither source is switched on until a real tile for Boom comes back as image
 * bytes. A dead host then leaves the vector map flat, instead of a terrain
 * mesh with no heights and a blank photograph where the land should be.
 *
 * Measured on 27 November 2026, both probe URLs below answered 200 with a PNG
 * body. The terrain bucket sends `access-control-allow-origin: *` when the
 * request carries an Origin, which MapLibre needs in order to read the pixels.
 * The orthophoto service sends the same header.
 */

import type { Map as MapLibreMap } from "maplibre-gl";

/** Terrarium PNG tiles, Mapzen's set on the AWS Open Data bucket. No API key. */
export const TERRAIN_TILES =
  "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";

/**
 * One Boom tile at zoom 14, used as the probe. The style template is only
 * requested after this URL has returned an image.
 */
export const TERRAIN_PROBE_URL =
  "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/14/8391/5478.png";

/**
 * Orthofotomozaïek, middenschalig, winter, meest recent.
 *
 * WMTS `GoogleMapsVL` is Web Mercator, and the path order is
 * `{TileMatrix}/{TileRow}/{TileCol}`, which is `{z}/{y}/{x}` rather than the
 * usual `{z}/{x}/{y}`.
 *
 * Licence: Modellicentie voor gratis hergebruik v1.0. That licence allows
 * reproduction and publication, including on a public website, provided the
 * source line the publisher specifies is shown. The dataset's own line is
 * "Bron: Luchtopnamen Digitaal Vlaanderen".
 * https://www.vlaanderen.be/digitaal-vlaanderen/onze-diensten-en-platformen/open-data/voorwaarden-voor-het-hergebruik-van-overheidsinformatie/modellicentie-gratis-hergebruik
 */
export const AERIAL_TILES =
  "https://geo.api.vlaanderen.be/OMWRGBMRVL/wmts/1.0.0/omwrgbmrvl/default/GoogleMapsVL/{z}/{y}/{x}.png";

/** The same Boom tile, in WMTS row/column order, used as the aerial probe. */
export const AERIAL_PROBE_URL =
  "https://geo.api.vlaanderen.be/OMWRGBMRVL/wmts/1.0.0/omwrgbmrvl/default/GoogleMapsVL/14/5478/8391.png";

export const TERRAIN_SOURCE_ID = "terrain-dem";
export const AERIAL_SOURCE_ID = "flanders-aerial";
export const HILLSHADE_LAYER_ID = "hillshade";
export const AERIAL_LAYER_ID = "aerial-photo";

/**
 * The style layer the photograph goes in above: the flat building footprint fill.
 *
 * The photograph is the ground, so it has to sit above the flat landcover, water
 * and footprint fills — otherwise the photograph is what the reader sees and the
 * vector ground is wasted. It must sit *below* the extruded buildings and the
 * roads, though: a photograph pasted over those would hide the 3D buildings
 * entirely, which is the detail that makes the amphitheatre bowl readable. This
 * id, the last of the flat fills, is exactly the seam between the two.
 */
const GROUND_PHOTO_BEFORE_ID = "building-3d";

/** The symbol layer the hillshade must sit beneath, so names stay legible. */
const LABEL_LAYER_ID = "place-label";

/** Camera tilt, in degrees. Enough to read the clay-pit relief, not a cliff. */
export const MAP_PITCH_DEGREES = 45;

/** The heading the tilted view rests at, in degrees. */
export const MAP_BEARING_DEGREES = -15;

/** Vertical scale on the terrain mesh. Modest: De Schorre is a low clay pit. */
export const TERRAIN_EXAGGERATION = 1.8;

/**
 * The two view modes, and the camera each rests at.
 *
 * 3D tilts towards the north-west so the amphitheatre bowl and the clay-pit rims
 * read as ground rather than as paint, and so the Mainstage's eastern slope rises
 * away from the viewer. 2D is the plain plan view: the honest one for comparing
 * distances or for a reader who finds a tilted map harder to follow.
 */
export const VIEW_MODE_CAMERA = {
  "3d": { pitch: MAP_PITCH_DEGREES, bearing: MAP_BEARING_DEGREES },
  "2d": { pitch: 0, bearing: 0 },
} as const;

export type ViewMode = keyof typeof VIEW_MODE_CAMERA;

/**
 * Applies one view mode to a live map.
 *
 * Pitch and bearing are animated together through one `easeTo`, so the map tips
 * back and swings to north in a single movement rather than two. The terrain is
 * left attached in both modes: a flat camera over a terrain mesh is exactly what
 * a plan view should be, and pulling the mesh off would make the toggle blink the
 * whole surface out and back.
 *
 * The camera is left where it is otherwise: no zoom, no centre. Pressing "2D" is
 * a request to stop tilting, not a request to re-frame the site, and moving the
 * camera as well would lose the place the reader was looking at.
 */
export function applyViewMode(map: MapLibreMap, mode: ViewMode, reduceMotion: boolean): void {
  const { pitch, bearing } = VIEW_MODE_CAMERA[mode];
  map.easeTo({ pitch, bearing, duration: reduceMotion ? 0 : 700 });
}


export const TERRAIN_ATTRIBUTION =
  "Terrain and hillshade: AWS Terrain Tiles (Mapzen terrarium on Amazon Open Data). Around Boom the heights are EU-DEM.";

export const AERIAL_ATTRIBUTION =
  "Aerial photograph: Bron: Luchtopnamen Digitaal Vlaanderen, under the Modellicentie voor gratis hergebruik v1.0.";

/**
 * True when `bytes` is a PNG or JPEG and the response said it was an image.
 *
 * A 200 with an empty body, or an HTML error page, must not turn the terrain on.
 */
export function looksLikeImage(bytes: Uint8Array, contentType: string): boolean {
  if (!contentType.toLowerCase().startsWith("image/")) return false;
  if (bytes.length < 8) return false;

  const png =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return png || jpeg;
}

/** Fetches one tile and accepts it only when the body is a real image. */
export async function tileReturnsImage(url: string): Promise<boolean> {
  const response = await fetch(url);
  if (!response.ok) return false;
  const type = response.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return looksLikeImage(bytes, type);
}

/**
 * Adds the orthophoto and the terrain mesh, each only after its own probe.
 *
 * The photograph is the *ground*: it goes above the flat landcover, water and
 * footprint fills but below the extruded buildings, the roads and the labels. Any
 * higher and it hides the 3D buildings, which are the detail that makes the
 * amphitheatre bowl legible; any lower and the flat vector fills cover it and the
 * fetch was wasted.
 *
 * The hillshade goes above the photograph and below the labels, so relief shades
 * the imagery without washing out the place names.
 *
 * Returns the credit lines for the sources that actually loaded, so the
 * attribution block only credits what the reader can actually see.
 */
export async function attachSurveyedGround(map: MapLibreMap): Promise<readonly string[]> {
  const credits: string[] = [];

  const [terrainOk, aerialOk] = await Promise.all([
    tileReturnsImage(TERRAIN_PROBE_URL).catch(() => false),
    tileReturnsImage(AERIAL_PROBE_URL).catch(() => false),
  ]);

  if (aerialOk && map.getLayer(AERIAL_LAYER_ID) === undefined) {
    map.addSource(AERIAL_SOURCE_ID, {
      type: "raster",
      tiles: [AERIAL_TILES],
      tileSize: 256,
      attribution: AERIAL_ATTRIBUTION,
    });
    map.addLayer(
      {
        id: AERIAL_LAYER_ID,
        type: "raster",
        source: AERIAL_SOURCE_ID,
        paint: { "raster-opacity": 0.92 },
      },
      /*
        Inserted *before* the extrusions, so the buildings stand on the
        photograph rather than being buried by it.
      */
      GROUND_PHOTO_BEFORE_ID,
    );
    credits.push(AERIAL_ATTRIBUTION);
  }

  if (terrainOk && map.getLayer(HILLSHADE_LAYER_ID) === undefined) {
    map.addSource(TERRAIN_SOURCE_ID, {
      type: "raster-dem",
      tiles: [TERRAIN_TILES],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 15,
      attribution: TERRAIN_ATTRIBUTION,
    });
    map.addLayer(
      {
        id: HILLSHADE_LAYER_ID,
        type: "hillshade",
        source: TERRAIN_SOURCE_ID,
        paint: {
          "hillshade-exaggeration": 0.45,
          "hillshade-illumination-direction": 335,
          "hillshade-illumination-altitude": 45,
          "hillshade-shadow-color": "#140e0a",
          "hillshade-highlight-color": "#f4ece0",
          "hillshade-accent-color": "#3d2c1e",
        },
      },
      LABEL_LAYER_ID,
    );
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION });
    credits.push(TERRAIN_ATTRIBUTION);
  }

  return credits;
}
