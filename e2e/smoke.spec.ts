import { expect, test, type Page } from "@playwright/test";

/** Every width the layout is specified to hold at. 320 to 1920, per the brief. */
const WIDTHS = [320, 390, 900, 1280, 1920] as const;

/**
 * Reads the truth about horizontal scrolling at the current viewport.
 *
 * `documentElement.scrollWidth` is the layout width the page wants; comparing it
 * with `window.innerWidth` catches content that reaches past the viewport, even
 * when the scrollbar is hidden by `overflow: hidden` on a body or wrapper.
 *
 * `scrollX` after an actual scroll attempt is the behavioural half: a page can
 * report a wide `scrollWidth` and still not move (which is what a clipped,
 * purely decorative element does), and it is the movement the reader notices.
 * Both are asserted, because either one alone can be satisfied by accident.
 */
async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const before = window.scrollX;
    window.scrollTo(500, window.scrollY);
    const afterRight = window.scrollX;
    window.scrollTo(-500, window.scrollY);
    const afterLeft = window.scrollX;
    window.scrollTo(before, window.scrollY);

    return {
      innerWidth: window.innerWidth,
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      scrollXAfterAttempt: Math.max(afterRight, afterLeft),
    };
  });
}

test("home page renders a main landmark and a single h1", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main#main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("home page has no horizontal overflow at any supported width", async ({ page }) => {
  await page.goto("/");

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    // Let the resize settle before measuring the layout.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));

    const measured = await measureOverflow(page);

    expect(
      measured.scrollWidth,
      `documentElement.scrollWidth exceeds window.innerWidth at ${width}px`,
    ).toBeLessThanOrEqual(measured.innerWidth);

    expect(
      measured.scrollXAfterAttempt,
      `the page could be scrolled sideways at ${width}px`,
    ).toBe(0);
  }
});
