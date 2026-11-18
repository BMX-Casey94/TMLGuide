// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ticketPackageSchema, ticketTierSchema } from "./ticket-package";

const base = {
  id: "test-package",
  edition: "belgium",
  source: {
    url: "https://source.example.test/packages",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  name: "Test package",
  tier: "regular",
  nights: 0,
  priceEur: 129,
  includes: ["Festival access"],
};

describe("ticketTierSchema", () => {
  it.each(["regular", "comfort", "premium", "hospitality"])("accepts %s", (tier) => {
    expect(ticketTierSchema.safeParse(tier).success).toBe(true);
  });

  it.each(["vip", "Regular", ""])("rejects %j", (tier) => {
    expect(ticketTierSchema.safeParse(tier).success).toBe(false);
  });
});

describe("ticketPackageSchema", () => {
  it("accepts a complete package", () => {
    expect(ticketPackageSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an optional note", () => {
    const withNote = { ...valid, notes: "Test note about this package." };
    expect(ticketPackageSchema.parse(withNote).notes).toBe("Test note about this package.");
  });

  it.each([
    "id",
    "edition",
    "source",
    "lastVerified",
    "confidence",
    "name",
    "tier",
    "nights",
    "priceEur",
    "includes",
  ])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = ticketPackageSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(ticketPackageSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });

  it("rejects an empty includes list", () => {
    expect(ticketPackageSchema.safeParse({ ...valid, includes: [] }).success).toBe(false);
  });

  it("rejects an empty inclusion", () => {
    expect(ticketPackageSchema.safeParse({ ...valid, includes: ["Festival access", " "] }).success).toBe(
      false,
    );
  });

  it("rejects a fractional or negative night count", () => {
    expect(ticketPackageSchema.safeParse({ ...valid, nights: 1.5 }).success).toBe(false);
    expect(ticketPackageSchema.safeParse({ ...valid, nights: -1 }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(ticketPackageSchema.safeParse({ ...valid, priceEur: -1 }).success).toBe(false);
  });

  it("rejects a price with more than two decimals", () => {
    expect(ticketPackageSchema.safeParse({ ...valid, priceEur: 129.999 }).success).toBe(false);
  });

  it("rejects an unknown tier", () => {
    expect(ticketPackageSchema.safeParse({ ...valid, tier: "vip" }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(
      ticketPackageSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/packages" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = ticketPackageSchema.safeParse({ ...valid, discount: 10 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });

  it("rejects an empty note rather than storing a blank string", () => {
    expect(ticketPackageSchema.safeParse({ ...valid, notes: "   " }).success).toBe(false);
  });
});
