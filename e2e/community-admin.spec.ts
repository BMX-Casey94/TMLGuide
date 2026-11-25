import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * WCAG 2.2 AA scan of the community and admin track.
 *
 * Separate from `a11y.spec.ts` because these routes are not in that file's route
 * list: `/community/news` and `/admin` belong to this workstream. Automated checks
 * find roughly a third of real issues, so a pass here is a floor, not a claim of
 * conformance.
 *
 * `/admin` is scanned in its signed-out state only. Reaching the editor needs a
 * real Supabase project with an administrator account and a completed second
 * factor, which a test run cannot provision; the states it can reach are covered
 * by the unit tests in `src/components/admin`.
 */
const ROUTES = ["/community/news", "/admin"];

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

test("the news page says why it is empty rather than inventing an article", async ({ page }) => {
  await page.goto("/community/news");
  await page.waitForLoadState("networkidle");

  /*
    With no news database configured, the page must state that plainly. The test
    accepts the not-configured heading specifically: a page that said "nothing has
    been published" here would be claiming a fact about a publication it does not
    have. What must never happen is a placeholder article appearing.
  */
  await expect(page.getByRole("heading", { name: "News is not switched on yet" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
});

test("the admin console is not indexed", async ({ page }) => {
  await page.goto("/admin");
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toContain("noindex");
  expect(robots).toContain("nofollow");
});

test("the community pages do not scroll sideways at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });

  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${route} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
