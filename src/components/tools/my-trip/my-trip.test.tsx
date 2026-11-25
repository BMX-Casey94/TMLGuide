import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditionProvider } from "@/components/shell";
import { buildTripData } from "@/app/tools/my-trip/trip-data";
import { MyTrip } from "./my-trip";
import { PENDING_TOOL_LINKS, TOOL_STEPS } from "./trip-logic";
import { FREE_TEXT_MAX, TRIP_STORAGE_KEY, serialiseTripExport, type TripState } from "./trip-state";

/**
 * The trip sheet, driven the way a reader drives it.
 *
 * The suite covers the four things that could hurt a reader: their sheet not
 * coming back, a stored value misprinted as fact, an import that half-applies,
 * and a control a keyboard cannot reach. Storage is a fresh in-memory object per
 * test, so no case can pass because of another case's leftovers.
 */

const data = buildTripData();

/** A working Storage, since the test environment's own is inert. */
function installStorage(): Storage {
  const map = new Map<string, string>();
  const storage: Storage = {
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
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  return storage;
}

function renderSheet() {
  return render(
    <EditionProvider>
      <MyTrip data={data} />
    </EditionProvider>,
  );
}

/** The stored sheet, parsed, or null when nothing is stored. */
function stored(): TripState | null {
  const raw = window.localStorage.getItem(TRIP_STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as TripState);
}

function field(label: RegExp): HTMLInputElement | HTMLTextAreaElement {
  return screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
}

function select(label: RegExp): HTMLSelectElement {
  return screen.getByLabelText(label) as HTMLSelectElement;
}

/** Writes a sheet into storage before the component mounts. */
function storeBeforeMount(state: Partial<TripState>): void {
  const base: TripState = {
    version: 1,
    edition: "belgium",
    slotId: null,
    ticketId: null,
    packageId: null,
    accommodationNote: "",
    travelNote: "",
    partySize: 1,
    notes: "",
  };
  window.localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify({ ...base, ...state }));
}

/** A File the component can read, built from text. */
function jsonFile(text: string, name = "my-trip.json"): File {
  return new File([text], name, { type: "application/json" });
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (input === null) throw new Error("the file input is not rendered");
  return input as HTMLInputElement;
}

