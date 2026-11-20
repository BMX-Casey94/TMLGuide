import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, screen } from "@testing-library/react";
import {
  A11Y_STORAGE_KEY,
  DEFAULT_A11Y_PREFS,
  serialisePrefs,
  type A11yPrefs,
} from "./a11y-prefs";
import { readA11yPrefs, syncDocumentWithStoredPrefs, useA11yPrefs } from "./a11y-store";

/**
 * The store is the only thing that writes to localStorage, so these tests pin down exactly what is
 * written, when, and what happens when writing is impossible.
 *
 * Storage is a fresh in-memory implementation: jsdom's own is replaced in this repository's vitest
 * environment by an inert Node stub, which is documented in `src/components/shell/test-storage.ts`.
 */

class MemoryStorage implements Storage {
  private entries = new Map<string, string>();
  /** Set to throw from `setItem`, the way a full quota or a blocked origin does. */
  failWrites = false;

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
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.entries.set(key, String(value));
  }
}

let storage: MemoryStorage;

function resetDocument(): void {
  for (const attribute of Array.from(document.documentElement.attributes)) {
    if (attribute.name.startsWith("data-a11y-")) document.documentElement.removeAttribute(attribute.name);
  }
}

beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(window, "localStorage", { configurable: true, writable: true, value: storage });
  resetDocument();
});

afterEach(() => {
  cleanup();
  // The store caches against the Storage object it read from; a fresh object per test keeps the
  // cases independent without exporting a reset that production code does not need.
  Object.defineProperty(window, "localStorage", { configurable: true, writable: true, value: new MemoryStorage() });
});

const NON_DEFAULT: A11yPrefs = {
  textSize: 130,
  spacing: "relaxed",
  contrast: "high",
  motion: "reduce",
  links: "on",
  font: "readable",
};

function renderStore() {
  return renderHook(() => useA11yPrefs());
}

describe("reading stored preferences", () => {
  it("starts from the defaults with nothing stored", () => {
    expect(readA11yPrefs()).toEqual(DEFAULT_A11Y_PREFS);
  });

  it("reads a valid stored record", () => {
    storage.setItem(A11Y_STORAGE_KEY, serialisePrefs(NON_DEFAULT));
    expect(readA11yPrefs()).toEqual(NON_DEFAULT);
  });

  it("falls back to the defaults for a corrupt record, without throwing", () => {
    storage.setItem(A11Y_STORAGE_KEY, "{not json");
    expect(() => readA11yPrefs()).not.toThrow();
    expect(readA11yPrefs()).toEqual(DEFAULT_A11Y_PREFS);
  });

  it("survives storage that throws on read", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    expect(() => readA11yPrefs()).not.toThrow();
    expect(readA11yPrefs()).toEqual(DEFAULT_A11Y_PREFS);
  });
});

describe("syncDocumentWithStoredPrefs", () => {
  it("publishes the stored preferences onto <html>", () => {
    storage.setItem(A11Y_STORAGE_KEY, serialisePrefs(NON_DEFAULT));
    syncDocumentWithStoredPrefs();

    const root = document.documentElement;
    expect(root.getAttribute("data-a11y-text")).toBe("130");
    expect(root.getAttribute("data-a11y-spacing")).toBe("relaxed");
    expect(root.getAttribute("data-a11y-contrast")).toBe("high");
    expect(root.getAttribute("data-a11y-motion")).toBe("reduce");
    expect(root.getAttribute("data-a11y-links")).toBe("on");
    expect(root.getAttribute("data-a11y-font")).toBe("readable");
  });

  it("writes the defaults even when nothing is stored, so the CSS never guesses", () => {
    syncDocumentWithStoredPrefs();
    expect(document.documentElement.getAttribute("data-a11y-contrast")).toBe("standard");
  });
});

