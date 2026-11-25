/**
 * The answer pipeline.
 *
 * One function, called by `/api/ask` and by the evaluation runner, so the thing
 * the tests measure is the thing a reader gets. The order is deliberate and each
 * step is cheaper than the next:
 *
 * 1. Pre-check. Deterministic, free, and refuses an injection or a prohibited
 *    request before a penny is reserved.
 * 2. Retrieve. Verified `src/data/**` records only, with an optional pgvector
 *    attempt when that is configured and healthy.
 * 3. Decide. Nothing above the relevance floor means a refusal with links, not a
 *    guess. This is the single most important branch in the feature.
 * 4. Reserve budget. Before the provider is called, never after.
 * 5. Call the provider. A failure is a refund plus a typed refusal.
 * 6. Validate. Length, URLs and every currency amount are checked against the
 *    passages; a failure degrades to a refusal rather than showing bad text.
 * 7. Assemble citations. From the passages we supplied, never from the model.
 *
 * Nothing here writes a transcript. The question, the passages and the answer
 * live in this function's stack frame and are gone when it returns.
 */

import {
  type Edition,
  type KnowledgeChunk,
  type ScoredChunk,
  DEFAULT_TOP_K,
  formatDateRange,
  getKnowledgeBase,
  retrieve,
  type VectorRetriever,
} from "./knowledge";
import { fetchExcerpt, permittedTarget } from "./live-fetch";
import {
  MAX_QUESTION_CHARS,
  REFUSAL_COPY,
  type PreCheckReason,
  type RefusalReason,
  type SuppliedPassage,
  buildMessages,
  preCheck,
  validateAnswer,
} from "./prompt";
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  type AiProvider,
  estimateMessageTokens,
} from "./provider";
import type { SpendLedger } from "./spend-cap";

/** One citation as the reader sees it. */
export interface Citation {
  readonly index: number;
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  readonly lastVerified: string;
  /** True when this citation came from a live read of the official page. */
  readonly live: boolean;
}

/** A refusal is a successful outcome, not an error. */
export interface Refusal {
  readonly reason: RefusalReason;
  readonly message: string;
}

export interface AskResult {
  /** Presented answer text. Empty when {@link refusal} is set. */
  readonly answer: string;
  readonly citations: readonly Citation[];
  /** Oldest verification date among the citations, or null with no citations. */
  readonly lastVerified: string | null;
  readonly refusal: Refusal | null;
  /** The model that produced the text, or the configured model on a refusal. */
  readonly model: string;
  /** Which adapter answered. For an operator log, not for display. */
  readonly provider: string;
  /** Cost of this answer in pence, reconciled. 0 on a pre-call refusal. */
  readonly costPence: number;
}

export interface AskDeps {
  readonly provider: AiProvider;
  readonly ledger: SpendLedger;
  readonly vectors?: VectorRetriever | null;
  /** Injected for tests; production uses the module default. */
  readonly retrieveImpl?: typeof retrieve;
  /** Injected for tests; production uses {@link fetchExcerpt}. */
  readonly fetchImpl?: typeof fetchExcerpt;
  /** Whether a live read may be attempted. Defaults to true. */
  readonly allowLiveFetch?: boolean;
  readonly now?: () => Date;
}

export interface AskOptions {
  readonly question: string;
  readonly edition?: Edition;
  readonly requestId: string;
  readonly signal?: AbortSignal;
}

/**
 * The relevance score below which a live read becomes worth attempting.
 *
 * Above it, the verified data has a good match and the live page adds nothing but
 * latency and a compliance question. Below it, the guide's records are a poor fit
 * and one allow-listed page is the only permitted way to answer.
 */
export const LIVE_FETCH_SCORE_CEILING = 6;

/** Longest context passed to the model, in tokens. Above this, passages are dropped. */
export const MAX_CONTEXT_TOKENS = 6000;

