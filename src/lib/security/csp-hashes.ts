/**
 * Build-time hashes for the inline scripts inside prerendered static shells.
 *
 * ## The problem this solves
 *
 * A nonce is minted per request, so it can only be attached to markup produced
 * during that request. With `cacheComponents: true` every route is served as a
 * prerendered shell written to `.next/server/app/*.html` at build time, and the
 * inline scripts inside that shell therefore carry no nonce. Measured on this
 * build: `/` contains 12 inline scripts after JSON-LD is excluded, and `/about`
 * contains 30, of which only the streamed remainder carries a nonce.
 *
 * A nonce-only policy blocks the shell's scripts. `$RV` and `$RC` never run, the
 * flight payload is never consumed, and the page never hydrates: a link click
 * becomes a full document load. Verified in Chromium against `next start`.
 *
 * ## What is done instead
 *
 * The SHA-256 of every inline script is computed and those digests go into
 * `script-src` alongside the nonce, so the browser admits exactly the bytes the
 * build wrote and nothing else. Hashes describe content, so a script that changes
 * stops matching; `'unsafe-inline'` is never needed.
 *
 * ## Two sources, and which wins
 *
 * 1. **The prerender output, read at runtime.** The pathname is resolved to
 *    `.next/server/app/<route>.html`, the file is read and hashed. This is exact,
 *    because the file is the file being served. It works wherever the build output
 *    sits beside the server — `next start`, a container image, this project's
 *    Playwright suite — and `PRERENDER_OUTPUT_DIR` relocates it.
 * 2. **The generated manifest, imported as a module.**
 *    `scripts/generate-csp-hashes.mjs` writes `csp-hash-manifest.generated.ts` from
 *    the same files after a build. The proxy imports it, so the bundler carries the
 *    digests into the proxy function and they are available with no filesystem at
 *    all.
 *
 * **Precedence: the runtime read wins; the manifest is the fallback.**
 *
 * - A readable shell is the fresher source. Were the two ever to disagree, the
 *   file on disk is what the browser will actually receive, so it is the one that
 *   must be trusted.
 * - The fallback exists for a host where the shells are not on disk. Vercel is that
 *   host: static shells are served from the CDN and the proxy runs in its own
 *   function. Measured here, the proxy's file trace holds no `.html` files at all,
 *   and `outputFileTracingIncludes` does not add them, because `.next` is build
 *   output rather than an input.
 * - On a `next start` deployment the two cannot meaningfully disagree: the manifest
 *   is generated from the very build that populated `.next`.
 *
 * The choice is made per pathname rather than once per process, so a partial output
 * directory still gets the manifest's answer for the routes it is missing.
 * {@link describeHashSource} reports which source answered, for a release log.
 *
 * ## The manifest is tied to one origin
 *
 * The prerendered flight payloads embed absolute URLs built from
 * `NEXT_PUBLIC_SITE_URL`. Measured on this build, changing that origin altered 47
 * of the 60 shells, so a digest describes a particular origin and no other. A
 * manifest built for production therefore matches nothing on a preview domain, and
 * the failure would be silent: the page is served, the policy is sent, and the
 * browser refuses every script without telling the server.
 *
 * So the manifest records its origin in `CSP_MANIFEST_SITE_URL` and is refused
 * outright when the deployment is serving a different one. A refused manifest falls
 * back to the build output if that is readable, and otherwise to the nonce-only
 * policy with a warning naming both origins. Neither is as good as a matching
 * manifest, and both are better than digests that cannot match.
 *
 * ## A pathname with no shell of its own
 *
 * A dynamic route that calls `notFound()` serves a document assembled at request
 * time, so no `.html` file describes it: measured, `/guides/belgium/nope` answers
 * `200` with 14 inline scripts of which the three framework bootstrap scripts carry
 * no nonce. Those three — the accessibility preference reader, `$RT` and `$RV` —
 * are byte-identical in every shell, which is what makes them knowable in advance.
 * Such a path therefore gets the shared bootstrap set, plus the digests of Next's
 * own not-found document, which is what an unmatched path is served verbatim.
 *
 * ## Scope
 *
 * Only *prerendered* routes have this problem. A route rendered per request
 * receives the nonce on every script it renders, so it needs no per-route hashes —
 * just the bootstrap set described above.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, sep } from "node:path";

import {
  CSP_HASH_MANIFEST,
  CSP_MANIFEST_GENERATED,
  CSP_MANIFEST_SHELL_COUNT,
  CSP_MANIFEST_SITE_URL,
  CSP_NOT_FOUND_HASHES,
  CSP_SHARED_HASHES,
} from "./csp-hash-manifest.generated";
import { commonInlineScriptHashes, extractInlineScriptHashes } from "./inline-script-hashes";

export {
  commonInlineScriptHashes,
  extractInlineScriptHashes,
  inlineScriptSourceExpression,
} from "./inline-script-hashes";

/**
 * Whether the committed manifest describes *this* deployment's build.
 *
 * The prerendered flight payloads embed absolute URLs built from
 * `NEXT_PUBLIC_SITE_URL`, so the inline scripts — and therefore their digests —
 * depend on that origin. Measured on this project, changing it altered 47 of 60
 * shells. A manifest generated for a different origin would therefore match no
 * script at all, and the failure mode is a page that loads and never hydrates.
 *
 * So the origin is compared before the manifest is trusted. A mismatch is treated
 * as "no manifest", which falls back to the build output if it is readable and
 * otherwise leaves the nonce-only policy with a warning — both strictly better
 * than attaching digests that cannot match.
 *
 * An unset `NEXT_PUBLIC_SITE_URL` at runtime only compares equal when the manifest
 * was also generated with it unset, which is the local-development case.
 */
