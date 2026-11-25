/**
 * Provider-agnostic LLM adapter for "Ask the guide".
 *
 * The route never names a vendor: it hands this module a list of chat messages
 * and receives either prose plus usage, or a typed failure. Adding a provider is
 * one `case`; switching one is an environment variable.
 *
 * Two adapters exist today, both OpenAI-compatible on the wire so the shared
 * code path is one function:
 *
 * - `openrouter` (default) — <https://openrouter.ai/api/v1/chat/completions>.
 *   Model is any OpenRouter slug, so `google/gemini-3.1-flash-lite-preview` is
 *   only a default and never a hard-coded choice. The request carries
 *   `provider: { data_collection: "deny" }` so OpenRouter will only route to
 *   upstreams that do not train on prompts, plus the `HTTP-Referer` and
 *   `X-Title` attribution headers OpenRouter asks for.
 * - `mistral` — <https://api.eu.mistral.ai/v1/chat/completions>, the EU
 *   inference endpoint. Selected with `AI_PROVIDER=mistral`, which keeps the
 *   route genuinely provider-agnostic rather than nominally so.
 *
 * Three behaviours are deliberate:
 *
 * 1. **No key means `unconfigured`, never a fabricated answer.** The route turns
 *    that into a `503` with copy that tells the reader the guide's verified
 *    pages are still there. There is no mock completion anywhere in this module.
 * 2. **No tools.** The request body has no `tools` field and no function-calling
 *    surface, so a prompt injection has nothing to reach for.
 * 3. **Failures are values, not exceptions.** A timeout, a `429` or a `5xx`
 *    resolves to a typed failure so the route has one place to decide what the
 *    reader is told. Only a programming error throws.
 */

import type { EditionId } from "@/data/schemas";

/** Cross-edition answers use "all", matching the data layer's scope value. */
export type Edition = EditionId | "all";

/** The adapters this build ships. */
export type ProviderId = "openrouter" | "mistral";

/** Every failure a caller has to handle. */
export type ProviderFailureCode =
  /** No API key, or `AI_PROVIDER` names an adapter this build does not have. */
  | "unconfigured"
  /** The request hit its own deadline. */
  | "timeout"
  /** The caller's signal fired, normally because the reader navigated away. */
  | "aborted"
  /** `429` from the provider. */
  | "rate-limited"
  /** A non-2xx response, or a transport error. */
  | "upstream-error"
  /** A 2xx whose body was not a completion. */
  | "bad-response"
  /** The provider declined to produce text (safety filter, or empty content). */
  | "content-filtered";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
}

export interface CompletionRequest {
  readonly messages: readonly ChatMessage[];
  /** Upper bound on the answer, so cost can be reserved before the call. */
  readonly maxOutputTokens: number;
  /** Low by design: this is a factual lookup, not creative writing. */
  readonly temperature?: number;
  /** Correlates the spend meter and logs. Never contains question text. */
  readonly requestId: string;
}

export interface CompletionUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Estimated from the provider's list rate; see {@link estimateCostPence}. */
  readonly costPence: number;
  readonly latencyMs: number;
}

export interface CompletionSuccess {
  readonly ok: true;
  readonly text: string;
  readonly provider: ProviderId;
  readonly model: string;
  readonly usage: CompletionUsage;
  readonly finishReason: string | null;
}

export interface CompletionFailure {
  readonly ok: false;
  readonly code: ProviderFailureCode;
  /** Safe for an operator log. Never includes prompt or answer text. */
  readonly detail: string;
  readonly provider: ProviderId;
  readonly model: string;
  /** Present on `rate-limited` when the upstream supplied one. */
  readonly retryAfterSec?: number;
}

export type CompletionResult = CompletionSuccess | CompletionFailure;

