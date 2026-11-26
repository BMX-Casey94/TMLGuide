/**
 * Local load test for TMLGUIDE.
 *
 * Run: node scripts/load-test.mjs
 *
 * Flags, all optional:
 *   --base-url <url>     Default http://127.0.0.1:3000
 *   --concurrency <n>    Default 10, maximum 20
 *   --duration <n>       Seconds, default 15, maximum 60
 *   --help
 *
 * ## What it will and will not do
 *
 * - It refuses to run unless the base URL hostname is exactly `localhost` or
 *   `127.0.0.1`. This is a hard exit before any socket is opened, so the script
 *   cannot be pointed at a public site by a mistyped flag or a copied command.
 *   There is no override flag: pointing a load test at production is a decision
 *   that should need more than an argument.
 * - It only issues `GET`, and only to the paths in `PATHS`. It never calls
 *   `/api/ask`, which costs money per request, and it never sends a body.
 * - It starts no server. If nothing is listening it says so and exits.
 * - Node built-ins only. No package is installed or imported from
 *   `node_modules`, so it runs on a clean checkout without `npm install`.
 *
 * ## How the numbers are produced
 *
 * `concurrency` workers each run a loop of single requests until the deadline.
 * A request is timed from just before the socket write to the end of the
 * response body, and the body is consumed and discarded so the connection can be
 * reused. Requests in flight when the deadline passes are still recorded: the
 * point of the run is to measure latency, and dropping the slowest samples would
 * flatter the result.
 *
 * A request counts as an **error** when the transport failed (refused, reset,
 * timed out) or the server answered `4xx` or `5xx`. Redirects are not followed
 * and not counted as errors: a `3xx` is a correct answer from a page that has
 * moved.
 *
 * Exit codes: `0` passed, `1` failed (a path over the error-rate limit, or the
 * server unreachable), `2` bad usage.
 */

import http from "node:http";
import https from "node:https";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/* ------------------------------------------------------------------ limits */

export const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
export const DEFAULT_CONCURRENCY = 10;
export const DEFAULT_DURATION_SECONDS = 15;
export const MAX_CONCURRENCY = 20;
export const MAX_DURATION_SECONDS = 60;

/**
 * The only paths the script requests.
 *
 * `/api/ask` is absent on purpose: every call there reaches a paid model, so a
 * load test would turn into a bill. `/api/health` is included because it is
 * cheap and proves the server is answering.
 */
export const PATHS = Object.freeze(["/", "/guides", "/guides/tickets", "/tools", "/ask", "/api/health"]);

/** A path is a failure above this share of failed requests. */
export const ERROR_RATE_LIMIT = 0.01;

/** Per-request ceiling. A local server that cannot answer in this long has failed. */
const REQUEST_TIMEOUT_MS = 5_000;

/** The reachability probe is allowed less time, because nothing has started yet. */
const PROBE_TIMEOUT_MS = 3_000;

const USER_AGENT = "tmlguide-load-test/1.0 (+local only)";

/** A usage problem: bad flag, bad value, or a base URL that is not local. */
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

/* ------------------------------------------------------- argument handling */

/** A whole number between `min` and `max`, or a usage error naming the rule. */
export function parseBoundedInteger(flag, raw, { min, max }) {
  if (raw === undefined) throw new UsageError(`${flag} needs a value.`);
  const text = String(raw).trim();
  // `Number` would accept "1e3", " 12 ", "0x10" and "1.0"; a count must be digits.
  if (!/^\d+$/.test(text)) {
    throw new UsageError(`${flag} must be a whole number between ${min} and ${max}, not "${raw}".`);
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new UsageError(`${flag} must be a whole number between ${min} and ${max}, not "${raw}".`);
  }
  return value;
}

/**
 * Validates the base URL and returns its origin.
 *
 * The hostname check is applied to the parsed value, not to the string, so
 * `http://localhost.evil.test`, `http://127.0.0.1@evil.test` and a DNS name that
 * merely starts with `localhost` are all refused. The WHATWG parser normalises
 * the numeric forms of IPv4 (`http://2130706433/`, `http://127.1/`) to
 * `127.0.0.1`, which is why the check is on `hostname` rather than on the text.
 */
