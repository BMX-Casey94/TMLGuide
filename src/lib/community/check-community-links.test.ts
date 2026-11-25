// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseArgs, runWithLimit } from "../../../scripts/check-community-links.mjs";

/*
  The script's network path is exercised by running it, not here: a unit test that
  contacted WhatsApp would fail whenever a group fills up, which says nothing
  about the code. What is tested is the part that decides what a run does — the
  argument parser and the concurrency helper — because a wrong default is how a
  checker ends up hammering forty hosts at once.
*/

describe("parseArgs", () => {
  it("defaults to a run of everything at a modest concurrency", () => {
    const options = parseArgs([]);

    expect(options.json).toBe(false);
    expect(options.out).toBeNull();
    expect(options.only).toBe("all");
    expect(options.concurrency).toBe(4);
    expect(options.timeoutMs).toBe(8_000);
    expect(options.help).toBe(false);
  });

  it("reads the JSON flag", () => {
    expect(parseArgs(["--json"]).json).toBe(true);
  });

  it("reads the help flag, in both spellings", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  it("reads an output path", () => {
    expect(parseArgs(["--out=reports/links.json"]).out).toBe("reports/links.json");
  });

  it("rejects an output path with no value", () => {
    expect(() => parseArgs(["--out="])).toThrow(/needs a file path/);
  });

  it.each(["all", "groups", "resources"])("accepts --only=%s", (value) => {
    expect(parseArgs([`--only=${value}`]).only).toBe(value);
  });

  it("rejects an unknown collection", () => {
    expect(() => parseArgs(["--only=partners"])).toThrow(/must be "all", "groups" or "resources"/);
  });

  it("accepts a concurrency from 1 to 16", () => {
    expect(parseArgs(["--concurrency=1"]).concurrency).toBe(1);
    expect(parseArgs(["--concurrency=16"]).concurrency).toBe(16);
  });

  it.each(["0", "17", "-1", "abc", "2.5"])("rejects a concurrency of %s", (value) => {
    expect(() => parseArgs([`--concurrency=${value}`])).toThrow(/whole number from 1 to 16/);
  });

  it("accepts a timeout from 1000 to 60000", () => {
    expect(parseArgs(["--timeout=1000"]).timeoutMs).toBe(1_000);
    expect(parseArgs(["--timeout=60000"]).timeoutMs).toBe(60_000);
  });

  it.each(["999", "60001", "abc"])("rejects a timeout of %s", (value) => {
    expect(() => parseArgs([`--timeout=${value}`])).toThrow(/milliseconds from 1000 to 60000/);
  });

  it.each([["--nope"], ["--Only=all"], ["-x"], ["extra"]])(
    "rejects the unrecognised argument %j",
    (argument) => {
      expect(() => parseArgs([argument])).toThrow(/Unrecognised/);
    },
  );

  it("reads several options together", () => {
    const options = parseArgs(["--only=groups", "--concurrency=2", "--timeout=5000", "--json"]);
    expect(options).toMatchObject({ only: "groups", concurrency: 2, timeoutMs: 5_000, json: true });
  });
});

describe("runWithLimit", () => {
  it("returns results in the input order, whatever order they finish in", async () => {
    const delays = [30, 5, 15];
    const results = await runWithLimit([0, 1, 2], 3, async (value: number) => {
      await new Promise((resolve) => setTimeout(resolve, delays[value]));
      return value * 10;
    });

    expect(results).toEqual([0, 10, 20]);
  });

  it("never runs more than the limit at once", async () => {
    let inFlight = 0;
    let peak = 0;

    await runWithLimit(Array.from({ length: 20 }, (_, index) => index), 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return null;
    });

    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("handles an empty list without starting a worker", async () => {
    let calls = 0;
    const results = await runWithLimit([], 4, async () => {
      calls += 1;
      return null;
    });

    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });

  it("still completes when the limit exceeds the number of items", async () => {
    const results = await runWithLimit(["a", "b"], 10, async (value: string) => value.toUpperCase());
    expect(results).toEqual(["A", "B"]);
  });

  it("rejects if a task rejects, rather than resolving with a hole", async () => {
    await expect(
      runWithLimit([1, 2, 3], 2, async (value: number) => {
        if (value === 2) throw new Error("boom");
        return value;
      }),
    ).rejects.toThrow("boom");
  });
});