describe("useA11yPrefs", () => {
  it("starts from the defaults on a fresh install", () => {
    const { result } = renderStore();
    expect(result.current.prefs).toEqual(DEFAULT_A11Y_PREFS);
  });

  it("applies and persists a change, and announces nothing on its own", () => {
    const { result } = renderStore();

    act(() => result.current.setPref("textSize", 150));

    expect(result.current.prefs.textSize).toBe(150);
    expect(JSON.parse(storage.getItem(A11Y_STORAGE_KEY)!)).toEqual({
      ...DEFAULT_A11Y_PREFS,
      textSize: 150,
    });
    expect(document.documentElement.getAttribute("data-a11y-text")).toBe("150");
  });

  it("writes the six documented fields and nothing else", () => {
    const { result } = renderStore();
    act(() => result.current.setPref("contrast", "high"));

    const stored = JSON.parse(storage.getItem(A11Y_STORAGE_KEY)!);
    expect(Object.keys(stored).sort()).toEqual(
      ["contrast", "font", "links", "motion", "spacing", "textSize"].sort(),
    );
  });

  it("does nothing at all when a value is set to what it already is", () => {
    const { result } = renderStore();
    act(() => result.current.setPref("links", "on"));
    const written = storage.getItem(A11Y_STORAGE_KEY);

    const setItem = vi.spyOn(storage, "setItem");
    act(() => result.current.setPref("links", "on"));

    expect(setItem).not.toHaveBeenCalled();
    expect(storage.getItem(A11Y_STORAGE_KEY)).toBe(written);
  });

  it("keeps the change for the visit when storage refuses the write", () => {
    storage.failWrites = true;
    const { result } = renderStore();

    act(() => result.current.setPref("font", "readable"));

    expect(result.current.prefs.font).toBe("readable");
    expect(document.documentElement.getAttribute("data-a11y-font")).toBe("readable");
    expect(storage.getItem(A11Y_STORAGE_KEY)).toBeNull();
  });

  it("resets every preference to the defaults and persists that", () => {
    storage.setItem(A11Y_STORAGE_KEY, serialisePrefs(NON_DEFAULT));
    const { result } = renderStore();
    expect(result.current.prefs).toEqual(NON_DEFAULT);

    act(() => result.current.reset());

    expect(result.current.prefs).toEqual(DEFAULT_A11Y_PREFS);
    expect(JSON.parse(storage.getItem(A11Y_STORAGE_KEY)!)).toEqual(DEFAULT_A11Y_PREFS);
    expect(document.documentElement.getAttribute("data-a11y-contrast")).toBe("standard");
  });

  it("re-renders when another tab writes the key", () => {
    const { result } = renderStore();
    expect(result.current.prefs.contrast).toBe("standard");

    act(() => {
      storage.setItem(A11Y_STORAGE_KEY, serialisePrefs(NON_DEFAULT));
      window.dispatchEvent(
        new StorageEvent("storage", { key: A11Y_STORAGE_KEY, newValue: serialisePrefs(NON_DEFAULT) }),
      );
    });

    expect(result.current.prefs.contrast).toBe("high");
    expect(document.documentElement.getAttribute("data-a11y-contrast")).toBe("high");
  });

  it("returns to the defaults when another tab clears the key or the whole origin", () => {
    storage.setItem(A11Y_STORAGE_KEY, serialisePrefs(NON_DEFAULT));
    const { result } = renderStore();

    act(() => {
      storage.removeItem(A11Y_STORAGE_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: A11Y_STORAGE_KEY, newValue: null }));
    });
    expect(result.current.prefs).toEqual(DEFAULT_A11Y_PREFS);

    act(() => result.current.setPref("textSize", 115));
    act(() => {
      storage.clear();
      // A cleared origin reports key === null.
      window.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null }));
    });
    expect(result.current.prefs).toEqual(DEFAULT_A11Y_PREFS);
  });

  it("ignores a write to an unrelated key", () => {
    const { result } = renderStore();
    act(() => result.current.setPref("links", "on"));

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "tml-edition", newValue: "winter" }));
    });

    expect(result.current.prefs.links).toBe("on");
  });

  it("falls back for a hostile value written by another tab", () => {
    const { result } = renderStore();
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: A11Y_STORAGE_KEY, newValue: "not json" }));
    });
    expect(result.current.prefs).toEqual(DEFAULT_A11Y_PREFS);
  });
});

describe("nothing else is stored", () => {
  it("writes exactly one key no matter how many settings change", () => {
    const { result } = renderStore();

    act(() => result.current.setPref("textSize", 115));
    act(() => result.current.setPref("spacing", "relaxed"));
    act(() => result.current.setPref("contrast", "high"));
    act(() => result.current.setPref("motion", "reduce"));
    act(() => result.current.setPref("links", "on"));
    act(() => result.current.setPref("font", "readable"));

    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe(A11Y_STORAGE_KEY);
  });
});

describe("the panel's trigger state lives outside this store", () => {
  it("renders no UI of its own", () => {
    const { result } = renderStore();
    // A hook with no component: if it rendered anything, Testing Library would have no container.
    expect(result.current.prefs).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.textContent).toBe("");
  });
});
