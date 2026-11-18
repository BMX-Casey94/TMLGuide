// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  TABBAR_BORDER_PX,
  TABBAR_HEIGHT_PX,
  TABBAR_TOTAL_HEIGHT_PX,
} from "./layout-metrics";

/**
 * The tab bar's height appears in two places that must agree: the component and footer import it
 * from layout-metrics, while anything using the CSS variable reads `--tabbar-h` from globals.css.
 * These tests fail the build if the two ever drift apart.
 */
describe("tab bar metrics", () => {
  const globals = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

  it("matches the --tabbar-h custom property in globals.css", () => {
    const match = globals.match(/--tabbar-h:\s*(\d+)px/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(TABBAR_HEIGHT_PX);
  });

  it("measures the total footprint as content plus border", () => {
    expect(TABBAR_HEIGHT_PX).toBe(64);
    expect(TABBAR_BORDER_PX).toBe(1);
    expect(TABBAR_TOTAL_HEIGHT_PX).toBe(TABBAR_HEIGHT_PX + TABBAR_BORDER_PX);
  });

  it("keeps every tab above the 44px minimum touch target", () => {
    // Five cells across the narrowest supported viewport (320px) are 64px wide, and the bar's
    // content height is 64px, so each tab's target is at least 64x64 before any padding.
    const narrowestCell = 320 / 5;
    expect(narrowestCell).toBeGreaterThanOrEqual(44);
    expect(TABBAR_HEIGHT_PX).toBeGreaterThanOrEqual(44);
  });
});
