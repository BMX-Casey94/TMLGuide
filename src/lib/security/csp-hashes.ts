/**
 * Build-time hashes for the inline scripts inside prerendered static shells.
 *
 * ## The problem this solves
 *
 * A nonce is minted per request, so it can only be attached to markup produced
 * during that request. With `cacheComponents: true` every route is served as a
 * prerendered shell written to `.next/server/app/*.html` at build time, and the
 * inline scripts inside that shell therefore carry no nonce. Measured on this
 * build: `/` contains 25 `<script>` elements, of which seven in the streamed
 * remainder have a nonce and eighteen in the shell have none.
 *
 * A nonce-only policy blocks those eighteen. `$RV` and `$RC` never run, the
 * flight payload is never consumed, and the page never hydrates: a link click
 * becomes a full document load. Verified in Chromium against `next start`.
 *
 * ## What is done instead
 *
 * The shell files are read once at runtime and the SHA-256 of every inline
 * script is computed. Those digests go into `script-src` alongside the nonce, so
 * the browser admits exactly the bytes the build wrote and nothing else. Hashes
 * describe content, so a script that changes stops matching; `'unsafe-inline'`
 * is never needed.
 *
 * ## Why the digests are read from disk rather than compiled in
 *
 * Generating them at build time and importing them into the proxy would be a
 * chicken-and-egg problem: the proxy is compiled before the shells exist. A
 * committed generated file would instead be stale for one build whenever content
 * changes, and a stale hash fails silently — the page simply never hydrates.
 *
 * Reading at runtime removes both failure modes. The output is immutable for the
 * life of a deployment, so each file is hashed at most once per process.
 *
 * ## Scope
 *
 * Only *prerendered* routes have this problem. A route rendered per request
 * receives the nonce on every script, so it needs no hashes and gets none.
 * Dynamic routes have no `.html` file and return an empty list.
 *
 * ## Deployment
 *
 * The shells are read from the filesystem, which is what `next start` and any
 * Node server do, and is how this project is run and how its e2e suite drives the
 * production build. `PRERENDER_OUTPUT_DIR` relocates the directory for a host
 * that keeps the build output somewhere else.
 *
 * The read is marked `turbopackIgnore` so the bundler does not trace the whole
 * project into the server bundle. The consequence is that the shells are *not*
 * bundled, and the read only succeeds where `.next/server/app` exists beside the
 * running server.
 *
 * On a host that does not keep that directory — notably Vercel, where static
 * shells are served from the CDN and the proxy runs in a separate function with
 * no view of the build output — the read returns nothing. The policy then rests
 * on the nonce and `'self'` alone, `isPrerenderOutputAvailable` reports false and
 * the proxy logs a warning naming the consequence. That warning is the signal
 * that this deployment needs one of:
 *
 * - `PRERENDER_OUTPUT_DIR` pointed at an accessible copy of the shells, or
 * - the hashes generated at deploy time into a module the proxy imports, or
 * - every route rendered per request, which makes `'strict-dynamic'` safe and
 *   removes the need for hashes entirely.
 *
 * This is not a silent degradation: a prerendered page whose scripts cannot be
 * hashed will not hydrate, and the warning says so.
 */

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, sep } from "node:path";

/**
 * The directory the prerendered shells live in, relative to the project root.
 *
 * Kept as three separate segments rather than one string so the bundler can see
 * a static prefix: Turbopack traces a filesystem read by its literal path
 * arguments, and a single opaque variable would make it trace the entire project
 * into the server bundle.
 */
const PRERENDER_SEGMENTS = [".next", "server", "app"] as const;

/** Directory holding the prerendered shells, relative to the working directory. */
export const PRERENDER_DIR = join(...PRERENDER_SEGMENTS);

/** Environment variable that relocates the prerender directory, for non-standard hosts. */
export const PRERENDER_DIR_ENV = "PRERENDER_OUTPUT_DIR" as const;

/**
 * The part of the environment this module reads.
 *
 * A narrow structural type with an index signature, so the real `process.env`
 * satisfies it without a cast. Next declares `NODE_ENV` as required on
 * `ProcessEnv` and drops the index signature, which is why a bare
 * `{ readonly PRERENDER_OUTPUT_DIR?: string }` would not accept `process.env`.
 */
export interface PrerenderEnv {
  readonly PRERENDER_OUTPUT_DIR?: string | undefined;
  readonly [key: string]: string | undefined;
}

