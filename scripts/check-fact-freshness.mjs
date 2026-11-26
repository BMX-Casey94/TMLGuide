#!/usr/bin/env node
/**
 * Editorial fact-freshness check.
 *
 * Every fact in the guide carries the date it was last read from its official
 * source: `lastVerified` on a record, `checkedOn` on a chapter or source entry,
 * `retrievedOn` on a source object. Those dates are the review schedule. A fact
 * that was checked in November is not evidence about March, and nothing in the
 * type system stops a date from ageing, so this script reads the dates out of
 * the source and reports the ones past their review window.
 *
 *   node scripts/check-fact-freshness.mjs
 *   node scripts/check-fact-freshness.mjs --max-age-days=30 --strict
 *   node scripts/check-fact-freshness.mjs --as-of=2026-11-26 --json
 *
 * ## What counts as a record
 *
 * One dated field occurrence is one record. A file that stamps `lastVerified`
 * on forty records contributes forty records; a factory that stamps one field
 * inside a helper contributes one, because the dates it writes come from
 * arguments this script cannot follow without executing the module. That gap is
 * visible rather than silent: a tracked field whose value is not a readable
 * date is counted as undated and named in both the report and `--json`.
 *
 * A value written as `"2026-11-18"` is read directly. A value written as a
 * constant — `lastVerified: CHECKED` where `const CHECKED = "2026-11-18"` sits
 * in the same file — is resolved through that constant, because nearly every
 * data file in this repository uses one. Constants imported from another module
 * are not followed: this script reads text, it does not run the code.
 *
 * Field names inside comments and inside string literals are ignored, so a
 * JSDoc example or an error message that mentions `lastVerified: "…"` is not
 * mistaken for a fact.
 *
 * ## Flags
 *
 * | Flag | Meaning |
 * | --- | --- |
 * | `--max-age-days=<n>` | Review window in whole days, at least 1. Default 90. |
 * | `--as-of=<YYYY-MM-DD>` | Reference date. Default: today, UTC. |
 * | `--strict` | Exit 1 when any record is outside the window. |
 * | `--json` | Print the machine-readable summary instead of the report. |
 * | `-h`, `--help` | Usage. |
 *
 * ## Exit codes
 *
 * | Code | Meaning |
 * | --- | --- |
 * | 0 | The run completed. Without `--strict`, staleness is reported, not failed. |
 * | 1 | `--strict` was set and at least one record is older than the window. |
 * | 2 | The run could not start: an unusable argument, or a folder that could not be read. |
 *
 * A scan that finds no dated records exits 0 even under `--strict`, because no
 * record is old. It also writes a warning to stderr: a window of data this
 * script cannot read looks exactly like a clean run, and the two should not be
 * confused in a scheduled job's log.
 *
 * Node built-ins only, so it runs on a clean checkout without `npm install`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** The repository root: this file lives in `scripts/`. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------------ limits */

/** The longest a fact may go unchecked before the report calls it stale. */
export const DEFAULT_MAX_AGE_DAYS = 90;

/** The field names that carry a review date. */
export const TRACKED_FIELDS = Object.freeze(["lastVerified", "checkedOn", "retrievedOn"]);

/** The folders the scan reads, relative to the repository root. */
export const SCAN_ROOTS = Object.freeze(["src/data", "src/content"]);

