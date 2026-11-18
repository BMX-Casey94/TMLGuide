import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RECENT_SEARCHES,
  RECENT_SEARCHES_KEY,
  addRecentSearch,
  clearRecentSearches,
  readRecentSearches,
} from "./recent";
import { installStorage } from "@/components/search/test-environment";

/**
 * The recents store is pure DOM storage access, so it can run in the node
 * environment with the same in-memory `Storage` the palette tests use.
 */
beforeEach(() => {
  installStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function stored(): unknown {
  const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
  return raw === null ? null : JSON.parse(raw);
}

describe("readRecentSearches", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(readRecentSearches()).toEqual([]);
  });

  it("reads a valid list in order", () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(["pearls", "lockers"]));
    expect(readRecentSearches()).toEqual(["pearls", "lockers"]);
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["a bare string", '"pearls"'],
    ["a number", "42"],
    ["null", "null"],
    ["an object", '{"a":1}'],
    ["an array of numbers", "[1,2,3]"],
    ["an array with nulls", '["pearls",null]'],
    ["an array with non-strings", '["pearls",{"x":1}]'],
    ["an array of empty strings", '["",""]'],
    ["an array of whitespace only", '["   "]'],
  ])("discards %s", (_label, value) => {
    localStorage.setItem(RECENT_SEARCHES_KEY, value);
    expect(readRecentSearches()).toEqual([]);
  });

  it("clears a corrupt value so it is not re-read every time", () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, "{not json");
    readRecentSearches();
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
  });

  it("truncates an over-long stored list rather than discarding it", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g"];
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(many));
    expect(readRecentSearches()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("drops queries longer than the schema allows", () => {
    const tooLong = "x".repeat(120);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(["pearls", tooLong]));
    expect(readRecentSearches()).toEqual([]);
  });

  it("deduplicates entries a hand edit may have introduced", () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(["pearls", "pearls", "lockers"]));
    expect(readRecentSearches()).toEqual(["pearls", "lockers"]);
  });

  it("tolerates storage that throws on read", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readRecentSearches()).toEqual([]);
  });
});

describe("addRecentSearch", () => {
  it("records a trimmed search", () => {
    expect(addRecentSearch("  pearls  ")).toEqual(["pearls"]);
    expect(stored()).toEqual(["pearls"]);
  });

  it("collapses internal whitespace", () => {
    expect(addRecentSearch("alpe   dhuez")).toEqual(["alpe dhuez"]);
  });

  it("puts the newest first", () => {
    addRecentSearch("pearls");
    addRecentSearch("lockers");
    expect(readRecentSearches()).toEqual(["lockers", "pearls"]);
  });

  it("moves a repeated search to the front without duplicating it", () => {
    addRecentSearch("pearls");
    addRecentSearch("lockers");
    addRecentSearch("pearls");
    expect(readRecentSearches()).toEqual(["pearls", "lockers"]);
  });

  it("matches duplicates case-insensitively", () => {
    addRecentSearch("Pearls");
    addRecentSearch("pearls");
    expect(readRecentSearches()).toEqual(["pearls"]);
  });

  it(`keeps at most ${MAX_RECENT_SEARCHES} entries`, () => {
    for (const term of ["one", "two", "three", "four", "five", "six", "seven"]) {
      addRecentSearch(term);
    }
    expect(readRecentSearches()).toHaveLength(MAX_RECENT_SEARCHES);
    expect(readRecentSearches()[0]).toBe("seven");
  });

  it("ignores an empty or whitespace-only query", () => {
    addRecentSearch("pearls");
    expect(addRecentSearch("   ")).toEqual(["pearls"]);
    expect(addRecentSearch("")).toEqual(["pearls"]);
  });

  it("caps a very long query rather than rejecting it", () => {
    const result = addRecentSearch("z".repeat(200));
    expect(result[0]).toHaveLength(80);
  });

  it("does not throw when storage refuses writes", () => {
    addRecentSearch("pearls");
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    // The write fails silently, but the caller still gets a usable list.
    expect(() => addRecentSearch("pearls")).not.toThrow();
    expect(addRecentSearch("lockers")).toEqual(["lockers", "pearls"]);
    expect(readRecentSearches()).toEqual(["pearls"]);
  });
});

describe("clearRecentSearches", () => {
  it("removes the key", () => {
    addRecentSearch("pearls");
    clearRecentSearches();
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
    expect(readRecentSearches()).toEqual([]);
  });

  it("does not throw when clearing fails", () => {
    vi.spyOn(window.localStorage, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => clearRecentSearches()).not.toThrow();
  });
});
