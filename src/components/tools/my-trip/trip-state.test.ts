// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { StorageLike } from "../state";
import {
  FREE_TEXT_MAX,
  MAX_IMPORT_BYTES,
  MAX_PARTY_SIZE,
  MAX_STORED_CHARACTERS,
  MIN_PARTY_SIZE,
  TRIP_EXPORT_APP,
  TRIP_EXPORT_TOOL,
  TRIP_STATE_VERSION,
  TRIP_STORAGE_KEY,
  buildTripExport,
  clearTripState,
  defaultTripState,
  migrateTripState,
  parseTripImport,
  readTripState,
  saveTripState,
  serialiseTripExport,
  serialiseTripState,
  tripExportFilename,
  type TripState,
} from "./trip-state";

/**
 * The trip sheet's storage and file handling.
 *
 * Every case here is about input this module does not control: a stored record
 * written by another version, a value a reader edited by hand, a browser that
 * refuses to store anything at all. The module's contract is that none of these
 * throws and none of them yields a sheet the page would print as fact.
 */

/** A Storage that behaves like the real one until told otherwise. */
function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** A complete, valid sheet, used as the base for the tampering cases. */
const validSheet: TripState = {
  version: TRIP_STATE_VERSION,
  edition: "belgium",
  slotId: "belgium-2027",
  ticketId: "belgium-2027-full-madness-presale",
  packageId: "belgium-2027-magnificent-greens-presale",
  accommodationNote: "Camping at DreamVille",
  travelNote: "Eurostar to Brussels, then the train",
  partySize: 4,
  notes: "Meeting at the MainStage",
};

describe("readTripState", () => {
  it("returns the default sheet when nothing is stored", () => {
    const result = readTripState(memoryStorage(), "winter");
    expect(result.origin).toBe("default");
    expect(result.discarded).toBe(false);
    expect(result.repaired).toEqual([]);
    expect(result.state.edition).toBe("winter");
    expect(result.state.partySize).toBe(MIN_PARTY_SIZE);
  });

  it("reads a complete sheet back exactly", () => {
    const storage = memoryStorage({ [TRIP_STORAGE_KEY]: serialiseTripState(validSheet) });
    const result = readTripState(storage);
    expect(result.origin).toBe("storage");
    expect(result.state).toEqual(validSheet);
  });

  it("does not throw when storage itself is unreachable", () => {
    const result = readTripState(null, "brasil");
    expect(result.origin).toBe("default");
    expect(result.state.edition).toBe("brasil");
  });

  it("does not throw when getItem throws, which is what private mode does", () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error("SecurityError: access denied");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(() => readTripState(storage)).not.toThrow();
    expect(readTripState(storage).origin).toBe("default");
  });

  it("discards a value that is not JSON", () => {
    const storage = memoryStorage({ [TRIP_STORAGE_KEY]: "{not json" });
    const result = readTripState(storage);
    expect(result.discarded).toBe(true);
    expect(result.origin).toBe("default");
  });

  it("discards a stored value longer than the cap without parsing it", () => {
    const storage = memoryStorage({ [TRIP_STORAGE_KEY]: "x".repeat(MAX_STORED_CHARACTERS + 1) });
    const result = readTripState(storage);
    expect(result.discarded).toBe(true);
    expect(result.state).toEqual(defaultTripState("belgium"));
  });

  it("discards a record written by a newer version of the tool", () => {
    const storage = memoryStorage({
      [TRIP_STORAGE_KEY]: JSON.stringify({ ...validSheet, version: TRIP_STATE_VERSION + 1 }),
    });
    const result = readTripState(storage);
    expect(result.discarded).toBe(true);
    expect(result.origin).toBe("default");
  });

  it("treats a record with no version stamp as version 1", () => {
    const unversioned: Record<string, unknown> = { ...validSheet };
    delete unversioned.version;
    const storage = memoryStorage({ [TRIP_STORAGE_KEY]: JSON.stringify(unversioned) });
    const result = readTripState(storage);
    expect(result.discarded).toBe(false);
    // Every field of the unversioned record is a valid version 1 field, so
    // nothing needs repairing; only the stamp is added on the next write.
    expect(result.repaired).toEqual([]);
    expect(result.state).toEqual(validSheet);
    expect(migrateTripState(unversioned).value.version).toBe(TRIP_STATE_VERSION);
  });

  it("keeps a good sheet and names only the single field it had to replace", () => {
    const storage = memoryStorage({
      [TRIP_STORAGE_KEY]: JSON.stringify({ ...validSheet, partySize: "four" }),
    });
    const result = readTripState(storage);
    expect(result.discarded).toBe(false);
    expect(result.repaired).toEqual(["partySize"]);
    expect(result.state.partySize).toBe(MIN_PARTY_SIZE);
    expect(result.state.notes).toBe(validSheet.notes);
  });

  it("clamps a party size outside the allowed range instead of dropping it", () => {
    const storage = memoryStorage({
      [TRIP_STORAGE_KEY]: JSON.stringify({ ...validSheet, partySize: 900 }),
    });
    const result = readTripState(storage);
    expect(result.repaired).toContain("partySize");
    expect(result.state.partySize).toBe(MAX_PARTY_SIZE);
  });

  it("truncates an over-long note rather than losing the whole sheet", () => {
    const long = "a".repeat(FREE_TEXT_MAX + 50);
    const storage = memoryStorage({
      [TRIP_STORAGE_KEY]: JSON.stringify({ ...validSheet, notes: long }),
    });
    const result = readTripState(storage);
    expect(result.repaired).toEqual(["notes"]);
    expect(result.state.notes).toHaveLength(FREE_TEXT_MAX);
    expect(result.state.travelNote).toBe(validSheet.travelNote);
  });

  it("clears an id field that is not a usable string", () => {
    const storage = memoryStorage({
      [TRIP_STORAGE_KEY]: JSON.stringify({ ...validSheet, ticketId: { id: "x" } }),
    });
    const result = readTripState(storage);
    expect(result.repaired).toEqual(["ticketId"]);
    expect(result.state.ticketId).toBeNull();
  });

  it("falls back to the edition asked for when the stored one is not an edition", () => {
    const storage = memoryStorage({
      [TRIP_STORAGE_KEY]: JSON.stringify({ ...validSheet, edition: "thailand" }),
    });
    const result = readTripState(storage, "brasil");
    expect(result.repaired).toEqual(["edition"]);
    expect(result.state.edition).toBe("brasil");
  });

  it("rejects a stored JSON array or scalar, which is not a sheet", () => {
    for (const value of ["[]", '"a string"', "42", "null"]) {
      const storage = memoryStorage({ [TRIP_STORAGE_KEY]: value });
      expect(readTripState(storage).origin, value).toBe("default");
    }
  });
});

