/**
 * Tests for the Turnstile verifier.
 *
 * The rule this file protects: configured means enforced, and an unreachable Cloudflare
 * is a refusal rather than a bypass. A bot check that lets traffic through when the
 * verification service is down is worse than none, because an attacker knows when it is
 * down.
 */

import { describe, expect, it, vi } from "vitest";
import { TURNSTILE_VERIFY_ENDPOINT, isTurnstileConfigured, verifyTurnstile } from "./turnstile";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("isTurnstileConfigured", () => {
  it("is false with no secret and true with one", () => {
    expect(isTurnstileConfigured({})).toBe(false);
    expect(isTurnstileConfigured({ TURNSTILE_SECRET_KEY: "" })).toBe(false);
    expect(isTurnstileConfigured({ TURNSTILE_SECRET_KEY: "   " })).toBe(false);
    expect(isTurnstileConfigured({ TURNSTILE_SECRET_KEY: "secret" })).toBe(true);
  });
});

describe("verifyTurnstile", () => {
  it("skips cleanly when the deployment has no secret", async () => {
    const fetchImpl = vi.fn();
    const outcome = await verifyTurnstile({ token: undefined, env: {}, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.skipped).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a configured deployment with no token", async () => {
    const fetchImpl = vi.fn();
    const outcome = await verifyTurnstile({
      token: undefined,
      env: { TURNSTILE_SECRET_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("missing-token");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses an implausibly long token without calling Cloudflare", async () => {
    const fetchImpl = vi.fn();
    const outcome = await verifyTurnstile({
      token: "a".repeat(5000),
      env: { TURNSTILE_SECRET_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("accepts a token Cloudflare verifies, sending the secret and the client IP", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));
    const outcome = await verifyTurnstile({
      token: "a-token",
      remoteIp: "203.0.113.9",
      env: { TURNSTILE_SECRET_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.skipped).toBe(false);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TURNSTILE_VERIFY_ENDPOINT);
    const body = new URLSearchParams(String(init.body));
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("a-token");
    expect(body.get("remoteip")).toBe("203.0.113.9");
  });

  it("omits the IP when it is not known, rather than sending a placeholder", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));
    await verifyTurnstile({
      token: "a-token",
      env: { TURNSTILE_SECRET_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URLSearchParams(String(init.body)).has("remoteip")).toBe(false);
  });

  it("refuses a token Cloudflare rejects", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }));
    const outcome = await verifyTurnstile({
      token: "bad",
      env: { TURNSTILE_SECRET_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("invalid-token");
  });

  it("reports unavailable rather than invalid when Cloudflare errors", async () => {
    // The distinction matters: an outage is not the reader's fault.
    const fetchImpl = vi.fn(async () => new Response("oops", { status: 500 }));
    const outcome = await verifyTurnstile({
      token: "a-token",
      env: { TURNSTILE_SECRET_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("unavailable");
  });

  it("reports unavailable on a transport failure, and never throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("offline");
    });
    const outcome = await verifyTurnstile({
      token: "a-token",
      env: { TURNSTILE_SECRET_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("unavailable");
  });

  it("reports unavailable on a non-JSON body", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>", { status: 200 }));
    const outcome = await verifyTurnstile({
      token: "a-token",
      env: { TURNSTILE_SECRET_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("unavailable");
  });

  it("requires success to be literally true, so a truthy string is not enough", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: "yes" }));
    const outcome = await verifyTurnstile({
      token: "a-token",
      env: { TURNSTILE_SECRET_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome.ok).toBe(false);
  });

  it("does not cache the verification request", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));
    await verifyTurnstile({
      token: "a-token",
      env: { TURNSTILE_SECRET_KEY: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.cache).toBe("no-store");
  });
});
