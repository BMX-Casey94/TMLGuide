import { describe, expect, it } from "vitest";
import {
  ANCHOR_MAX,
  ANCHOR_PATTERN,
  GUIDE_TOP_ANCHOR,
  faqAnchor,
  guideSectionAnchor,
  hrefWithAnchor,
  isAnchorId,
  recordAnchor,
} from "./anchors";

/**
 * The anchor module is the single source of the DOM ids search results point
 * at, so these tests are about two properties above all: determinism (the page
 * and the index compute the same id without talking to each other) and safety
 * (an anchor can never turn an internal link into anything else).
 */

describe("recordAnchor", () => {
  it("prefixes each family the way the anchors doc documents", () => {
    expect(recordAnchor("faq", "re-entry")).toBe("faq-re-entry");
    expect(recordAnchor("ticket", "belgium-2027-day-pass")).toBe("ticket-belgium-2027-day-pass");
    expect(recordAnchor("stay", "belgium-easy-tent-2p")).toBe("stay-belgium-easy-tent-2p");
    expect(recordAnchor("sale", "worldwide-ticket-sale")).toBe("sale-worldwide-ticket-sale");
    expect(recordAnchor("whatsapp", "mg-w1-group")).toBe("wa-mg-w1-group");
    expect(recordAnchor("resource", "official-faq")).toBe("resource-official-faq");
    expect(recordAnchor("partner", "rent-a-tent")).toBe("partner-rent-a-tent");
  });

  it("is deterministic and independent of call order", () => {
    const first = recordAnchor("ticket", "belgium-2027-day-pass");
    const second = recordAnchor("ticket", "belgium-2027-day-pass");
    expect(first).toBe(second);
  });

  it("produces an id that matches the anchor pattern for every family", () => {
    const families = ["faq", "ticket", "stay", "sale", "whatsapp", "resource", "partner"] as const;
    for (const family of families) {
      expect(isAnchorId(recordAnchor(family, "some-record-id")), family).toBe(true);
    }
  });

  it("folds characters an id attribute cannot carry", () => {
    expect(recordAnchor("faq", "São Paulo_2027")).toBe("faq-sao-paulo-2027");
    expect(recordAnchor("faq", "  spaced  ")).toBe("faq-spaced");
    expect(recordAnchor("faq", "emoji-✨-group")).toBe("faq-emoji-group");
    expect(recordAnchor("faq", "a//b")).toBe("faq-a-b");
    expect(recordAnchor("faq", "...")).toBe("faq-record");
  });

  it("does not repeat a family word the record id already starts with", () => {
    // The community data names its records `wa-1`, `resource-travel-partner` and
    // `partner-dca-travel`: `wa-wa-1` would read like a bug in the address bar.
    expect(recordAnchor("whatsapp", "wa-1")).toBe("wa-1");
    expect(recordAnchor("resource", "resource-travel-partner")).toBe("resource-travel-partner");
    expect(recordAnchor("partner", "partner-dca-travel")).toBe("partner-dca-travel");
  });

  it("keeps the prefix when the record id is only that word", () => {
    expect(recordAnchor("whatsapp", "wa")).toBe("wa-wa");
  });

  it("caps a long id and keeps two long ids distinct", () => {
    const shared = "x".repeat(100);
    const a = recordAnchor("ticket", `${shared}-alpha`);
    const b = recordAnchor("ticket", `${shared}-beta`);

    expect(a.length).toBeLessThanOrEqual(ANCHOR_MAX);
    expect(b.length).toBeLessThanOrEqual(ANCHOR_MAX);
    expect(a).not.toBe(b);
    expect(ANCHOR_PATTERN.test(a)).toBe(true);
    expect(ANCHOR_PATTERN.test(b)).toBe(true);
  });

  it("cuts a long id on a hyphen so the readable words survive", () => {
    const id = recordAnchor("ticket", `${"word-".repeat(30)}end`);
    expect(id.length).toBeLessThanOrEqual(ANCHOR_MAX);
    expect(id.endsWith("-")).toBe(false);
    expect(id.startsWith("ticket-word-")).toBe(true);
  });

  it("cannot produce an id containing a fragment or a query", () => {
    for (const hostile of ["a#b", "a?b", "a%23b", "a b", "a/b", "javascript:alert(1)"]) {
      const id = recordAnchor("faq", hostile);
      expect(ANCHOR_PATTERN.test(id), hostile).toBe(true);
      expect(id).not.toContain("#");
      expect(id).not.toContain("?");
      expect(id).not.toContain("/");
      expect(id).not.toContain(":");
    }
  });
});