/** A day of whole calendar dates, in milliseconds. Dates here are UTC midnight. */
const MILLISECONDS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` exactly: no padding shortcuts, no surrounding space. */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTH_NAMES = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

/**
 * Values that name a schema or a type rather than a date.
 *
 * `src/data/schemas` and `src/content/schema.ts` describe the shape of a date
 * field instead of holding one (`lastVerified: isoDateSchema`). Counting those
 * as undated facts would bury the handful of real gaps in noise.
 */
const SCHEMA_VALUE_PATTERN =
  /^(?:z\.[\w$.]+|isoDate|isoDateSchema|isoInstant|isoInstantSchema|string|Date|[A-Za-z_$][\w$]*Schema)$/;

/** A usage problem: an unknown flag, or a value outside the accepted range. */
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

/* --------------------------------------------------------------- date maths */

/**
 * Parses a calendar date and returns its parts, or `null` when it is not one.
 *
 * `2027-02-30` is refused rather than rolled into March: a fact stamped with a
 * day that never happened has a broken review schedule, and quietly reading it
 * as 2 March would hide that.
 */
export function parseIsoDate(value) {
  if (typeof value !== "string") return null;
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const epochMs = Date.UTC(year, month - 1, day);
  const date = new Date(epochMs);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, epochMs, dayNumber: epochMs / MILLISECONDS_PER_DAY };
}

/** True when the string is a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value) {
  return parseIsoDate(value) !== null;
}

/**
 * Whole days from `date` to `asOf`, both `YYYY-MM-DD`.
 *
 * A date is zero days old on the day it was checked, so the answer never
 * depends on the time of day the job happens to run. A date after `asOf`
 * returns a negative number rather than being clamped: a fact dated in the
 * future is a mistake in the data, and the caller is entitled to notice.
 *
 * @throws {RangeError} when either value is not a real calendar date.
 */
export function ageInDays(date, asOf) {
  const from = parseIsoDate(date);
  if (from === null) {
    throw new RangeError(`ageInDays: ${JSON.stringify(date)} is not a calendar date in YYYY-MM-DD form`);
  }
  const to = parseIsoDate(asOf);
  if (to === null) {
    throw new RangeError(`ageInDays: ${JSON.stringify(asOf)} is not a calendar date in YYYY-MM-DD form`);
  }
  return to.dayNumber - from.dayNumber;
}

/**
 * Today's date in UTC, as `YYYY-MM-DD`. The reference date when none is given.
 *
 * @throws {RangeError} when the clock is not a valid Date, rather than
 *   formatting `NaN` into a date that then fails a parse somewhere else.
 */
export function todayUtcIsoDate(clock = new Date()) {
  if (!Number.isFinite(clock?.getTime?.())) {
    throw new RangeError("todayUtcIsoDate: the clock is not a valid Date");
  }
  const year = String(clock.getUTCFullYear()).padStart(4, "0");
  const month = String(clock.getUTCMonth() + 1).padStart(2, "0");
  const day = String(clock.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formats `2026-11-18` as `18 November 2026`. */
export function formatIsoDate(value) {
  const parts = parseIsoDate(value);
  if (parts === null) return value;
  return `${parts.day} ${MONTH_NAMES[parts.month - 1]} ${parts.year}`;
}

/* ------------------------------------------------------------------ parsing */

/** Words after which a `/` opens a regular expression rather than dividing. */
const REGEX_PRECEDING_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "new",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);

/** Characters after which a `/` opens a regular expression rather than dividing. */
const REGEX_PRECEDING_PUNCTUATION = "([{,;:=!&|?+-*%~^<>";

/**
 * Whether the `/` at `index` opens a regular expression.
 *
 * The distinction matters because a pattern such as `/["']/` contains a quote,
 * and a reader that took that quote for the start of a string literal would
 * misplace every string boundary after it. The test is the usual one: look at
 * the previous significant token, which is either punctuation that cannot end
 * an expression, a keyword that expects one, or the start of the file.
 */
function startsRegex(masked, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(masked[cursor])) cursor -= 1;
  if (cursor < 0) return true;

  const character = masked[cursor];
  if (/[\w$]/.test(character)) {
    let start = cursor;
    while (start > 0 && /[\w$]/.test(masked[start - 1])) start -= 1;
    return REGEX_PRECEDING_KEYWORDS.has(masked.slice(start, cursor + 1));
  }
  return REGEX_PRECEDING_PUNCTUATION.includes(character);
}

/**
 * Splits source text into code, and records where each character sits.
 *
 * Comment characters are replaced with spaces but newlines are kept, so every
 * index and therefore every line number still matches the file on disk.
 * `stringMask` marks the characters of string and template literals: a field
 * name inside a quotation mark is part of a value, not a field.
 */
