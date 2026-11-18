// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildShareUrl,
  clearToolState,
  loadToolState,
  safeLocalStorage,
  saveToolState,
  type StorageLike,
} from "./state";

/** A schema deliberately narrow, so each rejection test names one cause. */
const planSchema = z.strictObject({
  people: z.number().int().min(1).max(40),
  amount: z.number().int().min(0).max(100_000_000),
  edition: z.enum(["belgium", "winter", "brasil"]),
});

type Plan = z.infer<typeof planSchema>;

const validPlan: Plan = { people: 3, amount: 25_000, edition: "belgium" };

const QUERY_KEY = "plan";
const STORAGE_KEY = "tml-plan-v1";

/** An in-memory Storage that behaves like the real one. */
function memoryStorage(initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map),
  };
}

function load(search: string, storage: StorageLike | null): ReturnType<typeof loadToolState<Plan>> {
  return loadToolState({
    schema: planSchema,
    queryKey: QUERY_KEY,
    storageKey: STORAGE_KEY,
    search,
    storage,
  });
}

describe("loadToolState", () => {
  it("reads a valid plan from the query string", () => {
    const search = `?${QUERY_KEY}=${encodeURIComponent(JSON.stringify(validPlan))}`;
    expect(load(search, null)).toEqual({ state: validPlan, origin: "url", discarded: false });
  });

  it("prefers a valid query string over stored state", () => {
    const stored = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ ...validPlan, people: 9 }) });
    const search = `?${QUERY_KEY}=${encodeURIComponent(JSON.stringify(validPlan))}`;
    expect(load(search, stored).state).toEqual(validPlan);
  });

  it("falls back to storage when the query string has nothing usable", () => {
    const stored = memoryStorage({ [STORAGE_KEY]: JSON.stringify(validPlan) });
    expect(load("", stored)).toEqual({ state: validPlan, origin: "storage", discarded: false });
  });

  it("ignores a corrupt query string and uses storage instead", () => {
    const stored = memoryStorage({ [STORAGE_KEY]: JSON.stringify(validPlan) });
    const result = load(`?${QUERY_KEY}=not-json`, stored);
    expect(result.state).toEqual(validPlan);
    expect(result.origin).toBe("storage");
  });

  it("reports that data was discarded when nothing usable is left", () => {
    const result = load(`?${QUERY_KEY}=not-json`, null);
    expect(result.state).toBeNull();
    expect(result.origin).toBe("default");
    expect(result.discarded).toBe(true);
  });

  it("rejects a plan whose numbers are out of range", () => {
    const tooMany = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ ...validPlan, people: 4000 }) });
    expect(load("", tooMany).state).toBeNull();

    const negative = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ ...validPlan, amount: -1 }) });
    expect(load("", negative).state).toBeNull();

    const huge = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ ...validPlan, amount: Number.MAX_SAFE_INTEGER }),
    });
    expect(load("", huge).state).toBeNull();
  });

  it("rejects NaN, Infinity and numeric strings", () => {
    // JSON has no NaN literal, so these arrive as the strings JSON can carry.
    for (const value of ["NaN", "Infinity", "-Infinity", "3", null, {}]) {
      const stored = memoryStorage({
        [STORAGE_KEY]: JSON.stringify({ ...validPlan, people: value }),
      });
      expect(load("", stored).state).toBeNull();
    }

    // A hand-written query string can still carry a bare NaN.
    const search = `?${QUERY_KEY}=${encodeURIComponent('{"people":NaN,"amount":1,"edition":"belgium"}')}`;
    expect(load(search, null).state).toBeNull();
  });

  it("rejects an unknown edition and unknown extra keys", () => {
    const badEdition = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ ...validPlan, edition: "mars" }),
    });
    expect(load("", badEdition).state).toBeNull();

    const extraKey = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ ...validPlan, injected: true }),
    });
    expect(load("", extraKey).state).toBeNull();
  });

  it("rejects a JSON value that is not an object", () => {
    for (const value of ["null", "42", '"plan"', "[1,2,3]"]) {
      const stored = memoryStorage({ [STORAGE_KEY]: value });
      expect(load("", stored).state).toBeNull();
    }
  });

  it("drops an ambiguous repeated query key", () => {
    const one = JSON.stringify({ ...validPlan, people: 2 });
    const two = JSON.stringify({ ...validPlan, people: 3 });
    const search = `?${QUERY_KEY}=${encodeURIComponent(one)}&${QUERY_KEY}=${encodeURIComponent(two)}`;
    const result = load(search, null);
    expect(result.state).toBeNull();
  });

  it("treats an unreadable storage object as absent rather than throwing", () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => load("", throwing)).not.toThrow();
    expect(load("", throwing)).toEqual({ state: null, origin: "default", discarded: false });
  });

  it("does not treat an empty stored value as corrupt", () => {
    const stored = memoryStorage({ [STORAGE_KEY]: "" });
    expect(load("", stored)).toEqual({ state: null, origin: "default", discarded: false });
  });
});

describe("saveToolState and clearToolState", () => {
  it("writes the plan as JSON and removes it on clear", () => {
    const storage = memoryStorage();
    saveToolState(storage, STORAGE_KEY, validPlan);
    expect(JSON.parse(storage.dump()[STORAGE_KEY])).toEqual(validPlan);

    clearToolState(storage, STORAGE_KEY);
    expect(storage.dump()[STORAGE_KEY]).toBeUndefined();
  });

  it("swallows a refused write so the page keeps working", () => {
    const refusing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => saveToolState(refusing, STORAGE_KEY, validPlan)).not.toThrow();
    expect(() => clearToolState(refusing, STORAGE_KEY)).not.toThrow();
  });

  it("does nothing when there is no storage", () => {
    expect(() => saveToolState(null, STORAGE_KEY, validPlan)).not.toThrow();
    expect(() => clearToolState(null, STORAGE_KEY)).not.toThrow();
  });
});

describe("buildShareUrl", () => {
  it("puts the plan in one parameter and drops every existing one", () => {
    const url = buildShareUrl("https://example.test", "/tools/budget", QUERY_KEY, validPlan);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/tools/budget");
    expect([...parsed.searchParams.keys()]).toEqual([QUERY_KEY]);
    expect(JSON.parse(parsed.searchParams.get(QUERY_KEY) ?? "")).toEqual(validPlan);
  });

  it("tolerates a trailing slash on the origin and a missing leading slash on the path", () => {
    expect(buildShareUrl("https://example.test/", "tools/budget", QUERY_KEY, validPlan)).toMatch(
      /^https:\/\/example\.test\/tools\/budget\?/,
    );
  });

  it("round-trips through the loader", () => {
    const url = buildShareUrl("https://example.test", "/tools/budget", QUERY_KEY, validPlan);
    const search = new URL(url).search;
    expect(load(search, null).state).toEqual(validPlan);
  });
});

describe("safeLocalStorage", () => {
  it("returns null when there is no window at all", () => {
    // This file runs in the node environment, so `window` genuinely is absent.
    // safeLocalStorage must report that rather than throwing.
    expect(typeof globalThis.window).toBe("undefined");
    expect(safeLocalStorage()).toBeNull();
  });
});
