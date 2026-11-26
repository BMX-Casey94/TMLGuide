/**
 * Environment checks the map needs before it tries to draw anything.
 *
 * Both functions are defensive by design. They run in a browser, in jsdom and
 * during a server render, and none of those may throw: the map is an
 * enhancement on this page, and a reader who cannot have it must still get the
 * searchable list and the walking estimate underneath.
 */

/**
 * True when the browser can plausibly create a WebGL context.
 *
 * MapLibre GL JS renders through WebGL and throws on construction when it
 * cannot get a context, so the check happens before the library is imported at
 * all. Two early exits matter:
 *
 * - No `document` means a server render, where there is nothing to measure.
 * - No `WebGLRenderingContext` global means WebGL is not implemented. jsdom is
 *   in this state, and calling `getContext` there prints a "not implemented"
 *   error to whatever is watching the console, so the check returns before it
 *   asks.
 *
 * The `try` covers browsers that throw from `getContext` when the GPU process
 * has crashed, which is the case the fallback list is really for.
 */
export function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  if (typeof window === "undefined") return false;

  const hasWebglGlobal =
    "WebGLRenderingContext" in window || "WebGL2RenderingContext" in window;
  if (!hasWebglGlobal) return false;

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return context !== null;
  } catch {
    return false;
  }
}

/**
 * True when the visitor asked for reduced motion.
 *
 * The map is the one part of the page that animates under its own steam: a
 * venue change flies the camera across Boom. A stylesheet's
 * `prefers-reduced-motion` block cannot reach a canvas, so the duration is
 * decided here instead. A browser with no `matchMedia` gets the still version,
 * because refusing to animate costs nothing while animating against a
 * preference is the failure that matters.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/**
 * `webglAvailable()`, computed once per page load.
 *
 * The answer cannot change while the document lives, and creating a canvas on
 * every render to ask again would be wasteful. The cache is also what makes this
 * usable as an external store's snapshot, which must be referentially stable.
 */
let supportCache: boolean | null = null;

export function webglSupport(): boolean {
  supportCache ??= webglAvailable();
  return supportCache;
}

/** Clears the memo. For tests only. */
export function resetWebglSupport(): void {
  supportCache = null;
}

/**
 * A store that never changes, for `useSyncExternalStore`.
 *
 * WebGL support is fixed for the life of the document, so there is nothing to
 * subscribe to; the value arrives on the first client render. This exists so the
 * component can read the capability without calling `setState` inside an effect.
 */
export function subscribeWebglSupport(): () => void {
  return () => {};
}

/**
 * The server's assumption: that the visitor has WebGL.
 *
 * Assuming support during the server render keeps the prerendered markup showing
 * the map stage, and a visitor without WebGL sees the fallback panel on the first
 * client render instead. Assuming the opposite would hide the map from everyone
 * until hydration.
 */
export function webglSupportServerSnapshot(): boolean {
  return true;
}