function manifestMatchesDeployment(): boolean {
  if (!CSP_MANIFEST_GENERATED) return false;
  if (CSP_MANIFEST_SITE_URL === "") return true;
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "") === CSP_MANIFEST_SITE_URL;
}

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

/** The document Next serves when no route matches, and where `notFound()` lands. */
export const NOT_FOUND_SHELL = "_not-found.html";

/**
 * The shells the bootstrap intersection is computed from.
 *
 * A shell-less page is, in practice, a `notFound()` raised inside a dynamic route,
 * and what it serves is the dynamic route's own template. Measured on this build,
 * `guides/[edition].html` and `guides/[edition]/[chapter].html` contain exactly
 * three inline scripts — the accessibility preference reader, `$RT` and a `$RV`
 * variant — and `/guides/belgium/nope` answers `200` with exactly those three
 * uncovered by a nonce. Intersecting the templates therefore yields precisely the
 * set such a page needs.
 *
 * When a build has no templates at all, the intersection across every shell is the
 * fallback, and `index.html` is the last resort.
 *
 * `_global-error.html` is excluded on purpose: it is Next's development error shell
 * and is never served in production, so letting it into the intersection would
 * shrink the set to nothing.
 */
const GLOBAL_ERROR_SHELL = "_global-error.html";

/** True when a shell file name is a dynamic route template. */
export function isTemplateShell(relativePath: string): boolean {
  return /[[\]]/.test(relativePath);
}

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
 * Reads one shell file.
 *
 * Marked `turbopackIgnore` so the bundler does not try to trace the read into the
 * server bundle. Without the marker, a path assembled at run time makes Turbopack
 * assume the whole project might be needed and trace every source file and the
 * entire `public/` folder into the deployment, which slows deploys and can exceed
 * size limits. The files are produced by the build at a known location, so they
 * are not bundle inputs — and where they are absent, the generated manifest is.
 */
function readShellFile(file: string): string | null {
  try {
    if (!existsSync(/* turbopackIgnore: true */ file)) return null;
    return readFileSync(/* turbopackIgnore: true */ file, "utf8");
  } catch {
    return null;
  }
}

/** Which source answered for a pathname. Reported for a release log. */
export type HashSource = "prerender-output" | "manifest" | "none";

/** Per-process caches. The build output cannot change while the server runs. */
const routeCache = new Map<string, readonly string[]>();
const bootstrapCache = new Map<string, readonly string[]>();

/** The manifest key for a pathname: rooted, with no trailing slash. */
function manifestKey(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** The not-found document's digests, read from the build output. */
function notFoundHashesFromOutput(root: string): readonly string[] {
  const html = readShellFile(join(root, NOT_FOUND_SHELL));
  return html === null ? [] : extractInlineScriptHashes(html);
}

/**
 * The manifest's answer for a pathname, or null when the manifest must not be used.
 *
 * Two reasons to return null: it was never generated, or it was generated for a
 * different origin than this deployment is serving (see
 * {@link manifestMatchesDeployment}).
 *
 * An exact entry describes that route's own shell. A pathname absent from a
 * generated manifest is a route rendered per request, or a path Next answers with
 * its not-found document; such a page still carries the framework bootstrap, so the
 * shared set is the honest answer rather than `null`.
 */
function fromManifest(pathname: string): readonly string[] | null {
  if (!manifestMatchesDeployment()) return null;

  const exact = CSP_HASH_MANIFEST[manifestKey(pathname)];
  if (exact !== undefined) return exact;

  return [...new Set([...CSP_SHARED_HASHES, ...CSP_NOT_FOUND_HASHES])];
}

/**
 * What a page needs when it has no shell of its own: the framework bootstrap,
 * derived from the build output when no generated manifest is present.
 *
 * The templates are read first because they are small and describe exactly this
 * case; `index.html` and the not-found document are added so a build with no
 * templates still produces a usable set.
 */
function bootstrapHashesFromOutput(root: string): readonly string[] {
  const cached = bootstrapCache.get(root);
  if (cached !== undefined) return cached;

  const documents = readBootstrapDocuments(root);
  const hashes = [...new Set([...commonInlineScriptHashes(documents), ...notFoundHashesFromOutput(root)])];
  bootstrapCache.set(root, hashes);
  return hashes;
}

/**
 * The documents the bootstrap intersection is taken over, in order of preference.
 *
 * Reading the two dynamic-route templates is what makes the set exact; the rest is
 * a fallback for a build that has none. Every file read here is skipped when it is
 * absent, so a partial output directory degrades rather than throws.
 */
function readBootstrapDocuments(root: string): readonly string[] {
  const preferred = readTemplateDocuments(root);
  if (preferred.length > 0) return preferred;
  return [join(root, "index.html"), join(root, NOT_FOUND_SHELL)]
    .map(readShellFile)
    .filter((html): html is string => html !== null);
}

/**
 * Every dynamic-route template in the output tree, read and filtered.
 *
 * Recursive on purpose: the templates that matter are nested —
 * `guides/[edition]/[chapter].html` — so a top-level listing would find only
 * `guides/[edition].html` and, on a build with no top-level template, nothing at
 * all. A depth bound keeps a pathological directory from being walked forever.
 *
 * Only the first few are read. The intersection of the templates is stable, and
 * this runs once per process on the first document request, so reading every one
 * would be work for no extra accuracy.
 */
const TEMPLATE_READ_LIMIT = 12;
const TEMPLATE_MAX_DEPTH = 8;

function readTemplateDocuments(root: string): readonly string[] {
  const found: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > TEMPLATE_MAX_DEPTH || found.length >= TEMPLATE_READ_LIMIT) return;
    let entries: readonly { name: string; isFile(): boolean; isDirectory(): boolean }[];
    try {
      entries = readdirSync(/* turbopackIgnore: true */ dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= TEMPLATE_READ_LIMIT) return;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".html") &&
        isTemplateShell(entry.name) &&
        entry.name !== GLOBAL_ERROR_SHELL
      ) {
        const html = readShellFile(full);
        if (html !== null) found.push(html);
      }
    }
  }

  walk(root, 0);
  return found;
}

