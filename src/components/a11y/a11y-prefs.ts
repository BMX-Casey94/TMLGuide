/**
 * Accessibility preferences: the values, the schema, the storage format and the mapping onto
 * `data-a11y-*` attributes on `<html>`.
 *
 * A pure module. Nothing here imports React or touches the DOM except the element handed to
 * `applyPrefsToElement`, so the store, the panel and the boot script's test all read the same
 * definitions. The boot script itself is a string in `./boot-script`, because it has to run before
 * any module loads; its allowed values are duplicated there by necessity, and a test keeps the two
 * in step.
 */
import { z } from "zod";

/* ---------------------------------------------------------------------------------------------
 * Values
 * ------------------------------------------------------------------------------------------- */

/** Every text size the toolbar offers, as a percentage of the browser's base size. */
export const A11Y_TEXT_SIZES = [100, 115, 130, 150] as const;
export type A11yTextSize = (typeof A11Y_TEXT_SIZES)[number];

export const A11Y_SPACINGS = ["normal", "relaxed"] as const;
export type A11ySpacing = (typeof A11Y_SPACINGS)[number];

export const A11Y_CONTRASTS = ["standard", "high"] as const;
export type A11yContrast = (typeof A11Y_CONTRASTS)[number];

/** `system` follows the operating system's reduced-motion setting, as the site already does. */
export const A11Y_MOTIONS = ["system", "reduce"] as const;
export type A11yMotion = (typeof A11Y_MOTIONS)[number];

export const A11Y_LINK_STYLES = ["off", "on"] as const;
export type A11yLinkStyle = (typeof A11Y_LINK_STYLES)[number];

export const A11Y_FONTS = ["default", "readable"] as const;
export type A11yFont = (typeof A11Y_FONTS)[number];

export interface A11yPrefs {
  readonly textSize: A11yTextSize;
  readonly spacing: A11ySpacing;
  readonly contrast: A11yContrast;
  readonly motion: A11yMotion;
  readonly links: A11yLinkStyle;
  readonly font: A11yFont;
}

/** The single localStorage key. Nothing else is stored for these preferences. */
export const A11Y_STORAGE_KEY = "tml-a11y-prefs";

/**
 * The state a visitor sees with no saved choice. These are also what an unreadable or
 * out-of-range saved value falls back to, field by field.
 */
export const DEFAULT_A11Y_PREFS: A11yPrefs = Object.freeze({
  textSize: 100,
  spacing: "normal",
  contrast: "standard",
  motion: "system",
  links: "off",
  font: "default",
});

/**
 * The attribute each preference is published on. The names are part of the contract with
 * `a11y.css` and with the boot script: all three must agree.
 */
export const A11Y_ATTRIBUTES = {
  textSize: "data-a11y-text",
  spacing: "data-a11y-spacing",
  contrast: "data-a11y-contrast",
  motion: "data-a11y-motion",
  links: "data-a11y-links",
  font: "data-a11y-font",
} as const satisfies Record<keyof A11yPrefs, string>;

/* ---------------------------------------------------------------------------------------------
 * Schema
 *
 * Every field carries its own `catch`, so one bad value costs the visitor that one setting rather
 * than the whole panel, and no input can make `parse` throw. Unknown keys are dropped by zod's
 * default object behaviour, so a tampered entry cannot smuggle anything into state.
 * ------------------------------------------------------------------------------------------- */

const textSizeSchema = z
  .union([z.literal(100), z.literal(115), z.literal(130), z.literal(150)])
  .catch(DEFAULT_A11Y_PREFS.textSize);

