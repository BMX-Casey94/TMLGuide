// @vitest-environment node
import { describe, expect, it } from "vitest";
import { pearlBundleSchema } from "./pearl-bundle";

const base = {
  id: "test-pearl-bundle",
  edition: "all",
  source: {
    url: "https://source.example.test/pearls",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  pearls: 35,
  priceEur: 66.5,
};

describe("pearlBundleSchema", () => {
  it("accepts a complete record", () => {
    expect(pearlBundleSchema.parse(valid)).toEqual(valid);
  });

  it.each(["id", "edition", "source", "lastVerified", "confidence", "pearls", "priceEur"])(
    "rejects a missing %s",
    (field) => {
      const record: Record<string, unknown> = { ...valid };
      delete record[field];
      const result = pearlBundleSchema.safeParse(record);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    },
  );

  it("rejects zero Pearls", () => {
    expect(pearlBundleSchema.safeParse({ ...valid, pearls: 0 }).success).toBe(false);
  });

  it("rejects a fractional Pearl count", () => {
    expect(pearlBundleSchema.safeParse({ ...valid, pearls: 3.5 }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(pearlBundleSchema.safeParse({ ...valid, priceEur: -66.5 }).success).toBe(false);
  });

  it("rejects a price with more than two decimals", () => {
    expect(pearlBundleSchema.safeParse({ ...valid, priceEur: 66.505 }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(
      pearlBundleSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/pearls" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = pearlBundleSchema.safeParse({ ...valid, bonusPearls: 2 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
