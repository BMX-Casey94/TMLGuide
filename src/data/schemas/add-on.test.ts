// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addOnCategorySchema, addOnSchema } from "./add-on";

const base = {
  id: "test-add-on",
  edition: "belgium",
  source: {
    url: "https://source.example.test/add-ons",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  name: "Test dinner",
  priceEur: 55,
  category: "dining",
};

describe("addOnCategorySchema", () => {
  it.each([
    "dining",
    "parking",
    "breakfast",
    "drinks",
    "experience",
    "rental",
    "transport",
    "other",
  ])("accepts %s", (category) => {
    expect(addOnCategorySchema.safeParse(category).success).toBe(true);
  });

  it.each(["food", "Dining", ""])("rejects %j", (category) => {
    expect(addOnCategorySchema.safeParse(category).success).toBe(false);
  });
});

describe("addOnSchema", () => {
  it("accepts a complete record", () => {
    expect(addOnSchema.parse(valid)).toEqual(valid);
  });

  it.each(["id", "edition", "source", "lastVerified", "confidence", "name", "priceEur", "category"])(
    "rejects a missing %s",
    (field) => {
      const record: Record<string, unknown> = { ...valid };
      delete record[field];
      const result = addOnSchema.safeParse(record);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    },
  );

  it("rejects an empty name", () => {
    expect(addOnSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(addOnSchema.safeParse({ ...valid, priceEur: -55 }).success).toBe(false);
  });

  it("rejects a price with more than two decimals", () => {
    expect(addOnSchema.safeParse({ ...valid, priceEur: 55.555 }).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(addOnSchema.safeParse({ ...valid, category: "food" }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(
      addOnSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/add-ons" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = addOnSchema.safeParse({ ...valid, perPerson: true });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