function maskSource(text) {
  const masked = text.split("");
  const stringMask = new Uint8Array(text.length);
  let state = "code";
  let inCharacterClass = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    switch (state) {
      case "code":
        if (character === "/" && next === "/") {
          state = "line-comment";
          masked[index] = " ";
          masked[index + 1] = " ";
          index += 1;
        } else if (character === "/" && next === "*") {
          state = "block-comment";
          masked[index] = " ";
          masked[index + 1] = " ";
          index += 1;
        } else if (character === "/" && startsRegex(masked, index)) {
          state = "regex";
          inCharacterClass = false;
        } else if (character === '"') {
          state = "double-quote";
          stringMask[index] = 1;
        } else if (character === "'") {
          state = "single-quote";
          stringMask[index] = 1;
        } else if (character === "`") {
          state = "template-quote";
          stringMask[index] = 1;
        }
        break;
      case "regex":
        // A pattern is code, not a string: its quotes open nothing. `\` escapes
        // the next character, and a `/` inside `[…]` is a literal slash. The
        // characters are marked non-code so a field name spelled inside a
        // pattern is not mistaken for a property either.
        stringMask[index] = 1;
        if (character === "\\") {
          if (index + 1 < text.length) {
            stringMask[index + 1] = 1;
            index += 1;
          }
        } else if (character === "[") {
          inCharacterClass = true;
        } else if (character === "]") {
          inCharacterClass = false;
        } else if (character === "\n") {
          // An unterminated pattern is a syntax error; stop reading it rather
          // than swallowing the rest of the file.
          state = "code";
        } else if (character === "/" && !inCharacterClass) {
          state = "code";
        }
        break;
      case "line-comment":
        if (character === "\n") {
          state = "code";
        } else {
          masked[index] = " ";
        }
        break;
      case "block-comment":
        if (character === "*" && next === "/") {
          masked[index] = " ";
          masked[index + 1] = " ";
          index += 1;
          state = "code";
        } else if (character !== "\n") {
          masked[index] = " ";
        }
        break;
      case "double-quote":
      case "single-quote":
      case "template-quote": {
        const terminator =
          state === "double-quote" ? '"' : state === "single-quote" ? "'" : "`";
        stringMask[index] = 1;
        if (character === "\\") {
          if (index + 1 < text.length) {
            stringMask[index + 1] = 1;
            index += 1;
          }
        } else if (character === terminator) {
          state = "code";
        }
        break;
      }
      default:
        break;
    }
  }

  return { masked: masked.join(""), stringMask };
}

/** Offsets of the first character of every line, for index-to-line lookups. */
function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

/** The 1-based line number of a character offset. */
function lineAt(starts, offset) {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low + 1;
}

/**
 * Field names, with the colon that makes them a property rather than prose.
 *
 * Built from `TRACKED_FIELDS` so the pattern and the export cannot drift apart.
 * The lookbehind refuses a match that is the tail of a longer name
 * (`myLastVerified:`) and one that follows a dot (`record.lastVerified:` is a
 * value, not a declaration).
 */
const FIELD_PATTERN = new RegExp(
  `(?<![\\w$.])(${TRACKED_FIELDS.join("|")})[ \\t]*:[ \\t]*`,
  "g",
);

