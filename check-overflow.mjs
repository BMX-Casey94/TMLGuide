import { chromium } from "@playwright/test";
const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
await p.setViewportSize({ width: 320, height: 900 });
await p.goto("http://localhost:3200/about", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Accessibility settings" }).first().click();
await p.getByRole("radio", { name: "150%" }).check();
await p.keyboard.press("Escape");
await p.waitForTimeout(600);
console.log(await p.evaluate(() => {
  const main = document.getElementById("main");
  const out = [];
  const walk = (el, d) => {
    if (el.scrollWidth > el.clientWidth + 1) out.push([d, el.tagName, String(el.className).slice(0,45), el.clientWidth, el.scrollWidth]);
    if (d < 6) for (const c of el.children) walk(c, d + 1);
  };
  walk(main, 0);
  return JSON.stringify({ sw: document.documentElement.scrollWidth, out: out.slice(0,10) }, null, 1);
}));
await b.close();
