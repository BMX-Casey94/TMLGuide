// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, LIKE_RPC, POST, RATE_LIMIT_MAX } from "./route";
import { InMemoryRateLimiter, setRateLimiterForTesting } from "@/lib/security/rate-limit";

const SITE = "https://tmlguide.com";
const ITEM_ID = "belgium-sale-date-confirmed";

/** Builds a POST to the like endpoint. */
function makeRequest(
  id = ITEM_ID,
  overrides: { method?: string; headers?: Record<string, string> } = {},
): [Request, { params: Promise<{ id: string }> }] {
  const request = new Request(`https://tmlguide.com/api/community/news/${id}/like`, {
    method: overrides.method ?? "POST",
    headers: overrides.headers ?? { origin: SITE },
  });
  return [request, { params: Promise.resolve({ id }) }];
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setRateLimiterForTesting(new InMemoryRateLimiter());
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  vi.stubEnv("RATE_LIMIT_API_URL_SALT", "a".repeat(32));
  vi.stubEnv("RATE_LIMIT_IP_SALT", "a".repeat(32));

  fetchSpy = vi.fn(async () => Response.json(7));
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  setRateLimiterForTesting(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the happy path", () => {
  it("increments through the database function and returns the new count", async () => {
    const [request, context] = makeRequest();
    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ status: "recorded", id: ITEM_ID, likeCount: 7 });
  });

  it("calls the RPC, not a select-then-update pair", async () => {
    const [request, context] = makeRequest();
    await POST(request, context);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    // A read followed by a write from here would lose concurrent likes.
    expect(url).toBe(`https://project.supabase.co/rest/v1/rpc/${LIKE_RPC}`);
    expect(init.method).toBe("POST");

    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sent.item_id).toBe(ITEM_ID);
  });

  it("authenticates the RPC with the service role key", async () => {
    const [request, context] = makeRequest();
    await POST(request, context);

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe("service-role-key");
    expect(headers.Authorization).toBe("Bearer service-role-key");
  });

  it("accepts a table-shaped RPC result as well as a bare number", async () => {
    // A function declared `returns table(...)` comes back as a one-row array.
    fetchSpy.mockResolvedValue(Response.json([{ like_count: 12 }]));

    const [request, context] = makeRequest();
    const response = await POST(request, context);
    expect(await body(response)).toMatchObject({ likeCount: 12 });
  });

  it("never caches the result", async () => {
    const [request, context] = makeRequest();
    const response = await POST(request, context);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.cache).toBe("no-store");
  });
});

describe("identity and privacy", () => {
  it("sets no cookie and reads none", async () => {
    const [request, context] = makeRequest(ITEM_ID, {
      headers: { origin: SITE, cookie: "session=should-be-ignored" },
    });
    const response = await POST(request, context);

    expect(response.headers.get("Set-Cookie")).toBeNull();
    // The RPC body carries the item id and nothing about the caller.
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(["item_id", "target_table"]);
    expect(JSON.stringify(sent)).not.toContain("should-be-ignored");
  });

  it("never sends a readable address to the database", async () => {
    const [request, context] = makeRequest(ITEM_ID, {
      headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" },
    });
    await POST(request, context);

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).not.toContain("203.0.113.9");
  });

  it("rate-limits per address, so two clients do not share one allowance", async () => {
    for (let index = 0; index < RATE_LIMIT_MAX; index += 1) {
      const [request, context] = makeRequest(ITEM_ID, {
        headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" },
      });
      expect((await POST(request, context)).status).toBe(200);
    }

    const [blockedRequest, blockedContext] = makeRequest(ITEM_ID, {
      headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" },
    });
    expect((await POST(blockedRequest, blockedContext)).status).toBe(429);

    const [otherRequest, otherContext] = makeRequest(ITEM_ID, {
      headers: { origin: SITE, "x-forwarded-for": "198.51.100.7" },
    });
    expect((await POST(otherRequest, otherContext)).status).toBe(200);
  });

  it("shares one bucket for requests with no address rather than exempting them", async () => {
    for (let index = 0; index < RATE_LIMIT_MAX; index += 1) {
      const [request, context] = makeRequest();
      expect((await POST(request, context)).status).toBe(200);
    }
    const [request, context] = makeRequest();
    expect((await POST(request, context)).status).toBe(429);
  });
});

