// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resourceCategorySchema, resourceSchema } from "./resource";

const base = {
  id: "test-resource",
  edition: "all",
  source: {
    url: "https://source.example.test/links",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  title: "Test resource",
  url: "https://resource.example.test/page",
  category: "official",
  description: "A test description of why the link is useful.",
};

describe("resourceCategorySchema", () => {
  it.each(["official", "transport", "accommodation", "practical", "community", "other"])(
    "accepts %s",
    (category) => {
      expect(resourceCategorySchema.safeParse(category).success).toBe(true);
    },
  );

  it.each(["links", "Official", ""])("rejects %j", (category) => {
    expect(resourceCategorySchema.safeParse(category).success).toBe(false);
  });
});

describe("resourceSchema", () => {
  it("accepts a complete record", () => {
    expect(resourceSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    "id",
    "edition",
    "source",
    "lastVerified",
    "confidence",
    "title",
    "url",
    "category",
    "description",
  ])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = resourceSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it.each(["http://resource.example.test/page", "javascript:alert(1)", "data:text/html,hi"])(
    "rejects the non-https url %j",
    (url) => {
      const result = resourceSchema.safeParse({ ...valid, url });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((issue) => issue.path[0] === "url")).toBe(true);
    },
  );

  it("rejects an empty title", () => {
    expect(resourceSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
  });

  it("rejects an empty description", () => {
    expect(resourceSchema.safeParse({ ...valid, description: "" }).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(resourceSchema.safeParse({ ...valid, category: "links" }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(
      resourceSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/links" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = resourceSchema.safeParse({ ...valid, featured: true });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
