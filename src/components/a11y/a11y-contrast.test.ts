// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrast in high-contrast mode, measured from the stylesheet rather than from a comment.
 *
 * The values live in `a11y.css`, and this file parses them out of it, so the numbers in the file's
 * own explanation cannot drift away from the numbers the browser applies. The WCAG formula is
 * implemented here in the same way `src/styles/tokens.test.ts` implements it for the base tokens.
 */

const css = readFileSync(path.resolve(__dirname, "a11y.css"), "utf8");
const globals = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

/** The declarations inside one rule, e.g. `html[data-a11y-contrast="high"] { ... }`. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (match === null) throw new Error(`Rule ${selector} not found in a11y.css`);
  return match[1];
}

function declaration(body: string, property: string): string {
  const match = body.match(new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+);`));
  if (match === null) throw new Error(`Declaration ${property} not found`);
  return match[1].trim();
}

/** A base token from globals.css, as a hex string. */
function token(name: string): string {
  const match = globals.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (match === null) throw new Error(`Token ${name} not found in globals.css`);
  return match[1];
}

/** Resolves `rgb(r g b / a)` over an opaque background, or reads a hex value directly. */
function resolveColour(value: string, background: string): string {
  const hex = value.match(/^#[0-9a-fA-F]{6}$/);
  if (hex !== null) return value;

  const rgb = value.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)$/);
  if (rgb === null) throw new Error(`Cannot parse colour: ${value}`);

  return toHex(blendOver([Number(rgb[1]), Number(rgb[2]), Number(rgb[3])], Number(rgb[4]), background));
}

/** Paints `channels` at `alpha` over an opaque hex background and returns the resulting channels. */
function blendOver(channels: readonly number[], alpha: number, background: string): number[] {
  const [bgR, bgG, bgB] = [1, 3, 5].map((index) => parseInt(background.slice(index, index + 2), 16));
  return channels.map((channel, index) =>
    Math.round(channel * alpha + [bgR, bgG, bgB][index] * (1 - alpha)),
  );
}

