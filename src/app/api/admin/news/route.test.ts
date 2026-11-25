// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, MAX_BODY_BYTES, POST, newsUpsertSchema } from "./route";
import { ADMIN_ROLE, REQUIRED_AAL, requireAdminSession, type AdminAuthSuccess } from "@/lib/admin/auth";

/** A verified session, typed as the module's own success shape so the literals keep their narrow types. */
const ADMIN = {
  ok: true,
  identity: {
    userId: "admin-user-id",
    email: "operator@tmlguide.example",
    role: ADMIN_ROLE,
    aal: REQUIRED_AAL,
    accessToken: "token",
  },
} satisfies AdminAuthSuccess;

/*
  The session check is replaced with a controllable double, so these tests cover
  the route's own logic — the order of the guards, the body handling, the audit
  entry, the revalidation — without a real identity provider. The auth module has
  its own suite that proves the verification itself.
*/

vi.mock("@/lib/admin/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/auth")>("@/lib/admin/auth");
  return {
    ...actual,
    requireAdminSession: vi.fn(),
  };
});

const revalidateTagMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  cacheTag: () => {},
  cacheLife: () => {},
}));

const writeAuditLogMock = vi.fn();
vi.mock("@/lib/admin/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/audit")>("@/lib/admin/audit");
  return {
    ...actual,
    writeAuditLog: (...args: unknown[]) => writeAuditLogMock(...args),
  };
});

const SITE = "https://tmlguide.com";

const VALID_ITEM = {
  id: "belgium-sale-date-confirmed",
  edition: "belgium",
  title: "Belgium sale date confirmed",
  slug: "belgium-sale-date-confirmed",
  publishedOn: "2026-11-24",
  summary: "Tomorrowland has confirmed the Belgium 2027 sale date on its own page.",
  body: "The official page now lists the date.\n\n## What changed\n\n- The date moved",
  tags: ["tickets", "sale-dates"],
  source: {
    url: "https://www.tomorrowland.com/home/",
    title: "Tomorrowland",
    retrievedOn: "2026-11-24",
  },
  lastVerified: "2026-11-24",
  confidence: "official",
};

/** A fetch double that answers by URL and method. */
interface Routes {
  existingRows?: unknown[];
  upsertStatus?: number;
  deleteRows?: unknown[];
  deleteStatus?: number;
}

function fetchDouble(routes: Routes = {}): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";

    if (method === "GET") {
      return Response.json(routes.existingRows ?? []);
    }
    if (method === "DELETE") {
      return Response.json(routes.deleteRows ?? [{ id: VALID_ITEM.id }], {
        status: routes.deleteStatus ?? 200,
      });
    }
    return new Response(
      routes.upsertStatus !== undefined && routes.upsertStatus >= 400 ? "{}" : null,
      { status: routes.upsertStatus ?? 201 },
    );
  });
}

