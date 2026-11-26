/**
 * Tests for `scripts/check-fact-freshness.mjs`.
 *
 * Run: node --test scripts/check-fact-freshness.test.mjs
 *
 * vitest collects `src/**\/*.test.{ts,tsx}` only, so this file sits outside its
 * glob and runs under Node's own test runner. The script has no dependencies and
 * neither do its tests.
 *
 * Three groups of checks:
 *
 * 1. Pure helpers — date parsing, age arithmetic, and the field scanner, which
 *    is handed strings so each awkward shape (a constant, a comment, a regex
 *    containing a quote) can be asserted on directly.
 * 2. Argument handling — every flag, and every value that should be refused.
 * 3. The whole command — a temporary folder of fixture files, run through
 *    `main`, so the `--strict` exit code is observed as a real return value
 *    rather than inferred from the report.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MAX_AGE_DAYS,
  REPO_ROOT,
  SCAN_ROOTS,
  TRACKED_FIELDS,
  UsageError,
  ageInDays,
  buildReport,
  collectSourceFiles,
  exitCodeFor,
  findDatedFields,
  formatIsoDate,
  formatReport,
  isIsoDate,
  main,
  parseArgs,
  parseIsoDate,
  scanRecords,
  toJson,
  todayUtcIsoDate,
} from "./check-fact-freshness.mjs";

/* ------------------------------------------------------------- temp folder */

const tempRoots = [];

/** A temporary folder, removed when the file finishes. */
function makeTempRoot() {
  const directory = mkdtempSync(path.join(tmpdir(), "tmlguide-freshness-"));
  tempRoots.push(directory);
  return directory;
}

/** Writes `files` (relative path -> contents) under a fresh temporary root. */
function fixtureTree(files) {
  const root = makeTempRoot();
  for (const [relative, contents] of Object.entries(files)) {
    const destination = path.join(root, relative);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, contents, "utf8");
  }
  return root;
}