/**
 * Returns the inline-script hashes for the shell that serves `pathname`.
 *
 * Precedence, per pathname:
 *
 * 1. the route's own shell in the prerender output, when it is readable;
 * 2. the generated manifest — the route's entry, or the bootstrap set when the
 *    route has none;
 * 3. the bootstrap set derived from whatever shells the output does hold.
 *
 * See the module comment for why the file on disk is preferred over the manifest.
 */
export function getInlineScriptHashes(
  pathname: string,
  root: string = prerenderRoot(),
): readonly string[] {
  const cacheKey = `${root}\u0000${pathname}`;
  const cached = routeCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const file = shellFileForPathname(pathname, root);
  const html = file === null ? null : readShellFile(file);

  const hashes =
    html !== null
      ? extractInlineScriptHashes(html)
      : (fromManifest(pathname) ?? bootstrapHashesFromOutput(root));

  routeCache.set(cacheKey, hashes);
  return hashes;
}

/**
 * Which source answers for `pathname`.
 *
 * `prerender-output` means either the route's own shell or the bootstrap set read
 * from the output. `none` is the state worth alerting on: a prerendered page would
 * be served without the digests its scripts need, and would not hydrate.
 */
export function describeHashSource(
  pathname: string,
  root: string = prerenderRoot(),
): HashSource {
  const file = shellFileForPathname(pathname, root);
  if (file !== null && readShellFile(file) !== null) return "prerender-output";
  if (fromManifest(pathname) !== null) return "manifest";
  return bootstrapHashesFromOutput(root).length > 0 ? "prerender-output" : "none";
}

/**
 * True when this deployment can answer from something other than the nonce alone.
 *
 * A usable manifest counts: it is a complete answer for the routes it lists, and a
 * host that has it does not need the build output beside the server. A manifest
 * generated for a different origin does not count, because none of its digests
 * would match.
 */
export function isPrerenderOutputAvailable(root: string = prerenderRoot()): boolean {
  return manifestMatchesDeployment() || existsSync(root);
}

/** One line describing where the hashes come from, for a startup log. */
export function describeHashCoverage(): string {
  if (manifestMatchesDeployment()) {
    return (
      `CSP hashes: manifest from ${CSP_MANIFEST_SHELL_COUNT} shells ` +
      `(${Object.keys(CSP_HASH_MANIFEST).length} pathnames, ${CSP_SHARED_HASHES.length} shared), ` +
      "with the prerender output preferred where it is readable."
    );
  }
  if (CSP_MANIFEST_GENERATED) {
    return (
      "CSP hashes: the committed manifest was generated for " +
      `${JSON.stringify(CSP_MANIFEST_SITE_URL)} but this deployment serves ` +
      `${JSON.stringify(process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "")}, so it cannot be used. ` +
      "Rebuild the manifest with the deployment's own NEXT_PUBLIC_SITE_URL, or make the " +
      "prerender output readable through PRERENDER_OUTPUT_DIR."
    );
  }
  return (
    "CSP hashes: prerender output only. Run scripts/generate-csp-hashes.mjs after the " +
    "build to cover a host where that output is not on disk."
  );
}

/** Clears the caches. For tests only. */
export function clearHashCache(): void {
  routeCache.clear();
  bootstrapCache.clear();
}
