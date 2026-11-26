import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { EditionProvider } from "@/components/shell";
import { PackingList } from "./packing-list";
import {
  PACKING_STORAGE_KEY,
  defaultPackingState,
  type PackingState,
} from "./packing-state";
import { SUGGESTION_LABEL } from "./packing-catalogue";

/** A fresh in-memory Storage, so tests never share state or a stub. */
function installStorage(): Storage {
  const map = new Map<string, string>();
  const storageLike: Storage = {
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
  Object.defineProperty(window, "localStorage", { configurable: true, value: storageLike });
  return storageLike;
}

/** Titles for every cited page, as the server component supplies them. */
const SOURCE_TITLES: Readonly<Record<string, string>> = {
  "https://belgium.tomorrowland.com/en/practical/forbidden-objects/":
    "Tomorrowland Belgium — forbidden objects",
  "https://belgium.tomorrowland.com/en/my-bracelet/top-up/":
    "Tomorrowland Belgium — top up your bracelet",
  "https://belgium.tomorrowland.com/en/practical/facilities/":
    "Tomorrowland Belgium — facilities",
  "https://belgium.tomorrowland.com/en/practical/your-tomorrowland-bracelet/":
    "Tomorrowland Belgium — your Tomorrowland bracelet",
  "https://faq.tomorrowland.com/hc/en-us/articles/360037588511-Can-I-enter-if-the-registered-name-on-the-Bracelet-is-not-my-own":
    "Can I enter if the registered name on the Bracelet is not my own",
  "https://belgium.tomorrowland.com/en/tickets/accommodations/magnificent-greens/magnificent-greens-1p-packages/":
    "Tomorrowland Belgium — Magnificent Greens 1P packages, 2027",
  "https://belgium.tomorrowland.com/en/practical/how-to-get-there/":
    "Tomorrowland Belgium — how to get there",
  "https://belgium.tomorrowland.com/en/tickets/accommodations/easy-tent/easy-tent-packages/easy-tent-2p-packages/":
    "Tomorrowland Belgium — Easy Tent 2P packages, 2027",
  "https://belgium.tomorrowland.com/en/practical/discover-dreamville/the-marketplace/":
    "Tomorrowland Belgium — the Marketplace",
  "https://belgium.tomorrowland.com/en/practical/reusable-cups/":
    "Tomorrowland Belgium — reusable cups",
  "https://winter.tomorrowland.com/en/tickets/festival-ticket/":
    "Tomorrowland Winter: festival ticket",
  "https://winter.tomorrowland.com/en/practical/your-tomorrowland-bracelet/":
    "Tomorrowland Winter: your Tomorrowland Bracelet",
  "https://winter.tomorrowland.com/en/add-ons/ski-and-snowboard-equipment/":
    "Tomorrowland Winter 2027 ski and snowboard equipment",
  "https://winter.tomorrowland.com/en/add-ons/": "Tomorrowland Winter 2027 add-ons",
  "https://winter.tomorrowland.com/en/add-ons/lockers/":
    "Tomorrowland Winter 2027 lockers",
  "https://winter.tomorrowland.com/en/practical/how-to-get-there/transportation-pass/":
    "Tomorrowland Winter: Transportation Pass",
  "https://winter.tomorrowland.com/en/tickets/festival-ticket-accommodation-transport/":
    "Tomorrowland Winter: festival ticket, accommodation and transport",
  "https://www.service-public.gouv.fr/particuliers/actualites/A14389":
    "Service-public.fr: winter equipment requirements",
  "https://tomorrowlandbrasil.zendesk.com/hc/en-us/articles/13511256421780":
    "Who is entitled to a half-price (meia-entrada) ticket?",
  "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/17510657026964":
    "Do I need a shuttle voucher for every festival day?",
  "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/53208584907028":
    "What is included in a Magnificent Greens package?",
  "https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/53208964543764":
    "What is included in an Easy Tent package?",
  "https://brasil.tomorrowland.com/en/tickets/ticket-accommodation/dreamville-packages/magnificent-greens-packages/magnificent-greens/":
    "Magnificent Greens packages",
};

function renderList() {
  return render(
    <EditionProvider>
      <PackingList sourceTitles={SOURCE_TITLES} />
    </EditionProvider>,
  );
}

/** The item checkboxes only: the filter is a checkbox too, and it is not an item. */
function itemCheckboxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(".packing-item__box"));
}

