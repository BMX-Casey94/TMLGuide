/**
 * Tests for `scripts/check-asset-ledger.mjs`.
 *
 * Run: node --test scripts/check-asset-ledger.test.mjs
 *
 * vitest collects `src/**\/*.test.{ts,tsx}` only, so this file sits outside its
 * glob and runs under Node's own test runner, matching the script it tests: both
 * need nothing beyond Node's standard library.
 *
 * The fixtures are written to a temporary directory rather than committed, so a
 * test can create the exact tree it needs — including the trees the real repository
 * must never contain, such as an undocumented asset. Each fixture is removed
 * afterwards.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXIT_AUDIT_FAILED,
  EXIT_LEDGER_INVALID,
  EXIT_OK,
  INVENTORY_HEADING,
  REQUIRED_TERMS,
  auditInventory,
  checkAssetLedger,
  collectPublicFiles,
  findMissingTerms,
  globToRegExp,
  parseInventory,
  parseRootArgument,
} from "./check-asset-ledger.mjs";

const SCRIPT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "check-asset-ledger.mjs");
const REPOSITORY_ROOT = resolve(dirname(SCRIPT_PATH), "..");

/** Every fixture directory made by a test, removed in one pass at the end. */
const fixtureRoots = [];

after(async () => {
  await Promise.all(fixtureRoots.map((path) => rm(path, { recursive: true, force: true })));
});

/**
 * Builds a throwaway project root.
 *
 * @param {Record<string, string>} files paths relative to the root, with contents
 * @returns {Promise<string>} the absolute root
 */
async function createFixture(files) {
  const root = await mkdtemp(join(tmpdir(), "tmlguide-asset-ledger-"));
  fixtureRoots.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolute = join(root, ...relativePath.split("/"));
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, contents, "utf8");
  }

  return root;
}

/** A ledger body with the inventory heading, one row per pattern, and all required terms. */
function ledgerWith(rows, { terms = true } = {}) {
  const table = rows
    .map(
      (row) =>
        `| \`${row.pattern}\` | ${row.count} | Asset | Source | Licence | Attribution |`,
    )
    .join("\n");

  const licenceText = terms
    ? REQUIRED_TERMS.map(
        (entry) => `Licences in force: ${entry.term} for ${entry.description}.`,
      ).join("\n\n")
    : "";

  return [
    "# Asset licence ledger",
    "",
    "Prose that mentions a table before the real one.",
    "",
    "| Path pattern | Files |",
    "| --- | --- |",
    "",
    INVENTORY_HEADING,
    "",
    "| Path pattern | Files | Asset | Source | Licence | Attribution |",
    "| --- | --- | --- | --- | --- | --- |",
    table,
    "",
    "## Other sections",
    "",
    licenceText,
    "",
  ].join("\n");
}

/** Collects writes so a run's output can be asserted without touching the console. */
function capture() {
  const lines = [];
  return { lines, write: (text) => lines.push(text) };
}

describe("globToRegExp", () => {
  it("matches a literal path exactly", () => {
    const matcher = globToRegExp("public/sw.js");
    assert.equal(matcher.test("public/sw.js"), true);
    assert.equal(matcher.test("public/sw.jsx"), false);
    assert.equal(matcher.test("public/other/sw.js"), false);
  });

  it("keeps a single star inside one path segment", () => {
    const matcher = globToRegExp("public/brand/logo-*.webp");
    assert.equal(matcher.test("public/brand/logo-320.webp"), true);
    assert.equal(matcher.test("public/brand/logo-.webp"), true);
    assert.equal(matcher.test("public/brand/logo-320.avif"), false);
    assert.equal(matcher.test("public/brand/nested/logo-320.webp"), false);
  });

  it("lets a double star with a slash match zero segments as well as many", () => {
    const matcher = globToRegExp("public/**/icon.svg");
    assert.equal(matcher.test("public/icon.svg"), true);
    assert.equal(matcher.test("public/icons/icon.svg"), true);
    assert.equal(matcher.test("public/a/b/c/icon.svg"), true);
    assert.equal(matcher.test("public/icons/icon.svg.bak"), false);
  });

  it("lets a bare double star cross segments", () => {
    const matcher = globToRegExp("public/icons/**.webp");
    assert.equal(matcher.test("public/icons/3d/bag.webp"), true);
    assert.equal(matcher.test("public/icons/bag.webp"), true);
  });

  it("matches exactly one character for a question mark", () => {
    const matcher = globToRegExp("public/icons/icon?.svg");
    assert.equal(matcher.test("public/icons/icon1.svg"), true);
    assert.equal(matcher.test("public/icons/icon.svg"), false);
    assert.equal(matcher.test("public/icons/icon12.svg"), false);
  });

  it("treats regular-expression metacharacters in a path as literal text", () => {
    const matcher = globToRegExp("public/a+b/(c).svg");
    assert.equal(matcher.test("public/a+b/(c).svg"), true);
    assert.equal(matcher.test("public/aab/(c).svg"), false);
  });

  it("is case sensitive, because the deployment target is", () => {
    const matcher = globToRegExp("public/icons/Icon.svg");
    assert.equal(matcher.test("public/icons/icon.svg"), false);
  });

  it("rejects glob syntax it cannot honour rather than guessing", () => {
    for (const pattern of [
      "public/icons/[abc].svg",
      "public/icons/{a,b}.svg",
      "public/icons/!(a).svg",
      "public/icons/a\\*.svg",
    ]) {
      assert.throws(() => globToRegExp(pattern), RangeError, pattern);
    }
  });

  it("rejects an empty pattern", () => {
    assert.throws(() => globToRegExp(""), TypeError);
    assert.throws(() => globToRegExp(undefined), TypeError);
  });
});