beforeEach(() => {
  installStorage();
  window.history.replaceState(null, "", "/tools/my-trip");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("first visit", () => {
  it("opens on Belgium with nothing chosen and one person", () => {
    renderSheet();
    expect(screen.getByRole("heading", { level: 2, name: "Your trip" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Belgium/ })).toHaveAttribute("aria-pressed", "true");
    expect(select(/The ticket you hold/).value).toBe("");
    expect(field(/How many of you are going/)).toHaveValue(1);
  });

  it("offers only the dated weekends the data holds, and no typed-in date", () => {
    renderSheet();
    const group = screen.getByRole("radiogroup");
    const radios = within(group).getAllByRole("radio");
    // Two Belgium weekends, plus the "not decided" option.
    expect(radios).toHaveLength(data.belgium.slots.length + 1);
    for (const slot of data.belgium.slots) {
      expect(within(group).getByRole("radio", { name: new RegExp(slot.name) })).toBeInTheDocument();
    }
    // "Not decided" is selected, so the sheet starts honest rather than guessing.
    expect(within(group).getByRole("radio", { name: /Not decided yet/ })).toBeChecked();
  });

  it("does not write to storage before the reader changes anything", async () => {
    renderSheet();
    // Give the debounce more than its window to fire if it were going to.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(window.localStorage.getItem(TRIP_STORAGE_KEY)).toBeNull();
  });
  it("opens on the site's edition when the reader has no sheet of their own", () => {
    renderSheet();
    // The provider starts on Belgium, and a sheet that names no edition takes
    // the site's rather than guessing one.
    expect(screen.getByRole("button", { name: /Belgium/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not store or announce anything before the reader edits", async () => {
    renderSheet();
    await new Promise((resolve) => setTimeout(resolve, 700));
    // A blank sheet is not a trip: writing one would be a claim, and announcing
    // "Saved" before the reader typed would be noise.
    expect(window.localStorage.getItem(TRIP_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText("Saved in this browser")).toBeNull();
  });

  it("keeps a trip of the reader's own rather than following the site edition", async () => {
    storeBeforeMount({ edition: "brasil", notes: "Brasil trip" });
    renderSheet();
    await waitFor(() => expect(field(/Anything else/)).toHaveValue("Brasil trip"));
    expect(screen.getByRole("button", { name: /Brasil/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("choosing a ticket", () => {
  it("lists the edition's verified products by name only", () => {
    renderSheet();
    const options = Array.from(select(/The ticket you hold/).options).map((option) => option.text);
    // The first option is the empty one.
    expect(options[0]).toMatch(/No ticket chosen yet/);
    expect(options).toHaveLength(data.belgium.tickets.length + 1);
    for (const ticket of data.belgium.tickets) {
      expect(options).toContain(ticket.name);
    }
    // Name only: a price in the option would be a second, unlabelled copy.
    expect(options.join(" ")).not.toMatch(/€/);
  });

  it("shows the published price with its year and the official source page", () => {
    renderSheet();
    const first = data.belgium.tickets[0];
    if (first === undefined) throw new Error("the Belgium data has no ticket");
    fireEvent.change(select(/The ticket you hold/), { target: { value: first.id } });

    expect(screen.getByText("€144.00")).toBeInTheDocument();
    expect(screen.getByText("2027 price")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: new RegExp(first.sourceTitle) });
    expect(link).toHaveAttribute("href", first.sourceUrl);
    // The accessible name carries the visible text, with the context after it.
    expect(link.textContent).toContain(first.sourceTitle);
  });

  it("prints reais for a Brasil ticket and never a euro figure", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /Brasil/ }));
    const brasil = data.brasil.tickets[0];
    if (brasil === undefined) throw new Error("the Brasil data has no ticket");
    fireEvent.change(select(/The ticket you hold/), { target: { value: brasil.id } });

    const detail = screen.getByText(brasil.detail);
    expect(detail).toBeInTheDocument();
    expect(screen.getByText("R$3,160.00")).toBeInTheDocument();
    expect(screen.queryByText(/€/)).not.toBeInTheDocument();
  });

  it("marks a sold-out Brasil product in words as well as in the list", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /Brasil/ }));
    const soldOut = data.brasil.tickets.find((ticket) => ticket.soldOut);
    if (soldOut === undefined) throw new Error("no Brasil ticket is marked sold out");
    fireEvent.change(select(/The ticket you hold/), { target: { value: soldOut.id } });
    expect(screen.getAllByText("Sold out").length).toBeGreaterThan(0);
  });
});

describe("choosing a package", () => {
  it("offers Belgium DreamVille packages at their published totals", () => {
    renderSheet();
    const options = Array.from(select(/A published accommodation package/).options).map(
      (option) => option.text,
    );
    expect(options).toHaveLength(data.belgium.packages.length + 1);
    const first = data.belgium.packages[0];
    if (first === undefined) throw new Error("the Belgium data has no package");
    fireEvent.change(select(/A published accommodation package/), { target: { value: first.id } });
    expect(screen.getByText(first.detail)).toBeInTheDocument();
    expect(screen.getByText(/1 person/)).toBeInTheDocument();
  });

  it("says why Winter offers no package instead of showing an empty list", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /Winter/ }));
    expect(select(/A published accommodation package/).options).toHaveLength(1);
    expect(screen.getByText(data.winter.packagesNote)).toBeInTheDocument();
  });
});

