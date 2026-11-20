// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { StorageLike } from "../state";
import {
  ARRIVAL_OPTIONS,
  EDITION_OPTIONS,
  JOURNEY_STORAGE_KEY,
  SLEEP_OPTIONS,
  clearJourneyState,
  defaultJourneyState,
  isSupportedSleep,
  journeyStateSchema,
  loadJourneyState,
  normaliseJourneyState,
  saveJourneyState,
  type JourneyState,
} from "./journey-state";

/** A fresh in-memory Storage, so no test shares state with another. */
function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  readonly dump: () => Record<string, string>;
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

/** A storage whose reads and writes both throw, as private mode does. */
const hostileStorage: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("journeyStateSchema", () => {
  it("accepts the default state for both editions", () => {
    expect(journeyStateSchema.safeParse(defaultJourneyState("belgium")).success).toBe(true);
    expect(journeyStateSchema.safeParse(defaultJourneyState("winter")).success).toBe(true);
  });

  it("refuses Brasil, which this tool does not cover", () => {
    expect(
      journeyStateSchema.safeParse({ edition: "brasil", sleep: "hotel", arrival: "flying" }).success,
    ).toBe(false);
  });

  it("refuses an unknown bed, an unknown arrival method and unknown keys", () => {
    expect(
      journeyStateSchema.safeParse({ edition: "belgium", sleep: "yurt", arrival: "flying" }).success,
    ).toBe(false);
    expect(
      journeyStateSchema.safeParse({ edition: "belgium", sleep: "hotel", arrival: "teleport" })
        .success,
    ).toBe(false);
    expect(
      journeyStateSchema.safeParse({
        edition: "belgium",
        sleep: "hotel",
        arrival: "flying",
        injected: "x",
      }).success,
    ).toBe(false);
  });

  it("refuses non-string values and null", () => {
    expect(journeyStateSchema.safeParse(null).success).toBe(false);
    expect(
      journeyStateSchema.safeParse({ edition: 1, sleep: "hotel", arrival: "flying" }).success,
    ).toBe(false);
  });
});

describe("bed vocabulary", () => {
  it("offers only the beds the edition's data describes", () => {
    expect(SLEEP_OPTIONS.belgium.map((entry) => entry.id)).toEqual(["dreamville", "hotel"]);
    expect(SLEEP_OPTIONS.winter.map((entry) => entry.id)).toEqual(["resort", "oz3300", "village"]);
  });

  it("keeps the two editions' vocabularies disjoint, so no bed is offered where it does not exist", () => {
    const belgium = new Set(SLEEP_OPTIONS.belgium.map((entry) => entry.id));
    const shared = SLEEP_OPTIONS.winter.filter((entry) => belgium.has(entry.id));
    expect(shared).toEqual([]);
  });

  it("has a default bed per edition that the edition itself supports", () => {
    for (const edition of ["belgium", "winter"] as const) {
      const fallback = defaultJourneyState(edition).sleep;
      expect(isSupportedSleep(edition, fallback)).toBe(true);
    }
  });

  it("labels every edition and arrival method", () => {
    expect(EDITION_OPTIONS).toHaveLength(2);
    expect(ARRIVAL_OPTIONS.map((entry) => entry.id)).toEqual([
      "flying",
      "train",
      "driving",
      "coach",
    ]);
    for (const option of [...EDITION_OPTIONS, ...ARRIVAL_OPTIONS]) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.note.length).toBeGreaterThan(0);
    }
  });
});

describe("normaliseJourneyState", () => {
  it("leaves a supported combination alone", () => {
    const state: JourneyState = { edition: "winter", sleep: "oz3300", arrival: "train" };
    expect(normaliseJourneyState(state)).toEqual({ state, repaired: false });
  });

  it("moves a bed from the other edition onto this edition's default", () => {
    const migrated = normaliseJourneyState({
      edition: "winter",
      sleep: "dreamville",
      arrival: "coach",
    });
    expect(migrated.repaired).toBe(true);
    expect(migrated.state.edition).toBe("winter");
    expect(migrated.state.arrival).toBe("coach");
    expect(isSupportedSleep("winter", migrated.state.sleep)).toBe(true);
  });
});

