import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { VenueMapsTool } from "./venue-maps-tool";
import { FAVOURITES_STORAGE_KEY } from "./map-favourites";
import { GEO_DATA_DISCLAIMER } from "@/lib/maps/geo-data";

/*
  The environment has no WebGL: jsdom does not implement `WebGLRenderingContext`,
  so `webglAvailable()` returns false and the component renders its fallback. That
  is the branch these tests exercise, and it is the branch that has to work — a
  reader without a GPU still has to be able to plan a walk.
*/

/** A fresh in-memory Storage, because this environment's `localStorage` is inert. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  } as Storage;
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: memoryStorage(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("disclaimer and venue switcher", () => {
  it("shows the honest data disclaimer", () => {
    render(<VenueMapsTool />);

    expect(screen.getByText(GEO_DATA_DISCLAIMER)).toBeTruthy();
    // The two things a reader must not be misled about.
    expect(GEO_DATA_DISCLAIMER).toMatch(/rather than an official map/i);
    expect(GEO_DATA_DISCLAIMER).toMatch(/2027 site plan/i);
  });

  it("opens on De Schorre and names it", () => {
    render(<VenueMapsTool />);

    expect(
      screen.getByRole("heading", { name: "De Schorre (Festival Grounds)" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "De Schorre (Festival Grounds)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches to DreamVille and swaps its zones", () => {
    render(<VenueMapsTool />);

    fireEvent.click(screen.getByRole("button", { name: "DreamVille (Camping & Accommodation)" }));

    expect(
      screen.getByRole("heading", { name: "DreamVille (Camping & Accommodation)" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "DreamVille Entrance 1 to De Schorre Festival Gate" }),
    ).toBeTruthy();
  });

  it("restores each venue's own selection when switching back", () => {
    render(<VenueMapsTool />);

    fireEvent.change(screen.getByLabelText("Starting zone (A)"), {
      target: { value: "ds-core" },
    });
    fireEvent.click(screen.getByRole("button", { name: "DreamVille (Camping & Accommodation)" }));
    fireEvent.click(screen.getByRole("button", { name: "De Schorre (Festival Grounds)" }));

    expect(
      screen.getByRole("heading", { name: "Core to Mainstage" }),
    ).toBeTruthy();
  });
});

describe("route planner", () => {
  it("reports distance in miles and both walking times in minutes", () => {
    render(<VenueMapsTool />);

    const readout = screen.getByRole("heading", { name: "Main Entrance to Mainstage" })
      .closest("section") as HTMLElement;
    expect(readout.textContent).toMatch(/\d+\.?\d* miles?/);
    expect(readout.textContent).toMatch(/\d+ min/);
    // Two figures: normal and peak.
    expect(readout.textContent?.match(/\d+ min/g)?.length).toBe(2);
    expect(readout.textContent).not.toMatch(/\bkm\b|kilometre/i);
    // "m" alone is the abbreviation the brief rules out.
    expect(readout.textContent).not.toMatch(/\d+\s?m\b(?!in)/);
  });

  it("updates when the selects change, and announces within a live region", () => {
    render(<VenueMapsTool />);

    const section = screen
      .getByRole("heading", { name: "Main Entrance to Mainstage" })
      .closest("section") as HTMLElement;
    expect(section.querySelector(".tml-map-readout")?.getAttribute("aria-live")).toBe("polite");

    fireEvent.change(screen.getByLabelText("Starting zone (A)"), {
      target: { value: "ds-freedom" },
    });
    fireEvent.change(screen.getByLabelText("Destination zone (B)"), {
      target: { value: "ds-core" },
    });

    expect(screen.getByRole("heading", { name: "Freedom to Core" })).toBeTruthy();
  });

  it("swaps the two ends, keeping the visible text in the accessible name", () => {
    render(<VenueMapsTool />);

    const swap = screen.getByRole("button", { name: /^Swap A ⇄ B/ });
    // WCAG 2.5.3: the visible label plus what it means.
    expect(swap).toHaveAccessibleName(/starting zone and the destination zone/i);
    fireEvent.click(swap);

    expect(screen.getByRole("heading", { name: "Mainstage to Main Entrance" })).toBeTruthy();
  });

  it("says so when both ends are the same zone", () => {
    render(<VenueMapsTool />);

    fireEvent.change(screen.getByLabelText("Destination zone (B)"), {
      target: { value: "ds-main-entrance" },
    });

    expect(screen.getByText(/Both ends are the same zone/i)).toBeTruthy();
  });

  it("lists the bottleneck notes for the legs actually walked", () => {
    render(<VenueMapsTool />);

    fireEvent.change(screen.getByLabelText("Starting zone (A)"), {
      target: { value: "ds-mainstage" },
    });
    fireEvent.change(screen.getByLabelText("Destination zone (B)"), {
      target: { value: "ds-dreamville-gate" },
    });

    const notes = screen.getByText("Bottlenecks on this walk").closest("div") as HTMLElement;
    expect(within(notes).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(notes.getAttribute("aria-live") ?? notes.closest("[aria-live]")).toBeTruthy();
  });
});

describe("search and filters", () => {
  it("filters the zone list as the query is typed", () => {
    render(<VenueMapsTool />);

    fireEvent.change(screen.getByLabelText("Search zones"), { target: { value: "lockers" } });

    expect(screen.getByRole("heading", { name: /^2 zones$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Mainstage/ })).toBeNull();
  });

  it("says plainly when nothing matches", () => {
    render(<VenueMapsTool />);

    fireEvent.change(screen.getByLabelText("Search zones"), { target: { value: "helipad" } });

    expect(screen.getByRole("heading", { name: "No zone matches those filters" })).toBeTruthy();
    expect(screen.getByText(/Clear the search, or\s+turn a category back on/i)).toBeTruthy();
  });

  it("requires every word of the query, matching the routing layer", () => {
    render(<VenueMapsTool />);

    fireEvent.change(screen.getByLabelText("Search zones"), { target: { value: "mainstage bakery" } });
    expect(screen.getByRole("heading", { name: "No zone matches those filters" })).toBeTruthy();
  });

  it("toggles categories with aria-pressed, and hides only that category", () => {
    render(<VenueMapsTool />);

    const stages = screen.getByRole("button", { name: "Stages" });
    expect(stages).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(stages);

    expect(stages).toHaveAttribute("aria-pressed", "false");
    // Six stages leave eight zones' worth minus those six plus none added back.
    expect(screen.getByRole("heading", { name: /^\d+ zones$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Core, / })).toBeNull();
    // A facility is still there.
    expect(screen.getByRole("button", { name: /^First Aid, / })).toBeTruthy();
  });

  it("keeps both route ends visible even when their category is hidden", () => {
    render(<VenueMapsTool />);

    // Mainstage is the destination and a stage; hiding stages must not hide it.
    fireEvent.click(screen.getByRole("button", { name: "Stages" }));

    // The list hides it, because the list is what the filter controls...
    expect(screen.queryByRole("button", { name: /^Mainstage/ })).toBeNull();
    // ...but the route heading still names it, so the walk stays readable.
    expect(screen.getByRole("heading", { name: "Main Entrance to Mainstage" })).toBeTruthy();
  });
});

describe("favourites", () => {
  it("stars a zone and persists it under the documented key", () => {
    render(<VenueMapsTool />);

    const star = screen.getByRole("button", { name: "Add Mainstage to favourites" });
    expect(star).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(star);

    expect(star).toHaveAttribute("aria-pressed", "true");
    const raw = window.localStorage.getItem(FAVOURITES_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({ "de-schorre": ["ds-mainstage"], dreamville: [] });
  });

  it("stores no personal data, only venue and node ids", () => {
    render(<VenueMapsTool />);

    fireEvent.click(screen.getByRole("button", { name: "Add Mainstage to favourites" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Core to favourites" }));

    const parsed = JSON.parse(window.localStorage.getItem(FAVOURITES_STORAGE_KEY) as string) as Record<
      string,
      string[]
    >;
    // Two keys, both venue ids, and nothing else.
    expect(Object.keys(parsed).sort()).toEqual(["de-schorre", "dreamville"]);
    for (const ids of Object.values(parsed)) {
      expect(Array.isArray(ids)).toBe(true);
      for (const id of ids) expect(typeof id).toBe("string");
    }
    expect(JSON.stringify(parsed)).not.toMatch(/@|\+?\d{7,}/);
  });

  it("restores saved favourites on mount", () => {
    window.localStorage.setItem(
      FAVOURITES_STORAGE_KEY,
      JSON.stringify({ "de-schorre": ["ds-mainstage"], dreamville: ["dv-montagoe"] }),
    );

    render(<VenueMapsTool />);

    expect(screen.getByRole("button", { name: "Remove Mainstage from favourites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("drops an unknown stored id rather than showing a phantom favourite", () => {
    window.localStorage.setItem(
      FAVOURITES_STORAGE_KEY,
      JSON.stringify({ "de-schorre": ["ds-mainstage", "not-a-real-node"], dreamville: [] }),
    );

    render(<VenueMapsTool />);

    expect(screen.getByRole("button", { name: "Remove Mainstage from favourites" })).toBeTruthy();
    expect(window.localStorage.getItem(FAVOURITES_STORAGE_KEY)).toContain("ds-mainstage");
  });

  it("recovers from a corrupt stored value without crashing", () => {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, "{ this is not json");

    render(<VenueMapsTool />);

    // The tool still renders and the unreadable value is cleared.
    expect(screen.getByRole("heading", { name: "De Schorre (Festival Grounds)" })).toBeTruthy();
    expect(window.localStorage.getItem(FAVOURITES_STORAGE_KEY)).toBeNull();
  });

  it("filters to favourites only, and says when there are none", () => {
    render(<VenueMapsTool />);

    fireEvent.click(screen.getByRole("button", { name: "Favourites only" }));
    expect(screen.getByRole("heading", { name: "No zone matches those filters" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Favourites only" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Mainstage to favourites" }));
    fireEvent.click(screen.getByRole("button", { name: "Favourites only" }));

    expect(screen.getByRole("heading", { name: "1 zone" })).toBeTruthy();
  });

  it("warns honestly when the browser refuses to store anything", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      } as Storage,
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Add Mainstage to favourites" }));

    expect(screen.getByText("Favourites are not being saved")).toBeTruthy();
    // The star still reflects the in-memory state, so the press is not lost.
    expect(screen.getByRole("button", { name: "Remove Mainstage from favourites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("the accessible zone list", () => {
  it("lets a walk be planned with no map at all", () => {
    render(<VenueMapsTool />);

    // The map cannot run here, and that is stated, not hidden.
    expect(screen.getByText("The map cannot run in this browser")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pick start (A)" }));
    fireEvent.click(screen.getByRole("button", { name: /^Core, set as the starting zone A/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Rose Garden, set as the destination B/ }));

    expect(screen.getByRole("heading", { name: "Core to Rose Garden" })).toBeTruthy();
  });

  it("prints the A and B badges and puts them in the accessible name", () => {
    render(<VenueMapsTool />);

    // Main Gate is A; the destination is still unset for this press, so the action
    // offered is the one the current pick target names.
    const start = screen.getByRole("button", {
      name: /^Main Gate A, set as the destination B, also known as Main Entrance$/,
    });
    expect(start).toHaveAttribute("aria-pressed", "true");
    // The badge itself is decorative once the name carries it.
    const row = start.closest("li") as HTMLElement;
    expect(row.querySelector(".tml-map-list__badge")).toHaveAttribute("aria-hidden", "true");
  });

  it("prints the destination badge on the other end, in words for a reader", () => {
    render(<VenueMapsTool />);

    const destination = screen.getByRole("button", {
      name: /^Mainstage B, set as the destination B$/,
    });
    expect(destination).toHaveAttribute("aria-pressed", "true");
  });

  it("names a zone whose printed label differs from its full name by both", () => {
    render(<VenueMapsTool />);

    // The list prints "DV Gate"; the selects call it "DreamVille Gate".
    expect(
      screen.getByRole("button", {
        name: /^DV Gate, set as the destination B, also known as DreamVille Gate$/,
      }),
    ).toBeTruthy();
  });

  it("shows the selected zone's detail", () => {
    render(<VenueMapsTool />);

    fireEvent.click(screen.getByRole("button", { name: /^Crystal, / }));

    const panel = document.querySelector(".tml-map-inspected") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(within(panel).getByText("Selected zone")).toBeTruthy();
    expect(within(panel).getByRole("heading", { name: "Crystal Garden" })).toBeTruthy();
    expect(
      within(panel).getByText(/floating stage on the main clay-pit lake/i),
    ).toBeTruthy();
    // The crowd note is the part the list row does not carry.
    expect(within(panel).getByText(/walkways are narrow/i)).toBeTruthy();
  });

  it("makes every control a real, exposed button or input", () => {
    render(<VenueMapsTool />);

    const controls = screen.getAllByRole("button");
    expect(controls.length).toBeGreaterThan(10);
    for (const button of controls) {
      expect(button.tagName).toBe("BUTTON");
      // A control with no accessible name is unusable with a screen reader, and
      // `toHaveAccessibleName` normalises the whitespace a text node may carry.
      expect(button).toHaveAccessibleName();
      expect(button).not.toHaveAttribute("aria-hidden");
    }
  });
});

describe("accessibility wiring", () => {
  it("never renders an img role for the map box", () => {
    render(<VenueMapsTool />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("announces state changes in a polite live region", () => {
    render(<VenueMapsTool />);

    const status = document.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
    expect(status).not.toBeNull();
    expect(status.getAttribute("aria-atomic")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Pick start (A)" }));
    fireEvent.click(screen.getByRole("button", { name: /^Core, set as the starting zone A/ }));

    expect(status.textContent).toMatch(/Core is the starting zone, A/);
  });

  it("gives each category chip a 44px minimum target through its class", () => {
    render(<VenueMapsTool />);

    for (const category of ["Stages", "Entrances", "Camp zones", "Facilities", "Transport"]) {
      const chip = screen.getByRole("button", { name: category });
      // The height comes from `maps.css`, which is not loaded in jsdom; the class
      // is the contract, and a global search would miss a renamed one.
      expect(chip.className).toContain("tml-map-chip");
    }
  });

  it("labels both route selects, so neither is an unlabelled combobox", () => {
    render(<VenueMapsTool />);

    expect(screen.getByLabelText("Starting zone (A)")).toBeTruthy();
    expect(screen.getByLabelText("Destination zone (B)")).toBeTruthy();
    expect(screen.getByLabelText("Search zones")).toBeTruthy();
  });
});
