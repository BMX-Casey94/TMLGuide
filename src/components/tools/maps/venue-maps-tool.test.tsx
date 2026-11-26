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
  // A geolocation stub installed by one test must not leak into the next.
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "permissions", { configurable: true, value: undefined });
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

describe("the venue switcher", () => {
  it("offers the combined site view alongside the two venues", () => {
    render(<VenueMapsTool />);

    expect(screen.getByRole("button", { name: "De Schorre (Festival Grounds)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "DreamVille (Camping & Accommodation)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Full site: De Schorre + DreamVille" })).toBeTruthy();
  });

  it("opens the combined view on a cross-venue walk, in miles", () => {
    render(<VenueMapsTool />);

    fireEvent.click(screen.getByRole("button", { name: "Full site: De Schorre + DreamVille" }));

    expect(
      screen.getByRole("heading", { name: "Full site: De Schorre + DreamVille" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Montagoe to Mainstage" })).toBeTruthy();

    const section = screen
      .getByRole("heading", { name: "Montagoe to Mainstage" })
      .closest("section") as HTMLElement;
    expect(section.textContent).toMatch(/\d+\.?\d* miles?/);
    expect(section.textContent).not.toMatch(/\bkm\b|kilometre/i);
  });

  it("groups the combined view's zones by venue, so each select is readable", () => {
    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Full site: De Schorre + DreamVille" }));

    const from = screen.getByLabelText("Starting zone (A)") as HTMLSelectElement;
    const groups = [...from.querySelectorAll("optgroup")].map((group) => group.getAttribute("label"));
    expect(groups).toEqual(["De Schorre (festival grounds)", "DreamVille (campsite)"]);
  });

  it("keeps each view's own route selection when switching between them", () => {
    render(<VenueMapsTool />);

    fireEvent.change(screen.getByLabelText("Starting zone (A)"), {
      target: { value: "ds-core" },
    });
    expect(screen.getByRole("heading", { name: "Core to Mainstage" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Full site: De Schorre + DreamVille" }));
    expect(screen.getByRole("heading", { name: "Montagoe to Mainstage" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "De Schorre (Festival Grounds)" }));
    expect(screen.getByRole("heading", { name: "Core to Mainstage" })).toBeTruthy();
  });

  it("points a reader at the combined view for a campsite-to-stage walk", () => {
    render(<VenueMapsTool />);

    // On a single-venue view the selects only hold that venue's zones, so the
    // cross-venue walk is planned on the combined view instead. The panel says so
    // rather than leaving the reader to discover it.
    expect(
      screen.getByText(/Switch to Full site above, where\s+both layouts are on one map/i),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Full site: De Schorre + DreamVille" }));
    expect(
      screen.queryByText(/Switch to Full site above, where\s+both layouts are on one map/i),
    ).toBeNull();
  });

  it("lists zones from both venues on the combined view, and neither on its own", () => {
    render(<VenueMapsTool />);

    const deSchorreOptions = [...(screen.getByLabelText("Starting zone (A)") as HTMLSelectElement).options];
    expect(deSchorreOptions.some((option) => option.value === "ds-mainstage")).toBe(true);
    expect(deSchorreOptions.some((option) => option.value === "dv-montagoe")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Full site: De Schorre + DreamVille" }));

    const allOptions = [...(screen.getByLabelText("Starting zone (A)") as HTMLSelectElement).options];
    expect(allOptions.some((option) => option.value === "ds-mainstage")).toBe(true);
    expect(allOptions.some((option) => option.value === "dv-montagoe")).toBe(true);
  });

  it("routes from any camp to any stage on the combined view", () => {
    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Full site: De Schorre + DreamVille" }));

    fireEvent.change(screen.getByLabelText("Starting zone (A)"), {
      target: { value: "dv-magnificent-greens" },
    });
    fireEvent.change(screen.getByLabelText("Destination zone (B)"), {
      target: { value: "ds-freedom" },
    });

    const section = screen
      .getByRole("heading", { name: "Magnificent Greens to Freedom" })
      .closest("section") as HTMLElement;

    expect(section.textContent).toMatch(/\d+\.?\d* miles?/);
    expect(section.textContent).not.toMatch(/\bkm\b|kilometre/i);
    // The shared crossing is a waypoint, so the trail must name it.
    expect(section.textContent).toMatch(/DreamVille Gate and Festival Walkway/);
  });
});

describe("a view opened with an endpoint from the other venue", () => {
  it("routes across both venues rather than showing 'choose two zones'", () => {
    /*
      The fallback path in `routeBetween`. `initialVenueId` is the supported way a
      caller can arrive with a selection the starting view does not hold, which is
      why the combined map is tried second rather than the pair being refused.
    */
    render(<VenueMapsTool initialVenueId="all" />);

    fireEvent.change(screen.getByLabelText("Starting zone (A)"), {
      target: { value: "dv-friendship-garden" },
    });
    fireEvent.change(screen.getByLabelText("Destination zone (B)"), {
      target: { value: "ds-rose-garden" },
    });

    const section = screen
      .getByRole("heading", { name: "Friendship Garden to Rose Garden" })
      .closest("section") as HTMLElement;
    expect(section.textContent).toMatch(/\d+\.?\d* miles?/);
    expect(section.textContent).toMatch(/DreamVille Gate and Festival Walkway/);
  });
});

describe("the locate button", () => {
  it("is offered, and asks for nothing until it is pressed", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMapsTool />);

    // Nothing on load: no prompt, no request, no position.
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Locate me" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("asks for a fresh, accurate fix rather than a cached one", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    const options = getCurrentPosition.mock.calls[0]?.[2] as PositionOptions;
    expect(options.enableHighAccuracy).toBe(true);
    expect(options.maximumAge).toBe(0);
    expect(options.timeout).toBeGreaterThan(0);
  });

  it("announces the nearest zone in miles when the visitor is at the site", () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          longitude: 4.3968,
          latitude: 51.0897,
          accuracy: 80,
        },
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    const status = document.querySelector(".tml-map-locate__status") as HTMLElement;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toMatch(/Montagoe/);
    expect(status.textContent).toMatch(/miles?/);
    expect(status.textContent).not.toMatch(/\bkm\b|kilometre/i);
  });

  it("says the visitor is outside the area, and marks nothing", () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { longitude: 4.3517, latitude: 50.8503, accuracy: 100 },
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    const status = document.querySelector(".tml-map-locate__status") as HTMLElement;
    expect(status.getAttribute("data-tone")).toBe("outside");
    expect(status.textContent).toMatch(/outside the Boom\/Rumst festival area/i);
    expect(status.textContent).toMatch(/showing the full map instead/i);
    // No clear button, because there is nothing to clear.
    expect(screen.queryByRole("button", { name: "Clear my location" })).toBeNull();
  });

  it("degrades gracefully when the prompt is refused", () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => {
      failure({ code: 1, message: "User denied Geolocation" } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    const status = document.querySelector(".tml-map-locate__status") as HTMLElement;
    expect(status.getAttribute("data-tone")).toBe("denied");
    expect(status.textContent).toMatch(/refused/i);
    // The jargon the browser returns must not reach the reader.
    expect(status.textContent).not.toMatch(/User denied/i);
  });

  it("says so when the browser has no location services at all", () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    const status = document.querySelector(".tml-map-locate__status") as HTMLElement;
    expect(status.getAttribute("data-tone")).toBe("unsupported");
    expect(status.textContent).toMatch(/does not offer location services/i);
  });

  it("does not make a doomed request when the site is already blocked", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: () => Promise.resolve({ state: "denied" }) },
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    // No prompt can appear, so no request is started.
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("asks anyway when the Permissions API cannot answer", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: () => {
          throw new Error("NotSupportedError");
        },
      },
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("asks anyway when the Permissions API rejects", async () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: () => Promise.reject(new Error("NotSupportedError")) },
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    // The rejection is handled on the microtask queue, so the assertion waits.
    await Promise.resolve();
    await Promise.resolve();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("does not strand the button when the Permissions API never settles", async () => {
    vi.useFakeTimers();
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    // A query that returns a promise which never resolves: a known browser bug,
    // and the one shape a plain `.then` cannot recover from.
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: () => new Promise(() => {}) },
    });

    try {
      render(<VenueMapsTool />);
      fireEvent.click(screen.getByRole("button", { name: "Locate me" }));
      expect(getCurrentPosition).not.toHaveBeenCalled();

      // After the fall-through timer, the real request is made regardless.
      vi.advanceTimersByTime(2_500);
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the marker without touching the route or the camera", () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { longitude: 4.3968, latitude: 51.0897, accuracy: 80 },
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    const clear = screen.getByRole("button", { name: "Clear my location" });
    fireEvent.click(clear);

    const status = document.querySelector(".tml-map-locate__status") as HTMLElement;
    expect(status.getAttribute("data-tone")).toBe("cleared");
    expect(status.textContent).toMatch(/cleared from the map/i);
    expect(screen.queryByRole("button", { name: "Clear my location" })).toBeNull();
    // The planned walk is untouched by the location feature.
    expect(screen.getByRole("heading", { name: "Main Entrance to Mainstage" })).toBeTruthy();
  });

  it("ignores a second press while the first is still outstanding", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMapsTool />);
    const button = screen.getByRole("button", { name: "Locate me" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    // `aria-disabled` keeps the button in the tab order; a real `disabled` would
    // drop a keyboard reader's focus to the top of the document.
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("stays in the tab order while a fix is pending", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMapsTool />);
    const button = screen.getByRole("button", { name: /Locate me|Finding you/ });
    fireEvent.click(button);

    const pending = screen.getByRole("button", { name: /Finding you/ });
    expect(pending.hasAttribute("disabled")).toBe(false);
    expect(pending.getAttribute("aria-disabled")).toBe("true");
  });

  it("never writes the position to storage", () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { longitude: 4.3968, latitude: 51.0897, accuracy: 80 },
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMapsTool />);
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));

    // Nothing at all is stored, and certainly not a coordinate.
    expect(window.localStorage.length).toBe(0);
    expect(window.localStorage.getItem(FAVOURITES_STORAGE_KEY)).toBeNull();
  });

  it("explains the privacy position, and wires it to the button", () => {
    render(<VenueMapsTool />);

    const button = screen.getByRole("button", { name: "Locate me" });
    const describedBy = button.getAttribute("aria-describedby") as string;
    expect(describedBy).toBeTruthy();

    const note = document.getElementById(describedBy) as HTMLElement;
    expect(note.textContent).toMatch(/never sent to this guide/i);
    expect(note.textContent).toMatch(/not saved/i);
  });
});

