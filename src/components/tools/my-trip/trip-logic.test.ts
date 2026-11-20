import { describe, expect, it } from "vitest";
import { EDITION_CHAPTER_SLUGS, PENDING_TOOL_LINKS, TOOL_STEPS } from "./trip-logic";

/**
 * The next-steps panel's contracts.
 *
 * These are the two lists the orchestrator will edit, so the tests pin the
 * properties that matter rather than the exact contents: every rendered link
 * names a route this site serves today, and nothing pending is rendered.
 */

describe("TOOL_STEPS", () => {
  it("links only to tool routes that exist today", () => {
    const live = new Set([
      "/tools/budget",
      "/tools/pearls",
      "/tools/sale-timeline",
      "/tools/journey",
      "/tools/packing",
    ]);
    for (const step of TOOL_STEPS) {
      expect(live.has(step.href), `${step.href} is rendered but does not exist`).toBe(true);
    }
  });

  it("gives every link a label and a reason", () => {
    for (const step of TOOL_STEPS) {
      expect(step.label.length).toBeGreaterThan(0);
      expect(step.why.length).toBeGreaterThan(20);
    }
  });

  it("does not repeat a route", () => {
    const hrefs = TOOL_STEPS.map((step) => step.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("PENDING_TOOL_LINKS", () => {
  it("is empty once all wave 6 sibling tools are live", () => {
    expect(PENDING_TOOL_LINKS).toHaveLength(0);
  });

  it("is not rendered: no pending route appears in the live list", () => {
    const live = new Set(TOOL_STEPS.map((step) => step.href));
    for (const pending of PENDING_TOOL_LINKS) {
      expect(live.has(pending.href), `${pending.href} is still pending`).toBe(false);
    }
  });

  it("points every entry at a tool route, so enabling one is a move and not a rewrite", () => {
    for (const pending of PENDING_TOOL_LINKS) {
      expect(pending.href.startsWith("/tools/")).toBe(true);
      expect(pending.label.length).toBeGreaterThan(0);
      expect(pending.why.length).toBeGreaterThan(10);
    }
  });
});

describe("EDITION_CHAPTER_SLUGS", () => {
  it("names chapters for every edition, each with a reason", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      expect(EDITION_CHAPTER_SLUGS[edition].length).toBeGreaterThan(0);
      for (const entry of EDITION_CHAPTER_SLUGS[edition]) {
        expect(entry.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(entry.why.length).toBeGreaterThan(15);
      }
    }
  });
});
