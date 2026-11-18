// Produces web-ready brand assets from the owner-supplied source PNGs in design/concepts.
// Run: node scripts/process-brand-assets.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const src = "design/concepts";
const out = "public/brand";
await mkdir(out, { recursive: true });

// 1. Logo: trim transparent margins, export at 1x/2x widths.
const logoSrc = path.join(src, "Elegant Gold Butterfly Ribbon Logo.png");
const logoTrimmed = await sharp(logoSrc).trim({ threshold: 8 }).toBuffer();
const logoMeta = await sharp(logoTrimmed).metadata();
console.log("logo trimmed", logoMeta.width, logoMeta.height);
for (const w of [320, 640, 960]) {
  await sharp(logoTrimmed).resize({ width: w }).webp({ quality: 90, alphaQuality: 95 }).toFile(path.join(out, `logo-${w}.webp`));
}

// 2. Butterfly mark only (left wing group of the logo is not separable, so use image 3 for the standalone mark).
const markSrc = path.join(src, "Golden Butterfly Short Trail.png");
const markTrimmed = await sharp(markSrc).trim({ threshold: 8 }).toBuffer();
for (const w of [160, 320, 640]) {
  await sharp(markTrimmed).resize({ width: w }).webp({ quality: 90, alphaQuality: 95 }).toFile(path.join(out, `butterfly-mark-${w}.webp`));
}

// 3. Flight-trail image: the source has a baked-in checkerboard (no real alpha).
// Key out low-saturation light pixels (the grey/white squares); keep saturated gold.
const trailSrc = path.join(src, "Golden Butterfly with Glowing Flight Trail.png");
const { data, info } = await sharp(trailSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const satAt = (p) => {
  const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return { sat: max === 0 ? 0 : (max - min) / max, min };
};
const isBg = (p) => { const { sat, min } = satAt(p); return min > 185 && sat < 0.16; };
// Flood fill from every edge pixel across checker-like pixels only, so pale highlights
// inside the wings (which are not connected to the edge) are preserved.
const visited = new Uint8Array(W * H);
const stack = [];
const push = (p) => { if (!visited[p] && isBg(p)) { visited[p] = 1; stack.push(p); } };
for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
while (stack.length) {
  const p = stack.pop();
  const x = p % W, y = (p - x) / W;
  if (x > 0) push(p - 1);
  if (x < W - 1) push(p + 1);
  if (y > 0) push(p - W);
  if (y < H - 1) push(p + W);
}
for (let p = 0; p < W * H; p++) {
  if (!visited[p]) continue;
  // Feather: more saturated (gold-tinged) edge pixels keep partial opacity.
  const { sat } = satAt(p);
  data[p * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, (sat - 0.06) / 0.10)));
}
const trailKeyed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
const trailTrimmed = await sharp(trailKeyed).trim({ threshold: 8 }).toBuffer();
for (const w of [640, 1280, 1774]) {
  await sharp(trailTrimmed).resize({ width: w, withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 92 }).toFile(path.join(out, `butterfly-trail-${w}.webp`));
}
console.log("done");
