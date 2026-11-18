// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Token ${name} not found as a 6-digit hex in globals.css`);
  return match[1];
}

function editionAccent(edition: string): string {
  const match = css.match(
    new RegExp(`body\\[data-ed="${edition}"\\]\\s*\\{[^}]*--ea:\\s*(#[0-9a-fA-F]{6})`),
  );
  if (!match) throw new Error(`Accent for ${edition} not found in globals.css`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("design token contrast (WCAG)", () => {
  const ground = token("--ground");
  const surface = token("--surface");
  const cream = token("--cream");
  const onAccent = token("--on-accent");
  const accents = {
    belgium: token("--ea"),
    winter: editionAccent("winter"),
    brasil: editionAccent("brasil"),
  };

  it("body text on ground and surface is at least AAA", () => {
    expect(contrast(cream, ground)).toBeGreaterThanOrEqual(7);
    expect(contrast(cream, surface)).toBeGreaterThanOrEqual(7);
  });

  it.each(Object.entries(accents))("%s accent text on ground is at least AA", (_name, accent) => {
    expect(contrast(accent, ground)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(accents))(
    "dark text on the %s accent button is at least AA",
    (_name, accent) => {
      expect(contrast(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
