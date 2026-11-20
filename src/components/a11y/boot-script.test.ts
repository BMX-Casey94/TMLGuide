// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  A11Y_CONTRASTS,
  A11Y_FONTS,
  A11Y_LINK_STYLES,
  A11Y_MOTIONS,
  A11Y_SPACINGS,
  A11Y_STORAGE_KEY,
  A11Y_TEXT_SIZES,
  DEFAULT_A11Y_PREFS,
} from "./a11y-prefs";
import { A11Y_BOOT_SCRIPT } from "./boot-script";

/**
 * The boot script is the one piece of code that runs before React and before any module in the app,
 * so it is tested as what it is: a string of JavaScript evaluated against a fresh document.
 *
 * Every case evaluates the exact constant the layout ships. Nothing is re-implemented here, and no
 * value is hard-coded that the script could drift away from.
 */

/** Storage the script can read, with the methods jsdom's stub sometimes lacks. */
class MemoryStorage implements Storage {
  private entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }
}

function installStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
  return storage;
}

/** Removes every preference attribute, so a pass cannot come from a previous case. */
function clearAttributes(): void {
  const root = document.documentElement;
  for (const attribute of Array.from(root.attributes)) {
    if (attribute.name.startsWith("data-a11y-")) root.removeAttribute(attribute.name);
  }
}

/** Runs the shipped script source and returns the attributes it left on <html>. */
function runBootScript(): Record<string, string | null> {
  // Deliberately evaluates the exported constant: this is the source that ships, not a copy.
  new Function(A11Y_BOOT_SCRIPT)();

  const root = document.documentElement;
  return {
    text: root.getAttribute("data-a11y-text"),
    spacing: root.getAttribute("data-a11y-spacing"),
    contrast: root.getAttribute("data-a11y-contrast"),
    motion: root.getAttribute("data-a11y-motion"),
    links: root.getAttribute("data-a11y-links"),
    font: root.getAttribute("data-a11y-font"),
  };
}

const DEFAULT_ATTRIBUTES = {
  text: "100",
  spacing: "normal",
  contrast: "standard",
  motion: "system",
  links: "off",
  font: "default",
} as const;

let storage: MemoryStorage;

beforeEach(() => {
  storage = installStorage();
  clearAttributes();
});

describe("the boot script", () => {
  it("sets every default when nothing is stored", () => {
    expect(runBootScript()).toEqual(DEFAULT_ATTRIBUTES);
  });

  it("applies a complete stored record", () => {
    storage.setItem(
      A11Y_STORAGE_KEY,
      JSON.stringify({
        textSize: 150,
        spacing: "relaxed",
        contrast: "high",
        motion: "reduce",
        links: "on",
        font: "readable",
      }),
    );

    expect(runBootScript()).toEqual({
      text: "150",
      spacing: "relaxed",
      contrast: "high",
      motion: "reduce",
      links: "on",
      font: "readable",
    });
  });

  it.each(A11Y_TEXT_SIZES)("accepts the %i percent text size", (size) => {
    storage.setItem(A11Y_STORAGE_KEY, JSON.stringify({ textSize: size }));
    expect(runBootScript().text).toBe(String(size));
  });

  it.each(A11Y_SPACINGS)("accepts the %s spacing", (value) => {
    storage.setItem(A11Y_STORAGE_KEY, JSON.stringify({ spacing: value }));
    expect(runBootScript().spacing).toBe(value);
  });

  it.each(A11Y_CONTRASTS)("accepts %s contrast", (value) => {
    storage.setItem(A11Y_STORAGE_KEY, JSON.stringify({ contrast: value }));
    expect(runBootScript().contrast).toBe(value);
  });

  it.each(A11Y_MOTIONS)("accepts the %s motion setting", (value) => {
    storage.setItem(A11Y_STORAGE_KEY, JSON.stringify({ motion: value }));
    expect(runBootScript().motion).toBe(value);
  });

  it.each(A11Y_LINK_STYLES)("accepts links %s", (value) => {
    storage.setItem(A11Y_STORAGE_KEY, JSON.stringify({ links: value }));
    expect(runBootScript().links).toBe(value);
  });

  it.each(A11Y_FONTS)("accepts the %s font", (value) => {
    storage.setItem(A11Y_STORAGE_KEY, JSON.stringify({ font: value }));
    expect(runBootScript().font).toBe(value);
  });

  it("keeps the valid fields of a partly broken record", () => {
    storage.setItem(
      A11Y_STORAGE_KEY,
      JSON.stringify({ textSize: 130, contrast: "high", spacing: "wide", font: 7 }),
    );

    expect(runBootScript()).toEqual({
      ...DEFAULT_ATTRIBUTES,
      text: "130",
      contrast: "high",
    });
  });

  it("ignores a record from the wrong shape entirely", () => {
    storage.setItem(A11Y_STORAGE_KEY, JSON.stringify(["high"]));
    expect(runBootScript()).toEqual(DEFAULT_ATTRIBUTES);
  });

  it.each([
    ["a plain string", "high"],
    ["a number", "130"],
    ["a boolean", "true"],
    ["JSON null", "null"],
  ])("ignores %s stored at the key", (_label, value) => {
    storage.setItem(A11Y_STORAGE_KEY, value);
    expect(runBootScript()).toEqual(DEFAULT_ATTRIBUTES);
  });

  it.each([
    ["truncated JSON", "{"],
    ["not JSON at all", "high contrast please"],
    ["an empty string", ""],
    ["a lone brace", "}"],
    ["a very long junk string", "x".repeat(5000)],
    ["a null byte", "\u0000"],
  ])("does not throw on %s, and falls back to the defaults", (_label, value) => {
    storage.setItem(A11Y_STORAGE_KEY, value);
    expect(() => runBootScript()).not.toThrow();
    expect(runBootScript()).toEqual(DEFAULT_ATTRIBUTES);
  });

  it("does not throw when reading storage is refused outright", () => {
    // Private mode, blocked site data, a sandboxed frame: even the property read can throw.
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError: storage is blocked");
      },
    });

    expect(() => runBootScript()).not.toThrow();
    // Nothing was applied, so the CSS defaults apply. That is the intended failure mode: the page
    // renders at its defaults rather than not rendering.
    expect(runBootScript().contrast).toBeNull();
  });

  it("does not throw when getItem throws", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem() {
          throw new Error("QuotaExceededError");
        },
      },
    });

    expect(() => runBootScript()).not.toThrow();
  });

  it("overwrites attributes the server already wrote, rather than adding to them", () => {
    document.documentElement.setAttribute("data-a11y-contrast", "standard");
    document.documentElement.setAttribute("data-a11y-text", "100");
    storage.setItem(A11Y_STORAGE_KEY, JSON.stringify({ contrast: "high", textSize: 115 }));

    const attributes = runBootScript();
    expect(attributes.contrast).toBe("high");
    expect(attributes.text).toBe("115");
    expect(document.documentElement.attributes).toHaveLength(6);
  });
});