/** `const CHECKED = "2026-11-18";`, with an optional `: string` annotation. */
const CONSTANT_PATTERN =
  /(?:^|\n)[ \t]*(?:export[ \t]+)?const[ \t]+([A-Za-z_$][\w$]*)[ \t]*(?::[^=\n]*?)?[ \t]*=[ \t]*(["'`])(\d{4}-\d{2}-\d{2})\2/g;

/** A string literal at the start of a value expression. */
const LITERAL_PATTERN = /^(["'`])([^"'`\n]*)\1/;

/** An identifier at the start of a value expression. */
const IDENTIFIER_PATTERN = /^([A-Za-z_$][\w$]*)/;

/** How far past the colon to look for the value. Enough for a long call. */
const VALUE_WINDOW = 512;

/**
 * Reads every tracked field in one file.
 *
 * Pure, so the tests can hand it a string and assert on the records: no file
 * system, no clock. `file` is echoed back on each record so a report can name
 * the source of a stale date.
 *
 * @param {string} text - the file's contents.
 * @param {{ file?: string }} [context] - the path to label the records with.
 * @returns {{ dated: Array<{file: string, line: number, field: string, date: string}>,
 *   undated: Array<{file: string, line: number, field: string, expression: string}> }}
 */
export function findDatedFields(text, context = {}) {
  const { file = "<text>" } = context;
  if (typeof text !== "string") throw new TypeError("findDatedFields: text must be a string");

  const { masked, stringMask } = maskSource(text);
  const starts = lineStarts(text);
  const dated = [];
  const undated = [];

  // Local date constants first: a field often names one instead of repeating
  // the date, and the whole point of the constant is that it is written once.
  const constants = new Map();
  CONSTANT_PATTERN.lastIndex = 0;
  for (let match = CONSTANT_PATTERN.exec(masked); match !== null; match = CONSTANT_PATTERN.exec(masked)) {
    // The `const` keyword must be code; a `const` spelled inside a string or a
    // pattern is not a declaration.
    if (stringMask[match.index] === 1) continue;
    const [, name, , date] = match;
    if (!constants.has(name)) constants.set(name, date);
  }

  FIELD_PATTERN.lastIndex = 0;
  for (let match = FIELD_PATTERN.exec(masked); match !== null; match = FIELD_PATTERN.exec(masked)) {
    // A field name inside quotes is data (an error message, a doc example),
    // not a property of a record.
    if (stringMask[match.index] === 1) continue;

    const [, field] = match;
    const line = lineAt(starts, match.index);

    let valueStart = match.index + match[0].length;
    while (valueStart < masked.length && /\s/.test(masked[valueStart])) valueStart += 1;
    // A value is a single expression, not the rest of the file: the window
    // keeps a malformed line from turning the whole file into one "value".
    const value = masked.slice(valueStart, valueStart + VALUE_WINDOW);

    const literal = LITERAL_PATTERN.exec(value);
    if (literal !== null) {
      const [, , raw] = literal;
      // A template literal with a substitution builds its date at run time, so
      // it is not a date this script can vouch for.
      if (parseIsoDate(raw) === null) {
        undated.push({ file, line, field, expression: JSON.stringify(raw.slice(0, 40)) });
      } else {
        dated.push({ file, line, field, date: raw });
      }
      continue;
    }

    const identifier = IDENTIFIER_PATTERN.exec(value);
    if (identifier !== null) {
      const [, name] = identifier;
      const resolved = constants.get(name);
      if (resolved !== undefined) {
        dated.push({ file, line, field, date: resolved });
      } else if (!SCHEMA_VALUE_PATTERN.test(name)) {
        // `isoCalendarDate(source.lastVerified, "lastVerified")` and
        // `new Date(0)` both build a value this script cannot read. Name the
        // shape rather than the first word, so the reader knows to look.
        const call = /^([A-Za-z_$][\w$.]*(?:\s+[A-Za-z_$][\w$.]*)?)\s*\(/.exec(value);
        undated.push({
          file,
          line,
          field,
          expression: call === null ? name : `${call[1]}(…)`,
        });
      }
      continue;
    }

    undated.push({ file, line, field, expression: value.slice(0, 40).trim() });
  }

  return { dated, undated };
}

/* ------------------------------------------------------------------- files */

/** Filesystem errors that mean "nothing here", as opposed to "cannot read this". */
function isMissing(error) {
  return error?.code === "ENOENT" || error?.code === "ENOTDIR";
}

/**
 * Every `.ts` file under the scan roots, sorted for a stable report.
 *
 * Test files are skipped: a fixture date is not a published fact, and a test
 * that deliberately uses an old date would otherwise fail the check forever.
 *
 * A folder that does not exist holds no facts and is skipped. Any other read
 * failure — a permission denied, say — is raised rather than swallowed: a scan
 * that quietly returns fewer records reports a freshness the data does not
 * have.
 *
 * @throws {Error} when no scan root exists, or a folder cannot be read.
 */
export function collectSourceFiles(root, roots = SCAN_ROOTS) {
  const files = [];

  const visit = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return;
      throw new Error(`Could not read ${directory}: ${error.message}`, { cause: error });
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".d.ts")
      ) {
        files.push(full);
      }
    }
  };

  const searched = [];
  for (const relative of roots) {
    const directory = path.join(root, relative);
    let stats;
    try {
      stats = statSync(directory);
    } catch (error) {
      if (isMissing(error)) continue; // A folder that does not exist holds no facts.
      throw new Error(`Could not read ${directory}: ${error.message}`, { cause: error });
    }
    if (!stats.isDirectory()) continue;
    searched.push(directory);
    visit(directory);
  }

  if (searched.length === 0) {
    throw new Error(
      `None of the scan folders exist under ${root}: ${roots.join(", ")}. Run this from the repository root.`,
    );
  }

  return files.sort((left, right) => left.localeCompare(right));
}

/**
 * Scans the repository and returns every record, dated or not.
 *
 * @throws {Error} when none of the scan folders can be read, or a file in them
 *   cannot be read: an unreadable file is a gap in the report, not a zero.
 */
export function scanRecords({ root, roots = SCAN_ROOTS }) {
  const files = collectSourceFiles(root, roots);
  const dated = [];
  const undated = [];

  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch (error) {
      throw new Error(`Could not read ${relative}: ${error.message}`, { cause: error });
    }
    const found = findDatedFields(text, { file: relative });
    dated.push(...found.dated);
    undated.push(...found.undated);
  }

  return {
    files: files.map((file) => path.relative(root, file).split(path.sep).join("/")),
    datedRecords: dated,
    undatedFields: undated,
  };
}

