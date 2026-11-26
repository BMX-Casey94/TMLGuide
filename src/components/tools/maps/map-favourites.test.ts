import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DE_SCHORRE_MAP, DREAMVILLE_MAP, VENUE_MAPS } from "@/lib/maps/geo-data";
import {
  EMPTY_FAVOURITES,
  FAVOURITES_STORAGE_KEY,
  MAX_FAVOURITES_PER_VENUE,
  readFavourites,
  toggleFavourite,
  writeFavourites,
  type FavouritesByVenue,
} from "./map-favourites";

/** A fresh in-memory Storage; this environment's `localStorage` is inert. */
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
  } as Storage;
}

function installStorage(value: Storage | undefined): void {
  Object.defineProperty(window, "localStorage", { configurable: true, writable: true, value });
}

beforeEach(() => {
  installStorage(memoryStorage());
});

afterEach(() => {
  installStorage(memoryStorage());
});

describe("the storage key", () => {
  it("is the documented, namespaced, versioned key", () => {
    expect(FAVOURITES_STORAGE_KEY).toBe("tml-map-favourites-v1");
  });
});

describe("readFavourites", () => {
  it("returns empty favourites when nothing is stored", () => {
    expect(readFavourites(VENUE_MAPS)).toEqual(EMPTY_FAVOURITES);
  });

  it("reads both venues back", () => {
    window.localStorage.setItem(
      FAVOURITES_STORAGE_KEY,
      JSON.stringify({ "de-schorre": ["ds-mainstage"], dreamville: ["dv-montagoe"] }),
    );

    expect(readFavourites(VENUE_MAPS)).toEqual({
      "de-schorre": ["ds-mainstage"],
      dreamville: ["dv-montagoe"],
    });
  });

  it("drops an id that is not on that venue, rather than trusting the file", () => {
    window.localStorage.setItem(
      FAVOURITES_STORAGE_KEY,
      JSON.stringify({
        "de-schorre": ["ds-mainstage", "dv-montagoe", "invented"],
        dreamville: [],
      }),
    );

    // `dv-montagoe` is a real node, but of the other venue, so it must not appear
    // in De Schorre's list.
    expect(readFavourites(VENUE_MAPS)["de-schorre"]).toEqual(["ds-mainstage"]);
  });

  it("de-duplicates ids", () => {
    window.localStorage.setItem(
      FAVOURITES_STORAGE_KEY,
      JSON.stringify({ "de-schorre": ["ds-core", "ds-core", "ds-core"], dreamville: [] }),
    );
    expect(readFavourites(VENUE_MAPS)["de-schorre"]).toEqual(["ds-core"]);
  });

  it("caps the list, so a hostile value cannot grow without bound", () => {
    const many = [...DE_SCHORRE_MAP.nodes.map((node) => node.id), ...DE_SCHORRE_MAP.nodes.map((node) => node.id)];
    window.localStorage.setItem(
      FAVOURITES_STORAGE_KEY,
      JSON.stringify({ "de-schorre": many, dreamville: [] }),
    );
    expect(readFavourites(VENUE_MAPS)["de-schorre"].length).toBeLessThanOrEqual(MAX_FAVOURITES_PER_VENUE);
  });

  it("clears a value that is not JSON, and reports empty favourites", () => {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, "{ not json");

    expect(readFavourites(VENUE_MAPS)).toEqual(EMPTY_FAVOURITES);
    expect(window.localStorage.getItem(FAVOURITES_STORAGE_KEY)).toBeNull();
  });

  it("survives JSON that is not an object", () => {
    for (const value of ["null", "[]", '"a string"', "42", "true"]) {
      window.localStorage.setItem(FAVOURITES_STORAGE_KEY, value);
      expect(readFavourites(VENUE_MAPS), value).toEqual(EMPTY_FAVOURITES);
    }
  });

  it("ignores a venue entry that is not an array of strings", () => {
    window.localStorage.setItem(
      FAVOURITES_STORAGE_KEY,
      JSON.stringify({ "de-schorre": "ds-mainstage", dreamville: [1, {}, null, "dv-montagoe"] }),
    );

    const read = readFavourites(VENUE_MAPS);
    expect(read["de-schorre"]).toEqual([]);
    expect(read.dreamville).toEqual(["dv-montagoe"]);
  });

  it("returns empty favourites when storage cannot be reached at all", () => {
    installStorage(undefined);
    expect(readFavourites(VENUE_MAPS)).toEqual(EMPTY_FAVOURITES);
  });

  it("returns empty favourites when reading throws", () => {
    installStorage({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as unknown as Storage);

    expect(readFavourites(VENUE_MAPS)).toEqual(EMPTY_FAVOURITES);
  });
});