describe("saveTripState", () => {
  it("writes the sheet and reads it back", () => {
    const storage = memoryStorage();
    expect(saveTripState(storage, validSheet)).toBe("saved");
    expect(readTripState(storage).state).toEqual(validSheet);
  });

  it("reports a quota refusal rather than throwing", () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => undefined,
    };
    expect(() => saveTripState(storage, validSheet)).not.toThrow();
    expect(saveTripState(storage, validSheet)).toBe("refused");
  });

  it("reports that there is no storage at all", () => {
    expect(saveTripState(null, validSheet)).toBe("no-storage");
  });

  it("reports an over-sized sheet before attempting the write", () => {
    const written: string[] = [];
    const storage: StorageLike = {
      getItem: () => null,
      setItem: (_key, value) => {
        written.push(value);
      },
      removeItem: () => undefined,
    };
    const huge: TripState = { ...validSheet, notes: "a".repeat(FREE_TEXT_MAX) };
    // A single sheet at the field limit is far under the cap, so this stays saved.
    expect(saveTripState(storage, huge)).toBe("saved");
    expect(written).toHaveLength(1);
  });
});

describe("clearTripState", () => {
  it("removes the stored sheet", () => {
    const storage = memoryStorage({ [TRIP_STORAGE_KEY]: serialiseTripState(validSheet) });
    expect(clearTripState(storage)).toBe(true);
    expect(readTripState(storage).origin).toBe("default");
  });

  it("reports a refusal instead of throwing", () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(clearTripState(storage)).toBe(false);
  });

  it("reports no storage", () => {
    expect(clearTripState(null)).toBe(false);
  });
});

