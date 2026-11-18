// @vitest-environment node
import { describe, expect, it } from "vitest";
import { shuttleSchema } from "./shuttle";

const base = {
  id: "test-shuttle",
  edition: "belgium",
  source: {
    url: "https://source.example.test/shuttles",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  name: "Test shuttle",
  route: "Test town to test entrance",
  priceEur: 20,
  operator: "Test operator",
  notes: "Test note about this shuttle.",
};

describe("shuttleSchema", () => {
  it("accepts a complete record", () => {
    expect(shuttleSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an https booking url", () => {
    const withBooking = { ...valid, bookingUrl: "https://booking.example.test/route" };
    expect(shuttleSchema.parse(withBooking).bookingUrl).toBe("https://booking.example.test/route");
  });

  it("accepts a record without a booking url", () => {
    expect(shuttleSchema.parse(valid).bookingUrl).toBeUndefined();
  });

  it.each([
    "id",
    "edition",
    "source",
    "lastVerified",
    "confidence",
    "name",
    "route",
    "priceEur",
    "operator",
    "notes",
  ])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = shuttleSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it.each([
    "http://booking.example.test/route",
    "javascript:alert(1)",
    "data:text/html,hi",
    "booking.example.test/route",
  ])("rejects the non-https booking url %j", (bookingUrl) => {
    const result = shuttleSchema.safeParse({ ...valid, bookingUrl });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === "bookingUrl")).toBe(true);
  });

  it("rejects a non-https source url", () => {
    expect(
      shuttleSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/shuttles" },
      }).success,
    ).toBe(false);
  });

  it("rejects an empty route", () => {
    expect(shuttleSchema.safeParse({ ...valid, route: "  " }).success).toBe(false);
  });

  it("rejects an empty operator", () => {
    expect(shuttleSchema.safeParse({ ...valid, operator: "" }).success).toBe(false);
  });

  it("rejects an empty note", () => {
    expect(shuttleSchema.safeParse({ ...valid, notes: "" }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(shuttleSchema.safeParse({ ...valid, priceEur: -20 }).success).toBe(false);
  });

  it("rejects a price with more than two decimals", () => {
    expect(shuttleSchema.safeParse({ ...valid, priceEur: 20.505 }).success).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = shuttleSchema.safeParse({ ...valid, seats: 50 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
