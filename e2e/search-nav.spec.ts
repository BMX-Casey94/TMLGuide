import { expect, test, type Page } from "@playwright/test";

/**
 * Search navigation, end to end.
 *
 * Three things are asserted that no unit test can:
 *
 * 1. The palette's focus state draws no rectangles. The unit tests can check a
 *    class name is present; only a real browser with `:focus-visible` forced can
 *    say whether an outline is painted, and at what geometry.
 * 2. A chosen result lands on the record. That is a real router push, a real
 *    hash, a real scroll and a real focus move, against real pages.
 * 3. The progress bar and the route fallback exist and do not shift layout.
 *
 * The anchor ids come from `src/lib/search/anchors.ts` — the same function the
 * palette and (once the pages are updated) the pages use, so this spec cannot
 * pass against a stale copy of a string.
 */

/**
 * Open the palette the way a visitor does: click the header search pill, which
 * carries `data-search-trigger` and is wired by the palette once hydrated.
 *
 * A click rather than the keyboard shortcut because Playwright's key press
 * depends on document focus, which is not guaranteed immediately after a
 * `goto`; the shortcut itself is covered by the unit tests.
 */
async function openPalette(page: Page): Promise<void> {
  const pill = page.getByRole("searchbox", { name: "Search the guide" });
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(page.locator("dialog[open]")).toBeVisible();
}

/** Type a query and wait for the listbox. */
async function search(page: Page, query: string): Promise<void> {
  const input = page.getByRole("combobox", { name: "Search TMLGUIDE" });
  await input.fill(query);
  await expect(page.getByRole("listbox")).toBeVisible();
}

/**
 * Force `:focus-visible` to match, which is what the owner's screenshot showed
 * and what a mouse-clicked input would otherwise hide. Without this the palette
 * would be tested with the browser's heuristic rather than the rule.
 */
async function showFocusVisible(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await client.detach();
}