/** The checkbox whose label contains `text`. */
function checkboxFor(text: RegExp): HTMLInputElement {
  return screen.getByRole("checkbox", { name: text }) as HTMLInputElement;
}

let printSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  installStorage();
  printSpy = vi.fn();
  vi.stubGlobal("print", printSpy);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PackingList: first render", () => {
  it("lists the Belgium campsite items and reports progress in a live region", async () => {
    renderList();

    // The progress region is aria-live and reads as a count, not a percentage.
    const status = document.querySelector(".packing-progress__value");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.textContent).toMatch(/of \d+ packed/);

    // A DreamVille reader sees the tent item and the campsite food rule.
    await waitFor(() =>
      expect(checkboxFor(/Tent and bedding, if you booked a Magnificent Greens pitch/i)).toBeInTheDocument(),
    );
    expect(checkboxFor(/Food and drink for the campsite/i)).toBeInTheDocument();
  });

  it("renders every checkbox as a real input with an accessible name", async () => {
    renderList();
    const boxes = itemCheckboxes();
    expect(boxes.length).toBeGreaterThan(5);
    for (const box of boxes) {
      // A checkbox with no accessible name is unusable by voice and screen reader.
      expect(box, box.id).toHaveAccessibleName();
      expect(box.getAttribute("aria-label")).toBeNull();
      // The label is a real <label for>, not a click handler on a span.
      const label = document.querySelector(`label[for="${box.id}"]`);
      expect(label, box.id).not.toBeNull();
    }
  });

  it("names each item by its item text alone, not by its citation and rule", async () => {
    /*
      Named by the whole <label>, each checkbox announced about forty words before
      its own state: the item, the tag, the citation, the check date, the rule and
      the caveat. A reader tabbing the list heard the source twice per row. The
      item text is now the name and the rest is the description, so the state
      comes straight after the item.
    */
    renderList();

    const box = checkboxFor(/^Photo ID in the name on the bracelet$/i);
    expect(box).toHaveAccessibleName("Photo ID in the name on the bracelet");

    // The citation and the rule are still available, as the description.
    const described = box.getAttribute("aria-describedby");
    expect(described).not.toBeNull();
    const description = document.getElementById(described ?? "");
    expect(description?.textContent).toMatch(/A valid identity card, passport or driving licence/);
    expect(description?.textContent).toMatch(/Can I enter if the registered name/i);
  });

  it("keeps the citation link out of the checkbox's name", async () => {
    /*
      A link inside a <label> is both a hazard and a naming bug: clicking it can
      toggle the box, and its text lands in the box's name. The link is now a
      sibling of the label, so it stays a link and the name stays the item.
    */
    renderList();

    const box = checkboxFor(/^Photo ID in the name on the bracelet$/i);
    const link = screen.getByRole("link", {
      name: /Can I enter if the registered name on the Bracelet is not my own/i,
    });
    expect(box).not.toContainElement(link);
    expect(box).toHaveAccessibleName("Photo ID in the name on the bracelet");
    expect(link).toHaveAttribute("target", "_blank");

    // The link carries the citation, so it is the box's description, not its name.
    const described = box.getAttribute("aria-describedby");
    expect(document.getElementById(described ?? "")).toContainElement(link);
  });

  it("does not tick the item when the reader follows the citation", () => {
    /*
      This is the reason the citation left the <label>: inside it, a click on the
      source was also a click on the label, so reading the citation could silently
      change the checklist and the saved record.
    */
    renderList();

    const box = checkboxFor(/^Photo ID in the name on the bracelet$/i);
    const link = screen.getByRole("link", {
      name: /Can I enter if the registered name on the Bracelet is not my own/i,
    });

    fireEvent.click(link);
    expect(box).not.toBeChecked();

    // And the label itself still works as a target.
    const label = document.querySelector(`label[for="${box.id}"]`);
    expect(label).not.toBeNull();
    fireEvent.click(label as HTMLLabelElement);
    expect(box).toBeChecked();
  });

  it("shows only Belgium stays until the edition changes", () => {
    renderList();
    const group = screen.getByRole("group", { name: /Where you are staying/i });
    expect(within(group).getByRole("radio", { name: /DreamVille campsite/i })).toBeChecked();
    expect(within(group).queryByRole("radio", { name: /Alpe d'Huez resort/i })).not.toBeInTheDocument();
  });
});

describe("PackingList: ticking", () => {
  it("counts a ticked item and strikes it through", async () => {
    renderList();
    const box = checkboxFor(/Photo ID in the name on the bracelet/i);
    fireEvent.click(box);

    await waitFor(() => expect(box).toBeChecked());
    expect(box.closest("li")).toHaveAttribute("data-packed", "true");
  });

  it("updates the live region to say when everything is packed", async () => {
    renderList();
    for (const box of itemCheckboxes()) fireEvent.click(box);

    await waitFor(() => expect(screen.getByText(/^All \d+ items packed\.$/)).toBeInTheDocument());
  });

  it("keeps a tick after a remount", async () => {
    const storage = installStorage();
    const { unmount } = renderList();

    fireEvent.click(checkboxFor(/Photo ID in the name on the bracelet/i));
    await waitFor(() => {
      const stored = storage.getItem(PACKING_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored ?? "{}").packed).toContain("belgium-photo-id");
    });

    unmount();
    renderList();
    await waitFor(() =>
      expect(checkboxFor(/Photo ID in the name on the bracelet/i)).toBeChecked(),
    );
  });
});

