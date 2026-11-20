import { describe, expect, it } from "vitest";
import {
  A11Y_ATTRIBUTES,
  A11Y_STORAGE_KEY,
  DEFAULT_A11Y_PREFS,
  RESET_ANNOUNCEMENT,
  a11yPrefsSchema,
  applyPrefsToElement,
  describePrefChange,
  isDefaultPrefs,
  parsePrefs,
  serialisePrefs,
  type A11yPrefs,
} from "./a11y-prefs";

const NON_DEFAULT: A11yPrefs = {
  textSize: 150,
  spacing: "relaxed",
  contrast: "high",
  motion: "reduce",
  links: "on",
  font: "readable",
};

describe("defaults", () => {
  it("are the untouched site: full size, standard contrast, motion following the system", () => {
    expect(DEFAULT_A11Y_PREFS).toEqual({
      textSize: 100,
      spacing: "normal",
      contrast: "standard",
      motion: "system",
      links: "off",
      font: "default",
    });
  });

  it("are frozen, so no caller can mutate the shared object", () => {
    expect(Object.isFrozen(DEFAULT_A11Y_PREFS)).toBe(true);
  });

  it("uses the documented storage key and nothing else", () => {
    expect(A11Y_STORAGE_KEY).toBe("tml-a11y-prefs");
  });

  it("names an attribute per preference, and no attribute is reused", () => {
    const names = Object.values(A11Y_ATTRIBUTES);
    expect(names).toEqual([
      "data-a11y-text",
      "data-a11y-spacing",
      "data-a11y-contrast",
      "data-a11y-motion",
      "data-a11y-links",
      "data-a11y-font",
    ]);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("parsePrefs", () => {
  it("reads a complete stored record", () => {
    expect(parsePrefs(serialisePrefs(NON_DEFAULT))).toEqual(NON_DEFAULT);
  });

  it("round-trips every preference through serialise and parse", () => {
    expect(parsePrefs(serialisePrefs(DEFAULT_A11Y_PREFS))).toEqual(DEFAULT_A11Y_PREFS);
  });

  it.each([
    ["a missing key", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["whitespace", "   "],
    ["non-JSON", "{not json"],
    ["a JSON string", '"high"'],
    ["a JSON number", "130"],
    ["JSON null", "null"],
    ["an array", '["high"]'],
    ["an empty object", "{}"],
  ])("falls back to the defaults for %s", (_label, raw) => {
    expect(parsePrefs(raw)).toEqual(DEFAULT_A11Y_PREFS);
  });

  it("keeps the valid fields and falls back only for the broken one", () => {
    const stored = JSON.stringify({ ...NON_DEFAULT, textSize: 999 });
    expect(parsePrefs(stored)).toEqual({ ...NON_DEFAULT, textSize: 100 });
  });

  it.each([
    ["a size between the offered steps", { textSize: 120 }],
    ["a size as a string", { textSize: "130" }],
    ["an unknown spacing", { spacing: "wide" }],
    ["an unknown contrast", { contrast: "max" }],
    ["an unknown motion value", { motion: "off" }],
    ["a boolean where an enum belongs", { links: true }],
    ["an unknown font", { font: "dyslexic" }],
  ])("falls back per field for %s", (_label, patch) => {
    const stored = JSON.stringify({ ...NON_DEFAULT, ...patch });
    const parsed = parsePrefs(stored);

    for (const [key, value] of Object.entries(patch)) {
      expect(parsed[key as keyof A11yPrefs]).not.toBe(value);
    }
  });

  it("drops unknown keys, so nothing smuggled into storage reaches state", () => {
    const stored = JSON.stringify({ ...NON_DEFAULT, admin: true, __proto__: { polluted: 1 } });
    const parsed = parsePrefs(stored);

    expect(parsed).toEqual(NON_DEFAULT);
    expect(Object.keys(parsed).sort()).toEqual(
      ["contrast", "font", "links", "motion", "spacing", "textSize"].sort(),
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("never throws, whatever it is handed", () => {
    const hostile = [
      "{",
      "}",
      '{"textSize":',
      "\u0000",
      "['a']",
      "true",
      '{"textSize":{"$gt":0}}',
      "a".repeat(10_000),
    ];
    for (const raw of hostile) {
      expect(() => parsePrefs(raw)).not.toThrow();
    }
  });
});

describe("serialisePrefs", () => {
  it("writes the six fields in a fixed order and nothing else", () => {
    expect(serialisePrefs(NON_DEFAULT)).toBe(
      '{"textSize":150,"spacing":"relaxed","contrast":"high","motion":"reduce","links":"on","font":"readable"}',
    );
  });

  it("ignores extra properties on the object it is given", () => {
    const wide = { ...NON_DEFAULT, tracking: "yes" } as A11yPrefs;
    expect(JSON.parse(serialisePrefs(wide))).not.toHaveProperty("tracking");
  });

  it("produces a value its own parser accepts", () => {
    expect(a11yPrefsSchema.safeParse(JSON.parse(serialisePrefs(NON_DEFAULT))).success).toBe(true);
  });
});

describe("isDefaultPrefs", () => {
  it("is true only when every field matches the defaults", () => {
    expect(isDefaultPrefs(DEFAULT_A11Y_PREFS)).toBe(true);
    expect(isDefaultPrefs(NON_DEFAULT)).toBe(false);
    expect(isDefaultPrefs({ ...DEFAULT_A11Y_PREFS, links: "on" })).toBe(false);
  });
});

describe("applyPrefsToElement", () => {
  it("writes all six attributes, including the default ones", () => {
    const element = document.createElement("html");
    applyPrefsToElement(element, DEFAULT_A11Y_PREFS);

    expect(element.getAttribute("data-a11y-text")).toBe("100");
    expect(element.getAttribute("data-a11y-spacing")).toBe("normal");
    expect(element.getAttribute("data-a11y-contrast")).toBe("standard");
    expect(element.getAttribute("data-a11y-motion")).toBe("system");
    expect(element.getAttribute("data-a11y-links")).toBe("off");
    expect(element.getAttribute("data-a11y-font")).toBe("default");
  });

  it("renders the text size as a bare number, which is the form the CSS keys on", () => {
    const element = document.createElement("html");
    applyPrefsToElement(element, NON_DEFAULT);
    expect(element.getAttribute("data-a11y-text")).toBe("150");
  });

  it("overwrites a previous set rather than adding to it", () => {
    const element = document.createElement("html");
    applyPrefsToElement(element, NON_DEFAULT);
    applyPrefsToElement(element, DEFAULT_A11Y_PREFS);

    expect(element.getAttribute("data-a11y-contrast")).toBe("standard");
    expect(element.getAttribute("data-a11y-font")).toBe("default");
  });

  it("adds no attribute beyond the six", () => {
    const element = document.createElement("html");
    applyPrefsToElement(element, NON_DEFAULT);
    expect(element.attributes).toHaveLength(6);
  });
});

describe("describePrefChange", () => {
  it("names the size in the wording the brief asks for", () => {
    expect(describePrefChange("textSize", { ...DEFAULT_A11Y_PREFS, textSize: 130 })).toBe(
      "Text size set to 130 percent",
    );
  });

  it("describes each setting in words a screen reader reads naturally", () => {
    expect(describePrefChange("spacing", NON_DEFAULT)).toBe(
      "Line and letter spacing set to relaxed",
    );
    expect(describePrefChange("contrast", NON_DEFAULT)).toBe("Contrast set to high");
    expect(describePrefChange("links", DEFAULT_A11Y_PREFS)).toBe("Link underlines turned off");
    expect(describePrefChange("links", NON_DEFAULT)).toBe("Link underlines turned on");
    expect(describePrefChange("font", NON_DEFAULT)).toBe("Readable font turned on");
    expect(describePrefChange("font", DEFAULT_A11Y_PREFS)).toBe("Readable font turned off");
  });

  it("says which motion choice was made, not just 'reduce'", () => {
    expect(describePrefChange("motion", NON_DEFAULT)).toBe(
      "Motion set to reduce, whatever your system asks for",
    );
    expect(describePrefChange("motion", DEFAULT_A11Y_PREFS)).toBe(
      "Motion set to follow your system setting",
    );
  });

  it("has a reset message that says what happened", () => {
    expect(RESET_ANNOUNCEMENT).toBe("Accessibility settings reset to defaults");
  });
});
