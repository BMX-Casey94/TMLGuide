// @vitest-environment node
import { describe, expect, it } from "vitest";
import { stageKindSchema, stageSchema } from "./stage";

const base = {
  id: "test-stage",
  edition: "belgium",
  source: {
    url: "https://source.example.test/stages",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  name: "Test stage",
  kind: "open-air",
  description: "A test description long enough to be plausible.",
};

describe("stageKindSchema", () => {
  it.each(["mainstage", "open-air", "indoor", "club", "experience", "other"])(
    "accepts %s",
    (kind) => {
      expect(stageKindSchema.safeParse(kind).success).toBe(true);
    },
  );

  it.each(["outdoor", "Open-Air", ""])("rejects %j", (kind) => {
    expect(stageKindSchema.safeParse(kind).success).toBe(false);
  });
});

describe("stageSchema", () => {
  it("accepts a complete record", () => {
    expect(stageSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    "id",
    "edition",
    "source",
    "lastVerified",
    "confidence",
    "name",
    "kind",
    "description",
  ])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = stageSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it("rejects the edition-neutral scope", () => {
    const result = stageSchema.safeParse({ ...valid, edition: "all" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === "edition")).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(stageSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });

  it("rejects an empty description", () => {
    expect(stageSchema.safeParse({ ...valid, description: "" }).success).toBe(false);
  });

  it("rejects a description longer than 1200 characters", () => {
    expect(stageSchema.safeParse({ ...valid, description: "a".repeat(1201) }).success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(stageSchema.safeParse({ ...valid, kind: "outdoor" }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(
      stageSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/stages" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = stageSchema.safeParse({ ...valid, capacity: 1000 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