describe("origin", () => {
  it("rejects a cross-origin like", async () => {
    const [request, context] = makeRequest(ITEM_ID, {
      headers: { origin: "https://evil.example" },
    });
    const response = await POST(request, context);

    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a like with neither Origin nor Referer", async () => {
    const [request, context] = makeRequest(ITEM_ID, { headers: {} });
    expect((await POST(request, context)).status).toBe(403);
  });

  it("accepts a same-origin Referer", async () => {
    const [request, context] = makeRequest(ITEM_ID, {
      headers: { referer: `${SITE}/community/news` },
    });
    expect((await POST(request, context)).status).toBe(200);
  });

  it("rejects a forged origin that merely starts with the site host", async () => {
    const [request, context] = makeRequest(ITEM_ID, {
      headers: { origin: "https://tmlguide.com.evil.example" },
    });
    expect((await POST(request, context)).status).toBe(403);
  });

  it("checks the origin before the id", async () => {
    // A cross-origin probe with a bad id must not learn whether the id is valid.
    const [request, context] = makeRequest("Not A Slug", {
      headers: { origin: "https://evil.example" },
    });
    expect((await POST(request, context)).status).toBe(403);
  });
});

describe("validation", () => {
  it.each([
    ["Not A Slug", "a non-slug id"],
    ["", "an empty id"],
    ["../etc/passwd", "a traversal attempt"],
    ["a".repeat(81), "an over-long id"],
    ["x&select=*", "an id with an operator"],
  ])("answers 404 for %s (%s)", async (id) => {
    const [request, context] = makeRequest(id);
    const response = await POST(request, context);

    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not spend an allowance on a malformed id", async () => {
    // The id check runs before the limiter, so probing does not use up the
    // allowance a real reader needs.
    for (let index = 0; index < RATE_LIMIT_MAX + 5; index += 1) {
      const [request, context] = makeRequest("Not A Slug");
      expect((await POST(request, context)).status).toBe(404);
    }

    const [request, context] = makeRequest();
    expect((await POST(request, context)).status).toBe(200);
  });

  it("answers 405 for a non-POST method", async () => {
    const [request, context] = makeRequest(ITEM_ID, { method: "GET" });
    const response = await POST(request, context);

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("answers GET for the exported handler with 405", () => {
    const response = GET();
    expect(response.status).toBe(405);
  });
});

describe("database behaviour", () => {
  it("answers 503 when the database is not configured, and does not claim the tap counted", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const [request, context] = makeRequest();
    const response = await POST(request, context);

    expect(response.status).toBe(503);
    const payload = await body(response);
    // It must say plainly that nothing was counted, and it must not report a
    // count it never obtained.
    expect(String(payload.error)).toContain("not counted");
    expect(payload).not.toHaveProperty("likeCount");
    expect(payload).not.toHaveProperty("status", "recorded");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers 404 when the RPC reports no matching row", async () => {
    fetchSpy.mockResolvedValue(new Response("{}", { status: 404 }));

    const [request, context] = makeRequest();
    expect((await POST(request, context)).status).toBe(404);
  });

  it("answers 502 when the RPC fails, without leaking the reason", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy.mockResolvedValue(new Response('{"message":"function does not exist"}', { status: 400 }));

    const [request, context] = makeRequest();
    const response = await POST(request, context);

    expect(response.status).toBe(502);
    const text = JSON.stringify(await body(response));
    expect(text).not.toContain("function");
    expect(text).not.toContain("project.supabase.co");
    errorSpy.mockRestore();
  });

  it("answers 502 when the network throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

    const [request, context] = makeRequest();
    const response = await POST(request, context);

    expect(response.status).toBe(502);
    expect(JSON.stringify(await body(response))).not.toContain("ENOTFOUND");
    errorSpy.mockRestore();
  });

  it("answers 502 when the RPC returns no usable count", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy.mockResolvedValue(Response.json({ unexpected: true }));

    const [request, context] = makeRequest();
    expect((await POST(request, context)).status).toBe(502);
    errorSpy.mockRestore();
  });

  it("rejects a negative count rather than storing it", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy.mockResolvedValue(Response.json(-1));

    const [request, context] = makeRequest();
    expect((await POST(request, context)).status).toBe(502);
    errorSpy.mockRestore();
  });

  it("sends the service role key only to the configured origin", async () => {
    const [request, context] = makeRequest();
    await POST(request, context);

    const [url] = fetchSpy.mock.calls[0] as unknown as [string];
    expect(new URL(url).origin).toBe("https://project.supabase.co");
  });
});

describe("limiter failure", () => {
  it("fails closed with 503 when the limiter is unavailable", async () => {
    setRateLimiterForTesting({
      shared: true,
      backend: "redis",
      check: async () => {
        const { RateLimiterUnavailableError } = await import("@/lib/security/rate-limit");
        throw new RateLimiterUnavailableError("redis down");
      },
    });

    const [request, context] = makeRequest();
    const response = await POST(request, context);

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not leak an internal message when the limiter throws unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRateLimiterForTesting({
      shared: true,
      backend: "redis",
      check: async () => {
        throw new Error("ECONNREFUSED 10.0.0.5:6379");
      },
    });

    const [request, context] = makeRequest();
    const text = JSON.stringify(await body(await POST(request, context)));
    expect(text).not.toContain("10.0.0.5");
    expect(text).not.toContain("ECONNREFUSED");
    vi.restoreAllMocks();
  });
});