export interface AiProvider {
  readonly id: ProviderId;
  readonly model: string;
  /** Context ceiling for this model, used by the route to trim passages. */
  readonly maxInputTokens: number;
  /** True when the contract is stateless and content is not retained. */
  readonly zeroRetention: boolean;
  complete(request: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult>;
  /** Cost in pence for a token count, from this adapter's published rate. */
  estimateCostPence(inputTokens: number, outputTokens: number): number;
}

export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const MISTRAL_ENDPOINT = "https://api.eu.mistral.ai/v1/chat/completions";

/**
 * The launch default.
 *
 * Gemini 3.1 Flash-Lite is the cheap tier, and a short-answer workload is
 * output-heavy so the "lite" label is not automatically the cheapest choice. Any
 * OpenRouter slug can be set in `OPENROUTER_MODEL`, including the Pro preview, so
 * this default is a starting point rather than a constraint.
 */
export const DEFAULT_OPENROUTER_MODEL = "google/gemini-3.1-flash-lite-preview";
export const DEFAULT_MISTRAL_MODEL = "mistral-small-latest";

/** The OpenRouter attribution header value. */
export const OPENROUTER_APP_TITLE = "TMLGuide";

/** Where OpenRouter sends attribution traffic when the site URL is unset. */
export const DEFAULT_REFERER = "https://tml.guide";

/**
 * Request deadline.
 *
 * A reader waiting on an answer is not waiting on a batch job. Thirty seconds is
 * generous enough for a 350-token reply from a busy provider and short enough
 * that a hung socket cannot hold a serverless invocation open to its own limit.
 */
export const PROVIDER_TIMEOUT_MS = 30_000;

/** Answer ceiling. The evaluation set's longest expected answer is a few sentences. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 600;

/**
 * List prices in USD per million tokens, by model slug prefix.
 *
 * **These are launch-time estimates and must be re-read from the provider's own
 * pricing page before the feature is enabled.** They are used for two things: the
 * pre-call reservation against the monthly cap, and the cost shown in an
 * operator log. Where OpenRouter returns its own `usage.cost`, that figure wins,
 * so a stale row here cannot overstate a real bill by more than the reservation
 * buffer.
 */
const MODEL_PRICES_USD_PER_MTOK: ReadonlyArray<{
  readonly prefix: string;
  readonly input: number;
  readonly output: number;
}> = [
  { prefix: "google/gemini-3.1-flash-lite", input: 0.1, output: 0.4 },
  { prefix: "google/gemini-3.1-flash", input: 0.3, output: 2.5 },
  { prefix: "google/gemini-3.1-pro", input: 1.25, output: 10 },
  { prefix: "mistral-small", input: 0.15, output: 0.6 },
  { prefix: "mistral-large", input: 0.77, output: 2.31 },
];

/**
 * Fallback for a model slug nobody priced.
 *
 * Deliberately at the expensive end of the plausible range: an unpriced model
 * must make the monthly cap bind sooner, not later.
 */
const FALLBACK_PRICE_USD_PER_MTOK = { input: 1.5, output: 8 } as const;

/**
 * GBP per USD, from the rate the provider spike recorded on 25 November 2026
 * (£1 = $1.310158). Overridable so an operator can re-price without a deploy.
 */
const DEFAULT_USD_PER_GBP = 1.3102;

/** Everything this module reads from the environment. */
export interface ProviderEnv {
  readonly AI_PROVIDER?: string | undefined;
  readonly OPENROUTER_API_KEY?: string | undefined;
  readonly OPENROUTER_MODEL?: string | undefined;
  readonly MISTRAL_API_KEY?: string | undefined;
  readonly MISTRAL_MODEL?: string | undefined;
  readonly NEXT_PUBLIC_SITE_URL?: string | undefined;
  readonly AI_USD_PER_GBP?: string | undefined;
  readonly [key: string]: string | undefined;
}

export interface ResolvedConfig {
  readonly ok: true;
  readonly id: ProviderId;
  readonly model: string;
  readonly apiKey: string;
  readonly endpoint: string;
  readonly referer: string;
  readonly usdPerGbp: number;
}

export interface UnconfiguredResult {
  readonly ok: false;
  readonly code: "unconfigured";
  readonly provider: ProviderId;
  readonly model: string;
  readonly reason: string;
}

export type ProviderConfig = ResolvedConfig | UnconfiguredResult;

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Reduces a configured site URL to something safe to send as `HTTP-Referer`.
 *
 * OpenRouter only reads it as an attribution string, but an operator typo should
 * not put a `javascript:` URL in an outgoing header, and the value is echoed in
 * OpenRouter's dashboard.
 */
export function resolveReferer(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_REFERER;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return DEFAULT_REFERER;
    return url.origin;
  } catch {
    return DEFAULT_REFERER;
  }
}