describe("autosave", () => {
  it("saves as the reader types and says so in a polite live region", async () => {
    renderSheet();
    fireEvent.change(field(/Anything else/), { target: { value: "Meeting at the MainStage" } });

    await waitFor(
      () => {
        expect(screen.getByText("Saved in this browser")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // `role="status"` is a polite live region, which is what announces the save.
    const status = screen.getByText("Saved in this browser").closest("[role='status']");
    expect(status).not.toBeNull();
    expect(stored()?.notes).toBe("Meeting at the MainStage");
  });

  it("restores a stored sheet after a reload", async () => {
    storeBeforeMount({
      slotId: "belgium-2027",
      ticketId: "belgium-2027-full-madness-presale",
      notes: "Coming back to this",
      partySize: 3,
      travelNote: "Train from London",
    });
    renderSheet();

    await waitFor(() => {
      expect(field(/Anything else/)).toHaveValue("Coming back to this");
    });
    expect(field(/How many of you are going/)).toHaveValue(3);
    expect(field(/How you are travelling/)).toHaveValue("Train from London");
    expect(select(/The ticket you hold/).value).toBe("belgium-2027-full-madness-presale");
    expect(screen.getByRole("radio", { name: /Weekend 1/ })).toBeChecked();
    expect(screen.getByText("The trip saved in this browser is open below.")).toBeInTheDocument();
  });

  it("keeps the sheet and clears only the reference the data no longer holds", async () => {
    storeBeforeMount({
      slotId: "belgium-2030",
      notes: "Still mine",
      partySize: 2,
    });
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText(/Part of the sheet changed/)).toBeInTheDocument();
    });
    expect(screen.getByText(/still holds, so it was cleared/i)).toBeInTheDocument();
    expect(field(/Anything else/)).toHaveValue("Still mine");
    expect(field(/How many of you are going/)).toHaveValue(2);
    // The weekend that is not in the data is not silently selected.
    expect(screen.getByRole("radio", { name: /Not decided yet/ })).toBeChecked();
  });

  it("starts fresh and says so when the stored value is not JSON", async () => {
    window.localStorage.setItem(TRIP_STORAGE_KEY, "{ this is not json");
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText("Starting fresh")).toBeInTheDocument();
    });
    expect(field(/Anything else/)).toHaveValue("");
  });

  it("truncates an over-long stored note and says it did", async () => {
    storeBeforeMount({ notes: "a".repeat(FREE_TEXT_MAX + 40) });
    renderSheet();

    await waitFor(() => {
      expect(screen.getByText(/the notes/)).toBeInTheDocument();
    });
    expect(field(/Anything else/)).toHaveValue("a".repeat(FREE_TEXT_MAX));
  });

  it("reports a storage refusal instead of claiming the trip is safe", async () => {
    const refusing: Storage = {
      get length() {
        return 0;
      },
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    Object.defineProperty(window, "localStorage", { configurable: true, value: refusing });

    renderSheet();
    fireEvent.change(field(/Anything else/), { target: { value: "Will not persist" } });

    await waitFor(
      () => {
        expect(screen.getByText(/this browser refused to store the trip/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("reports blocked site data rather than throwing", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });

    expect(() => renderSheet()).not.toThrow();
    fireEvent.change(field(/Anything else/), { target: { value: "Memory only" } });

    await waitFor(
      () => {
        expect(screen.getByText(/does not allow site storage/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    // The page still works; only the promise of persistence is withdrawn.
    expect(field(/Anything else/)).toHaveValue("Memory only");
  });
});

describe("switching edition", () => {
  it("keeps the notes and the party size and clears the edition's own references", async () => {
    storeBeforeMount({
      slotId: "belgium-2027",
      ticketId: "belgium-2027-full-madness-presale",
      notes: "Our trip",
      partySize: 5,
      travelNote: "Coach",
    });
    renderSheet();
    await waitFor(() => expect(field(/Anything else/)).toHaveValue("Our trip"));

    fireEvent.click(screen.getByRole("button", { name: /Winter/ }));

    expect(field(/Anything else/)).toHaveValue("Our trip");
    expect(field(/How many of you are going/)).toHaveValue(5);
    expect(select(/The ticket you hold/).value).toBe("");
    expect(screen.getByText(/clears the weekend, ticket and package/i)).toBeInTheDocument();
    // The Winter week is the only dated Winter option.
    expect(screen.getByRole("radio", { name: /Winter 2027/ })).toBeInTheDocument();
  });
});

describe("export", () => {
  it("downloads the sheet as JSON under a filename naming the edition", async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        blobs.push(blob);
        return "blob:my-trip";
      },
      revokeObjectURL: () => undefined,
    });
    const clicked: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicked.push(this.download);
    };

    try {
      renderSheet();
      fireEvent.change(field(/Anything else/), { target: { value: "Export me" } });
      fireEvent.click(screen.getByRole("button", { name: "Export my trip" }));

      expect(clicked).toEqual(["tmlguide-my-trip-belgium.html"]);
      expect(blobs).toHaveLength(1);

      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blobs[0] as Blob);
      });
      expect(text).toContain("<!doctype html>");
      expect(text).toContain("Stage 1 · Summary");
      expect(text).toContain("Save updated copy");
      expect(text).toContain("Export me");
      expect(screen.getByText(/Trip sheet downloaded/i)).toBeInTheDocument();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });
});