/* ------------------------------------------------------------------ report */

/**
 * Measures every record against the reference date and the review window.
 *
 * The window is inclusive, matching `isStale` in `src/data/schemas`: a record
 * exactly `maxAgeDays` old is still inside its schedule, and only the next day
 * makes it stale.
 *
 * @throws {RangeError} for an unusable reference date or window.
 */
export function buildReport({
  datedRecords,
  undatedFields = [],
  filesScanned = 0,
  roots = SCAN_ROOTS,
  asOf,
  maxAgeDays,
}) {
  if (parseIsoDate(asOf) === null) {
    throw new RangeError(`buildReport: asOf ${JSON.stringify(asOf)} is not a calendar date in YYYY-MM-DD form`);
  }
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1) {
    throw new RangeError(`buildReport: maxAgeDays ${String(maxAgeDays)} must be a whole number of at least 1`);
  }

  const records = datedRecords.map((record) => ({ ...record, ageDays: ageInDays(record.date, asOf) }));

  let oldest = null;
  let newest = null;
  for (const record of records) {
    if (oldest === null || record.date < oldest.date) oldest = record;
    if (newest === null || record.date > newest.date) newest = record;
  }

  const stale = records
    .filter((record) => record.ageDays > maxAgeDays)
    .sort(
      (left, right) =>
        right.ageDays - left.ageDays ||
        left.file.localeCompare(right.file) ||
        left.line - right.line,
    );

  const future = records
    .filter((record) => record.ageDays < 0)
    .sort((left, right) => left.date.localeCompare(right.date) || left.file.localeCompare(right.file));

  return {
    roots: [...roots],
    asOf,
    maxAgeDays,
    filesScanned,
    total: records.length,
    records,
    undatedFields: [...undatedFields],
    oldest: oldest === null ? null : { date: oldest.date, ageDays: oldest.ageDays },
    newest: newest === null ? null : { date: newest.date, ageDays: newest.ageDays },
    stale,
    future,
    ok: stale.length === 0,
  };
}

/** The exit code the report implies: 1 only when `--strict` asks for it. */
export function exitCodeFor(report, { strict = false } = {}) {
  return strict && report.stale.length > 0 ? 1 : 0;
}

