/**
 * The logic behind the opt-in "Locate me" button, kept apart from the browser
 * API that feeds it.
 *
 * ## What this module does and does not do
 *
 * It does not touch `navigator.geolocation`. It takes a coordinate that the
 * component obtained from a click and turns it into either a marker to draw or a
 * sentence to read out. That split means every branch — inside the festival
 * area, outside it, a nonsense coordinate, a refused prompt, a timeout — can be
 * tested without a browser permission dialog, which is the only way these paths
 * get tested at all.
 *
 * ## What is stored
 *
 * Nothing. The coordinate lives in React state for as long as the page is open,
 * is passed straight into a GeoJSON point, and is never written to
 * `localStorage`, never put in a URL, and never sent to this site's server or
 * anyone else's. The distance figures are computed in the browser from the
 * guide's own data file.
 *
 * ## Miles, never kilometres
 *
 * Every distance here is in miles and is formatted through `formatMiles`, the
 * same formatter the route planner uses, so the two cannot drift apart.
 */

import { distanceToBoundsMiles, nearestNode, type NearestNode } from "@/lib/maps/geo-routing";
import type { GeoBounds, GeoJsonPosition, GeoMap } from "@/lib/maps/geo-types";

import { formatMiles } from "./maps-logic";

/**
 * How close to the mapped site counts as "at the festival".
 *
 * Five miles covers Boom, Rumst and the villages around them, which is where a
 * visitor with a hotel, a hire car or a lift would plausibly be. It is generous
 * on purpose: the useful question is "am I near enough for this map to mean
 * anything", not "am I inside the fence". Anything further away gets the
 * friendly outside message rather than a marker on a map that has no idea where
 * the reader actually is.
 */
export const VENUE_AREA_RADIUS_MILES = 5;

/** How far outside the site counts as outside the festival area, in miles. */
export const OUTSIDE_AREA_MESSAGE =
  "You appear to be outside the Boom/Rumst festival area — showing the full map instead. Nothing has been marked, and you can still plan any walk between two zones.";

/** A coordinate the browser returned, before any judgement about it. */
export interface VisitorPosition {
  readonly lng: number;
  readonly lat: number;
  /** The browser's own accuracy estimate in miles, when it supplied one. */
  readonly accuracyMiles: number | null;
}

/** The visitor is at or near the site: mark the spot and name the nearest zone. */
export interface LocatedInside {
  readonly kind: "inside";
  readonly position: GeoJsonPosition;
  readonly nearest: NearestNode;
  /** Ready to be read out, already in miles. */
  readonly message: string;
}

/** The visitor is well away from the site: say so, and leave the view alone. */
export interface LocatedOutside {
  readonly kind: "outside";
  readonly distanceToAreaMiles: number;
  readonly message: string;
}

/** The coordinate was unusable, so nothing is drawn and nothing is claimed. */
export interface LocatedInvalid {
  readonly kind: "invalid";
  readonly message: string;
}

export type LocateOutcome = LocatedInside | LocatedOutside | LocatedInvalid;

/** The message shown when the coordinate is not a real place on Earth. */
const INVALID_MESSAGE =
  "Your browser returned a position this map could not use. Nothing has been marked, and the map is unchanged.";

/**
 * True when a coordinate can be drawn.
 *
 * Browsers are allowed to hand back `NaN`, a stale zeroed value, or — in a
 * mocked or broken environment — a longitude outside the valid range. All of
 * those would make MapLibre throw rather than draw nothing, so they are rejected
 * before they reach the style.
 */
export function isValidPosition(lng: number, lat: number): boolean {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat < -90 || lat > 90) return false;
  return true;
}

/**
 * Turns a coordinate into a marker with an announcement, or a polite refusal.
 *
 * The nearest zone is measured as a straight line, so a camper standing in
 * Montagoe is told about Montagoe even when the switcher is showing De Schorre;
 * callers pass the combined site map. Walking distance is deliberately not used:
 * the reader has not asked to go anywhere yet, and a walking figure would imply
 * a route from a point outside the mapped footpath network.
 */
