import { describe, expect, it } from "vitest";
import { buildSearchIndex, SearchDialog } from "./index";
import { KIND_LABELS } from "@/lib/search/kinds";
import { isKnownRoute } from "@/lib/search/routes";
import { SEARCH_TRIGGER_ATTRIBUTE } from "./search-palette";

/**
 * The public surface the layout will import. These tests are about the exports
 * rather than the UI: `search-dialog.tsx` is a Server Component, so anything
 * that reaches its client child is checked at module level here.
 */
describe("search exports", () => {
  it("exports the dialog the layout mounts", () => {
    expect(typeof SearchDialog).toBe("function");
  });

  it("exports the index builder, so a consumer needs only this module", () => {
    expect(typeof buildSearchIndex).toBe("function");
    expect(buildSearchIndex().length).toBeGreaterThan(0);
  });

  it("exports the trigger attribute the header field carries", () => {
    expect(SEARCH_TRIGGER_ATTRIBUTE).toBe("data-search-trigger");
  });

  it("exports a kind label for every kind", () => {
    for (const label of Object.values(KIND_LABELS)) {
      expect(label.trim()).not.toBe("");
    }
  });

  it("builds an index whose hrefs all pass the route whitelist", () => {
    for (const entry of buildSearchIndex()) {
      expect(isKnownRoute(entry.href), entry.id).toBe(true);
    }
  });
});
