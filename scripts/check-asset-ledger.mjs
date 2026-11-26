#!/usr/bin/env node
/**
 * Fails the build when a file served from `public/` has no entry in the asset ledger.
 *
 * ## What this checks
 *
 * `docs/legal/asset-ledger.md` holds one table of every file under `public/`. Each
 * row's first cell is a path pattern (`public/brand/logo-*.webp`) and its second
 * cell is the number of files that pattern is expected to cover. This script walks
 * `public/`, matches every file against every pattern, and reports three kinds of
 * problem:
 *
 * 1. **An undocumented file.** A new image or script was added to `public/` and
 *    nobody recorded where it came from or what licence it carries. This is the
 *    case the ledger exists to catch.
 * 2. **A documented pattern that matches nothing.** A file was deleted or renamed
 *    and the row that described it now describes air.
 * 3. **A pattern whose file count is wrong.** The row says three files and nine
 *    match, so the row's licence statement is now claiming coverage it does not
 *    have — usually because a new variant was added next to the old ones.
 *
 * A fourth check confirms the ledger still states the licence identifiers that the
 * launch paperwork depends on: the Creative Commons dedication for the 3D icons,
 * the SIL Open Font License for the typefaces, the OpenStreetMap attribution
 * string, and the ODbL and BSD-3-Clause identifiers for the map data and MapLibre.
 * Deleting those sentences is a licence breach, so the script treats their absence
 * as a failure rather than a matter of taste.
 *
 * ## What it deliberately does not check
 *
 * It does not judge whether a licence is the right one. It checks that a human
 * wrote an answer down.
 *
 * It also does not read `.gitignore`. `public/maplibre-gl/` is listed explicitly
 * because it is generated at `postinstall`, `predev` and `prebuild` by
 * `scripts/copy-maplibre-worker.mjs`, so its contents are a copy of a dependency
 * rather than a reviewed asset; the ledger records that copy as a derived artefact
 * of MapLibre GL JS. Reading ignore files at runtime would also let an accidental
 * `.gitignore` edit silently drop a real asset from the audit, which is the
 * opposite of what this check is for.
 *
 * ## Exit codes
 *
 * - `0` — every file is documented and every row is accurate.
 * - `1` — the audit failed: an undocumented file, a stale row, a wrong count, or a
 *   missing licence statement.
 * - `2` — the ledger could not be read or parsed as a table. That is a fault in the
 *   check itself or in the ledger's structure, not in the assets, so it is given a
 *   code of its own; a CI job can tell the two apart from the exit status alone.
 *
 * ## Usage
 *
 * ```sh
 * node scripts/check-asset-ledger.mjs
 * node scripts/check-asset-ledger.mjs --root path/to/fixture
 * ```
 *
 * `--root` exists for the tests, which build a throwaway `public/` and ledger in a
 * temporary directory. Without it the paths resolve from the repository root, so
 * the command behaves the same from any working directory.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));

/** The repository root: the parent of `scripts/`. Overridable with `--root`. */
export const PROJECT_ROOT = resolve(SCRIPT_DIRECTORY, "..");

/** Where the ledger lives, relative to the project root. */
export const LEDGER_RELATIVE_PATH = join("docs", "legal", "asset-ledger.md");

/** The directory that is audited, relative to the project root. */
export const PUBLIC_DIRECTORY = "public";

/**
 * The inventory heading the parser looks for. It must match a whole line, so the
 * prose above the table can talk about the inventory without starting it.
 */
export const INVENTORY_HEADING = "## File inventory";

/** Directories under `public/` that are generated, not authored. */
export const IGNORED_PUBLIC_PATHS = ["public/maplibre-gl"];

/**
 * Filesystem litter that is not an asset and is never deployed by a static host.
 * Ignoring it keeps the audit green on a checkout that has been opened in Finder
 * or Explorer.
 */
export const IGNORED_FILE_NAMES = [".DS_Store", "Thumbs.db", "desktop.ini"];

/**
 * Licence identifiers that must survive in the ledger. Each is the canonical name
 * of the licence, so the check survives copy-editing and fails only on removal.
 */
export const REQUIRED_TERMS = [
  { term: "CC0 1.0", description: "the 3D icon set" },
  { term: "SIL Open Font License 1.1", description: "the web typefaces" },
  { term: "ODbL 1.0", description: "the OpenStreetMap data" },
  { term: "© OpenStreetMap contributors", description: "the map attribution string" },
  { term: "BSD-3-Clause", description: "MapLibre GL JS" },
];

