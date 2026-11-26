import fs from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { configureMapWorker, MAP_WORKER_PATH, mapWorkerUrl } from "./map-worker";

/*
  This module exists because of a failure that is invisible from the outside: when
  MapLibre cannot find its worker, it creates the canvas, draws nothing, and fires
  no error. These tests pin down the URL it is handed and the fact that it is
  handed at all.
*/

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MAP_WORKER_PATH", () => {
  it("is a same-origin absolute path, which worker-src 'self' already allows", () => {
    expect(MAP_WORKER_PATH.startsWith("/")).toBe(true);
    expect(MAP_WORKER_PATH.endsWith(".mjs")).toBe(true);
    // A scheme or a leading double slash would point at another origin.
    expect(MAP_WORKER_PATH).not.toMatch(/^\/\/|^\w+:/);
  });

  it("names a file that the copy script actually puts in public/", () => {
    /*
      The path is a contract between this module and
      `scripts/copy-maplibre-worker.mjs`. Asserting the file is present catches a
      renamed script output before it reaches a browser, where the only symptom is
      a blank map.
    */
    const onDisk = resolve(import.meta.dirname, "../../../../public", MAP_WORKER_PATH.slice(1));
    expect(fs.existsSync(onDisk), `${onDisk} is missing; run npm run postinstall`).toBe(true);
    expect(fs.statSync(onDisk).size).toBeGreaterThan(100_000);
  });

  it("records the version the copy was made from", () => {
    const stamp = resolve(import.meta.dirname, "../../../../public/maplibre-gl/worker-version.json");
    const parsed = JSON.parse(fs.readFileSync(stamp, "utf8")) as { version?: string };
    const installed = JSON.parse(
      fs.readFileSync(
        resolve(import.meta.dirname, "../../../../node_modules/maplibre-gl/package.json"),
        "utf8",
      ),
    ) as { version?: string };

    // A stale copy would be a worker from a different library build.
    expect(parsed.version).toBe(installed.version);
  });
});

describe("mapWorkerUrl", () => {
  it("resolves the path against the document, giving an absolute same-origin URL", () => {
    const url = mapWorkerUrl();
    expect(url).not.toBeNull();
    expect(url).toBe(`${window.location.origin}${MAP_WORKER_PATH}`);
  });

  it("returns null with no window, so it is safe during a server render", () => {
    vi.stubGlobal("window", undefined);
    expect(mapWorkerUrl()).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("configureMapWorker", () => {
  it("sets the worker URL on the library before any map is constructed", () => {
    const setWorkerUrl = vi.fn();
    expect(configureMapWorker({ setWorkerUrl })).toBe(true);
    expect(setWorkerUrl).toHaveBeenCalledTimes(1);
    expect(setWorkerUrl).toHaveBeenCalledWith(`${window.location.origin}${MAP_WORKER_PATH}`);
  });

  it("reports failure rather than throwing when the library rejects the URL", () => {
    // Not fatal: MapLibre then falls back to its own guess, which the fallback
    // panel is written to survive.
    const setWorkerUrl = vi.fn(() => {
      throw new Error("rejected");
    });
    expect(configureMapWorker({ setWorkerUrl })).toBe(false);
  });

  it("reports failure when there is no document to resolve against", () => {
    vi.stubGlobal("window", undefined);
    const setWorkerUrl = vi.fn();
    expect(configureMapWorker({ setWorkerUrl })).toBe(false);
    expect(setWorkerUrl).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
