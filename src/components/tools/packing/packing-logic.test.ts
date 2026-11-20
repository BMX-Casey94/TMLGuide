// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  PACKING_SECTIONS,
  PACKING_STAYS,
  packingItemSchema,
  type PackingItem,
} from "./packing-catalogue";
import {
  CUSTOM_SECTION_TITLE,
  defaultStayFor,
  formatProgress,
  groupBySection,
  isStayForEdition,
  itemsFor,
  normaliseCustomLabel,
  progressAnnouncement,
  progressFor,
  staysForEdition,
  unpackedOnly,
} from "./packing-logic";
import { packingItems as realItems } from "./packing-catalogue";
/** A small fixture catalogue, so each rule is tested on data a reader can check. */
const fixtureItems: readonly PackingItem[] = [
  {
    id: "always",
    section: "tickets",
    basis: "suggestion",
    label: "Booking confirmation",
    editions: ["belgium", "winter"],
  },
  {
    id: "belgium-only",
    section: "money",
    basis: "suggestion",
    label: "Pearls",
    editions: ["belgium"],
  },
  {
    id: "belgium-campsite",
    section: "campsite",
    basis: "suggestion",
    label: "Tent",
    editions: ["belgium"],
    stays: ["belgium-dreamville"],
  },
  {
    id: "belgium-hotel",
    section: "travel",
    basis: "suggestion",
    label: "Parking voucher",
    editions: ["belgium"],
    stays: ["belgium-hotel-day"],
  },
];

const ids = (items: readonly PackingItem[]): string[] => items.map((item) => item.id);

describe("stays", () => {
  it("lists only an edition's own stays", () => {
    expect(staysForEdition("belgium").map((stay) => stay.id)).toEqual([
      "belgium-dreamville",
      "belgium-hotel-day",
    ]);
    expect(staysForEdition("winter").map((stay) => stay.id)).toEqual(["winter-resort", "winter-outside"]);
    expect(staysForEdition("brasil").map((stay) => stay.id)).toEqual([
      "brasil-dreamville",
      "brasil-offsite",
    ]);
  });

  it("pairs each stay with exactly one edition", () => {
    for (const stay of PACKING_STAYS) {
      expect(isStayForEdition(stay.id, stay.edition)).toBe(true);
      const others = PACKING_STAYS.filter((candidate) => candidate.edition !== stay.edition);
      for (const other of others) {
        expect(isStayForEdition(stay.id, other.edition)).toBe(false);
      }
    }
  });

  it("opens each edition on a stay that belongs to it", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      const first = defaultStayFor(edition);
      expect(isStayForEdition(first, edition)).toBe(true);
    }
  });
});

describe("itemsFor", () => {
  it("includes an unscoped item for every stay of its editions", () => {
    for (const stay of staysForEdition("belgium")) {
      expect(ids(itemsFor(fixtureItems, "belgium", stay.id))).toContain("always");
    }
  });

  it("omits an item scoped to another edition", () => {
    const winter = itemsFor(fixtureItems, "winter", "winter-resort");
    expect(ids(winter)).toEqual(["always"]);
  });

  it("uses the stay to choose between campsite and hotel items", () => {
    expect(ids(itemsFor(fixtureItems, "belgium", "belgium-dreamville"))).toEqual([
      "always",
      "belgium-only",
      "belgium-campsite",
    ]);
    expect(ids(itemsFor(fixtureItems, "belgium", "belgium-hotel-day"))).toEqual([
      "always",
      "belgium-only",
      "belgium-hotel",
    ]);
  });

  it("keeps the catalogue's own order", () => {
    const belgium = itemsFor(realItems, "belgium", "belgium-dreamville");
    const positions = belgium.map((item) => realItems.indexOf(item));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("never returns an item from another edition for the real catalogue", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      for (const stay of staysForEdition(edition)) {
        for (const item of itemsFor(realItems, edition, stay.id)) {
          expect(item.editions).toContain(edition);
        }
      }
    }
  });
});

describe("groupBySection", () => {
  it("drops a section with no items and keeps the reading order", () => {
    const groups = groupBySection(fixtureItems);
    expect(groups.map((group) => group.id)).toEqual(["tickets", "money", "campsite", "travel"]);
    for (const group of groups) {
      expect(group.items.length).toBeGreaterThan(0);
      expect(group.title.length).toBeGreaterThan(0);
    }
  });

  it("uses the catalogue's section titles verbatim", () => {
    const titles = new Map(PACKING_SECTIONS.map((section) => [section.id, section.title]));
    for (const group of groupBySection(realItems)) {
      expect(group.title).toBe(titles.get(group.id));
    }
  });

  it("places every item exactly once", () => {
    const groups = groupBySection(realItems);
    const placed = groups.flatMap((group) => ids(group.items));
    expect(placed.sort()).toEqual(ids(realItems).sort());
  });
});

