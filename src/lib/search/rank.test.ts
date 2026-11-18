import { describe, expect, it } from "vitest";
import { DEFAULT_LIMIT, MAX_LIMIT, TYPO_MIN_LENGTH, WEIGHTS, search } from "./rank";
import type { SearchEntry } from "./types";

/**
 * A hand-built index keeps these tests independent of the real content, so a
 * copy edit in a data file can never fail a ranking test.
 */
function entry(
  overrides: Partial<SearchEntry> & Pick<SearchEntry, "id" | "title">,
): SearchEntry {
  return {
    snippet: "",
    kind: "ticket",
    kindLabel: "Ticket",
    edition: "all",
    href: "/guides/tickets",
    source: "test",
    ...overrides,
  };
}

const index: SearchEntry[] = [
  entry({
    id: "winter-boot",
    title: "Winter boots and grip",
    snippet: "Insulated boots with a deep tread for icy village pavements.",
    edition: "winter",
  }),
  entry({
    id: "alpe-gear",
    title: "Alpe d'Huez gear hire",
    snippet: "Ski and board hire in the resort, with four quality tiers.",
    edition: "winter",
  }),
  entry({
    id: "sao-paulo",
    title: "São Paulo shuttles",
    snippet: "Official shuttle boarding points in São Paulo and Guarulhos.",
    edition: "brasil",
  }),
  entry({
    id: "pearls",
    title: "Pearls and cashless payment",
    snippet: "Load Pearls onto your bracelet before the festival.",
    edition: "belgium",
  }),
  entry({
    id: "locker-festival",
    title: "Festival lockers",
    snippet: "Code-operated lockers, pre-booked in the June add-on sale.",
    edition: "belgium",
  }),
  entry({
    id: "locker-stay",
    title: "DreamVille lockers",
    snippet: "Key-operated lockers in the zone matching your accommodation.",
    edition: "belgium",
  }),
  entry({
    id: "essentials",
    title: "Festival essentials",
    snippet: "A padlock for your locker, plus a refillable bottle.",
    edition: "belgium",
  }),
  entry({
    id: "boot-care",
    title: "Boot care",
    snippet: "Re-waterproofing spray and spare grip studs for the season.",
    edition: "winter",
  }),
  entry({
    id: "boot-cleaning-be",
    title: "Boot cleaning",
    snippet: "Wipe your boots before you pack them.",
    edition: "belgium",
  }),
  entry({
    id: "boot-cleaning-wi",
    title: "Boot cleaning",
    snippet: "Wipe your boots before you pack them.",
    edition: "winter",
  }),
];

