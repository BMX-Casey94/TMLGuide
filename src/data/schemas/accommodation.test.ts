// @vitest-environment node
import { describe, expect, it } from "vitest";
import { accommodationKindSchema, accommodationPricingSchema, accommodationSchema } from "./accommodation";

const base = {
  id: "test-accommodation",
  edition: "belgium",
  source: {
    url: "https://source.example.test/sleeping",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  name: "Test lodge",
  kind: "dreamville-lodge",
  nightlyOrTotalEur: 240,
  pricing: "per-stay",
  capacity: 2,
  notes: "Test note about this lodge.",
};

describe("accommodationKindSchema", () => {
  it.each(["dreamville-tent", "dreamville-lodge", "hotel", "camping", "other"])(
    "accepts %s",
    (kind) => {
      expect(accommodationKindSchema.safeParse(kind).success).toBe(true);
    },
  );

  it.each(["hostel", "Dreamville-Lodge", ""])("rejects %j", (kind) => {
    expect(accommodationKindSchema.safeParse(kind).success).toBe(false);
  });
});

describe("accommodationPricingSchema", () => {
  it.each(["per-night", "per-stay"])("accepts %s", (pricing) => {
    expect(accommodationPricingSchema.safeParse(pricing).success).toBe(true);
  });

  it.each(["nightly", "per night", ""])("rejects %j", (pricing) => {
    expect(accommodationPricingSchema.safeParse(pricing).success).toBe(false);
  });
});

describe("accommodationSchema", () => {
  it("accepts a complete record", () => {
    expect(accommodationSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    "id",
    "edition",
    "source",
    "lastVerified",
    "confidence",
    "name",
    "kind",
    "nightlyOrTotalEur",
    "pricing",
    "capacity",
    "notes",
  ])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = accommodationSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(accommodationSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejects an empty note", () => {
    expect(accommodationSchema.safeParse({ ...valid, notes: "   " }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(accommodationSchema.safeParse({ ...valid, nightlyOrTotalEur: -240 }).success).toBe(false);
  });

  it("rejects a price with more than two decimals", () => {
    expect(accommodationSchema.safeParse({ ...valid, nightlyOrTotalEur: 240.005 }).success).toBe(false);
  });

  it("rejects a capacity below one", () => {
    expect(accommodationSchema.safeParse({ ...valid, capacity: 0 }).success).toBe(false);
  });

  it("rejects a fractional capacity", () => {
    expect(accommodationSchema.safeParse({ ...valid, capacity: 1.5 }).success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(accommodationSchema.safeParse({ ...valid, kind: "hostel" }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(
      accommodationSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/sleeping" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = accommodationSchema.safeParse({ ...valid, currency: "EUR" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