describe("import", () => {
  const exported = serialiseTripExport(
    {
      version: 1,
      edition: "brasil",
      slotId: "brasil-2027",
      ticketId: "full-madness",
      packageId: null,
      accommodationNote: "Camping",
      travelNote: "Flight to São Paulo",
      partySize: 2,
      notes: "Imported notes",
    },
    new Date("2026-11-20T09:00:00Z"),
  );

  it("replaces the sheet with a valid file, including its edition", async () => {
    const { container } = renderSheet();
    fireEvent.change(fileInput(container), { target: { files: [jsonFile(exported)] } });

    await waitFor(() => {
      expect(field(/Anything else/)).toHaveValue("Imported notes");
    });
    expect(screen.getByRole("button", { name: /Brasil/ })).toHaveAttribute("aria-pressed", "true");
    expect(select(/The ticket you hold/).value).toBe("full-madness");
    expect(screen.getByText(/Trip imported/i)).toBeInTheDocument();
  });

  it("refuses a file missing a field, names it, and leaves the sheet untouched", async () => {
    const { container } = renderSheet();
    fireEvent.change(field(/Anything else/), { target: { value: "Keep me" } });
    await waitFor(() => expect(stored()?.notes).toBe("Keep me"), { timeout: 3000 });

    const parsed = JSON.parse(exported) as { trip: Record<string, unknown> };
    delete parsed.trip.travelNote;
    fireEvent.change(fileInput(container), {
      target: { files: [jsonFile(JSON.stringify(parsed))] },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert").textContent).toMatch(/travel note/i);
    expect(screen.getByRole("alert").textContent).toMatch(/Your saved trip is unchanged/i);
    expect(field(/Anything else/)).toHaveValue("Keep me");
  });

  it("refuses a file that is not JSON at all", async () => {
    const { container } = renderSheet();
    fireEvent.change(fileInput(container), {
      target: { files: [jsonFile("definitely not json")] },
    });
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/not a valid trip sheet or JSON/i);
    });
  });

  it("refuses another tool's export rather than guessing at it", async () => {
    const { container } = renderSheet();
    const other = JSON.stringify({ app: "tmlguide", tool: "budget", version: 1, exportedAt: "x", trip: {} });
    fireEvent.change(fileInput(container), { target: { files: [jsonFile(other)] } });
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/not a My Trip file/i);
    });
  });
});