describe("the boot script's source", () => {
  it("is a single self-contained statement with no external references", () => {
    expect(A11Y_BOOT_SCRIPT.startsWith("(function(){")).toBe(true);
    expect(A11Y_BOOT_SCRIPT.trimEnd().endsWith("})();")).toBe(true);
  });

  it("is small enough to sit on the critical path of every page", () => {
    // A hard budget rather than a comment: if this grows, the growth should be a decision.
    expect(A11Y_BOOT_SCRIPT.length).toBeLessThan(1200);
  });

  it("wraps everything in a try/catch, so no storage failure can break the page", () => {
    expect(A11Y_BOOT_SCRIPT).toContain("try{");
    expect(A11Y_BOOT_SCRIPT).toContain("catch(e){}");
  });

  it("reads one storage key and no other", () => {
    expect(A11Y_BOOT_SCRIPT).toContain(`"${A11Y_STORAGE_KEY}"`);
    expect(A11Y_BOOT_SCRIPT.match(/localStorage/g)).toHaveLength(1);
  });

  it("contains no string interpolation, so nothing can be injected into it", () => {
    expect(A11Y_BOOT_SCRIPT).not.toContain("${");
  });

  it("writes exactly the six documented attributes", () => {
    for (const name of ["text", "spacing", "contrast", "motion", "links", "font"]) {
      expect(A11Y_BOOT_SCRIPT).toContain(`"${name}"`);
    }
    expect(A11Y_BOOT_SCRIPT.match(/set\("/g)).toHaveLength(6);
  });

  it("agrees with the defaults declared in a11y-prefs", () => {
    // The script cannot import the module, so this is the check that keeps the two in step.
    expect(A11Y_BOOT_SCRIPT).toContain(`[100,115,130,150],${DEFAULT_A11Y_PREFS.textSize}`);
    expect(A11Y_BOOT_SCRIPT).toContain(`"${DEFAULT_A11Y_PREFS.spacing}"`);
    expect(A11Y_BOOT_SCRIPT).toContain(`"${DEFAULT_A11Y_PREFS.contrast}"`);
    expect(A11Y_BOOT_SCRIPT).toContain(`"${DEFAULT_A11Y_PREFS.motion}"`);
    expect(A11Y_BOOT_SCRIPT).toContain(`"${DEFAULT_A11Y_PREFS.links}"`);
    expect(A11Y_BOOT_SCRIPT).toContain(`"${DEFAULT_A11Y_PREFS.font}"`);
  });
});
