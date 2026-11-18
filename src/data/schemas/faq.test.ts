// @vitest-environment node
import { describe, expect, it } from "vitest";
import { faqSchema } from "./faq";

const base = {
  id: "test-question",
  edition: "all",
  source: {
    url: "https://source.example.test/faq",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  question: "Test question?",
  answer: "A **test** answer written in Markdown.",
  tags: ["test-tag"],
  related: ["other-test-entry"],
};

describe("faqSchema", () => {
  it("accepts a complete record", () => {
    expect(faqSchema.parse(valid)).toEqual(valid);
  });

  it("accepts empty tag and related lists", () => {
    expect(faqSchema.safeParse({ ...valid, tags: [], related: [] }).success).toBe(true);
  });

  it.each([
    "id",
    "edition",
    "source",
    "lastVerified",
    "confidence",
    "question",
    "answer",
    "tags",
    "related",
  ])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = faqSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it("rejects an empty question", () => {
    expect(faqSchema.safeParse({ ...valid, question: "   " }).success).toBe(false);
  });

  it("rejects an empty answer", () => {
    expect(faqSchema.safeParse({ ...valid, answer: "" }).success).toBe(false);
  });

  it("rejects an empty tag", () => {
    expect(faqSchema.safeParse({ ...valid, tags: ["test-tag", ""] }).success).toBe(false);
  });

  it("rejects a non-string related entry", () => {
    expect(faqSchema.safeParse({ ...valid, related: [42] }).success).toBe(false);
  });

  it("rejects a related entry that is not a slug", () => {
    expect(faqSchema.safeParse({ ...valid, related: ["Not A Slug"] }).success).toBe(false);
  });

  it("rejects a related entry pointing at the entry itself", () => {
    const result = faqSchema.safeParse({ ...valid, related: ["test-question"] });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === "related")).toBe(true);
  });

  it("rejects a non-https source url", () => {
    expect(
      faqSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/faq" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = faqSchema.safeParse({ ...valid, votes: 12 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
