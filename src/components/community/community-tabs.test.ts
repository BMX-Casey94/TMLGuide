import { describe, expect, it } from "vitest";
import {
  COMMUNITY_TABS,
  COMMUNITY_TAB_IDS,
  DEFAULT_COMMUNITY_TAB,
  hashForTab,
  nextTabForKey,
  panelForAnchor,
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

describe("panelForAnchor", () => {
  it("sends a WhatsApp group anchor to the WhatsApp panel", () => {
    expect(panelForAnchor("#wa-1")).toBe("whatsapp");
    expect(panelForAnchor("#wa-solo-group")).toBe("whatsapp");
  });

  it("sends a resource anchor to the resources panel", () => {
    expect(panelForAnchor("#resource-discord")).toBe("resources");
  });

  it("sends a partner anchor to the partners panel", () => {
    expect(panelForAnchor("#partner-dca-travel")).toBe("partners");
    // The data ids already carry their prefix, and the anchor keeps one copy.
    expect(panelForAnchor("#partner-partner-rent-a-tent")).toBe("partners");
  });

  it("reads a hash with or without the leading #, case insensitively and trimmed", () => {
    expect(panelForAnchor("wa-1")).toBe("whatsapp");
    expect(panelForAnchor("#  WA-1 ")).toBe("whatsapp");
    expect(panelForAnchor("#Partner-DCA-Travel")).toBe("partners");
  });

  it("returns null for an unknown prefix", () => {
    expect(panelForAnchor("#faq-be-lockers")).toBeNull();
    expect(panelForAnchor("#sale-belgium")).toBeNull();
    expect(panelForAnchor("#whatsapp-groups")).toBeNull();
  });

  it("returns null for an empty hash or a bare #", () => {
    expect(panelForAnchor("")).toBeNull();
    expect(panelForAnchor("#")).toBeNull();
  });

  it("treats a bare prefix as no record", () => {
    /*
      `#partner-` names nothing. Switching to a tab for it would move the reader
      away from where they were for an id that resolves to no card, and the anchor
      pattern the index enforces already refuses a one-word id like this.
    */
    for (const hash of ["#wa-", "#resource-", "#partner-", "wa-", "resource-", "partner-"]) {
      expect(panelForAnchor(hash), hash).toBeNull();
    }
  });

  it("accepts a record whose id is long, and one that repeats its own prefix", () => {
    expect(panelForAnchor("#wa-wa-1")).toBe("whatsapp");
    expect(panelForAnchor("#resource-resource-travel-partner")).toBe("resources");
    expect(panelForAnchor("#partner-partner-partner-rent-a-tent")).toBe("partners");
  });
});
