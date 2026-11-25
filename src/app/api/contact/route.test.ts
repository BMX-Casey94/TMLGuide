/**
 * Tests for POST /api/contact.
 *
 * This is the only endpoint that writes to the database, so every guard is
 * exercised twice: once on the path where it allows the request, and once on the
 * path where it refuses it. The refusals matter more, because a guard that is
 * present but ineffective looks identical to one that works.
 *
 * Supabase, the network and the rate limiter are all replaced. Nothing here
 * touches a real service.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ): Response =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      }),
  },
}));

import { POST, GET, MAX_BODY_BYTES, RATE_LIMIT_MAX, readSupabaseConfig } from "./route";
import { InMemoryRateLimiter, setRateLimiterForTesting } from "@/lib/security/rate-limit";

const VALID = {
  name: "Alex Turner",
  email: "alex@example.com",
  topic: "correction",
  message: "The DreamVille opening date on the tickets page is a day out.",
};

const SITE = "https://tmlguide.com";

/** Builds a POST request with sensible defaults. */
function makeRequest(
  body: unknown,
  overrides: {
    method?: string;
    headers?: Record<string, string>;
    contentType?: string | null;
    raw?: string;
  } = {},
): Request {
  const headers = new Headers(overrides.headers ?? { origin: SITE, host: "tmlguide.com" });
  const contentType = overrides.contentType === undefined ? "application/json" : overrides.contentType;
  if (contentType !== null && !headers.has("content-type")) headers.set("content-type", contentType);

  const payload = overrides.raw ?? (typeof body === "string" ? body : JSON.stringify(body));
  return new Request("https://tmlguide.com/api/contact", {
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
  vi.stubEnv("SUPABASE_URL", "https://db.example.com");
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

describe("happy path", () => {
  it("accepts a valid submission and writes it with the service role key", async () => {
    const response = await POST(makeRequest(VALID));
    expect(response.status).toBe(202);
    expect(await body(response)).toEqual({ status: "accepted" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://db.example.com/rest/v1/contact_messages");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe("service-role-key");
    expect(headers.Authorization).toBe("Bearer service-role-key");
  });

  it("stores the validated, trimmed fields and a server-set timestamp", async () => {
    await POST(makeRequest({ ...VALID, name: "  Alex Turner  " }));
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const stored = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(stored.name).toBe("Alex Turner");
    expect(stored.email).toBe("alex@example.com");
    expect(stored.topic).toBe("correction");
    expect(stored.message).toBe(VALID.message);
    expect(typeof stored.submitted_at).toBe("string");
    expect(Number.isNaN(Date.parse(String(stored.submitted_at)))).toBe(false);
  });

  it("never stores the honeypot field", async () => {
    await POST(makeRequest({ ...VALID, website: "" }));
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).not.toContain("website");
  });

  it("ignores a client-supplied timestamp", async () => {
    await POST(makeRequest({ ...VALID, submitted_at: "1999-01-01T00:00:00.000Z" }));
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const stored = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(stored.submitted_at).not.toBe("1999-01-01T00:00:00.000Z");
  });

  it("asks Supabase for no body back, so visitor data is not echoed", async () => {
    await POST(makeRequest(VALID));
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Prefer).toBe("return=minimal");
  });

  it("never caches the insert or the response", async () => {
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
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers GET with 405", () => {
    const response = GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("rejects a form content type before reading the body", async () => {
    // A simple cross-site form post cannot set a JSON content type, so this also
    // closes the cheapest CSRF route.
    for (const contentType of [
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
      "text/plain",
    ]) {
      const response = await POST(makeRequest(VALID, { contentType }));
      expect(response.status).toBe(415);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a missing content type", async () => {
    expect((await POST(makeRequest(VALID, { contentType: null }))).status).toBe(415);
  });

  it("accepts a JSON content type with a charset parameter", async () => {
    const response = await POST(makeRequest(VALID, { contentType: "application/json; charset=utf-8" }));
    expect(response.status).toBe(202);
  });

  it("accepts a JSON content type with any casing", async () => {
    expect((await POST(makeRequest(VALID, { contentType: "Application/JSON" }))).status).toBe(202);
  });
});

describe("body size", () => {
  it("rejects an oversized declared Content-Length before reading", async () => {
    const response = await POST(
      makeRequest(VALID, { headers: { origin: SITE, "content-length": String(MAX_BODY_BYTES + 1) } }),
    );
    expect(response.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a negative or non-numeric Content-Length", async () => {
    for (const length of ["-1", "abc", "1e999x"]) {
      const response = await POST(
        makeRequest(VALID, { headers: { origin: SITE, "content-length": length } }),
      );
      expect(response.status).toBe(400);
    }
  });

  it("rejects an oversized body even when Content-Length is absent", async () => {
    // A chunked request carries no length, so the declared check cannot be the
    // only one. This is the case that actually holds.
    const huge = JSON.stringify({ ...VALID, message: "a".repeat(MAX_BODY_BYTES * 2) });
    const request = new Request("https://tmlguide.com/api/contact", {
      method: "POST",
      headers: { origin: SITE, "content-type": "application/json" },
      body: huge,
    });
    expect(request.headers.get("content-length")).toBeNull();

    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("counts bytes, not characters, for a multi-byte body", async () => {
    // A 5,000-character Japanese message is 15,000 bytes; the cap must be applied
    // to the encoded size or a legitimate message is mismeasured.
    const message = "あ".repeat(5_000);
    const response = await POST(makeRequest({ ...VALID, message }));
    expect(response.status).toBe(202);
  });

  it("stops reading an oversized chunked body instead of buffering it", async () => {
    /*
      Regression: the route used to call `request.text()` and measure the result,
      so an unbounded body was read into memory before the limit was applied. The
      stream below is far larger than the cap and is read incrementally, which is
      what a chunked request with no Content-Length looks like on the wire.
    */
    let pulled = 0;
    const chunk = new Uint8Array(8 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.byteLength;
        if (pulled > MAX_BODY_BYTES * 4) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
      },
    });

    const request = new Request("https://tmlguide.com/api/contact", {
      method: "POST",
      headers: { origin: SITE, "content-type": "application/json" },
      body: stream,
      // @ts-expect-error -- `duplex` is required for a stream body and missing from the DOM types.
      duplex: "half",
    });
    expect(request.headers.get("content-length")).toBeNull();

    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
    // The read stopped near the cap rather than consuming the whole stream.
    expect(pulled).toBeLessThan(MAX_BODY_BYTES * 4);
  });
});

describe("origin", () => {
  it("rejects a cross-origin request", async () => {
    const response = await POST(
      makeRequest(VALID, { headers: { origin: "https://evil.example", host: "tmlguide.com" } }),
    );
    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
    // The origin check runs before the limiter, so no allowance is spent on it.
  });

  it("rejects a request with no Origin and no Referer", async () => {
    const response = await POST(makeRequest(VALID, { headers: { host: "tmlguide.com" } }));
    expect(response.status).toBe(403);
  });

  it("accepts a same-origin Referer when Origin is absent", async () => {
    const response = await POST(
      makeRequest(VALID, { headers: { referer: `${SITE}/contact`, host: "tmlguide.com" } }),
    );
    expect(response.status).toBe(202);
  });

  it("rejects a forged Origin that merely starts with the site host", async () => {
    const response = await POST(
      makeRequest(VALID, {
        headers: { origin: "https://tmlguide.com.evil.example", host: "tmlguide.com" },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("checks origin before the body is parsed", async () => {
    const response = await POST(
      makeRequest("{not json", { headers: { origin: "https://evil.example", host: "x" } }),
    );
    expect(response.status).toBe(403);
  });
});

describe("rate limiting", () => {
  it("allows the configured number and then answers 429 with Retry-After", async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
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
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      await POST(makeRequest(VALID, { headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" } }));
    }
    const other = await POST(
      makeRequest(VALID, { headers: { origin: SITE, "x-forwarded-for": "198.51.100.7" } }),
    );
    expect(other.status).toBe(202);
  });

  it("shares one bucket for requests with no address, rather than exempting them", async () => {
    // Omitting the headers must not be a bypass.
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      await POST(makeRequest(VALID, { headers: { origin: SITE } }));
    }
    expect((await POST(makeRequest(VALID, { headers: { origin: SITE } }))).status).toBe(429);
  });

  it("counts a honeypot-triggering request against the limit", async () => {
    // A bot must not get free attempts by filling the honeypot.
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      const response = await POST(
        makeRequest({ ...VALID, website: "spam" }, { headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" } }),
      );
      expect(response.status).toBe(202);
    }
    const blocked = await POST(
      makeRequest({ ...VALID, website: "spam" }, { headers: { origin: SITE, "x-forwarded-for": "203.0.113.9" } }),
    );
    expect(blocked.status).toBe(429);
  });

  it("fails closed with 503 when the limiter itself is unavailable", async () => {
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
    // Nothing was written, and the caller was not told to retry later on a 429.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not leak an internal message when the limiter throws unexpectedly", async () => {
    setRateLimiterForTesting({
      shared: true,
      backend: "redis",
      check: async () => {
        throw new Error("ECONNREFUSED 10.0.0.5:6379");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest(VALID));
    const text = JSON.stringify(await body(response));
    expect(response.status).toBe(503);
    expect(text).not.toContain("10.0.0.5");
    expect(text).not.toContain("ECONNREFUSED");
  });
});

describe("honeypot", () => {
  it("returns the same 202 as a real submission and writes nothing", async () => {
    // Identical responses are the point: a bot that gets a different status or
    // body learns that the field is watched and removes it.
    const real = await POST(makeRequest(VALID));
    const caught = await POST(
      makeRequest({ ...VALID, website: "http://spam.example" }, { headers: { origin: SITE, "cf-connecting-ip": "198.51.100.1" } }),
    );

    expect(caught.status).toBe(real.status);
    expect(await body(caught)).toEqual(await body(real));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("catches a bot before validation reports its other mistakes", async () => {
    // A real bot usually sends junk elsewhere too. The honeypot response must not
    // reveal which other fields were wrong.
    const caught = await POST(makeRequest({ website: "spam", name: "x" }));
    expect(caught.status).toBe(202);
    expect(await body(caught)).toEqual({ status: "accepted" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("validation", () => {
  it("rejects an invalid payload with 422 and per-field messages", async () => {
    const response = await POST(makeRequest({ name: "A", email: "nope", topic: "x", message: "s" }));
    expect(response.status).toBe(422);
    const payload = await body(response);
    expect(payload.error).toBeTypeOf("string");
    expect(Object.keys(payload.fields as Record<string, string>).sort()).toEqual([
      "email",
      "message",
      "name",
      "topic",
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await POST(makeRequest(VALID, { raw: "{ not json" }));
    expect(response.status).toBe(400);
  });

  it("rejects a JSON array or a primitive", async () => {
    for (const raw of ["[]", "null", "42", '"text"']) {
      const response = await POST(makeRequest(VALID, { raw }));
      expect(response.status).toBe(400);
    }
  });

  it("rejects an empty body", async () => {
    const response = await POST(makeRequest(VALID, { raw: "" }));
    expect(response.status).toBe(400);
  });

  it("rejects an unknown topic", async () => {
    const response = await POST(makeRequest({ ...VALID, topic: "sales" }));
    expect(response.status).toBe(422);
  });
});

describe("database configuration", () => {
  it("returns 503 with a clear message when Supabase is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const response = await POST(makeRequest(VALID));
    expect(response.status).toBe(503);
    const payload = await body(response);
    // It must never claim the message was stored.
    expect(String(payload.error).toLowerCase()).toContain("not accepting messages");
    expect(JSON.stringify(payload)).not.toContain("accepted");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 503 when only one credential is present", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect((await POST(makeRequest(VALID))).status).toBe(503);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "key");
    vi.stubEnv("SUPABASE_URL", "");
    expect((await POST(makeRequest(VALID))).status).toBe(503);
  });

  it("refuses a plain-HTTP Supabase URL in production, so the key is not sent in clear text", () => {
    expect(
      readSupabaseConfig({
        SUPABASE_URL: "http://db.example.com",
        SUPABASE_SERVICE_ROLE_KEY: "k",
      }),
    ).toBeNull();
  });

  it("allows a local HTTP Supabase URL for development", () => {
    expect(
      readSupabaseConfig({
        SUPABASE_URL: "http://localhost:54321",
        SUPABASE_SERVICE_ROLE_KEY: "k",
      }),
    ).not.toBeNull();
    expect(
      readSupabaseConfig({
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "k",
      }),
    ).not.toBeNull();
  });

  it("refuses a malformed Supabase URL", () => {
    expect(
      readSupabaseConfig({ SUPABASE_URL: "not a url", SUPABASE_SERVICE_ROLE_KEY: "k" }),
    ).toBeNull();
  });

  it("strips a trailing slash so the REST path is not doubled", () => {
    const config = readSupabaseConfig({
      SUPABASE_URL: "https://db.example.com///",
      SUPABASE_SERVICE_ROLE_KEY: "k",
    });
    expect(config?.url).toBe("https://db.example.com");
  });
});

describe("database failures", () => {
  it("returns 502 when Supabase rejects the insert, without leaking the reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"message":"column \\"topic\\" does not exist"}', { status: 400 })),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest(VALID));
    expect(response.status).toBe(502);
    const text = JSON.stringify(await body(response));
    expect(text).not.toContain("column");
    expect(text).not.toContain("does not exist");
    expect(text).not.toContain("service-role-key");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns 502 when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND db.example.com");
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest(VALID));
    expect(response.status).toBe(502);
    const text = JSON.stringify(await body(response));
    expect(text).not.toContain("ENOTFOUND");
    expect(text).not.toContain("db.example.com");
  });

  it("never includes a stack trace in any error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(makeRequest(VALID));
    const text = JSON.stringify(await body(response));
    expect(text).not.toMatch(/\bat\s+\w+.*:\d+:\d+/);
    expect(text).not.toContain("node_modules");
    expect(text).not.toContain("stack");
  });

  it("does not send the service role key anywhere but the configured origin", async () => {
    await POST(makeRequest(VALID));
    const [url] = fetchSpy.mock.calls[0] as unknown as [string];
    expect(new URL(url).origin).toBe("https://db.example.com");
  });
});

describe("response hygiene", () => {
  it("sets no-store on every response, including failures", async () => {
    const cases = [
      makeRequest(VALID),
      makeRequest(VALID, { contentType: "text/plain" }),
      makeRequest(VALID, { headers: { origin: "https://evil.example" } }),
      makeRequest(VALID, { raw: "{bad" }),
    ];
    for (const request of cases) {
      const response = await POST(request);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("returns JSON with a stable error field on every failure", async () => {
    const responses = [
      await POST(makeRequest(VALID, { contentType: "text/plain" })),
      await POST(makeRequest(VALID, { headers: { origin: "https://evil.example" } })),
      await POST(makeRequest(VALID, { raw: "{bad" })),
      await POST(makeRequest({ ...VALID, email: "bad" })),
    ];
    for (const response of responses) {
      const payload = await body(response);
      expect(payload.error).toBeTypeOf("string");
      expect((payload.error as string).length).toBeGreaterThan(0);
    }
  });
});
