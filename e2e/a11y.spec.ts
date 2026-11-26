import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { allChapters, chapterPath } from "../src/content";

/**
 * Automated WCAG 2.2 AA scan of every public route, on desktop and a phone
 * viewport. Automated checks find roughly a third of real issues, so a pass
 * here is a floor, not a conformance claim; keyboard and screen-reader testing
 * is recorded separately.
 */
const STATIC_ROUTES = [
  "/",
  "/about",
  "/accessibility",
  "/more",
  "/community",
  "/radio",
  "/tools",
  "/tools/budget",
  "/tools/maps",
  "/tools/pearls",
  "/tools/sale-timeline",
  "/tools/journey",
  "/tools/packing",
  "/tools/my-trip",
  "/guides",
  "/guides/tickets",
  "/guides/tickets?edition=winter",
  "/guides/tickets?edition=brasil",
  "/guides/belgium",
  "/guides/winter",
  "/guides/brasil",
  "/guides/general",
  "/ask",
];

const ROUTES = [...STATIC_ROUTES, ...allChapters().map((chapter) => chapterPath(chapter))];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const route of ROUTES) {
  test(`axe: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