/**
 * The absolute directory the shells live in.
 *
 * Overridable through `PRERENDER_OUTPUT_DIR` so a host that places the build
 * output elsewhere can point at it, and so a test can use a temporary directory
 * instead of changing the process working directory (which a worker thread
 * cannot do).
 */
export function prerenderRoot(env: PrerenderEnv = process.env): string {
  const configured = env.PRERENDER_OUTPUT_DIR?.trim();
  return resolve(configured && configured !== "" ? configured : PRERENDER_DIR);
}

/**
 * Routes whose pathname could escape the prerender directory.
 *
 * Only letters, digits, hyphens, underscores and slashes are accepted, so a
 * request for `/../../etc/passwd` or an encoded traversal never reaches `join`.
 * The resolved path is checked against the directory afterwards as well; two
 * independent checks are cheap and this one guards a file read.
 */
const SAFE_PATHNAME = /^\/[A-Za-z0-9\-_/]*$/;

/** An inline `<script>` element with no `src` attribute. */
const INLINE_SCRIPT_PATTERN = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;

/** JSON-LD blocks are data, not executable script, and are excluded. */
const JSON_LD_ATTRIBUTE = /application\/ld\+json/i;

/**
 * Converts a request pathname into the shell file that would have served it, or
 * null when the pathname cannot be one.
 */
export function shellFileForPathname(
  pathname: string,
  root: string = prerenderRoot(),
): string | null {
  if (!SAFE_PATHNAME.test(pathname)) return null;
  // A trailing slash names the same document as the bare path.
  const trimmed = pathname.replace(/\/+$/, "");
  const relative = trimmed === "" ? "index.html" : `${trimmed.slice(1)}.html`;
  const rootDir = resolve(root);
  const full = resolve(join(rootDir, relative));
  if (full !== rootDir && !full.startsWith(rootDir + sep)) return null;
  return full;
}

/**
 * Extracts the `sha256-…` digests of every inline script in one HTML document.
 *
 * The digest is over the exact script text, UTF-8 encoded, with no trimming:
 * the browser hashes the element's text content verbatim, so trimming would
 * produce a digest that never matches.
 */
export function extractInlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  INLINE_SCRIPT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_SCRIPT_PATTERN.exec(html)) !== null) {
    const attributes = match[1] ?? "";
    const body = match[2] ?? "";
    if (JSON_LD_ATTRIBUTE.test(attributes)) continue;
    // An empty element has nothing to execute and a hash of "" is noise.
    if (body === "") continue;
    hashes.add(`sha256-${createHash("sha256").update(body, "utf8").digest("base64")}`);
  }
  return [...hashes];
}

/**
 * Reads one shell file.
 *
 * Marked `turbopackIgnore` so the bundler does not try to trace the read into the
 * server bundle. Without the marker, a path assembled at run time makes Turbopack
 * assume the whole project might be needed and trace every source file and the
 * entire `public/` folder into the deployment, which slows deploys and can exceed
 * size limits. The files are produced by the build at a known location, so they
 * are not bundle inputs.
 *
 * See the deployment note at the top of this module: the read only works where
 * `.next/server/app` exists beside the running server.
 */
function readShellFile(file: string): string | null {
  try {
    if (!existsSync(/* turbopackIgnore: true */ file)) return null;
    return readFileSync(/* turbopackIgnore: true */ file, "utf8");
  } catch {
    return null;
  }
}

/** Per-process cache. The build output cannot change while the server runs. */
const cache = new Map<string, readonly string[]>();

/**
 * Returns the inline-script hashes for the shell that serves `pathname`.
 *
 * An empty array means "no hashes for this route", which is the correct answer
 * for a route rendered per request and also the safe answer if the shell cannot
 * be read: the policy then rests on the nonce and `'self'` alone.
 */
export function getInlineScriptHashes(
  pathname: string,
  root: string = prerenderRoot(),
): readonly string[] {
  const cacheKey = `${root}\u0000${pathname}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const file = shellFileForPathname(pathname, root);
  const html = file === null ? null : readShellFile(file);
  const hashes = html === null ? [] : extractInlineScriptHashes(html);

  cache.set(cacheKey, hashes);
  return hashes;
}

/** True when the prerender output is readable, used to warn once on a bad host. */
export function isPrerenderOutputAvailable(root: string = prerenderRoot()): boolean {
  return existsSync(root);
}

/** Clears the cache. For tests only. */
export function clearHashCache(): void {
  cache.clear();
}