describe("PackingList: filter", () => {
  it("hides packed items and restores them when unticked", async () => {
    renderList();
    const photoId = checkboxFor(/Photo ID in the name on the bracelet/i);
    fireEvent.click(photoId);
    await waitFor(() => expect(photoId).toBeChecked());

    fireEvent.click(screen.getByLabelText(/Show unpacked only/i));
    await waitFor(() => expect(photoId.closest("li")).toHaveAttribute("hidden"));

    fireEvent.click(screen.getByLabelText(/Show unpacked only/i));
    await waitFor(() => expect(photoId.closest("li")).not.toHaveAttribute("hidden"));
  });

  it("says so in words when the filter leaves nothing", async () => {
    renderList();
    for (const box of itemCheckboxes()) fireEvent.click(box);
    await waitFor(() => expect(screen.getByText(/^All \d+ items packed\.$/)).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Show unpacked only/i));
    await waitFor(() =>
      expect(screen.getByText(/Everything on this list is packed/i)).toBeInTheDocument(),
    );
  });
});

describe("PackingList: own items", () => {
  it("adds a trimmed item and counts it", async () => {
    renderList();
    const field = screen.getByLabelText(/Add your own item/i) as HTMLInputElement;
    fireEvent.change(field, { target: { value: "  Sleep   mask  " } });
    fireEvent.click(screen.getByRole("button", { name: /^Add item to your list$/i }));

    await waitFor(() => expect(checkboxFor(/Sleep mask/)).toBeInTheDocument());
    expect(field.value).toBe("");
    // The live region counts the reader's own item in the same total.
    expect(document.querySelector(".packing-progress__value")?.textContent).toMatch(
      /0 of \d+ packed/,
    );
  });

  it("refuses an empty item with a message", async () => {
    renderList();
    fireEvent.change(screen.getByLabelText(/Add your own item/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /^Add item to your list$/i }));

    await waitFor(() => expect(screen.getByText(/Type the item you want to add/i)).toBeInTheDocument());
  });

  it("refuses a duplicate regardless of case and spacing", async () => {
    renderList();
    const field = screen.getByLabelText(/Add your own item/i);
    fireEvent.change(field, { target: { value: "Earplugs" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add item to your list$/i }));
    await waitFor(() => expect(checkboxFor(/Earplugs/)).toBeInTheDocument());

    fireEvent.change(field, { target: { value: "  earPLUGS " } });
    fireEvent.click(screen.getByRole("button", { name: /^Add item to your list$/i }));
    await waitFor(() => expect(screen.getByText(/already on your list/i)).toBeInTheDocument());
  });

  it("caps the field at 80 characters", () => {
    renderList();
    const field = screen.getByLabelText(/Add your own item/i) as HTMLInputElement;
    expect(field.maxLength).toBe(80);
  });

  it("removes an item and its tick together", async () => {
    renderList();
    fireEvent.change(screen.getByLabelText(/Add your own item/i), { target: { value: "Sleep mask" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add item to your list$/i }));
    const box = await screen.findByRole("checkbox", { name: /Sleep mask/ });

    fireEvent.click(box);
    await waitFor(() => expect(box).toBeChecked());

    fireEvent.click(screen.getByRole("button", { name: /^Remove Sleep mask$/i }));
    await waitFor(() =>
      expect(screen.queryByRole("checkbox", { name: /Sleep mask/ })).not.toBeInTheDocument(),
    );
    // The total falls back to the catalogue alone once the last own item is gone.
    expect(document.querySelector(".packing-progress__value")?.textContent).toMatch(
      /0 of \d+ packed/,
    );
  });

  it("counts the reader's own item in the live total", async () => {
    renderList();
    const before = document.querySelector(".packing-progress__value")?.textContent ?? "";
    fireEvent.change(screen.getByLabelText(/Add your own item/i), { target: { value: "Sleep mask" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add item to your list$/i }));

    await waitFor(() => {
      const after = document.querySelector(".packing-progress__value")?.textContent ?? "";
      expect(after).not.toBe(before);
    });
    // "0 of 18 packed." becomes "0 of 19 packed." — the own item is part of the count.
    const totals = [before, document.querySelector(".packing-progress__value")?.textContent ?? ""].map(
      (text) => Number(/(\d+) packed/.exec(text)?.[1] ?? "0"),
    );
    expect(totals[1]).toBe(totals[0] + 1);
  });

  it("keeps own items through a reset but clears every tick", async () => {
    renderList();
    fireEvent.change(screen.getByLabelText(/Add your own item/i), { target: { value: "Sleep mask" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add item to your list$/i }));
    const own = await screen.findByRole("checkbox", { name: /Sleep mask/ });
    fireEvent.click(own);
    fireEvent.click(checkboxFor(/Photo ID in the name on the bracelet/i));
    await waitFor(() => expect(own).toBeChecked());

    fireEvent.click(screen.getByRole("button", { name: /^Reset all ticks$/i }));

    await waitFor(() => expect(own).not.toBeChecked());
    expect(checkboxFor(/Sleep mask/)).toBeInTheDocument();
    expect(screen.getByText(/Every tick cleared/i)).toBeInTheDocument();
  });

  it("renders typed text as text, never as markup", async () => {
    renderList();
    const payload = "<img src=x onerror=alert(1)>";
    fireEvent.change(screen.getByLabelText(/Add your own item/i), { target: { value: payload } });
    fireEvent.click(screen.getByRole("button", { name: /^Add item to your list$/i }));

    const box = await screen.findByRole("checkbox", { name: new RegExp("img src=x") });
    // The string appears as its own characters and no element was created.
    expect(box.closest("li")?.querySelector("img")).toBeNull();
    expect(box.closest("li")?.textContent).toContain(payload);
  });
});