export const EXIT_OK = 0;
export const EXIT_AUDIT_FAILED = 1;
export const EXIT_LEDGER_INVALID = 2;

/**
 * True when a pattern names no directory or file of its own, and so would document
 * anything at all under `public/`.
 *
 * `public/**` and `public/**​/*.webp` are the shapes to reject: they pass an audit
 * for an asset added next year by someone who never read this ledger. The rule is
 * that at least one path segment must begin with a literal character, so a directory
 * name such as `brand` or a file prefix such as `logo-` anchors the row to a
 * decision. A pattern made only of wildcards has no such anchor.
 *
 * @param {string} pattern a path pattern already known to start with `public/`
 * @returns {boolean} true when no segment is anchored by a literal character
 */
export function isCatchAllPattern(pattern) {
  const segments = pattern.slice(`${PUBLIC_DIRECTORY}/`.length).split("/");
  return !segments.some((segment) => /^[^*/?]/.test(segment));
}

/**
 * Turns one ledger path pattern into an anchored regular expression.
 *
 * The dialect is deliberately small and documented in the ledger: a single `*`
 * matches any run of characters inside one path segment, a double star matches
 * across segments, a double star followed by a slash matches zero or more whole
 * segments, and `?` matches one character inside a
 * segment. Shell constructs that mean something else to another tool — brace
 * expansion, character classes, extglobs, backslash escapes — are rejected rather
 * than misread, because a pattern that silently matches the wrong files would give
 * a false pass.
 *
 * Matching is case-sensitive on purpose. The local filesystem may not be, but the
 * deployment target is, and a ledger that only matches on the developer's machine
 * is worthless.
 *
 * @param {string} pattern a path pattern rooted at `public/`
 * @returns {RegExp} an anchored expression with no global flag
 * @throws {TypeError} when the pattern is not a non-empty string
 * @throws {RangeError} when the pattern uses unsupported glob syntax
 */
export function globToRegExp(pattern) {
  if (typeof pattern !== "string" || pattern.length === 0) {
    throw new TypeError("A path pattern must be a non-empty string.");
  }
  if (/[[\]{}!\\]/.test(pattern)) {
    throw new RangeError(
      `Unsupported glob syntax in "${pattern}". Only "*", "**" and "?" are understood.`,
    );
  }

  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === "*") {
      if (pattern[index + 1] === "*") {
        index += 1;
        if (pattern[index + 1] === "/") {
          // `a/**/b` must also match `a/b`: zero segments is a valid expansion.
          index += 1;
          source += "(?:[^/]+/)*";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
      continue;
    }

    if (character === "?") {
      source += "[^/]";
      continue;
    }

    source += character.replace(/[.+^$()|]/g, "\\$&");
  }

  return new RegExp(`${source}$`);
}

/** Splits one Markdown table line into its cells, ignoring the outer pipes. */
function tableCells(line) {
  let body = line.trim();
  if (body.startsWith("|")) body = body.slice(1);
  if (body.endsWith("|")) body = body.slice(0, -1);
  return body.split("|").map((cell) => cell.trim());
}

/** True when every cell is a Markdown alignment rule, as in `| --- | ---: |`. */
function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/**
 * Reads the inventory table out of the ledger.
 *
 * Returning problems rather than throwing keeps the caller's report complete: a
 * ledger with two broken rows should report both, not the first.
 *
 * @param {string} markdown the full ledger text
 * @returns {{ rows: Array<{ pattern: string, expectedCount: number, line: number, matcher: RegExp }>, problems: string[] }}
 */