/** The `--json` payload. Stable keys, no prose, so a job can diff it. */
export function toJson(report, { strict = false } = {}) {
  return {
    tool: "fact-freshness",
    asOf: report.asOf,
    maxAgeDays: report.maxAgeDays,
    strict,
    scanRoots: report.roots,
    filesScanned: report.filesScanned,
    datedRecords: report.total,
    oldest: report.oldest,
    newest: report.newest,
    staleCount: report.stale.length,
    ok: report.ok,
    stale: report.stale.map((record) => ({
      file: record.file,
      line: record.line,
      field: record.field,
      date: record.date,
      ageDays: record.ageDays,
    })),
    futureCount: report.future.length,
    future: report.future.map((record) => ({
      file: record.file,
      line: record.line,
      field: record.field,
      date: record.date,
      ageDays: record.ageDays,
    })),
    undatedCount: report.undatedFields.length,
    undated: report.undatedFields.map((entry) => ({
      file: entry.file,
      line: entry.line,
      field: entry.field,
      expression: entry.expression,
    })),
  };
}

/** The widest the file column grows before a path is shortened. */
const MAX_FILE_WIDTH = 48;

/** Shortens a path from the left, keeping the edition folder and file name. */
function shortenPath(value, width) {
  if (value.length <= width) return value;
  return `…${value.slice(value.length - (width - 1))}`;
}

/** Pads a cell to a fixed width, shortening a long path rather than a number. */
function cell(value, width, { align = "left", path = false } = {}) {
  const text = path ? shortenPath(String(value), width) : String(value);
  return align === "right" ? text.padStart(width) : text.padEnd(width);
}

/** The most lines a note list shows before it defers to `--json`. */
const MAX_NOTE_LINES = 10;

/** The most rows the printed table shows before it defers to `--json`. */
const MAX_TABLE_ROWS = 50;

/**
 * An indented list of one-line notes, aligned under a report label.
 *
 * Capped: a header that lists 867 lines buries the summary it is meant to
 * qualify. The cap applies to the notes only, never to the stale table's count,
 * which always states the true total.
 */
function formatNoteList(notes) {
  const shown = notes.slice(0, MAX_NOTE_LINES).map((note) => `  ${" ".repeat(17)}${note}`);
  if (notes.length > MAX_NOTE_LINES) {
    shown.push(`  ${" ".repeat(17)}… and ${notes.length - MAX_NOTE_LINES} more. Use --json for the complete list.`);
  }
  return shown;
}

/** The five printed columns of a record, as strings. */
function recordCells(record) {
  return [record.file, String(record.line), record.field, record.date, String(record.ageDays)];
}

/** Pads, shortens and right-aligns one row of cells to the column widths. */
function tableLine(values, widths) {
  return values
    .map((value, column) =>
      cell(value, widths[column], {
        align: column === 0 || column === 2 ? "left" : "right",
        path: column === 0,
      }),
    )
    .join("  ")
    .trimEnd();
}

/**
 * A file / line / field / date / age table.
 *
 * `allRecords` sets the column widths, so a table truncated to its first rows
 * keeps the same alignment it would have had in full.
 */
function formatRecordTable(records, allRecords = records) {
  const headers = ["File", "Line", "Field", "Date", "Age (days)"];
  const widths = headers.map((header, column) => {
    const widest = Math.max(header.length, ...allRecords.map((record) => recordCells(record)[column].length));
    return column === 0 ? Math.min(widest, MAX_FILE_WIDTH) : widest;
  });

  return [headers, ...records.map(recordCells)].map((values) => `  ${tableLine(values, widths)}`);
}

