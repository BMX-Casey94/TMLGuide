import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const shots = [
  ["/about", 1280, "about-1280"],
  ["/accessibility", 1280, "accessibility-1280"],
  ["/community", 1280, "community-1280"],
  ["/radio", 1280, "radio-1280"],
  ["/guides/tickets", 1280, "tickets-1280"],
  ["/accessibility", 390, "accessibility-390"],
];

for (const [route, width, name] of shots) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`http://localhost:3200${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `after-${name}.png`, fullPage: false });
  console.log(`after-${name}.png`);
}

await browser.close();