function makeRequest(
  body: unknown,
  overrides: { method?: string; headers?: Record<string, string>; raw?: string; url?: string } = {},
): Request {
  const headers = new Headers(overrides.headers ?? { origin: SITE, "content-type": "application/json" });
  const payload = overrides.raw ?? (typeof body === "string" ? body : JSON.stringify(body));

  return new Request(overrides.url ?? "https://tmlguide.com/api/admin/news", {
    method: overrides.method ?? "POST",
    headers,
    body: overrides.method === "GET" || overrides.method === "DELETE" ? undefined : payload,
  });
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.mocked(requireAdminSession).mockResolvedValue(ADMIN);
  writeAuditLogMock.mockResolvedValue({ recorded: true, row: {} });
  revalidateTagMock.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  vi.stubEnv("RATE_LIMIT_IP_SALT", "a".repeat(32));
  vi.stubGlobal("fetch", fetchDouble());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("authorisation", () => {
  it("refuses every method without a verified session", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue({
      ok: false,
      reason: "missing-token",
      status: 401,
      error: "Sign in to use the admin console.",
    });

    for (const call of [
      () => GET(makeRequest(null, { method: "GET" })),
      () => POST(makeRequest({ status: "published", item: VALID_ITEM })),
      () => DELETE(makeRequest(null, { method: "DELETE", url: "https://tmlguide.com/api/admin/news?id=x" })),
    ]) {
      const response = await call();
      expect(response.status).toBe(401);
      expect(await body(response)).toMatchObject({ reason: "missing-token" });
    }
  });

  it("never reaches the database for a refused session", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue({
      ok: false,
      reason: "not-admin",
      status: 403,
      error: "This account does not have administrator access.",
    });

    const fetchSpy = fetchDouble();
    vi.stubGlobal("fetch", fetchSpy);

    await POST(makeRequest({ status: "published", item: VALID_ITEM }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("refuses an aal1 session through the auth module, not through its own logic", async () => {
    // The route must not have a second, weaker copy of the MFA rule: it delegates
    // entirely, so the reason it reports is the one the auth module produced.
    vi.mocked(requireAdminSession).mockResolvedValue({
      ok: false,
      reason: "mfa-required",
      status: 403,
      error: "Two-factor authentication is required for administrator access.",
    });

    const response = await POST(makeRequest({ status: "published", item: VALID_ITEM }));
    expect(response.status).toBe(403);
    expect(await body(response)).toMatchObject({ reason: "mfa-required" });
  });

  it("requires a session for the read as well as the writes", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue({
      ok: false,
      reason: "invalid-token",
      status: 401,
      error: "That session is not valid. Sign in again.",
    });

    const fetchSpy = fetchDouble();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await GET(makeRequest(null, { method: "GET" }));
    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("POST — validation", () => {
  it("accepts a valid record and reports it was created", async () => {
    vi.stubGlobal("fetch", fetchDouble({ existingRows: [] }));

    const response = await POST(makeRequest({ status: "published", item: VALID_ITEM }));
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({
      status: "created",
      id: VALID_ITEM.id,
      itemStatus: "published",
      audited: true,
    });
  });

  it("reports an update when the row already existed", async () => {
    vi.stubGlobal("fetch", fetchDouble({ existingRows: [{ id: VALID_ITEM.id }] }));

    const response = await POST(makeRequest({ status: "published", item: VALID_ITEM }));
    expect(await body(response)).toMatchObject({ status: "updated" });
  });

  it("rejects a record that fails the schema with 422 and per-field messages", async () => {
    const fetchSpy = fetchDouble();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(
      makeRequest({ status: "published", item: { ...VALID_ITEM, title: "" } }),
    );

    expect(response.status).toBe(422);
    const payload = await body(response);
    expect(payload.error).toBeTypeOf("string");
    expect(Object.keys(payload.fields as Record<string, string>)).toContain("item.title");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an unknown key in the record, because the schema is strict", async () => {
    const response = await POST(
      makeRequest({ status: "published", item: { ...VALID_ITEM, author: "someone" } }),
    );
    expect(response.status).toBe(422);
  });

  it("rejects a non-https source URL", async () => {
    const response = await POST(
      makeRequest({
        status: "published",
        item: { ...VALID_ITEM, source: { ...VALID_ITEM.source, url: "http://example.com/" } },
      }),
    );
    expect(response.status).toBe(422);
  });

  it("rejects an impossible publication date", async () => {
    const response = await POST(
      makeRequest({ status: "published", item: { ...VALID_ITEM, publishedOn: "2027-02-30" } }),
    );
    expect(response.status).toBe(422);
  });

  it("rejects an unknown status", async () => {
    const response = await POST(makeRequest({ status: "live", item: VALID_ITEM }));
    expect(response.status).toBe(422);
  });

  it("requires both a status and an item", async () => {
    expect((await POST(makeRequest({ item: VALID_ITEM }))).status).toBe(422);
    expect((await POST(makeRequest({ status: "draft" }))).status).toBe(422);
  });

  it("rejects an unknown sibling key on the envelope", async () => {
    expect((await POST(makeRequest({ status: "draft", item: VALID_ITEM, extra: 1 }))).status).toBe(422);
  });

  it("validates the envelope with the exported schema", () => {
    expect(newsUpsertSchema.safeParse({ status: "draft", item: VALID_ITEM }).success).toBe(true);
    expect(newsUpsertSchema.safeParse({ status: "draft" }).success).toBe(false);
  });
});

describe("POST — request hygiene", () => {
  it("rejects a non-POST method with 405 and an Allow header", async () => {
    const response = await POST(makeRequest(null, { method: "GET" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, POST, DELETE");
  });

  it("rejects a non-JSON content type", async () => {
    const response = await POST(
      makeRequest({ status: "draft", item: VALID_ITEM }, { headers: { origin: SITE, "content-type": "text/plain" } }),
    );
    expect(response.status).toBe(415);
  });

  it("rejects an oversized declared Content-Length before reading", async () => {
    const response = await POST(
      makeRequest(
        { status: "draft", item: VALID_ITEM },
        { headers: { origin: SITE, "content-type": "application/json", "content-length": String(MAX_BODY_BYTES + 1) } },
      ),
    );
    expect(response.status).toBe(413);
  });

  it("rejects a cross-origin request", async () => {
    const response = await POST(
      makeRequest(
        { status: "draft", item: VALID_ITEM },
        { headers: { origin: "https://evil.example", "content-type": "application/json" } },
      ),
    );
    expect(response.status).toBe(403);
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("rejects a mutating request from a script that forges no origin header", async () => {
    // A valid token alone must not be enough: a stolen token replayed from a
    // script carries neither header, and the origin check refuses it.
    const response = await POST(
      makeRequest({ status: "draft", item: VALID_ITEM }, { headers: { "content-type": "application/json" } }),
    );
    expect(response.status).toBe(403);
  });

  it("accepts a same-origin Referer when Origin is absent", async () => {
    const response = await POST(
      makeRequest(
        { status: "draft", item: VALID_ITEM },
        { headers: { referer: `${SITE}/admin`, "content-type": "application/json" } },
      ),
    );
    expect(response.status).toBe(200);
  });

  it("rejects malformed JSON", async () => {
    expect((await POST(makeRequest("{not json"))).status).toBe(400);
  });

  it("rejects a JSON array or primitive", async () => {
    for (const raw of ["[]", "null", "42", '"text"']) {
      expect((await POST(makeRequest(null, { raw }))).status).toBe(400);
    }
  });

  it("sets no-store on every response", async () => {
    const responses = [
      await POST(makeRequest({ status: "published", item: VALID_ITEM })),
      await POST(makeRequest({ status: "draft", item: { ...VALID_ITEM, title: "" } })),
      await POST(makeRequest(null, { method: "GET" })),
    ];
    for (const response of responses) {
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
});

describe("POST — the write", () => {
  it("upserts on the primary key with the service role key", async () => {
    const fetchSpy = fetchDouble({ existingRows: [] });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(makeRequest({ status: "published", item: VALID_ITEM }));

    const upsert = fetchSpy.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    ) as unknown as [string, RequestInit];

    expect(upsert[0]).toContain("/rest/v1/news_items?on_conflict=id");
    const headers = upsert[1].headers as Record<string, string>;
    expect(headers.apikey).toBe("service-role-key");
    expect(headers.Prefer).toContain("resolution=merge-duplicates");

    const stored = JSON.parse(String(upsert[1].body)) as Record<string, unknown>;
    expect(stored.id).toBe(VALID_ITEM.id);
    expect(stored.status).toBe("published");
    expect(stored.data).toEqual(VALID_ITEM);
  });

  it("sets published_at from the record's date when publishing", async () => {
    const fetchSpy = fetchDouble({ existingRows: [] });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(makeRequest({ status: "published", item: VALID_ITEM }));

    const upsert = fetchSpy.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    ) as unknown as [string, RequestInit];
    const stored = JSON.parse(String(upsert[1].body)) as Record<string, unknown>;

    expect(stored.published_at).toBe(`${VALID_ITEM.publishedOn}T12:00:00.000Z`);
  });

  it("stores a draft with the current instant rather than its publication date", async () => {
    const fetchSpy = fetchDouble({ existingRows: [] });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(makeRequest({ status: "draft", item: VALID_ITEM }));

    const upsert = fetchSpy.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    ) as unknown as [string, RequestInit];
    const stored = JSON.parse(String(upsert[1].body)) as Record<string, unknown>;

    // A draft's ordering key is when it was last touched, not a date it has not
    // reached yet.
    expect(stored.published_at).not.toBe(`${VALID_ITEM.publishedOn}T12:00:00.000Z`);
    expect(Number.isNaN(Date.parse(String(stored.published_at)))).toBe(false);
  });

  it("answers 503 when the database is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const response = await POST(makeRequest({ status: "published", item: VALID_ITEM }));
    expect(response.status).toBe(503);
    expect(await body(response)).toMatchObject({ error: expect.stringContaining("not configured") });
  });

  it("answers 502 when the upsert is rejected, without leaking the reason", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchDouble({ existingRows: [], upsertStatus: 400 }));

    const response = await POST(makeRequest({ status: "published", item: VALID_ITEM }));
    expect(response.status).toBe(502);

    const text = JSON.stringify(await body(response));
    expect(text).not.toContain("service-role-key");
    expect(text).not.toContain("project.supabase.co");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("answers 502 when the existence check fails, so a partial write is not attempted", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.fn(async (_input: string | URL, init?: RequestInit) =>
      (init?.method ?? "GET") === "GET"
        ? new Response("{}", { status: 500 })
        : new Response(null, { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(makeRequest({ status: "published", item: VALID_ITEM }));
    expect(response.status).toBe(502);
    // Only the read happened; the write was never attempted.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("answers 502 when the network throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const response = await POST(makeRequest({ status: "published", item: VALID_ITEM }));
    expect(response.status).toBe(502);
    errorSpy.mockRestore();
  });
});

describe("POST — audit and revalidation", () => {
  it("records a create with the actor, the resource and the metadata", async () => {
    vi.stubGlobal("fetch", fetchDouble({ existingRows: [] }));

    await POST(makeRequest({ status: "published", item: VALID_ITEM }));

    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
    const entry = writeAuditLogMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry).toMatchObject({
      actorId: "admin-user-id",
      action: "news.create",
      resourceType: "news_item",
      resourceId: VALID_ITEM.id,
      metadata: { status: "published", slug: VALID_ITEM.slug, title: VALID_ITEM.title },
    });
  });

  it("records an update when the row already existed", async () => {
    vi.stubGlobal("fetch", fetchDouble({ existingRows: [{ id: VALID_ITEM.id }] }));
    await POST(makeRequest({ status: "published", item: VALID_ITEM }));

    const entry = writeAuditLogMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry.action).toBe("news.update");
  });

  it("stores a hashed address, never a readable one", async () => {
    vi.stubGlobal("fetch", fetchDouble({ existingRows: [] }));
    await POST(
      makeRequest(
        { status: "published", item: VALID_ITEM },
        { headers: { origin: SITE, "content-type": "application/json", "x-forwarded-for": "203.0.113.9" } },
      ),
    );

    const entry = writeAuditLogMock.mock.calls[0]?.[0] as { ipHash: unknown };
    expect(typeof entry.ipHash).toBe("string");
    expect(String(entry.ipHash).startsWith("ip:")).toBe(true);
    expect(JSON.stringify(entry)).not.toContain("203.0.113.9");
  });

  it("stores null when no address can be determined", async () => {
    vi.stubGlobal("fetch", fetchDouble({ existingRows: [] }));
    await POST(makeRequest({ status: "published", item: VALID_ITEM }));

    const entry = writeAuditLogMock.mock.calls[0]?.[0] as { ipHash: unknown };
    expect(entry.ipHash).toBeNull();
  });

  it("still reports the write as done when the audit entry could not be written", async () => {
    // The change happened. Saying it did not would be false; the flag says what
    // is missing and the log has the rest.
    vi.stubGlobal("fetch", fetchDouble({ existingRows: [] }));
    writeAuditLogMock.mockResolvedValue({ recorded: false, reason: "failed" });

    const response = await POST(makeRequest({ status: "published", item: VALID_ITEM }));
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({ status: "created", audited: false });
  });

  it("invalidates the community news tag after a successful write", async () => {
    vi.stubGlobal("fetch", fetchDouble({ existingRows: [] }));
    await POST(makeRequest({ status: "published", item: VALID_ITEM }));

    expect(revalidateTagMock).toHaveBeenCalledWith("community-news", "max");
  });

  it("does not invalidate anything when the write failed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchDouble({ existingRows: [], upsertStatus: 400 }));

    await POST(makeRequest({ status: "published", item: VALID_ITEM }));
    expect(revalidateTagMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("GET", () => {
  it("lists every row, drafts included", async () => {
    const row = {
      id: VALID_ITEM.id,
      status: "draft",
      data: VALID_ITEM,
      like_count: 3,
      published_at: "2026-11-24T12:00:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([row])));

    const response = await GET(makeRequest(null, { method: "GET" }));
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({ entries: [{ id: VALID_ITEM.id, status: "draft" }] });
  });

  it("drops a row that does not match the schema rather than returning it", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          { id: "bad", status: "published", data: { title: "no other fields" }, like_count: 0 },
        ]),
      ),
    );

    const response = await GET(makeRequest(null, { method: "GET" }));
    expect(await body(response)).toEqual({ entries: [] });
    errorSpy.mockRestore();
  });

  it("answers 503 when the database is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const response = await GET(makeRequest(null, { method: "GET" }));
    expect(response.status).toBe(503);
  });

  it("answers 503 when the read fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));

    const response = await GET(makeRequest(null, { method: "GET" }));
    expect(response.status).toBe(503);
    errorSpy.mockRestore();
  });
});

describe("DELETE", () => {
  const deleteRequest = (id: string) =>
    makeRequest(null, {
      method: "DELETE",
      headers: { origin: SITE },
      url: `https://tmlguide.com/api/admin/news?id=${encodeURIComponent(id)}`,
    });

  it("deletes by id and records the action", async () => {
    const fetchSpy = fetchDouble({ deleteRows: [{ id: VALID_ITEM.id }] });
    vi.stubGlobal("fetch", fetchSpy);

    const response = await DELETE(deleteRequest(VALID_ITEM.id));
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({ status: "deleted", id: VALID_ITEM.id, audited: true });

    const call = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toContain(`/rest/v1/news_items?id=eq.${VALID_ITEM.id}`);
    expect(call[1].method).toBe("DELETE");
  });

  it("records a delete audit entry", async () => {
    vi.stubGlobal("fetch", fetchDouble({ deleteRows: [{ id: VALID_ITEM.id }] }));
    await DELETE(deleteRequest(VALID_ITEM.id));

    const entry = writeAuditLogMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry).toMatchObject({
      actorId: "admin-user-id",
      action: "news.delete",
      resourceType: "news_item",
      resourceId: VALID_ITEM.id,
    });
  });

  it("invalidates the tag after a delete", async () => {
    vi.stubGlobal("fetch", fetchDouble({ deleteRows: [{ id: VALID_ITEM.id }] }));
    await DELETE(deleteRequest(VALID_ITEM.id));
    expect(revalidateTagMock).toHaveBeenCalledWith("community-news", "max");
  });

  it("answers 404 when nothing matched, and audits nothing", async () => {
    vi.stubGlobal("fetch", fetchDouble({ deleteRows: [] }));
    const response = await DELETE(deleteRequest("does-not-exist"));

    expect(response.status).toBe(404);
    expect(writeAuditLogMock).not.toHaveBeenCalled();
    // A 404 must not look like a change in the log or invalidate a cache entry.
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin delete", async () => {
    const response = await DELETE(
      makeRequest(null, {
        method: "DELETE",
        headers: { origin: "https://evil.example" },
        url: `https://tmlguide.com/api/admin/news?id=${VALID_ITEM.id}`,
      }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects a missing or malformed id without touching the database", async () => {
    const fetchSpy = fetchDouble();
    vi.stubGlobal("fetch", fetchSpy);

    for (const id of ["", "Not A Slug", "../etc/passwd", "a".repeat(81)]) {
      const response = await DELETE(deleteRequest(id));
      expect(response.status).toBe(422);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses an id that would break the PostgREST filter expression", async () => {
    // `id=eq.x&select=*` would smuggle a second parameter into the filter, so the
    // slug check has to reject the ampersand rather than leave it encoded.
    const response = await DELETE(deleteRequest("x&select=*"));
    expect(response.status).toBe(422);
  });

  it("accepts the id in a JSON body when a client strips the query string", async () => {
    const fetchSpy = fetchDouble({ deleteRows: [{ id: VALID_ITEM.id }] });
    vi.stubGlobal("fetch", fetchSpy);

    const response = await DELETE(
      new Request("https://tmlguide.com/api/admin/news", {
        method: "DELETE",
        headers: { origin: SITE, "content-type": "application/json" },
        body: JSON.stringify({ id: VALID_ITEM.id }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it("answers 503 when the database is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const response = await DELETE(deleteRequest(VALID_ITEM.id));
    expect(response.status).toBe(503);
  });
});
