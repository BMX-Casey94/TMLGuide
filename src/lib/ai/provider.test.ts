/**
 * Tests for the provider-agnostic adapter.
 *
 * Every network call is replaced. What is asserted is the contract the route relies
 * on: the exact request shape sent to each provider, and that every failure is a
 * typed value rather than an exception or — worst of all — a fabricated answer.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPENROUTER_MODEL,
  MISTRAL_ENDPOINT,
  OPENROUTER_APP_TITLE,
  OPENROUTER_ENDPOINT,
  buildRequestBody,
  buildRequestHeaders,
  contextLimitFor,
  createProvider,
  estimateCostPence,
  estimateMessageTokens,
  estimateTokens,
  priceForModel,
  providerFromEnv,
  readProviderConfig,
  resolveReferer,
  type ProviderEnv,
} from "./provider";

const BASE_ENV: ProviderEnv = {
  OPENROUTER_API_KEY: "or-key",
  NEXT_PUBLIC_SITE_URL: "https://tml.guide",
};

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

const COMPLETION = {
  choices: [{ message: { role: "assistant", content: "The day pass is €144." }, finish_reason: "stop" }],
  usage: { prompt_tokens: 1200, completion_tokens: 90 },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("readProviderConfig", () => {
  it("defaults to OpenRouter with the documented Gemini 3.1 model", () => {
    const config = readProviderConfig(BASE_ENV);
    expect(config.ok).toBe(true);
    if (!config.ok) return;
    expect(config.id).toBe("openrouter");
    expect(config.model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(config.model).toContain("gemini-3.1");
    expect(config.endpoint).toBe(OPENROUTER_ENDPOINT);
  });

  it("accepts any OpenRouter model slug", () => {
    const config = readProviderConfig({ ...BASE_ENV, OPENROUTER_MODEL: "google/gemini-3.1-pro-preview" });
    expect(config.ok).toBe(true);
    if (!config.ok) return;
    expect(config.model).toBe("google/gemini-3.1-pro-preview");
  });

  it("returns unconfigured when the key is missing, never a default key", () => {
    const config = readProviderConfig({ NEXT_PUBLIC_SITE_URL: "https://tml.guide" });
    expect(config.ok).toBe(false);
    if (config.ok) return;
    expect(config.code).toBe("unconfigured");
    expect(config.reason).toContain("OPENROUTER_API_KEY");
  });

  it("treats a whitespace-only key as missing", () => {
    const config = readProviderConfig({ OPENROUTER_API_KEY: "   " });
    expect(config.ok).toBe(false);
  });

  it("selects the Mistral EU endpoint when asked", () => {
    const config = readProviderConfig({
      AI_PROVIDER: "mistral",
      MISTRAL_API_KEY: "mistral-key",
      MISTRAL_MODEL: "mistral-small-latest",
    });
    expect(config.ok).toBe(true);
    if (!config.ok) return;
    expect(config.id).toBe("mistral");
    expect(config.endpoint).toBe(MISTRAL_ENDPOINT);
    expect(config.endpoint).toContain("api.eu.mistral.ai");
  });

  it("reports unconfigured for mistral with no key", () => {
    const config = readProviderConfig({ AI_PROVIDER: "mistral" });
    expect(config.ok).toBe(false);
    if (config.ok) return;
    expect(config.provider).toBe("mistral");
    expect(config.reason).toContain("MISTRAL_API_KEY");
  });

  it("refuses an unknown provider rather than silently falling back", () => {
    // An operator who typed a provider name from the spike should be told, not billed
    // by a different one.
    const config = readProviderConfig({ ...BASE_ENV, AI_PROVIDER: "azure-eu" });
    expect(config.ok).toBe(false);
    if (config.ok) return;
    expect(config.reason).toContain("azure-eu");
  });

  it("is case- and whitespace-insensitive about the provider name", () => {
    const config = readProviderConfig({ ...BASE_ENV, AI_PROVIDER: "  OpenRouter  " });
    expect(config.ok).toBe(true);
  });
});

describe("resolveReferer", () => {
  it("uses the configured origin", () => {
    expect(resolveReferer("https://tml.guide/ask?x=1")).toBe("https://tml.guide");
  });

  it("falls back rather than sending a non-web scheme", () => {
    expect(resolveReferer("javascript:alert(1)")).toBe("https://tml.guide");
    expect(resolveReferer("not a url")).toBe("https://tml.guide");
    expect(resolveReferer(undefined)).toBe("https://tml.guide");
  });
});

describe("request construction", () => {
  const config = readProviderConfig(BASE_ENV);
  if (!config.ok) throw new Error("test setup");

  it("sends the privacy flag and attribution headers OpenRouter documents", () => {
    const body = buildRequestBody(config, {
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    const headers = buildRequestHeaders(config);

    // Prompt data must not be eligible for training.
    expect(body.provider).toEqual({ data_collection: "deny" });
    expect(headers["X-Title"]).toBe(OPENROUTER_APP_TITLE);
    expect(headers["HTTP-Referer"]).toBe("https://tml.guide");
    expect(headers.Authorization).toBe("Bearer or-key");
  });

  it("never sends a tools field, so the model has nothing to call", () => {
    const body = buildRequestBody(config, {
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("tool_choice");
    expect(body).not.toHaveProperty("functions");
  });

  it("omits OpenRouter-specific fields for Mistral", () => {
    const mistral = readProviderConfig({ AI_PROVIDER: "mistral", MISTRAL_API_KEY: "k" });
    if (!mistral.ok) throw new Error("test setup");
    const body = buildRequestBody(mistral, {
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(body).not.toHaveProperty("provider");
    expect(body).not.toHaveProperty("usage");
    const headers = buildRequestHeaders(mistral);
    expect(headers).not.toHaveProperty("HTTP-Referer");
    expect(headers).not.toHaveProperty("X-Title");
  });

  it("is a stateless request: no conversation id, no store flag", () => {
    const body = buildRequestBody(config, {
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(body).not.toHaveProperty("conversation");
    expect(body).not.toHaveProperty("store");
    expect(body.stream).toBe(false);
  });
});

describe("the unconfigured adapter", () => {
  it("resolves every completion to unconfigured without touching the network", async () => {
    const fetchSpy = vi.fn();
    const provider = createProvider(readProviderConfig({}), { fetchImpl: fetchSpy as unknown as typeof fetch });

    const result = await provider.complete({
      messages: [{ role: "user", content: "how much is a day pass" }],
      maxOutputTokens: 300,
      requestId: "r1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unconfigured");
    // The single most important assertion in this file: no fabricated answer.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("complete", () => {
  it("returns the text, usage and provenance on success", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse(COMPLETION));
    const provider = createProvider(readProviderConfig(BASE_ENV), { fetchImpl: fetchSpy as unknown as typeof fetch });

    const result = await provider.complete({
      messages: [{ role: "user", content: "how much is a day pass" }],
      maxOutputTokens: 300,
      requestId: "r1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe("The day pass is €144.");
    expect(result.provider).toBe("openrouter");
    expect(result.model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(result.usage.inputTokens).toBe(1200);
    expect(result.usage.outputTokens).toBe(90);
    expect(result.usage.costPence).toBeGreaterThanOrEqual(0);
    expect(result.finishReason).toBe("stop");

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENROUTER_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
  });

  it("reads content returned as an array of parts", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: [{ type: "text", text: "€144" }, { type: "text", text: " a day." }] } }],
      }),
    );
    const provider = createProvider(readProviderConfig(BASE_ENV), { fetchImpl: fetchSpy as unknown as typeof fetch });
    const result = await provider.complete({
      messages: [{ role: "user", content: "q" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe("€144 a day.");
  });

  it("maps a 429 to rate-limited with the retry delay", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ error: "slow down" }, { status: 429, headers: { "retry-after": "42" } }));
    const provider = createProvider(readProviderConfig(BASE_ENV), { fetchImpl: fetchSpy as unknown as typeof fetch });
    const result = await provider.complete({
      messages: [{ role: "user", content: "q" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("rate-limited");
    expect(result.retryAfterSec).toBe(42);
  });

  it("maps a 500 to upstream-error", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({}, { status: 500 }));
    const provider = createProvider(readProviderConfig(BASE_ENV), { fetchImpl: fetchSpy as unknown as typeof fetch });
    const result = await provider.complete({
      messages: [{ role: "user", content: "q" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upstream-error");
  });

  it("maps a non-JSON body to bad-response", async () => {
    const fetchSpy = vi.fn(async () => new Response("<html>nope</html>", { status: 200 }));
    const provider = createProvider(readProviderConfig(BASE_ENV), { fetchImpl: fetchSpy as unknown as typeof fetch });
    const result = await provider.complete({
      messages: [{ role: "user", content: "q" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("bad-response");
  });

  it("treats empty content as content-filtered rather than an empty answer", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ choices: [{ message: { content: "   " }, finish_reason: "content_filter" }] }));
    const provider = createProvider(readProviderConfig(BASE_ENV), { fetchImpl: fetchSpy as unknown as typeof fetch });
    const result = await provider.complete({
      messages: [{ role: "user", content: "q" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("content-filtered");
  });

  it("maps a 200 carrying an error object to upstream-error", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ error: { message: "upstream refused" } }));
    const provider = createProvider(readProviderConfig(BASE_ENV), { fetchImpl: fetchSpy as unknown as typeof fetch });
    const result = await provider.complete({
      messages: [{ role: "user", content: "q" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upstream-error");
  });

  it("maps a transport failure to upstream-error and never throws", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const provider = createProvider(readProviderConfig(BASE_ENV), { fetchImpl: fetchSpy as unknown as typeof fetch });
    const result = await provider.complete({
      messages: [{ role: "user", content: "q" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upstream-error");
  });

  it("reports a deadline as timeout", async () => {
    const fetchSpy = vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "TimeoutError";
      throw error;
    });
    const provider = createProvider(readProviderConfig(BASE_ENV), { fetchImpl: fetchSpy as unknown as typeof fetch });
    const result = await provider.complete({
      messages: [{ role: "user", content: "q" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("timeout");
  });

  it("reports a caller abort as aborted, not as a timeout", async () => {
    const controller = new AbortController();
    const fetchSpy = vi.fn(async () => {
      controller.abort();
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });
    const provider = createProvider(readProviderConfig(BASE_ENV), { fetchImpl: fetchSpy as unknown as typeof fetch });
    const result = await provider.complete(
      { messages: [{ role: "user", content: "q" }], maxOutputTokens: 100, requestId: "r1" },
      controller.signal,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("aborted");
  });

  it("prefers the provider's own reported charge over the local price table", async () => {
    // OpenRouter returns the real cost when `usage.include` is set. A stale row in our
    // own table must not overstate a bill.
    const fetchSpy = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: "answer" } }],
        usage: { prompt_tokens: 1_000_000, completion_tokens: 0, cost: 0.5 },
      }),
    );
    const provider = createProvider(readProviderConfig({ ...BASE_ENV, AI_USD_PER_GBP: "2" }), {
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    const result = await provider.complete({
      messages: [{ role: "user", content: "q" }],
      maxOutputTokens: 100,
      requestId: "r1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // $0.50 at $2 per £1 is £0.25, so 25p.
    expect(result.usage.costPence).toBe(25);
  });
});

describe("cost estimation", () => {
  it("rounds up, so a run of tiny calls cannot slip past the cap", () => {
    const pence = estimateCostPence("google/gemini-3.1-flash-lite-preview", 1, 1, 1);
    expect(pence).toBeGreaterThan(0);
    expect(Number.isInteger(pence)).toBe(true);
  });

  it("prices a known model from its table row", () => {
    const price = priceForModel("google/gemini-3.1-flash-lite-preview");
    expect(price.input).toBeGreaterThan(0);
    expect(price.output).toBeGreaterThan(price.input);
  });

  it("prices an unknown model at the expensive end, so the cap binds sooner", () => {
    const unknown = priceForModel("someone/unlisted-model");
    const known = priceForModel("google/gemini-3.1-flash-lite");
    expect(unknown.output).toBeGreaterThan(known.output);
  });

  it("scales with input and output tokens", () => {
    const small = estimateCostPence("google/gemini-3.1-flash-lite", 100, 100);
    const large = estimateCostPence("google/gemini-3.1-flash-lite", 100_000, 10_000);
    expect(large).toBeGreaterThan(small);
  });

  it("is exposed on the adapter so the cap can be reserved before the call", () => {
    const provider = createProvider(readProviderConfig(BASE_ENV));
    expect(provider.estimateCostPence(1000, 400)).toBe(estimateCostPence(DEFAULT_OPENROUTER_MODEL, 1000, 400));
    expect(provider.zeroRetention).toBe(true);
  });
});

describe("token estimation", () => {
  it("leans high, so a reservation is never short", () => {
    const text = "a".repeat(360);
    // 3.6 chars per token means 100 tokens; a real tokeniser would say 90.
    expect(estimateTokens(text)).toBe(100);
  });

  it("returns zero for empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("adds per-message overhead", () => {
    const single = estimateMessageTokens([{ role: "user", content: "hello" }]);
    expect(single).toBe(estimateTokens("hello") + 4);
  });
});

describe("contextLimitFor", () => {
  it("gives Gemini a large window and unknown models a conservative one", () => {
    expect(contextLimitFor("google/gemini-3.1-pro-preview")).toBeGreaterThan(100_000);
    expect(contextLimitFor("someone/unlisted")).toBe(32_000);
  });
});

describe("providerFromEnv", () => {
  it("reads the process environment", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "from-env");
    vi.stubEnv("OPENROUTER_MODEL", "google/gemini-3.1-pro-preview");
    const provider = providerFromEnv();
    expect(provider.id).toBe("openrouter");
    expect(provider.model).toBe("google/gemini-3.1-pro-preview");
  });
});
