import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The accessibility toolbar, end to end against a production build.
 *
 * The trigger exists twice in the DOM — once in the header and once as the last cell of the mobile
 * tab bar — and each is display:none at the other breakpoint, so every locator starts from the one
 * that is actually visible. That keeps a single spec working for both Playwright projects rather
 * than branching on the viewport.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

function visibleTrigger(page: Page) {
  return page.locator('[aria-controls="a11y-settings-panel"]:visible');
}

function panel(page: Page) {
  return page.locator("#a11y-settings-panel");
}

/** The panel's own polite live region. The page has several other live regions; this one is ours. */
function announcement(page: Page) {
  return panel(page).locator('[role="status"]');
}

async function openPanel(page: Page) {
  const trigger = visibleTrigger(page);
  await expect(trigger).toHaveCount(1);
  await trigger.click();
  await expect(panel(page)).toHaveAttribute("open", "");
  return trigger;
}

test.describe("opening and closing", () => {
  test("opens from the visible trigger and names itself", async ({ page }) => {
    await page.goto("/");
    const trigger = visibleTrigger(page);

    await expect(trigger).toHaveAccessibleName("Accessibility settings");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await trigger.click();

    await expect(panel(page)).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Accessibility settings" })).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  test("shuts on Escape and returns focus to the trigger", async ({ page }) => {
    await page.goto("/");
    const trigger = await openPanel(page);

    await page.keyboard.press("Escape");

    await expect(panel(page)).not.toHaveAttribute("open", "");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("shuts on the close button and returns focus to the trigger", async ({ page }) => {
    await page.goto("/");
    const trigger = await openPanel(page);

    await page.getByRole("button", { name: "Close accessibility settings" }).click();

    await expect(panel(page)).not.toHaveAttribute("open", "");
    await expect(trigger).toBeFocused();
  });

  test("moves focus inside the panel when it opens", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);

    const inside = await page.evaluate(() => {
      const dialog = document.getElementById("a11y-settings-panel");
      return dialog !== null && dialog.contains(document.activeElement);
    });
    expect(inside).toBe(true);
  });
});

test.describe("a chosen text size", () => {
  test("applies immediately, is announced, and survives a reload", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);

    await page.getByRole("radio", { name: "130%" }).check();

    const root = page.locator("html");
    await expect(root).toHaveAttribute("data-a11y-text", "130");
    await expect(announcement(page)).toHaveText("Text size set to 130 percent");

    // The computed root font size follows the attribute, so text really is larger. Measured against
    // the same document at 100 percent rather than against a hard-coded 16px, because a reader's
    // own browser default is deliberately honoured.
    const ratio = await page.evaluate(() => {
      const root = document.documentElement;
      const current = Number.parseFloat(getComputedStyle(root).fontSize);
      const saved = root.getAttribute("data-a11y-text");
      root.setAttribute("data-a11y-text", "100");
      const baseline = Number.parseFloat(getComputedStyle(root).fontSize);
      if (saved !== null) root.setAttribute("data-a11y-text", saved);
      return current / baseline;
    });
    expect(ratio).toBeCloseTo(1.3, 2);

    await page.reload();

    // The boot script applies it before paint, so it is set on load without opening the panel.
    await expect(page.locator("html")).toHaveAttribute("data-a11y-text", "130");
    await expect(panel(page)).not.toHaveAttribute("open", "");
  });

  test("is restored in the panel's own controls after a reload", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);
    await page.getByRole("radio", { name: "150%" }).check();
    await page.keyboard.press("Escape");
    await page.reload();

    await openPanel(page);
    await expect(page.getByRole("radio", { name: "150%" })).toBeChecked();
  });

  test("Reset puts everything back and clears the stored choice", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);

    await page.getByRole("radio", { name: "150%" }).check();
    await page.getByRole("radio", { name: "High" }).check();
    await page.getByRole("button", { name: "Reset to defaults" }).click();

    const root = page.locator("html");
    await expect(root).toHaveAttribute("data-a11y-text", "100");
    await expect(root).toHaveAttribute("data-a11y-contrast", "standard");
    await expect(announcement(page)).toHaveText(
      "Accessibility settings reset to defaults",
    );

    const stored = await page.evaluate(() => window.localStorage.getItem("tml-a11y-prefs"));
    expect(stored === null ? null : JSON.parse(stored)).toEqual({
      textSize: 100,
      spacing: "normal",
      contrast: "standard",
      motion: "system",
      links: "off",
      font: "default",
    });
  });
});

test.describe("no flash of the wrong settings", () => {
  test("a stored preference is on <html> in the first painted frame", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.setItem(
        "tml-a11y-prefs",
        JSON.stringify({
          textSize: 150,
          spacing: "relaxed",
          contrast: "high",
          motion: "reduce",
          links: "on",
          font: "readable",
        }),
      );
    });

    await page.goto("/", { waitUntil: "commit" });

    // The inline script runs during parsing, so the attributes are present as soon as the document
    // exists — before React, and before any paint the visitor could see.
    await expect(page.locator("html")).toHaveAttribute("data-a11y-contrast", "high", {
      timeout: 2000,
    });
    await expect(page.locator("html")).toHaveAttribute("data-a11y-font", "readable");
  });

  test("a corrupt stored value falls back to the defaults without an error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await page.evaluate(() => window.localStorage.setItem("tml-a11y-prefs", "{not json"));
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-a11y-text", "100");
    await expect(page.locator("html")).toHaveAttribute("data-a11y-contrast", "standard");
    expect(errors).toEqual([]);
  });
});