/**
 * Reads the provider configuration.
 *
 * An unknown `AI_PROVIDER` is a configuration error rather than a silent fall
 * back to the default: an operator who typed `mistral-eu` should be told, not
 * quietly billed by OpenRouter.
 */
export function readProviderConfig(env: ProviderEnv = process.env): ProviderConfig {
  const requested = (env.AI_PROVIDER?.trim() || "openrouter").toLowerCase();

  if (requested !== "openrouter" && requested !== "mistral") {
    return {
      ok: false,
      code: "unconfigured",
      provider: "openrouter",
      model: DEFAULT_OPENROUTER_MODEL,
      reason: `AI_PROVIDER is "${requested}", which is not a provider this build supports.`,
    };
  }

  const usdPerGbp = positiveNumber(env.AI_USD_PER_GBP, DEFAULT_USD_PER_GBP);

  if (requested === "mistral") {
    const model = env.MISTRAL_MODEL?.trim() || DEFAULT_MISTRAL_MODEL;
    const apiKey = env.MISTRAL_API_KEY?.trim() ?? "";
    if (apiKey === "") {
      return {
        ok: false,
        code: "unconfigured",
        provider: "mistral",
        model,
        reason: "MISTRAL_API_KEY is not set.",
      };
    }
    return {
      ok: true,
      id: "mistral",
      model,
      apiKey,
      endpoint: MISTRAL_ENDPOINT,
      referer: resolveReferer(env.NEXT_PUBLIC_SITE_URL),
      usdPerGbp,
    };
  }

  const model = env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
  const apiKey = env.OPENROUTER_API_KEY?.trim() ?? "";
  if (apiKey === "") {
    return {
      ok: false,
      code: "unconfigured",
      provider: "openrouter",
      model,
      reason: "OPENROUTER_API_KEY is not set.",
    };
  }

  return {
    ok: true,
    id: "openrouter",
    model,
    apiKey,
    endpoint: OPENROUTER_ENDPOINT,
    referer: resolveReferer(env.NEXT_PUBLIC_SITE_URL),
    usdPerGbp,
  };
}

/** The published rate for a model slug, in USD per million tokens. */
export function priceForModel(model: string): { input: number; output: number } {
  const lower = model.toLowerCase();
  const match = MODEL_PRICES_USD_PER_MTOK.find((row) => lower.startsWith(row.prefix));
  return match === undefined
    ? { input: FALLBACK_PRICE_USD_PER_MTOK.input, output: FALLBACK_PRICE_USD_PER_MTOK.output }
    : { input: match.input, output: match.output };
}

/**
 * Cost in whole pence, rounded up.
 *
 * Rounding up matters: a reservation that rounds down would let a run of tiny
 * calls slip past the cap one penny at a time. The conversion is USD → GBP using
 * the configured rate, because providers bill in dollars and the cap is in
 * pounds.
 */
export function estimateCostPence(
  model: string,
  inputTokens: number,
  outputTokens: number,
  usdPerGbp: number = DEFAULT_USD_PER_GBP,
): number {
  const price = priceForModel(model);
  const safeIn = Number.isFinite(inputTokens) ? Math.max(0, inputTokens) : 0;
  const safeOut = Number.isFinite(outputTokens) ? Math.max(0, outputTokens) : 0;
  const usd = (safeIn / 1_000_000) * price.input + (safeOut / 1_000_000) * price.output;
  const gbp = usd / (Number.isFinite(usdPerGbp) && usdPerGbp > 0 ? usdPerGbp : DEFAULT_USD_PER_GBP);
  return Math.ceil(gbp * 100);
}

/**
 * Rough token count for a string.
 *
 * Four characters per token is the usual rule of thumb for English; 3.6 is used
 * here so the estimate leans high. Over-estimating costs nothing beyond a
 * slightly early reservation, whereas under-estimating is how a spend cap gets
 * exceeded before it notices.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 3.6);
}

/** Token estimate for a whole message list, including per-message overhead. */
export function estimateMessageTokens(messages: readonly ChatMessage[]): number {
  let total = 0;
  for (const message of messages) total += estimateTokens(message.content) + 4;
  return total;
}

