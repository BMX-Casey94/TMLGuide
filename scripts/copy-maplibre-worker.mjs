/**
 * Copies MapLibre's tile worker into `public/`, where the browser can load it.
 *
 * ## Why this is needed
 *
 * MapLibre GL JS builds its worker from a URL it derives from `import.meta.url`:
 * it takes its own module URL and swaps the file name for
 * `maplibre-gl-worker.mjs`. That is correct for an unbundled `node_modules`
 * layout, and wrong for every bundler output. Measured on this project under
 * Turbopack: the module resolves to
 * `/_next/static/chunks/node_modules_maplibre-gl_dist_maplibre-gl_mjs_<hash>._.js`,
 * so MapLibre asks for `/_next/static/chunks/maplibre-gl-worker.mjs`, receives a
 * 404, never starts a worker, and the map's `load` event never fires. The canvas
 * is created and stays blank — the worst failure mode, because nothing throws.
 *
 * ## What this does instead
 *
 * The worker is a self-contained ES module: no `import.meta`, no imports of its
 * own. It therefore needs no bundling. It is copied verbatim to
 * `public/maplibre-gl/maplibre-gl-worker.mjs`, served same-origin, and handed to
 * MapLibre with `setWorkerUrl` before any map is constructed. Same-origin means
 * `worker-src 'self'` already covers it, with no `blob:` indirection.
 *
 * ## When it runs
 *
 * `postinstall` (so a fresh `npm ci` leaves the file in place), and as a step of
 * `predev` and `prebuild` (so it is regenerated if `public/` was cleaned). It is
 * idempotent: an up-to-date copy is left untouched, so the common path costs one
 * `stat`.
 *
 * The version is recorded beside the copy. A dependency bump that changes the
 * worker therefore triggers a refresh, so the file can never silently lag behind
 * the library that expects it.
 */

import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Where the worker is served from. `MAP_WORKER_PATH` in the component matches this. */
const PUBLIC_DIR = join(projectRoot, "public", "maplibre-gl");
const PUBLIC_WORKER = join(PUBLIC_DIR, "maplibre-gl-worker.mjs");
const PUBLIC_STAMP = join(PUBLIC_DIR, "worker-version.json");

/** The worker inside the installed package, and the package root beside it. */
function sourceWorkerPath() {
  const packageJson = require.resolve("maplibre-gl/package.json");
  const packageRoot = dirname(packageJson);
  return { path: join(packageRoot, "dist", "maplibre-gl-worker.mjs"), packageRoot };
}

function installedVersion(packageRoot) {
  const parsed = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  return String(parsed.version ?? "unknown");
}

function main() {
  const { path: source, packageRoot } = sourceWorkerPath();
  const version = installedVersion(packageRoot);

  mkdirSync(PUBLIC_DIR, { recursive: true });

  let stampVersion = null;
  try {
    const stamp = JSON.parse(readFileSync(PUBLIC_STAMP, "utf8"));
    stampVersion = typeof stamp.version === "string" ? stamp.version : null;
  } catch {
    stampVersion = null;
  }

  if (stampVersion === version) {
    try {
      statSync(PUBLIC_WORKER);
      console.log(`[maplibre-worker] public copy already at ${version}`);
      return;
    } catch {
      // The stamp says current but the worker is gone; copy it again below.
    }
  }

  copyFileSync(source, PUBLIC_WORKER);
  writeFileSync(PUBLIC_STAMP, `${JSON.stringify({ version }, null, 2)}\n`, "utf8");

  const bytes = statSync(PUBLIC_WORKER).size;
  console.log(
    `[maplibre-worker] copied ${version} worker to public/maplibre-gl/maplibre-gl-worker.mjs (${bytes} bytes)`,
  );
}

main();
