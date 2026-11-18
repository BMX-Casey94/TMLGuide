// @vitest-environment node
import { describe, expect, it } from "vitest";
import { whatsappGroupSchema, whatsappLinkStatusSchema } from "./whatsapp-group";

const base = {
  id: "test-group",
  edition: "belgium",
  source: {
    url: "https://source.example.test/groups",
    title: "Test source",
    retrievedOn: "2026-11-01",
  },
  lastVerified: "2026-11-15",
  confidence: "community",
};

const valid = {
  ...base,
  title: "Test group",
  region: "Test region",
  inviteUrl: "https://chat.example.test/invite/test",
};

describe("whatsappLinkStatusSchema", () => {
  it.each(["ok", "dead", "unchecked"])("accepts %s", (status) => {
    expect(whatsappLinkStatusSchema.safeParse(status).success).toBe(true);
  });

  it.each(["live", "OK", ""])("rejects %j", (status) => {
    expect(whatsappLinkStatusSchema.safeParse(status).success).toBe(false);
  });
});

describe("whatsappGroupSchema", () => {
  it("accepts a complete record and defaults linkStatus to unchecked", () => {
    const parsed = whatsappGroupSchema.parse(valid);
    expect(parsed).toEqual({ ...valid, linkStatus: "unchecked" });
  });

  it("accepts an explicit link status with a check date", () => {
    const parsed = whatsappGroupSchema.parse({
      ...valid,
      linkStatus: "ok",
      lastLinkCheck: "2026-11-14",
    });
    expect(parsed.linkStatus).toBe("ok");
    expect(parsed.lastLinkCheck).toBe("2026-11-14");
  });

  it.each(["id", "edition", "source", "lastVerified", "confidence", "title", "region", "inviteUrl"])(
    "rejects a missing %s",
    (field) => {
      const record: Record<string, unknown> = { ...valid };
      delete record[field];
      const result = whatsappGroupSchema.safeParse(record);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    },
  );

  it("rejects an empty title", () => {
    expect(whatsappGroupSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
  });

  it("rejects an empty region", () => {
    expect(whatsappGroupSchema.safeParse({ ...valid, region: "" }).success).toBe(false);
  });

  it.each([
    "http://chat.example.test/invite/test",
    "javascript:alert(1)",
    "data:text/plain,invite",
    "chat.example.test/invite/test",
  ])("rejects the non-https invite url %j", (inviteUrl) => {
    const result = whatsappGroupSchema.safeParse({ ...valid, inviteUrl });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === "inviteUrl")).toBe(true);
  });

  it("rejects an impossible lastLinkCheck date", () => {
    expect(
      whatsappGroupSchema.safeParse({ ...valid, lastLinkCheck: "2027-02-30" }).success,
    ).toBe(false);
  });

  it("rejects an unknown link status", () => {
    expect(whatsappGroupSchema.safeParse({ ...valid, linkStatus: "live" }).success).toBe(false);
  });

  it("rejects a non-https source url", () => {
    expect(
      whatsappGroupSchema.safeParse({
        ...valid,
        source: { ...base.source, url: "http://source.example.test/groups" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = whatsappGroupSchema.safeParse({ ...valid, members: 250 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
  });
});