/** Context ceilings, by model family. Conservative where unknown. */
export function contextLimitFor(model: string): number {
  const lower = model.toLowerCase();
  if (lower.includes("gemini")) return 128_000;
  if (lower.startsWith("mistral-large")) return 128_000;
  if (lower.startsWith("mistral")) return 32_000;
  return 32_000;
}

/** Joins a caller's signal with the adapter's own deadline. */
function withDeadline(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const deadline = AbortSignal.timeout(timeoutMs);
  if (signal === undefined) return deadline;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, deadline]);
  // Fallback for a runtime without `AbortSignal.any`: the deadline alone still
  // bounds the call, and the caller's abort is handled by the fetch promise.
  return deadline;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extracts completion text from an OpenAI-compatible body.
 *
 * Some upstreams return `content` as an array of parts rather than a string, so
 * both shapes are read. Anything else is `null` and becomes `bad-response`,
 * because a guess here would be the one place a wrong answer could enter.
 */
function readContent(choice: unknown): string | null {
  if (!isRecord(choice)) return null;
  const message = choice.message;
  if (!isRecord(message)) return null;
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : null))
      .filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join("") : null;
  }
  return null;
}

function readUsage(body: Record<string, unknown>): { input: number; output: number; costUsd: number | null } {
  const usage = isRecord(body.usage) ? body.usage : {};
  const promptTokens = Number(usage.prompt_tokens);
  const completionTokens = Number(usage.completion_tokens);
  // OpenRouter reports the real charge in USD when `usage.include` is requested.
  const cost = Number(usage.cost);
  return {
    input: Number.isFinite(promptTokens) && promptTokens >= 0 ? promptTokens : 0,
    output: Number.isFinite(completionTokens) && completionTokens >= 0 ? completionTokens : 0,
    costUsd: Number.isFinite(cost) && cost >= 0 ? cost : null,
  };
}

function retryAfterFrom(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (header === null) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

/** Builds the request body shared by both adapters. */
export function buildRequestBody(
  config: ResolvedConfig,
  request: CompletionRequest,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    temperature: request.temperature ?? 0.2,
    max_tokens: request.maxOutputTokens,
    stream: false,
  };

  if (config.id === "openrouter") {
    /*
      `data_collection: "deny"` restricts routing to upstreams that do not train
      on or retain prompts for training. `usage.include` asks for the real charge,
      so the ledger reconciles against what OpenRouter actually billed rather than
      against our own table.
    */
    body.provider = { data_collection: "deny" };
    body.usage = { include: true };
  }

  return body;
}

/** Builds the request headers shared by both adapters. */
export function buildRequestHeaders(config: ResolvedConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.id === "openrouter") {
    headers["HTTP-Referer"] = config.referer;
    headers["X-Title"] = OPENROUTER_APP_TITLE;
  }
  return headers;
}

/**
 * Creates an adapter from a resolved configuration.
 *
 * When the configuration is incomplete, the returned object still satisfies the
 * interface but every completion resolves to `unconfigured`. That keeps the
 * route free of `if (provider === null)` branches and guarantees there is no
 * code path that invents an answer.
 */