export function describePosition(
  position: VisitorPosition,
  map: GeoMap,
  areaBounds: GeoBounds,
): LocateOutcome {
  const { lng, lat, accuracyMiles } = position;

  if (!isValidPosition(lng, lat)) {
    return { kind: "invalid", message: INVALID_MESSAGE };
  }

  const here: GeoJsonPosition = [lng, lat];
  const distanceToAreaMiles = distanceToBoundsMiles(here, areaBounds);

  if (distanceToAreaMiles > VENUE_AREA_RADIUS_MILES) {
    return {
      kind: "outside",
      distanceToAreaMiles,
      message: OUTSIDE_AREA_MESSAGE,
    };
  }

  const nearest = nearestNode(map, here);
  if (nearest === null) {
    return { kind: "invalid", message: INVALID_MESSAGE };
  }

  const accuracy =
    accuracyMiles === null || !Number.isFinite(accuracyMiles)
      ? ""
      : ` Your browser puts its own accuracy at about ${formatMiles(Math.max(accuracyMiles, 0.01))}.`;

  /*
    A visitor standing on a zone gets a straight-line figure of a few feet, which
    `formatMiles` would print as "0 miles". Saying "you are at Montagoe" is both
    truthful and clearer than an implausibly precise zero.
  */
  const distance =
    nearest.straightLineMiles < 0.1
      ? `You are right at ${nearest.node.name}.`
      : `The nearest zone is ${nearest.node.name}, about ${formatMiles(
          nearest.straightLineMiles,
        )} away in a straight line.`;

  return {
    kind: "inside",
    position: here,
    nearest,
    message: distance + accuracy,
  };
}

/**
 * A coordinate from the Geolocation API, in the shape this module uses.
 *
 * `accuracy` arrives in metres, the one figure the browser reports in metric; it
 * is converted to miles here so nothing metric reaches the reader.
 */
export function positionFromCoords(coords: {
  readonly longitude: number;
  readonly latitude: number;
  readonly accuracy?: number;
}): VisitorPosition {
  const metres = coords.accuracy;
  const accuracyMiles =
    typeof metres === "number" && Number.isFinite(metres) && metres >= 0
      ? metres / 1609.344
      : null;

  return { lng: coords.longitude, lat: coords.latitude, accuracyMiles };
}

/**
 * The sentence for a failed request, in plain words and with no error code.
 *
 * `GeolocationPositionError.code` is mapped rather than shown: "User denied
 * Geolocation" is jargon, and the visitor needs to know what happened and what
 * still works, not which constant the browser returned.
 */
export function describeGeoError(code: number | undefined): string {
  switch (code) {
    case 1:
      return "Location access was refused. Nothing has been marked and nothing has been sent anywhere; the map and the route planner work exactly as before.";
    case 2:
      return "Your browser could not work out a position. That usually means no GPS fix and no usable network location, so nothing has been marked.";
    case 3:
      return "Working out your position took too long, so the request was stopped. Nothing has been marked; you can try again, or plan a walk from the zone list.";
    default:
      return "This browser could not provide a position. Nothing has been marked and nothing has been sent anywhere.";
  }
}

/**
 * The sentence for a browser that has no geolocation at all.
 *
 * Treated separately from a refusal because the visitor has nothing to change:
 * there is no prompt to answer, so telling them to allow access would be wrong.
 */
export const GEOLOCATION_UNAVAILABLE_MESSAGE =
  "This browser does not offer location services, so the guide cannot mark where you are. The map, the zone list and the route planner all still work.";

/**
 * The sentence for a site that is not permitted to ask for a position.
 *
 * Two different causes arrive here and both mean "no prompt will ever appear":
 * the reader has already refused this site, or a `Permissions-Policy` response
 * header has switched geolocation off for the whole document. In either case
 * pressing the button cannot succeed, so saying so is kinder than making the
 * reader press it and wait for an error they cannot act on.
 *
 * The wording does not guess which of the two it is, because the browser does not
 * tell the page, and a wrong guess ("check your browser settings") would send the
 * reader somewhere that cannot help.
 */
export const GEOLOCATION_BLOCKED_MESSAGE =
  "This site is not currently permitted to use your location, so nothing can be marked. That is usually a previous refusal saved by your browser, or a privacy setting on this site. The map, the zone list and the route planner all still work.";
