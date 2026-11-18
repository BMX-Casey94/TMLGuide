/**
 * Text normalisation and matching for the search palette.
 *
 * Everything is synchronous and allocation-cheap: the index is a few hundred
 * entries, so it is scanned on every keystroke rather than being pre-split into
 * an inverted index that would have to be kept in step with the data.
 */

/** Hard limit on the length of a title or result snippet, in characters. */
export const SNIPPET_MAX = 160;

/** Longest query we will store in recent searches. */
export const QUERY_MAX = 80;

/**
 * Words that carry no discriminating power in a festival guide. Dropped from
 * queries so a natural question ("is there a locker") does not require every
 * filler word to appear in the matched entry.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "not",
  "of",
  "off",
  "on",
  "or",
  "our",
  "ours",
  "out",
  "per",
  "should",
  "so",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "via",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "without",
  "would",
  "you",
  "your",
  "yours",
]);

const COMBINING_MARKS = /[\u0300-\u036f]/g;

const WORD_CHARACTER = /[a-z0-9]/;

/**
 * Lowercase, strip diacritics, fold punctuation to spaces.
 *
 * "Alpe d'Huez" and "alpe dhuez" both become "alpe d huez"; "São Paulo" becomes
 * "sao paulo"; "Food & Drinks" becomes "food and drinks". The currency symbols
 * fold to nothing, so a pasted "€144" still matches the token "144".
 */
export function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Folded words. Punctuation and emoji never survive. */
export function tokenise(value: string): string[] {
  const folded = fold(value);
  return folded ? folded.split(" ").filter(Boolean) : [];
}

/**
 * Tokens actually used for matching.
 *
 * Filler words and single letters are dropped when at least one content word
 * remains, so "is there a locker" searches for "locker" rather than failing on
 * "is". A query made entirely of filler keeps its filler words, because
 * returning nothing for "the" would look like a broken search.
 */
export function queryTokens(query: string): string[] {
  const tokens = tokenise(query);
  if (tokens.length === 0) return [];
  const content = tokens.filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  if (content.length > 0) return content;
  const meaningful = tokens.filter((token) => !STOPWORDS.has(token));
  return meaningful.length > 0 ? meaningful : tokens;
}

/**
 * True when `a` and `b` are at most one edit apart, where an adjacent
 * transposition counts as a single edit.
 */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  if (a.length === b.length) {
    const differing: number[] = [];
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        differing.push(i);
        if (differing.length > 2) return false;
      }
    }
    if (differing.length <= 1) return true;
    const [first, second] = differing;
    // Exactly two mismatches, adjacent, and swapped: one transposition.
    return second === first + 1 && a[first] === b[second] && a[second] === b[first];
  }

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    j += 1;
  }
  return true;
}

/** Collapse newlines and runs of whitespace into single spaces. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Build a snippet of at most `max` characters, cut on a word boundary and
 * marked with an ellipsis when shortened.
 */
export function snippet(value: string, max: number = SNIPPET_MAX): string {
  const text = collapseWhitespace(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const clipped = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(
    /[,;:.\-\u2013\u2014]$/,
    "",
  );
  return `${clipped}\u2026`;
}

/** One run of text plus whether it matched the query. */
export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Split `text` into alternating plain and matched runs, for highlighting.
 *
 * Returns data rather than markup: the caller renders each run as a text node,
 * so a title containing angle brackets can never become HTML.
 *
 * Matching uses the ranker's rule — whole token, or a token that prefixes a
 * word — so a highlighted word is always one that contributed to the score.
 * Folding is done character by character with an index map, because folding a
 * whole string can change its length (a ligature, an ellipsis) and then the
 * offsets no longer line up with the text being displayed.
 */
export function highlightSegments(text: string, tokens: readonly string[]): HighlightSegment[] {
  if (tokens.length === 0 || text.length === 0) return [{ text, match: false }];

  // foldedChars[i] belongs to text[origin[i]], so a run of folded characters
  // maps back to the exact original span it came from. A character that folds
  // to nothing (a space, a currency symbol) becomes a space instead of
  // disappearing, so word boundaries survive: without that, "São Paulo" would
  // fold to "saopaulo" and the two words could never be matched separately.
  const foldedChars: string[] = [];
  const origin: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const foldedChar = fold(text[index]);
    const emitted = foldedChar === "" ? " " : foldedChar;
    for (const char of emitted) {
      foldedChars.push(char);
      origin.push(index);
    }
  }
  const folded = foldedChars.join("");
  const marked = new Array<boolean>(text.length).fill(false);

  // Word spans in the folded text, so "start of a word" is unambiguous.
  const words: { start: number; end: number }[] = [];
  let cursor = 0;
  while (cursor < folded.length) {
    if (!WORD_CHARACTER.test(folded[cursor])) {
      cursor += 1;
      continue;
    }
    const start = cursor;
    while (cursor < folded.length && WORD_CHARACTER.test(folded[cursor])) cursor += 1;
    words.push({ start, end: cursor });
  }

  for (const token of tokens) {
    if (token.length === 0) continue;
    for (const word of words) {
      const slice = folded.slice(word.start, word.end);
      if (slice !== token && !slice.startsWith(token)) continue;
      const from = origin[word.start];
      const to = origin[word.end - 1] + 1;
      for (let index = from; index < to; index += 1) marked[index] = true;
    }
  }

  const segments: HighlightSegment[] = [];
  let start = 0;
  for (let index = 1; index <= text.length; index += 1) {
    if (index === text.length || marked[index] !== marked[start]) {
      segments.push({ text: text.slice(start, index), match: marked[start] });
      start = index;
    }
  }
  return segments.filter((segment) => segment.text.length > 0);
}
