import { afterEach, describe, expect, it, vi } from "vitest";

import { prefersReducedMotion, webglAvailable } from "./map-support";

/*
  Both of these decide which branch the reader gets before the map is created, so
  both have to answer without throwing in any environment the app runs in: a
  browser, jsdom in a test, and a server render with no `window` at all.
*/

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("webglAvailable", () => {
  it("is false in this environment, where WebGL is not implemented", () => {
    // jsdom has no WebGLRenderingContext, so the check must not even ask
    // `getContext` — doing so prints a "not implemented" error to the console.
    expect(webglAvailable()).toBe(false);
  });

  it("returns false rather than throwing when getContext throws", () => {
    vi.stubGlobal("WebGLRenderingContext", function WebGLRenderingContext() {});
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => {
        throw new Error("GPU process crashed");
      });

    expect(webglAvailable()).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it("returns false when getContext hands back null", () => {
    vi.stubGlobal("WebGLRenderingContext", function WebGLRenderingContext() {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
    expect(webglAvailable()).toBe(false);
  });

  it("returns true when a context is produced", () => {
    vi.stubGlobal("WebGLRenderingContext", function WebGLRenderingContext() {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({}) as unknown as RenderingContext,
    );
    expect(webglAvailable()).toBe(true);
  });

  it("returns false during a server render, where there is no document", () => {
    vi.stubGlobal("document", undefined);
    expect(webglAvailable()).toBe(false);
  });
});

describe("prefersReducedMotion", () => {
  it("is true when matchMedia is missing, because animating against a preference is the worse error", () => {
    // jsdom has no matchMedia, which is the same shape as an older browser.
    expect(prefersReducedMotion()).toBe(true);
  });

  it("reports what matchMedia says", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));

    expect(prefersReducedMotion()).toBe(true);
  });

  it("is false when the visitor has not asked for reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));

    expect(prefersReducedMotion()).toBe(false);
  });

  it("falls back to true when matchMedia throws", () => {
    vi.stubGlobal("matchMedia", () => {
      throw new Error("blocked");
    });
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns true during a server render", () => {
    vi.stubGlobal("window", undefined);
    expect(prefersReducedMotion()).toBe(true);
  });
});
