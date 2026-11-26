import { describe, expect, it } from "vitest";

import { ALL_VENUE_MAP, DE_SCHORRE_MAP, VENUE_BOUNDS } from "@/lib/maps/geo-data";
import { distanceToBoundsMiles, nodeById } from "@/lib/maps/geo-routing";
import type { GeoMapNode } from "@/lib/maps/geo-types";

import {
  GEOLOCATION_BLOCKED_MESSAGE,
  GEOLOCATION_UNAVAILABLE_MESSAGE,
  OUTSIDE_AREA_MESSAGE,
  VENUE_AREA_RADIUS_MILES,
  describeGeoError,
  describePosition,
  isValidPosition,
  positionFromCoords,
  type VisitorPosition,
} from "./map-locate";

/*
  Every branch of the locate feature is reachable here, because none of it needs
  a browser permission dialog: the module takes a coordinate and returns either a
  marker or a sentence. That is the whole reason it is a separate module.
*/

/** A position standing on a named zone, with no accuracy figure. */
function atNode(nodeId: string): VisitorPosition {
  const node = nodeById(ALL_VENUE_MAP, nodeId) as GeoMapNode;
  return { lng: node.lng, lat: node.lat, accuracyMiles: null };
}

describe("isValidPosition", () => {
  it("accepts a real coordinate", () => {
    expect(isValidPosition(4.3868, 51.0928)).toBe(true);
    expect(isValidPosition(0, 0)).toBe(true);
    expect(isValidPosition(-180, -90)).toBe(true);
    expect(isValidPosition(180, 90)).toBe(true);
  });

  it("rejects the values a broken browser can return", () => {
    expect(isValidPosition(Number.NaN, 51.09)).toBe(false);
    expect(isValidPosition(4.38, Number.NaN)).toBe(false);
    expect(isValidPosition(Number.POSITIVE_INFINITY, 51.09)).toBe(false);
    expect(isValidPosition(4.38, Number.NEGATIVE_INFINITY)).toBe(false);
    expect(isValidPosition(181, 51.09)).toBe(false);
    expect(isValidPosition(-181, 51.09)).toBe(false);
    expect(isValidPosition(4.38, 90.1)).toBe(false);
    expect(isValidPosition(4.38, -90.1)).toBe(false);
  });
});

describe("positionFromCoords", () => {
  it("converts the browser's metric accuracy into miles", () => {
    const position = positionFromCoords({ longitude: 4.3868, latitude: 51.0928, accuracy: 1609.344 });
    expect(position.lng).toBe(4.3868);
    expect(position.lat).toBe(51.0928);
    expect(position.accuracyMiles).toBeCloseTo(1, 6);
  });

  it("has no accuracy figure when the browser does not supply one", () => {
    expect(positionFromCoords({ longitude: 4.38, latitude: 51.09 }).accuracyMiles).toBeNull();
    expect(
      positionFromCoords({ longitude: 4.38, latitude: 51.09, accuracy: Number.NaN }).accuracyMiles,
    ).toBeNull();
    expect(
      positionFromCoords({ longitude: 4.38, latitude: 51.09, accuracy: -5 }).accuracyMiles,
    ).toBeNull();
  });
});