describe("progress", () => {
  it("counts only items that are on the list", () => {
    const packed = new Set(["always", "belgium-only", "not-a-real-item"]);
    expect(progressFor(fixtureItems, packed)).toEqual({ packed: 2, total: 4, complete: false });
  });

  it("ignores a stale id rather than reporting more packed than exist", () => {
    const packed = new Set(["gone-1", "gone-2"]);
    expect(progressFor(fixtureItems, packed)).toEqual({ packed: 0, total: 4, complete: false });
  });

  it("reports complete only when every listed item is packed", () => {
    const all = new Set(ids(fixtureItems));
    expect(progressFor(fixtureItems, all)).toEqual({ packed: 4, total: 4, complete: true });
  });

  it("does not call an empty list complete", () => {
    expect(progressFor([], new Set())).toEqual({ packed: 0, total: 0, complete: false });
  });

  it("formats the count exactly as the interface shows it", () => {
    expect(formatProgress({ packed: 3, total: 14, complete: false })).toBe("3 of 14 packed");
  });

  it("announces completion and emptiness in words", () => {
    expect(progressAnnouncement({ packed: 0, total: 0, complete: false })).toBe(
      "No items are listed for this choice.",
    );
    expect(progressAnnouncement({ packed: 4, total: 4, complete: true })).toBe("All 4 items packed.");
    expect(progressAnnouncement({ packed: 1, total: 4, complete: false })).toBe("1 of 4 packed.");
  });

  it("counts the reader's own items in the same figure", () => {
    const own = [{ id: "custom-1" }, { id: "custom-2" }];
    const entries = [...fixtureItems, ...own];
    expect(progressFor(entries, new Set(["custom-2"]))).toEqual({
      packed: 1,
      total: 6,
      complete: false,
    });
    // A list made only of reader items is still countable and completable.
    expect(progressFor(own, new Set(["custom-1", "custom-2"]))).toEqual({
      packed: 2,
      total: 2,
      complete: true,
    });
    expect(progressFor([], new Set())).toEqual({ packed: 0, total: 0, complete: false });
  });
});

describe("unpackedOnly", () => {
  it("drops the packed items and keeps the rest", () => {
    expect(ids(unpackedOnly(fixtureItems, new Set(["always"])))).toEqual([
      "belgium-only",
      "belgium-campsite",
      "belgium-hotel",
    ]);
  });

  it("keeps everything when nothing is packed", () => {
    expect(unpackedOnly(fixtureItems, new Set())).toHaveLength(fixtureItems.length);
  });
});

describe("normaliseCustomLabel", () => {
  it("trims and collapses whitespace", () => {
    expect(normaliseCustomLabel("  Sleep   mask ")).toBe("Sleep mask");
    expect(normaliseCustomLabel("Sleep\tmask")).toBe("Sleep mask");
    expect(normaliseCustomLabel("Sleep\nmask")).toBe("Sleep mask");
  });

  it("returns null when nothing is left", () => {
    expect(normaliseCustomLabel("")).toBeNull();
    expect(normaliseCustomLabel("    ")).toBeNull();
    expect(normaliseCustomLabel("\n\t ")).toBeNull();
  });

  it("leaves text that needs no cleaning alone", () => {
    expect(normaliseCustomLabel("Earplugs")).toBe("Earplugs");
  });
});

describe("the real catalogue under every real choice", () => {
  const editions = ["belgium", "winter", "brasil"] as const;

  it("gives every edition and stay a non-empty list with unique ids", () => {
    for (const edition of editions) {
      for (const stay of staysForEdition(edition)) {
        const items = itemsFor(realItems, edition, stay.id);
        expect(items.length, `${edition}/${stay.id}`).toBeGreaterThan(0);
        const itemIds = ids(items);
        expect(new Set(itemIds).size, `${edition}/${stay.id}`).toBe(itemIds.length);
      }
    }
  });

  it("keeps every item valid under the item schema", () => {
    for (const edition of editions) {
      for (const stay of staysForEdition(edition)) {
        for (const item of itemsFor(realItems, edition, stay.id)) {
          expect(packingItemSchema.safeParse(item).success, item.id).toBe(true);
        }
      }
    }
  });

  it("labels the reader's own section the same way in every edition", () => {
    expect(CUSTOM_SECTION_TITLE).toBe("Your own items");
  });

  it("never lists winter gear for a Brasil or Belgium reader", () => {
    for (const edition of ["belgium", "brasil"] as const) {
      for (const stay of staysForEdition(edition)) {
        const sections = groupBySection(itemsFor(realItems, edition, stay.id)).map((group) => group.id);
        expect(sections, `${edition}/${stay.id}`).not.toContain("winter-gear");
      }
    }
  });

  it("lists the transportation pass only for a Winter reader sleeping outside the resort", () => {
    const resort = ids(itemsFor(realItems, "winter", "winter-resort"));
    const outside = ids(itemsFor(realItems, "winter", "winter-outside"));
    expect(resort).not.toContain("winter-transport-pass");
    expect(outside).toContain("winter-transport-pass");
  });
});
