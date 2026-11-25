// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, MAX_BODY_BYTES, POST, RATE_LIMIT_MAX } from "./route";
import { InMemoryRateLimiter, setRateLimiterForTesting } from "@/lib/security/rate-limit";

const SITE = "https://tmlguide.com";

const VALID = {
  url: "https://chat.whatsapp.com/closedinvite",
  kind: "invite",
  details: "The page says the invite has been reset.",
  page: "/community",
};

/** Builds a POST with sensible defaults. */
function makeRequest(
  body: unknown,
  overrides: {
    method?: string;
    headers?: Record<string, string>;
    contentType?: string | null;
    raw?: string;
  } = {},
): Request {
  const headers = new Headers(overrides.headers ?? { origin: SITE });
  const contentType = overrides.contentType === undefined ? "application/json" : overrides.contentType;
  if (contentType !== null && !headers.has("content-type")) headers.set("content-type", contentType);

  const payload = overrides.raw ?? (typeof body === "string" ? body : JSON.stringify(body));
  return new Request("https://tmlguide.com/api/community/report-link", {
    method: overrides.method ?? "POST",
    headers,
    body: overrides.method === "GET" || overrides.method === "HEAD" ? undefined : payload,
  });
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
  vi.stubEnv("RATE_LIMIT_IP_SALT", "a".repeat(32));

  fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  setRateLimiterForTesting(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the happy path", () => {
  it("stores the report and answers 202", async () => {
    const response = await POST(makeRequest(VALID));

    expect(response.status).toBe(202);
    expect(await body(response)).toEqual({ status: "accepted" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/rest/v1/community_link_reports");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).apikey).toBe("service-role-key");
  });

  it("stores the validated fields and a server-set timestamp", async () => {
    await POST(makeRequest(VALID));

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const stored = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(stored.url).toBe(VALID.url);
    expect(stored.kind).toBe("invite");
    expect(stored.details).toBe(VALID.details);
    expect(stored.page).toBe("/community");
    expect(Number.isNaN(Date.parse(String(stored.reported_at)))).toBe(false);
  });

  it("stores null for the optional fields when they are omitted", async () => {
    await POST(makeRequest({ url: VALID.url, kind: "resource" }));

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const stored = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(stored.details).toBeNull();
    expect(stored.page).toBeNull();
  });

  it("stores a hashed address, never the address itself", async () => {
    await POST(
      makeRequest(VALID, { headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" } }),
    );

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const stored = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(String(stored.reporter_ip_hash).startsWith("ip:")).toBe(true);
    expect(JSON.stringify(stored)).not.toContain("203.0.113.9");
  });

  it("never stores the honeypot field", async () => {
    await POST(makeRequest({ ...VALID, website: "" }));

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).not.toContain("website");
  });

  it("rejects a payload that tries to set the timestamp itself", async () => {
    // The schema is strict, so a client cannot smuggle a field at all. That is
    // better than ignoring it: a rejection is visible, an ignored value is a
    // silent difference between what was sent and what was stored.
    const response = await POST(makeRequest({ ...VALID, reported_at: "1999-01-01T00:00:00.000Z" }));
    expect(response.status).toBe(422);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("asks Supabase for no body back, so reporter data is not echoed", async () => {
    await POST(makeRequest(VALID));

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Prefer).toBe("return=minimal");
  });

  it("never caches the write or the response", async () => {
    const response = await POST(makeRequest(VALID));
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.cache).toBe("no-store");
  });
});

describe("method and content type", () => {
  it("rejects a non-POST method with 405 and an Allow header", async () => {
    const response = await POST(makeRequest(VALID, { method: "GET" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("answers GET with 405", () => {
    const response = GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("rejects a form content type before reading the body", async () => {
    for (const contentType of [
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
      "text/plain",
    ]) {
      expect((await POST(makeRequest(VALID, { contentType }))).status).toBe(415);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a missing content type", async () => {
    expect((await POST(makeRequest(VALID, { contentType: null }))).status).toBe(415);
  });

  it("accepts a JSON content type with a charset", async () => {
    expect((await POST(makeRequest(VALID, { contentType: "application/json; charset=utf-8" }))).status).toBe(202);
  });
});

describe("body size", () => {
  it("rejects an oversized declared Content-Length before reading", async () => {
    const response = await POST(
      makeRequest(VALID, { headers: { origin: SITE, "content-length": String(MAX_BODY_BYTES + 1) } }),
    );
    expect(response.status).toBe(413);
  });

  it("rejects a negative or non-numeric Content-Length", async () => {
    for (const length of ["-1", "abc"]) {
      expect((await POST(makeRequest(VALID, { headers: { origin: SITE, "content-length": length } }))).status).toBe(400);
    }
  });

  it("rejects an oversized body even when Content-Length is absent", async () => {
    const huge = JSON.stringify({ ...VALID, details: "a".repeat(MAX_BODY_BYTES * 2) });
    const request = new Request("https://tmlguide.com/api/community/report-link", {
      method: "POST",
      headers: { origin: SITE, "content-type": "application/json" },
      body: huge,
    });
    expect(request.headers.get("content-length")).toBeNull();

    // 413, not 400: the body was measured and found too large, which is a size
    // fault rather than a syntax one. It also matches the declared-length path.
    expect((await POST(request)).status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("origin", () => {
  it("rejects a cross-origin report", async () => {
    const response = await POST(makeRequest(VALID, { headers: { origin: "https://evil.example" } }));
    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a report with neither Origin nor Referer", async () => {
    expect((await POST(makeRequest(VALID, { headers: {} }))).status).toBe(403);
  });

  it("accepts a same-origin Referer", async () => {
    const response = await POST(makeRequest(VALID, { headers: { referer: `${SITE}/community` } }));
    expect(response.status).toBe(202);
  });

  it("checks the origin before the body is parsed", async () => {
    const response = await POST(makeRequest("{not json", { headers: { origin: "https://evil.example" } }));
    expect(response.status).toBe(403);
  });
});

describe("rate limiting", () => {
  it("allows the configured number and then answers 429 with Retry-After", async () => {
    for (let index = 0; index < RATE_LIMIT_MAX; index += 1) {
      const response = await POST(
        makeRequest(VALID, { headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" } }),
      );
      expect(response.status).toBe(202);
    }

    const blocked = await POST(
      makeRequest(VALID, { headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" } }),
    );
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(RATE_LIMIT_MAX);
  });

  it("limits each client separately", async () => {
    for (let index = 0; index < RATE_LIMIT_MAX; index += 1) {
      await POST(makeRequest(VALID, { headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" } }));
    }
    expect(
      (await POST(makeRequest(VALID, { headers: { origin: SITE, "x-forwarded-for": "198.51.100.7" } }))).status,
    ).toBe(202);
  });

  it("counts a honeypot-triggering request against the limit", async () => {
    for (let index = 0; index < RATE_LIMIT_MAX; index += 1) {
      const response = await POST(
        makeRequest({ ...VALID, website: "spam" }, { headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" } }),
      );
      expect(response.status).toBe(202);
    }
    expect(
      (await POST(makeRequest({ ...VALID, website: "spam" }, { headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" } }))).status,
    ).toBe(429);
  });

  it("fails closed with 503 when the limiter is unavailable", async () => {
    setRateLimiterForTesting({
      shared: true,
      backend: "redis",
      check: async () => {
        const { RateLimiterUnavailableError } = await import("@/lib/security/rate-limit");
        throw new RateLimiterUnavailableError("redis down");
      },
    });

    const response = await POST(makeRequest(VALID));
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

    const text = JSON.stringify(await body(await POST(makeRequest(VALID))));
    expect(text).not.toContain("10.0.0.5");
    expect(text).not.toContain("ECONNREFUSED");
    vi.restoreAllMocks();
  });
});

describe("honeypot", () => {
  it("returns the same 202 as a real report and writes nothing", async () => {
    const real = await POST(makeRequest(VALID));
    const caught = await POST(
      makeRequest({ ...VALID, website: "http://spam.example" }, { headers: { origin: SITE, "cf-connecting-ip": "198.51.100.1" } }),
    );

    expect(caught.status).toBe(real.status);
    expect(await body(caught)).toEqual(await body(real));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("catches a bot before validation reports its other mistakes", async () => {
    const caught = await POST(makeRequest({ website: "spam", url: "x" }));
    expect(caught.status).toBe(202);
    expect(await body(caught)).toEqual({ status: "accepted" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats a non-string honeypot value as tripped", async () => {
    for (const website of [5, true, { a: 1 }, ["x"]]) {
      expect((await POST(makeRequest({ ...VALID, website }))).status).toBe(202);
    }
  });
});

describe("validation", () => {
  it("rejects an invalid payload with 422 and per-field messages", async () => {
    const response = await POST(makeRequest({ url: "http://example.com/", kind: "nonsense" }));

    expect(response.status).toBe(422);
    const payload = await body(response);
    expect(payload.error).toBeTypeOf("string");
    const fields = payload.fields as Record<string, string>;
    expect(Object.keys(fields).sort()).toEqual(["kind", "url"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a non-https link, so a report cannot file an address the site would not publish", async () => {
    for (const url of ["http://example.com/", "javascript:alert(1)", "ftp://example.com/", "//example.com/"]) {
      expect((await POST(makeRequest({ url, kind: "invite" }))).status).toBe(422);
    }
  });

  it("rejects a link carrying credentials", async () => {
    expect((await POST(makeRequest({ url: "https://user:pass@example.com/", kind: "invite" }))).status).toBe(422);
  });

  it("rejects a link with whitespace", async () => {
    expect((await POST(makeRequest({ url: "https://example.com/a b", kind: "invite" }))).status).toBe(422);
  });

  it("rejects an unknown kind", async () => {
    expect((await POST(makeRequest({ url: VALID.url, kind: "spam" }))).status).toBe(422);
  });

  it("rejects a page that is a full URL rather than a path", async () => {
    // A full URL would let a reporter attach an arbitrary string to a field the
    // operator reads.
    for (const page of ["https://evil.example/x", "community", "javascript:alert(1)"]) {
      expect((await POST(makeRequest({ ...VALID, page }))).status).toBe(422);
    }
  });

  it("rejects overly long details", async () => {
    expect((await POST(makeRequest({ ...VALID, details: "a".repeat(1001) }))).status).toBe(422);
  });

  it("rejects an unknown key", async () => {
    expect((await POST(makeRequest({ ...VALID, role: "admin" }))).status).toBe(422);
  });

  it("rejects malformed JSON with 400", async () => {
    expect((await POST(makeRequest(VALID, { raw: "{ not json" }))).status).toBe(400);
  });

  it("rejects a JSON array or primitive", async () => {
    for (const raw of ["[]", "null", "42", '"text"']) {
      expect((await POST(makeRequest(VALID, { raw }))).status).toBe(400);
    }
  });
});

describe("database configuration", () => {
  it("returns 503 with a clear message when Supabase is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const response = await POST(makeRequest(VALID));
    expect(response.status).toBe(503);
    const payload = await body(response);
    // It must never claim the report was saved.
    expect(String(payload.error)).toContain("Nothing has been recorded");
    expect(JSON.stringify(payload)).not.toContain("accepted");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 503 when only one credential is present", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect((await POST(makeRequest(VALID))).status).toBe(503);
  });

  it("refuses a plain-HTTP Supabase URL in production", async () => {
    vi.stubEnv("SUPABASE_URL", "http://project.supabase.co");
    expect((await POST(makeRequest(VALID))).status).toBe(503);
  });
});

describe("database failures", () => {
  it("returns 502 when Supabase rejects the insert, without leaking the reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"message":"column \\"kind\\" does not exist"}', { status: 400 })),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest(VALID));
    expect(response.status).toBe(502);

    const text = JSON.stringify(await body(response));
    expect(text).not.toContain("column");
    expect(text).not.toContain("does not exist");
    expect(text).not.toContain("service-role-key");
    errorSpy.mockRestore();
  });

  it("returns 502 when the network fails, without leaking the host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND project.supabase.co");
      }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest(VALID));
    expect(response.status).toBe(502);

    const text = JSON.stringify(await body(response));
    expect(text).not.toContain("ENOTFOUND");
    expect(text).not.toContain("project.supabase.co");
    errorSpy.mockRestore();
  });

  it("sends the service role key only to the configured origin", async () => {
    await POST(makeRequest(VALID));
    const [url] = fetchSpy.mock.calls[0] as unknown as [string];
    expect(new URL(url).origin).toBe("https://project.supabase.co");
  });
});

describe("response hygiene", () => {
  it("sets no-store on every response, including failures", async () => {
    const responses = [
      await POST(makeRequest(VALID)),
      await POST(makeRequest(VALID, { contentType: "text/plain" })),
      await POST(makeRequest(VALID, { headers: { origin: "https://evil.example" } })),
      await POST(makeRequest(VALID, { raw: "{bad" })),
    ];
    for (const response of responses) {
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("returns a stable error field on every failure", async () => {
    const responses = [
      await POST(makeRequest(VALID, { contentType: "text/plain" })),
      await POST(makeRequest(VALID, { headers: { origin: "https://evil.example" } })),
      await POST(makeRequest(VALID, { raw: "{bad" })),
      await POST(makeRequest({ url: "bad", kind: "invite" })),
    ];
    for (const response of responses) {
      const payload = await body(response);
      expect(payload.error).toBeTypeOf("string");
      expect((payload.error as string).length).toBeGreaterThan(0);
    }
  });
});