/** The oldest of a set of ISO dates, which is the honest "as fresh as" claim. */
export function oldestDate(dates: readonly string[]): string | null {
  const usable = dates.filter((date) => /^\d{4}-\d{2}-\d{2}/.test(date));
  if (usable.length === 0) return null;
  return usable.reduce((oldest, date) => (date < oldest ? date : oldest));
}

/**
 * Extracts the citation indices a model used.
 *
 * `[1]`, `[2,3]` and `[1][2]` all occur in practice. An index outside the
 * supplied range is dropped rather than clamped: a `[7]` when four passages were
 * sent is a hallucinated citation, and silently showing passage 4 instead would
 * attribute a claim to the wrong record.
 */
export function citedIndices(text: string, available: number): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(/\[([\d,\s]+)\]/g)) {
    const inner = match[1] ?? "";
    for (const part of inner.split(",")) {
      const index = Number.parseInt(part.trim(), 10);
      if (Number.isInteger(index) && index >= 1 && index <= available) found.add(index);
    }
  }
  return [...found].sort((left, right) => left - right);
}

/**
 * Strips citation markers the model invented.
 *
 * A `[9]` with four passages is removed from the visible answer, because a reader
 * clicking a number that does not exist loses trust in the ones that do.
 */
export function stripInvalidCitations(text: string, available: number): string {
  return text.replace(/\[([\d,\s]+)\]/g, (whole, inner: string) => {
    const valid = inner
      .split(",")
      .map((part) => part.trim())
      .filter((part) => {
        const index = Number.parseInt(part, 10);
        return Number.isInteger(index) && index >= 1 && index <= available;
      });
    return valid.length === 0 ? "" : `[${valid.join(",")}]`;
  }).replace(/\s+([.,;:])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

/** Turns a scored record into the passage shape the prompt needs. */
function toPassage(chunk: KnowledgeChunk, index: number, live: boolean): SuppliedPassage {
  return {
    index,
    id: chunk.id,
    title: chunk.title,
    text: chunk.content,
    sourceUrl: chunk.sourceUrl,
    sourceTitle: chunk.sourceTitle,
    lastVerified: chunk.lastVerified,
    live,
  };
}

/**
 * Trims passages to a token budget.
 *
 * The route trims rather than the adapter truncating, because a silent truncation
 * at the provider is how a confident answer gets built from half a record. The
 * first passage is always kept, so a single very long record still reaches the
 * model.
 */
export function trimPassages(passages: readonly SuppliedPassage[], budgetTokens: number): SuppliedPassage[] {
  const kept: SuppliedPassage[] = [];
  let used = 0;
  for (const passage of passages) {
    const cost = estimateMessageTokens([{ role: "user", content: passage.text }]);
    if (kept.length > 0 && used + cost > budgetTokens) break;
    kept.push(passage);
    used += cost;
  }
  return kept;
}

/** The question as it is safe to pass: control characters removed, length capped. */
export function sanitiseQuestion(question: string): string {
  return question
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUESTION_CHARS);
}

/**
 * True when a question is worth a live read.
 *
 * Three conditions, all required: live fetching is allowed, the best lexical hit
 * is weak, and that hit's citation URL is on the compliance allow-list. A query
 * with no candidate at all gets no fetch, because there is nothing to tell us
 * which page to read, and guessing a URL is how a fetcher becomes a crawler.
 */
export function shouldAttemptLiveFetch(
  question: string,
  candidates: readonly ScoredChunk[],
  allow: boolean,
): ScoredChunk | null {
  if (!allow) return null;
  if (question.trim().length < 12) return null;
  const best = candidates[0];
  if (best === undefined) return null;
  if (best.score >= LIVE_FETCH_SCORE_CEILING) return null;
  if (permittedTarget(best.chunk.sourceUrl) === null) return null;
  return best;
}

/** Formats a citation line for the refusal copy, so a refusal still links out. */
export function formatSourcesHint(chunks: readonly KnowledgeChunk[]): string {
  return chunks
    .slice(0, 3)
    .map((chunk) => chunk.sourceTitle)
    .join("; ");
}

/**
 * The pipeline.
 *
 * Never throws for a runtime condition: every branch returns an {@link AskResult}.
 */
export async function askGuide(options: AskOptions, deps: AskDeps): Promise<AskResult> {
  const providerName = deps.provider.id;
  const modelName = deps.provider.model;
  const question = sanitiseQuestion(options.question);
  const edition: Edition = options.edition ?? "all";

  const refuse = (reason: Refusal["reason"], message: string): AskResult => ({
    answer: "",
    citations: [],
    lastVerified: null,
    refusal: { reason, message },
    model: modelName,
    provider: providerName,
    costPence: 0,
  });

  // 1. Deterministic pre-check.
  const check = preCheck(question);
  if (check.refuse) {
    return refuse(mapPreCheckReason(check.reason), check.message ?? REFUSAL_COPY.noSources);
  }

  // 2. Retrieve. pgvector is an improvement on the ranking, never a replacement
  // for it: a store that answers with nothing usable falls back to the lexical
  // retriever, which is deterministic and always available.
  const retrieveImpl = deps.retrieveImpl ?? retrieve;
  let scored: readonly ScoredChunk[] = [];

  if (deps.vectors !== undefined && deps.vectors !== null) {
    const vectorHits = await deps.vectors.retrieve(question, { edition, limit: DEFAULT_TOP_K });
    if (vectorHits !== null && vectorHits.length > 0) scored = vectorHits;
  }

  if (scored.length === 0) {
    scored = retrieveImpl(question, { edition, limit: DEFAULT_TOP_K });
  }

  /*
    The list that decides whether a live read is worth it is the *unfiltered* one, so a
    weak match is visible. A question the verified data answers only loosely is the case
    `docs/ai/terms` §6 says a fetch exists for, and a pipeline that fetched only when
    retrieval returned nothing would miss it entirely.
  */
  const candidates = retrieveImpl(question, { edition, limit: DEFAULT_TOP_K, minScore: 0 });

  const passages: SuppliedPassage[] = [];
  let livePassage: SuppliedPassage | null = null;

  // 3. Live transient read, allow-listed and bounded, only for a gap or a weak match.
  const allowLive = deps.allowLiveFetch ?? process.env.AI_LIVE_FETCH !== "off";
  const liveTarget = shouldAttemptLiveFetch(question, candidates, allowLive);

  if (liveTarget !== null) {
    const fetchExcerptImpl = deps.fetchImpl ?? fetchExcerpt;
    const outcome = await fetchExcerptImpl(liveTarget.chunk.sourceUrl);
    if (outcome.ok) {
      livePassage = {
        index: 1,
        id: `live:${liveTarget.chunk.id}`,
        title: outcome.excerpt.sourceTitle,
        text: outcome.excerpt.text,
        sourceUrl: outcome.excerpt.url,
        sourceTitle: outcome.excerpt.sourceTitle,
        // The retrieval timestamp is the honest verification date for a live read: the
        // edge cache can serve a page up to 24 hours stale, so this date says when it
        // was read, not when the page was last edited.
        lastVerified: outcome.excerpt.retrievedAt.slice(0, 10),
        live: true,
      };
    }
  }

  if (scored.length === 0 && livePassage === null) {
    return refuse("no-sources", REFUSAL_COPY.noSources);
  }

  if (livePassage !== null) {
    passages.push(livePassage);
  }
  for (const hit of scored) {
    passages.push(toPassage(hit.chunk, passages.length + 1, false));
  }

  const budget = Math.min(MAX_CONTEXT_TOKENS, Math.max(1200, deps.provider.maxInputTokens - DEFAULT_MAX_OUTPUT_TOKENS));
  const trimmed = trimPassages(passages, budget);

  // 4. Reserve before the call. A refusal here costs nothing.
  const messages = buildMessages(question, trimmed, edition);
  const estimatedInput = estimateMessageTokens(messages);
  const reservationPence = deps.provider.estimateCostPence(estimatedInput, DEFAULT_MAX_OUTPUT_TOKENS);

  const reservation = await deps.ledger.reserve(reservationPence);
  if (!reservation.ok) {
    if (reservation.code === "spend-cap") {
      return refuse("spend-cap", REFUSAL_COPY.spendCap);
    }
    // A ledger that cannot be reached must not silently become unlimited spend.
    return refuse("provider-unavailable", REFUSAL_COPY.providerUnavailable);
  }

  // 5. The call.
  const completion = await deps.provider.complete(
    {
      messages,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
      requestId: options.requestId,
    },
    options.signal,
  );

  if (!completion.ok) {
    // Hand the reservation back: nothing was generated, so nothing is owed.
    await deps.ledger.reconcile(reservation.reservedPence, 0);

    if (completion.code === "unconfigured") {
      return refuse("unconfigured", REFUSAL_COPY.unconfigured);
    }
    if (completion.code === "content-filtered") {
      return refuse("provider-unavailable", REFUSAL_COPY.providerUnavailable);
    }
    return refuse("provider-unavailable", REFUSAL_COPY.providerUnavailable);
  }

  await deps.ledger.reconcile(reservation.reservedPence, completion.usage.costPence);

  // 6. Validate before display.
  const validation = validateAnswer({ answer: completion.text, passages: trimmed, edition });
  if (!validation.ok) {
    return {
      ...refuse(
        validation.reason === "invented-price" || validation.reason === "wrong-currency"
          ? "not-published"
          : "provider-unavailable",
        validation.reason === "invented-price" || validation.reason === "wrong-currency"
          ? REFUSAL_COPY.notPublished
          : REFUSAL_COPY.providerUnavailable,
      ),
      costPence: completion.usage.costPence,
    };
  }

  // 7. Citations are ours, built from the passages we sent.
  const used = citedIndices(completion.text, trimmed.length);
  const chosen = used.length > 0 ? trimmed.filter((passage) => used.includes(passage.index)) : trimmed.slice(0, 3);

  const citations: Citation[] = chosen.map((passage) => ({
    index: passage.index,
    sourceUrl: passage.sourceUrl,
    sourceTitle: passage.sourceTitle,
    lastVerified: passage.lastVerified,
    live: passage.live,
  }));

  const answerText = stripInvalidCitations(completion.text, trimmed.length);

  return {
    answer: answerText,
    citations,
    lastVerified: oldestDate(citations.map((citation) => citation.lastVerified)),
    refusal: null,
    model: completion.model,
    provider: completion.provider,
    costPence: completion.usage.costPence,
  };
}

/**
 * Maps a pre-check reason onto the refusal vocabulary the route returns.
 *
 * A prompt injection is reported as `prompt-injection` rather than `out-of-scope`
 * because the distinction is useful in an operator log: a run of injection
 * attempts is an incident, while a run of out-of-scope questions is a gap in the
 * guide. The reader sees the same panel either way.
 */
function mapPreCheckReason(reason: PreCheckReason | undefined): RefusalReason {
  switch (reason) {
    case "prompt-injection":
      return "prompt-injection";
    default:
      return "out-of-scope";
  }
}

/**
 * The retrieval-only path used by `scripts/eval-ai.mjs --retrieval-only`.
 *
 * Returns the passages a question would ground an answer in, without a provider
 * call, so coverage can be measured offline at zero cost.
 */
export function retrievalCoverage(
  question: string,
  edition: Edition = "all",
  limit: number = DEFAULT_TOP_K,
): readonly ScoredChunk[] {
  return retrieve(question, { edition, limit }, getKnowledgeBase());
}

/** Re-exported so the route can show the edition date range in its copy. */
export { formatDateRange };
