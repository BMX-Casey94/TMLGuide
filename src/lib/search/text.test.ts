import { describe, expect, it } from "vitest";
import {
  QUERY_MAX,
  SNIPPET_MAX,
  collapseWhitespace,
  fold,
  highlightSegments,
  queryTokens,
  snippet,
  tokenise,
  withinOneEdit,
} from "./text";

describe("fold", () => {
  it("lowercases and strips diacritics", () => {
    expect(fold("São Paulo")).toBe("sao paulo");
    expect(fold("Alpe d'Huez")).toBe("alpe d huez");
    expect(fold("Mística")).toBe("mistica");
    expect(fold("Consciência")).toBe("consciencia");
  });

  it("folds ampersands and dashes to words and spaces", () => {
    expect(fold("Food & Drinks")).toBe("food and drinks");
    expect(fold("20–27 March")).toBe("20 27 march");
  });

  it("handles curly quotes and emoji", () => {
    expect(fold("Tomorrowland’s “Surprise”")).toBe("tomorrowland s surprise");
    expect(fold("Solo & Group ✨✈️")).toBe("solo and group");
  });

  it("drops currency symbols so a pasted price still matches", () => {
    expect(fold("€144.00")).toBe("144 00");
    expect(fold("R$ 3.160,00")).toBe("r 3 160 00");
  });

  it("returns an empty string for punctuation only", () => {
    expect(fold("?!…—")).toBe("");
  });
});

describe("tokenise", () => {
  it("splits folded text on whitespace", () => {
    expect(tokenise("Full Madness Pass")).toEqual(["full", "madness", "pass"]);
  });

  it("returns nothing for empty input", () => {
    expect(tokenise("")).toEqual([]);
    expect(tokenise("   ")).toEqual([]);
  });
});

describe("queryTokens", () => {
  it("drops filler words but keeps content", () => {
    expect(queryTokens("is there a locker")).toEqual(["locker"]);
  });

  it("keeps the query when every word is filler", () => {
    expect(queryTokens("the and")).toEqual(["the", "and"]);
  });

  it("returns nothing for punctuation only", () => {
    expect(queryTokens("  ?!  ")).toEqual([]);
  });

  it("drops single letters only when a word remains", () => {
    expect(queryTokens("a ticket")).toEqual(["ticket"]);
    expect(queryTokens("x")).toEqual(["x"]);
  });
});

describe("withinOneEdit", () => {
  it("accepts identical strings", () => {
    expect(withinOneEdit("pearls", "pearls")).toBe(true);
  });

  it("accepts one substitution, insertion or deletion", () => {
    expect(withinOneEdit("pearls", "paerls")).toBe(true);
    expect(withinOneEdit("pearls", "pearlsx")).toBe(true);
    expect(withinOneEdit("pearls", "perls")).toBe(true);
    expect(withinOneEdit("pearls", "pearps")).toBe(true);
  });

  it("accepts one adjacent transposition", () => {
    expect(withinOneEdit("locker", "lokcer")).toBe(true);
  });

  it("rejects two edits", () => {
    expect(withinOneEdit("pearls", "pear")).toBe(false);
    expect(withinOneEdit("locker", "lackor")).toBe(false);
    expect(withinOneEdit("pearls", "purals")).toBe(false);
  });

  it("rejects a transposition that is not adjacent", () => {
    expect(withinOneEdit("abcd", "dbca")).toBe(false);
  });
});

describe("collapseWhitespace", () => {
  it("collapses newlines and runs of spaces", () => {
    expect(collapseWhitespace("one\n\ntwo   three ")).toBe("one two three");
  });
});

describe("snippet", () => {
  it("leaves short text alone", () => {
    expect(snippet("short text")).toBe("short text");
  });

  it("returns exactly the limit when the text fits", () => {
    const exact = "a".repeat(SNIPPET_MAX);
    expect(snippet(exact)).toBe(exact);
  });

  it("cuts on a word boundary within the limit", () => {
    const long = `${"word ".repeat(60)}end`;
    const result = snippet(long);
    expect(result.length).toBeLessThanOrEqual(SNIPPET_MAX);
    expect(result.endsWith("\u2026")).toBe(true);
    expect(result).not.toContain("wor\u2026");
  });

  it("drops a trailing comma before the ellipsis", () => {
    const text = `${"a".repeat(150)}, ${"b".repeat(40)}`;
    expect(snippet(text)).not.toContain(",\u2026");
  });

  it("honours a custom maximum", () => {
    expect(snippet("one two three four", 9).length).toBeLessThanOrEqual(9);
  });
});

describe("QUERY_MAX", () => {
  it("matches the length the recents store caps at", () => {
    // `recent.ts` holds its own copy; this keeps the two from drifting.
    expect(QUERY_MAX).toBe(80);
  });
});

describe("highlightSegments", () => {
  it("returns one plain segment when there are no tokens", () => {
    expect(highlightSegments("Day Pass", [])).toEqual([{ text: "Day Pass", match: false }]);
  });

  it("marks a whole word in the middle of a title", () => {
    const segments = highlightSegments("Full Madness Pass", ["madness"]);
    expect(segments).toEqual([
      { text: "Full ", match: false },
      { text: "Madness", match: true },
      { text: " Pass", match: false },
    ]);
  });

  it("marks a prefix of a word, as the ranker matches it", () => {
    const segments = highlightSegments("DreamVille tent", ["dream"]);
    expect(segments[0]).toEqual({ text: "DreamVille", match: true });
  });

  it("does not mark a substring inside a word", () => {
    const segments = highlightSegments("Magnificent Greens", ["een"]);
    expect(segments.every((segment) => !segment.match)).toBe(true);
  });

  it("matches accent-insensitively and keeps the original characters", () => {
    const segments = highlightSegments("São Paulo shuttle", ["sao"]);
    expect(segments[0]).toEqual({ text: "São", match: true });
  });

  it("marks every occurrence of a token", () => {
    const segments = highlightSegments("pass and pass", ["pass"]);
    expect(segments.filter((segment) => segment.match)).toHaveLength(2);
  });

  it("reassembles to the original text exactly", () => {
    const text = "Tomorrowland Brasil 2027 — Full Madness Pass, R$3.160,00";
    const segments = highlightSegments(text, ["brasil", "madness", "r"]);
    expect(segments.map((segment) => segment.text).join("")).toBe(text);
  });

  it("never returns an empty segment", () => {
    for (const segment of highlightSegments("a b c", ["b"])) {
      expect(segment.text.length).toBeGreaterThan(0);
    }
  });

  it("leaves markup as text, so nothing is ever interpreted as HTML", () => {
    const segments = highlightSegments("<script>alert(1)</script>", ["script"]);
    expect(segments.map((segment) => segment.text).join("")).toBe("<script>alert(1)</script>");
  });
});