describe("writeFavourites", () => {
  it("writes exactly the two venue keys and nothing else", () => {
    const ok = writeFavourites({ "de-schorre": ["ds-mainstage"], dreamville: [] });
    expect(ok).toBe(true);

    const raw = window.localStorage.getItem(FAVOURITES_STORAGE_KEY) as string;
    expect(Object.keys(JSON.parse(raw) as object).sort()).toEqual(["de-schorre", "dreamville"]);
    // No name, no time, no identifier: node ids are meaningless outside this guide.
    expect(raw).not.toMatch(/@|\d{4}-\d{2}-\d{2}T|userId|device/i);
  });

  it("reports failure rather than throwing when the write is refused", () => {
    installStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as unknown as Storage);

    expect(writeFavourites({ "de-schorre": ["ds-mainstage"], dreamville: [] })).toBe(false);
  });

  it("reports failure when there is no storage at all", () => {
    installStorage(undefined);
    expect(writeFavourites(EMPTY_FAVOURITES)).toBe(false);
  });

  it("round-trips through a read", () => {
    const value: FavouritesByVenue = {
      "de-schorre": ["ds-mainstage", "ds-core"],
      dreamville: ["dv-montagoe"],
    };
    expect(writeFavourites(value)).toBe(true);
    expect(readFavourites(VENUE_MAPS)).toEqual(value);
  });
});

describe("toggleFavourite", () => {
  it("adds an id that is not there", () => {
    expect(toggleFavourite(EMPTY_FAVOURITES, "de-schorre", "ds-core")).toEqual({
      "de-schorre": ["ds-core"],
      dreamville: [],
    });
  });

  it("removes an id that is there", () => {
    const start: FavouritesByVenue = { "de-schorre": ["ds-core", "ds-mainstage"], dreamville: [] };
    expect(toggleFavourite(start, "de-schorre", "ds-core")["de-schorre"]).toEqual(["ds-mainstage"]);
  });

  it("leaves the other venue alone", () => {
    const start: FavouritesByVenue = { "de-schorre": [], dreamville: ["dv-easy-tent"] };
    expect(toggleFavourite(start, "de-schorre", "ds-core").dreamville).toEqual(["dv-easy-tent"]);
  });

  it("does not mutate the value it was given", () => {
    const start: FavouritesByVenue = { "de-schorre": ["ds-core"], dreamville: [] };
    const next = toggleFavourite(start, "de-schorre", "ds-mainstage");
    expect(start["de-schorre"]).toEqual(["ds-core"]);
    expect(next["de-schorre"]).toEqual(["ds-core", "ds-mainstage"]);
  });

  it("refuses to grow past the cap, rather than dropping the visitor's oldest choice", () => {
    const full = Array.from({ length: MAX_FAVOURITES_PER_VENUE }, (_, index) => `id-${index}`);
    const start: FavouritesByVenue = { "de-schorre": full, dreamville: [] };
    const next = toggleFavourite(start, "de-schorre", "one-more");
    expect(next["de-schorre"]).toHaveLength(MAX_FAVOURITES_PER_VENUE);
    expect(next["de-schorre"]).not.toContain("one-more");
  });

  it("still removes when the list is full", () => {
    const full = Array.from({ length: MAX_FAVOURITES_PER_VENUE }, (_, index) => `id-${index}`);
    const start: FavouritesByVenue = { "de-schorre": full, dreamville: [] };
    const next = toggleFavourite(start, "de-schorre", "id-0");
    expect(next["de-schorre"]).toHaveLength(MAX_FAVOURITES_PER_VENUE - 1);
    expect(next["de-schorre"]).not.toContain("id-0");
  });
});

describe("the venues this store indexes", () => {
  it("has a slot for each venue the map knows", () => {
    expect(Object.keys(EMPTY_FAVOURITES).sort()).toEqual(["de-schorre", "dreamville"]);
    expect(DREAMVILLE_MAP.nodes.length).toBeGreaterThan(0);
  });
});
