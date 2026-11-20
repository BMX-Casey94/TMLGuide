// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  MAX_CUSTOM_ITEMS,
  MAX_CUSTOM_LABEL,
  MAX_PACKED_IDS,
  MAX_STORED_LENGTH,
  PACKING_STORAGE_KEY,
  addCustomItem,
  clearPackingState,
  createPackingStore,
  defaultPackingState,
  loadPackingState,
  nextCustomId,
  packingStateSchema,
  removeCustomItem,
  repairPackingState,
  resetTicks,
  safeLocalStorage,
  savePackingState,
  stayAfterEditionChange,
  togglePacked,
  type PackingState,
  type StorageLike,
} from "./packing-state";

/** An in-memory Storage that behaves like the real one and can be inspected. */
function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  dump(): Record<string, string>;
} {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map),
  };
}

/** A Storage whose every method throws, as a locked-down browser does. */
const refusingStorage: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("defaultPackingState", () => {
  it("opens on the edition's first stay with nothing packed", () => {
    expect(defaultPackingState("belgium")).toEqual({
      edition: "belgium",
      stay: "belgium-dreamville",
      packed: [],
      custom: [],
    });
    expect(defaultPackingState("winter").stay).toBe("winter-resort");
    expect(defaultPackingState("brasil").stay).toBe("brasil-dreamville");
  });

  it("passes its own schema", () => {
    for (const edition of ["belgium", "winter", "brasil"] as const) {
      expect(packingStateSchema.safeParse(defaultPackingState(edition)).success).toBe(true);
    }
  });
});

