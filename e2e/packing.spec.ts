import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The packing list tool.
 *
 * Covers the four things this tool exists to do — tick, add, remove, reset and
 * print — plus the two claims the content rule rests on: an official item always
 * names its page, and a suggestion is always labelled as one. The accessibility
 * scan uses the same WCAG 2.2 AA tag set as the site-wide spec.
 *
 * The routes here are this spec's own: `/tools/packing` is not yet in the shared
 * route list, which the orchestrator owns.
 */

const ROUTE = "/tools/packing";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Clears the tool's own storage key so each test starts from a first visit. */
async function resetStorage(page: Page): Promise<void> {
  await page.goto(ROUTE);
  await page.evaluate(() => window.localStorage.removeItem("tml-packing-v1"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Packing list", level: 1 })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await resetStorage(page);
});

test.describe("packing list", () => {
  test("is reachable and titled", async ({ page }) => {
    await expect(page).toHaveTitle(/Packing list/);
    await expect(page.getByRole("heading", { name: "Packing list", level: 1 })).toBeVisible();
  });

  test("ticks an item, updates the live count and keeps it after a reload", async ({ page }) => {
    const first = page.getByRole("checkbox", { name: /Photo ID in the name on the bracelet/i });
    await expect(first).not.toBeChecked();

    const live = page.locator(".packing-progress__value");
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(live).toContainText(/0 of \d+ packed/);

    await first.check();
    await expect(first).toBeChecked();
    await expect(live).toContainText(/1 of \d+ packed/);

    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: /Photo ID in the name on the bracelet/i }),
    ).toBeChecked();
  });

  test("adds, persists and removes the reader's own item", async ({ page }) => {
    const field = page.getByLabel("Add your own item");
    await field.fill("  Sleep   mask  ");
    await page.getByRole("button", { name: /^Add item to your list$/ }).click();

    const own = page.getByRole("checkbox", { name: "Sleep mask" });
    await expect(own).toBeVisible();
    await expect(field).toHaveValue("");

    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Sleep mask" })).toBeVisible();

    await page.getByRole("button", { name: /^Remove Sleep mask$/ }).click();
    await expect(page.getByRole("checkbox", { name: "Sleep mask" })).toHaveCount(0);
  });

  test("refuses an empty own item in words", async ({ page }) => {
    await page.getByRole("button", { name: /^Add item to your list$/ }).click();
    await expect(page.getByText("Type the item you want to add.")).toBeVisible();
  });

  test("filters to unpacked items and back", async ({ page }) => {
    const first = page.getByRole("checkbox", { name: /Photo ID in the name on the bracelet/i });
    await first.check();

    await page.getByLabel("Show unpacked only").check();
    await expect(first).toBeHidden();

    await page.getByLabel("Show unpacked only").uncheck();
    await expect(first).toBeVisible();
  });

  test("resets every tick but keeps the reader's own items", async ({ page }) => {
    await page.getByLabel("Add your own item").fill("Earplugs");
    await page.getByRole("button", { name: /^Add item to your list$/ }).click();
    await page.getByRole("checkbox", { name: "Earplugs" }).check();
    await page.getByRole("checkbox", { name: /Photo ID in the name on the bracelet/i }).check();

    await page.getByRole("button", { name: /^Reset all ticks$/ }).click();

    await expect(page.getByRole("checkbox", { name: "Earplugs" })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Earplugs" })).toBeVisible();
  });

  test("changes edition and stay, and adds the Transportation Pass only outside the resort", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Winter" }).click();
    await expect(page.getByRole("checkbox", { name: /Helmet/i })).toBeVisible();

    const pass = page.getByRole("checkbox", { name: /Transportation Pass/i });
    await expect(pass).toHaveCount(0);

    await page.getByRole("radio", { name: /Oz 3300 or a surrounding village/i }).check();
    await expect(page.getByRole("checkbox", { name: /Transportation Pass/i })).toBeVisible();
  });

  test("says what the data does not publish rather than filling the gap", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Not published" })).toBeVisible();
    await expect(page.getByText(/No 2027 locker price or size table is published/i)).toBeVisible();

    await page.getByRole("button", { name: "Brasil" }).click();
    await expect(page.getByText(/no Brasil page listing prohibited items/i)).toBeVisible();
  });

  test("labels every suggestion as a suggestion, never as a rule", async ({ page }) => {
    const tag = page.getByText("Suggestion, not an official requirement").first();
    await expect(tag).toBeVisible();

    const row = page.locator(".packing-item[data-basis='suggestion']").first();
    await expect(row).toBeVisible();
    // A suggestion carries no rule text and no citation.
    await expect(row.locator(".packing-item__rule")).toHaveCount(0);
    await expect(row.locator("a[href^='https://']")).toHaveCount(0);
  });

  test("gives every official item a link to the page that states it", async ({ page }) => {
    const rows = page.locator(".packing-item[data-basis='official']");
    const count = await rows.count();
    expect(count).toBeGreaterThan(5);

    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      await expect(row.getByText("Official", { exact: true })).toBeVisible();
      await expect(row.locator("a[href^='https://']")).toHaveCount(1);
      await expect(row.locator(".packing-source__date")).toContainText("checked");
    }
  });

  test("offers checkboxes that are real inputs with labels and 44px targets", async ({ page }) => {
    const box = page.getByRole("checkbox", { name: /Photo ID in the name on the bracelet/i });
    const id = await box.getAttribute("id");
    expect(id).not.toBeNull();
    // The label is a real <label for>, so the row is the target rather than the box alone.
    await expect(page.locator(`label[for="${id}"]`)).toBeVisible();

    const rowBox = await page.locator(".packing-item").first().boundingBox();
    expect(rowBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("prints the checklist without the chrome", async ({ page }) => {
    await page.emulateMedia({ media: "print" });

    // The page chrome, the controls and the citation links are all removed on paper.
    await expect(page.locator(".packing-controls")).toBeHidden();
    await expect(page.locator(".tool-foot")).toBeHidden();
    await expect(page.locator(".packing-source").first()).toBeHidden();

    // The checklist itself survives, with square boxes.
    await expect(page.locator(".packing-print-head")).toBeVisible();
    await expect(page.locator(".packing-item").first()).toBeVisible();
    await expect(page.locator(".packing-item__box").first()).toBeVisible();

    const border = await page
      .locator(".packing-item__box")
      .first()
      .evaluate((element) => getComputedStyle(element).borderTopWidth);
    expect(border).not.toBe("0px");
  });

  test("prints a light sheet rather than the dark screen surface", async ({ page }) => {
    await page.emulateMedia({ media: "print" });

    /*
      A printed page must not inherit the warm-black ground: #111 text on a
      near-black page is unreadable. The browser is asked for the computed
      colour of the elements that carry the ink.
    */
    const colours = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const text = document.querySelector(".packing-item__text");
      const box = document.querySelector(".packing-item__box");
      return {
        bodyBackground: body.backgroundColor,
        bodyColour: body.color,
        textColour: text ? getComputedStyle(text).color : null,
        boxBackground: box ? getComputedStyle(box).backgroundColor : null,
      };
    });

    // White ground, near-black ink — the reverse of the screen.
    expect(colours.bodyBackground).toBe("rgb(255, 255, 255)");
    expect(colours.bodyColour).toBe("rgb(17, 17, 17)");
    expect(colours.textColour).toBe("rgb(17, 17, 17)");
    expect(colours.boxBackground).toBe("rgb(255, 255, 255)");
  });
});

test.describe("packing list accessibility", () => {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`axe: ${ROUTE} at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(ROUTE);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const summary = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
      }));
      expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
    });

    test(`does not scroll sideways at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(ROUTE);
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
