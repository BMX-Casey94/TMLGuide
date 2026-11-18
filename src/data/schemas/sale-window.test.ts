// @vitest-environment node
import { describe, expect, it } from "vitest";
import { saleWindowSchema } from "./sale-window";

const base = {
  id: "test-sale-window",
  edition: "belgium",
  source: {
    url: "https://source.example.test/sales",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  name: "Test sale window",
  opensAt: "2026-11-21T15:00:00+01:00",
  timeZone: "Europe/Brussels",
  audience: "General sale",
};

describe("saleWindowSchema", () => {
  it("accepts a complete record", () => {
    expect(saleWindowSchema.parse(valid)).toEqual(valid);
  });

  it("accepts a Z-suffixed instant", () => {
    expect(saleWindowSchema.safeParse({ ...valid, opensAt: "2026-11-21T14:00:00Z" }).success).toBe(true);
  });

  it("accepts an optional note", () => {
    const withNote = { ...valid, notes: "Test note about this sale." };
    expect(saleWindowSchema.parse(withNote).notes).toBe("Test note about this sale.");
  });

  it.each([
    "id",
    "edition",
    "source",
    "lastVerified",
    "confidence",
    "name",
    "opensAt",
    "timeZone",
    "audience",
  ])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = saleWindowSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it.each(["2026-11-21T15:00:00", "2026-11-21", "2026-02-30T15:00:00+01:00", "21/11/2026 15:00"])(
    "rejects the offset-free or impossible instant %j",
    (opensAt) => {
      const result = saleWindowSchema.safeParse({ ...valid, opensAt });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((issue) => issue.path[0] === "opensAt")).toBe(true);
    },
  );

  it.each(["Europe/London", "UTC", "europe/brussels", ""])(
    "rejects the time zone %j",
    (timeZone) => {
      expect(saleWindowSchema.safeParse({ ...valid, timeZone }).success).toBe(false);
    },
  );

  it("rejects an empty audience", () => {
    expect(saleWindowSchema.safeParse({ ...valid, audience: "   " }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(
      saleWindowSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/sales" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = saleWindowSchema.safeParse({ ...valid, closesAt: "2026-12-01T00:00:00Z" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