describe("describePosition inside the festival area", () => {
  it("names the nearest zone and gives the distance in miles", () => {
    // About 0.17 miles south of Montagoe, clear of the Magnificent Greens fields.
    const here = { lng: 4.3968, lat: 51.0897, accuracyMiles: null };
    const outcome = describePosition(here, ALL_VENUE_MAP, VENUE_BOUNDS);
    expect(outcome.kind).toBe("inside");
    if (outcome.kind !== "inside") return;

    expect(outcome.nearest.node.id).toBe("dv-montagoe");
    expect(outcome.position).toEqual([here.lng, here.lat]);
    expect(outcome.message).toMatch(/Montagoe/);
    expect(outcome.message).toMatch(/\bmiles?\b/);
  });

  it("never says kilometres or uses a metric abbreviation", () => {
    for (const point of [
      { lng: 4.3968, lat: 51.0897 },
      { lng: 4.3854, lat: 51.0892 },
      { lng: 4.402, lat: 51.0902 },
    ]) {
      const outcome = describePosition(
        { ...point, accuracyMiles: 0.03 },
        ALL_VENUE_MAP,
        VENUE_BOUNDS,
      );
      expect(outcome.kind).toBe("inside");
      expect(outcome.message).not.toMatch(/km|kilometre|kilometer|\bmetres\b/i);
      // "m" alone, as in "300m", is the abbreviation the brief rules out.
      expect(outcome.message).not.toMatch(/\d+\s?m\b(?!in|iles)/);
      expect(outcome.message).toMatch(/miles?/);
    }
  });

  it("finds the nearest zone on the other venue when the reader is there", () => {
    // Standing in the Freedom hall itself: the nearest zone is that stage.
    const outcome = describePosition(
      { lng: 4.3768, lat: 51.0908, accuracyMiles: null },
      ALL_VENUE_MAP,
      VENUE_BOUNDS,
    );
    expect(outcome.kind).toBe("inside");
    if (outcome.kind !== "inside") return;
    expect(outcome.nearest.node.id).toBe("ds-freedom");
    expect(outcome.message).toMatch(/Freedom/);
  });

  it("reports a short straight-line distance from a point a few hundred feet off a zone", () => {
    // About 0.17 miles south of Montagoe, which is nearer than any other zone.
    const outcome = describePosition(
      { lng: 4.3968, lat: 51.0897, accuracyMiles: null },
      ALL_VENUE_MAP,
      VENUE_BOUNDS,
    );
    expect(outcome.kind).toBe("inside");
    if (outcome.kind !== "inside") return;
    expect(outcome.nearest.node.id).toBe("dv-montagoe");
    expect(outcome.nearest.straightLineMiles).toBeGreaterThan(0.1);
    expect(outcome.nearest.straightLineMiles).toBeLessThan(0.25);
    expect(outcome.message).toMatch(/0\.\d+ miles?/);
  });

  it("says the reader is at the zone rather than quoting an implausible zero", () => {
    const outcome = describePosition(atNode("dv-montagoe"), ALL_VENUE_MAP, VENUE_BOUNDS);
    expect(outcome.kind).toBe("inside");
    if (outcome.kind !== "inside") return;
    // Standing on the marker itself: a "0 miles" figure would read as a mistake.
    expect(outcome.message).toBe("You are right at Montagoe.");
  });

  it("mentions the browser's accuracy when it gives one, in miles", () => {
    const position = { lng: 4.3968, lat: 51.0897, accuracyMiles: 0.05 };
    const outcome = describePosition(position, ALL_VENUE_MAP, VENUE_BOUNDS);
    expect(outcome.kind).toBe("inside");
    if (outcome.kind !== "inside") return;
    expect(outcome.message).toMatch(/accuracy/i);
    expect(outcome.message).toMatch(/miles?/);
    expect(outcome.message).not.toMatch(/metres/i);
  });

  it("treats a position just inside the edge of the area as inside", () => {
    const outcome = describePosition(
      { lng: VENUE_BOUNDS.east - 0.0001, lat: 51.092, accuracyMiles: null },
      ALL_VENUE_MAP,
      VENUE_BOUNDS,
    );
    expect(outcome.kind).toBe("inside");
  });
});

describe("describePosition outside the festival area", () => {
  it("says so plainly, and marks nothing", () => {
    // Brussels, roughly 20 miles from Boom.
    const outcome = describePosition(
      { lng: 4.3517, lat: 50.8503, accuracyMiles: null },
      ALL_VENUE_MAP,
      VENUE_BOUNDS,
    );

    expect(outcome.kind).toBe("outside");
    expect(outcome.message).toBe(OUTSIDE_AREA_MESSAGE);
    expect(outcome.message).toMatch(/outside the Boom\/Rumst festival area/i);
    expect(outcome.message).toMatch(/showing the full map instead/i);
    // No coordinate is returned at all, so nothing can be drawn from it.
    expect("position" in outcome).toBe(false);
  });

  it("starts once the reader is beyond the stated radius", () => {
    const justInside = describePosition(
      { lng: VENUE_BOUNDS.east + 0.02, lat: 51.092, accuracyMiles: null },
      ALL_VENUE_MAP,
      VENUE_BOUNDS,
    );
    const wellOutside = describePosition(
      { lng: VENUE_BOUNDS.east + 0.2, lat: 51.092, accuracyMiles: null },
      ALL_VENUE_MAP,
      VENUE_BOUNDS,
    );

    expect(VENUE_AREA_RADIUS_MILES).toBe(5);
    // 0.02 degrees of longitude here is under two miles; 0.2 is about nine.
    expect(justInside.kind).toBe("inside");
    expect(wellOutside.kind).toBe("outside");
  });

  it("measures from the site's own extent, so a hotel a mile away is still inside", () => {
    /*
      The component passes the combined map's own bounds, not the wider
      `VENUE_BOUNDS` search window. That difference is what makes the five-mile
      radius mean five miles from the festival rather than five miles from an
      arbitrary box around it.
    */
    const site = ALL_VENUE_MAP.bounds;
    expect(site.east).toBeLessThan(VENUE_BOUNDS.east);
    expect(site.west).toBeGreaterThan(VENUE_BOUNDS.west);

    // Two miles east of the campsite's own eastern edge.
    const nearbyHotel = { lng: site.east + 0.045, lat: 51.092, accuracyMiles: null };
    expect(describePosition(nearbyHotel, ALL_VENUE_MAP, site).kind).toBe("inside");
    // The same point measured against the padded window would look closer, which
    // is exactly the imprecision avoiding it fixes.
    expect(
      distanceToBoundsMiles([nearbyHotel.lng, nearbyHotel.lat], VENUE_BOUNDS),
    ).toBeLessThan(distanceToBoundsMiles([nearbyHotel.lng, nearbyHotel.lat], site));
  });

  it("measures from the nearest edge, not from the middle of the site", () => {
    const outcome = describePosition(
      { lng: VENUE_BOUNDS.east + 0.2, lat: 51.092, accuracyMiles: null },
      ALL_VENUE_MAP,
      VENUE_BOUNDS,
    );
    expect(outcome.kind).toBe("outside");
    if (outcome.kind !== "outside") return;

    // The nearest edge is roughly nine miles east; the centre of the site is more.
    expect(outcome.distanceToAreaMiles).toBeGreaterThan(VENUE_AREA_RADIUS_MILES);
    expect(outcome.distanceToAreaMiles).toBeLessThan(15);
  });

  it("does not error, and gives the same friendly message wherever the reader is", () => {
    for (const position of [
      { lng: -0.1276, lat: 51.5072, accuracyMiles: null }, // London
      { lng: 2.3522, lat: 48.8566, accuracyMiles: null }, // Paris
      { lng: 174.7633, lat: -36.8485, accuracyMiles: null }, // Auckland
    ]) {
      const outcome = describePosition(position, ALL_VENUE_MAP, VENUE_BOUNDS);
      expect(outcome.kind).toBe("outside");
      expect(outcome.message).toBe(OUTSIDE_AREA_MESSAGE);
    }
  });
});

