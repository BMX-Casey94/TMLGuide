// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  confidenceSchema,
  editionIdSchema,
  editionScopeSchema,
  httpsUrlSchema,
  isoDateSchema,
  isoInstantSchema,
  moneyEurSchema,
  slugSchema,
  sourceSchema,
  verifiedBase,
} from "./common";

describe("editionIdSchema", () => {
  it.each(["belgium", "winter", "brasil"])("accepts %s", (edition) => {
    expect(editionIdSchema.safeParse(edition).success).toBe(true);
  });

  it.each(["asia", "Belgium", "", "belgium "])("rejects %j", (edition) => {
    expect(editionIdSchema.safeParse(edition).success).toBe(false);
  });

  it("rejects a non-string", () => {
    expect(editionIdSchema.safeParse(1).success).toBe(false);
  });
});

describe("editionScopeSchema", () => {
  it.each(["belgium", "winter", "brasil", "all"])("accepts %s", (scope) => {
    expect(editionScopeSchema.safeParse(scope).success).toBe(true);
  });

  it.each(["every", "ALL", "eu"])("rejects %j", (scope) => {
    expect(editionScopeSchema.safeParse(scope).success).toBe(false);
  });
});

describe("slugSchema", () => {
  it.each(["a", "test-package", "winter-2026", "belgium-1"])("accepts %j", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it.each(["", "Test-Package", "test package", "test--package", "-test", "test-", "test_package"])(
    "rejects %j",
    (slug) => {
      expect(slugSchema.safeParse(slug).success).toBe(false);
    },
  );

  it("rejects a slug longer than 80 characters", () => {
    expect(slugSchema.safeParse("a".repeat(81)).success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(slugSchema.parse("  test-package  ")).toBe("test-package");
  });
});

describe("isoDateSchema", () => {
  it.each(["2026-11-18", "2028-02-29", "2026-01-01", "2026-12-31"])("accepts %s", (date) => {
    expect(isoDateSchema.safeParse(date).success).toBe(true);
  });

  it.each([
    "2027-02-30",
    "2026-02-29",
    "2026-13-01",
    "2026-00-10",
    "18-11-2026",
    "2026-11-18T00:00:00Z",
    "2026-1-01",
    "",
  ])("rejects %j", (date) => {
    expect(isoDateSchema.safeParse(date).success).toBe(false);
  });
});

describe("isoInstantSchema", () => {
  it.each(["2026-11-18T10:00:00Z", "2026-11-18T10:00:00+01:00", "2026-11-18T10:00:00.250-05:00"])(
    "accepts %s",
    (instant) => {
      expect(isoInstantSchema.safeParse(instant).success).toBe(true);
    },
  );

  it.each([
    "2026-11-18T10:00:00",
    "2026-11-18",
    "2026-11-18 10:00:00Z",
    "2026-02-30T10:00:00Z",
    "18/11/2026 10:00",
    "",
  ])("rejects %j", (instant) => {
    expect(isoInstantSchema.safeParse(instant).success).toBe(false);
  });
});

describe("httpsUrlSchema", () => {
  it.each([
    "https://example.test/",
    "https://example.test/path?query=1#fragment",
    "HTTPS://Example.test/",
    "https://example.test:8443/resource",
  ])("accepts %j", (url) => {
    expect(httpsUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each([
    "http://example.test/",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.test/",
    "//example.test/path",
    "/relative/path",
    "example.test",
    "https://",
    "https://exa mple.test/",
    "",
  ])("rejects %j", (url) => {
    expect(httpsUrlSchema.safeParse(url).success).toBe(false);
  });

  it("rejects a non-string", () => {
    expect(httpsUrlSchema.safeParse(null).success).toBe(false);
  });

  it.each([
    "https://user:password@example.test/",
    "https://user@example.test/",
    "https://:password@example.test/",
  ])("rejects the credential-bearing url %j", (url) => {
    const result = httpsUrlSchema.safeParse(url);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.message.includes("credentials"))).toBe(true);
  });

  it("rejects a url longer than 2048 characters", () => {
    const longUrl = `https://example.test/${"a".repeat(2048)}`;
    expect(httpsUrlSchema.safeParse(longUrl).success).toBe(false);
  });

  it("does not throw on a malformed value", () => {
    expect(() => httpsUrlSchema.safeParse("not a url")).not.toThrow();
  });
});

describe("sourceSchema", () => {
  const valid = {
    url: "https://source.example.test/page",
    title: "Test source",
    retrievedOn: "2026-11-01",
  };

  it("accepts a complete source", () => {
    expect(sourceSchema.parse(valid)).toEqual(valid);
  });

  it.each(["url", "title", "retrievedOn"])("rejects a missing %s", (field) => {
    const record: Record<string, unknown> = { ...valid };
    delete record[field];
    const result = sourceSchema.safeParse(record);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(sourceSchema.safeParse({ ...valid, title: "   " }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(sourceSchema.safeParse({ ...valid, url: "http://source.example.test/page" }).success).toBe(
      false,
    );
  });

  it("rejects an impossible retrieval date", () => {
    expect(sourceSchema.safeParse({ ...valid, retrievedOn: "2027-02-30" }).success).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = sourceSchema.safeParse({ ...valid, author: "Someone" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});

describe("confidenceSchema", () => {
  it.each(["official", "community", "unverified"])("accepts %s", (confidence) => {
    expect(confidenceSchema.safeParse(confidence).success).toBe(true);
  });

  it.each(["verified", "OFFICIAL", ""])("rejects %j", (confidence) => {
    expect(confidenceSchema.safeParse(confidence).success).toBe(false);
  });
});

describe("verifiedBase", () => {
  const valid = {
    id: "test-record",
    edition: "all",
    source: {
      url: "https://source.example.test/page",
      title: "Test source",
      retrievedOn: "2026-11-01",
    },
    lastVerified: "2026-11-15",
    confidence: "community",
  };

  it("accepts a complete record", () => {
    expect(verifiedBase.parse(valid)).toEqual(valid);
  });

  it.each(["id", "edition", "source", "lastVerified", "confidence"])(
    "rejects a missing %s",
    (field) => {
      const record: Record<string, unknown> = { ...valid };
      delete record[field];
      const result = verifiedBase.safeParse(record);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    },
  );

  it("rejects a non-kebab-case id", () => {
    expect(verifiedBase.safeParse({ ...valid, id: "Test_Record" }).success).toBe(false);
  });

  it("rejects an impossible lastVerified date", () => {
    expect(verifiedBase.safeParse({ ...valid, lastVerified: "2027-02-30" }).success).toBe(false);
  });

  it("rejects an unknown edition", () => {
    expect(verifiedBase.safeParse({ ...valid, edition: "asia" }).success).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = verifiedBase.safeParse({ ...valid, reviewer: "Test reviewer" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});

describe("moneyEurSchema", () => {
  it.each([0, 0.01, 7.5, 19.99, 550, 1_234.56])("accepts %d", (amount) => {
    expect(moneyEurSchema.safeParse(amount).success).toBe(true);
  });

  it.each([-1, -0.01, 19.999, 6.005, Number.NaN, Number.POSITIVE_INFINITY, "19.99", null])(
    "rejects %j",
    (amount) => {
      expect(moneyEurSchema.safeParse(amount).success).toBe(false);
    },
  );

  it("rejects a value with more than two decimals", () => {
    const result = moneyEurSchema.safeParse(3.333);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toContain("two decimals");
  });
});
