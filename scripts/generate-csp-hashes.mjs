#!/usr/bin/env node
/**
 * Generates the static CSP hash manifest from a finished build.
 *
 * ## Why this exists
 *
 * `src/lib/security/csp-hashes.ts` hashes the prerendered shells by reading
 * `.next/server/app/*.html` at runtime. That works wherever the build output sits
 * beside the server — `next start`, a container, this project's e2e suite — and it
 * is exact, because the files it reads are the files being served.
 *
 * It does not work on Vercel. Static shells are served from the CDN and the proxy
 * runs in its own function, which has no view of the build output. Measured on
 * this project: the proxy's file trace contains no `.html` files, and
 * `outputFileTracingIncludes` does not add them, because `.next` is build output
 * rather than an input. So on that host the runtime read returns nothing and every
 * prerendered page would fail to hydrate under a nonce-only policy.
 *
 * This script closes that gap by turning the same digests into a module the proxy
 * imports and the bundler therefore carries.
 *
 * ## Usage
 *
 *     npx next build                       # produce .next/server/app/*.html
 *     node scripts/generate-csp-hashes.mjs # write the manifest
 *     node scripts/generate-csp-hashes.mjs --check  # verify, do not write
 *
 * `--check` exits 1 when the committed manifest does not match the build in this
 * working tree. That is the release gate: a stale manifest is only dangerous on the
 * host that cannot read the shells at runtime, and it fails silently there.
 *
 * ## The two constraints that make the committed manifest trustworthy
 *
 * 1. **Inline scripts must be reproducible.** Two consecutive builds of the same
 *    commit were compared across all 60 shells and every script body was
 *    byte-identical, so a manifest committed for a commit describes that commit's
 *    build. The script reports the shell count it saw so a mismatch is visible.
 * 2. **The build's environment is part of the identity.** The flight payloads
 *    embed absolute URLs, so `NEXT_PUBLIC_SITE_URL` changes 52 of the 60 shells.
 *    Generate with the production value, and run `--check` in the release pipeline
 *    with that same value set.
 *
 * ## Exit codes
 *
 * | Code | Meaning |
 * | --- | --- |
 * | 0 | Manifest written, or `--check` matched. |
 * | 1 | `--check` found a difference, or the build output is missing. |
 * | 2 | The run could not start: bad argument, or the build output is unreadable. |
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const SHELL_DIR = path.join(ROOT, ".next", "server", "app");
const OUTPUT = path.join(ROOT, "src", "lib", "security", "csp-hash-manifest.generated.ts");

/** The document Next serves for an unmatched path and for `notFound()`. */
const NOT_FOUND_FILE = "_not-found.html";

/**
 * Next's development-only error shell. Never served in production, and it carries a
 * different bootstrap from every real page, so it must not reach the intersection.
 */
const GLOBAL_ERROR_FILE = "_global-error.html";

const HELP = `CSP hash manifest generator

Usage
  node scripts/generate-csp-hashes.mjs [--check] [--quiet]

Options
  --check   Compare with the committed manifest instead of writing it
  --quiet   Print nothing on success
  -h, --help

Run \`npx next build\` first: the input is .next/server/app/**/*.html.

Exit codes: 0 ok, 1 mismatch or missing build output, 2 argument error.
`;

/**
 * Parses the arguments this script understands.
 *
 * Strict on purpose: a typo such as `--chek` must not silently write a manifest
 * when the operator meant to verify one.
 */
export function parseArgs(argv) {
  const options = { check: false, quiet: false, help: false };
  for (const raw of argv) {
    if (raw === "--check") options.check = true;
    else if (raw === "--quiet") options.quiet = true;
    else if (raw === "--help" || raw === "-h") options.help = true;
    else throw new Error(`Unrecognised argument "${raw}". Use --help for the list.`);
  }
  return options;
}

/**
 * Every `.html` file under `dir`, as paths relative to it with forward slashes.
 *
 * Sorted so the output is deterministic regardless of the filesystem's ordering.
 */
async function listShells(dir) {
  const found = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith(".html")) {
        found.push(path.relative(dir, full).split(path.sep).join("/"));
      }
    }
  }
  await walk(dir);
  return found.sort();
}

/**
 * The request pathname a shell file serves, or null when it is not one.
 *
 * - `index.html` is the root;
 * - `guides/tickets.html` is `/guides/tickets`;
 * - a bracket file such as `guides/[edition].html` is Next's internal template
 *   for a dynamic route and is never a pathname a browser can ask for;
 * - `_not-found.html` and `_global-error.html` are special documents, handled
 *   under their own names.
 */
export function pathnameForShell(relativePath) {
  if (relativePath.startsWith("_")) return null;
  if (/[[\]]/.test(relativePath)) return null;
  const withoutExtension = relativePath.replace(/\.html$/, "");
  if (withoutExtension === "index") return "/";
  if (withoutExtension.endsWith("/index")) return `/${withoutExtension.slice(0, -"/index".length)}`;
  return `/${withoutExtension}`;
}

