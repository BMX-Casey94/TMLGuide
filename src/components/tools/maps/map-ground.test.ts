// @vitest-environment node
import { describe, expect, it } from "vitest";

import { MAP_AERIAL_ORIGIN, MAP_TERRAIN_ORIGIN } from "@/lib/security/csp";

import {
  AERIAL_PROBE_URL,
  AERIAL_TILES,
  applyViewMode,
  looksLikeImage,
  MAP_BEARING_DEGREES,
  MAP_PITCH_DEGREES,
  TERRAIN_EXAGGERATION,
  TERRAIN_PROBE_URL,
  TERRAIN_TILES,
  VIEW_MODE_CAMERA,
} from "./map-ground";
import type { Map as MapLibreMap } from "maplibre-gl";

describe("surveyed ground", () => {
  it("takes the camera to a tasteful tilt in 3D and flat in 2D", () => {
    expect(VIEW_MODE_CAMERA["3d"].pitch).toBeGreaterThanOrEqual(40);
    expect(VIEW_MODE_CAMERA["3d"].pitch).toBeLessThanOrEqual(50);
    expect(VIEW_MODE_CAMERA["3d"].bearing).toBeLessThan(0);
    expect(VIEW_MODE_CAMERA["2d"].pitch).toBe(0);
    expect(VIEW_MODE_CAMERA["2d"].bearing).toBe(0);
  });

  it("pitches the camera slightly and keeps the terrain exaggeration modest", () => {
    expect(MAP_PITCH_DEGREES).toBeGreaterThanOrEqual(40);
    expect(MAP_PITCH_DEGREES).toBeLessThanOrEqual(50);
    expect(TERRAIN_EXAGGERATION).toBeGreaterThan(1);
    expect(TERRAIN_EXAGGERATION).toBeLessThan(2);
  });

  it("probes the same hosts the content security policy allows", () => {
    expect(TERRAIN_TILES.startsWith(`${MAP_TERRAIN_ORIGIN}/`)).toBe(true);
    expect(TERRAIN_PROBE_URL.startsWith(`${MAP_TERRAIN_ORIGIN}/`)).toBe(true);
    expect(AERIAL_TILES.startsWith(`${MAP_AERIAL_ORIGIN}/`)).toBe(true);
    expect(AERIAL_PROBE_URL.startsWith(`${MAP_AERIAL_ORIGIN}/`)).toBe(true);
    expect(AERIAL_TILES).toContain("{z}/{y}/{x}.png");
    expect(TERRAIN_TILES).toContain("{z}/{x}/{y}.png");
  });

  it("accepts only a PNG or JPEG body that the server called an image", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    expect(looksLikeImage(png, "image/png")).toBe(true);
    expect(looksLikeImage(jpeg, "image/jpeg")).toBe(true);
    expect(looksLikeImage(png, "text/html")).toBe(false);
    expect(looksLikeImage(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0, 0, 0]), "image/png")).toBe(
      false,
    );
    expect(looksLikeImage(new Uint8Array([0x89, 0x50]), "image/png")).toBe(false);
  });

  it("eases one camera move per mode change, and jumps under reduced motion", () => {
    const moves: unknown[] = [];
    const fake = {
      easeTo: (options: unknown) => {
        moves.push(options);
        return fake;
      },
    } as unknown as MapLibreMap;

    applyViewMode(fake, "2d", false);
    applyViewMode(fake, "3d", true);

    expect(moves).toHaveLength(2);
    expect(moves[0]).toMatchObject({ pitch: 0, bearing: 0 });
    expect((moves[0] as { duration: number }).duration).toBeGreaterThan(0);
    // Reduced motion: the same destination, reached with no animation at all.
    expect(moves[1]).toMatchObject({
      pitch: VIEW_MODE_CAMERA["3d"].pitch,
      bearing: MAP_BEARING_DEGREES,
      duration: 0,
    });
  });
});