describe("the schema", () => {
  const base = defaultPackingState("belgium");

  it("accepts a stay from another edition, so the pair can be repaired rather than discarded", () => {
    /*
      The stay/edition pair is reconciled rather than rejected: see the comment on
      the schema. Rejecting it would throw away a reader's ticks over one field
      that a catalogue change can legitimately invalidate.
    */
    expect(packingStateSchema.safeParse({ ...base, stay: "winter-resort" }).success).toBe(true);
  });

  it("rejects an unknown edition or stay", () => {
    expect(packingStateSchema.safeParse({ ...base, edition: "mars" }).success).toBe(false);
    expect(packingStateSchema.safeParse({ ...base, stay: "belgium-yacht" }).success).toBe(false);
  });
  it("rejects an unknown extra key", () => {
    expect(packingStateSchema.safeParse({ ...base, injected: true }).success).toBe(false);
  });

  it("rejects a value that is not an object", () => {
    for (const value of [null, 42, "plan", [1, 2, 3]]) {
      expect(packingStateSchema.safeParse(value).success).toBe(false);
    }
  });

  it("rejects a duplicate packed id and a duplicate custom id", () => {
    expect(packingStateSchema.safeParse({ ...base, packed: ["a", "a"] }).success).toBe(false);
    expect(
      packingStateSchema.safeParse({
        ...base,
        custom: [
          { id: "custom-1", label: "One" },
          { id: "custom-1", label: "Two" },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a custom id the tool would not generate", () => {
    for (const id of ["1", "custom-", "custom-ABC", "custom-1-2", "custom-12345678901234567", ""]) {
      expect(
        packingStateSchema.safeParse({ ...base, custom: [{ id, label: "Item" }] }).success,
        id,
      ).toBe(false);
    }
    expect(
      packingStateSchema.safeParse({ ...base, custom: [{ id: "custom-7", label: "Item" }] }).success,
    ).toBe(true);
  });

  it("rejects an over-long label and an empty one", () => {
    const long = "x".repeat(MAX_CUSTOM_LABEL + 1);
    expect(
      packingStateSchema.safeParse({ ...base, custom: [{ id: "custom-1", label: long }] }).success,
    ).toBe(false);
    expect(
      packingStateSchema.safeParse({ ...base, custom: [{ id: "custom-1", label: "" }] }).success,
    ).toBe(false);
    expect(
      packingStateSchema.safeParse({
        ...base,
        custom: [{ id: "custom-1", label: "x".repeat(MAX_CUSTOM_LABEL) }],
      }).success,
    ).toBe(true);
  });

  it("caps the number of custom items and packed ids", () => {
    const manyCustom = Array.from({ length: MAX_CUSTOM_ITEMS + 1 }, (_, index) => ({
      id: `custom-${index + 1}`,
      label: `Item ${index + 1}`,
    }));
    expect(packingStateSchema.safeParse({ ...base, custom: manyCustom }).success).toBe(false);

    const manyPacked = Array.from({ length: MAX_PACKED_IDS + 1 }, (_, index) => `id-${index}`);
    expect(packingStateSchema.safeParse({ ...base, packed: manyPacked }).success).toBe(false);
  });
});

describe("repairPackingState", () => {
  it("leaves a valid pair alone", () => {
    const state = defaultPackingState("winter");
    expect(repairPackingState(state)).toEqual({ state, repaired: false });
  });

  it("moves an impossible stay onto the edition's first stay and keeps the rest", () => {
    const state: PackingState = {
      edition: "winter",
      stay: "belgium-dreamville",
      packed: ["winter-helmet"],
      custom: [{ id: "custom-1", label: "Hand warmers" }],
    };
    const result = repairPackingState(state);
    expect(result.repaired).toBe(true);
    expect(result.state.stay).toBe("winter-resort");
    expect(result.state.packed).toEqual(["winter-helmet"]);
    expect(result.state.custom).toEqual([{ id: "custom-1", label: "Hand warmers" }]);
  });
});

describe("nextCustomId", () => {
  it("returns custom-1 for an empty list", () => {
    expect(nextCustomId([])).toBe("custom-1");
  });

  it("continues past the highest id rather than filling gaps", () => {
    expect(nextCustomId([{ id: "custom-1" }, { id: "custom-3" }])).toBe("custom-4");
  });

  it("ignores ids it would not have written, so a tampered value cannot loop", () => {
    expect(nextCustomId([{ id: "custom-z" }, { id: "custom-" }, { id: "nonsense" }])).toBe("custom-1");
    expect(nextCustomId([{ id: "custom-999999999999999999999999" }])).toBe("custom-1");
  });
});

describe("addCustomItem", () => {
  const base = defaultPackingState("belgium");

  it("adds a cleaned item", () => {
    const result = addCustomItem(base, "  Sleep   mask  ");
    expect(result.problem).toBeNull();
    expect(result.state.custom).toEqual([{ id: "custom-1", label: "Sleep mask" }]);
  });

  it("refuses an empty label", () => {
    expect(addCustomItem(base, "   ").problem).toBe("empty");
    expect(addCustomItem(base, "   ").state).toBe(base);
  });

  it("refuses a label that is too long and stores nothing", () => {
    const result = addCustomItem(base, "x".repeat(MAX_CUSTOM_LABEL + 1));
    expect(result.problem).toBe("too-long");
    expect(result.state.custom).toEqual([]);
  });

  it("accepts a label exactly at the limit", () => {
    const result = addCustomItem(base, "x".repeat(MAX_CUSTOM_LABEL));
    expect(result.problem).toBeNull();
    expect(result.state.custom[0]?.label).toHaveLength(MAX_CUSTOM_LABEL);
  });

  it("recognises a duplicate regardless of case and spacing", () => {
    const first = addCustomItem(base, "Sleep mask").state;
    expect(addCustomItem(first, "  sleep   MASK ").problem).toBe("duplicate");
    expect(first.custom).toHaveLength(1);
  });

  it("refuses the item past the cap", () => {
    let state = base;
    for (let index = 0; index < MAX_CUSTOM_ITEMS; index += 1) {
      state = addCustomItem(state, `Item ${index}`).state;
    }
    expect(state.custom).toHaveLength(MAX_CUSTOM_ITEMS);
    expect(addCustomItem(state, "One too many").problem).toBe("full");
  });

  it("generates ids that pass the schema", () => {
    let state = base;
    for (let index = 0; index < 5; index += 1) {
      state = addCustomItem(state, `Item ${index}`).state;
    }
    expect(packingStateSchema.safeParse(state).success).toBe(true);
    expect(state.custom.map((item) => item.id)).toEqual([
      "custom-1",
      "custom-2",
      "custom-3",
      "custom-4",
      "custom-5",
    ]);
  });
});

describe("removeCustomItem and resetTicks", () => {
  const withItems: PackingState = {
    edition: "belgium",
    stay: "belgium-dreamville",
    packed: ["custom-1", "belgium-photo-id"],
    custom: [
      { id: "custom-1", label: "Sleep mask" },
      { id: "custom-2", label: "Earplugs" },
    ],
  };

  it("removes the item and its tick together", () => {
    const next = removeCustomItem(withItems, "custom-1");
    expect(next.custom.map((item) => item.id)).toEqual(["custom-2"]);
    expect(next.packed).toEqual(["belgium-photo-id"]);
  });

  it("leaves the state alone when the id is not there", () => {
    const next = removeCustomItem(withItems, "custom-9");
    expect(next.custom).toHaveLength(2);
    expect(next.packed).toEqual(["custom-1", "belgium-photo-id"]);
  });

  it("clears ticks but keeps the reader's own items and their choice", () => {
    const reset = resetTicks(withItems);
    expect(reset.packed).toEqual([]);
    expect(reset.custom).toHaveLength(2);
    expect(reset.edition).toBe("belgium");
    expect(reset.stay).toBe("belgium-dreamville");
  });
});

describe("togglePacked", () => {
  const base = defaultPackingState("belgium");

  it("adds then removes an id", () => {
    const on = togglePacked(base, "belgium-photo-id");
    expect(on.packed).toEqual(["belgium-photo-id"]);
    const off = togglePacked(on, "belgium-photo-id");
    expect(off.packed).toEqual([]);
  });

  it("will not exceed the packed-id cap", () => {
    const full: PackingState = {
      ...base,
      packed: Array.from({ length: MAX_PACKED_IDS }, (_, index) => `id-${index}`),
    };
    expect(togglePacked(full, "one-more").packed).toHaveLength(MAX_PACKED_IDS);
    // Removal still works at the cap.
    expect(togglePacked(full, "id-0").packed).toHaveLength(MAX_PACKED_IDS - 1);
  });

  it("does not mutate the state it is given", () => {
    const before = [...base.packed];
    togglePacked(base, "x");
    expect(base.packed).toEqual(before);
  });
});

describe("loadPackingState", () => {
  it("returns the default when there is nothing stored", () => {
    expect(loadPackingState(memoryStorage())).toEqual({
      state: defaultPackingState("belgium"),
      discarded: false,
      repaired: false,
    });
  });

  it("returns the requested edition's default on a first visit", () => {
    expect(loadPackingState(memoryStorage(), "winter").state.stay).toBe("winter-resort");
  });

  it("treats a null storage as a first visit rather than throwing", () => {
    expect(loadPackingState(null).discarded).toBe(false);
  });

  it("reads a valid record", () => {
    const stored: PackingState = {
      edition: "winter",
      stay: "winter-outside",
      packed: ["winter-transport-pass"],
      custom: [{ id: "custom-1", label: "Hand warmers" }],
    };
    const result = loadPackingState(memoryStorage({ [PACKING_STORAGE_KEY]: JSON.stringify(stored) }));
    expect(result).toEqual({ state: stored, discarded: false, repaired: false });
  });

  it("discards invalid JSON", () => {
    const result = loadPackingState(memoryStorage({ [PACKING_STORAGE_KEY]: "{not json" }));
    expect(result.state).toEqual(defaultPackingState("belgium"));
    expect(result.discarded).toBe(true);
  });

  it("discards a record that fails the schema, including a tampered label", () => {
    const tooLong = JSON.stringify({
      edition: "belgium",
      stay: "belgium-dreamville",
      packed: [],
      custom: [{ id: "custom-1", label: "x".repeat(5000) }],
    });
    expect(loadPackingState(memoryStorage({ [PACKING_STORAGE_KEY]: tooLong })).discarded).toBe(true);
  });

  it("discards a value that is not an object", () => {
    for (const value of ["null", "42", '"plan"', "[1,2,3]", "true"]) {
      expect(loadPackingState(memoryStorage({ [PACKING_STORAGE_KEY]: value })).discarded, value).toBe(
        true,
      );
    }
  });

  it("discards an oversized value without parsing it", () => {
    const huge = "x".repeat(MAX_STORED_LENGTH + 1);
    const result = loadPackingState(memoryStorage({ [PACKING_STORAGE_KEY]: huge }));
    expect(result.discarded).toBe(true);
  });

  it("treats an empty stored value as absent, not corrupt", () => {
    const result = loadPackingState(memoryStorage({ [PACKING_STORAGE_KEY]: "" }));
    expect(result).toEqual({ state: defaultPackingState("belgium"), discarded: false, repaired: false });
  });

  it("never throws when storage itself throws", () => {
    expect(() => loadPackingState(refusingStorage)).not.toThrow();
    expect(loadPackingState(refusingStorage)).toEqual({
      state: defaultPackingState("belgium"),
      discarded: false,
      repaired: false,
    });
  });

  it("repairs a record whose stay does not belong to its edition, keeping the ticks", () => {
    const stored = JSON.stringify({
      edition: "winter",
      stay: "belgium-dreamville",
      packed: ["winter-helmet"],
      custom: [{ id: "custom-1", label: "Hand warmers" }],
    });
    const result = loadPackingState(memoryStorage({ [PACKING_STORAGE_KEY]: stored }));
    expect(result.discarded).toBe(false);
    expect(result.repaired).toBe(true);
    expect(result.state.stay).toBe("winter-resort");
    expect(result.state.packed).toEqual(["winter-helmet"]);
    expect(result.state.custom).toEqual([{ id: "custom-1", label: "Hand warmers" }]);
  });
});

describe("savePackingState and clearPackingState", () => {
  it("writes one key and removes it again", () => {
    const storage = memoryStorage();
    const state = defaultPackingState("belgium");
    savePackingState(storage, state);
    expect(JSON.parse(storage.dump()[PACKING_STORAGE_KEY])).toEqual(state);
    clearPackingState(storage);
    expect(storage.dump()[PACKING_STORAGE_KEY]).toBeUndefined();
  });

  it("keeps the largest record it can write under the size it will read back", () => {
    /*
      The write guard is a last line of defence, not routine behaviour. The
      invariant that matters is this one: a record built from the schema's own
      limits is always smaller than the length `loadPackingState` refuses. If a
      limit is raised later, this test fails before the tool can write a record
      it would then refuse to read.
    */
    const maximal: PackingState = {
      edition: "belgium",
      stay: "belgium-dreamville",
      packed: Array.from({ length: MAX_PACKED_IDS }, (_, index) => `${index}`.padEnd(80, "x")),
      custom: Array.from({ length: MAX_CUSTOM_ITEMS }, (_, index) => ({
        id: `custom-${index + 1}`,
        label: "x".repeat(MAX_CUSTOM_LABEL),
      })),
    };
    expect(packingStateSchema.safeParse(maximal).success).toBe(true);
    expect(JSON.stringify(maximal).length).toBeLessThan(MAX_STORED_LENGTH);
  });

  it("refuses to write a record longer than it would read back", () => {
    const storage = memoryStorage();
    /*
      Cast through `unknown` on purpose: this value cannot come from the
      interface or from the schema, which is exactly why the guard exists. It
      stands in for a future caller that skips the schema.
    */
    const oversized = {
      ...defaultPackingState("belgium"),
      packed: ["x".repeat(MAX_STORED_LENGTH)],
    } as unknown as PackingState;

    savePackingState(storage, oversized);
    expect(storage.dump()[PACKING_STORAGE_KEY]).toBeUndefined();
  });

  it("swallows a refused write so the checklist keeps working", () => {
    expect(() => savePackingState(refusingStorage, defaultPackingState())).not.toThrow();
    expect(() => clearPackingState(refusingStorage)).not.toThrow();
  });

  it("does nothing without storage", () => {
    expect(() => savePackingState(null, defaultPackingState())).not.toThrow();
    expect(() => clearPackingState(null)).not.toThrow();
  });

  it("round-trips a realistic record", () => {
    const storage = memoryStorage();
    const state: PackingState = {
      edition: "brasil",
      stay: "brasil-dreamville",
      packed: ["brasil-own-gear", "custom-1"],
      custom: [{ id: "custom-1", label: "Earplugs" }],
    };
    savePackingState(storage, state);
    expect(loadPackingState(storage).state).toEqual(state);
  });
});

describe("stayAfterEditionChange", () => {
  it("keeps a stay that belongs to the new edition", () => {
    expect(stayAfterEditionChange("belgium", "belgium-hotel-day")).toBe("belgium-hotel-day");
  });

  it("moves to the new edition's first stay otherwise", () => {
    expect(stayAfterEditionChange("winter", "belgium-dreamville")).toBe("winter-resort");
  });
});

describe("createPackingStore", () => {
  it("serves the default snapshot to the server, so hydration cannot mismatch", () => {
    const store = createPackingStore("winter");
    const server = store.getServerSnapshot();
    expect(server.hydrated).toBe(false);
    expect(server.state.stay).toBe("winter-resort");
    expect(server.discarded).toBe(false);
  });

  it("returns a stable client snapshot between changes", () => {
    const storage = memoryStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage, addEventListener: () => {}, removeEventListener: () => {} },
    });

    const store = createPackingStore("belgium");
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    expect(store.getSnapshot().hydrated).toBe(true);

    // A second read after a write returns a new object, not a mutated one.
    const before = store.getSnapshot();
    store.update((current) => togglePacked(current, "belgium-photo-id"));
    expect(store.getSnapshot()).not.toBe(before);
    expect(before.state.packed).toEqual([]);

    Reflect.deleteProperty(globalThis, "window");
  });

  it("notifies subscribers and persists the change", () => {
    const storage = memoryStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage, addEventListener: () => {}, removeEventListener: () => {} },
    });

    const store = createPackingStore("belgium");
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.update((current) => togglePacked(current, "belgium-photo-id"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.dump()[PACKING_STORAGE_KEY] ?? "{}").packed).toEqual([
      "belgium-photo-id",
    ]);

    unsubscribe();
    store.update((current) => togglePacked(current, "belgium-torch"));
    expect(listener).toHaveBeenCalledTimes(1);

    Reflect.deleteProperty(globalThis, "window");
  });

  it("does not notify when an update changes nothing", () => {
    const storage = memoryStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage, addEventListener: () => {}, removeEventListener: () => {} },
    });

    const store = createPackingStore("belgium");
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((current) => current);
    expect(listener).not.toHaveBeenCalled();

    Reflect.deleteProperty(globalThis, "window");
  });

  it("survives a storage that refuses to write", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: refusingStorage,
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });

    const store = createPackingStore("belgium");
    expect(() => store.update((current) => togglePacked(current, "belgium-photo-id"))).not.toThrow();
    // The in-memory snapshot still carries the change for this visit.
    expect(store.getSnapshot().state.packed).toEqual(["belgium-photo-id"]);

    Reflect.deleteProperty(globalThis, "window");
  });
});

describe("safeLocalStorage", () => {
  it("returns null in a node environment with no window", () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(safeLocalStorage()).toBeNull();
  });
});