export function createProvider(
  config: ProviderConfig,
  deps: { readonly fetchImpl?: typeof fetch; readonly timeoutMs?: number } = {},
): AiProvider {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const timeoutMs = deps.timeoutMs ?? PROVIDER_TIMEOUT_MS;

  if (!config.ok) {
    return {
      id: config.provider,
      model: config.model,
      maxInputTokens: contextLimitFor(config.model),
      zeroRetention: false,
      async complete(): Promise<CompletionResult> {
        return {
          ok: false,
          code: "unconfigured",
          detail: config.reason,
          provider: config.provider,
          model: config.model,
        };
      },
      estimateCostPence(inputTokens, outputTokens) {
        return estimateCostPence(config.model, inputTokens, outputTokens);
      },
    };
  }

  const resolved = config;

  return {
    id: resolved.id,
    model: resolved.model,
    maxInputTokens: contextLimitFor(resolved.model),
    // Both adapters are stateless `chat/completions` calls. OpenRouter's privacy
    // flag and Mistral's EU endpoint are the contract; neither stores a transcript
    // on our side, which is what makes the retention terms tolerable.
    zeroRetention: true,

    estimateCostPence(inputTokens, outputTokens) {
      return estimateCostPence(resolved.model, inputTokens, outputTokens, resolved.usdPerGbp);
    },

    async complete(request, signal): Promise<CompletionResult> {
      const startedAt = Date.now();
      const estimatePence = (input: number, output: number) =>
        estimateCostPence(resolved.model, input, output, resolved.usdPerGbp);

      let response: Response;
      try {
        response = await fetchImpl(resolved.endpoint, {
          method: "POST",
          headers: buildRequestHeaders(resolved),
          body: JSON.stringify(buildRequestBody(resolved, request)),
          signal: withDeadline(signal, timeoutMs),
          // A completion is never cacheable, and a proxy that stored one would
          // serve one reader's answer to another.
          cache: "no-store",
        });
      } catch (error) {
        const aborted = signal?.aborted === true;
        const timedOut =
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError") &&
          !aborted;
        return {
          ok: false,
          code: aborted ? "aborted" : timedOut ? "timeout" : "upstream-error",
          detail: `Request to ${resolved.id} failed before a response`,
          provider: resolved.id,
          model: resolved.model,
        };
      }

      if (!response.ok) {
        const retryAfterSec = retryAfterFrom(response);
        const failure: CompletionFailure = {
          ok: false,
          code: response.status === 429 ? "rate-limited" : "upstream-error",
          detail: `${resolved.id} responded with HTTP ${response.status}`,
          provider: resolved.id,
          model: resolved.model,
          ...(retryAfterSec === undefined ? {} : { retryAfterSec }),
        };
        return failure;
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return {
          ok: false,
          code: "bad-response",
          detail: `${resolved.id} returned a body that was not JSON`,
          provider: resolved.id,
          model: resolved.model,
        };
      }

      if (!isRecord(body)) {
        return {
          ok: false,
          code: "bad-response",
          detail: `${resolved.id} returned a non-object body`,
          provider: resolved.id,
          model: resolved.model,
        };
      }

      if (isRecord(body.error) && typeof body.error.message === "string") {
        // OpenRouter can report an upstream failure with a 200 and an `error`.
        return {
          ok: false,
          code: "upstream-error",
          detail: `${resolved.id} reported an upstream error`,
          provider: resolved.id,
          model: resolved.model,
        };
      }

      const choices = body.choices;
      const first = Array.isArray(choices) ? choices[0] : undefined;
      const text = readContent(first);
      const finishReason =
        isRecord(first) && typeof first.finish_reason === "string" ? first.finish_reason : null;

      if (text === null || text.trim() === "") {
        return {
          ok: false,
          code: "content-filtered",
          detail: `${resolved.id} returned no usable text (finish_reason: ${finishReason ?? "none"})`,
          provider: resolved.id,
          model: resolved.model,
        };
      }

      const usage = readUsage(body);
      const costPence =
        usage.costUsd === null
          ? estimatePence(
              usage.input > 0 ? usage.input : estimateMessageTokens(request.messages),
              usage.output > 0 ? usage.output : estimateTokens(text),
            )
          : Math.ceil((usage.costUsd / resolved.usdPerGbp) * 100);

      return {
        ok: true,
        text: text.trim(),
        provider: resolved.id,
        model: resolved.model,
        finishReason,
        usage: {
          inputTokens: usage.input,
          outputTokens: usage.output,
          costPence: Math.max(0, costPence),
          latencyMs: Date.now() - startedAt,
        },
      };
    },
  };
}

/** Convenience: read the environment, then build the adapter. */
export function providerFromEnv(
  env: ProviderEnv = process.env,
  deps: { readonly fetchImpl?: typeof fetch; readonly timeoutMs?: number } = {},
): AiProvider {
  return createProvider(readProviderConfig(env), deps);
}