export function parseInventory(markdown) {
  if (typeof markdown !== "string") {
    throw new TypeError("The ledger markdown must be a string.");
  }

  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const headingIndex = lines.findIndex((line) => line.trim() === INVENTORY_HEADING);

  if (headingIndex === -1) {
    return {
      rows: [],
      problems: [`The ledger has no "${INVENTORY_HEADING}" heading, so there is no table to check.`],
    };
  }

  const problems = [];
  const rows = [];
  const seen = new Map();
  let started = false;

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const isTableLine = line.trim().startsWith("|");

    if (!isTableLine) {
      if (started) break;
      continue;
    }

    if (!started) {
      started = true;
      continue;
    }

    const cells = tableCells(line);
    if (isSeparatorRow(cells)) continue;
    if (cells.length === 0 || cells.every((cell) => cell === "")) continue;

    const lineNumber = index + 1;

    if (cells.length !== 6) {
      problems.push(
        `Line ${lineNumber}: the inventory table needs 6 columns (pattern, files, asset, source, licence, attribution) but has ${cells.length}.`,
      );
      continue;
    }

    const pattern = cells[0].replace(/`/g, "").trim();
    const countText = cells[1].replace(/`/g, "").trim();

    if (!pattern.startsWith(`${PUBLIC_DIRECTORY}/`)) {
      problems.push(
        `Line ${lineNumber}: "${pattern}" is not a path under ${PUBLIC_DIRECTORY}/. Only served files belong in this table.`,
      );
      continue;
    }

    if (isCatchAllPattern(pattern)) {
      problems.push(
        `Line ${lineNumber}: "${pattern}" names no directory or file of its own, so it would document every file under ${PUBLIC_DIRECTORY}/. Point the row at the files it is about.`,
      );
      continue;
    }

    let matcher;
    try {
      matcher = globToRegExp(pattern);
    } catch (error) {
      problems.push(`Line ${lineNumber}: ${error.message}`);
      continue;
    }

    const expectedCount = Number(countText);
    if (!Number.isInteger(expectedCount) || expectedCount < 1) {
      problems.push(
        `Line ${lineNumber}: "${countText}" is not a whole number of files for "${pattern}".`,
      );
      continue;
    }

    if (seen.has(pattern)) {
      problems.push(
        `Line ${lineNumber}: "${pattern}" is already listed on line ${seen.get(pattern)}. Merge the two rows so the count means one thing.`,
      );
      continue;
    }

    seen.set(pattern, lineNumber);
    rows.push({ pattern, expectedCount, line: lineNumber, matcher });
  }

  if (!started) {
    problems.push(`The "${INVENTORY_HEADING}" heading is not followed by a Markdown table.`);
  } else if (rows.length === 0 && problems.length === 0) {
    problems.push("The inventory table has a header but no rows.");
  }

  return { rows, problems };
}

/**
 * Every file under `public/`, as forward-slash paths relative to the project root.
 *
 * Symlinks are skipped rather than followed: a link to a directory can loop, and a
 * link to a file outside the repository is not something this ledger can license.
 * They are reported so the operator can decide.
 *
 * @param {string} root the project root to read `public/` from
 * @returns {Promise<{ files: string[], skippedSymbolicLinks: string[] }>}
 */
