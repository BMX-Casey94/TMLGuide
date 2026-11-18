// @vitest-environment node
import { describe, expect, it } from "vitest";
import { lockerSchema } from "./locker";

const base = {
  id: "test-locker",
  edition: "belgium",
  source: {
    url: "https://source.example.test/lockers",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  name: "Test locker",
  size: "20 x 30 x 45 cm",
  priceEur: 7.5,
  notes: "Test note about the rental period.",
};

describe("lockerSchema", () => {
  it("accepts a complete record", () => {
    expect(lockerSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    "id",
    "edition",
    "source",
    "lastVerified",
    "confidence",
    "name",
    "size",
    "priceEur",
    "notes",
  ])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = lockerSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(lockerSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejects an empty size", () => {
    expect(lockerSchema.safeParse({ ...valid, size: "   " }).success).toBe(false);
  });

  it("rejects an empty note", () => {
    expect(lockerSchema.safeParse({ ...valid, notes: "" }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(lockerSchema.safeParse({ ...valid, priceEur: -7.5 }).success).toBe(false);
  });

  it("rejects a price with more than two decimals", () => {
    expect(lockerSchema.safeParse({ ...valid, priceEur: 7.505 }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(
      lockerSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/lockers" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = lockerSchema.safeParse({ ...valid, depositEur: 5 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