after(() => {
  for (const directory of tempRoots) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** Runs `main` against `root` and collects both streams. */
function runMain(root, argv) {
  const stdout = [];
  const stderr = [];
  const code = main(argv, {
    root,
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
  });
  return { code, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}

/* -------------------------------------------------------------- date maths */

describe("parseIsoDate", () => {
  it("reads a real calendar date", () => {
    const parts = parseIsoDate("2026-11-18");

    assert.deepEqual(
      { year: parts.year, month: parts.month, day: parts.day },
      { year: 2026, month: 11, day: 18 },
    );
  });

  it("reads 29 February in a leap year and refuses it in a common year", () => {
    assert.notEqual(parseIsoDate("2028-02-29"), null);
    assert.equal(parseIsoDate("2027-02-29"), null);
  });

  it("refuses a day that never happened rather than rolling it into the next month", () => {
    assert.equal(parseIsoDate("2027-02-30"), null);
    assert.equal(parseIsoDate("2026-04-31"), null);
    assert.equal(parseIsoDate("2026-13-01"), null);
    assert.equal(parseIsoDate("2026-00-10"), null);
    assert.equal(parseIsoDate("2026-01-00"), null);
  });

  it("refuses anything that is not exactly YYYY-MM-DD", () => {
    for (const value of ["2026-1-8", "26-11-18", "2026/11/18", "2026-11-18 ", " 2026-11-18", "2026-11-18T00:00:00Z", ""]) {
      assert.equal(parseIsoDate(value), null, `${JSON.stringify(value)} should be refused`);
    }
  });

  it("refuses a value that is not a string", () => {
    for (const value of [null, undefined, 20261118, {}, [], new Date(0)]) {
      assert.equal(parseIsoDate(value), null);
    }
  });

  it("is exposed through isIsoDate as the same test", () => {
    assert.equal(isIsoDate("2026-11-18"), true);
    assert.equal(isIsoDate("2026-02-30"), false);
  });
});

describe("ageInDays", () => {
  it("is zero on the day the fact was checked, whatever the clock time", () => {
    assert.equal(ageInDays("2026-11-18", "2026-11-18"), 0);
  });

  it("counts whole calendar days", () => {
    assert.equal(ageInDays("2026-11-18", "2026-11-19"), 1);
    assert.equal(ageInDays("2026-11-18", "2026-11-26"), 8);
    assert.equal(ageInDays("2026-11-18", "2027-11-18"), 365);
  });

  it("counts across a leap day", () => {
    assert.equal(ageInDays("2028-02-28", "2028-03-01"), 2);
  });

  it("returns a negative number for a future date instead of clamping to zero", () => {
    assert.equal(ageInDays("2026-12-01", "2026-11-26"), -5);
  });

  it("throws a RangeError naming the offending value", () => {
    assert.throws(() => ageInDays("2027-02-30", "2026-11-26"), {
      name: "RangeError",
      message: /2027-02-30/,
    });
    assert.throws(() => ageInDays("2026-11-18", "not-a-date"), {
      name: "RangeError",
      message: /not-a-date/,
    });
  });
});

describe("todayUtcIsoDate", () => {
  it("formats the clock's UTC date, not its local date", () => {
    // 23:30 UTC on the 25th is the 26th in Tokyo, so the UTC answer must be
    // taken from the clock rather than the host's time zone.
    const clock = new Date(Date.UTC(2026, 10, 25, 23, 30));

    assert.equal(todayUtcIsoDate(clock), "2026-11-25");
  });

  it("pads a single-digit month and day", () => {
    assert.equal(todayUtcIsoDate(new Date(Date.UTC(2027, 0, 5, 12))), "2027-01-05");
  });

  it("returns today when given no clock", () => {
    assert.equal(todayUtcIsoDate(), todayUtcIsoDate(new Date()));
  });

  it("refuses an invalid clock rather than formatting NaN into a date", () => {
    assert.throws(() => todayUtcIsoDate(new Date("not a date")), RangeError);
  });
});

describe("formatIsoDate", () => {
  it("writes a UK-English date", () => {
    assert.equal(formatIsoDate("2026-11-18"), "18 November 2026");
    assert.equal(formatIsoDate("2027-03-01"), "1 March 2027");
  });

  it("returns an unreadable value unchanged rather than inventing a date", () => {
    assert.equal(formatIsoDate("soon"), "soon");
  });
});

/* ------------------------------------------------------------ field scanner */

describe("findDatedFields", () => {
  it("reads a literal date and reports its line", () => {
    const text = [
      "export const record = {",
      "  id: \"example\",",
      "  lastVerified: \"2026-11-18\",",
      "};",
    ].join("\n");

    const { dated, undated } = findDatedFields(text, { file: "src/data/example.ts" });

    assert.deepEqual(dated, [
      { file: "src/data/example.ts", line: 3, field: "lastVerified", date: "2026-11-18" },
    ]);
    assert.deepEqual(undated, []);
  });

  it("reads all three tracked fields", () => {
    const text = [
      "const a = { lastVerified: \"2026-11-18\" };",
      "const b = { checkedOn: \"2026-11-19\" };",
      "const c = { retrievedOn: \"2026-11-20\" };",
    ].join("\n");

    const { dated } = findDatedFields(text);

    assert.deepEqual(
      dated.map((record) => [record.field, record.date]),
      [
        ["lastVerified", "2026-11-18"],
        ["checkedOn", "2026-11-19"],
        ["retrievedOn", "2026-11-20"],
      ],
    );
  });

  it("resolves a local date constant, which is how nearly every data file writes it", () => {
    const text = [
      "/** When the records below were last opened. */",
      "const CHECKED = \"2026-11-18\";",
      "",
      "export const rows = [",
      "  { id: \"one\", lastVerified: CHECKED },",
      "  { id: \"two\", checkedOn: CHECKED },",
      "  { source: { url: \"https://example.test\", retrievedOn: CHECKED } },",
      "];",
    ].join("\n");

    const { dated, undated } = findDatedFields(text);

    assert.deepEqual(
      dated.map((record) => [record.line, record.field, record.date]),
      [
        [5, "lastVerified", "2026-11-18"],
        [6, "checkedOn", "2026-11-18"],
        [7, "retrievedOn", "2026-11-18"],
      ],
    );
    assert.deepEqual(undated, []);
  });

  it("resolves a constant declared with a type annotation", () => {
    const text = ["const VERIFIED_ON: string = \"2026-11-25\";", "const row = { lastVerified: VERIFIED_ON };"].join("\n");

    const { dated } = findDatedFields(text);

    assert.deepEqual(dated.map((record) => record.date), ["2026-11-25"]);
  });

  it("reports a value it cannot follow as undated rather than silently dropping it", () => {
    const text = [
      "function make(verifiedOn: string) {",
      "  return { lastVerified: verifiedOn, retrievedOn: seed.date };",
      "}",
    ].join("\n");

    const { dated, undated } = findDatedFields(text);

    assert.deepEqual(dated, []);
    assert.deepEqual(
      undated.map((entry) => [entry.line, entry.field, entry.expression]),
      [
        [2, "lastVerified", "verifiedOn"],
        [2, "retrievedOn", "seed"],
      ],
    );
  });

  it("reports a function call it cannot evaluate as undated", () => {
    const text = [
      "const record = parseSaleBannerRecord({",
      "  lastVerified: isoCalendarDate(source.lastVerified, \"lastVerified\"),",
      "});",
    ].join("\n");

    const { dated, undated } = findDatedFields(text);

    assert.deepEqual(dated, []);
    assert.deepEqual(
      undated.map((entry) => entry.expression),
      ["isoCalendarDate(…)"],
    );
  });

  it("names the constructed shape of a value it cannot read", () => {
    const text = [
      "const rows = [",
      "  { lastVerified: new Date(0).toISOString() },",
      "  { checkedOn: build.checkedOn() },",
      "];",
    ].join("\n");

    const { undated } = findDatedFields(text);

    assert.deepEqual(
      undated.map((entry) => entry.expression),
      ["new Date(…)", "build.checkedOn(…)"],
    );
  });

  it("reports a template literal with a substitution as undated", () => {
    const { dated, undated } = findDatedFields("const row = { lastVerified: `${YEAR}-11-18` };");

    assert.deepEqual(dated, []);
    assert.equal(undated.length, 1);
  });

  it("reports a literal that is not a real calendar date as undated", () => {
    const { dated, undated } = findDatedFields("const row = { lastVerified: \"2027-02-30\" };");

    assert.deepEqual(dated, []);
    assert.deepEqual(undated.map((entry) => entry.expression), ["\"2027-02-30\""]);
  });

  it("ignores a schema declaration, which names a date type instead of holding a date", () => {
    const text = [
      "export const verifiedBase = z.strictObject({",
      "  source: sourceSchema,",
      "  lastVerified: isoDateSchema,",
      "  retrievedOn: isoDate,",
      "});",
      "export function isStale(lastVerified: string, now: Date): boolean {",
      "  return false;",
      "}",
      "interface SaleBannerRecord { readonly lastVerified: string }",
    ].join("\n");

    const { dated, undated } = findDatedFields(text);

    assert.deepEqual(dated, []);
    assert.deepEqual(undated, []);
  });

  it("ignores a field name inside a comment", () => {
    const text = [
      "// A record carries lastVerified: \"2020-01-01\", which is documentation.",
      "/**",
      " * Move lastVerified: \"2019-01-01\" forward after a re-check.",
      " */",
      "const row = { lastVerified: \"2026-11-18\" };",
    ].join("\n");

    const { dated } = findDatedFields(text);

    assert.deepEqual(dated.map((record) => record.date), ["2026-11-18"]);
  });

  it("ignores a field name inside a string literal", () => {
    const text = [
      "const message = \"expected lastVerified: 2026-01-01 on every record\";",
      "const row = { lastVerified: \"2026-11-18\" };",
    ].join("\n");

    const { dated } = findDatedFields(text);

    assert.deepEqual(dated.map((record) => record.line), [2]);
  });

  it("does not misread a quote inside a regular expression as the start of a string", () => {
    const text = [
      "const QUOTED = /[\"']/;",
      "const row = { lastVerified: \"2026-11-18\" };",
      "const division = total / count;",
      "const other = { checkedOn: \"2026-11-19\" };",
    ].join("\n");

    const { dated } = findDatedFields(text);

    assert.deepEqual(
      dated.map((record) => [record.line, record.field]),
      [
        [2, "lastVerified"],
        [4, "checkedOn"],
      ],
    );
  });

  it("treats a URL inside a string as data, not as a comment", () => {
    const text = [
      "const source = {",
      "  url: \"https://winter.tomorrowland.com/en/practical/opening-hours/\",",
      "  retrievedOn: \"2026-11-18\",",
      "};",
    ].join("\n");

    const { dated } = findDatedFields(text);

    assert.deepEqual(dated.map((record) => [record.line, record.field, record.date]), [
      [3, "retrievedOn", "2026-11-18"],
    ]);
  });

  it("ignores an escaped quote inside a string", () => {
    const text = [
      "const title = 'Alpe d\\'Huez: parking';",
      "const row = { lastVerified: \"2026-11-18\" };",
    ].join("\n");

    const { dated } = findDatedFields(text);

    assert.deepEqual(dated.map((record) => record.line), [2]);
  });

  it("requires a colon, so prose about a field is not a field", () => {
    const text = [
      "const note = { checkedOnButNotReally: 1 };",
      "// checkedOn is described in the guide.",
      "const row = { checkedOn: \"2026-11-18\" };",
    ].join("\n");

    const { dated } = findDatedFields(text);

    assert.deepEqual(dated.map((record) => record.line), [3]);
  });

  it("counts one record per field occurrence in a list of many records", () => {
    const text = [
      "export const rows = [",
      "  { lastVerified: \"2026-11-18\" },",
      "  { lastVerified: \"2026-11-18\" },",
      "  { lastVerified: \"2026-11-25\" },",
      "];",
    ].join("\n");

    const { dated } = findDatedFields(text);

    assert.equal(dated.length, 3);
    assert.deepEqual(dated.map((record) => record.line), [2, 3, 4]);
  });

  it("returns nothing for a file with no tracked fields", () => {
    const { dated, undated } = findDatedFields("export const value = 1;\n");

    assert.deepEqual(dated, []);
    assert.deepEqual(undated, []);
  });

  it("labels records with a placeholder when no file is given", () => {
    const { dated } = findDatedFields("const row = { lastVerified: \"2026-11-18\" };");

    assert.equal(dated[0].file, "<text>");
  });

  it("rejects a non-string argument", () => {
    assert.throws(() => findDatedFields(null), TypeError);
    assert.throws(() => findDatedFields(Buffer.from("x")), TypeError);
  });

  it("names the tracked fields it looks for", () => {
    assert.deepEqual([...TRACKED_FIELDS], ["lastVerified", "checkedOn", "retrievedOn"]);
  });
});

/* -------------------------------------------------------------- file walker */

describe("collectSourceFiles", () => {
  it("reads .ts files under the scan roots and skips tests", () => {
    const root = fixtureTree({
      "src/data/one.ts": "export const a = 1;\n",
      "src/data/nested/two.ts": "export const b = 2;\n",
      "src/data/one.test.ts": "export const c = 3;\n",
      "src/data/types.d.ts": "export type T = string;\n",
      "src/content/chapter.ts": "export const d = 4;\n",
      "src/content/notes.md": "not code\n",
      "src/lib/ignored.ts": "export const e = 5;\n",
    });

    const files = collectSourceFiles(root).map((file) => path.relative(root, file).split(path.sep).join("/"));

    assert.deepEqual(files, ["src/content/chapter.ts", "src/data/nested/two.ts", "src/data/one.ts"]);
  });

  it("skips a folder that does not exist but still reads the other root", () => {
    const root = fixtureTree({ "src/data/one.ts": "export const a = 1;\n" });

    const files = collectSourceFiles(root);

    assert.equal(files.length, 1);
  });

  it("throws when neither scan root exists, rather than reporting a clean run", () => {
    const root = makeTempRoot();

    assert.throws(() => collectSourceFiles(root), /None of the scan folders exist/);
    assert.deepEqual([...SCAN_ROOTS], ["src/data", "src/content"]);
  });
});

/* ------------------------------------------------------------------- report */

/** A dated record with only the fields the report reads. */
function record(file, line, field, date) {
  return { file, line, field, date };
}

describe("buildReport", () => {
  it("counts the records and finds the extremes", () => {
    const report = buildReport({
      datedRecords: [
        record("src/a.ts", 1, "lastVerified", "2026-11-18"),
        record("src/b.ts", 2, "checkedOn", "2026-08-01"),
        record("src/c.ts", 3, "retrievedOn", "2026-11-25"),
      ],
      asOf: "2026-11-26",
      maxAgeDays: 90,
    });

    assert.equal(report.total, 3);
    assert.deepEqual(report.oldest, { date: "2026-08-01", ageDays: 117 });
    assert.deepEqual(report.newest, { date: "2026-11-25", ageDays: 1 });
    // 117 days is past a 90-day window, so one of the three is stale.
    assert.equal(report.stale.length, 1);
    assert.equal(report.stale[0].file, "src/b.ts");
    assert.equal(report.ok, false);
  });

  it("treats the window as inclusive, so exactly maxAgeDays old is still fresh", () => {
    const onTheLimit = buildReport({
      datedRecords: [record("src/a.ts", 1, "lastVerified", "2026-08-28")],
      asOf: "2026-11-26",
      maxAgeDays: 90,
    });
    const onePast = buildReport({
      datedRecords: [record("src/a.ts", 1, "lastVerified", "2026-08-27")],
      asOf: "2026-11-26",
      maxAgeDays: 90,
    });

    assert.equal(onTheLimit.stale.length, 0);
    assert.equal(onTheLimit.ok, true);
    assert.equal(onePast.stale.length, 1);
    assert.equal(onePast.stale[0].ageDays, 91);
    assert.equal(onePast.ok, false);
  });

  it("lists the stalest record first, then by file and line", () => {
    const report = buildReport({
      datedRecords: [
        record("src/b.ts", 9, "checkedOn", "2026-01-01"),
        record("src/z.ts", 4, "lastVerified", "2025-06-01"),
        record("src/a.ts", 7, "lastVerified", "2026-01-01"),
        record("src/a.ts", 2, "lastVerified", "2026-01-01"),
        record("src/a.ts", 50, "retrievedOn", "2026-11-20"),
      ],
      asOf: "2026-11-26",
      maxAgeDays: 30,
    });

    assert.deepEqual(
      report.stale.map((entry) => `${entry.file}:${entry.line}`),
      ["src/z.ts:4", "src/a.ts:2", "src/a.ts:7", "src/b.ts:9"],
    );
    assert.equal(report.stale.length, 4);
  });

  it("keeps future-dated records out of the stale list and counts them separately", () => {
    const report = buildReport({
      datedRecords: [record("src/a.ts", 1, "lastVerified", "2027-01-01")],
      asOf: "2026-11-26",
      maxAgeDays: 90,
    });

    assert.equal(report.stale.length, 0);
    assert.equal(report.future.length, 1);
    assert.equal(report.future[0].ageDays, -36);
  });

  it("reports no extremes for an empty scan without throwing", () => {
    const report = buildReport({ datedRecords: [], asOf: "2026-11-26", maxAgeDays: 90 });

    assert.equal(report.total, 0);
    assert.equal(report.oldest, null);
    assert.equal(report.newest, null);
    assert.equal(report.ok, true);
  });

  it("carries the undated fields through to the report", () => {
    const report = buildReport({
      datedRecords: [],
      undatedFields: [{ file: "src/a.ts", line: 4, field: "lastVerified", expression: "seed" }],
      asOf: "2026-11-26",
      maxAgeDays: 90,
    });

    assert.equal(report.undatedFields.length, 1);
  });

  it("refuses an impossible reference date or a window below one day", () => {
    assert.throws(() => buildReport({ datedRecords: [], asOf: "2027-02-30", maxAgeDays: 90 }), RangeError);
    assert.throws(() => buildReport({ datedRecords: [], asOf: "2026-11-26", maxAgeDays: 0 }), RangeError);
    assert.throws(() => buildReport({ datedRecords: [], asOf: "2026-11-26", maxAgeDays: 1.5 }), RangeError);
  });
});

describe("exitCodeFor", () => {
  const stale = buildReport({
    datedRecords: [record("src/a.ts", 1, "lastVerified", "2026-01-01")],
    asOf: "2026-11-26",
    maxAgeDays: 30,
  });
  const fresh = buildReport({
    datedRecords: [record("src/a.ts", 1, "lastVerified", "2026-11-25")],
    asOf: "2026-11-26",
    maxAgeDays: 30,
  });

  it("fails only when --strict is set and a record is stale", () => {
    assert.equal(exitCodeFor(stale, { strict: true }), 1);
    assert.equal(exitCodeFor(stale, { strict: false }), 0);
    assert.equal(exitCodeFor(stale), 0);
  });

  it("passes a fresh scan either way", () => {
    assert.equal(exitCodeFor(fresh, { strict: true }), 0);
    assert.equal(exitCodeFor(fresh, { strict: false }), 0);
  });
});

describe("formatReport", () => {
  const stale = buildReport({
    datedRecords: [
      record("src/data/belgium/tickets.ts", 12, "lastVerified", "2026-06-01"),
      record("src/data/belgium/tickets.ts", 30, "retrievedOn", "2026-11-25"),
    ],
    asOf: "2026-11-26",
    maxAgeDays: 90,
  });

  it("states the totals, the extremes and the window", () => {
    const text = formatReport(stale);

    assert.match(text, /TMLGUIDE fact freshness check/);
    assert.match(text, /Dated records\s+2/);
    assert.match(text, /Review window\s+90 days/);
    assert.match(text, /Oldest record\s+1 June 2026 \(178 days old\)/);
    assert.match(text, /Newest record\s+25 November 2026 \(1 day old\)/);
  });

  it("lists each stale record with its file, line, field, date and age", () => {
    const text = formatReport(stale);

    assert.match(text, /1 of 2 dated record is older than the 90-day review window/);
    assert.match(text, /src\/data\/belgium\/tickets\.ts\s+12\s+lastVerified\s+2026-06-01\s+178/);
    assert.doesNotMatch(text, /2026-11-25\s+1/);
  });

  it("uses the plural for more than one stale record", () => {
    const both = buildReport({
      datedRecords: [
        record("src/a.ts", 1, "lastVerified", "2026-01-01"),
        record("src/b.ts", 2, "checkedOn", "2026-01-02"),
      ],
      asOf: "2026-11-26",
      maxAgeDays: 30,
    });

    assert.match(formatReport(both), /2 of 2 dated records are older than the 30-day review window/);
  });

  it("uses the singular for a one-day window and a one-day age", () => {
    const report = buildReport({
      datedRecords: [record("src/a.ts", 1, "lastVerified", "2026-11-25")],
      asOf: "2026-11-26",
      maxAgeDays: 1,
    });
    const text = formatReport(report);

    assert.match(text, /Review window\s+1 day/);
    assert.match(text, /Newest record\s+25 November 2026 \(1 day old\)/);
  });

  it("says what to do, and why the run did not fail", () => {
    assert.match(formatReport(stale), /Pass --strict to make this exit 1\./);
    assert.match(formatReport(stale, { strict: true }), /Exiting 1 because --strict is set\./);
  });

  it("reports a clean scan in one sentence", () => {
    const fresh = buildReport({
      datedRecords: [record("src/a.ts", 1, "lastVerified", "2026-11-25")],
      asOf: "2026-11-26",
      maxAgeDays: 90,
    });

    assert.match(formatReport(fresh), /All 1 dated record is within the 90-day review window\./);
  });

  it("refuses to call an empty scan a pass", () => {
    const empty = buildReport({ datedRecords: [], asOf: "2026-11-26", maxAgeDays: 90 });

    assert.match(formatReport(empty), /No dated records were found/);
    assert.match(formatReport(empty), /not a pass/);
  });

  it("counts an undated field and a future date in the header", () => {
    const report = buildReport({
      datedRecords: [record("src/a.ts", 1, "lastVerified", "2027-01-01")],
      undatedFields: [{ file: "src/b.ts", line: 2, field: "retrievedOn", expression: "seed" }],
      asOf: "2026-11-26",
      maxAgeDays: 90,
    });
    const text = formatReport(report);

    assert.match(text, /Undated fields\s+1/);
    assert.match(text, /Future-dated\s+1/);
  });
});

describe("toJson", () => {
  it("is a stable, parseable summary of the report", () => {
    const report = buildReport({
      datedRecords: [record("src/a.ts", 4, "lastVerified", "2026-01-01")],
      undatedFields: [{ file: "src/b.ts", line: 2, field: "retrievedOn", expression: "seed" }],
      filesScanned: 3,
      asOf: "2026-11-26",
      maxAgeDays: 30,
    });

    const payload = JSON.parse(JSON.stringify(toJson(report, { strict: true })));

    assert.equal(payload.tool, "fact-freshness");
    assert.equal(payload.asOf, "2026-11-26");
    assert.equal(payload.maxAgeDays, 30);
    assert.equal(payload.strict, true);
    assert.equal(payload.filesScanned, 3);
    assert.equal(payload.datedRecords, 1);
    assert.equal(payload.staleCount, 1);
    assert.equal(payload.ok, false);
    assert.deepEqual(payload.stale, [
      { file: "src/a.ts", line: 4, field: "lastVerified", date: "2026-01-01", ageDays: 329 },
    ]);
    assert.equal(payload.undatedCount, 1);
    assert.deepEqual(payload.undated, [
      { file: "src/b.ts", line: 2, field: "retrievedOn", expression: "seed" },
    ]);
  });
});

/* -------------------------------------------------------- argument handling */

describe("parseArgs", () => {
  it("uses the documented defaults when given no arguments", () => {
    const options = parseArgs([]);

    assert.equal(options.maxAgeDays, DEFAULT_MAX_AGE_DAYS);
    assert.equal(DEFAULT_MAX_AGE_DAYS, 90);
    assert.equal(options.asOf, null);
    assert.equal(options.strict, false);
    assert.equal(options.json, false);
    assert.equal(options.help, false);
  });

  it("reads every flag", () => {
    const options = parseArgs(["--max-age-days=30", "--as-of=2026-11-26", "--strict", "--json"]);

    assert.equal(options.maxAgeDays, 30);
    assert.equal(options.asOf, "2026-11-26");
    assert.equal(options.strict, true);
    assert.equal(options.json, true);
  });

  it("accepts a window of one day and of any larger whole number", () => {
    assert.equal(parseArgs(["--max-age-days=1"]).maxAgeDays, 1);
    assert.equal(parseArgs(["--max-age-days=3650"]).maxAgeDays, 3650);
  });

  it("accepts -h and --help", () => {
    assert.equal(parseArgs(["-h"]).help, true);
    assert.equal(parseArgs(["--help"]).help, true);
  });

  it("refuses a window of zero, a negative window, a fraction and a non-number", () => {
    for (const value of ["0", "-1", "1.5", "abc", "", " ", "90days", "1e3", "0x10", "90.0"]) {
      assert.throws(
        () => parseArgs([`--max-age-days=${value}`]),
        (error) => error instanceof UsageError && /--max-age-days/.test(error.message),
        `--max-age-days=${value} should be refused`,
      );
    }
  });

  it("refuses a window without a value", () => {
    assert.throws(() => parseArgs(["--max-age-days"]), UsageError);
    assert.throws(() => parseArgs(["--max-age-days="]), UsageError);
  });

  it("refuses an impossible or badly written reference date", () => {
    for (const value of ["2027-02-30", "26-11-2026", "2026/11/26", "", "today", "2026-11-26T00:00:00Z"]) {
      assert.throws(
        () => parseArgs([`--as-of=${value}`]),
        (error) => error instanceof UsageError && /--as-of/.test(error.message),
        `--as-of=${value} should be refused`,
      );
    }
  });

  it("refuses a reference date without a value", () => {
    assert.throws(() => parseArgs(["--as-of"]), UsageError);
    assert.throws(() => parseArgs(["--as-of="]), UsageError);
  });

  it("refuses an unknown flag rather than ignoring it", () => {
    assert.throws(() => parseArgs(["--max-age=30"]), UsageError);
    assert.throws(() => parseArgs(["--strict=true"]), UsageError);
    assert.throws(() => parseArgs(["strict"]), UsageError);
    assert.throws(() => parseArgs(["-x"]), UsageError);
  });

  it("names the help flag in the message, so the reader can find the list", () => {
    assert.throws(() => parseArgs(["--nope"]), /Use --help for the list/);
  });

  it("stops at the first bad argument", () => {
    assert.throws(() => parseArgs(["--strict", "--bad", "--max-age-days=0"]), /Unrecognised argument "--bad"/);
  });
});

/* --------------------------------------------------------------- whole run */

/** A fixture tree whose single dated record is well past any short window. */
function staleTree() {
  return fixtureTree({
    "src/data/example.ts": [
      "const CHECKED = \"2026-06-01\";",
      "export const records = [",
      "  { id: \"one\", lastVerified: CHECKED },",
      "  { id: \"two\", lastVerified: \"2026-11-25\" },",
      "];",
    ].join("\n"),
  });
}

describe("main", () => {
  it("prints the report and exits 0 without --strict, however stale the facts are", () => {
    const root = staleTree();

    const { code, stdout, stderr } = runMain(root, ["--as-of=2026-11-26", "--max-age-days=30"]);

    assert.equal(code, 0);
    assert.match(stdout, /Dated records\s+2/);
    assert.match(stdout, /src\/data\/example\.ts\s+3\s+lastVerified\s+2026-06-01\s+178/);
    assert.match(stdout, /Pass --strict to make this exit 1\./);
    assert.equal(stderr, "");
  });

  it("exits 1 with --strict when a record is stale", () => {
    const root = staleTree();

    const { code, stdout } = runMain(root, ["--as-of=2026-11-26", "--max-age-days=30", "--strict"]);

    assert.equal(code, 1);
    assert.match(stdout, /Exiting 1 because --strict is set\./);
  });

  it("exits 0 with --strict when every record is inside the window", () => {
    const root = fixtureTree({
      "src/data/example.ts": [
        "const CHECKED = \"2026-11-18\";",
        "export const records = [",
        "  { id: \"one\", lastVerified: CHECKED },",
        "  { id: \"two\", lastVerified: \"2026-11-25\" },",
        "];",
      ].join("\n"),
    });

    const { code, stdout } = runMain(root, ["--as-of=2026-11-26", "--max-age-days=90", "--strict"]);

    assert.equal(code, 0);
    assert.match(stdout, /All 2 dated records are within the 90-day review window/);
  });

  it("exits 0 with --strict when the window is wide enough for the oldest record", () => {
    const root = staleTree();

    // 2026-06-01 to 2026-11-26 is 178 days, so 178 is exactly on the limit.
    assert.equal(runMain(root, ["--as-of=2026-11-26", "--max-age-days=178", "--strict"]).code, 0);
    assert.equal(runMain(root, ["--as-of=2026-11-26", "--max-age-days=177", "--strict"]).code, 1);
  });

  it("prints parseable JSON with --json", () => {
    const root = staleTree();

    const { code, stdout } = runMain(root, ["--as-of=2026-11-26", "--max-age-days=30", "--json", "--strict"]);
    const payload = JSON.parse(stdout);

    assert.equal(code, 1);
    assert.equal(payload.datedRecords, 2);
    assert.equal(payload.staleCount, 1);
    assert.equal(payload.filesScanned, 1);
    assert.equal(payload.strict, true);
    assert.equal(payload.stale[0].file, "src/data/example.ts");
  });

  it("exits 2 and prints the help text for a bad flag", () => {
    const root = staleTree();

    const { code, stdout, stderr } = runMain(root, ["--max-age-days=0"]);

    assert.equal(code, 2);
    assert.equal(stdout, "");
    assert.match(stderr, /--max-age-days must be a whole number of days, at least 1/);
    assert.match(stderr, /Usage/);
  });

  it("exits 2 when the scan roots are missing, rather than reporting a clean run", () => {
    const root = makeTempRoot();

    const { code, stderr } = runMain(root, ["--as-of=2026-11-26"]);

    assert.equal(code, 2);
    assert.match(stderr, /None of the scan folders exist/);
  });

  it("prints the help text and exits 0 for --help", () => {
    const root = staleTree();

    const { code, stdout } = runMain(root, ["--help"]);

    assert.equal(code, 0);
    assert.match(stdout, /--max-age-days=<days>/);
    assert.match(stdout, /--as-of=<YYYY-MM-DD>/);
    assert.match(stdout, /--strict/);
  });

  it("warns on stderr when a scan finds no dated records", () => {
    const root = fixtureTree({ "src/data/empty.ts": "export const nothing = 1;\n" });

    const { code, stdout, stderr } = runMain(root, ["--as-of=2026-11-26", "--strict"]);

    assert.equal(code, 0);
    assert.match(stdout, /No dated records were found/);
    assert.match(stderr, /no dated records were found/);
  });

  it("defaults the reference date to today in UTC", () => {
    const root = staleTree();
    const today = todayUtcIsoDate();

    const { stdout } = runMain(root, ["--json"]);
    const payload = JSON.parse(stdout);

    assert.equal(payload.asOf, today);
  });
});

/* -------------------------------------------------------------- live scan */

describe("the repository's own data", () => {
  it("finds dated records under src/data and src/content", () => {
    const scanned = scanRecords({ root: REPO_ROOT });

    assert.ok(scanned.files.length > 0, "no source files were scanned");
    assert.ok(
      scanned.datedRecords.length > 0,
      "no dated records were found; the tracked field names or the scan paths may have changed",
    );
    for (const entry of scanned.datedRecords) {
      assert.ok(isIsoDate(entry.date), `${entry.file}:${entry.line} carries ${entry.date}`);
      assert.ok(TRACKED_FIELDS.includes(entry.field), `${entry.file}:${entry.line} names ${entry.field}`);
      assert.match(entry.file, /^src\/(data|content)\//);
    }
  });

  it("reports the same totals through the full report as through the scan", () => {
    const scanned = scanRecords({ root: REPO_ROOT });
    const report = buildReport({
      datedRecords: scanned.datedRecords,
      undatedFields: scanned.undatedFields,
      filesScanned: scanned.files.length,
      asOf: todayUtcIsoDate(),
      maxAgeDays: DEFAULT_MAX_AGE_DAYS,
    });

    assert.equal(report.total, scanned.datedRecords.length);
    assert.equal(report.undatedFields.length, scanned.undatedFields.length);
    assert.equal(report.filesScanned, scanned.files.length);
    assert.equal(report.records.length, report.total);
  });
});
