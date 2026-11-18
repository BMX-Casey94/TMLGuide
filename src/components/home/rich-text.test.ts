// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseInline, parseRichText } from "./rich-text";

describe("parseRichText", () => {
  it("splits paragraphs on blank lines", () => {
    expect(parseRichText("First para.\n\nSecond para.")).toEqual([
      { kind: "paragraph", text: "First para." },
      { kind: "paragraph", text: "Second para." },
    ]);
  });

  it("joins a wrapped paragraph into one block", () => {
    expect(parseRichText("One line\ncontinues here.")).toEqual([
      { kind: "paragraph", text: "One line continues here." },
    ]);
  });

  it("collects consecutive bullet lines into one list", () => {
    expect(parseRichText("Intro.\n\n- One\n- Two\n- Three")).toEqual([
      { kind: "paragraph", text: "Intro." },
      { kind: "list", items: ["One", "Two", "Three"] },
    ]);
  });

  it("starts a new list after a paragraph", () => {
    expect(parseRichText("- One\n\nMiddle.\n\n- Two")).toEqual([
      { kind: "list", items: ["One"] },
      { kind: "paragraph", text: "Middle." },
      { kind: "list", items: ["Two"] },
    ]);
  });

  it("handles Windows line endings", () => {
    expect(parseRichText("First.\r\n\r\n- One\r\n- Two")).toEqual([
      { kind: "paragraph", text: "First." },
      { kind: "list", items: ["One", "Two"] },
    ]);
  });

  it("returns nothing for an empty or whitespace-only answer", () => {
    expect(parseRichText("")).toEqual([]);
    expect(parseRichText("   \n\n  ")).toEqual([]);
  });

  it("leaves a hyphen that does not start a bullet as text", () => {
    expect(parseRichText("A range of 16-18 July.")).toEqual([
      { kind: "paragraph", text: "A range of 16-18 July." },
    ]);
  });
});

describe("parseInline", () => {
  it("marks a bold run", () => {
    expect(parseInline("Out is **out** today.")).toEqual([
      { text: "Out is ", strong: false },
      { text: "out", strong: true },
      { text: " today.", strong: false },
    ]);
  });

  it("handles several bold runs in one line", () => {
    const runs = parseInline("**A** and **B**");
    expect(runs.filter((run) => run.strong).map((run) => run.text)).toEqual(["A", "B"]);
  });

  it("leaves an unpaired marker visible rather than swallowing it", () => {
    expect(parseInline("A stray ** here")).toEqual([{ text: "A stray ** here", strong: false }]);
  });

  it("returns one plain run when there is no markup", () => {
    expect(parseInline("Plain text.")).toEqual([{ text: "Plain text.", strong: false }]);
  });

  it("does not treat underscores or single asterisks as emphasis", () => {
    expect(parseInline("snake_case and *one*")).toEqual([
      { text: "snake_case and *one*", strong: false },
    ]);
  });

  it("never produces a run for an empty string", () => {
    expect(parseInline("")).toEqual([]);
  });
});

describe("safety", () => {
  it("keeps a tag in the data as literal text, never as markup", () => {
    const blocks = parseRichText("<script>alert(1)</script>");
    expect(blocks).toEqual([{ kind: "paragraph", text: "<script>alert(1)</script>" }]);
  });

  it("keeps a Markdown link as literal text, because no link syntax is supported", () => {
    const blocks = parseRichText("[click](https://example.com)");
    expect(blocks).toEqual([{ kind: "paragraph", text: "[click](https://example.com)" }]);
  });
});
