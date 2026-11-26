// @vitest-environment node
/**
 * Tests for `GET /api/health`.
 *
 * Small on purpose. The route has one job and one thing that could go wrong
 * unnoticed: a body that grows a field. Everything else here is the method guard
 * and the caching header.
 *
 * `connection()` is replaced with a resolved promise. Outside a request there is no
 * request store for it to reach, so the real one throws; mocking it keeps this test
 * about the route's answer rather than about Next's rendering internals.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async (): Promise<void> => undefined };
});

import { DELETE, GET, OPTIONS, PATCH, POST, PUT } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The body of a response, parsed. */
async function json(response: Response): Promise<unknown> {
  return response.json();
}

describe("GET", () => {
  it("answers 200 with exactly { ok: true } and nothing else", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true });
  });

  it("is never cached", async () => {
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });

  it("reveals nothing about configured services", async () => {
    // The stubs are the point: if the body ever started reflecting configuration,
    // these values would appear in it.
    vi.stubEnv("SUPABASE_URL", "https://secret-project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret");
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-secret");
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET();
    const text = await response.text();

    expect(text).toBe('{"ok":true}');
    expect(text).not.toContain("supabase");
    expect(text).not.toContain("sk-or");
    expect(text).not.toContain("production");
  });
});

describe("every other method", () => {
  it.each([
    ["POST", POST],
    ["PUT", PUT],
    ["PATCH", PATCH],
    ["DELETE", DELETE],
    ["OPTIONS", OPTIONS],
  ])("refuses %s with 405 and an Allow header", async (method, handler) => {
    const response = handler();

    expect(response.status, method).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
    expect(await json(response)).toEqual({ error: "Method not allowed" });
  });
});