export async function collectPublicFiles(root) {
  const files = [];
  const skippedSymbolicLinks = [];

  async function walk(relativeDirectory) {
    const entries = await readdir(join(root, relativeDirectory), { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
      const relative = `${relativeDirectory}/${entry.name}`;

      if (entry.isSymbolicLink()) {
        skippedSymbolicLinks.push(relative);
        continue;
      }
      if (entry.isDirectory()) {
        if (!IGNORED_PUBLIC_PATHS.includes(relative)) await walk(relative);
        continue;
      }
      if (entry.isFile() && !IGNORED_FILE_NAMES.includes(entry.name)) files.push(relative);
    }
  }

  await walk(PUBLIC_DIRECTORY);
  files.sort();
  return { files, skippedSymbolicLinks };
}

/**
 * Compares the files on disk with the ledger's rows.
 *
 * @param {string[]} files forward-slash paths relative to the project root
 * @param {Array<{ pattern: string, expectedCount: number, line: number, matcher: RegExp }>} rows
 * @returns {{
 *   undocumented: string[],
 *   countProblems: Array<{ pattern: string, expectedCount: number, actualCount: number, line: number }>,
 * }}
 */
export function auditInventory(files, rows) {
  const undocumented = [];
  const actualCounts = new Map(rows.map((row) => [row.pattern, 0]));

  for (const file of files) {
    let documented = false;
    for (const row of rows) {
      if (!row.matcher.test(file)) continue;
      documented = true;
      actualCounts.set(row.pattern, actualCounts.get(row.pattern) + 1);
    }
    if (!documented) undocumented.push(file);
  }

  const countProblems = rows
    .map((row) => ({
      pattern: row.pattern,
      expectedCount: row.expectedCount,
      actualCount: actualCounts.get(row.pattern),
      line: row.line,
    }))
    .filter((entry) => entry.actualCount !== entry.expectedCount);

  return { undocumented, countProblems };
}

/** The licence identifiers that have gone missing from the ledger. */
export function findMissingTerms(markdown) {
  return REQUIRED_TERMS.filter((entry) => !markdown.includes(entry.term));
}

/**
 * Runs the whole check and returns an exit code. Nothing is written to disk.
 *
 * @param {{ root?: string, stdout?: (text: string) => void, stderr?: (text: string) => void }} [options]
 * @returns {Promise<number>} one of the `EXIT_*` constants
 */
export async function checkAssetLedger(options = {}) {
  const root = options.root ?? PROJECT_ROOT;
  const stdout = options.stdout ?? ((text) => process.stdout.write(`${text}\n`));
  const stderr = options.stderr ?? ((text) => process.stderr.write(`${text}\n`));
  const ledgerPath = join(root, LEDGER_RELATIVE_PATH);

  let markdown;
  try {
    markdown = await readFile(ledgerPath, "utf8");
  } catch (error) {
    stderr(`Cannot read the ledger at ${ledgerPath}: ${error.message}`);
    return EXIT_LEDGER_INVALID;
  }

  const { rows, problems } = parseInventory(markdown);
  if (problems.length > 0 || rows.length === 0) {
    stderr(`The ledger at ${LEDGER_RELATIVE_PATH} could not be read as an inventory:`);
    for (const problem of problems) stderr(`  - ${problem}`);
    return EXIT_LEDGER_INVALID;
  }

  let collected;
  try {
    collected = await collectPublicFiles(root);
  } catch (error) {
    stderr(`Cannot read ${PUBLIC_DIRECTORY}/ under ${root}: ${error.message}`);
    return EXIT_LEDGER_INVALID;
  }

  const { files, skippedSymbolicLinks } = collected;
  const { undocumented, countProblems } = auditInventory(files, rows);
  const missingTerms = findMissingTerms(markdown);

  stdout("Asset ledger check");
  stdout(`  Ledger: ${LEDGER_RELATIVE_PATH}`);
  stdout(`  Files:  ${files.length} under ${PUBLIC_DIRECTORY}/ (${IGNORED_PUBLIC_PATHS.join(", ")} ignored)`);
  stdout(`  Rows:   ${rows.length} path pattern(s)`);
  for (const link of skippedSymbolicLinks) {
    stdout(`  Note:   skipped symbolic link ${link}`);
  }

  if (undocumented.length === 0 && countProblems.length === 0 && missingTerms.length === 0) {
    stdout(`OK: all ${files.length} public asset(s) are documented and every row is accurate.`);
    return EXIT_OK;
  }

  if (undocumented.length > 0) {
    stderr("");
    stderr(`FAIL: ${undocumented.length} file(s) under ${PUBLIC_DIRECTORY}/ are not in the ledger:`);
    for (const file of undocumented) stderr(`  - ${file}`);
    stderr("Add a row to the file inventory in the ledger before committing the file.");
  }

  if (countProblems.length > 0) {
    stderr("");
    stderr(`FAIL: ${countProblems.length} inventory row(s) do not match the files on disk:`);
    for (const entry of countProblems) {
      const detail =
        entry.actualCount === 0
          ? "matches no file, so the asset it describes is gone"
          : `says ${entry.expectedCount} file(s) but ${entry.actualCount} match`;
      stderr(`  - line ${entry.line}: ${entry.pattern} ${detail}`);
    }
  }

  if (missingTerms.length > 0) {
    stderr("");
    stderr("FAIL: the ledger no longer states these licences:");
    for (const entry of missingTerms) {
      stderr(`  - ${entry.term} (${entry.description})`);
    }
  }

  return EXIT_AUDIT_FAILED;
}

/** Reads `--root <path>` from an argument list, or returns undefined. */
export function parseRootArgument(argv) {
  const index = argv.indexOf("--root");
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new RangeError("--root needs a directory after it.");
  }
  return resolve(value);
}

/** True when this file is the process entry point rather than an import. */
function isDirectRun() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const invokedPath = resolve(invoked);
  const modulePath = fileURLToPath(import.meta.url);
  return process.platform === "win32"
    ? invokedPath.toLowerCase() === modulePath.toLowerCase()
    : invokedPath === modulePath;
}

if (isDirectRun()) {
  try {
    const root = parseRootArgument(process.argv.slice(2));
    process.exitCode = await checkAssetLedger({ root });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = EXIT_LEDGER_INVALID;
  }
}
