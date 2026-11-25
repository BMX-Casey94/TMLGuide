// Recomputes the cost table in docs/ai/provider-spike.md from live prices.
// Every figure printed here is derived from the constants below; change a
// constant only with a dated source URL in the comment beside it.

// --- workload assumption (must match the document) ---
const IN = 2500; // input tokens per question
const OUT = 350;  // output tokens per question
const QS = 1000;

// FX fetched 2026-11-25 from https://open.er-api.com/v6/latest/GBP
const USD_PER_GBP = 1.310158;
const EUR_PER_GBP = 1.195587;

const perQs = (inUsdPerM, outUsdPerM) => ((IN / 1e6) * inUsdPerM + (OUT / 1e6) * outUsdPerM) * QS;
const gbp = (usd) => usd / USD_PER_GBP;

const rows = [
  // Mistral, live https://docs.mistral.ai/inference/pricing 2026-11-25
  ["Mistral Small 4, global", perQs(0.15, 0.6)],
  ["Mistral Small 4, EU regional (+10%)", perQs(0.165, 0.66)],
  ["Ministral 3 14B, EU regional (+10%)", perQs(0.22, 0.22)],
  ["Mistral Large 4, EU regional (+10%)", perQs(0.77, 2.31)],

  // Azure Retail Prices API, swedencentral, 2026-11-25 (USD meters)
  ["Azure gpt-4.1-mini, Data Zone", perQs(0.44, 1.76)],
  ["Azure gpt-4.1-mini, Regional", perQs(0.484, 1.936)],
  ["Azure gpt-5.4-mini, Global", perQs(0.75, 4.5)],
  ["Azure gpt-5.4-nano, Global", perQs(0.2, 1.25)],

  // DeepSeek, live https://api-docs.deepseek.com/quick_start/pricing/ 2026-11-25
  ["DeepSeek deepseek-flash, all peak", perQs(0.3, 1.2)],
  ["DeepSeek deepseek-flash, all off-peak", perQs(0.15, 0.6)],
  ["DeepSeek deepseek-flash, off-peak + 80% cache hit", perQs(0.15 * 0.2 + 0.003 * 0.8, 0.6)],

  // OpenAI, live https://developers.openai.com/api/docs/pricing 2026-11-25
  ["OpenAI gpt-5.4-nano", perQs(0.2, 1.25)],
  ["OpenAI gpt-5.4-mini", perQs(0.75, 4.5)],

  // Gemini, live https://ai.google.dev/gemini-api/docs/pricing 2026-11-25
  ["Gemini 3.5 Flash-Lite", perQs(0.3, 2.5)],
  ["Gemini 3.8 Flash (to 31 Dec 2026)", perQs(0.75, 3.75)],
  ["Gemini 3.8 Flash (from 1 Jan 2027)", perQs(1.5, 7.5)],
];

console.log("Per 1,000 questions at " + IN + " in / " + OUT + " out\n");
console.log("| Option | USD | GBP |");
console.log("|---|---|---|");
for (const [name, usd] of rows) {
  console.log(`| ${name} | $${usd.toFixed(3)} | £${gbp(usd).toFixed(2)} |`);
}

// --- self-hosted ---
// RunPod live 2026-11-25: A40 $0.59/hr, L40S $1.09/hr, A100 PCIe $2.09/hr (Secure Cloud, per hour).
// Throughput assumption: 20,000 prefill tok/s, 1,500 decode tok/s on an 8B 4-bit model.
const prefillSec = (IN * QS) / 20000;
const decodeSec = (OUT * QS) / 1500;
const gpuHours = (prefillSec + decodeSec) / 3600;

console.log("\nSelf-hosted GPU-seconds per 1,000 questions:", (prefillSec + decodeSec).toFixed(0), "(=", gpuHours.toFixed(4), "GPU-hours)");

const gpus = [
  ["A40", 0.59],
  ["L40S", 1.09],
  ["A100 PCIe", 2.09],
];
console.log("\n| GPU | $/hr | Saturated $/1,000 | Saturated £/1,000 | 20% util $/1,000 | 20% util £/1,000 | Monthly floor (730 h) |");
console.log("|---|---|---|---|---|---|---|");
for (const [name, rate] of gpus) {
  const sat = gpuHours * rate;
  const util = sat / 0.2;
  console.log(
    `| ${name} | $${rate.toFixed(2)} | $${sat.toFixed(2)} | £${gbp(sat).toFixed(2)} | $${util.toFixed(2)} | £${gbp(util).toFixed(2)} | $${(rate * 730).toFixed(2)} (£${gbp(rate * 730).toFixed(2)}) |`,
  );
}

// --- break-even against Mistral EU ---
const a40Monthly = 0.59 * 730;
const mistralGbpPer1k = gbp(perQs(0.165, 0.66));
const mistralGbpPerQ = mistralGbpPer1k / 1000;
const breakEven = gbp(a40Monthly) / mistralGbpPerQ;
console.log("\nMistral Small 4 EU: £" + mistralGbpPer1k.toFixed(2) + " per 1,000");
console.log("A40 monthly floor: $" + a40Monthly.toFixed(2) + " (£" + gbp(a40Monthly).toFixed(2) + ")");
console.log("Break-even questions/month vs Mistral EU: " + Math.round(breakEven).toLocaleString("en-GB"));
console.log("Monthly cost at 10,000 questions: Mistral £" + (mistralGbpPerQ * 10000).toFixed(2) + ", self-hosted A40 £" + gbp(a40Monthly).toFixed(2));
console.log("Ratio at 10,000/month: " + (gbp(a40Monthly) / (mistralGbpPerQ * 10000)).toFixed(1) + "x");

// --- sensitivity ---
console.log("\nSensitivity (GBP per 1,000, output fixed at 350):");
const sens = [
  ["Mistral Small 4 EU", 0.165, 0.66],
  ["Azure gpt-4.1-mini DZ", 0.44, 1.76],
  ["DeepSeek peak", 0.3, 1.2],
  ["Gemini 3.5 Flash-Lite", 0.3, 2.5],
  ["OpenAI gpt-5.4-nano", 0.2, 1.25],
];
const header = ["1,200", "2,500", "4,500"];
console.log("| Model | " + header.map((h) => h + " in").join(" | ") + " |");
console.log("|---" + "|---".repeat(header.length) + "|");
for (const [name, i, o] of sens) {
  const cells = [1200, 2500, 4500].map((t) => "£" + gbp(((t / 1e6) * i + (OUT / 1e6) * o) * QS).toFixed(2));
  console.log(`| ${name} | ${cells.join(" | ")} |`);
}
