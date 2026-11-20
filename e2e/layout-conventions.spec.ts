import { expect, test, type Page } from "@playwright/test";

/**
 * Layout-convention checks for the reading pages in this workstream.
 *
 * The unit tests in each page's `page.test.tsx` guard the markup: one `GoldDivider`
 * per boundary, no two rules in a row, no divider against a bordered element. Those
 * cannot see a fault that lives in a stylesheet, and most of the faults the owner
 * reported were exactly that: a section `border-bottom` sitting 20px above a gold
 * divider, a card with no top margin after a grid, an inset missing at 320px.
 *
 * Everything here is measured in a real browser, so a rule set in CSS is caught.
 * The assertions are written against the convention in the wave 6 common brief
 * rather than against particular pixel values, so a page can keep its own rhythm.
 */

/** Routes owned by this workstream. */
const ROUTES = [
  "/about",
  "/accessibility",
  "/community",
  "/radio",
  "/guides",
  "/guides/belgium",
  "/guides/belgium/tickets",
  "/guides/tickets",
] as const;

/** Widths the brief requires: desktop, tablet, large phone, small phone. */
const WIDTHS = [1280, 900, 390, 320] as const;

/** Every element in the page column that draws a horizontal rule across most of it. */
async function pageRules(page: Page): Promise<
  { kind: "divider" | "border"; top: number; bottom: number; label: string }[]
> {
  return page.evaluate(() => {
    const main = document.getElementById("main");
    if (main === null) return [];
    const mainWidth = main.getBoundingClientRect().width;
    const out: { kind: "divider" | "border"; top: number; bottom: number; label: string }[] = [];

    for (const element of Array.from(main.querySelectorAll("*"))) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const isDivider = element.classList.contains("tml-divider");
      const topBorder = Number.parseFloat(style.borderTopWidth) || 0;
      const bottomBorder = Number.parseFloat(style.borderBottomWidth) || 0;

      if (isDivider) {
        out.push({
          kind: "divider",
          top: rect.top + window.scrollY,
          bottom: rect.bottom + window.scrollY,
          label: "GoldDivider",
        });
        continue;
      }

      // Only rules that read as a page-level break: at least half the column wide, and
      // taller than a table row (a row hairline is inside a card and not a break).
      if (rect.width < mainWidth * 0.5) continue;
      if (topBorder > 0 && rect.height > 40) {
        out.push({
          kind: "border",
          top: rect.top + window.scrollY,
          bottom: rect.top + window.scrollY,
          label: `${element.tagName.toLowerCase()}.${String(element.className).split(" ")[0]} (border-top)`,
        });
      }
      if (bottomBorder > 0 && rect.height > 40) {
        out.push({
          kind: "border",
          top: rect.bottom + window.scrollY,
          bottom: rect.bottom + window.scrollY,
          label: `${element.tagName.toLowerCase()}.${String(element.className).split(" ")[0]} (border-bottom)`,
        });
      }
    }

    return out.sort((a, b) => a.top - b.top);
  });
}

/** Waits until the route's stylesheet has applied, so measurements are not taken on bare HTML. */
async function waitForStyles(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const body = getComputedStyle(document.body);
        return body.backgroundColor !== "rgba(0, 0, 0, 0)";
      },
      { timeout: 15000 },
    )
    .catch(() => {});
}

