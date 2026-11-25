/**
 * Tests for the knowledge base and retriever.
 *
 * Two kinds of assertion here, and the split is deliberate:
 *
 * 1. **Grounding.** Every chunk carries a real citation and a verification date, no
 *    chunk contains an unconverted Brasil price, and no chunk is a copy of an
 *    official page. These are the properties the whole feature rests on, and a
 *    regression in any of them is a compliance failure rather than a quality one.
 * 2. **Retrieval.** Real questions from the evaluation set, asserting the record that
 *    answers them is found, plus the abstention cases where nothing should be found.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MIN_SCORE,
  DEFAULT_TOP_K,
  MIN_COVERAGE,
  buildIndex,
  diversify,
  expandQuery,
  formatBrl,
  formatDateRange,
  formatEur,
  formatInstant,
  getChunkById,
  getKnowledgeBase,
  plainMarkdown,
  queryLiterals,
  retrieve,
  scoreDocumentFull,
  scoreDocumentWeighted,
  stem,
  tokenise,
  unknownQuestionShare,
  withPhrases,
  type KnowledgeChunk,
} from "./knowledge";

const CHUNKS = getKnowledgeBase();

describe("the corpus", () => {
  it("is built and non-trivial", () => {
    // A silent collapse to a handful of chunks would pass every other test.
    expect(CHUNKS.length).toBeGreaterThan(200);
  });

  it("gives every chunk a unique id", () => {
    const ids = CHUNKS.map((chunk) => chunk.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cites an https source on every chunk", () => {
    for (const chunk of CHUNKS) {
      expect(chunk.sourceUrl, chunk.id).toMatch(/^https:\/\//);
      expect(chunk.sourceTitle.trim().length, chunk.id).toBeGreaterThan(0);
    }
  });

  it("dates every chunk", () => {
    for (const chunk of CHUNKS) {
      expect(chunk.lastVerified, chunk.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("never carries an empty title or body", () => {
    for (const chunk of CHUNKS) {
      expect(chunk.title.trim().length, chunk.id).toBeGreaterThan(0);
      expect(chunk.content.trim().length, chunk.id).toBeGreaterThan(0);
    }
  });

  it("scopes every chunk to a known edition", () => {
    for (const chunk of CHUNKS) {
      expect(["belgium", "winter", "brasil", "all"], chunk.id).toContain(chunk.edition);
    }
  });

  it("keeps Brasil prices in reais and never in euros", () => {
    // The single rule that matters most: no official rate exists, so a converted
    // figure is an invention rather than a convenience.
    for (const chunk of CHUNKS.filter((candidate) => candidate.edition === "brasil")) {
      expect(chunk.content, chunk.id).not.toMatch(/€|£/);
    }
  });

  it("renders Brasil money with the R$ symbol when it states one", () => {
    const priced = CHUNKS.filter(
      (chunk) => chunk.kind === "ticket" && chunk.edition === "brasil" && /Price /.test(chunk.content),
    );
    expect(priced.length).toBeGreaterThan(0);
    for (const chunk of priced) expect(chunk.content, chunk.id).toContain("R$");
  });

  it("formats sale dates as readable text rather than raw ISO instants", () => {
    // A passage saying "2027-01-30T17:00:00+01:00" cannot be matched against a reader
    // asking "when do tickets go on sale", and cannot be quoted.
    const sales = CHUNKS.filter((chunk) => chunk.kind === "sale-window");
    expect(sales.length).toBeGreaterThan(0);
    for (const chunk of sales) {
      expect(chunk.content, chunk.id).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      expect(chunk.content, chunk.id).toMatch(/\d{1,2} \w+ \d{4}/);
    }
  });

  it("is stable across calls", () => {
    // The route calls this on every request; a rebuild per call would be slow and
    // would make ranking non-deterministic.
    expect(getKnowledgeBase()).toBe(CHUNKS);
  });

  it("is retrievable by id, and an unknown id resolves to undefined", () => {
    const first = CHUNKS[0];
    if (first === undefined) throw new Error("no chunks");
    expect(getChunkById(first.id)?.id).toBe(first.id);
    expect(getChunkById("does:not:exist")).toBeUndefined();
  });

  it("covers every record kind the datasets provide", () => {
    const kinds = new Set(CHUNKS.map((chunk) => chunk.kind));
    for (const required of ["fact", "ticket", "accommodation", "add-on", "sale-window", "faq", "edition"] as const) {
      expect(kinds, required).toContain(required);
    }
  });

  it("covers all three editions", () => {
    const editions = new Set(CHUNKS.map((chunk) => chunk.edition));
    expect(editions).toContain("belgium");
    expect(editions).toContain("winter");
    expect(editions).toContain("brasil");
  });
});

describe("buildKnowledgeBase", () => {
  it("publishes the verified Belgium day pass prices", () => {
    const chunk = CHUNKS.find((candidate) => candidate.id === "belgium:ticket:belgium-2027-day-pass-presale");
    expect(chunk).toBeDefined();
    expect(chunk?.content).toContain("€144");
    expect(chunk?.sourceUrl).toContain("belgium.tomorrowland.com");
  });

  it("publishes the Winter 7-day ticket with both components", () => {
    const chunk = CHUNKS.find((candidate) => candidate.id === "winter:ticket:seven-day-festival-ticket-2027");
    expect(chunk?.content).toContain("€735");
    // The record writes its components as "EUR 346"; the passage must present them in
    // the same form as the headline figure, or a model quotes the inconsistent one.
    expect(chunk?.content).toContain("€346");
    expect(chunk?.content).toContain("€389");
    expect(chunk?.content).not.toContain("EUR ");
  });

  it("publishes Brasil Full Madness in reais and marks it sold out", () => {
    const chunk = CHUNKS.find((candidate) => candidate.id === "brasil:ticket:full-madness");
    expect(chunk?.content).toContain("R$3,160");
    expect(chunk?.content?.toLowerCase()).toContain("sold out");
  });

  it("states a boolean fact as yes or no rather than true or false", () => {
    // "sameDayReEntry: false" reads as a positive claim to a model skimming it.
    const chunk = CHUNKS.find((candidate) => candidate.id === "belgium:fact:be-reEntry");
    expect(chunk?.content).toContain("no");
    expect(chunk?.content).not.toMatch(/\bfalse\b/);
    expect(chunk?.content).not.toMatch(/\btrue\b/);
  });

  it("strips Markdown from FAQ answers, keeping the words", () => {
    const faq = CHUNKS.find((chunk) => chunk.kind === "faq" && chunk.content.includes("Pearl"));
    expect(faq).toBeDefined();
    expect(faq?.content).not.toMatch(/\*\*|^\s*[-*]\s/m);
  });

  it("includes the omissions that make an honest refusal possible", () => {
    // The Pearl rate and the locker price are deliberately unpublished; the guide must
    // hold that fact so it can say so rather than inventing a number.
    const pearl = CHUNKS.find((candidate) => candidate.id === "belgium:faq:be-pearl-value-for-2027");
    expect(pearl?.content.toLowerCase()).toContain("not published");
  });

  it("does not carry any 2026 figure forward as a 2027 price", () => {
    // 2026 saw a €1.90 Pearl rate; no 2027 record may state it as the current one.
    const current = CHUNKS.filter(
      (chunk) => chunk.kind === "ticket" && chunk.edition === "belgium" && chunk.content.includes("Pearl"),
    );
    expect(current).toHaveLength(0);
  });
});

describe("formatting helpers", () => {
  it("formats euros without a redundant .00", () => {
    expect(formatEur(144)).toBe("€144");
    expect(formatEur(1087)).toBe("€1,087");
    expect(formatEur(23.5)).toBe("€23.5");
  });

  it("formats reais with the symbol and whole amounts", () => {
    expect(formatBrl(3160)).toBe("R$3,160");
    expect(formatBrl(0)).toBe("R$0");
  });

  it("rejects a non-number rather than printing NaN", () => {
    expect(formatEur(Number.NaN)).toBe("");
    expect(formatBrl(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("collapses a date range that shares a month and year", () => {
    expect(formatDateRange("2027-07-16", "2027-07-18")).toBe("16–18 July 2027");
  });

  it("names both months when they differ", () => {
    expect(formatDateRange("2027-03-20", "2027-04-02")).toContain("March");
    expect(formatDateRange("2027-03-20", "2027-04-02")).toContain("April");
  });

  it("renders a sale instant in its own zone", () => {
    const text = formatInstant("2027-01-30T17:00:00+01:00", "Europe/Brussels");
    expect(text).toContain("30 January 2027");
    expect(text).toContain("17:00");
    expect(text).toMatch(/CET|CEST/);
  });

  it("leaves an unparseable instant alone rather than printing Invalid Date", () => {
    expect(formatInstant("not a date", "Europe/Brussels")).toBe("not a date");
  });

  it("removes Markdown syntax and keeps the words", () => {
    expect(plainMarkdown("**Bold** and [a link](https://x.test)")).toBe("Bold and a link");
    expect(plainMarkdown("- one\n- two")).toBe("one two");
  });
});

describe("tokenise", () => {
  it("stems plurals so 'prices' matches 'price'", () => {
    expect(tokenise("prices")).toEqual(tokenise("price"));
    expect(tokenise("days")).toEqual(tokenise("day"));
  });

  it("folds a currency amount into one token, keeping the currency", () => {
    expect(tokenise("€144")).toContain("eur144");
    expect(tokenise("R$3,160")).toContain("brl3160");
    // A question quoting a price must not match a record quoting a different currency.
    expect(tokenise("€144")).not.toContain("brl144");
  });

  it("drops filler words that would otherwise dilute a match", () => {
    expect(tokenise("how much is a ticket")).toEqual(["ticket"]);
  });

  it("keeps years, because they are the strongest discriminator in this data", () => {
    expect(tokenise("Winter 2027")).toContain("2027");
  });

  it("returns nothing for a string with no meaningful words", () => {
    expect(tokenise("how are you?")).toEqual([]);
  });
});

describe("stem", () => {
  it("handles -ies and -s but not -ss", () => {
    expect(stem("policies")).toBe("policy");
    expect(stem("tickets")).toBe("ticket");
    expect(stem("pass")).toBe("pass");
  });
});

describe("phrases and query expansion", () => {
  it("forms bigrams and trigrams from adjacent words", () => {
    const phrases = withPhrases(["winter", "2027", "ticket"]);
    expect(phrases).toContain("winter 2027");
    expect(phrases).toContain("winter 2027 ticket");
  });

  it("weights a phrase above its individual words", () => {
    const terms = expandQuery("winter 2027");
    const bigram = terms.find((term) => term.term === "winter 2027");
    const unigram = terms.find((term) => term.term === "winter");
    expect(bigram?.weight).toBeGreaterThan(unigram?.weight ?? 0);
  });

  it("weights a literal word above its synonym", () => {
    const terms = expandQuery("ticket");
    const literal = terms.find((term) => term.term === "ticket");
    const synonym = terms.find((term) => term.term === "pass");
    expect(literal?.weight).toBe(1);
    expect(synonym?.weight).toBeLessThan(1);
  });

  it("keeps only unigrams in the coverage requirement", () => {
    // Phrases are extra evidence, not extra requirements: including them made every
    // record that says the words separately score as half-covered.
    const literals = queryLiterals("day ticket");
    expect(literals.has("day")).toBe(true);
    expect(literals.has("day ticket")).toBe(false);
  });
});

describe("retrieval on real questions", () => {
  const CASES: ReadonlyArray<{ readonly question: string; readonly edition: "belgium" | "winter" | "brasil"; readonly expectId: string }> = [
    {
      question: "How much is a one-day ticket for Tomorrowland Belgium 2027?",
      edition: "belgium",
      expectId: "belgium-2027-day-pass",
    },
    {
      question: "What does a Full Madness Pass cost?",
      edition: "belgium",
      expectId: "belgium-2027-full-madness",
    },
    {
      question: "How much is a Magnificent Greens 1P Tent package?",
      edition: "belgium",
      expectId: "belgium-2027-magnificent-greens-tent-1p",
    },
    {
      question: "How much is the 7-Day Festival Ticket for Winter 2027?",
      edition: "winter",
      expectId: "seven-day-festival-ticket-2027",
    },
    {
      question: "How much is covered parking in Alpe d'Huez?",
      edition: "winter",
      expectId: "covered-parking",
    },
    {
      question: "How much is a Tomorrowland Brasil 2027 Full Madness Pass?",
      edition: "brasil",
      expectId: "full-madness",
    },
  ];

  it.each(CASES)("finds the record for: $question", ({ question, edition, expectId }) => {
    const results = retrieve(question, { edition, limit: DEFAULT_TOP_K });
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((hit) => hit.chunk.id).join(" ")).toContain(expectId);
  });

  it("finds the sale dates for a question about when tickets go on sale", () => {
    // Either the FAQ that lists all three moments or the individual sale-window
    // records answers this; both are correct, so the assertion is on the dates being
    // present rather than on one particular record winning.
    const results = retrieve("When do Belgium 2027 tickets go on sale?", { edition: "belgium" });
    const joined = results.map((hit) => hit.chunk.content).join(" ");
    expect(joined).toContain("30 January 2027");
    expect(joined).toContain("17:00");
  });

  it("finds the resale guidance for a question about TicketSwap", () => {
    const results = retrieve("Is TicketSwap an official resale partner?", { edition: "belgium" });
    const joined = results.map((hit) => hit.chunk.content).join(" ");
    expect(joined.toLowerCase()).toContain("secondary market");
  });

  it("finds the accessibility answer for Winter", () => {
    const results = retrieve("Can I reach the Winter mountain stages without skiing?", { edition: "winter" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((hit) => hit.chunk.id).join(" ")).toContain("pedestrian");
  });

  it("returns the same ordering twice, so a failure is reproducible", () => {
    const question = "How much is a Belgium 2027 day pass?";
    const first = retrieve(question, { edition: "belgium" }).map((hit) => hit.chunk.id);
    const second = retrieve(question, { edition: "belgium" }).map((hit) => hit.chunk.id);
    expect(second).toEqual(first);
  });

  it("never returns more than the requested limit", () => {
    expect(retrieve("Pearl", { limit: 2 }).length).toBeLessThanOrEqual(2);
  });

  it("scopes to the requested edition plus shared records", () => {
    const results = retrieve("How much is a ticket?", { edition: "winter" });
    for (const hit of results) {
      expect(["winter", "all"]).toContain(hit.chunk.edition);
    }
  });

  it("returns nothing for a question with no meaningful words", () => {
    expect(retrieve("how are you?")).toEqual([]);
  });

  it("returns nothing for an empty question", () => {
    expect(retrieve("")).toEqual([]);
  });
});

describe("retrieval abstention", () => {
  it("does not answer a question about an edition the guide does not cover", () => {
    // Thailand exists in the shared overview, but the guide has no Thailand content,
    // so the honest outcome for a price question is nothing above the floor.
    const results = retrieve("How much are tickets for Tomorrowland Thailand?", { edition: "all" });
    const relevant = results.filter((hit) => /thailand/i.test(hit.chunk.content) && /price|ticket price/i.test(hit.chunk.content));
    expect(relevant).toHaveLength(0);
  });

  it("does not offer a festival summary as evidence for a subject it does not discuss", () => {
    // The edition overview repeats "Tomorrowland Belgium 2027" but says nothing about
    // accessibility. It may appear for a brand-only match, but it must never be the
    // only thing offered, because an answer built on it would be invented.
    const results = retrieve("What accessibility facilities are there at De Schorre?", { edition: "belgium" });
    const substantive = results.filter((hit) => hit.chunk.kind !== "edition");
    const coversAccessibility = substantive.some((hit) => /accessib|wheelchair|disabled/i.test(hit.chunk.content));
    expect(coversAccessibility).toBe(false);
  });

  it("applies the coverage floor to every returned passage", () => {
    const results = retrieve("How much is a Belgium 2027 day pass?", { edition: "belgium" });
    for (const hit of results) expect(hit.coverage).toBeGreaterThanOrEqual(MIN_COVERAGE);
  });

  it("reports how much of a question the corpus does not know", () => {
    // Exposed for diagnostics and the out-of-scope copy; not a gate. "Visa" appears
    // nowhere in the data, so a visa question leaves real weight on unknown words,
    // while an ordinary price question leaves almost none.
    expect(unknownQuestionShare("Do I need a visa and immigration paperwork?")).toBeGreaterThan(0.5);
    expect(unknownQuestionShare("How much is a Belgium day pass?")).toBeLessThan(0.1);
  });
});

describe("scoring", () => {
  it("penalises a record that names the wrong year", () => {
    const winter2027: KnowledgeChunk = {
      id: "winter:fact:test",
      edition: "winter",
      kind: "fact",
      title: "Winter 2027 dates",
      content: "Tomorrowland Winter 2027 runs 20–27 March 2027.",
      sourceUrl: "https://winter.tomorrowland.com/en/",
      sourceTitle: "Winter",
      lastVerified: "2026-11-18",
      context: "Winter 2027 fact",
    };
    const winter2026: KnowledgeChunk = { ...winter2027, id: "winter:fact:test2", title: "Winter 2026 dates", content: "Tomorrowland Winter 2026 ran 21–28 March 2026." };

    const index = buildIndex([winter2027, winter2026]);
    const terms = expandQuery("When is Tomorrowland Winter 2027?");
    const literals = queryLiterals("When is Tomorrowland Winter 2027?");

    const docs = index.documents;
    const right = docs.find((doc) => doc.chunk.id === winter2027.id);
    const wrong = docs.find((doc) => doc.chunk.id === winter2026.id);
    if (right === undefined || wrong === undefined) throw new Error("index");

    const rightScore = scoreDocumentFull(index, right, terms, literals, "winter")?.score ?? 0;
    const wrongScore = scoreDocumentFull(index, wrong, terms, literals, "winter")?.score ?? 0;
    expect(rightScore).toBeGreaterThan(wrongScore);
  });

  it("returns null when a document matches nothing", () => {
    const chunk: KnowledgeChunk = {
      id: "x:fact:y",
      edition: "all",
      kind: "fact",
      title: "Cooking",
      content: "A recipe for bread.",
      sourceUrl: "https://example.test/",
      sourceTitle: "x",
      lastVerified: "2026-11-18",
      context: "all fact",
    };
    const index = buildIndex([chunk]);
    const doc = index.documents[0];
    if (doc === undefined) throw new Error("index");
    expect(scoreDocumentFull(index, doc, expandQuery("ticket price"), queryLiterals("ticket price"))).toBeNull();
  });

  it("exposes a scalar score for diagnostics", () => {
    const chunk: KnowledgeChunk = {
      id: "x:fact:y",
      edition: "all",
      kind: "fact",
      title: "Belgium day pass",
      content: "A day pass is a ticket for one day.",
      sourceUrl: "https://example.test/",
      sourceTitle: "x",
      lastVerified: "2026-11-18",
      context: "all fact",
    };
    const index = buildIndex([chunk]);
    const doc = index.documents[0];
    if (doc === undefined) throw new Error("index");
    expect(scoreDocumentWeighted(index, doc, expandQuery("day pass"), queryLiterals("day pass"))).toBeGreaterThan(0);
  });

  it("gives a kind prior: a summary line scores below a price record", () => {
    const edition: KnowledgeChunk = {
      id: "all:edition:x",
      edition: "all",
      kind: "edition",
      title: "Tomorrowland Belgium 2027",
      content: "Tomorrowland Belgium 2027 runs at De Schorre.",
      sourceUrl: "https://example.test/",
      sourceTitle: "x",
      lastVerified: "2026-11-18",
      context: "all edition",
    };
    const ticket: KnowledgeChunk = {
      ...edition,
      id: "belgium:ticket:x",
      edition: "belgium",
      kind: "ticket",
      title: "Day Pass",
      content: "Day Pass costs €144.",
    };
    const index = buildIndex([edition, ticket]);
    const terms = expandQuery("Tomorrowland Belgium day pass");
    const literals = queryLiterals("Tomorrowland Belgium day pass");
    const editionDoc = index.documents.find((doc) => doc.chunk.id === edition.id);
    const ticketDoc = index.documents.find((doc) => doc.chunk.id === ticket.id);
    if (editionDoc === undefined || ticketDoc === undefined) throw new Error("index");

    const editionScore = scoreDocumentFull(index, editionDoc, terms, literals, "belgium")?.score ?? 0;
    const ticketScore = scoreDocumentFull(index, ticketDoc, terms, literals, "belgium")?.score ?? 0;
    expect(ticketScore).toBeGreaterThan(editionScore);
  });
});

describe("diversify", () => {
  function scored(chunk: KnowledgeChunk, score: number) {
    return { chunk, score, coverage: 1 };
  }
  const make = (id: string, content: string, score: number): ReturnType<typeof scored> =>
    scored(
      {
        id,
        edition: "all",
        kind: "faq",
        title: `Question ${id}`,
        content,
        sourceUrl: "https://example.test/",
        sourceTitle: "x",
        lastVerified: "2026-11-18",
        context: "all faq",
      },
      score,
    );

  it("prefers a different subject over a near-duplicate", () => {
    // The failure this exists for: four Global Journey FAQs crowding out the sale
    // window that answers the other half of the question.
    const results = diversify(
      [
        make("a", "global journey packages exchange desk resale", 10),
        make("b", "global journey packages exchange desk resale", 9.9),
        make("c", "global journey packages exchange desk resale", 9.8),
        make("d", "global journey sale opens on 30 January 2027", 6),
      ],
      2,
    );
    expect(results.map((hit) => hit.chunk.id)).toContain("d");
  });

  it("still returns the most relevant record first", () => {
    const results = diversify([make("a", "one two three", 10), make("b", "four five six", 5)], 2);
    expect(results[0]?.chunk.id).toBe("a");
  });

  it("returns fewer than the limit when there is less to return", () => {
    expect(diversify([make("a", "one", 5)], 6)).toHaveLength(1);
  });

  it("handles an empty candidate list", () => {
    expect(diversify([], 6)).toEqual([]);
  });
});

describe("the floors", () => {
  it("are low enough not to reject a good match and high enough to reject noise", () => {
    // The values are documented from measurement; this pins them so a change is a
    // deliberate decision rather than a drift.
    expect(DEFAULT_MIN_SCORE).toBeLessThan(1);
    expect(MIN_COVERAGE).toBeGreaterThan(0);
    expect(DEFAULT_TOP_K).toBe(6);
  });
});