export const a11yPrefsSchema = z
  .object({
    textSize: textSizeSchema,
    spacing: z.enum(A11Y_SPACINGS).catch(DEFAULT_A11Y_PREFS.spacing),
    contrast: z.enum(A11Y_CONTRASTS).catch(DEFAULT_A11Y_PREFS.contrast),
    motion: z.enum(A11Y_MOTIONS).catch(DEFAULT_A11Y_PREFS.motion),
    links: z.enum(A11Y_LINK_STYLES).catch(DEFAULT_A11Y_PREFS.links),
    font: z.enum(A11Y_FONTS).catch(DEFAULT_A11Y_PREFS.font),
  })
  .catch(DEFAULT_A11Y_PREFS);

/**
 * Reads a stored value. Accepts anything: a missing item, non-JSON, JSON of the wrong shape, a
 * value from a future version. It returns usable preferences in every case and never throws, which
 * is what the private-mode, blocked-storage and full-quota paths all need.
 */
export function parsePrefs(raw: unknown): A11yPrefs {
  if (typeof raw !== "string" || raw.trim() === "") return DEFAULT_A11Y_PREFS;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return DEFAULT_A11Y_PREFS;
  }

  const result = a11yPrefsSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_A11Y_PREFS;
}

/**
 * The exact shape written to localStorage: the six fields, in a fixed order, and nothing else.
 * Written field by field rather than spread from the input, so a caller holding a wider object
 * cannot end up persisting extra keys.
 */
export function serialisePrefs(prefs: A11yPrefs): string {
  return JSON.stringify({
    textSize: prefs.textSize,
    spacing: prefs.spacing,
    contrast: prefs.contrast,
    motion: prefs.motion,
    links: prefs.links,
    font: prefs.font,
  });
}

/** True when the object describes the default state, so storage can be cleared instead of written. */
export function isDefaultPrefs(prefs: A11yPrefs): boolean {
  return (Object.keys(DEFAULT_A11Y_PREFS) as Array<keyof A11yPrefs>).every(
    (key) => prefs[key] === DEFAULT_A11Y_PREFS[key],
  );
}

/**
 * Publishes the preferences as `data-a11y-*` attributes. All six are always written, including the
 * defaults, so the CSS never has to guess whether an absent attribute means "default".
 */
export function applyPrefsToElement(element: Element, prefs: A11yPrefs): void {
  element.setAttribute(A11Y_ATTRIBUTES.textSize, String(prefs.textSize));
  element.setAttribute(A11Y_ATTRIBUTES.spacing, prefs.spacing);
  element.setAttribute(A11Y_ATTRIBUTES.contrast, prefs.contrast);
  element.setAttribute(A11Y_ATTRIBUTES.motion, prefs.motion);
  element.setAttribute(A11Y_ATTRIBUTES.links, prefs.links);
  element.setAttribute(A11Y_ATTRIBUTES.font, prefs.font);
}

/* ---------------------------------------------------------------------------------------------
 * Announcements
 *
 * One sentence per change, in UK English, read out by the panel's polite live region. Written as a
 * pure function so the wording is tested rather than scattered through the component.
 * ------------------------------------------------------------------------------------------- */

export type A11yPrefKey = keyof A11yPrefs;

const ON_OFF: Readonly<Record<"on" | "off", string>> = { on: "on", off: "off" };

/** The sentence announced after a control changes, for example "Text size set to 130 percent". */
export function describePrefChange(key: A11yPrefKey, prefs: A11yPrefs): string {
  switch (key) {
    case "textSize":
      return `Text size set to ${prefs.textSize} percent`;
    case "spacing":
      return `Line and letter spacing set to ${prefs.spacing}`;
    case "contrast":
      return `Contrast set to ${prefs.contrast}`;
    case "motion":
      return prefs.motion === "reduce"
        ? "Motion set to reduce, whatever your system asks for"
        : "Motion set to follow your system setting";
    case "links":
      return `Link underlines turned ${ON_OFF[prefs.links]}`;
    case "font":
      return `Readable font turned ${prefs.font === "readable" ? "on" : "off"}`;
  }
}

/** The sentence announced after Reset. */
export const RESET_ANNOUNCEMENT = "Accessibility settings reset to defaults";