for (const route of ROUTES) {
  test.describe(`${route}`, () => {
    for (const width of WIDTHS) {
      test(`no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await waitForStyles(page);

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        // A 1px tolerance covers sub-pixel rounding on fractional device ratios.
        expect(
          overflow.scrollWidth,
          `${route} scrolls sideways at ${width}px`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);
      });

      test(`keeps the page inset at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await waitForStyles(page);

        const measured = await page.evaluate(() => {
          const main = document.getElementById("main");
          if (main === null) return null;
          // The first real text on the page, which must start on the page's own inset.
          const heading = main.querySelector("h1");
          if (heading === null) return null;
          return {
            mainLeft: main.getBoundingClientRect().left,
            headingLeft: heading.getBoundingClientRect().left,
          };
        });

        expect(measured).not.toBeNull();
        // 20px is the brief's minimum at 320px, 24px from 390px.
        const minimum = width >= 390 ? 24 : 20;
        const inset = (measured?.headingLeft ?? 0) - (measured?.mainLeft ?? 0);
        expect(inset, `${route}: first heading is ${inset}px from the page edge`).toBeGreaterThanOrEqual(
          minimum - 1,
        );
      });

      test(`keeps content clear of the sticky header at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await waitForStyles(page);

        const gap = await page.evaluate(() => {
          const main = document.getElementById("main");
          const header = document.querySelector("header");
          if (main === null || header === null) return null;
          const kicker = main.querySelector("h1");
          if (kicker === null) return null;
          return {
            headerBottom: header.getBoundingClientRect().bottom,
            firstContentTop: kicker.getBoundingClientRect().top,
          };
        });

        expect(gap).not.toBeNull();
        const clearance = (gap?.firstContentTop ?? 0) - (gap?.headerBottom ?? 0);
        // 48px on a phone, 64px from 900px, per the spacing convention.
        const minimum = width >= 900 ? 64 : 48;
        expect(clearance, `${route}: ${clearance}px below the header at ${width}px`).toBeGreaterThanOrEqual(
          minimum - 1,
        );
      });
    }

    test("never puts two rules within 12px of each other", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(route);
      await page.waitForLoadState("networkidle");
        await waitForStyles(page);

      const rules = await pageRules(page);
      const clashes: string[] = [];

      for (let index = 1; index < rules.length; index += 1) {
        const previous = rules[index - 1];
        const current = rules[index];
        if (previous === undefined || current === undefined) continue;
        // Compare the actual rule lines, not the box edges of a divider's 40px ornament.
        const previousLine = previous.kind === "divider" ? (previous.top + previous.bottom) / 2 : previous.top;
        const currentLine = current.kind === "divider" ? (current.top + current.bottom) / 2 : current.top;
        const distance = Math.abs(currentLine - previousLine);
        // A card's top and bottom border on a short card can be closer than 12px without
        // being two breaks; only a page-level rule next to another counts.
        if (distance < 12) {
          clashes.push(`${previous.label} at ${Math.round(previousLine)} and ${current.label} at ${Math.round(currentLine)} (${Math.round(distance)}px)`);
        }
      }

      expect(clashes, `${route}: stacked rules`).toEqual([]);
    });

    test("gives a GoldDivider equal space above and below", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(route);
      await page.waitForLoadState("networkidle");
        await waitForStyles(page);

      const spacing = await page.evaluate(() => {
        const main = document.getElementById("main");
        if (main === null) return [];
        const out: { above: number; below: number }[] = [];
        for (const divider of Array.from(main.querySelectorAll(":scope > .tml-divider"))) {
          const previous = divider.previousElementSibling;
          const next = divider.nextElementSibling;
          if (previous === null || next === null) continue;
          const rect = divider.getBoundingClientRect();
          out.push({
            above: rect.top - previous.getBoundingClientRect().bottom,
            below: next.getBoundingClientRect().top - rect.bottom,
          });
        }
        return out;
      });

      for (const gap of spacing) {
        // Both margins count, so a difference here is a divider that leans towards one
        // section. 2px covers a section that ends on a line box rather than a card.
        expect(
          Math.abs(gap.above - gap.below),
          `${route}: ${Math.round(gap.above)}px above, ${Math.round(gap.below)}px below`,
        ).toBeLessThanOrEqual(2);
      }
    });

    test("leaves at least 16px between neighbouring cards", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(route);
      await page.waitForLoadState("networkidle");
        await waitForStyles(page);

      const tooTight = await page.evaluate(() => {
        const main = document.getElementById("main");
        if (main === null) return [];
        // Cards are bordered, rounded boxes with their own padding: any element with a
        // border and a radius, which is how every card on the site is drawn. Table cells
        // are excluded: their hairlines are row separators, not card edges, and two cells
        // on one row share a y position rather than stacking.
        const cards = Array.from(main.querySelectorAll("*")).filter((element) => {
          if (element.closest("table") !== null) return false;
          const style = getComputedStyle(element);
          return (
            Number.parseFloat(style.borderTopWidth) > 0 &&
            Number.parseFloat(style.borderTopLeftRadius) >= 10 &&
            element.getBoundingClientRect().height > 40
          );
        });

        const faults: string[] = [];
        for (let index = 0; index < cards.length; index += 1) {
          const a = cards[index];
          if (a === undefined) continue;
          const ar = a.getBoundingClientRect();
          for (let other = index + 1; other < cards.length; other += 1) {
            const b = cards[other];
            if (b === undefined) continue;
            if (a.contains(b) || b.contains(a)) continue;
            const br = b.getBoundingClientRect();
            const horizontalOverlap = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
            if (horizontalOverlap <= 1) continue;
            // Only stacked elements count. Two chips on one row are a segmented control
            // with a deliberate small gap, not two cards that need separating.
            const stacked = Math.abs(ar.top - br.top) > 8;
            if (!stacked) continue;
            const verticalGap = br.top - ar.bottom;
            if (verticalGap > 0 && verticalGap < 16) {
              faults.push(
                `${a.tagName.toLowerCase()}.${String(a.className).split(" ")[0]} to ${b.tagName.toLowerCase()}.${String(b.className).split(" ")[0]}: ${Math.round(verticalGap)}px`,
              );
            }
          }
        }
        return faults;
      });

      expect(tooTight, `${route}: cards closer than 16px`).toEqual([]);
    });
  });
}

test.describe("the closing note on the reading pages", () => {
  for (const route of ["/about", "/accessibility"] as const) {
    test(`${route} aligns its closing note with the page column`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(route);
      await page.waitForLoadState("networkidle");
        await waitForStyles(page);

      const alignment = await page.evaluate(() => {
        const main = document.getElementById("main");
        if (main === null) return null;
        const heading = main.querySelector("h1");
        // The closing note is the last block in the column on both pages.
        const closing = main.lastElementChild;
        if (heading === null || closing === null) return null;
        const closingText = closing.querySelector("p") ?? closing;
        return {
          headingLeft: heading.getBoundingClientRect().left,
          closingLeft: closingText.getBoundingClientRect().left,
        };
      });

      expect(alignment).not.toBeNull();
      // The fault the owner reported was a note at the page's left edge while every
      // other block sat on the gutter. 2px covers a border-box rounding difference.
      expect(
        Math.abs((alignment?.closingLeft ?? 0) - (alignment?.headingLeft ?? 0)),
        `${route}: closing note starts at ${alignment?.closingLeft}, page text at ${alignment?.headingLeft}`,
      ).toBeLessThanOrEqual(2);
    });
  }
});