function toHex(channels: readonly number[]): string {
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const [a, b] = [luminance(foreground), luminance(background)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const HIGH = ruleBody('html[data-a11y-contrast="high"]');

/** The three backgrounds text can sit on, from globals.css. */
const GROUNDS = {
  ground: token("--ground"),
  surface: token("--surface"),
  "surface-2": token("--surface-2"),
} as const;

const AAA = 7;

describe("high contrast raises every text colour to AAA over the warm-black ground", () => {
  it("body text is unchanged and already well past AAA", () => {
    const cream = token("--cream");
    for (const [name, ground] of Object.entries(GROUNDS)) {
      expect(contrast(cream, ground), `cream on ${name}`).toBeGreaterThanOrEqual(AAA);
    }
  });

  it("muted text clears AAA on all three surfaces", () => {
    const muted = resolveColour(declaration(HIGH, "--cream-mute"), GROUNDS.surface);
    for (const [name, ground] of Object.entries(GROUNDS)) {
      expect(contrast(muted, ground), `muted on ${name}`).toBeGreaterThanOrEqual(AAA);
    }
  });

  it("the standard muted colour falls below AAA as soon as a card's glow lightens the ground", () => {
    // Why the override exists rather than being decorative. 68 percent cream is 7.53:1 on the plain
    // surface-2, which passes; over the 12 percent ember bloom that `.tml-card` and `.home-edition`
    // paint behind their copy it drops to 6.69:1, which does not. The high-contrast value holds
    // 8.43:1 in the same place.
    const glowLit = toHex(blendOver([0xff, 0x6a, 0x3d], 0.12, GROUNDS["surface-2"]));
    const standardMuted = toHex(blendOver([244, 236, 224], 0.68, glowLit));
    const highMuted = resolveColour(declaration(HIGH, "--cream-mute"), glowLit);

    expect(contrast(standardMuted, glowLit)).toBeLessThan(AAA);
    expect(contrast(highMuted, glowLit)).toBeGreaterThanOrEqual(AAA);
  });

  it("hairlines clear AAA as graphics, so a rule is visible against every surface", () => {
    for (const property of ["--hair", "--hair-strong"] as const) {
      const hair = resolveColour(declaration(HIGH, property), GROUNDS["surface-2"]);
      for (const [name, ground] of Object.entries(GROUNDS)) {
        expect(contrast(hair, ground), `${property} on ${name}`).toBeGreaterThanOrEqual(AAA);
      }
    }
  });

  it("the standard hairline is weaker than the high-contrast one", () => {
    const standard = resolveColour("rgb(244 236 224 / 0.14)", GROUNDS.ground);
    const raised = resolveColour(declaration(HIGH, "--hair"), GROUNDS.ground);
    expect(contrast(raised, GROUNDS.ground)).toBeGreaterThan(contrast(standard, GROUNDS.ground));
  });

  it("the ember and rose status colours are lifted to AAA", () => {
    for (const property of ["--ember", "--rose"] as const) {
      const colour = resolveColour(declaration(HIGH, property), GROUNDS.ground);
      for (const [name, ground] of Object.entries(GROUNDS)) {
        expect(contrast(colour, ground), `${property} on ${name}`).toBeGreaterThanOrEqual(AAA);
      }
    }
  });

  it("lifts them only as far as needed: the standard values are the ones that fell short", () => {
    for (const [property, standard] of [
      ["--ember", token("--ember")],
      ["--rose", token("--rose")],
    ] as const) {
      expect(contrast(standard, GROUNDS.ground), `${property} standard`).toBeLessThan(AAA);
    }
  });

  it("leaves the per-edition accent untouched, so --ea survives", () => {
    // Nothing in the high-contrast block may redefine --ea: the edition accent is the site's
    // identity and is already AAA on the ground.
    expect(HIGH).not.toMatch(/--ea\s*:/);
    expect(css).not.toMatch(/--ea\s*:/);
  });

  it("keeps the edition accents AAA on the ground without any override", () => {
    const winter = globals.match(/body\[data-ed="winter"\]\s*\{[^}]*--ea:\s*(#[0-9a-fA-F]{6})/);
    const brasil = globals.match(/body\[data-ed="brasil"\]\s*\{[^}]*--ea:\s*(#[0-9a-fA-F]{6})/);
    const accents = [token("--ea"), winter?.[1], brasil?.[1]].filter(
      (value): value is string => typeof value === "string",
    );

    expect(accents).toHaveLength(3);
    for (const accent of accents) {
      expect(contrast(accent, GROUNDS.ground), accent).toBeGreaterThanOrEqual(AAA);
    }
  });
});

describe("the rules are shaped the way the brief asks", () => {
  it("reduced motion uses a universal selector under the attribute", () => {
    expect(css).toMatch(/html\[data-a11y-motion="reduce"\] \*,/);
    expect(css).toMatch(/html\[data-a11y-motion="reduce"\] \*::before,/);
    expect(css).toMatch(/html\[data-a11y-motion="reduce"\] \*::after/);
    expect(css).toMatch(/html\[data-a11y-motion="reduce"\] \*[\s\S]*?animation: none !important;/);
    expect(css).toMatch(/html\[data-a11y-motion="reduce"\] \*[\s\S]*?transition: none !important;/);
  });

  it("reduced motion also stops the radio's slide animation by name", () => {
    expect(css).toMatch(/html\[data-a11y-motion="reduce"\] \.tml-radio-slide\s*\{[^}]*animation:\s*none/);
  });

  it("every text size the module offers has a rule", () => {
    for (const size of [100, 115, 130, 150]) {
      expect(css).toContain(`html[data-a11y-text="${size}"]`);
    }
    expect(css).toMatch(/html\[data-a11y-text="150"\]\s*\{[^}]*font-size:\s*150%/);
  });

  it("keys every other preference on the attribute the module publishes", () => {
    for (const attribute of ["spacing", "contrast", "motion", "links", "font"]) {
      expect(css).toContain(`html[data-a11y-${attribute}=`);
    }
  });

  it("uses no hex colour in a declaration outside the high-contrast block", () => {
    // Comments explain the measured values by quoting them; only declarations matter here. Any hex
    // in a declaration outside the override block would be a token forked into this file, which is
    // how a preference and the design system drift apart.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const withoutHighContrast = withoutComments.replace(
      /html\[data-a11y-contrast="high"\]\s*\{[^}]*\}/g,
      "",
    );
    expect(withoutHighContrast.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toEqual([]);
  });

  it("declares no colour of its own for text size, spacing, motion, links or font", () => {
    // Those five settings change geometry and typography, not palette. A `color` declaration here
    // would mean a preference had quietly become a second theme. (`text-decoration-color:
    // currentColor` on the link rule is not a colour: it inherits whatever the element already has.)
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const nonColourRules = withoutComments.match(
      /html\[data-a11y-(?:text|spacing|motion|links|font)=[^\]]*\][\s\S]*?\{[^}]*\}/g,
    );
    expect(nonColourRules).not.toBeNull();
    for (const rule of nonColourRules ?? []) {
      expect(rule).not.toMatch(/(?:^|[;{\s])color\s*:/m);
      expect(rule).not.toMatch(/--(?:cream|hair|ground|surface|ember|rose|teal|gold)/);
    }
  });
});
