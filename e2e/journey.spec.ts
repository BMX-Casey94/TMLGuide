import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Journey planner.
 *
 * Two jobs. First, the behaviour a reader depends on: the controls change the
 * plan, the plan survives a reload, and a tampered stored record does not break
 * the page. Second, the claim the tool makes about itself: every source link on
 * the page resolves to an https page, prints a checked date, and opens in a new
 * tab; and every step that could carry a fare or a timetable either shows one or
 * says 2027 has not published it.
 *
 * The axe scan lives here rather than in `e2e/a11y.spec.ts`, which another
 * workstream owns.
 */

const ROUTE = "/tools/journey";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** The results region is the section headed "Your route". */
function results(page: Page) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: "Your route", level: 2 }),
  });
}

/**
 * Chooses an option the way a person does: by clicking its card.
 *
 * The card is a label wrapping a real radio, so a click anywhere on it selects the
 * option. Clicking the card rather than the input keeps the test honest about the
 * target a reader actually sees, and it is what makes the 44px target assertion
 * below meaningful.
 */
async function choose(page: Page, group: string, option: string): Promise<void> {
  const card = page.getByRole("group", { name: group }).locator("label").filter({ hasText: option });
  await card.click();
  await expect(page.getByRole("group", { name: group }).getByRole("radio", { name: option })).toBeChecked();
}

test.describe("Journey planner", () => {
  test("renders the default plan and its steps", async ({ page }) => {
    await page.goto(ROUTE);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Journey planner");
    const region = results(page);
    await expect(region).toContainText("Belgium — DreamVille, arriving by plane");
    await expect(region.getByText("Book one of the three airport shuttles")).toBeVisible();
    await expect(region.getByRole("listitem").first()).toBeVisible();
  });

  test("changes the plan when the bed changes", async ({ page }) => {
    await page.goto(ROUTE);

    await choose(page, "Where you are sleeping", "Hotel or other");
    await expect(results(page)).toContainText("a hotel off site, arriving by plane");
    await expect(results(page)).toContainText("Expect the airport shuttles not to fit a hotel");
  });

  test("switches the bed vocabulary with the edition", async ({ page }) => {
    await page.goto(ROUTE);

    await choose(page, "Edition", "Winter");

    const sleepGroup = page.getByRole("group", { name: "Where you are sleeping" });
    await expect(sleepGroup.getByLabel("Alpe d'Huez package")).toBeVisible();
    await expect(sleepGroup.getByLabel("DreamVille")).toHaveCount(0);
    await expect(sleepGroup.getByRole("radio")).toHaveCount(3);
    await expect(results(page)).toContainText("Tomorrowland Winter");
  });

  test("prints a published Winter fare with its year", async ({ page }) => {
    await page.goto(ROUTE);

    await choose(page, "Edition", "Winter");
    await choose(page, "Where you are sleeping", "Village or own booking");

    const region = results(page);
    await expect(region).toContainText("€40.00");
    await expect(region).toContainText("Transportation Pass");
    await expect(region).toContainText("2027");
  });

  test("shows the missing-fare notice on a Belgium route", async ({ page }) => {
    await page.goto(ROUTE);
    await expect(results(page).getByText("Not published for 2027").first()).toBeVisible();
  });

  test("remembers the plan across a reload", async ({ page }) => {
    await page.goto(ROUTE);

    await choose(page, "Edition", "Winter");
    await choose(page, "How you arrive", "Coach");
    await expect(results(page)).toContainText("arriving by coach");

    await page.reload();

    await expect(page.getByRole("group", { name: "Edition" }).getByLabel("Winter")).toBeChecked();
    await expect(page.getByRole("group", { name: "How you arrive" }).getByLabel("Coach")).toBeChecked();
    await expect(results(page)).toContainText("Tomorrowland Winter");
  });

  test("recovers from a tampered stored plan", async ({ page }) => {
    await page.goto(ROUTE);

    await page.evaluate(() => {
      window.localStorage.setItem("tml-journey-v1", '{"edition":"winter","sleep":"yurt"}');
    });
    await page.reload();

    await expect(page.getByRole("group", { name: "Edition" }).getByLabel("Belgium")).toBeChecked();
    await expect(page.getByText("Starting fresh")).toBeVisible();
    await expect(results(page)).toContainText("arriving by plane");
  });

  test("every source link opens in a new tab, safely, with a checked date", async ({ page }) => {
    await page.goto(ROUTE);

    const links = results(page).getByRole("link");
    /* The default Belgium plan cites the how-to-get-there page and the DreamVille
       hours, so three is the floor rather than an arbitrary count. */
    await expect(links.first()).toBeVisible();
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(3);

    for (let index = 0; index < count; index += 1) {
      const link = links.nth(index);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      const href = await link.getAttribute("href");
      expect(href?.startsWith("https://")).toBe(true);
      /* WCAG 2.5.3: the accessible name contains the visible text. */
      const visible = (await link.textContent())?.trim() ?? "";
      const accessible = (await link.getAttribute("aria-label")) ?? (await link.textContent())?.trim() ?? "";
      expect(accessible).toContain(visible.slice(0, 12));
    }

    await expect(results(page).locator("time[datetime]").first()).toBeVisible();
  });

  test("says Brasil is not offered and links its transport chapter", async ({ page }) => {
    await page.goto(ROUTE);

    const edition = page.getByRole("group", { name: "Edition" });
    await expect(edition.getByRole("radio")).toHaveCount(2);
    await expect(edition).toContainText("no verified timetable or fares are published for Parque Maeda");

    /* One link to the chapter in the page intro, one in the limits section, and
       each says something different, so neither is a bare repeat. */
    const links = page.getByRole("link", { name: "Brasil transport chapter" });
    await expect(links).toHaveCount(2);
    for (let index = 0; index < 2; index += 1) {
      await expect(links.nth(index)).toHaveAttribute("href", "/guides/brasil/transport");
    }
  });

  test("carries the independent-guide non-affiliation notice", async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.getByText(/not endorsed by Tomorrowland/i)).toBeVisible();
  });

  test.describe("layout", () => {
    const widths = [
      { name: "390", width: 390, height: 900 },
      { name: "1280", width: 1280, height: 900 },
    ];

    for (const viewport of widths) {
      test(`no horizontal overflow at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(ROUTE);
        await expect(results(page)).toBeVisible();

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(1);
      });
    }

    test("keeps touch targets at 44px or more on a phone", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(ROUTE);

      const targets = page.locator("label.journey-choice");
      const count = await targets.count();
      expect(count).toBeGreaterThan(4);

      for (let index = 0; index < count; index += 1) {
        const box = await targets.nth(index).boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test("passes an axe scan at WCAG 2.2 AA", async ({ page }) => {
    await page.goto(ROUTE);
    await page.waitForLoadState("networkidle");

    const results_ = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = results_.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });

  test("passes an axe scan with the Winter plan showing", async ({ page }) => {
    await page.goto(ROUTE);
    await choose(page, "Edition", "Winter");
    await choose(page, "Where you are sleeping", "Village or own booking");
    await page.waitForLoadState("networkidle");

    const results_ = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = results_.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
});