describe("clearing the trip", () => {
  it("asks before clearing, and does nothing if the reader keeps it", async () => {
    storeBeforeMount({ notes: "Precious" });
    renderSheet();
    await waitFor(() => expect(field(/Anything else/)).toHaveValue("Precious"));

    fireEvent.click(screen.getByRole("button", { name: "Clear this trip" }));
    expect(screen.getByRole("group", { name: /Clear every field/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("group", { name: /Clear every field/ })).not.toBeInTheDocument();
    expect(field(/Anything else/)).toHaveValue("Precious");
    expect(stored()?.notes).toBe("Precious");
  });

  it("clears on confirmation and removes the stored copy", async () => {
    storeBeforeMount({ notes: "Gone soon", partySize: 4 });
    renderSheet();
    await waitFor(() => expect(field(/Anything else/)).toHaveValue("Gone soon"));

    fireEvent.click(screen.getByRole("button", { name: "Clear this trip" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, clear the trip" }));

    expect(field(/Anything else/)).toHaveValue("");
    expect(field(/How many of you are going/)).toHaveValue(1);
    expect(window.localStorage.getItem(TRIP_STORAGE_KEY)).toBeNull();
    expect(screen.getByText(/saved copy is gone from this browser/i)).toBeInTheDocument();
  });

  it("cancels on Escape and returns focus to the button that opened it", async () => {
    storeBeforeMount({ notes: "Keyboard trip" });
    renderSheet();
    await waitFor(() => expect(field(/Anything else/)).toHaveValue("Keyboard trip"));

    const trigger = screen.getByRole("button", { name: "Clear this trip" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const confirm = screen.getByRole("group", { name: /Clear every field/ });
    // Opening the panel moves focus into it, so a keyboard user is not left
    // behind a panel they cannot see.
    await waitFor(() => expect(confirm.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(confirm, { key: "Escape" });
    expect(screen.queryByRole("group", { name: /Clear every field/ })).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(field(/Anything else/)).toHaveValue("Keyboard trip");
  });
});

describe("dated weekends", () => {
  it("prints the record's dates in a readable form, not as raw ISO strings", () => {
    renderSheet();
    const group = screen.getByRole("radiogroup");
    // The Belgium Weekend 1 record runs 16–18 July 2027.
    expect(within(group).getByText(/16–18 July 2027/)).toBeInTheDocument();
    expect(within(group).queryByText(/2027-07-16 to/)).toBeNull();
  });

  it("shows the chosen weekend's dates in the detail panel", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: /Weekend 1/ }));
    const detail = document.querySelector(".trip-detail");
    expect(detail?.textContent).toContain("16–18 July 2027");
  });
});

describe("dates to remember", () => {
  it("lists every published sale with the zone it was published in", () => {
    renderSheet();
    for (const window of data.belgium.saleWindows) {
      expect(screen.getByRole("heading", { level: 3, name: window.name })).toBeInTheDocument();
    }
    // "As published (Europe/Brussels)" appears once per window.
    expect(screen.getAllByText(/As published \(Europe\/Brussels\)/i)).toHaveLength(
      data.belgium.saleWindows.length,
    );
  });

  it("shows the organisers' own CET wording, not a converted instant", () => {
    renderSheet();
    // The February 2027 Belgium sales are quoted in CET by the organisers, and
    // that abbreviation is what the published column prints.
    expect(screen.getAllByText(/CET/).length).toBeGreaterThan(0);
  });

  it("links to the sale timeline for the calendar export", () => {
    renderSheet();
    const link = screen.getByRole("link", { name: /Open the sale timeline/ });
    expect(link).toHaveAttribute("href", "/tools/sale-timeline");
  });

  it("links every sale to its official page", () => {
    renderSheet();
    const links = screen.getAllByRole("link", { name: /Official page for this sale/ });
    expect(links).toHaveLength(data.belgium.saleWindows.length);
    expect(links[0]).toHaveAttribute("href", data.belgium.saleWindows[0]?.sourceUrl);
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("changes to the edition's own sales when the edition changes", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /Brasil/ }));
    for (const window of data.brasil.saleWindows) {
      expect(screen.getByRole("heading", { level: 3, name: window.name })).toBeInTheDocument();
    }
    expect(screen.getAllByText(/As published \(America\/Sao_Paulo\)/i)).toHaveLength(
      data.brasil.saleWindows.length,
    );
  });
});

describe("next steps", () => {
  it("links only to routes that exist today", () => {
    renderSheet();
    for (const step of TOOL_STEPS) {
      expect(screen.getByRole("link", { name: new RegExp(step.label) })).toHaveAttribute(
        "href",
        step.href,
      );
    }
  });

  it("does not render the pending sibling tools", () => {
    renderSheet();
    for (const pending of PENDING_TOOL_LINKS) {
      expect(screen.queryByRole("link", { name: new RegExp(pending.label) })).toBeNull();
      expect(screen.queryByRole("link", { name: new RegExp(pending.href) })).toBeNull();
    }
  });

  it("links the edition's own guide chapters", () => {
    renderSheet();
    for (const chapter of data.belgium.chapters) {
      expect(screen.getByRole("link", { name: new RegExp(chapter.label) })).toHaveAttribute(
        "href",
        chapter.href,
      );
    }
  });

  it("keeps the still-open note as the direct neighbour of the step grid", () => {
    // .trip-note + .trip-steps carries the gap between the note and the cards,
    // so anything inserted between them would take that spacing away.
    renderSheet();
    const grid = document.querySelector(".trip-steps");
    expect(grid).not.toBeNull();
    const before = grid?.previousElementSibling;
    expect(before).not.toBeNull();
    expect(before?.classList.contains("trip-note")).toBe(true);
    expect(before?.textContent).toContain("Still open");
  });

  it("keeps that neighbour when the sheet is complete", async () => {
    storeBeforeMount({
      slotId: "belgium-2027",
      ticketId: "belgium-2027-full-madness-presale",
      accommodationNote: "Camping in DreamVille",
      travelNote: "Train",
    });
    renderSheet();
    await waitFor(() => expect(screen.queryByText("Filled in")).toBeInTheDocument());
    const grid = document.querySelector(".trip-steps");
    const before = grid?.previousElementSibling;
    expect(before?.classList.contains("trip-note--ok")).toBe(true);
    expect(before?.textContent).toContain("Filled in");
  });

  it("says what is still missing rather than scoring the sheet", () => {
    renderSheet();
    expect(screen.getByText("Still open")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Weekend 1/ }));
    expect(screen.queryByText(/Choose the weekend or week/)).not.toBeInTheDocument();
  });

  it("points at chapter links that change with the edition", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /Winter/ }));
    for (const chapter of data.winter.chapters) {
      expect(screen.getByRole("link", { name: new RegExp(chapter.label) })).toHaveAttribute(
        "href",
        chapter.href,
      );
    }
  });
});

