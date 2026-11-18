// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { Faq } from "@/data/schemas";
import {
  HIGHLIGHTED_FAQ_IDS,
  faqAnchor,
  highlightedFaqs,
  pickHighlightedFaqs,
} from "./faq-selection";

const SOURCE = {
  url: "https://belgium.tomorrowland.com/en/",
  title: "Official",
  retrievedOn: "2026-11-18",
} as const;

function faq(id: string, question = id, answer = "Answer."): Faq {
  return {
    id,
    edition: "belgium",
    question,
    answer,
    tags: [],
    related: [],
    source: SOURCE,
    lastVerified: "2026-11-18",
    confidence: "official",
  };
}

describe("pickHighlightedFaqs", () => {
  it("returns the highlighted entries in the order asked for, not the data's order", () => {
    const picked = pickHighlightedFaqs([[faq("c"), faq("a"), faq("b")]], ["b", "a"]);
    expect(picked.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("searches several collections and finds ids across them", () => {
    const picked = pickHighlightedFaqs([[faq("shared-rule")], [faq("edition-rule")]], [
      "shared-rule",
      "edition-rule",
    ]);
    expect(picked.map((entry) => entry.id)).toEqual(["shared-rule", "edition-rule"]);
  });

  it("prefers the first collection when both define an id", () => {
    const picked = pickHighlightedFaqs(
      [[faq("shared", "Shared wording")], [faq("shared", "Edition wording")]],
      ["shared"],
    );
    expect(picked[0].question).toBe("Shared wording");
  });

  it("skips an id that is not in the collections rather than substituting another", () => {
    const picked = pickHighlightedFaqs([[faq("a")]], ["a", "missing"]);
    expect(picked).toHaveLength(1);
    expect(picked[0].id).toBe("a");
  });

  it("returns nothing when no id matches", () => {
    expect(pickHighlightedFaqs([[faq("a")]], ["z"])).toEqual([]);
  });

  it("returns nothing when given no collections", () => {
    expect(pickHighlightedFaqs([])).toEqual([]);
  });

  it("refuses to render one question twice under a single anchor", () => {
    expect(() => pickHighlightedFaqs([[faq("a"), faq("a")]], ["a"])).toThrow(/two entries share/);
  });

  it("accepts a repeated id in the request list without duplicating the entry", () => {
    const picked = pickHighlightedFaqs([[faq("a")]], ["a", "a"]);
    expect(picked).toHaveLength(1);
  });
});

describe("the site's four highlights", () => {
  const highlights = highlightedFaqs();

  it("finds all four in the verified data", () => {
    expect(highlights).toHaveLength(HIGHLIGHTED_FAQ_IDS.length);
    expect(highlights.map((entry) => entry.id)).toEqual([...HIGHLIGHTED_FAQ_IDS]);
  });

  it("covers the four rules the brief names", () => {
    const questions = highlights.map((entry) => entry.question.toLowerCase());
    expect(questions.some((question) => question.includes("come back"))).toBe(true);
    expect(questions.some((question) => question.includes("ticketswap"))).toBe(true);
    expect(questions.some((question) => question.includes("how many tickets"))).toBe(true);
    expect(questions.some((question) => question.includes("pre-register"))).toBe(true);
  });

  it("states OUT = OUT, the Exchange Desk rule and the four-person cap", () => {
    const text = highlights.map((entry) => entry.answer).join("\n");
    expect(text).toContain("OUT = OUT");
    expect(text).toContain("Exchange Desk");
    expect(text).toContain("Four people per Tomorrowland Account");
  });

  it("never describes a resale marketplace as official", () => {
    const text = highlights.map((entry) => entry.answer).join("\n");
    expect(text).toMatch(/TicketSwap, Viagogo, StubHub and similar marketplaces are not official/);
  });

  it("says pre-registration does not guarantee a ticket", () => {
    const preRegistration = highlights.find((entry) => entry.id === "pre-registration");
    expect(preRegistration?.answer.toLowerCase()).toContain("does not guarantee");
  });

  it("gives every entry an official source with a check date", () => {
    for (const entry of highlights) {
      expect(entry.source.url).toMatch(/^https:\/\/[a-z0-9.-]*tomorrowland\.com\//);
      expect(entry.source.title.length).toBeGreaterThan(0);
      expect(entry.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("keeps every answer's Markdown inside the subset the renderer supports", () => {
    // Bullets and **bold** only: a table, a heading or a link would render as
    // literal text, so this catches one before it reaches the page.
    for (const entry of highlights) {
      expect(entry.answer).not.toMatch(/^#{1,6}\s/m);
      expect(entry.answer).not.toMatch(/^\|/m);
      expect(entry.answer).not.toMatch(/\[[^\]]+\]\([^)]+\)/);
    }
  });
});

describe("faqAnchor", () => {
  it("builds a stable, prefixed id", () => {
    expect(faqAnchor("faq", "re-entry")).toBe("faq-re-entry");
    expect(faqAnchor("home", "pre-registration")).toBe("home-pre-registration");
  });

  it("gives different prefixes different ids, so two accordions can share a page", () => {
    expect(faqAnchor("a", "x")).not.toBe(faqAnchor("b", "x"));
  });
});