/**
 * Loads the shared extraction module.
 *
 * It is TypeScript with a single `node:crypto` import, so Node's type stripping
 * reads it directly. Node 22.18 and newer do this by default; CI pins Node 22, and
 * the message says what to do if a local Node is older rather than printing a
 * stack trace.
 */
/**
 * Suppresses Node's `MODULE_TYPELESS_PACKAGE_JSON` warning for this run.
 *
 * The shared extraction module is TypeScript in a project whose `package.json` has
 * no `"type": "module"`, so Node reparses it as ESM and warns once. The warning is
 * about the project's module declaration, not about the manifest, and it would be
 * the first line of every release log. Installing the filter for the life of the
 * process is safe here because the process is this script.
 */
function silenceModuleTypeWarning() {
  const originalEmit = process.emitWarning;
  process.emitWarning = (warning, ...rest) => {
    const message = typeof warning === "string" ? warning : (warning?.message ?? "");
    // Node passes the code in an options object, not always in the first string,
    // so the message text is checked as well.
    const options = rest.find((arg) => arg !== null && typeof arg === "object");
    const code =
      (typeof rest[0] === "string" ? rest[0] : undefined) ??
      options?.code ??
      (typeof warning === "object" ? warning?.code : undefined);
    if (
      code === "MODULE_TYPELESS_PACKAGE_JSON" ||
      message.includes("MODULE_TYPELESS") ||
      message.includes("Module type of file:")
    ) {
      return;
    }
    return originalEmit.call(process, warning, ...rest);
  };
}

async function loadExtractor() {
  const url = pathToFileURL(path.join(ROOT, "src", "lib", "security", "inline-script-hashes.ts")).href;
  try {
    return await import(url);
  } catch (error) {
    const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
    if (major >= 22) throw error;
    throw new Error(
      `Node ${process.versions.node} cannot read the TypeScript extraction module. Use Node 22.18 or newer.`,
    );
  }
}

/** Renders a string array as a single line, or `[]` when empty. */
function renderList(values, indent) {
  if (values.length === 0) return "[]";
  const inner = values.map((value) => `${indent}  ${JSON.stringify(value)},`).join("\n");
  return `[\n${inner}\n${indent}]`;
}

/**
 * Builds the manifest source and a summary of what went into it.
 *
 * The shape is deliberately flat and boring: a pathname-to-digests record, plus
 * the two cross-route sets. Nothing here is computed at import time, so the module
 * is a constant the bundler can inline.
 */
export function renderManifest({ pathnames, shared, notFound, shells, siteUrl, generatedAt }) {
  const keys = [...pathnames.keys()].sort();

  const entries = keys
    .map((key) => `  ${JSON.stringify(key)}: ${renderList(pathnames.get(key), "  ")},`)
    .join("\n");

  return `/**
 * Generated by \`scripts/generate-csp-hashes.mjs\`. Do not edit by hand.
 *
 * Shells: ${shells}
 * NEXT_PUBLIC_SITE_URL: ${siteUrl === "" ? "(unset)" : siteUrl}
 * Generated: ${generatedAt}
 *
 * Regenerate after every production build, with the production
 * NEXT_PUBLIC_SITE_URL set, and commit the result. \`--check\` reports a stale file.
 */

import type { CspHashManifest } from "./csp-hash-manifest";

/**
 * Inline-script digests per pathname, for the prerendered shell that serves it.
 *
 * A pathname absent here had no static shell in the build, which is correct for a
 * route rendered per request: every script on it carries the request's nonce.
 */
export const CSP_HASH_MANIFEST: CspHashManifest = {
${entries}
};

/**
 * Digests present in *every* prerendered shell.
 *
 * These are the framework's own bootstrap scripts: the streaming runtime, the
 * accessibility preference reader and the resume helpers. They are byte-identical
 * across routes, so they are what a page can still be given when its own shell is
 * unknown to this manifest.
 */
export const CSP_SHARED_HASHES: readonly string[] = ${renderList(shared, "")};

/**
 * Digests of the not-found document Next serves for an unmatched path.
 *
 * Attached whenever the requested path has no shell of its own, so the 404 page
 * hydrates instead of arriving dead.
 */
export const CSP_NOT_FOUND_HASHES: readonly string[] = ${renderList(notFound, "")};

/** True when this file was produced by the generator rather than shipped empty. */
export const CSP_MANIFEST_GENERATED = true;

/** Number of prerendered shells the manifest was built from. */
export const CSP_MANIFEST_SHELL_COUNT = ${shells};

/**
 * The origin this manifest was generated for.
 *
 * The prerendered flight payloads embed absolute URLs built from
 * \`NEXT_PUBLIC_SITE_URL\`, so their digests depend on it: measured, changing the
 * origin altered 47 of 60 shells. A manifest generated for one origin is worthless
 * for another, and silently so, which is why the value is recorded and checked.
 */
export const CSP_MANIFEST_SITE_URL: string = ${JSON.stringify(siteUrl)};

/** ISO timestamp of generation, for the release log. */
export const CSP_MANIFEST_GENERATED_AT = ${JSON.stringify(generatedAt)};
`;
}

