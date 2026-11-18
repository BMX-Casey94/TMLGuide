// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertUniqueIds, assertUniqueSlugs, isStale } from "./index";

describe("isStale", () => {
  const now = new Date("2026-11-18T15:44:00Z");

  it("reports a record verified today as fresh", () => {
    expect(isStale("2026-11-18", now, 0)).toBe(false);
  });

  it("reports a record verified exactly maxAgeDays ago as fresh (inclusive boundary)", () => {
    expect(isStale("2026-11-11", now, 7)).toBe(false);
  });

  it("reports a record one day past the window as stale", () => {
    expect(isStale("2026-11-10", now, 7)).toBe(true);
  });

  it("compares whole calendar days, not elapsed hours", () => {
    const early = new Date("2026-11-18T00:00:00Z");
    const late = new Date("2026-11-18T23:59:59.999Z");
    expect(isStale("2026-11-18", early, 0)).toBe(false);
    expect(isStale("2026-11-18", late, 0)).toBe(false);
  });

  it("treats a future verification date as fresh", () => {
    expect(isStale("2026-12-01", now, 1)).toBe(false);
  });

  it("handles a one-year window spanning a leap day", () => {
    expect(isStale("2025-11-17", now, 366)).toBe(false);
    expect(isStale("2025-11-17", now, 365)).toBe(true);
    expect(isStale("2025-11-18", now, 365)).toBe(false);
  });

  it("measures against a large window", () => {
    expect(isStale("2020-01-01", now, 2512)).toBe(true);
    expect(isStale("2020-01-01", now, 2513)).toBe(false);
  });

  it("accepts the epoch date", () => {
    expect(isStale("1970-01-01", now, 0)).toBe(true);
  });

  it("throws RangeError for an impossible calendar date", () => {
    expect(() => isStale("2027-02-30", now, 7)).toThrow(RangeError);
  });

  it.each(["2026-13-01", "18-11-2026", "2026-11-18T00:00:00Z", "", "not-a-date"])(
    "throws RangeError for %j",
    (value) => {
      expect(() => isStale(value, now, 7)).toThrow(RangeError);
    },
  );

  it("throws RangeError for an invalid now", () => {
    expect(() => isStale("2026-11-18", new Date(Number.NaN), 7)).toThrow(RangeError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws RangeError for maxAgeDays %j",
    (maxAgeDays) => {
      expect(() => isStale("2026-11-18", now, maxAgeDays)).toThrow(RangeError);
    },
  );

  it("names the offending input in the RangeError message", () => {
    expect(() => isStale("2027-02-30", now, 7)).toThrow(/2027-02-30/);
  });
});

describe("assertUniqueIds", () => {
  it("accepts an empty collection", () => {
    expect(() => assertUniqueIds([])).not.toThrow();
  });

  it("accepts unique ids", () => {
    expect(() => assertUniqueIds([{ id: "a" }, { id: "b" }, { id: "c" }])).not.toThrow();
  });

  it("throws on a duplicated id and names it", () => {
    expect(() => assertUniqueIds([{ id: "test-id" }, { id: "other-id" }, { id: "test-id" }])).toThrow(
      /test-id/,
    );
  });

  it("throws an Error (not a generic throw) on a duplicate", () => {
    let caught: unknown;
    try {
      assertUniqueIds([{ id: "test-id" }, { id: "test-id" }]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
  });

  it("throws when an id is empty", () => {
    expect(() => assertUniqueIds([{ id: "" }])).toThrow(Error);
  });
});

describe("assertUniqueSlugs", () => {
  it("accepts an empty collection", () => {
    expect(() => assertUniqueSlugs([])).not.toThrow();
  });

  it("accepts unique slugs", () => {
    expect(() =>
      assertUniqueSlugs([{ slug: "first-post" }, { slug: "second-post" }]),
    ).not.toThrow();
  });

  it("throws on a duplicated slug and names it", () => {
    expect(() =>
      assertUniqueSlugs([{ slug: "test-post" }, { slug: "other-post" }, { slug: "test-post" }]),
    ).toThrow(/test-post/);
  });

  it("throws an Error instance on a duplicate", () => {
    let caught: unknown;
    try {
      assertUniqueSlugs([{ slug: "test-post" }, { slug: "test-post" }]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
  });

  it("throws when a slug is empty", () => {
    expect(() => assertUniqueSlugs([{ slug: "" }])).toThrow(Error);
  });
});