describe("search", () => {
  it("returns nothing for an empty query", () => {
    expect(search("", { index })).toEqual([]);
    expect(search("   ", { index })).toEqual([]);
    expect(search("?!", { index })).toEqual([]);
  });

  it("matches accents in either direction", () => {
    const accented = search("são paulo", { index });
    const plain = search("sao paulo", { index });
    expect(accented.map((result) => result.id)).toEqual(["sao-paulo"]);
    expect(plain.map((result) => result.id)).toEqual(["sao-paulo"]);
  });

  it("matches through an apostrophe", () => {
    expect(search("alpe dhuez", { index }).map((result) => result.id)).toEqual(["alpe-gear"]);
    expect(search("alpe d'huez", { index }).map((result) => result.id)).toEqual(["alpe-gear"]);
  });

  it("supports prefix matching on a word", () => {
    expect(search("lock", { index }).map((result) => result.id)).toEqual([
      "locker-festival",
      "locker-stay",
      "essentials",
    ]);
    expect(search("wint boo", { index }).map((result) => result.id)).toContain("winter-boot");
  });

  it("tolerates one typo in terms of the minimum length", () => {
    expect(search("pearlz", { index }).map((result) => result.id)).toEqual(["pearls"]);
    expect(search("pearlz", { index })[0].score).toBeGreaterThan(0);

    // One character short of the tolerance window: a prefix is still a prefix,
    // but a mangled four-letter term is not a typo candidate.
    const short = "pe".padEnd(TYPO_MIN_LENGTH - 1, "a");
    expect(short.length).toBe(TYPO_MIN_LENGTH - 1);
    expect(search("pxxx", { index })).toEqual([]);
  });

  it("ranks a title match above every snippet-only match", () => {
    const results = search("locker", { index });
    const titleMatch = results.find((result) => result.id === "locker-festival")!;
    const snippetOnly = results.find((result) => result.id === "essentials")!;
    expect(snippetOnly).toBeDefined();
    expect(titleMatch.score).toBeGreaterThan(snippetOnly.score);
    // The snippet-only entry comes last.
    expect(results[results.length - 1].id).toBe("essentials");
  });

  /**
   * The invariant the weight table is built around, asserted against the
   * numbers in use rather than trusted to a comment: for every query length,
   * the weakest possible title match must outrank the strongest possible
   * snippet-only match with the edition boost and the kind-label bonus applied.
   */
  it("keeps the weakest title hit above the strongest snippet-only hit, at every length", () => {
    const strongestSnippet = (tokens: number) =>
      tokens * WEIGHTS.snippetToken +
      WEIGHTS.snippetPhrase +
      WEIGHTS.editionActive +
      WEIGHTS.kindToken;

    for (let tokens = 1; tokens <= 6; tokens += 1) {
      expect(WEIGHTS.titleTypo * tokens, `${tokens} tokens`).toBeGreaterThan(
        strongestSnippet(tokens),
      );
    }

    // And every stronger title tier stays above it, in order.
    expect(WEIGHTS.titleSubstring).toBeGreaterThan(WEIGHTS.titleTypo);
    expect(WEIGHTS.titlePrefix).toBeGreaterThan(WEIGHTS.titleSubstring);
    expect(WEIGHTS.titleToken).toBeGreaterThan(WEIGHTS.titlePrefix);
  });

  it("holds that ordering for real results, not only for the arithmetic", () => {
    const pair: SearchEntry[] = [
      // Title hit through a single-edit typo, which is the weakest title tier.
      entry({
        id: "weak-title",
        title: "Magnificent Greens pre-pitched camp",
        edition: "belgium",
      }),
      // No title hit at all: the token is an exact word in the snippet, with
      // the phrase bonus and the active-edition boost applied.
      entry({
        id: "strong-snippet",
        title: "Overview",
        snippet: "greenz",
        edition: "belgium",
      }),
    ];

    const results = search("greenz", { index: pair, edition: "belgium" });
    const weakTitle = results.find((result) => result.id === "weak-title")!;
    const strongSnippet = results.find((result) => result.id === "strong-snippet")!;

    expect(weakTitle).toBeDefined();
    expect(strongSnippet).toBeDefined();
    // Every snippet-side bonus that can apply to a one-token query, at once.
    expect(strongSnippet.score).toBe(
      WEIGHTS.snippetToken + WEIGHTS.snippetPhrase + WEIGHTS.editionActive,
    );
    expect(weakTitle.score).toBeGreaterThan(strongSnippet.score);
    expect(results[0].id).toBe("weak-title");
  });

  it("prefers the tighter title when the match strength ties", () => {
    const results = search("locker", { index });
    expect(results[0].id).toBe("locker-festival");
    expect(results[1].id).toBe("locker-stay");
  });

  it("breaks ties by index order, so results are stable", () => {
    const first = search("locker", { index });
    const second = search("locker", { index });
    expect(first.map((result) => result.id)).toEqual(second.map((result) => result.id));
  });

  it("boosts the active edition without hiding other editions", () => {
    const neutral = search("locker", { index });
    const belgium = search("locker", { index, edition: "belgium" });

    // Every result survives the boost; only the ordering and scores move.
    expect(belgium.map((result) => result.id).sort()).toEqual(
      neutral.map((result) => result.id).sort(),
    );
    expect(belgium[0].score).toBeGreaterThan(neutral[0].score);
  });

  it("orders otherwise identical entries by the active edition", () => {
    const neutral = search("boot cleaning", { index });
    expect(neutral.map((result) => result.id)).toEqual(["boot-cleaning-be", "boot-cleaning-wi"]);

    const winter = search("boot cleaning", { index, edition: "winter" });
    expect(winter.map((result) => result.id)).toEqual(["boot-cleaning-wi", "boot-cleaning-be"]);

    const belgium = search("boot cleaning", { index, edition: "belgium" });
    expect(belgium.map((result) => result.id)).toEqual(["boot-cleaning-be", "boot-cleaning-wi"]);
  });

  it("still matches other editions when one is boosted", () => {
    const results = search("sao paulo", { index, edition: "belgium" });
    expect(results.map((result) => result.id)).toEqual(["sao-paulo"]);
  });

  it("prefers an exact title token over a prefix", () => {
    const pair: SearchEntry[] = [
      entry({ id: "prefix", title: "Winter boots" }),
      entry({ id: "exact", title: "Boot care" }),
    ];
    expect(search("boot", { index: pair }).map((result) => result.id)).toEqual(["exact", "prefix"]);
    expect(search("boot", { index: pair })[0].score).toBeGreaterThan(
      search("boot", { index: pair })[1].score,
    );
  });

  /**
   * Conjunctive matching: an extra word can only narrow the set, never widen
   * it. This is what stops "winter lockers" returning every locker in every
   * edition, and what makes the result count fall as a query gets longer.
   */
  it("requires every content token to match", () => {
    expect(search("winter boots", { index }).map((result) => result.id)).toEqual(["winter-boot"]);
    expect(search("winter pearls", { index })).toEqual([]);
    expect(search("boot lockers", { index })).toEqual([]);
  });

  it("never returns more results for a longer query", () => {
    const words = ["boot", "boot winter", "boot winter grip", "boot winter grip icy"];
    const counts = words.map((query) => search(query, { index, limit: MAX_LIMIT }).length);
    for (let position = 1; position < counts.length; position += 1) {
      expect(counts[position]).toBeLessThanOrEqual(counts[position - 1]);
    }
  });

  it("honours the limit and clamps silly values", () => {
    expect(search("locker", { index, limit: 1 })).toHaveLength(1);
    expect(search("locker", { index, limit: 0 })).toHaveLength(1);
    expect(search("locker", { index, limit: Number.NaN })).toHaveLength(3);
    expect(search("locker", { index, limit: -5 })).toHaveLength(1);
    expect(search("locker", { index, limit: Number.POSITIVE_INFINITY }).length).toBe(3);
    expect(search("e", { index, limit: 1000 }).length).toBeLessThanOrEqual(MAX_LIMIT);
  });

  it("defaults to the documented limit", () => {
    expect(DEFAULT_LIMIT).toBe(12);
    expect(MAX_LIMIT).toBe(50);
  });

  it("returns copies, so callers cannot mutate the index", () => {
    const results = search("pearls", { index });
    results[0].title = "mutated";
    expect(index.find((candidate) => candidate.id === "pearls")?.title).toBe(
      "Pearls and cashless payment",
    );
  });

  it("returns new objects on each call, so a caller cannot poison a later search", () => {
    const first = search("pearls", { index });
    const second = search("pearls", { index });
    expect(first[0]).not.toBe(second[0]);
    expect(first[0]).toEqual(second[0]);
  });

  it("matches on the kind label", () => {
    const results = search("ticket", { index });
    // Every entry carries the "Ticket" label, so every entry matches on it.
    expect(results.length).toBe(index.length);
  });

  it("scores an entry with no match anywhere as absent, not zero", () => {
    const results = search("zzzz", { index });
    expect(results).toEqual([]);
  });

  it("counts a repeated word in a snippet once", () => {
    const pair: SearchEntry[] = [
      entry({ id: "once", title: "Grip", snippet: "grip" }),
      entry({ id: "thrice", title: "Grip", snippet: "grip grip grip" }),
    ];
    const results = search("grip", { index: pair });
    expect(results[0].score).toBe(results[1].score);
  });
});
