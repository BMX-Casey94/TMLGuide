// @vitest-environment node
import { describe, expect, it } from "vitest";
import { partnerSchema } from "./partner";

const base = {
  id: "test-partner",
  edition: "all",
  source: {
    url: "https://source.example.test/partners",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  name: "Test partner",
  url: "https://partner.example.test/offer",
  offer: "Test offer for readers",
  disclosure: "TMLGUIDE may earn a commission if you buy through this link.",
};

describe("partnerSchema", () => {
  it("accepts a complete record", () => {
    expect(partnerSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an optional promo code", () => {
    expect(partnerSchema.parse({ ...valid, promoCode: "TESTCODE" }).promoCode).toBe("TESTCODE");
  });

  it.each([
    "id",
    "edition",
    "source",
    "lastVerified",
    "confidence",
    "name",
    "url",
    "offer",
    "disclosure",
  ])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = partnerSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it("rejects a disclosure shorter than 20 characters", () => {
    const result = partnerSchema.safeParse({ ...valid, disclosure: "Affiliate link." });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === "disclosure")).toBe(true);
  });

  it("accepts a 20-character disclosure", () => {
    expect(partnerSchema.safeParse({ ...valid, disclosure: "a".repeat(20) }).success).toBe(true);
  });

  it("rejects an empty promo code", () => {
    expect(partnerSchema.safeParse({ ...valid, promoCode: "  " }).success).toBe(false);
  });

  it.each(["http://partner.example.test/offer", "javascript:alert(1)", "data:text/html,hi"])(
    "rejects the non-https url %j",
    (url) => {
      const result = partnerSchema.safeParse({ ...valid, url });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((issue) => issue.path[0] === "url")).toBe(true);
    },
  );

  it("rejects an empty offer", () => {
    expect(partnerSchema.safeParse({ ...valid, offer: "   " }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(
      partnerSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/partners" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = partnerSchema.safeParse({ ...valid, commission: 5 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