/** `1 day` / `2 days`, so the report reads as English rather than as a template. */
function plural(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

/** "8 days old", or "3 days ahead" when a date sits after the reference date. */
function describeAge(ageDays) {
  return ageDays < 0 ? `${plural(-ageDays, "day")} ahead` : `${plural(ageDays, "day")} old`;
}

/**
 * The human report.
 *
 * UK English, one screen where possible, and every stale row carries the four
 * things needed to act: which file, which line, which field, how old.
 */
export function formatReport(report, { strict = false } = {}) {
  const rows = [];
  const label = (name) => `  ${name.padEnd(17)}`;

  rows.push("TMLGUIDE fact freshness check");
  rows.push("");
  rows.push(`${label("Scanned")}${report.roots.join(", ")}`);
  rows.push(`${label("Files")}${report.filesScanned}`);
  rows.push(`${label("Dated records")}${report.total}`);
  rows.push(`${label("Reference date")}${formatIsoDate(report.asOf)}`);
  rows.push(`${label("Review window")}${plural(report.maxAgeDays, "day")}`);

  if (report.oldest !== null && report.newest !== null) {
    rows.push(`${label("Oldest record")}${formatIsoDate(report.oldest.date)} (${describeAge(report.oldest.ageDays)})`);
    rows.push(`${label("Newest record")}${formatIsoDate(report.newest.date)} (${describeAge(report.newest.ageDays)})`);
  }

  if (report.undatedFields.length > 0) {
    rows.push(
      `${label("Undated fields")}${report.undatedFields.length} (tracked names with a value that is not a readable date)`,
    );
    rows.push(...formatNoteList(report.undatedFields.map((entry) => `${entry.file}:${entry.line}  ${entry.field} = ${entry.expression}`)));
  }
  if (report.future.length > 0) {
    rows.push(
      `${label("Future-dated")}${report.future.length} (dated after the reference date; check the data or --as-of)`,
    );
    rows.push(...formatNoteList(report.future.map((entry) => `${entry.file}:${entry.line}  ${entry.field} = ${entry.date}`)));
  }

  rows.push("");

  if (report.total === 0) {
    rows.push("  No dated records were found. A scan that reads nothing is not a pass: check the paths and the field names.");
    return rows.join("\n");
  }

  if (report.stale.length === 0) {
    const noun = report.total === 1 ? "record is" : "records are";
    rows.push(`  All ${report.total} dated ${noun} within the ${report.maxAgeDays}-day review window.`);
    return rows.join("\n");
  }

  const staleWord = report.stale.length === 1 ? "record is" : "records are";
  rows.push(
    `  ${report.stale.length} of ${report.total} dated ${staleWord} older than the ${report.maxAgeDays}-day review window:`,
  );
  rows.push("");
  rows.push(...formatRecordTable(report.stale.slice(0, MAX_TABLE_ROWS), report.stale));
  if (report.stale.length > MAX_TABLE_ROWS) {
    rows.push(`  … and ${report.stale.length - MAX_TABLE_ROWS} more. Use --json for the complete list.`);
  }
  rows.push("");
  rows.push("  Re-check each fact against its official source, then move the date forward.");

  if (strict) {
    rows.push("  Exiting 1 because --strict is set.");
  } else {
    rows.push("  Pass --strict to make this exit 1.");
  }

  return rows.join("\n");
}

/* -------------------------------------------------------------------- usage */

const HELP = `TMLGUIDE fact freshness check

Usage
  node scripts/check-fact-freshness.mjs [options]

Reads lastVerified, checkedOn and retrievedOn dates from src/data/** and
src/content/** (.ts files, test files excluded) and reports the ones past their
review window.

Options
  --max-age-days=<days>   Review window in whole days, at least 1 (default: 90)
  --as-of=<YYYY-MM-DD>    Reference date (default: today, UTC)
  --strict                Exit 1 when any record is older than the window
  --json                  Print the machine-readable summary instead of the report
  -h, --help              This text

Exit codes: 0 completed, 1 stale under --strict, 2 the run could not start.
`;

/* ---------------------------------------------------------------------- cli */

/** Parses a whole number of days of at least one. */
function parseMaxAgeDays(raw) {
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) {
    throw new UsageError(`--max-age-days must be a whole number of days, at least 1 (got "${raw}").`);
  }
  const days = Number(text);
  if (!Number.isSafeInteger(days) || days < 1) {
    throw new UsageError(`--max-age-days must be a whole number of days, at least 1 (got "${raw}").`);
  }
  return days;
}