describe("PackingList: edition and stay", () => {
  it("switches to Winter's resort items and drops the Belgium campsite ones", async () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Winter" }));

    await waitFor(() => expect(checkboxFor(/Helmet/i)).toBeInTheDocument());
    expect(screen.queryByRole("checkbox", { name: /Tent and bedding/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Pearls loaded/i })).not.toBeInTheDocument();
  });

  it("adds the Transportation Pass only when the Winter stay is outside the resort", async () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Winter" }));
    await waitFor(() => expect(checkboxFor(/Helmet/i)).toBeInTheDocument());

    expect(screen.queryByRole("checkbox", { name: /Transportation Pass/i })).not.toBeInTheDocument();

    const group = screen.getByRole("group", { name: /Where you are staying/i });
    fireEvent.click(within(group).getByRole("radio", { name: /surrounding village|Oz 3300/i }));

    await waitFor(() => expect(checkboxFor(/Transportation Pass/i)).toBeInTheDocument());
  });

  it("moves to the new edition's first stay when the old stay does not exist there", async () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Brasil" }));

    await waitFor(() => {
      const group = screen.getByRole("group", { name: /Where you are staying/i });
      expect(within(group).getByRole("radio", { name: /DreamVille campsite/i })).toBeChecked();
    });
    // Brasil has no prohibited-items list, and the page says so rather than guessing.
    expect(screen.getByText(/no Brasil page listing prohibited items/i)).toBeInTheDocument();
  });
});