describe("parseInventory", () => {
  it("reads the table after the heading and ignores the table before it", () => {
    const markdown = ledgerWith([
      { pattern: "public/sw.js", count: 1 },
      { pattern: "public/brand/logo-*.webp", count: 3 },
    ]);
    const { rows, problems } = parseInventory(markdown);

    assert.deepEqual(problems, []);
    assert.deepEqual(
      rows.map((row) => [row.pattern, row.expectedCount]),
      [
        ["public/sw.js", 1],
        ["public/brand/logo-*.webp", 3],
      ],
    );
    assert.equal(rows[0].matcher.test("public/sw.js"), true);
  });

  it("stops at the next heading, so later tables are not mistaken for inventory rows", () => {
    const markdown = [
      INVENTORY_HEADING,
      "",
      "| Path pattern | Files | Asset | Source | Licence | Attribution |",
      "| --- | --- | --- | --- | --- | --- |",
      "| `public/sw.js` | 1 | Asset | Source | Licence | Attribution |",
      "",
      "## A second table that is not the inventory",
      "",
      "| Something | Else |",
      "| --- | --- |",
      "| `nonsense` | 1 |",
    ].join("\n");

    const { rows } = parseInventory(markdown);
    assert.deepEqual(
      rows.map((row) => row.pattern),
      ["public/sw.js"],
    );
  });

  it("tolerates carriage returns, alignment rows and stray spacing", () => {
    const markdown = [
      INVENTORY_HEADING,
      "|  Path pattern  |  Files  |  Asset  |  Source  |  Licence  |  Attribution  |",
      "|:---|---:|:---:|---|---|---|",
      "|   `public/sw.js`   |   `1`   |  Asset  |  Source  |  Licence  |  Attribution  |",
    ].join("\r\n");

    const { rows, problems } = parseInventory(markdown);
    assert.deepEqual(problems, []);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].pattern, "public/sw.js");
    assert.equal(rows[0].expectedCount, 1);
  });

  it("reports a missing heading instead of throwing", () => {
    const { rows, problems } = parseInventory("# Something else\n\n| a | b |");
    assert.deepEqual(rows, []);
    assert.match(problems[0], /no "## File inventory" heading/);
  });

  it("reports a heading that no table follows", () => {
    const { problems } = parseInventory(`${INVENTORY_HEADING}\n\nNo table here.\n`);
    assert.match(problems[0], /not followed by a Markdown table/);
  });

  it("reports a table with a header and no rows", () => {
    const markdown = [
      INVENTORY_HEADING,
      "| Path pattern | Files | Asset | Source | Licence | Attribution |",
      "| --- | --- | --- | --- | --- | --- |",
    ].join("\n");
    const { rows, problems } = parseInventory(markdown);
    assert.deepEqual(rows, []);
    assert.match(problems[0], /no rows/);
  });

  it("reports a row with the wrong number of columns", () => {
    const markdown = [
      INVENTORY_HEADING,
      "| Path pattern | Files | Asset | Source | Licence | Attribution |",
      "| --- | --- | --- | --- | --- | --- |",
      "| `public/sw.js` | 1 | Asset |",
    ].join("\n");
    const { rows, problems } = parseInventory(markdown);
    assert.deepEqual(rows, []);
    assert.match(problems[0], /needs 6 columns/);
  });

  it("rejects a path outside public/", () => {
    const markdown = ledgerWith([{ pattern: "src/app/page.tsx", count: 1 }]);
    const { problems } = parseInventory(markdown);
    assert.match(problems[0], /not a path under public\//);
  });

  it("rejects a count that is not a whole positive number", () => {
    for (const count of ["many", "0", "-2", "1.5", "3 files"]) {
      const markdown = ledgerWith([{ pattern: "public/sw.js", count }]);
      const { problems } = parseInventory(markdown);
      assert.equal(problems.length, 1, `count "${count}" should be rejected`);
      assert.match(problems[0], /not a whole number of files/);
    }
  });

  it("rejects a catch-all pattern that would document anything added later", () => {
    for (const pattern of ["public/**", "public/**/*.webp", "public/*", "public/*/*"]) {
      const markdown = ledgerWith([{ pattern, count: 1 }]);
      const { problems } = parseInventory(markdown);
      assert.equal(problems.length, 1, `"${pattern}" should be rejected`);
      assert.match(problems[0], /names no directory or file of its own/);
    }
  });

  it("accepts a pattern whose coverage is bounded by a literal segment", () => {
    for (const pattern of ["public/brand/logo-*.webp", "public/**/logo-*.webp", "public/sw.js"]) {
      const markdown = ledgerWith([{ pattern, count: 1 }]);
      const { problems } = parseInventory(markdown);
      assert.deepEqual(problems, [], pattern);
    }
  });

  it("rejects a pattern the glob dialect cannot honour", () => {
    const markdown = ledgerWith([{ pattern: "public/icons/[ab].svg", count: 1 }]);
    const { problems } = parseInventory(markdown);
    assert.match(problems[0], /Unsupported glob syntax/);
  });

  it("rejects the same pattern twice, because two counts cannot both be right", () => {
    const markdown = ledgerWith([
      { pattern: "public/sw.js", count: 1 },
      { pattern: "public/sw.js", count: 2 },
    ]);
    const { rows, problems } = parseInventory(markdown);
    assert.equal(rows.length, 1);
    assert.match(problems[0], /already listed on line/);
  });

  it("rejects a non-string", () => {
    assert.throws(() => parseInventory(null), TypeError);
  });
});