describe("loadJourneyState", () => {
  it("returns the default plan when nothing is stored", () => {
    const loaded = loadJourneyState(memoryStorage());
    expect(loaded.state).toEqual(defaultJourneyState("belgium"));
    expect(loaded.discarded).toBe(false);
    expect(loaded.repaired).toBe(false);
  });

  it("restores a stored plan", () => {
    const storage = memoryStorage({
      [JOURNEY_STORAGE_KEY]: JSON.stringify({
        edition: "winter",
        sleep: "village",
        arrival: "driving",
      }),
    });
    const loaded = loadJourneyState(storage);
    expect(loaded.state).toEqual({ edition: "winter", sleep: "village", arrival: "driving" });
    expect(loaded.discarded).toBe(false);
  });

  it("falls back safely on tampered JSON, and says it did", () => {
    const tampered = [
      "not json at all",
      "{}",
      "null",
      "[]",
      '{"edition":"winter","sleep":"dreamville","arrival":"flying","extra":1}',
      '{"edition":"mars","sleep":"hotel","arrival":"flying"}',
      '{"edition":"belgium","sleep":"hotel","arrival":"flying","__proto__":{"polluted":true}}',
      '{"edition":"belgium","sleep":"hotel"}',
      '"belgium"',
      "12345",
    ];

    for (const raw of tampered) {
      const loaded = loadJourneyState(memoryStorage({ [JOURNEY_STORAGE_KEY]: raw }));
      expect(loaded.discarded, raw).toBe(true);
      expect(journeyStateSchema.safeParse(loaded.state).success).toBe(true);
      expect(loaded.state.edition).toBe("belgium");
    }

    /* A tampered record must not have reached Object.prototype. */
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("repairs a valid record whose bed belongs to the other edition, keeping the other choices", () => {
    const storage = memoryStorage({
      [JOURNEY_STORAGE_KEY]: JSON.stringify({
        edition: "belgium",
        sleep: "village",
        arrival: "train",
      }),
    });
    /* `village` is a Winter bed but a valid slug, so the record passes the schema.
       The edition and the arrival method are the reader's own choices and survive;
       only the bed moves, and the page says so. */
    const loaded = loadJourneyState(storage);
    expect(loaded.discarded).toBe(false);
    expect(loaded.repaired).toBe(true);
    expect(loaded.state.edition).toBe("belgium");
    expect(loaded.state.arrival).toBe("train");
    expect(loaded.state.sleep).toBe("dreamville");
  });

  it("never throws when storage itself throws", () => {
    expect(() => loadJourneyState(hostileStorage)).not.toThrow();
    expect(loadJourneyState(hostileStorage).state).toEqual(defaultJourneyState("belgium"));
    expect(loadJourneyState(null).state).toEqual(defaultJourneyState("belgium"));
  });

  it("never throws on an oversized or deeply nested record", () => {
    const deep = `${"[".repeat(400)}${"]".repeat(400)}`;
    expect(() => loadJourneyState(memoryStorage({ [JOURNEY_STORAGE_KEY]: deep }))).not.toThrow();
  });
});

describe("saveJourneyState and clearJourneyState", () => {
  it("round-trips a valid plan", () => {
    const storage = memoryStorage();
    const state: JourneyState = { edition: "winter", sleep: "resort", arrival: "flying" };
    saveJourneyState(storage, state);
    expect(loadJourneyState(storage).state).toEqual(state);
  });

  it("ignores a refused write rather than throwing", () => {
    const state: JourneyState = { edition: "belgium", sleep: "hotel", arrival: "coach" };
    expect(() => saveJourneyState(hostileStorage, state)).not.toThrow();
    expect(() => saveJourneyState(null, state)).not.toThrow();
  });

  it("clears a stored plan, so the next load is the default again", () => {
    const storage = memoryStorage();
    saveJourneyState(storage, { edition: "winter", sleep: "oz3300", arrival: "train" });
    clearJourneyState(storage);
    expect(storage.dump()).toEqual({});
    expect(loadJourneyState(storage).state).toEqual(defaultJourneyState("belgium"));
  });

  it("ignores a refused removal rather than throwing", () => {
    expect(() => clearJourneyState(hostileStorage)).not.toThrow();
  });
});