test.describe("keyboard operation", () => {
  test("reaches every group with Tab and changes a value with the arrow keys", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);

    // The first Tab from the dialog lands on the close button; the radios follow.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close accessibility settings" })).toBeFocused();

    await page.getByRole("radio", { name: "100%" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "115%" })).toBeChecked();
    await expect(announcement(page)).toHaveText("Text size set to 115 percent");
  });

  test("keeps Tab inside the panel", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);

    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press("Tab");
    }

    const inside = await page.evaluate(() => {
      const dialog = document.getElementById("a11y-settings-panel");
      return dialog !== null && dialog.contains(document.activeElement);
    });
    expect(inside).toBe(true);
  });
});

test.describe("automated WCAG scan", () => {
  test("the page with the panel open has no violations", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });

  test("the page in high contrast with the panel open has no violations", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);
    await page.getByRole("radio", { name: "High" }).check();
    await expect(page.locator("html")).toHaveAttribute("data-a11y-contrast", "high");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });

  test("the accessibility statement page has no violations", async ({ page }) => {
    await page.goto("/accessibility");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const summary = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
});

test.describe("layout", () => {
  for (const width of [1280, 900, 390]) {
    test(`exactly one trigger is visible and the header is not cramped at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");

      // The header button and the dock cell are never both on screen: the dock is hidden from
      // 900px and the header button below it, so there is always exactly one control to reach.
      await expect(visibleTrigger(page)).toHaveCount(1);

      // The header row holds the logo, five tabs, the search pill and the trigger without
      // overflowing its own box, and the search field keeps usable width rather than collapsing.
      const header = await page.evaluate(() => {
        const row = document.querySelector("header")?.firstElementChild?.firstElementChild;
        const search = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (!row || !search) return null;
        const box = row.getBoundingClientRect();
        return {
          rowScroll: Math.round(row.scrollWidth),
          rowClient: Math.round(row.clientWidth),
          rowLeft: Math.round(box.left),
          rowRight: Math.round(box.right),
          searchWidth: Math.round(search.getBoundingClientRect().width),
        };
      });

      expect(header).not.toBeNull();
      expect(header!.rowScroll).toBeLessThanOrEqual(header!.rowClient);
      expect(header!.rowLeft).toBeGreaterThanOrEqual(0);
      expect(header!.rowRight).toBeLessThanOrEqual(width);
      // From 900px the five tabs join the row and the trigger takes its 44px, so the field keeps
      // enough room for its icon and a short query. Below 900px the header trigger is not rendered
      // at all — the dock carries it — so the field keeps the width it has always had there (about
      // 54px, because the edition switcher shares the pill); this asserts only that it is still
      // present and not collapsed to zero.
      if (width >= 900) {
        expect(header!.searchWidth).toBeGreaterThanOrEqual(40);
      } else {
        expect(header!.searchWidth).toBeGreaterThan(20);
      }
    });
  }

  test("the panel fits the viewport and the page does not scroll sideways", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);

    // `scrollWidth` is not a usable test here: the decorative butterfly trail is deliberately
    // clipped by its section and still reports past the viewport edge, which is true of the site
    // without this panel too. What matters is that the document cannot actually be scrolled
    // sideways while the panel is open.
    const scrolledX = await page.evaluate(() => {
      window.scrollTo(500, window.scrollY);
      const offset = window.scrollX;
      window.scrollTo(0, window.scrollY);
      return offset;
    });
    expect(scrolledX).toBe(0);

    const fits = await page.evaluate(() => {
      const dialog = document.getElementById("a11y-settings-panel");
      if (dialog === null) return false;
      const box = dialog.getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth && box.width > 0;
    });
    expect(fits).toBe(true);
  });

  test("the panel's own content never overflows its box", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);

    const overflowing = await page.evaluate(() => {
      const dialog = document.getElementById("a11y-settings-panel");
      if (dialog === null) return ["panel missing"];

      const box = dialog.getBoundingClientRect();
      return Array.from(dialog.querySelectorAll<HTMLElement>("*"))
        .filter((element) => {
          const inner = element.getBoundingClientRect();
          return inner.width > 0 && (inner.right > box.right + 0.5 || inner.left < box.left - 0.5);
        })
        .map((element) => `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 80));
    });

    expect(overflowing, JSON.stringify(overflowing, null, 2)).toEqual([]);
  });

  test("every control in the panel is at least 44 by 44 CSS pixels", async ({ page }) => {
    await page.goto("/");
    await openPanel(page);

    const tooSmall = await page.evaluate(() => {
      const dialog = document.getElementById("a11y-settings-panel");
      if (dialog === null) return ["panel missing"];

      const targets = Array.from(dialog.querySelectorAll<HTMLElement>("button, label"));
      return targets
        .map((element) => {
          const box = element.getBoundingClientRect();
          return { text: (element.textContent ?? "").trim().slice(0, 24), width: box.width, height: box.height };
        })
        .filter((target) => target.width < 44 || target.height < 44);
    });

    expect(tooSmall, JSON.stringify(tooSmall, null, 2)).toEqual([]);
  });
});