describe("collectPublicFiles", () => {
  it("lists nested files as sorted forward-slash paths", async () => {
    const root = await createFixture({
      "public/b/file.txt": "b",
      "public/a/nested/c.txt": "c",
      "public/a/d.txt": "d",
    });

    const { files, skippedSymbolicLinks } = await collectPublicFiles(root);
    assert.deepEqual(files, ["public/a/d.txt", "public/a/nested/c.txt", "public/b/file.txt"]);
    assert.deepEqual(skippedSymbolicLinks, []);
  });

  it("skips the generated maplibre directory and operating-system litter", async () => {
    const root = await createFixture({
      "public/sw.js": "worker",
      "public/.DS_Store": "litter",
      "public/nested/Thumbs.db": "litter",
      "public/maplibre-gl/maplibre-gl-worker.mjs": "generated",
      "public/maplibre-gl/worker-version.json": "{}",
    });

    const { files } = await collectPublicFiles(root);
    assert.deepEqual(files, ["public/sw.js"]);
  });

  it("surfaces a missing public directory to the caller", async () => {
    const root = await createFixture({ "docs/legal/asset-ledger.md": "no public dir" });
    await assert.rejects(() => collectPublicFiles(root), /ENOENT/);
  });
});

describe("auditInventory", () => {
  const rowsFor = (pattern, expectedCount) => [
    { pattern, expectedCount, line: 1, matcher: globToRegExp(pattern) },
  ];

  it("passes when every file matches a row with the right count", () => {
    const files = ["public/brand/logo-320.webp", "public/brand/logo-640.webp"];
    const { undocumented, countProblems } = auditInventory(
      files,
      rowsFor("public/brand/logo-*.webp", 2),
    );
    assert.deepEqual(undocumented, []);
    assert.deepEqual(countProblems, []);
  });

  it("reports a file no row covers", () => {
    const files = ["public/sw.js", "public/rogue.png"];
    const { undocumented } = auditInventory(files, rowsFor("public/sw.js", 1));
    assert.deepEqual(undocumented, ["public/rogue.png"]);
  });

  it("reports a row that matches nothing", () => {
    const { countProblems } = auditInventory([], rowsFor("public/brand/logo-*.webp", 3));
    assert.deepEqual(countProblems, [
      { pattern: "public/brand/logo-*.webp", expectedCount: 3, actualCount: 0, line: 1 },
    ]);
  });

  it("reports a row whose count no longer matches, such as a new size variant", () => {
    const files = ["public/brand/logo-320.webp", "public/brand/logo-640.webp", "public/brand/logo-1280.webp"];
    const { undocumented, countProblems } = auditInventory(
      files,
      rowsFor("public/brand/logo-*.webp", 2),
    );
    assert.deepEqual(undocumented, []);
    assert.equal(countProblems[0].actualCount, 3);
    assert.equal(countProblems[0].expectedCount, 2);
  });

  it("counts a file covered by two overlapping rows in both, so the overlap is visible", () => {
    const rows = [
      { pattern: "public/icons/*.svg", expectedCount: 2, line: 1, matcher: globToRegExp("public/icons/*.svg") },
      { pattern: "public/icons/icon.svg", expectedCount: 1, line: 2, matcher: globToRegExp("public/icons/icon.svg") },
    ];
    const { undocumented, countProblems } = auditInventory(
      ["public/icons/icon.svg", "public/icons/icon-maskable.svg"],
      rows,
    );
    assert.deepEqual(undocumented, []);
    assert.deepEqual(countProblems, []);
  });
});

