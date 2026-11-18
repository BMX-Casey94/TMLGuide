// @vitest-environment node
import { describe, expect, it } from "vitest";
import { newsItemSchema } from "./news-item";

const base = {
  id: "test-news-item",
  edition: "all",
  source: {
    url: "https://source.example.test/news",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  title: "Test news item",
  slug: "test-news-item",
  publishedOn: "2026-11-10",
  summary: "A test summary of the announcement.",
  body: "A **test** body written in Markdown.",
  tags: ["test-tag"],
};

describe("newsItemSchema", () => {
  it("accepts a complete record", () => {
    expect(newsItemSchema.parse(valid)).toEqual(valid);
  });

  it("accepts empty tags", () => {
    expect(newsItemSchema.safeParse({ ...valid, tags: [] }).success).toBe(true);
  });

  it.each([
    "id",
    "edition",
    "source",
    "lastVerified",
    "confidence",
    "title",
    "slug",
    "publishedOn",
    "summary",
    "body",
    "tags",
  ])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = newsItemSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(newsItemSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
  });

  it("rejects an empty summary", () => {
    expect(newsItemSchema.safeParse({ ...valid, summary: "" }).success).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(newsItemSchema.safeParse({ ...valid, body: "   " }).success).toBe(false);
  });

  it("rejects an empty tag", () => {
    expect(newsItemSchema.safeParse({ ...valid, tags: [""] }).success).toBe(false);
  });

  it("rejects an impossible publication date", () => {
    expect(newsItemSchema.safeParse({ ...valid, publishedOn: "2027-02-30" }).success).toBe(false);
  });

  it("rejects a slug that is not kebab-case", () => {
    expect(newsItemSchema.safeParse({ ...valid, slug: "Test News Item" }).success).toBe(false);
  });

  it("allows a slug that differs from the id", () => {
    expect(newsItemSchema.safeParse({ ...valid, slug: "another-news-item" }).success).toBe(true);
  });

  it("rejects a non-https source url", () => {
    expect(
      newsItemSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/news" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = newsItemSchema.safeParse({ ...valid, author: "Test author" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
