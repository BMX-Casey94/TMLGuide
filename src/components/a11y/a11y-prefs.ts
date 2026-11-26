/**
 * Accessibility preferences: the values, the validation rules, the storage format and the mapping
 * onto `data-a11y-*` attributes on `<html>`.
 *
 * A pure, dependency-free module. Nothing here imports React, touches the DOM (except the element
 * handed to `applyPrefsToElement`) or pulls in a library: this file is part of the shared client
 * bundle of every page, and validating six short allow-lists does not justify shipping a schema
 * library to every visitor. The store, the panel and the boot script's test all read the same
 * definitions. The boot script itself is a string in `./boot-script`, because it has to run before
 * any module loads; its allowed values are duplicated there by necessity, and a test keeps the two
 * in step.
 */

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
 * Validation
 *
 * Six short allow-lists, written out in plain TypeScript. This module is in the shared client
 * bundle of every page, and a schema library used for six enum checks added ~105 KB (raw) to every
 * visit, so the rules live here instead of in a dependency.
 *
 * Three properties are load-bearing, and each one is preserved from the zod schema this replaced:
 *
 * - **Repair per field.** A value that is not one of the allowed members falls back to that field's
 *   own default, so a tampered or stale record costs the visitor one setting rather than all six.
 * - **Reject the record, not the visit.** Only a value that is not a non-null, non-array object
 *   discards the whole record; everything else is repaired.
 * - **Build a fresh object.** The result is constructed field by field, so an unknown key, an
 *   inherited key or a `__proto__` payload cannot reach state: only the six documented fields are
 *   ever read, and only those six are ever returned.
 * ------------------------------------------------------------------------------------------- */

/** Membership is compared without coercion: the string `"130"` is not the number `130`. */
const TEXT_SIZES: ReadonlySet<number> = new Set(A11Y_TEXT_SIZES);
const SPACINGS: ReadonlySet<string> = new Set(A11Y_SPACINGS);
const CONTRASTS: ReadonlySet<string> = new Set(A11Y_CONTRASTS);
const MOTIONS: ReadonlySet<string> = new Set(A11Y_MOTIONS);
const LINK_STYLES: ReadonlySet<string> = new Set(A11Y_LINK_STYLES);
const FONTS: ReadonlySet<string> = new Set(A11Y_FONTS);

/*
 * One type guard per preference. Each is a real narrowing predicate, so the repair below needs no
 * assertions: the `typeof` check makes the value a string or a number, the set answers membership,
 * and the compiler knows the result is the narrowed union. The six are written out rather than
 * produced by a factory because a factory would need a cast to return a predicate, and six lines of
 * obvious code are worth more here than one clever line that lies to the type checker.
 */

function isTextSize(value: unknown): value is A11yTextSize {
  return typeof value === "number" && TEXT_SIZES.has(value);
}

function isSpacing(value: unknown): value is A11ySpacing {
  return typeof value === "string" && SPACINGS.has(value);
}

function isContrast(value: unknown): value is A11yContrast {
  return typeof value === "string" && CONTRASTS.has(value);
}

function isMotion(value: unknown): value is A11yMotion {
  return typeof value === "string" && MOTIONS.has(value);
}

function isLinkStyle(value: unknown): value is A11yLinkStyle {
  return typeof value === "string" && LINK_STYLES.has(value);
}

function isFont(value: unknown): value is A11yFont {
  return typeof value === "string" && FONTS.has(value);
}

/** The record shape read from storage: six unknown fields, none of them trusted. */
type UnknownPrefs = Partial<Record<keyof A11yPrefs, unknown>>;

/**
 * Repairs an arbitrary value into usable preferences. Never rejects a field and never throws: the
 * result is always a complete `A11yPrefs`, and the shared defaults object is returned by reference
 * when the value is not a record at all.
 */
function coercePrefs(value: unknown): A11yPrefs {
  // Functions, primitives, `null` and arrays are not a preference record. A class instance, a
  // `Date` or a null-prototype object is: its missing fields simply fall back, field by field.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_A11Y_PREFS;
  }

  const source: UnknownPrefs = value;

  // Each field is read from the record and validated on its own. A proxy whose getters throw is
  // not something JSON can produce, but `parsePrefs` promises never to throw, so the promise is
  // kept here rather than trusted to every caller.
  try {
    const { textSize, spacing, contrast, motion, links, font } = source;

    return {
      textSize: isTextSize(textSize) ? textSize : DEFAULT_A11Y_PREFS.textSize,
      spacing: isSpacing(spacing) ? spacing : DEFAULT_A11Y_PREFS.spacing,
      contrast: isContrast(contrast) ? contrast : DEFAULT_A11Y_PREFS.contrast,
      motion: isMotion(motion) ? motion : DEFAULT_A11Y_PREFS.motion,
      links: isLinkStyle(links) ? links : DEFAULT_A11Y_PREFS.links,
      font: isFont(font) ? font : DEFAULT_A11Y_PREFS.font,
    };
  } catch {
    return DEFAULT_A11Y_PREFS;
  }
}

/** The result of validating a stored value. Every input is repaired, so this is always a success. */
export interface A11yPrefsParseResult {
  readonly success: true;
  readonly data: A11yPrefs;
}

/**
 * The validation entry point, kept for callers and tests that branch on `success`. It cannot fail:
 * repairing an unreadable record to the defaults is the point of the module, which is why the
 * discriminant is always `true`.
 */
export const a11yPrefsSchema: {
  readonly safeParse: (value: unknown) => A11yPrefsParseResult;
} = {
  safeParse: (value) => ({ success: true, data: coercePrefs(value) }),
};

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

  return coercePrefs(value);
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
