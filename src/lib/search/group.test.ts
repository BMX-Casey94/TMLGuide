import { describe, expect, it } from "vitest";
import { flattenGroups, groupResults } from "./group";
import { KIND_ORDER } from "./kinds";
import type { RankedEntry } from "./types";

function ranked(id: string, kind: RankedEntry["kind"], label: string, score: number): RankedEntry {
  return {
    id,
    title: id,
    snippet: "",
    kind,
    kindLabel: label,
    edition: "all",
    href: "/guides/tickets",
    source: "test",
    score,
  };
}

describe("groupResults", () => {
  it("groups by kind and preserves score order within a group", () => {
    const groups = groupResults([
      ranked("a", "ticket", "Ticket", 50),
      ranked("b", "faq", "FAQ", 40),
      ranked("c", "ticket", "Ticket", 30),
    ]);

    expect(groups.map((group) => group.kind)).toEqual(["ticket", "faq"]);
    expect(groups[0].entries.map((entry) => entry.id)).toEqual(["a", "c"]);
    expect(groups[1].entries.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("orders groups by their best score", () => {
    const groups = groupResults([ranked("weak-page", "page", "Page", 10), ranked("strong-faq", "faq", "FAQ", 99)]);

    expect(groups.map((group) => group.kind)).toEqual(["faq", "page"]);
  });

  it("falls back to the fixed kind order when scores tie", () => {
    const groups = groupResults([ranked("faq", "faq", "FAQ", 20), ranked("page", "page", "Page", 20)]);

    expect(groups.map((group) => group.kind)).toEqual(["page", "faq"]);
  });

  it("orders every kind by the shared KIND_ORDER when all scores tie", () => {
    const groups = groupResults(KIND_ORDER.map((kind) => ranked(kind, kind, kind, 5)));
    expect(groups.map((group) => group.kind)).toEqual([...KIND_ORDER]);
  });

  it("carries the kind label through for the heading", () => {
    const groups = groupResults([ranked("x", "whatsapp", "WhatsApp", 5)]);
    expect(groups[0].label).toBe("WhatsApp");
  });

  it("uses the best score in the group, not the last one seen", () => {
    const groups = groupResults([
      ranked("a", "ticket", "Ticket", 90),
      ranked("b", "ticket", "Ticket", 10),
    ]);
    expect(groups[0].score).toBe(90);
  });

  it("returns nothing for no results", () => {
    expect(groupResults([])).toEqual([]);
  });

  it("does not mutate the input", () => {
    const results = [ranked("a", "ticket", "Ticket", 50), ranked("b", "ticket", "Ticket", 40)];
    const copy = [...results];
    groupResults(results);
    expect(results).toEqual(copy);
  });
});

describe("flattenGroups", () => {
  it("flattens back into the on-screen order", () => {
    const results = [
      ranked("a", "ticket", "Ticket", 50),
      ranked("b", "faq", "FAQ", 40),
      ranked("c", "ticket", "Ticket", 30),
    ];
    expect(flattenGroups(groupResults(results)).map((entry) => entry.id)).toEqual(["a", "c", "b"]);
  });

  it("returns nothing for no groups", () => {
    expect(flattenGroups([])).toEqual([]);
  });
});