describe("findMissingTerms", () => {
  it("returns nothing when every licence identifier is present", () => {
    const markdown = REQUIRED_TERMS.map((entry) => entry.term).join(" ");
    assert.deepEqual(findMissingTerms(markdown), []);
  });

  it("names each identifier that has been deleted", () => {
    const markdown = "CC0 1.0 and nothing else";
    const missing = findMissingTerms(markdown).map((entry) => entry.term);
    assert.equal(missing.includes("SIL Open Font License 1.1"), true);
    assert.equal(missing.includes("CC0 1.0"), false);
  });
});

describe("checkAssetLedger", () => {
  it("passes on a fixture whose files are all documented", async () => {
    const root = await createFixture({
      "public/sw.js": "worker",
      "public/brand/logo-320.webp": "png",
      "public/brand/logo-640.webp": "png",
      "docs/legal/asset-ledger.md": ledgerWith([
        { pattern: "public/sw.js", count: 1 },
        { pattern: "public/brand/logo-*.webp", count: 2 },
      ]),
    });

    const out = capture();
    const err = capture();
    const code = await checkAssetLedger({ root, stdout: out.write, stderr: err.write });

    assert.equal(code, EXIT_OK);
    assert.equal(err.lines.length, 0);
    assert.match(out.lines.join("\n"), /all 3 public asset\(s\) are documented/);
  });

  it("fails when an asset has been added without a row", async () => {
    const root = await createFixture({
      "public/sw.js": "worker",
      "public/brand/unannounced.png": "png",
      "docs/legal/asset-ledger.md": ledgerWith([{ pattern: "public/sw.js", count: 1 }]),
    });

    const out = capture();
    const err = capture();
    const code = await checkAssetLedger({ root, stdout: out.write, stderr: err.write });

    assert.equal(code, EXIT_AUDIT_FAILED);
    const report = err.lines.join("\n");
    assert.match(report, /not in the ledger/);
    assert.match(report, /public\/brand\/unannounced\.png/);
    assert.match(report, /Add a row to the file inventory/);
  });

  it("fails when a row describes files that are gone", async () => {
    const root = await createFixture({
      "public/sw.js": "worker",
      "docs/legal/asset-ledger.md": ledgerWith([
        { pattern: "public/sw.js", count: 1 },
        { pattern: "public/brand/logo-*.webp", count: 3 },
      ]),
    });

    const err = capture();
    const code = await checkAssetLedger({ root, stdout: () => {}, stderr: err.write });

    assert.equal(code, EXIT_AUDIT_FAILED);
    const report = err.lines.join("\n");
    assert.match(report, /matches no file, so the asset it describes is gone/);
    assert.match(report, /public\/brand\/logo-\*\.webp/);
  });

  it("fails when the count is wrong, even though the pattern still matches", async () => {
    const root = await createFixture({
      "public/brand/logo-320.webp": "png",
      "public/brand/logo-640.webp": "png",
      "docs/legal/asset-ledger.md": ledgerWith([{ pattern: "public/brand/logo-*.webp", count: 1 }]),
    });

    const err = capture();
    const code = await checkAssetLedger({ root, stdout: () => {}, stderr: err.write });

    assert.equal(code, EXIT_AUDIT_FAILED);
    assert.match(err.lines.join("\n"), /says 1 file\(s\) but 2 match/);
  });

  it("fails when a required licence statement has been deleted", async () => {
    const root = await createFixture({
      "public/sw.js": "worker",
      "docs/legal/asset-ledger.md": ledgerWith([{ pattern: "public/sw.js", count: 1 }], {
        terms: false,
      }),
    });

    const err = capture();
    const code = await checkAssetLedger({ root, stdout: () => {}, stderr: err.write });

    assert.equal(code, EXIT_AUDIT_FAILED);
    assert.match(err.lines.join("\n"), /no longer states these licences/);
  });

  it("returns the invalid-ledger code when the ledger is missing", async () => {
    const root = await createFixture({ "public/sw.js": "worker" });
    const err = capture();
    const code = await checkAssetLedger({ root, stdout: () => {}, stderr: err.write });

    assert.equal(code, EXIT_LEDGER_INVALID);
    assert.match(err.lines.join("\n"), /Cannot read the ledger/);
  });

  it("returns the invalid-ledger code when the ledger has no inventory", async () => {
    const root = await createFixture({
      "public/sw.js": "worker",
      "docs/legal/asset-ledger.md": "# A ledger with no table\n",
    });

    const err = capture();
    const code = await checkAssetLedger({ root, stdout: () => {}, stderr: err.write });

    assert.equal(code, EXIT_LEDGER_INVALID);
    assert.match(err.lines.join("\n"), /could not be read as an inventory/);
  });

  it("returns the invalid-ledger code when public/ is missing", async () => {
    const root = await createFixture({
      "docs/legal/asset-ledger.md": ledgerWith([{ pattern: "public/sw.js", count: 1 }]),
    });

    const err = capture();
    const code = await checkAssetLedger({ root, stdout: () => {}, stderr: err.write });

    assert.equal(code, EXIT_LEDGER_INVALID);
    assert.match(err.lines.join("\n"), /Cannot read public\//);
  });

  it("passes on this repository, which is the promise the ledger makes", async () => {
    const out = capture();
    const err = capture();
    const code = await checkAssetLedger({ root: REPOSITORY_ROOT, stdout: out.write, stderr: err.write });

    assert.equal(err.lines.join("\n"), "");
    assert.equal(code, EXIT_OK);
  });
});

describe("parseRootArgument", () => {
  it("returns undefined when the flag is absent", () => {
    assert.equal(parseRootArgument([]), undefined);
    assert.equal(parseRootArgument(["--verbose"]), undefined);
  });

  it("resolves a supplied directory to an absolute path", () => {
    assert.equal(parseRootArgument(["--root", "some/dir"]), resolve("some/dir"));
  });

  it("rejects a flag with no value", () => {
    assert.throws(() => parseRootArgument(["--root"]), RangeError);
    assert.throws(() => parseRootArgument(["--root", "--other"]), RangeError);
  });
});

describe("the command line entry point", () => {
  /** Runs the script as a child process, as CI and a developer would. */
  function run(args) {
    return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
      encoding: "utf8",
      cwd: REPOSITORY_ROOT,
    });
  }

  it("exits 1 when a public asset is undocumented", async () => {
    const root = await createFixture({
      "public/sw.js": "worker",
      "public/sneaky.webp": "png",
      "docs/legal/asset-ledger.md": ledgerWith([{ pattern: "public/sw.js", count: 1 }]),
    });

    const result = run(["--root", root]);
    assert.equal(result.status, EXIT_AUDIT_FAILED);
    assert.match(result.stderr, /public\/sneaky\.webp/);
  });

  it("exits 0 on a documented fixture", async () => {
    const root = await createFixture({
      "public/sw.js": "worker",
      "docs/legal/asset-ledger.md": ledgerWith([{ pattern: "public/sw.js", count: 1 }]),
    });

    const result = run(["--root", root]);
    assert.equal(result.status, EXIT_OK);
    assert.match(result.stdout, /OK: all 1 public asset/);
  });

  it("exits 2 when --root has no value", () => {
    const result = run(["--root"]);
    assert.equal(result.status, EXIT_LEDGER_INVALID);
    assert.match(result.stderr, /--root needs a directory/);
  });

  it("exits 0 on this repository from any working directory", () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      encoding: "utf8",
      cwd: tmpdir(),
    });
    assert.equal(result.status, EXIT_OK);
    assert.match(result.stdout, /Asset ledger check/);
  });
});
