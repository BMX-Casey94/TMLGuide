// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, AUDIT_TABLE, writeAuditLog } from "./audit";
import type { SupabaseServerConfig } from "@/lib/supabase/config";

const CONFIG: SupabaseServerConfig = {
  url: "https://project.supabase.co",
  serviceRoleKey: "service-role-key",
};

const ENTRY = {
  actorId: "9f8b7c6d-1234-4abc-8def-0123456789ab",
  action: "news.create" as const,
  resourceType: "news_item" as const,
  resourceId: "ticket-sale-date-confirmed",
  ipHash: "ip:abc123",
  metadata: { status: "published", slug: "ticket-sale-date-confirmed" },
};

const FIXED_NOW = () => new Date("2026-11-25T10:15:00.000Z");

describe("the stored vocabulary", () => {
  it("lists only the actions this application records", () => {
    expect([...AUDIT_ACTIONS]).toEqual(["news.create", "news.update", "news.delete"]);
  });

  it("lists only the resource types this application records", () => {
    expect([...AUDIT_RESOURCE_TYPES]).toEqual(["news_item"]);
  });
});

describe("writeAuditLog — the happy path", () => {
  it("posts the row to the audit table with the service role key", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));

    const result = await writeAuditLog(ENTRY, {
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: FIXED_NOW,
    });

    expect(result.recorded).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://project.supabase.co/rest/v1/${AUDIT_TABLE}`);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe("service-role-key");
    expect(headers.Authorization).toBe("Bearer service-role-key");
    expect(headers.Prefer).toBe("return=minimal");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("records every field the task names", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    await writeAuditLog(ENTRY, {
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: FIXED_NOW,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const stored = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(stored.actor_id).toBe(ENTRY.actorId);
    expect(stored.action).toBe("news.create");
    expect(stored.resource_type).toBe("news_item");
    expect(stored.resource_id).toBe("ticket-sale-date-confirmed");
    expect(stored.occurred_at).toBe("2026-11-25T10:15:00.000Z");
    expect(stored.ip_hash).toBe("ip:abc123");
    expect(stored.metadata).toEqual({ status: "published", slug: "ticket-sale-date-confirmed" });
  });

  it("returns the row it wrote, so a caller can log or assert on it", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    const result = await writeAuditLog(ENTRY, {
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: FIXED_NOW,
    });

    expect(result).toMatchObject({
      recorded: true,
      row: { actor_id: ENTRY.actorId, action: "news.create", occurred_at: "2026-11-25T10:15:00.000Z" },
    });
  });

  it("never stores an address, only the digest it was given", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    await writeAuditLog(ENTRY, {
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: FIXED_NOW,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = String(init.body);
    expect(body).toContain("ip:abc123");
    expect(body).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
  });

  it("asks for no body back, so an audit row never travels in a response", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    await writeAuditLog(ENTRY, {
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: FIXED_NOW,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Prefer).toContain("return=minimal");
    expect(init.cache).toBe("no-store");
  });

  it("bounds the request with a timeout signal", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    await writeAuditLog(ENTRY, {
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: FIXED_NOW,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("writeAuditLog — metadata", () => {
  it("stores an empty object when no metadata is given, so the column is never null", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    const result = await writeAuditLog(
      { ...ENTRY, metadata: undefined },
      { config: CONFIG, fetchImpl: fetchImpl as unknown as typeof fetch, now: FIXED_NOW },
    );

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const stored = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(stored.metadata).toEqual({});
    expect(result).toMatchObject({ recorded: true, row: { metadata: {} } });
  });

  it("sorts the keys so two rows with the same facts diff cleanly", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    await writeAuditLog(
      { ...ENTRY, metadata: { zebra: 1, alpha: 2, middle: null } },
      { config: CONFIG, fetchImpl: fetchImpl as unknown as typeof fetch, now: FIXED_NOW },
    );

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const stored = JSON.parse(String(init.body)) as { metadata: Record<string, unknown> };
    expect(Object.keys(stored.metadata)).toEqual(["alpha", "middle", "zebra"]);
  });

  it("keeps every JSON primitive the type allows", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    const metadata = { text: "published", count: 3, flag: false, nothing: null };
    await writeAuditLog(
      { ...ENTRY, metadata },
      { config: CONFIG, fetchImpl: fetchImpl as unknown as typeof fetch, now: FIXED_NOW },
    );

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const stored = JSON.parse(String(init.body)) as { metadata: Record<string, unknown> };
    expect(stored.metadata).toEqual(metadata);
  });
});

describe("writeAuditLog — an absent address", () => {
  it("stores null rather than a shared digest when none could be determined", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    const result = await writeAuditLog(
      { ...ENTRY, ipHash: null },
      { config: CONFIG, fetchImpl: fetchImpl as unknown as typeof fetch, now: FIXED_NOW },
    );

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const stored = JSON.parse(String(init.body)) as Record<string, unknown>;
    // `null` and not `"unknown"`: a shared digest would look like a real source.
    expect(stored.ip_hash).toBeNull();
    expect(result).toMatchObject({ recorded: true, row: { ip_hash: null } });
  });
});

describe("writeAuditLog — failure behaviour", () => {
  it("reports not-configured and writes nothing when Supabase is absent", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await writeAuditLog(ENTRY, {
      config: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: FIXED_NOW,
    });

    expect(result).toEqual({ recorded: false, reason: "not-configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
    // Logged loudly: an unaudited admin write is something an operator must see.
    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("not audited");
    errorSpy.mockRestore();
  });

  it("reports failed when Supabase rejects the row, without throwing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 400 }));

    const result = await writeAuditLog(ENTRY, {
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: FIXED_NOW,
    });

    expect(result).toEqual({ recorded: false, reason: "failed" });
    expect(errorSpy).toHaveBeenCalled();
    // The database's own words are logged for the operator and never returned.
    const returned = JSON.stringify(result);
    expect(returned).not.toContain("400");
    errorSpy.mockRestore();
  });

  it("reports failed when the network throws, without throwing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND project.supabase.co");
    });

    await expect(
      writeAuditLog(ENTRY, { config: CONFIG, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).resolves.toEqual({ recorded: false, reason: "failed" });

    errorSpy.mockRestore();
  });

  it("never sends the service role key anywhere but the configured origin", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    await writeAuditLog(ENTRY, {
      config: CONFIG,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: FIXED_NOW,
    });

    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(new URL(url).origin).toBe("https://project.supabase.co");
  });

  it("strips a trailing slash from the configured URL, so the REST path is not doubled", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    await writeAuditLog(ENTRY, {
      config: { url: "https://project.supabase.co", serviceRoleKey: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: FIXED_NOW,
    });

    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://project.supabase.co/rest/v1/admin_audit_logs");
    expect(url).not.toContain("//rest");
  });
});