describe("faqAnchor", () => {
  it("namespaces the collection, because two collections reuse an id", () => {
    expect(faqAnchor("belgium", "exchange-desk-fee")).toBe("faq-be-exchange-desk-fee");
    expect(faqAnchor("shared", "exchange-desk-fee")).toBe("faq-sh-exchange-desk-fee");
    expect(faqAnchor("winter", "faq-festival-dates-2027")).toBe("faq-wi-faq-festival-dates-2027");
    expect(faqAnchor("brasil", "half-price")).toBe("faq-br-half-price");
  });

  it("gives two collections with one record id two different anchors", () => {
    expect(faqAnchor("belgium", "official-sales-channels")).not.toBe(
      faqAnchor("shared", "official-sales-channels"),
    );
  });
});

describe("guideSectionAnchor", () => {
  it("uses the heading id the chapter content already carries", () => {
    expect(guideSectionAnchor("arriving-by-train")).toBe("arriving-by-train");
  });

  it("replaces a heading id outside the pattern rather than passing it through", () => {
    expect(guideSectionAnchor("Arriving By Train")).toBe("section-arriving-by-train");
    expect(guideSectionAnchor("a_b")).toBe("section-a-b");
    expect(isAnchorId(guideSectionAnchor("!"))).toBe(true);
  });

  it("names the chapter top anchor the page already uses", () => {
    expect(GUIDE_TOP_ANCHOR).toBe("chapter-title");
    expect(isAnchorId(GUIDE_TOP_ANCHOR)).toBe(true);
  });
});

describe("isAnchorId", () => {
  it.each([
    "a",
    "faq-re-entry",
    "ticket-belgium-2027-day-pass",
    "a1",
    "1a",
    "a-b-c",
  ])("accepts %s", (value) => {
    expect(isAnchorId(value)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["a fragment", "#a"],
    ["a query", "a?b"],
    ["a slash", "a/b"],
    ["an upper-case letter", "aB"],
    ["a space", "a b"],
    ["an underscore", "a_b"],
    ["a dot", "a.b"],
    ["a leading hyphen", "-a"],
    ["a trailing hyphen", "a-"],
    ["two hyphens", "a--b"],
    ["a percent escape", "a%20b"],
    ["a colon", "javascript:alert(1)"],
    ["newline", "a\nb"],
  ])("refuses %s", (_label, value) => {
    expect(isAnchorId(value)).toBe(false);
  });

  it("refuses an id longer than the limit", () => {
    expect(isAnchorId("a".repeat(ANCHOR_MAX))).toBe(true);
    expect(isAnchorId("a".repeat(ANCHOR_MAX + 1))).toBe(false);
  });
});

describe("hrefWithAnchor", () => {
  it("joins a route and an anchor with one hash", () => {
    expect(hrefWithAnchor("/community", "partner-rent-a-tent")).toBe(
      "/community#partner-rent-a-tent",
    );
  });

  it("keeps an existing query string before the fragment", () => {
    expect(hrefWithAnchor("/guides/tickets?edition=winter", "ticket-x")).toBe(
      "/guides/tickets?edition=winter#ticket-x",
    );
  });

  it("returns the route untouched when there is no anchor", () => {
    expect(hrefWithAnchor("/guides", null)).toBe("/guides");
    expect(hrefWithAnchor("/guides", undefined)).toBe("/guides");
    expect(hrefWithAnchor("/guides", "")).toBe("/guides");
  });

  it("never produces a double hash", () => {
    expect(hrefWithAnchor("/a", "b")).not.toContain("##");
  });
});
