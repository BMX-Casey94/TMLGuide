import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
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

  /*
    Everything below pins behaviour that used to come from zod. Each case is a way a stored record
    can differ from the canonical six-field object, and each expected value was measured against the
    schema this module replaced, so the hand-written validator cannot drift into being stricter or
    more forgiving without a test failing.
  */

  it("accepts a record that omits every field, and repairs all six", () => {
    expect(parsePrefs("{}")).toEqual(DEFAULT_A11Y_PREFS);
  });

  it("reads inherited fields the same way it reads own fields", () => {
    // A prototype-carried value was readable before the refactor and still is: the repair reads the
    // property. `parsePrefs` cannot reach this case because JSON has no prototypes, so it is checked
    // against the validator directly.
    const inherited = Object.create({ textSize: 150, contrast: "high" }) as unknown;
    expect(a11yPrefsSchema.safeParse(inherited).data).toEqual({
      ...DEFAULT_A11Y_PREFS,
      textSize: 150,
      contrast: "high",
    });
  });

  it("compares without coercion, so a numeric string is not a number", () => {
    expect(parsePrefs(JSON.stringify({ textSize: "130" })).textSize).toBe(100);
    expect(parsePrefs(JSON.stringify({ textSize: 130.5 })).textSize).toBe(100);
    expect(parsePrefs(JSON.stringify({ textSize: 130.0 })).textSize).toBe(130);
  });

  it("returns the shared frozen defaults object, not a copy, when the record is not an object", () => {
    // Identity matters: the store hands this object straight to React, and `Object.is` on a fresh
    // copy each read would re-render every subscriber on every storage event.
    for (const raw of ['"high"', "130", "true", "null", '["high"]']) {
      expect(parsePrefs(raw)).toBe(DEFAULT_A11Y_PREFS);
    }
  });

  it("returns a fresh plain object, not the defaults, for a repaired record", () => {
    const parsed = parsePrefs("{}");
    expect(parsed).toEqual(DEFAULT_A11Y_PREFS);
    expect(parsed).not.toBe(DEFAULT_A11Y_PREFS);
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.isFrozen(parsed)).toBe(false);
  });

  it("survives a record whose reads throw, rather than propagating the error", () => {
    const trap = new Proxy(
      {},
      {
        get() {
          throw new Error("hostile getter");
        },
      },
    );
    expect(() => a11yPrefsSchema.safeParse(trap)).not.toThrow();
    expect(a11yPrefsSchema.safeParse(trap).data).toEqual(DEFAULT_A11Y_PREFS);
  });

  it("reports success for every input, because repairing is the contract", () => {
    for (const value of [null, 42, "text", ["x"], {}, { textSize: 999 }]) {
      const result = a11yPrefsSchema.safeParse(value);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({ textSize: expect.any(Number), font: expect.any(String) }),
      );
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
    expect(a11yPrefsSchema.safeParse(JSON.parse(serialisePrefs(NON_DEFAULT))).data).toEqual(
      NON_DEFAULT,
    );
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

describe("the accessibility code carries no client-bundle dependency", () => {
  /*
    This module is in the shared JavaScript every page loads, because the toolbar is mounted in the
    root layout. It used to import zod to validate six enum values, which put ~105 KB raw of schema
    library on every visit. These checks fail if a library is pulled back in, so the saving cannot
    quietly disappear in a later refactor.
  */

  const A11Y_DIRECTORIES = ["src/components/a11y", "src/lib/a11y"].map((relative) =>
    path.resolve(__dirname, "../../..", relative),
  );

  function sourceFiles(directory: string): string[] {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return [];
    }

    return entries.flatMap((entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
  }

  /** Every `from "x"` and `import("x")` specifier in a file. */
  function importsOf(file: string): string[] {
    const source = readFileSync(file, "utf8");
    const matches = source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g);
    return [...matches].map((match) => match[1]);
  }

  it("finds the accessibility sources it is meant to check", () => {
    // A guard that silently matched no files would pass forever.
    const files = A11Y_DIRECTORIES.flatMap(sourceFiles);
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files.some((file) => file.endsWith("a11y-prefs.ts"))).toBe(true);
    expect(files.some((file) => file.endsWith("a11y-toolbar.tsx"))).toBe(true);
  });

  it("imports no bare package into the accessibility module graph", () => {
    const bare: string[] = [];

    for (const file of A11Y_DIRECTORIES.flatMap(sourceFiles)) {
      for (const specifier of importsOf(file)) {
        const isRelative = specifier.startsWith(".");
        const isAlias = specifier.startsWith("@/components/") || specifier.startsWith("@/lib/");
        const isStyle = specifier.endsWith(".css");
        // `react` is unavoidable in the client components and is already in the shell; nothing
        // else may be added without this test being deliberately updated.
        const isSanctionedReact = specifier === "react";
        if (isRelative || isAlias || isStyle || isSanctionedReact) continue;
        bare.push(`${path.relative(path.resolve(__dirname, "../../.."), file)}: ${specifier}`);
      }
    }

    expect(bare).toEqual([]);
  });

  it("imports zod from nowhere, in any spelling", () => {
    // The module's comments name zod on purpose, to record what was removed and why. What must not
    // come back is the import, so this checks specifiers rather than raw text.
    for (const file of A11Y_DIRECTORIES.flatMap(sourceFiles)) {
      for (const specifier of importsOf(file)) {
        expect(specifier, file).not.toMatch(/^zod(\/|$)/);
      }
    }
  });
});
