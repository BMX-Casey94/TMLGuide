import { chromium } from "@playwright/test";

/**
 * Drives the real accessibility toolbar to 150 percent text and high contrast, then
 * measures every reading page at three widths. Using the toolbar rather than setting
 * the attributes directly matters: the boot script republishes the saved preferences on
 * load, so only the store's own controls produce the state a visitor actually gets.
 */
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const routes = ["/accessibility", "/about", "/community", "/radio"];
let failures = 0;

for (const route of routes) {
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://localhost:3200${route}`, { waitUntil: "networkidle" });

    // Open the panel and choose the largest text size and the high-contrast palette.
    await page.getByRole("button", { name: "Accessibility settings" }).first().click();
    await page.getByRole("radio", { name: "150%" }).check();
    await page.getByRole("radio", { name: "High", exact: true }).check();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    const data = await page.evaluate(() => {
      const main = document.getElementById("main");
      const h1 = main?.querySelector("h1");
      const html = getComputedStyle(document.documentElement);
      return {
        textAttr: document.documentElement.getAttribute("data-a11y-text"),
        contrastAttr: document.documentElement.getAttribute("data-a11y-contrast"),
        fontSize: html.fontSize,
        creamMute: html.getPropertyValue("--cream-mute").trim(),
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        h1Width: h1 ? Math.round(h1.getBoundingClientRect().width) : null,
        overflowing: [...document.querySelectorAll("main *")].filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0) return false;
          let clipped = false;
          let p = el.parentElement;
          while (p && p !== document.body) {
            if (getComputedStyle(p).overflowX !== "visible") { clipped = true; break; }
            p = p.parentElement;
          }
          return !clipped && r.right > document.documentElement.clientWidth + 1;
        }).slice(0, 5).map((el) => `${el.tagName}.${String(el.className).split(" ")[0]}`),
      };
    });

    const problems = [];
    if (data.textAttr !== "150") problems.push(`text preference is ${data.textAttr}`);
    if (data.contrastAttr !== "high") problems.push(`contrast preference is ${data.contrastAttr}`);
    if (Number.parseFloat(data.fontSize) <= 16) problems.push(`base font not scaled (${data.fontSize})`);
    if (data.creamMute.toLowerCase() !== "#c9c1b7") problems.push(`high-contrast palette missing (${data.creamMute})`);
    if (data.scrollW > data.clientW + 1) problems.push(`overflow ${data.scrollW} > ${data.clientW}`);
    if (data.overflowing.length > 0) problems.push(`overflowing: ${data.overflowing.join(", ")}`);

    if (problems.length > 0) {
      failures += 1;
      console.log(`FAIL ${route} @${width}: ${problems.join("; ")}`);
    } else {
      console.log(`ok   ${route} @${width} | font=${data.fontSize} creamMute=${data.creamMute} h1w=${data.h1Width}`);
    }

    // Clear the saved preferences so the next route starts from the defaults.
    await page.evaluate(() => localStorage.clear());
  }
}

console.log(`\n${failures === 0 ? "ALL CLEAN at 150% text + high contrast" : `${failures} FAILURES`}`);
await browser.close();