export function normaliseBaseUrl(raw) {
  if (raw === undefined) throw new UsageError("--base-url needs a value.");

  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw new UsageError(`--base-url is not a valid URL: "${raw}". Expected something like ${DEFAULT_BASE_URL}.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UsageError(`--base-url must use http or https, not "${url.protocol}".`);
  }

  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new UsageError(
      `Refusing to run against "${url.hostname}". The base URL host must be localhost or 127.0.0.1.\n` +
        "This script is for a server on your own machine only. Nothing was requested.",
    );
  }

  if (url.username !== "" || url.password !== "") {
    throw new UsageError("--base-url must not carry credentials.");
  }

  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new UsageError(
      `--base-url must be an origin with no path, query or fragment, not "${raw}". ` +
        "The paths being tested are fixed.",
    );
  }

  // Origin drops the trailing slash, so paths can be appended without doubling it.
  return url.origin;
}

/**
 * Parses `argv` into a run configuration.
 *
 * Both `--flag value` and `--flag=value` are accepted. Anything unrecognised is
 * refused rather than ignored: a typo in `--duraton` should not silently produce
 * a fifteen-second run that the caller believes is a minute long.
 */
export function parseArgs(argv) {
  const options = {
    help: false,
    // The default goes through the same validation as a supplied value. If the
    // constant were ever edited to a public host, the guard would still hold
    // rather than being the one path around it.
    baseUrl: normaliseBaseUrl(DEFAULT_BASE_URL),
    concurrency: DEFAULT_CONCURRENCY,
    durationSeconds: DEFAULT_DURATION_SECONDS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argument);
    if (match === null) {
      throw new UsageError(`Unrecognised argument "${argument}". Run with --help to see the options.`);
    }

    const [, name, inlineValue] = match;
    const takesValue = name === "base-url" || name === "concurrency" || name === "duration";
    if (!takesValue) {
      throw new UsageError(`Unknown flag "--${name}". Run with --help to see the options.`);
    }

    let value = inlineValue;
    if (value === undefined) {
      index += 1;
      value = argv[index];
      if (value === undefined) throw new UsageError(`--${name} needs a value.`);
    }

    if (name === "base-url") {
      options.baseUrl = normaliseBaseUrl(value);
    } else if (name === "concurrency") {
      options.concurrency = parseBoundedInteger("--concurrency", value, { min: 1, max: MAX_CONCURRENCY });
    } else {
      options.durationSeconds = parseBoundedInteger("--duration", value, { min: 1, max: MAX_DURATION_SECONDS });
    }
  }

  return options;
}

/* --------------------------------------------------------------- statistics */

/**
 * Nearest-rank percentile of an ascending-sorted array, or `null` when empty.
 *
 * Nearest-rank rather than interpolation: every value returned is a latency that
 * actually happened, which is the honest thing to put in front of someone
 * deciding whether the server is fast enough.
 */
export function percentile(sortedAscending, percent) {
  if (sortedAscending.length === 0) return null;
  const rank = Math.ceil((percent / 100) * sortedAscending.length);
  const index = Math.min(Math.max(rank, 1), sortedAscending.length) - 1;
  return sortedAscending[index];
}

/**
 * Turns raw per-path samples into the table rows.
 *
 * @param {Record<string, { requests: number, errors: number, durationsMs: number[] }>} samples
 */
export function summarise(samples) {
  return PATHS.map((pathName) => {
    const sample = samples[pathName] ?? { requests: 0, errors: 0, durationsMs: [] };
    const sorted = [...sample.durationsMs].sort((a, b) => a - b);
    return {
      path: pathName,
      requests: sample.requests,
      errors: sample.errors,
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
    };
  });
}

/** The share of a path's requests that failed. A path with no requests has none. */
export function errorRate(row) {
  return row.requests === 0 ? 0 : row.errors / row.requests;
}

/**
 * Why the run failed, as a list of sentences. Empty means it passed.
 *
 * A path that received no requests at all is a failure: it means the run measured
 * nothing there, and reporting a clean `0` for a path that was never touched
 * would be the most misleading row in the table.
 */
export function failures(rows) {
  const reasons = [];
  for (const row of rows) {
    if (row.requests === 0) {
      reasons.push(`${row.path} received no requests, so nothing was measured.`);
      continue;
    }
    const rate = errorRate(row);
    if (rate > ERROR_RATE_LIMIT) {
      const percent = (rate * 100).toFixed(2);
      const limit = (ERROR_RATE_LIMIT * 100).toFixed(0);
      reasons.push(`${row.path} failed ${percent}% of requests (limit ${limit}%).`);
    }
  }
  return reasons;
}

/** The process exit code for a finished run. */
export function exitCodeFor(rows) {
  return failures(rows).length === 0 ? 0 : 1;
}

/* ------------------------------------------------------------------ display */

function padEnd(text, width) {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function padStart(text, width) {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

function formatMs(value) {
  return value === null ? "-" : String(Math.round(value));
}

/** The results table as plain lines, header included. */
export function formatTable(rows) {
  const header = ["path", "requests", "errors", "p50 ms", "p95 ms"];
  const cells = rows.map((row) => [
    row.path,
    String(row.requests),
    String(row.errors),
    formatMs(row.p50Ms),
    formatMs(row.p95Ms),
  ]);

  const widths = header.map((title, column) =>
    Math.max(title.length, ...cells.map((row) => row[column].length)),
  );

  const line = (values) =>
    [padEnd(values[0], widths[0]), ...values.slice(1).map((value, i) => padStart(value, widths[i + 1]))].join(
      "  ",
    );

  return [line(header), ...cells.map(line)];
}

/* ---------------------------------------------------------------- requests */

/** Chooses the transport for the base URL. */
function transportFor(origin) {
  return origin.startsWith("https:") ? https : http;
}

/**
 * Whether a response status counts as an error.
 *
 * `4xx` and `5xx` are failures: a `404` on `/guides/tickets` is exactly the kind
 * of thing a load test should catch, and a `5xx` under load is the point of the
 * exercise. Redirects are not failures, and neither is a `2xx`. A `status` of
 * `0` means no response arrived at all, which is always a failure.
 */
export function isFailedStatus(status) {
  return status === 0 || status >= 400;
}

/**
 * One `GET`, timed, with the body discarded.
 *
 * Never rejects. A failure is a recorded result, because a load test that throws
 * on the first refused connection reports nothing about the other paths.
 *
 * Exported so a test can drive it against a stub server on a loopback port. It
 * opens no connection of its own until it is called.
 *
 * @returns {Promise<{ status: number, durationMs: number, failed: boolean }>}
 */
export function httpGet(agent, origin, pathName, timeoutMs) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    let settled = false;
    // Cleared on every exit path, so no timer keeps the process alive after a run.
    let deadline;

    const finish = (durationMs, status, failed) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve({ status, durationMs, failed });
    };

    let request;
    try {
      request = transportFor(origin).request(
        new URL(pathName, origin),
        {
          method: "GET",
          agent,
          headers: { "user-agent": USER_AGENT, accept: "*/*", "cache-control": "no-cache" },
        },
        (response) => {
          // Drain so the socket returns to the pool. The bytes are not wanted.
          response.resume();
          response.on("end", () => {
            const status = response.statusCode ?? 0;
            finish(performance.now() - startedAt, status, isFailedStatus(status));
          });
          response.on("error", () => finish(performance.now() - startedAt, 0, true));
          response.on("aborted", () => finish(performance.now() - startedAt, 0, true));
        },
      );
    } catch {
      finish(performance.now() - startedAt, 0, true);
      return;
    }

    /*
      Two limits, because they catch different failures.

      `setTimeout` on the request measures *inactivity*, so a peer that dribbles a
      byte every second never trips it. The absolute deadline below is what stops
      a run hanging on such a peer: a single request can occupy a worker for no
      longer than this, whatever the traffic looks like.
    */
    request.setTimeout(timeoutMs, () => {
      // Destroying with no error keeps Node from printing an unhandled `error`.
      request.destroy();
      finish(performance.now() - startedAt, 0, true);
    });
    deadline = setTimeout(() => {
      request.destroy();
      finish(performance.now() - startedAt, 0, true);
    }, timeoutMs);

    request.on("error", () => finish(performance.now() - startedAt, 0, true));
    request.end();
  });
}

/* --------------------------------------------------------------------- main */

/** Whether a server answers at the given origin. Any HTTP status counts. */
async function isReachable(origin) {
  const agent = new (transportFor(origin).Agent)({ keepAlive: false });
  try {
    const result = await httpGet(agent, origin, "/api/health", PROBE_TIMEOUT_MS);
    return result.status !== 0;
  } finally {
    agent.destroy();
  }
}

/**
 * Runs the test and returns the process exit code.
 *
 * Exported so a test can drive the whole loop — workers, sampling, table and exit
 * code — against a stub server on a loopback port. It opens nothing until it is
 * called.
 *
 * The origin is validated again here rather than trusted from the caller. The
 * parser already refuses a public host, but this is the function that opens
 * sockets, and a guard that exists only at the outer edge is one refactor away
 * from being bypassed by a future caller.
 */
export async function run(options) {
  const origin = normaliseBaseUrl(options.baseUrl);
  const { concurrency, durationSeconds } = options;

  // A cheap second line of defence, in case `run` is handed values directly.
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_CONCURRENCY) {
    throw new UsageError(`concurrency must be a whole number between 1 and ${MAX_CONCURRENCY}.`);
  }
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > MAX_DURATION_SECONDS) {
    throw new UsageError(`durationSeconds must be a whole number between 1 and ${MAX_DURATION_SECONDS}.`);
  }

  if (!(await isReachable(origin))) {
    console.error(`Cannot reach ${origin}.`);
    console.error("Start a server there yourself, or point --base-url at the port it is on. Nothing was started for you.");
    return 1;
  }

  console.log(
    `Load test: ${origin}  concurrency ${concurrency}  duration ${durationSeconds}s  ` +
      `${PATHS.length} paths, GET only`,
  );
  console.log("");

  const agent = new (transportFor(origin).Agent)({
    // Sockets are reused across requests so the measurement reflects the server's
    // handling of a request rather than the cost of a TCP and TLS handshake on
    // every sample. `maxSockets` matches the worker count, so the agent never
    // queues a request behind its own limit and quietly reduces the concurrency.
    keepAlive: true,
    maxSockets: concurrency,
  });

  /** @type {Record<string, { requests: number, errors: number, durationsMs: number[] }>} */
  const samples = Object.fromEntries(
    PATHS.map((pathName) => [pathName, { requests: 0, errors: 0, durationsMs: [] }]),
  );

  const deadline = performance.now() + durationSeconds * 1_000;
  let nextPathIndex = 0;

  async function worker() {
    for (;;) {
      if (performance.now() >= deadline) return;
      // Paths are handed out round-robin, so each one sees the same mix of
      // cold-start and warm traffic instead of one path owning the first second.
      const pathName = PATHS[nextPathIndex % PATHS.length];
      nextPathIndex += 1;

      const result = await httpGet(agent, origin, pathName, REQUEST_TIMEOUT_MS);
      const sample = samples[pathName];
      sample.requests += 1;
      sample.durationsMs.push(result.durationMs);
      if (result.failed) sample.errors += 1;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  agent.destroy();

  const rows = summarise(samples);
  for (const line of formatTable(rows)) console.log(line);

  const totalRequests = rows.reduce((sum, row) => sum + row.requests, 0);
  const totalErrors = rows.reduce((sum, row) => sum + row.errors, 0);
  console.log("");
  console.log(`Requests ${totalRequests}  errors ${totalErrors}`);

  const reasons = failures(rows);
  if (reasons.length === 0) {
    console.log("PASS: every path stayed at or below the 1% error limit.");
    return 0;
  }

  console.log("FAIL:");
  for (const reason of reasons) console.log(`  - ${reason}`);
  return 1;
}

/** Printed for `--help`, and after any usage error. */
function usage() {
  return [
    "Local load test. GET only, localhost only.",
    "",
    "  node scripts/load-test.mjs [options]",
    "",
    `  --base-url <url>    Origin to test. Default ${DEFAULT_BASE_URL}. Host must be localhost or 127.0.0.1.`,
    `  --concurrency <n>   Requests in flight. Default ${DEFAULT_CONCURRENCY}, maximum ${MAX_CONCURRENCY}.`,
    `  --duration <n>      Seconds. Default ${DEFAULT_DURATION_SECONDS}, maximum ${MAX_DURATION_SECONDS}.`,
    "  --help              This text.",
    "",
    `Paths: ${PATHS.join(", ")}`,
    "It never calls /api/ask, because that spends money.",
  ].join("\n");
}

/** True when this module is the entry point rather than an import from a test. */
function isMain() {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    console.error("");
    console.error(usage());
    process.exitCode = 2;
  }

  if (options !== undefined) {
    if (options.help) {
      console.log(usage());
    } else {
      try {
        process.exitCode = await run(options);
      } catch (error) {
        // `run` re-validates its input, so a usage error can surface here too.
        if (!(error instanceof UsageError)) throw error;
        console.error(error.message);
        process.exitCode = 2;
      }
    }
  }
}