/** Parses the reference date and refuses a day that never happened. */
function parseAsOf(raw) {
  const text = String(raw).trim();
  if (parseIsoDate(text) === null) {
    throw new UsageError(`--as-of must be a real calendar date in YYYY-MM-DD form (got "${raw}").`);
  }
  return text;
}

/**
 * Parses the command line.
 *
 * @throws {UsageError} for an unknown flag, a flag without its value, or a
 *   value outside its accepted range.
 */
export function parseArgs(argv) {
  const options = {
    maxAgeDays: DEFAULT_MAX_AGE_DAYS,
    asOf: null,
    strict: false,
    json: false,
    help: false,
  };

  for (const raw of argv) {
    if (typeof raw !== "string") {
      throw new UsageError("Every argument must be a string.");
    }
    if (raw === "-h" || raw === "--help") {
      options.help = true;
      continue;
    }
    if (raw === "--strict") {
      options.strict = true;
      continue;
    }
    if (raw === "--json") {
      options.json = true;
      continue;
    }
    if (raw === "--max-age-days") {
      throw new UsageError("--max-age-days needs a value: --max-age-days=<days>.");
    }
    if (raw === "--as-of") {
      throw new UsageError("--as-of needs a value: --as-of=<YYYY-MM-DD>.");
    }

    const match = /^--([a-z-]+)=(.*)$/.exec(raw);
    if (match === null) {
      throw new UsageError(`Unrecognised argument "${raw}". Use --help for the list.`);
    }

    const [, name, value] = match;
    switch (name) {
      case "max-age-days":
        options.maxAgeDays = parseMaxAgeDays(value);
        break;
      case "as-of":
        options.asOf = parseAsOf(value);
        break;
      default:
        throw new UsageError(`Unrecognised option "--${name}". Use --help for the list.`);
    }
  }

  return options;
}

/**
 * Runs the check and returns the exit code.
 *
 * `root` and the write functions are parameters so the tests can run the whole
 * command line against a temporary folder and read what was printed, without a
 * child process and without depending on the repository's current dates.
 *
 * @param {string[]} argv - arguments, without the node and script paths.
 * @param {{ root?: string, stdout?: (line: string) => void, stderr?: (line: string) => void }} [io]
 * @returns {number} 0, 1 or 2.
 */
export function main(argv, io = {}) {
  const root = io.root ?? REPO_ROOT;
  const write = io.stdout ?? ((line) => process.stdout.write(`${line}\n`));
  const writeError = io.stderr ?? ((line) => process.stderr.write(`${line}\n`));

  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    writeError(`[fact-freshness] ${error.message}`);
    writeError("");
    writeError(HELP);
    return 2;
  }

  if (options.help) {
    write(HELP);
    return 0;
  }

  const asOf = options.asOf ?? todayUtcIsoDate();

  let scanned;
  try {
    scanned = scanRecords({ root });
  } catch (error) {
    writeError(`[fact-freshness] ${error.message}`);
    return 2;
  }

  const report = buildReport({
    datedRecords: scanned.datedRecords,
    undatedFields: scanned.undatedFields,
    filesScanned: scanned.files.length,
    asOf,
    maxAgeDays: options.maxAgeDays,
  });

  if (options.json) {
    // One object per run, so a scheduled job can append or diff it.
    write(JSON.stringify(toJson(report, { strict: options.strict }), null, 2));
  } else {
    write(formatReport(report, { strict: options.strict }));
  }

  if (report.total === 0) {
    writeError(
      "[fact-freshness] Warning: no dated records were found. The field names or the scan paths may have changed.",
    );
  }

  return exitCodeFor(report, { strict: options.strict });
}

/** True when this module is the entry point rather than an import from a test. */
function isEntryPoint() {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    // An unexpected failure is not "stale facts". Reserving exit 1 for that
    // keeps a scheduled job's alert meaningful.
    process.stderr.write(`[fact-freshness] Unexpected failure: ${error?.stack ?? error}\n`);
    process.exitCode = 2;
  }
}