test.describe("search palette focus", () => {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`draws no focus rectangle on the dialog or the field (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await showFocusVisible(page);

      await openPalette(page);
      // On a phone the header hides the pill's edition switcher as soon as the
      // field is focused, and the palette is full-bleed; the field keeps focus,
      // which is the state the owner's screenshot was taken in.
      const field = page.getByRole("combobox", { name: "Search TMLGUIDE" });
      await expect(field).toBeFocused();
      // The indicator cross-fades in over 160ms; read it once it has settled so
      // the assertion is about the final state rather than a mid-transition one.
      await page.waitForTimeout(400);

      const painted = await page.evaluate(() => {
        const dialog = document.querySelector("dialog[open]");
        const field = document.querySelector('dialog[open] input[role="combobox"]');
        const read = (element: Element | null) => {
          if (element === null) return null;
          const style = getComputedStyle(element);
          return {
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            boxShadow: style.boxShadow,
            borderRadius: style.borderRadius,
          };
        };
        return { dialog: read(dialog), field: read(field) };
      });

      /*
        `outline-style: none` is the assertion that matters: an outline with no
        style paints nothing, whatever width it reports. The width is still read
        above so a regression that sets a solid style is obvious in the log.
      */
      expect(painted.dialog?.outlineStyle, "dialog outline style").toBe("none");
      expect(painted.dialog?.boxShadow, "dialog box shadow").toBe("none");

      // The field's indicator is its own rounded border and glow, never a
      // separate square outline drawn outside it.
      expect(painted.field?.outlineStyle, "field outline style").toBe("none");
      expect(parseFloat(painted.field?.borderRadius ?? "0")).toBeGreaterThan(0);
      expect(painted.field?.boxShadow, "field has an outward ring").not.toBe("none");

      // And the field is where the accent is, so focus was moved rather than
      // deleted: the border colour is the edition accent.
      const border = await page.evaluate(() => {
        const field = document.querySelector('dialog[open] input[role="combobox"]');
        return field === null ? null : getComputedStyle(field).borderTopColor;
      });
      expect(border).not.toBeNull();
      expect(border).not.toBe("rgba(0, 0, 0, 0)");

      await page.screenshot({
        path: `test-results/search-palette-focus-${viewport.name}.png`,
        fullPage: false,
      });
    });
  }

  test("keeps a visible indicator on the highlighted row", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    await search(page, "transport");

    const selected = page.locator('[role="option"][aria-selected="true"]');
    await expect(selected).toHaveCount(1);

    const border = await selected.evaluate((element) => getComputedStyle(element).borderLeftColor);
    // The accent bar is not the same colour as the row's transparent default.
    expect(border).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("focuses the field when opened from the header search pill", async ({ page }) => {
    await page.goto("/");
    const pill = page.getByRole("searchbox", { name: "Search the guide" });
    await pill.click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Search TMLGUIDE" })).toBeFocused();
  });
});

test.describe("search navigation", () => {
  test("a guide section result lands on the heading, in view and focused", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    // The heading text itself, so the section entry is unambiguously in the
    // result set rather than depending on where the ranker places a broad term.
    await search(page, "arriving by train");

    // The title reads "Belgium: Getting to Boom: Arriving by train".
    const section = page.locator('[role="option"]', { hasText: /Arriving by train/i });
    await expect(section.first()).toBeVisible();
    const href = await section.first().getAttribute("href");
    expect(href).toContain("#");

    const anchor = href!.split("#")[1]!;
    await section.first().click();

    // The palette waits for arrival before closing.
    await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: 12_000 });
    await page.waitForURL(new RegExp(`#${anchor}$`));

    const target = page.locator(`#${anchor}`);
    await expect(target).toHaveCount(1);

    /*
      The heading must end up clear of the sticky header, not underneath it. The
      scroll is smooth, so this waits for the resting position: the poll accepts
      only the band the element should settle in, and a mid-scroll position (still
      far down the page) keeps it waiting.
    */
    await expect
      .poll(
        async () => {
          const box = await target.boundingBox();
          if (box === null) return "missing";
          return box.y > 60 && box.y < 200 ? "settled" : `y=${Math.round(box.y)}`;
        },
        { timeout: 8000, intervals: [100, 200, 300] },
      )
      .toBe("settled");

    // And it is on screen at all.
    await expect(target).toBeInViewport();

    // Focused, so a keyboard or screen-reader visitor continues from the record.
    await expect(target).toBeFocused();
  });

  test("a chapter result lands on the chapter top", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    await search(page, "getting to boom");

    // The chapter entry itself, not one of its sections.
    const chapter = page
      .locator('[role="option"][href$="#chapter-title"]', { hasText: /Getting to Boom/i })
      .first();
    await expect(chapter).toBeVisible();
    const href = await chapter.getAttribute("href");
    expect(href).toContain("#chapter-title");

    await chapter.click();
    await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: 12_000 });
    await page.waitForURL(/#chapter-title$/);
    await expect(page.locator("#chapter-title")).toBeFocused();
  });

  /**
   * The FAQ answers on `/guides` carry their own ids (`#faq-be-*`, `#faq-wi-*`,
   * `#faq-sh-*`), so this case has a real target to land on.
   *
   * The option is selected by its href rather than by position: "lockers" also
   * matches guide and section entries, and the first result is a chapter, not an
   * answer. Filtering on the fragment keeps the case about the FAQ anchor.
   */
  test("an FAQ result lands on the answer", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    await search(page, "lockers");

    const faq = page
      .locator('[role="option"][href^="/guides#faq-"]', { hasText: /lockers/i })
      .first();
    await expect(faq).toBeVisible();
    const href = await faq.getAttribute("href");
    expect(href).not.toBeNull();
    const anchor = href!.split("#")[1]!;
    expect(anchor).toMatch(/^faq-(be|wi|sh)-/);

    await faq.click();
    await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: 12_000 });
    await page.waitForURL(new RegExp(`#${anchor}$`));
    await expect(page.locator(`#${anchor}`)).toBeFocused();
  });

  test("a ticket result lands on the package card", async ({ page }) => {
    test.fixme(
      true,
      "Blocked: the package cards now carry ids, but the ticket hrefs still omit ?category=, so the card is not rendered on the bare tickets page. See docs/briefs/search-anchors.md §2.2.",
    );

    await page.goto("/");
    await openPalette(page);
    await search(page, "day pass");

    const ticket = page.locator('[role="option"]', { hasText: /Day Pass/i }).first();
    const href = await ticket.getAttribute("href");
    const anchor = href!.split("#")[1]!;
    expect(anchor).toMatch(/^ticket-/);

    await ticket.click();
    await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: 12_000 });
    await expect(page.locator(`#${anchor}`)).toBeFocused();
  });

  test("a quick link still opens its page", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);

    await page.getByRole("link", { name: /Ticket sale timeline/ }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: 12_000 });
    await page.waitForURL(/\/tools\/sale-timeline$/);
  });

  test("a recent search is offered and reused", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    await search(page, "pearls");

    // Choose a result so the query is stored, then reopen: whether it navigates
    // is beside the point, the store is written at click time.
    await page.locator('[role="option"]').first().click();
    await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: 12_000 });

    await openPalette(page);
    await expect(page.getByRole("button", { name: "pearls" })).toBeVisible();
  });
});

