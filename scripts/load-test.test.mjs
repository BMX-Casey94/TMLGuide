/**
 * Tests for `scripts/load-test.mjs`.
 *
 * Run: node --test scripts/load-test.test.mjs
 *
 * vitest is configured to collect `src/**\/*.test.{ts,tsx}` only, so this file
 * lives outside its glob and runs under Node's own test runner instead. That
 * keeps the script dependency-free and its tests equally so.
 *
 * The script is imported rather than executed for the unit checks. The last group
 * spawns it as a child process, because the promise the script makes — that a
 * public host is refused before any socket opens — is only observable as a real
 * exit.
 */

import { spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CONCURRENCY,
  DEFAULT_DURATION_SECONDS,
  ERROR_RATE_LIMIT,
  MAX_CONCURRENCY,
  MAX_DURATION_SECONDS,
  PATHS,
  UsageError,
  errorRate,
  exitCodeFor,
  failures,
  formatTable,
  httpGet,
  isFailedStatus,
  normaliseBaseUrl,
  parseArgs,
  parseBoundedInteger,
  percentile,
  run,
  summarise,
} from "./load-test.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "load-test.mjs");

/** An empty sample map, one entry per tested path. */
function emptySamples() {
  return Object.fromEntries(PATHS.map((p) => [p, { requests: 0, errors: 0, durationsMs: [] }]));
}

/* ------------------------------------------------------------------ parsing */

describe("parseArgs", () => {
  it("uses the documented defaults when given no arguments", () => {
    const options = parseArgs([]);

    assert.equal(options.baseUrl, "http://127.0.0.1:3000");
    assert.equal(options.concurrency, DEFAULT_CONCURRENCY);
    assert.equal(options.durationSeconds, DEFAULT_DURATION_SECONDS);
    assert.equal(options.help, false);
  });

  it("accepts a separate value and an inline value", () => {
    const separate = parseArgs(["--concurrency", "4", "--duration", "3"]);
    assert.equal(separate.concurrency, 4);
    assert.equal(separate.durationSeconds, 3);

    const inline = parseArgs(["--concurrency=4", "--duration=3"]);
    assert.equal(inline.concurrency, 4);
    assert.equal(inline.durationSeconds, 3);
  });

  it("accepts the upper bounds exactly", () => {
    const options = parseArgs([`--concurrency=${MAX_CONCURRENCY}`, `--duration=${MAX_DURATION_SECONDS}`]);

    assert.equal(options.concurrency, MAX_CONCURRENCY);
    assert.equal(options.durationSeconds, MAX_DURATION_SECONDS);
  });

  it("refuses a concurrency above the cap", () => {
    assert.throws(() => parseArgs(["--concurrency", String(MAX_CONCURRENCY + 1)]), UsageError);
  });

  it("refuses a duration above the cap", () => {
    assert.throws(() => parseArgs(["--duration", String(MAX_DURATION_SECONDS + 1)]), UsageError);
  });

  it("refuses zero, negatives, fractions and non-numbers", () => {
    for (const value of ["0", "-1", "1.5", "abc", "1e3", "0x10", "", " ", "10ms"]) {
      assert.throws(() => parseArgs(["--concurrency", value]), UsageError, `accepted "${value}"`);
      assert.throws(() => parseArgs(["--duration", value]), UsageError, `accepted "${value}"`);
    }
  });

  it("refuses a flag with no value", () => {
    assert.throws(() => parseArgs(["--concurrency"]), UsageError);
    assert.throws(() => parseArgs(["--duration"]), UsageError);
    assert.throws(() => parseArgs(["--base-url"]), UsageError);
  });

  it("refuses an unknown flag rather than ignoring it", () => {
    // A typo must not quietly produce a run with the default settings.
    assert.throws(() => parseArgs(["--duraton", "5"]), UsageError);
    assert.throws(() => parseArgs(["--verbose"]), UsageError);
    assert.throws(() => parseArgs(["extra"]), UsageError);
  });

  it("treats --help as a request for the text, not a run", () => {
    assert.equal(parseArgs(["--help"]).help, true);
    assert.equal(parseArgs(["-h"]).help, true);
  });
});