describe("describePosition with an unusable coordinate", () => {
  it("refuses to draw anything, and says nothing has changed", () => {
    for (const position of [
      { lng: Number.NaN, lat: 51.09, accuracyMiles: null },
      { lng: 4.38, lat: Number.NaN, accuracyMiles: null },
      { lng: 500, lat: 51.09, accuracyMiles: null },
      { lng: 4.38, lat: 200, accuracyMiles: null },
    ]) {
      const outcome = describePosition(position, ALL_VENUE_MAP, VENUE_BOUNDS);
      expect(outcome.kind).toBe("invalid");
      expect(outcome.message).toMatch(/could not use/i);
      expect("position" in outcome).toBe(false);
    }
  });
});

describe("describeGeoError", () => {
  it("explains a refusal without repeating the browser's jargon", () => {
    const message = describeGeoError(1);
    expect(message).toMatch(/refused/i);
    expect(message).not.toMatch(/User denied|GeolocationPositionError|PERMISSION_DENIED/);
    expect(message).toMatch(/nothing has been marked/i);
  });

  it("explains a missing fix and a timeout as different things", () => {
    const unavailable = describeGeoError(2);
    const timeout = describeGeoError(3);

    expect(unavailable).toMatch(/could not work out a position/i);
    expect(timeout).toMatch(/took too long/i);
    expect(unavailable).not.toBe(timeout);
  });

  it("has a sensible sentence for an unknown or absent code", () => {
    for (const code of [undefined, 0, 99, Number.NaN]) {
      const message = describeGeoError(code);
      expect(message.length).toBeGreaterThan(40);
      expect(message).toMatch(/nothing has been marked/i);
    }
  });

  it("never mentions kilometres in any branch", () => {
    for (const code of [1, 2, 3, undefined]) {
      expect(describeGeoError(code)).not.toMatch(/km|kilometre|kilometer/i);
    }
  });
});

describe("GEOLOCATION_UNAVAILABLE_MESSAGE", () => {
  it("tells the reader what still works, rather than blaming them", () => {
    expect(GEOLOCATION_UNAVAILABLE_MESSAGE).toMatch(/does not offer location services/i);
    expect(GEOLOCATION_UNAVAILABLE_MESSAGE).toMatch(/still work/i);
    expect(GEOLOCATION_UNAVAILABLE_MESSAGE).not.toMatch(/allow|permission/i);
  });
});

describe("GEOLOCATION_BLOCKED_MESSAGE", () => {
  it("does not guess which of the two causes applies", () => {
    // The browser does not tell the page whether the reader refused before or a
    // header switched the feature off, so the wording must not claim to know.
    expect(GEOLOCATION_BLOCKED_MESSAGE).toMatch(/not currently permitted/i);
    expect(GEOLOCATION_BLOCKED_MESSAGE).toMatch(/previous refusal|privacy setting/i);
    expect(GEOLOCATION_BLOCKED_MESSAGE).not.toMatch(/check your browser settings/i);
    expect(GEOLOCATION_BLOCKED_MESSAGE).toMatch(/still work/i);
    expect(GEOLOCATION_BLOCKED_MESSAGE).not.toMatch(/km|kilometre/i);
  });

  it("is distinguishable from the no-geolocation message", () => {
    expect(GEOLOCATION_BLOCKED_MESSAGE).not.toBe(GEOLOCATION_UNAVAILABLE_MESSAGE);
  });
});

describe("a venue that somehow has no nodes", () => {
  it("degrades to the invalid message rather than throwing", () => {
    const empty = { ...DE_SCHORRE_MAP, nodes: [] };
    const outcome = describePosition(atNode("dv-montagoe"), empty, VENUE_BOUNDS);
    expect(outcome.kind).toBe("invalid");
  });
});