describe("PackingList: sourcing and suggestions", () => {
  it("labels every suggestion exactly as the brief requires", () => {
    renderList();
    const labels = screen.getAllByText(SUGGESTION_LABEL);
    expect(labels.length).toBeGreaterThan(0);
    expect(SUGGESTION_LABEL).toBe("Suggestion, not an official requirement");
  });

  it("gives every official item a link to the page that states it", () => {
    renderList();
    const official = screen.getAllByText("Official");
    for (const tag of official) {
      const item = tag.closest("li");
      const link = item?.querySelector("a[href^='https://']");
      expect(link, item?.textContent ?? "item").not.toBeNull();
    }
  });

  it("never shows a suggestion with a rule or a citation", () => {
    renderList();
    for (const tag of screen.getAllByText(SUGGESTION_LABEL)) {
      const item = tag.closest("li");
      // A suggestion row carries no rule paragraph and no source link.
      expect(item?.querySelector(".packing-item__rule")).toBeNull();
      expect(item?.querySelector("a[href^='https://']")).toBeNull();
    }
  });

  it("states the unpublished gaps instead of filling them", () => {
    renderList();
    expect(screen.getByText(/No 2027 locker price or size table is published/i)).toBeInTheDocument();
  });
});

describe("PackingList: corrupt storage", () => {
  it("starts fresh and says so when the stored record is unreadable", async () => {
    const storage = installStorage();
    storage.setItem(PACKING_STORAGE_KEY, "{not json");
    renderList();

    await waitFor(() => expect(screen.getByText(/Starting fresh/i)).toBeInTheDocument());
    expect(checkboxFor(/Photo ID in the name on the bracelet/i)).not.toBeChecked();
  });

  it("keeps working when storage refuses every call", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });

    renderList();
    fireEvent.click(checkboxFor(/Photo ID in the name on the bracelet/i));
    await waitFor(() => expect(checkboxFor(/Photo ID in the name on the bracelet/i)).toBeChecked());
  });
});

describe("PackingList: print", () => {
  it("calls the browser's print dialog", async () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /^Print this checklist$/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("carries a printable heading with the edition and stay", () => {
    renderList();
    const head = document.querySelector(".packing-print-head");
    expect(head?.textContent).toContain("TMLGuide packing list");
    expect(head?.textContent).toContain("Belgium");
  });
});

describe("PackingList: state contract", () => {
  it("writes only the one documented key", async () => {
    const storage = installStorage();
    renderList();
    fireEvent.click(checkboxFor(/Photo ID in the name on the bracelet/i));

    await waitFor(() => expect(storage.getItem(PACKING_STORAGE_KEY)).not.toBeNull());
    expect(storage.length).toBe(1);
  });

  it("stores the documented shape", async () => {
    const storage = installStorage();
    renderList();
    fireEvent.click(checkboxFor(/Photo ID in the name on the bracelet/i));

    await waitFor(() => {
      const stored = JSON.parse(storage.getItem(PACKING_STORAGE_KEY) ?? "{}") as PackingState;
      expect(Object.keys(stored).sort()).toEqual(["custom", "edition", "packed", "stay"]);
      expect(stored.edition).toBe("belgium");
      expect(stored.stay).toBe("belgium-dreamville");
      expect(stored.packed).toEqual(["belgium-photo-id"]);
    });
  });

  it("restores a stored edition and stay rather than the site default", async () => {
    const storage = installStorage();
    storage.setItem(
      PACKING_STORAGE_KEY,
      JSON.stringify({
        ...defaultPackingState("winter"),
        stay: "winter-outside",
        packed: ["winter-helmet"],
      }),
    );

    renderList();
    await waitFor(() => expect(checkboxFor(/Helmet/i)).toBeChecked());
    const group = screen.getByRole("group", { name: /Where you are staying/i });
    expect(within(group).getByRole("radio", { name: /Oz 3300|surrounding village/i })).toBeChecked();
  });
});
