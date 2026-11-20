import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The My Trip accessibility scan.
 *
 * Its own spec rather than an addition to `e2e/a11y.spec.ts`, which another
 * workstream owns. The tags match that suite: WCAG 2.2 AA plus the 2.1 additions
 * that 2.2 inherits, so a pass here means the same thing a pass there means.
 *
 * The scan runs twice: once on the empty sheet a first visit shows, and once
 * with a ticket, a package and the export panel exercised, because a control
 * that only appears after a choice is where an unlabelled field usually hides.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

for (const viewport of VIEWPORTS) {
  test(`axe: /tools/my-trip on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/tools/my-trip");
    await page.waitForLoadState("networkidle");

    // Choose a ticket and a package, so the detail panels are on the page too.
    await page.getByLabel("The ticket you hold").selectOption({ index: 1 });
    await page.getByLabel("A published accommodation package, if you booked one").selectOption({
      index: 1,
    });
    // Open the clear confirmation, which is a second interactive surface.
    await page.getByRole("button", { name: "Clear this trip" }).click();
    await page.getByRole("button", { name: "Keep it" }).click();

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