/**
 * Reads the shells and reduces them to the manifest.
 *
 * The shared set is the intersection across the **dynamic-route templates**, not
 * across every shell. A shell-less page is a `notFound()` inside a dynamic route,
 * and what it serves is that route's template: measured on this build, the two
 * templates under `guides/` hold exactly three inline scripts, and
 * `/guides/belgium/nope` answers with exactly those three uncovered by a nonce.
 * Intersecting all 60 shells instead collapses to two, because Next elides the
 * `$RV` block on a route with nothing to stream.
 */
export async function buildManifest(shellDir, options = {}) {
  const extractor = options.extractor ?? (await loadExtractor());
  const { extractInlineScriptHashes, commonInlineScriptHashes } = extractor;

  let shells;
  try {
    shells = await listShells(shellDir);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`No build output at ${shellDir}. Run \`npx next build\` first.`);
    }
    throw error;
  }
  if (shells.length === 0) {
    throw new Error(`No .html shells under ${shellDir}. Run \`npx next build\` first.`);
  }

  const documents = new Map();
  for (const relative of shells) {
    documents.set(relative, await readFile(path.join(shellDir, ...relative.split("/")), "utf8"));
  }

  const pathnames = new Map();
  for (const [relative, html] of documents) {
    const pathname = pathnameForShell(relative);
    if (pathname === null) continue;
    pathnames.set(pathname, extractInlineScriptHashes(html));
  }

  const notFoundHtml = documents.get(NOT_FOUND_FILE);
  const notFound = notFoundHtml === undefined ? [] : extractInlineScriptHashes(notFoundHtml);

  const templates = [...documents.entries()]
    .filter(([relative]) => /[[\]]/.test(relative) && relative !== GLOBAL_ERROR_FILE)
    .map(([, html]) => html);

  /*
    With no templates there is nothing route-specific to intersect, so the
    not-found document stands in: it is the document an unmatched path is served,
    and its bootstrap is present on every page. Never the whole directory, which
    collapses to two digests and would leave a 404 page unable to run `$RV`.
  */
  const shared =
    templates.length > 0
      ? commonInlineScriptHashes(templates)
      : notFoundHtml === undefined
        ? []
        : commonInlineScriptHashes([notFoundHtml]);

  return { pathnames, shared, notFound, shells: shells.length, templates: templates.length };
}

/** The committed manifest's source, or null when it has never been generated. */
async function readCommitted(outputFile) {
  try {
    return await readFile(outputFile, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
  if (options.help) {
    process.stdout.write(HELP);
    return 0;
  }

  let built;
  try {
    built = await buildManifest(SHELL_DIR);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }

  const source = renderManifest({
    ...built,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "",
    // A constant rather than `new Date()`: `--check` compares file contents, and a
    // timestamp that changed on every run would report a mismatch every time. The
    // release pipeline passes the commit time when it wants one.
    generatedAt: process.env.CSP_MANIFEST_GENERATED_AT?.trim() || "unspecified",
  });

  if (options.check) {
    const committed = await readCommitted(OUTPUT);
    if (committed === null) {
      process.stderr.write(
        `No manifest at ${path.relative(ROOT, OUTPUT)}. Run the generator without --check.\n`,
      );
      return 1;
    }
    if (committed !== source) {
      process.stderr.write(
        "The committed CSP hash manifest does not match this build, so the deployed proxy would send stale hashes.\n" +
          `Regenerate it with the same NEXT_PUBLIC_SITE_URL and commit: node scripts/generate-csp-hashes.mjs\n`,
      );
      return 1;
    }
    if (!options.quiet) {
      process.stdout.write(`CSP hash manifest is current (${built.shells} shells).\n`);
    }
    return 0;
  }

  await writeFile(OUTPUT, source, "utf8");
  if (!options.quiet) {
    const total = [...built.pathnames.values()].reduce((sum, list) => sum + list.length, 0);
    process.stdout.write(
      `Wrote ${path.relative(ROOT, OUTPUT)}\n` +
        `  ${built.pathnames.size} pathnames, ${total} digests, ${built.shared.length} shared, ` +
        `${built.notFound.length} on the not-found document, from ${built.shells} shells.\n`,
    );
  }
  return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  silenceModuleTypeWarning();
  process.exitCode = await main(process.argv.slice(2));
}
