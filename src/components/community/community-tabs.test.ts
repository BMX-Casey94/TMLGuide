import { describe, expect, it } from "vitest";
import {
  COMMUNITY_TABS,
  COMMUNITY_TAB_IDS,
  DEFAULT_COMMUNITY_TAB,
  hashForTab,
  nextTabForKey,
  tabFromHash,
} from "./community-tabs";

describe("tab configuration", () => {
  it("offers the three sections the brief requires, in order", () => {
    expect(COMMUNITY_TABS.map((tab) => tab.label)).toEqual([
      "WhatsApp groups",
      "Resources",
      "Partners",
    ]);
    expect(COMMUNITY_TAB_IDS).toEqual(["whatsapp", "resources", "partners"]);
  });

  it("opens on the WhatsApp directory", () => {
    expect(DEFAULT_COMMUNITY_TAB).toBe("whatsapp");
  });

  it("gives every tab a distinct hash", () => {
    const hashes = COMMUNITY_TABS.map((tab) => tab.hash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});

describe("tabFromHash", () => {
  it("reads a hash with or without the leading #", () => {
    expect(tabFromHash("#partners")).toBe("partners");
    expect(tabFromHash("partners")).toBe("partners");
  });

  it("accepts the tab id as well as its hash", () => {
    expect(tabFromHash("#resources")).toBe("resources");
    expect(tabFromHash("#whatsapp")).toBe("whatsapp");
  });

  it("is case insensitive and tolerates padding", () => {
    expect(tabFromHash("#  PARTNERS ")).toBe("partners");
  });

  it("returns null for an empty or unknown hash", () => {
    expect(tabFromHash("")).toBeNull();
    expect(tabFromHash("#")).toBeNull();
    expect(tabFromHash("#nope")).toBeNull();
  });

  it("round-trips through hashForTab", () => {
    for (const id of COMMUNITY_TAB_IDS) {
      expect(tabFromHash(hashForTab(id))).toBe(id);
    }
  });
});

describe("hashForTab", () => {
  it("includes the #", () => {
    expect(hashForTab("partners")).toBe("#partners");
    expect(hashForTab("whatsapp")).toBe("#whatsapp-groups");
  });
});

describe("nextTabForKey", () => {
  it("moves right and wraps", () => {
    expect(nextTabForKey("whatsapp", "ArrowRight")).toBe("resources");
    expect(nextTabForKey("partners", "ArrowRight")).toBe("whatsapp");
  });

  it("moves left and wraps", () => {
    expect(nextTabForKey("resources", "ArrowLeft")).toBe("whatsapp");
    expect(nextTabForKey("whatsapp", "ArrowLeft")).toBe("partners");
  });

  it("jumps to the ends with Home and End", () => {
    expect(nextTabForKey("resources", "Home")).toBe("whatsapp");
    expect(nextTabForKey("resources", "End")).toBe("partners");
  });

  it("leaves every other key alone", () => {
    for (const key of ["Tab", "Enter", " ", "Escape", "ArrowUp", "a"]) {
      expect(nextTabForKey("whatsapp", key)).toBeNull();
    }
  });
});