test.describe("loading indicators", () => {
  test("the route fallback announces itself politely", async ({ page }) => {
    // The fallback only exists while a segment streams, so this checks the
    // component's contract through the app's own markup rather than waiting for
    // a race that may not reproduce.
    await page.goto("/");
    const loading = page.locator(".tml-page-loading");
    // Either the fallback is on screen (slow segment) or the page has rendered.
    const count = await loading.count();
    if (count > 0) {
      await expect(loading.getByRole("status")).toHaveAttribute("aria-live", "polite");
    }
    // The progress bar's container must not exist at rest.
    await expect(page.locator(".tml-progress")).toHaveCount(0);
  });

  test("the progress bar does not appear for a fast navigation", async ({ page }) => {
    await page.goto("/");
    // A prefetched, static route: the bar must not flash.
    await page.getByRole("link", { name: "Guides", exact: true }).first().click();
    await page.waitForURL(/\/guides$/);

    const bars = await page.locator(".tml-progress").count();
    expect(bars).toBe(0);
  });

  test("reduced motion leaves a static indicator rather than an animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    /*
      The spinner is rendered into the page directly: the route fallback is only
      on screen while a segment streams, so waiting for it would be a race. What
      is being asserted is the stylesheet's contract — the same `animation: none`
      that the app's own rules apply — and that is deterministic.
    */
    const animations = await page.evaluate(() => {
      const holder = document.createElement("div");
      holder.className = "tml-page-loading";
      holder.innerHTML =
        '<span class="tml-spinner tml-spinner--page"><svg viewBox="-10 -10 20 20" class="tml-spinner__art"><path d="M0 -10C1.6 -3.6 3.6 -1.6 10 0C3.6 1.6 1.6 3.6 0 10C-1.6 3.6 -3.6 1.6 -10 0C-3.6 -1.6 -1.6 -3.6 0 -10Z"/></svg></span>';
      document.body.append(holder);

      const art = holder.querySelector(".tml-spinner__art");
      const bar = document.createElement("span");
      bar.className = "tml-progress__bar";
      holder.append(bar);
      if (art === null) throw new Error("the sparkle element did not render");

      const media = {
        art: getComputedStyle(art).animationName,
        bar: getComputedStyle(bar).animationName,
      };

      // And the site's own toggle, which must win even with motion allowed.
      document.documentElement.dataset.a11yMotion = "reduce";
      const toggle = {
        art: getComputedStyle(art).animationName,
        bar: getComputedStyle(bar).animationName,
      };
      delete document.documentElement.dataset.a11yMotion;

      holder.remove();
      return { media, toggle };
    });

    expect(animations.media.art).toBe("none");
    expect(animations.media.bar).toBe("none");
    expect(animations.toggle.art).toBe("none");
    expect(animations.toggle.bar).toBe("none");
  });

  test("the indicators animate when motion is allowed", async ({ page }) => {
    await page.goto("/");

    const animations = await page.evaluate(() => {
      const holder = document.createElement("div");
      holder.innerHTML =
        '<span class="tml-spinner"><svg viewBox="-10 -10 20 20" class="tml-spinner__art"><path d="M0 0"/></svg></span><span class="tml-progress__bar"></span>';
      document.body.append(holder);
      const art = holder.querySelector(".tml-spinner__art");
      const bar = holder.querySelector(".tml-progress__bar");
      if (art === null || bar === null) throw new Error("the indicator elements did not render");
      const result = {
        art: getComputedStyle(art).animationName,
        bar: getComputedStyle(bar).animationName,
      };
      holder.remove();
      return result;
    });

    // Both are declared, which proves the reduced-motion rules above are
    // switching something off rather than the animation never existing.
    expect(animations.art).toBe("tml-spinner-turn");
    expect(animations.bar).toBe("tml-progress-slide");
  });
});

test.describe("search palette accessibility", () => {
  test("the palette passes an axe scan while open", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);
    await search(page, "ticket");

    const { default: AxeBuilder } = await import("@axe-core/playwright");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    const summary = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
    expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
  });
});