describe("parseBoundedInteger", () => {
  it("rejects a value that is a number but not a whole one", () => {
    assert.throws(() => parseBoundedInteger("--concurrency", "2.0", { min: 1, max: 20 }), UsageError);
  });

  it("rejects a value that is too large to be safe", () => {
    assert.throws(() => parseBoundedInteger("--concurrency", "99999999999999999999", { min: 1, max: 20 }), UsageError);
  });

  it("accepts a value with leading whitespace after trimming", () => {
    assert.equal(parseBoundedInteger("--duration", " 7 ", { min: 1, max: 60 }), 7);
  });
});

/* ------------------------------------------------------------- local-only */

describe("normaliseBaseUrl", () => {
  it("accepts localhost and 127.0.0.1 and returns a bare origin", () => {
    assert.equal(normaliseBaseUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
    assert.equal(normaliseBaseUrl("http://localhost:3000"), "http://localhost:3000");
    assert.equal(normaliseBaseUrl("http://localhost:3000/"), "http://localhost:3000");
    assert.equal(normaliseBaseUrl("https://LOCALHOST:8443"), "https://localhost:8443");
  });

  it("accepts the numeric forms the URL parser resolves to loopback", () => {
    // The check is on the parsed hostname, so these aliases are recognised as
    // local rather than mistaken for a public host by a string comparison.
    assert.equal(normaliseBaseUrl("http://127.1:3000"), "http://127.0.0.1:3000");
    assert.equal(normaliseBaseUrl("http://2130706433:3000"), "http://127.0.0.1:3000");
  });

  it("refuses a public host", () => {
    for (const raw of [
      "https://tmlguide.com",
      "http://example.com:3000",
      "http://www.tomorrowland.com",
      "http://10.0.0.5:3000",
      "http://192.168.1.10:3000",
    ]) {
      assert.throws(() => normaliseBaseUrl(raw), UsageError, `accepted ${raw}`);
    }
  });

  it("refuses a host that merely contains localhost", () => {
    for (const raw of [
      "http://localhost.evil.test",
      "http://localhost-attacker.test:3000",
      "http://notlocalhost:3000",
      "http://127.0.0.1.nip.io:3000",
    ]) {
      assert.throws(() => normaliseBaseUrl(raw), UsageError, `accepted ${raw}`);
    }
  });

  it("refuses a host hidden behind credentials", () => {
    assert.throws(() => normaliseBaseUrl("http://localhost@evil.test"), UsageError);
    assert.throws(() => normaliseBaseUrl("http://127.0.0.1:secret@evil.test"), UsageError);
  });

  it("refuses a base URL carrying a path, query or fragment", () => {
    assert.throws(() => normaliseBaseUrl("http://localhost:3000/guides"), UsageError);
    assert.throws(() => normaliseBaseUrl("http://localhost:3000/?x=1"), UsageError);
    assert.throws(() => normaliseBaseUrl("http://localhost:3000/#top"), UsageError);
  });

  it("refuses a non-HTTP scheme and unparseable input", () => {
    assert.throws(() => normaliseBaseUrl("file:///etc/passwd"), UsageError);
    assert.throws(() => normaliseBaseUrl("ftp://localhost"), UsageError);
    assert.throws(() => normaliseBaseUrl("localhost:3000"), UsageError);
    assert.throws(() => normaliseBaseUrl(""), UsageError);
  });
});

/* --------------------------------------------------------------- requests */

describe("isFailedStatus", () => {
  it("counts 4xx and 5xx and no response as failures", () => {
    for (const status of [0, 400, 404, 429, 500, 503]) {
      assert.equal(isFailedStatus(status), true, `${status} was not a failure`);
    }
  });

  it("does not count a success or a redirect as a failure", () => {
    for (const status of [200, 204, 301, 302, 308]) {
      assert.equal(isFailedStatus(status), false, `${status} was a failure`);
    }
  });
});

describe("httpGet", () => {
  /**
   * Runs one request against a stub server on loopback.
   *
   * The stub binds an ephemeral port on 127.0.0.1, so nothing leaves the machine
   * and no fixed port is needed. It closes when the request is done.
   */
  async function againstStub(handler, pathName = "/") {
    const server = http.createServer(handler);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    const { port } = server.address();
    const agent = new http.Agent({ keepAlive: false });
    try {
      return await httpGet(agent, `http://127.0.0.1:${port}`, pathName, 5_000);
    } finally {
      agent.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
  }

  it("records a 200 as a success and times it", async () => {
    const result = await againstStub((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
    });

    assert.equal(result.status, 200);
    assert.equal(result.failed, false);
    assert.equal(typeof result.durationMs, "number");
    assert.ok(result.durationMs >= 0);
  });

  it("records a 404 as a failure rather than hiding it", async () => {
    const result = await againstStub((_request, response) => {
      response.writeHead(404);
      response.end("not found");
    });

    assert.equal(result.status, 404);
    assert.equal(result.failed, true);
  });

  it("records a 500 as a failure", async () => {
    const result = await againstStub((_request, response) => {
      response.writeHead(500);
      response.end("boom");
    });

    assert.equal(result.failed, true);
  });

  it("does not follow a redirect, and does not count it as a failure", async () => {
    const result = await againstStub((_request, response) => {
      response.writeHead(308, { location: "/elsewhere" });
      response.end();
    });

    assert.equal(result.status, 308);
    assert.equal(result.failed, false);
  });

  it("sends GET and no body", async () => {
    let seen;
    await againstStub((request, response) => {
      seen = { method: request.method, length: request.headers["content-length"] };
      response.writeHead(200);
      response.end();
    });

    assert.equal(seen.method, "GET");
    assert.equal(seen.length, undefined);
  });

  it("reports a refused connection as a failure with status 0, without throwing", async () => {
    // Port 1 on loopback is closed, so the connect fails immediately.
    const agent = new http.Agent({ keepAlive: false });
    try {
      const result = await httpGet(agent, "http://127.0.0.1:1", "/", 2_000);

      assert.equal(result.status, 0);
      assert.equal(result.failed, true);
    } finally {
      agent.destroy();
    }
  });

  it("gives up on a server that never answers, and does not hang", async () => {
    // The stub holds the request open. A load test against a wedged server must
    // still return, or the run never prints a table and never exits.
    const server = http.createServer(() => {
      // Deliberately no response.
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    const agent = new http.Agent({ keepAlive: false });
    try {
      const { port } = server.address();
      const result = await httpGet(agent, `http://127.0.0.1:${port}`, "/", 300);

      assert.equal(result.status, 0);
      assert.equal(result.failed, true);
      assert.ok(result.durationMs < 2_000, "the timeout did not fire promptly");
    } finally {
      agent.destroy();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("gives up on a server that trickles bytes, because inactivity is not the only hang", async () => {
    // This peer never goes quiet for long enough to trip an inactivity timeout, so
    // only an absolute deadline stops it. Without one the run would never finish.
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      const ticker = setInterval(() => response.write(" "), 100);
      response.on("close", () => clearInterval(ticker));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    const agent = new http.Agent({ keepAlive: false });
    try {
      const { port } = server.address();
      const result = await httpGet(agent, `http://127.0.0.1:${port}`, "/", 400);

      assert.equal(result.status, 0);
      assert.equal(result.failed, true);
      assert.ok(result.durationMs < 3_000, "the absolute deadline did not fire");
    } finally {
      agent.destroy();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

/* ------------------------------------------------------------- statistics */
describe("percentile", () => {
  it("returns null for an empty sample rather than zero", () => {
    assert.equal(percentile([], 50), null);
  });

  it("uses nearest-rank, so every result is a value that occurred", () => {
    const sorted = [1, 2, 3, 4, 5];
    assert.equal(percentile(sorted, 50), 3);
    assert.equal(percentile(sorted, 95), 5);
  });

  it("clamps to the last element for a small sample", () => {
    assert.equal(percentile([10], 95), 10);
    assert.equal(percentile([10, 20], 95), 20);
  });
});

describe("summarise", () => {
  it("sorts before computing, so input order does not matter", () => {
    const samples = emptySamples();
    samples["/"] = { requests: 3, errors: 0, durationsMs: [30, 10, 20] };

    const row = summarise(samples).find((r) => r.path === "/");

    assert.deepEqual(row, { path: "/", requests: 3, errors: 0, p50Ms: 20, p95Ms: 30 });
  });

  it("gives every configured path a row, including those never hit", () => {
    const rows = summarise(emptySamples());

    assert.equal(rows.length, PATHS.length);
    assert.deepEqual(
      rows.map((r) => r.path),
      [...PATHS],
    );
    for (const row of rows) {
      assert.equal(row.requests, 0);
      assert.equal(row.p50Ms, null);
    }
  });

  it("does not mutate the samples it reads", () => {
    const durations = [30, 10, 20];
    const samples = emptySamples();
    samples["/"] = { requests: 3, errors: 0, durationsMs: durations };

    summarise(samples);

    assert.deepEqual(durations, [30, 10, 20]);
  });
});

describe("failures and exit code", () => {
  it("passes an empty run's structure when every path has traffic and no errors", () => {
    const rows = summarise(emptySamples()).map((row) => ({ ...row, requests: 100, errors: 1, p50Ms: 5, p95Ms: 9 }));

    assert.deepEqual(failures(rows), []);
    assert.equal(exitCodeFor(rows), 0);
  });

  it("allows an error rate exactly on the limit", () => {
    const rows = [
      { path: "/", requests: 100, errors: 1, p50Ms: 1, p95Ms: 2 },
    ];

    assert.equal(ERROR_RATE_LIMIT, 0.01);
    assert.deepEqual(failures(rows), []);
  });

  it("fails a path above the limit", () => {
    const rows = [
      { path: "/", requests: 100, errors: 2, p50Ms: 1, p95Ms: 2 },
      { path: "/guides", requests: 100, errors: 0, p50Ms: 1, p95Ms: 2 },
    ];

    const reasons = failures(rows);

    assert.equal(reasons.length, 1);
    assert.match(reasons[0], /^\/ failed 2\.00%/);
    assert.equal(exitCodeFor(rows), 1);
  });

  it("fails a path that measured nothing, rather than reporting a clean zero", () => {
    const rows = [{ path: "/tools", requests: 0, errors: 0, p50Ms: null, p95Ms: null }];

    assert.match(failures(rows)[0], /received no requests/);
    assert.equal(exitCodeFor(rows), 1);
  });

  it("distinguishes a total failure from a partial one", () => {
    assert.equal(errorRate({ path: "/", requests: 10, errors: 10 }), 1);
    assert.equal(errorRate({ path: "/", requests: 0, errors: 0 }), 0);
  });
});

/* ------------------------------------------------------------------ table */

describe("formatTable", () => {
  it("prints the five columns named in the brief, and nothing else", () => {
    const rows = summarise(emptySamples());
    const lines = formatTable(rows);

    assert.equal(lines.length, PATHS.length + 1);
    assert.match(lines[0], /^path\s+requests\s+errors\s+p50 ms\s+p95 ms$/);

    for (const line of lines.slice(1)) {
      assert.equal(line.split(/\s{2,}/).length, 5, `wrong column count in "${line}"`);
    }
  });

  it("shows a dash for a percentile that does not exist", () => {
    const lines = formatTable([{ path: "/", requests: 0, errors: 0, p50Ms: null, p95Ms: null }]);

    assert.match(lines[1], /\s-\s+-$/);
  });
});

/* ---------------------------------------------------- the loop, end to end */

describe("run", () => {
  /**
   * Runs the whole test against a stub server on a loopback port for one second.
   *
   * This is the only place the worker loop, the sampling and the exit code are
   * exercised together. One second with low concurrency keeps the suite quick
   * while still issuing far more requests than the six paths need.
   */
  async function runAgainstStub(handler, options = {}) {
    const server = http.createServer(handler);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    const printed = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => printed.push(args.join(" "));
    console.error = (...args) => printed.push(args.join(" "));

    try {
      const exitCode = await run({
        baseUrl: `http://127.0.0.1:${port}`,
        concurrency: 2,
        durationSeconds: 1,
        ...options,
      });
      return { exitCode, output: printed.join("\n") };
    } finally {
      console.log = originalLog;
      console.error = originalError;
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }

  it("passes, and prints a table row for every path, when the server answers 200", async () => {
    const { exitCode, output } = await runAgainstStub((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("ok");
    });

    assert.equal(exitCode, 0);
    assert.match(output, /PASS/);
    for (const pathName of PATHS) {
      assert.ok(output.includes(pathName), `no row for ${pathName}`);
    }
    assert.match(output, /path\s+requests\s+errors\s+p50 ms\s+p95 ms/);
  });

  it("fails when the server answers 500", async () => {
    const { exitCode, output } = await runAgainstStub((_request, response) => {
      response.writeHead(500);
      response.end("boom");
    });

    assert.equal(exitCode, 1);
    assert.match(output, /FAIL/);
    assert.match(output, /failed 100\.00% of requests/);
  });

  it("fails and starts nothing when no server is listening", async () => {
    const printed = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => printed.push(args.join(" "));
    console.error = (...args) => printed.push(args.join(" "));

    try {
      // Port 1 on loopback is closed.
      const exitCode = await run({
        baseUrl: "http://127.0.0.1:1",
        concurrency: 1,
        durationSeconds: 1,
      });

      assert.equal(exitCode, 1);
      assert.match(printed.join("\n"), /Cannot reach http:\/\/127\.0\.0\.1:1/);
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  });

  it("never requests /api/ask, even though /ask is a tested path", async () => {
    const seen = new Set();
    const { exitCode } = await runAgainstStub((request, response) => {
      seen.add(request.url);
      response.writeHead(200);
      response.end("ok");
    });

    assert.equal(exitCode, 0);
    assert.equal(seen.has("/api/ask"), false);
    assert.equal(seen.has("/ask"), true);
    // Only GET, and only the six configured paths.
    for (const url of seen) assert.ok(PATHS.includes(url), `unexpected path ${url}`);
  });

  it("refuses a public origin even when called directly, before any request", async () => {
    // The parser is the usual gate; this proves `run` does not rely on it.
    await assert.rejects(
      run({ baseUrl: "https://tmlguide.com", concurrency: 1, durationSeconds: 1 }),
      UsageError,
    );
  });

  it("refuses a concurrency or duration outside the caps when called directly", async () => {
    for (const options of [
      { baseUrl: "http://127.0.0.1:1", concurrency: 21, durationSeconds: 1 },
      { baseUrl: "http://127.0.0.1:1", concurrency: 1, durationSeconds: 61 },
      { baseUrl: "http://127.0.0.1:1", concurrency: 0, durationSeconds: 1 },
      { baseUrl: "http://127.0.0.1:1", concurrency: 1, durationSeconds: 1.5 },
    ]) {
      await assert.rejects(run(options), UsageError, JSON.stringify(options));
    }
  });
});

describe("when executed as a process", () => {
  /**
   * Runs the script and returns its exit code and output.
   *
   * A public host must be refused during argument parsing, before any socket is
   * opened, so these runs are safe and need no network.
   */
  function runScript(args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], {
      encoding: "utf8",
      timeout: 20_000,
      // Nothing here should reach a server; a short failure is the expected path.
    });
  }

  it("exits 2 and names the refusal for a public host", () => {
    const result = runScript(["--base-url", "https://tmlguide.com"]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Refusing to run against "tmlguide\.com"/);
    assert.match(result.stderr, /localhost or 127\.0\.0\.1/);
    assert.equal(result.stdout.trim(), "");
  });

  it("exits 2 for a host that merely starts with localhost", () => {
    const result = runScript(["--base-url=http://localhost.evil.test"]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Refusing to run/);
  });

  it("exits 2 for a concurrency above the cap", () => {
    const result = runScript(["--concurrency", "500"]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /--concurrency must be a whole number between 1 and 20/);
  });

  it("prints the exact run command in --help", () => {
    const result = runScript(["--help"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /node scripts\/load-test\.mjs/);
    assert.match(result.stdout, /never calls \/api\/ask/);
  });

  it("says nothing is listening rather than starting a server, when port 3000 is free", () => {
    const result = runScript(["--duration", "1"]);

    // Either the port is free — in which case the script reports that and exits 1 —
    // or a real server is running on it and the run reports its own numbers. Both
    // are correct; what must never happen is a started server or an unhandled crash.
    assert.ok(result.status === 0 || result.status === 1, `unexpected exit ${result.status}`);
    assert.equal(result.signal, null);
    if (result.status === 1) {
      assert.match(result.stderr, /Cannot reach http:\/\/127\.0\.0\.1:3000/);
    }
  });
});