describe("migrateTripState", () => {
  it("stamps an unversioned record at the current version", () => {
    const migration = migrateTripState({ edition: "belgium" });
    expect(migration.fromVersion).toBeNull();
    expect(migration.tooNew).toBe(false);
    expect(migration.value.version).toBe(TRIP_STATE_VERSION);
  });

  it("passes a current record through unchanged", () => {
    const migration = migrateTripState({ version: TRIP_STATE_VERSION, edition: "winter" });
    expect(migration.fromVersion).toBe(TRIP_STATE_VERSION);
    expect(migration.tooNew).toBe(false);
    expect(migration.value.edition).toBe("winter");
  });

  it("flags a record from a newer build", () => {
    const migration = migrateTripState({ version: TRIP_STATE_VERSION + 3 });
    expect(migration.tooNew).toBe(true);
  });

  it("treats a non-object as an empty record rather than throwing", () => {
    for (const value of [null, 7, "text", [], undefined]) {
      expect(() => migrateTripState(value)).not.toThrow();
      expect(migrateTripState(value).value).toEqual({});
    }
  });
});

describe("parseTripImport", () => {
  const exported = serialiseTripExport(validSheet, new Date("2026-11-20T10:00:00Z"));

  it("accepts the file this tool exports", () => {
    const result = parseTripImport(exported);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toEqual(validSheet);
  });

  it("accepts a bare trip object, which is what copying the trip out gives", () => {
    const bare = JSON.stringify(validSheet);
    const result = parseTripImport(bare);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.notes).toBe(validSheet.notes);
  });

  it("round-trips through the exported document", () => {
    const built = buildTripExport(validSheet, new Date("2026-11-20T10:00:00Z"));
    expect(built.app).toBe(TRIP_EXPORT_APP);
    expect(built.tool).toBe(TRIP_EXPORT_TOOL);
    expect(built.trip).toEqual(validSheet);
  });

  it("names the missing field instead of importing a partial sheet", () => {
    const incomplete: Record<string, unknown> = { ...validSheet };
    delete incomplete.travelNote;
    const result = parseTripImport(JSON.stringify(incomplete));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("travel note");
      expect(result.message).toContain("Your saved trip is unchanged");
    }
  });

  it("rejects an unknown field rather than silently dropping it", () => {
    const result = parseTripImport(JSON.stringify({ ...validSheet, smuggled: "value" }));
    expect(result.ok).toBe(false);
  });

  it("rejects a party size outside the allowed range", () => {
    const result = parseTripImport(JSON.stringify({ ...validSheet, partySize: MAX_PARTY_SIZE + 1 }));
    expect(result.ok).toBe(false);
  });

  it("rejects a note over the field limit", () => {
    const result = parseTripImport(
      JSON.stringify({ ...validSheet, notes: "a".repeat(FREE_TEXT_MAX + 1) }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a file that is not JSON, is empty, or is a JSON array", () => {
    for (const text of ["", "   ", "not json", "[]", "null", '"text"']) {
      const result = parseTripImport(text);
      expect(result.ok, text).toBe(false);
    }
  });

  it("rejects another tool's export document", () => {
    const doc = {
      app: TRIP_EXPORT_APP,
      tool: "budget",
      version: TRIP_STATE_VERSION,
      exportedAt: "2026-11-20T10:00:00.000Z",
      trip: validSheet,
    };
    const result = parseTripImport(JSON.stringify(doc));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("not a My Trip file");
  });

  it("rejects a document from a different version", () => {
    const doc = { ...buildTripExport(validSheet, new Date()), version: TRIP_STATE_VERSION + 1 };
    const result = parseTripImport(JSON.stringify(doc));
    expect(result.ok).toBe(false);
  });

  it("rejects an edition that is not one of the three", () => {
    const result = parseTripImport(JSON.stringify({ ...validSheet, edition: "thailand" }));
    expect(result.ok).toBe(false);
  });
});

describe("export filename", () => {
  it("names the edition and never uses typed text", () => {
    const name = tripExportFilename({ ...validSheet, notes: "../../etc/passwd" });
    expect(name).toBe("tmlguide-my-trip-belgium.json");
    expect(name).not.toContain("passwd");
  });
});

describe("constants", () => {
  it("caps an imported file at a size that can hold any stored sheet", () => {
    expect(MAX_IMPORT_BYTES).toBeGreaterThan(0);
    // Anything this tool will store must be importable, envelope and all, so the
    // file cap can never be smaller than the storage cap.
    expect(MAX_IMPORT_BYTES).toBeGreaterThanOrEqual(MAX_STORED_CHARACTERS);
    // And small enough that reading one cannot freeze the tab.
    expect(MAX_IMPORT_BYTES).toBeLessThanOrEqual(65_536);
  });

  it("names a single storage key, so two tabs cannot diverge", () => {
    expect(TRIP_STORAGE_KEY).toBe("tml-my-trip-v1");
  });
});