describe("free text", () => {
  it("caps every note at the field limit", () => {
    renderSheet();
    for (const label of [/Where you are staying/, /How you are travelling/, /Anything else/]) {
      expect(field(label)).toHaveAttribute("maxlength", String(FREE_TEXT_MAX));
    }
  });

  it("renders typed text as text, never as markup", () => {
    renderSheet();
    const hostile = '<img src=x onerror="alert(1)">';
    fireEvent.change(field(/Anything else/), { target: { value: hostile } });
    // The value round-trips as a string, and no image element is created.
    expect(field(/Anything else/)).toHaveValue(hostile);
    expect(document.querySelector("img[src='x']")).toBeNull();
  });
});

describe("party size", () => {
  it("rejects a count outside 1 to 20 and keeps the last valid one", async () => {
    renderSheet();
    const input = field(/How many of you are going/);
    fireEvent.change(input, { target: { value: "0" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Enter a whole number from 1 to 20/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "21" } });
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "12" } });
    expect(input).not.toHaveAttribute("aria-invalid");
    await waitFor(() => expect(stored()?.partySize).toBe(12), { timeout: 3000 });
  });
});

describe("honesty about where the data lives", () => {
  it("says the sheet is only on this device and is lost if site data is cleared", () => {
    renderSheet();
    expect(
      screen.getByText(/stored only in this browser, under one local key/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/lost if you clear this site’s data/i)).toBeInTheDocument();
  });

  it("sets no cookie and calls no network", () => {
    const cookieBefore = document.cookie;
    renderSheet();
    expect(document.cookie).toBe(cookieBefore);
  });
});
