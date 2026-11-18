import type { RankedEntry, SearchEntry, SearchOptions } from "./types";
import { queryTokens, snippet, tokenise, withinOneEdit } from "./text";

/** Default number of results returned by {@link search}. */
export const DEFAULT_LIMIT = 12;

/** Upper bound on `limit`, so a caller cannot ask for the whole index. */
export const MAX_LIMIT = 50;

/** Shortest term that qualifies for single-edit typo tolerance. */
export const TYPO_MIN_LENGTH = 5;

/**
 * Per-token weights.
 *
 * The tiers are built so that a title match always outranks a snippet-only
 * match for the same query, at any token count, even with the edition boost and
 * a kind-label match applied:
 *
 *   weakest title (typo) 60            per token
 *   strongest snippet-only            20 per token + 35 once
 *                                     (phrase 5 + active edition 18 + kind 12)
 *
 *   n = 1: 60 > 55     n = 2: 120 > 75     n >= 3: 60n > 20n + 35
 *
 * The gap widens with every token, because the title weight is paid per token
 * while the phrase, edition and kind bonuses are paid once per entry.
 * `rank.test.ts` recomputes this inequality from {@link WEIGHTS} rather than
 * trusting the comment, so changing a weight cannot quietly break the ordering.
 */
const W = {
  titleToken: 100,
  titlePrefix: 85,
  titleSubstring: 70,
  titleTypo: 60,
  snippetToken: 20,
  snippetPrefix: 15,
  snippetSubstring: 10,
  snippetTypo: 6,
  /** Matched the kind label ("Ticket", "FAQ") rather than the content. */
  kindToken: 12,
  titlePhrase: 40,
  snippetPhrase: 5,
  editionActive: 18,
  editionGlobal: 4,
  /** Rewards tight titles; added only to entries that matched in the title. */
  titleBrevityMax: 8,
} as const;

/**
 * The weight table, exported so the invariant test can verify the ordering
 * guarantee against the numbers actually in use rather than against a copy of
 * them. Nothing else should read this: it is an implementation detail.
 */
export const WEIGHTS = W;

interface PreparedEntry {
  entry: SearchEntry;
  titleTokens: string[];
  snippetTokens: string[];
  kindTokens: string[];
  titlePhrase: string;
  snippetPhrase: string;
  order: number;
}

const preparedCache = new WeakMap<readonly SearchEntry[], PreparedEntry[]>();

function prepare(index: readonly SearchEntry[]): PreparedEntry[] {
  const cached = preparedCache.get(index);
  if (cached) return cached;

  const prepared = index.map((entry, order) => {
    const titleTokens = tokenise(entry.title);
    const snippetTokens = tokenise(entry.snippet);
    return {
      entry,
      titleTokens,
      snippetTokens,
      kindTokens: tokenise(entry.kindLabel),
      titlePhrase: ` ${titleTokens.join(" ")} `,
      snippetPhrase: ` ${snippetTokens.join(" ")} `,
      order,
    };
  });

  preparedCache.set(index, prepared);
  return prepared;
}

interface TokenScore {
  score: number;
  titleHit: boolean;
  matched: boolean;
}

function scoreInTokens(
  token: string,
  words: readonly string[],
  weights: { token: number; prefix: number; substring: number; typo: number },
  allowSubstring: boolean,
): number {
  if (words.includes(token)) return weights.token;
  if (words.some((word) => word.startsWith(token))) return weights.prefix;
  if (allowSubstring && token.length >= 3 && words.some((word) => word.includes(token))) {
    return weights.substring;
  }
  if (token.length >= TYPO_MIN_LENGTH && words.some((word) => withinOneEdit(token, word))) {
    return weights.typo;
  }
  return 0;
}

/**
 * Score one query token against one entry. Only the strongest match in each
 * field counts, so a word repeated in a snippet cannot inflate its score.
 */
function scoreToken(token: string, item: PreparedEntry): TokenScore {
  const titleScore = scoreInTokens(
    token,
    item.titleTokens,
    {
      token: W.titleToken,
      prefix: W.titlePrefix,
      substring: W.titleSubstring,
      typo: W.titleTypo,
    },
    true,
  );

  const snippetScore = scoreInTokens(
    token,
    item.snippetTokens,
    {
      token: W.snippetToken,
      prefix: W.snippetPrefix,
      substring: W.snippetSubstring,
      typo: W.snippetTypo,
    },
    true,
  );

  const kindScore =
    item.kindTokens.includes(token) || item.kindTokens.some((word) => word.startsWith(token))
      ? W.kindToken
      : 0;

  const score = titleScore + snippetScore + kindScore;
  return { score, titleHit: titleScore > 0, matched: score > 0 };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

/**
 * Rank entries against a query.
 *
 * Matching is conjunctive: every content token in the query must match
 * somewhere in the entry (title, snippet or kind label), otherwise the entry is
 * dropped. That stops "winter lockers" returning every locker entry in every
 * edition, and it means an extra word can only ever narrow the result set.
 *
 * Ordering is deterministic — score descending, then original index order — so
 * equal-scoring entries never shuffle between keystrokes.
 */
export function search(query: string, options: SearchOptions): RankedEntry[] {
  const limit = clampLimit(options.limit);
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];

  const index = options.index;
  const prepared = prepare(index);
  const activeEdition = options.edition ?? null;
  const phrase = tokens.join(" ");

  const scored: { entry: SearchEntry; score: number; order: number }[] = [];

  for (const item of prepared) {
    let total = 0;
    let titleHit = false;
    let allMatched = true;

    for (const token of tokens) {
      const result = scoreToken(token, item);
      if (!result.matched) {
        allMatched = false;
        break;
      }
      total += result.score;
      titleHit = titleHit || result.titleHit;
    }

    if (!allMatched) continue;

    if (item.titlePhrase.includes(` ${phrase} `)) total += W.titlePhrase;
    if (item.snippetPhrase.includes(` ${phrase} `)) total += W.snippetPhrase;

    if (activeEdition) {
      if (item.entry.edition === activeEdition) total += W.editionActive;
      else if (item.entry.edition === "all") total += W.editionGlobal;
    }

    if (titleHit) {
      total += Math.round((W.titleBrevityMax * 10) / (10 + item.titleTokens.length));
    }

    scored.push({ entry: item.entry, score: total, order: item.order });
  }

  scored.sort((a, b) => b.score - a.score || a.order - b.order);

  return scored
    .slice(0, limit)
    .map(({ entry, score }) => ({ ...entry, score, snippet: snippet(entry.snippet) }));
}