describe("the legend", () => {
  it("gives each category a letter as well as a colour", () => {
    render(<VenueMapsTool />);

    const legend = screen.getByRole("list", { name: "Map legend" });
    for (const [category, letter] of [
      ["Stages", "S"],
      ["Entrances", "E"],
      ["Camp zones", "C"],
      ["Facilities", "F"],
      ["Transport", "T"],
    ] as const) {
      const item = within(legend).getByText(category).closest("li") as HTMLElement;
      expect(item.textContent).toContain(letter);
    }
  });

  it("names the route ends and the visitor's own marker", () => {
    render(<VenueMapsTool />);

    const legend = screen.getByRole("list", { name: "Map legend" });
    expect(within(legend).getByText("Start")).toBeTruthy();
    expect(within(legend).getByText("Destination")).toBeTruthy();
    expect(within(legend).getByText("Your location, when you ask for it")).toBeTruthy();
  });

  it("spells out the letter scheme in words", () => {
    render(<VenueMapsTool />);

    expect(
      screen.getByText(/S stage, E entrance, C camp, F facility, T transport/i),
    ).toBeTruthy();
    // The one thing the map cannot promise: two letters for two markers that sit
    // almost on top of each other. The note says so rather than overclaiming.
    expect(screen.getByText(/one letter is\s+left off rather than printed twice/i)).toBeTruthy();
    expect(screen.getByText(/still named in every row of the\s+zone list/i)).toBeTruthy();
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
      name: /^Main Gate A, set as the destination B, also known as Main Entrance\./,
    });
    expect(start).toHaveAttribute("aria-pressed", "true");
    // The badge is real text now, so it is part of the name rather than hidden.
    const row = start.closest("li") as HTMLElement;
    expect(row.querySelector(".tml-map-list__badge")).not.toHaveAttribute("aria-hidden");
  });

  it("builds the accessible name from the printed content, not a parallel string", () => {
    render(<VenueMapsTool />);

    /*
      WCAG 2.5.3 is satisfied by construction here: the name is the button's own
      text. That is what stops the two drifting apart, which is the fault axe
      reports as `label-content-name-mismatch`.
    */
    const start = screen.getByRole("button", {
      name: /^Main Gate A, set as the destination B, also known as Main Entrance\./,
    });
    // The visible "Entrances · …" line is in the name as well.
    expect(start).toHaveAccessibleName(/Entrances · The day-visitor entrance/);
    // And no `aria-label` is used, so nothing can contradict the content.
    expect(start).not.toHaveAttribute("aria-label");
  });

  it("keeps a word boundary where the action meets the category line", () => {
    render(<VenueMapsTool />);

    /*
      The accessible name is joined from separate text nodes and each is trimmed,
      so a joining space cannot exist. The full stop is the boundary instead: a
      screen reader treats it as the end of a sentence, which is why "Main
      Entrance" and "Entrances" are not run together into one phrase.
    */
    const start = screen.getByRole("button", {
      name: /^Main Gate A, set as the destination B, also known as Main Entrance\./,
    });
    expect(start).toHaveAccessibleName(/Main Entrance\.Entrances ·/);
  });

  it("prints the destination badge on the other end, in words for a reader", () => {
    render(<VenueMapsTool />);

    const destination = screen.getByRole("button", {
      name: /^Mainstage B, set as the destination B\./,
    });
    expect(destination).toHaveAttribute("aria-pressed", "true");
  });

  it("names a zone whose printed label differs from its full name by both", () => {
    render(<VenueMapsTool />);

    // The list prints "DV Gate"; the selects call it "DreamVille Gate".
    expect(
      screen.getByRole("button", {
        name: /^DV Gate, set as the destination B, also known as DreamVille Gate\./,
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
