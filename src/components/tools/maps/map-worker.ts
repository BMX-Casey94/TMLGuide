/**
 * Hands MapLibre its worker URL, and nothing else about the library.
 *
 * ## Why this module exists separately
 *
 * The worker path has to be set **before** the first `Map` is constructed, and
 * MapLibre's own guess is wrong under any bundler: it derives the worker's URL
 * from its own module URL, which in a built app points inside
 * `/_next/static/chunks/`, where no worker file exists. Measured on this project,
 * the request 404s, no worker starts, and the map's `load` event never fires — so
 * the canvas is there and permanently blank.
 *
 * `scripts/copy-maplibre-worker.mjs` copies the worker to `public/maplibre-gl/`
 * on install and before every dev run and build, so this URL is always backed by a
 * real file. It is same-origin, which `worker-src 'self'` already permits: no
 * `blob:` and no policy relaxation.
 *
 * Keeping this in its own module means the map component can import it without
 * pulling in `maplibre-gl` at module scope, and a test can assert the path shape
 * without a browser.
 */

/** Where `scripts/copy-maplibre-worker.mjs` puts the worker, relative to the site root. */
export const MAP_WORKER_PATH = "/maplibre-gl/maplibre-gl-worker.mjs";

/**
 * The absolute worker URL, or null when there is no document to resolve against.
 *
 * `new URL` with `window.location.href` as the base gives an absolute same-origin
 * URL, which matters because MapLibre is told the URL once for the whole page and
 * a relative one would be resolved against the bundle's own location instead.
 */
export function mapWorkerUrl(): string | null {
  if (typeof window === "undefined" || typeof window.location === "undefined") return null;
  try {
    return new URL(MAP_WORKER_PATH, window.location.href).href;
  } catch {
    return null;
  }
}

/**
 * Sets the worker URL on the library, once.
 *
 * Called immediately after the dynamic import and before the `Map` constructor, so
 * the pooled workers MapLibre creates on first use already know where to load from.
 * A failure here is not fatal: MapLibre falls back to its own guess, which either
 * works (an unbundled environment) or fails the way the fallback panel is written
 * for.
 */
export function configureMapWorker(maplibre: { setWorkerUrl: (url: string) => void }): boolean {
  const url = mapWorkerUrl();
  if (url === null) return false;
  try {
    maplibre.setWorkerUrl(url);
    return true;
  } catch {
    return false;
  }
}
