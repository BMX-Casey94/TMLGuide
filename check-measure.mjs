import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.setViewportSize({ width: 1280, height: 1000 });

for (const route of ["/accessibility", "/about", "/radio", "/community"]) {
  await page.goto(`http://localhost:3200${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => {
    const main = document.getElementById("main");
    const out = [];
    for (const p of main.querySelectorAll("p")) {
      const text = (p.textContent ?? "").trim();
      if (text.length < 120) continue;
      const r = p.getBoundingClientRect();
      // Measure the rendered character width with a Range over the first line only.
      const style = getComputedStyle(p);
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font}`;
      probe.textContent = "x".repeat(100);
      document.body.appendChild(probe);
      const charW = probe.getBoundingClientRect().width / 100;
      probe.remove();
      out.push({ chars: Math.round(r.width / charW), width: Math.round(r.width) });
    }
    return out.slice(0, 6);
  });
  console.log(route, JSON.stringify(data));
}

await browser.close();
