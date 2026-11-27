/**
 * Courtesy replies for "Ask the guide".
 *
 * "Thank you" and "Hi" are not questions. Sending them through retrieval and a
 * model spends money to say the guide has no information, which is the wrong
 * answer. This module recognises a message that is *only* a courtesy and
 * returns a fixed reply. Anything else, including a thank-you that continues
 * into a question, returns null so the normal pipeline runs.
 *
 * The match is exact on purpose. A prefix match would swallow
 * "thank you, what is a Full Madness pass?".
 *
 * No model call, no spend, and nothing here is stored.
 */

/** Model name reported for a reply this module wrote. It is not a provider. */
export const COURTESY_MODEL = "tmlguide-courtesy";

/**
 * Topics that mean the reader is asking about the festival, even when the
 * message also says thanks. Singular and plural both count: "the Pearl rate"
 * is a question about Pearls.
 */
const FACTUAL_TOPIC =
  /\b(?:tickets?|prices?|dream[\s-]*ville|pearls?|belgium|winter|brasil)\b/u;

/** A price symbol is a factual ask even without the word "price" or a digit. */
const PRICE_MARK = /[£€$]/u;

/**
 * Trailing decoration only. Digits are deliberately absent: "thanks 2" must
 * not collapse to "thanks", and keycap emoji are caught earlier by the number
 * check because they contain a digit.
 */
const TRAILING_NOISE =
  /(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F|\u200D|\u20E3|[\s.!?,;:…'"“”‘’`´\-–—~*_()[\]{}<>/\\|@#%^&+=])+$/u;

const INVITE = "Ask about tickets, DreamVille, Winter or Brasil whenever you like.";

type CourtesyKind =
  | "thanks"
  | "cheers"
  | "hello"
  | "morning"
  | "afternoon"
  | "evening"
  | "goodbye"
  | "night"
  | "welcome";

const REPLIES = {
  thanks: `You're welcome. ${INVITE}`,
  cheers: `Cheers. ${INVITE}`,
  hello: `Hello. ${INVITE}`,
  morning: `Good morning. ${INVITE}`,
  afternoon: `Good afternoon. ${INVITE}`,
  evening: `Good evening. ${INVITE}`,
  goodbye: `Goodbye. ${INVITE}`,
  night: `Good night. ${INVITE}`,
  welcome: `Glad that helped. ${INVITE}`,
} as const satisfies Record<CourtesyKind, string>;

/**
 * Closed list. A Map, not a plain object, so a message of "toString" or
 * "constructor" cannot resolve through the prototype.
 *
 * Apostrophes are removed before lookup, so "you're welcome" is stored as
 * "youre welcome".
 */
const PHRASES = new Map<string, CourtesyKind>([
  ["thanks", "thanks"],
  ["thank you", "thanks"],
  ["thankyou", "thanks"],
  ["thank you so much", "thanks"],
  ["thanks so much", "thanks"],
  ["thank you very much", "thanks"],
  ["thanks very much", "thanks"],
  ["thanks a lot", "thanks"],
  ["thank you a lot", "thanks"],
  ["many thanks", "thanks"],
  ["ok thanks", "thanks"],
  ["okay thanks", "thanks"],
  ["ok thank you", "thanks"],
  ["okay thank you", "thanks"],
  ["ta", "thanks"],
  ["cheers", "cheers"],
  ["hello", "hello"],
  ["hi", "hello"],
  ["hey", "hello"],
  ["hiya", "hello"],
  ["good morning", "morning"],
  ["good afternoon", "afternoon"],
  ["good evening", "evening"],
  ["goodbye", "goodbye"],
  ["bye", "goodbye"],
  ["bye bye", "goodbye"],
  ["good night", "night"],
  ["goodnight", "night"],
  ["youre welcome", "welcome"],
  ["you are welcome", "welcome"],
]);

/**
 * A short reply when `question` is only a courtesy, or null when the normal
 * pipeline should answer it.
 */
export function courtesyReply(question: string): { readonly reply: string } | null {
  if (typeof question !== "string") return null;

  const folded = question.normalize("NFKC").replace(/\p{Cf}/gu, "").trim().toLocaleLowerCase("en-GB");
  if (folded === "") return null;

  // Before any stripping. A trailing digit or a price must not disappear into
  // a thank-you, and "thanks 2!" must not become "thanks".
  if (/\p{Nd}/u.test(folded) || PRICE_MARK.test(folded) || FACTUAL_TOPIC.test(folded)) {
    return null;
  }

  const key = folded
    .replace(TRAILING_NOISE, "")
    .replace(/['’‘`´ʼ]/g, "")
    .replace(/[\u2010-\u2015\u2212-]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (key === "") return null;
  // Hyphens and commas are folded into spaces above, so check the topic list
  // again: "dream-ville" has already failed the first test, and this catches a
  // form that only becomes a topic word after folding.
  if (/\p{Nd}/u.test(key) || PRICE_MARK.test(key) || FACTUAL_TOPIC.test(key)) return null;

  const kind = PHRASES.get(key);
  if (kind === undefined) return null;
  return { reply: REPLIES[kind] };
}
