import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchPalette } from "./search-palette";
import { installDialog, installStorage } from "./test-environment";
import { RECENT_SEARCHES_KEY } from "@/lib/search/recent";
import type { SearchEntry } from "@/lib/search/types";

/**
 * Behaviour tests for the palette.
 *
 * Both jsdom gaps this needs — a method-less `localStorage` and a
 * `HTMLDialogElement` with no `showModal`/`close` — are filled by
 * `./test-environment`, which documents them. Nothing else is mocked: the
 * ranking, grouping and recents code under test is the real code.
 */

const INDEX: SearchEntry[] = [
  {
    id: "ticket:tickets-day-pass",
    title: "Day Pass",
    snippet: "2027 · €144.00 pre-sale · €159.00 WorldWide sale · per person",
    kind: "ticket",
    kindLabel: "Ticket",
    edition: "belgium",
    href: "/guides/tickets",
    source: "src/data/belgium/tickets.ts",
    sourceUrl: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
    lastVerified: "2026-11-18",
  },
  {
    id: "ticket:winter-seven-day",
    title: "7-Day Festival Ticket",
    snippet: "2027 · €735.00 · per person · Festival access from 20 to 27 March 2027",
    kind: "ticket",
    kindLabel: "Ticket",
    edition: "winter",
    href: "/guides/tickets?edition=winter",
    source: "src/data/winter/tickets.ts",
    sourceUrl: "https://winter.tomorrowland.com/fr/tickets/ticket-festival/",
    lastVerified: "2026-11-18",
  },
  {
    id: "faq:faq-lockers",
    title: "Are there lockers at the festival?",
    snippet: "Yes, and they are best pre-booked in the June add-on sale.",
    kind: "faq",
    kindLabel: "FAQ",
    edition: "belgium",
    href: "/guides",
    source: "src/data/belgium/faqs.ts",
    sourceUrl: "https://belgium.tomorrowland.com/en/practical/facilities/",
    lastVerified: "2026-11-18",
  },
  {
    id: "stay:belgium-stay-easy-tent-2p",
    title: "Easy Tent 2P",
    snippet: "2027 · €1,240.00 pre-sale · €1,372.00 WorldWide sale · for the whole stay",
    kind: "accommodation",
    kindLabel: "Accommodation",
    edition: "belgium",
    href: "/guides/tickets",
    source: "src/data/belgium/accommodation.ts",
  },
  {
    id: "sale:sale-worldwide-ticket-sale",
    title: "WorldWide Ticket Sale",
    snippet: "Saturday 13 February 2027, 17:00 CET · General sale of tickets and DreamVille packages",
    kind: "sale",
    kindLabel: "Sale",
    edition: "belgium",
    href: "/tools/sale-timeline",
    source: "src/data/belgium/sale-windows.ts",
    sourceUrl: "https://faq.tomorrowland.com/hc/en-us/articles/360037219532",
    lastVerified: "2026-11-18",
  },
  {
    id: "page:page-community",
    title: "Community",
    snippet: "Attendee-run WhatsApp groups, third-party resources and partner offers.",
    kind: "page",
    kindLabel: "Page",
    edition: "all",
    href: "/community",
    source: "src/app/community/page.tsx",
  },
];

function renderPalette(overrides: Partial<Parameters<typeof SearchPalette>[0]> = {}) {
  const navigate = vi.fn();
  const utils = render(<SearchPalette index={INDEX} navigate={navigate} {...overrides} />);
  return { ...utils, navigate };
}

function dialog(): HTMLDialogElement {
  const element = document.querySelector("dialog");
  if (element === null) throw new Error("Expected a dialog element");
  return element as HTMLDialogElement;
}

function input(): HTMLInputElement {
  return screen.getByRole("combobox") as HTMLInputElement;
}

function openWithShortcut() {
  fireEvent.keyDown(document, { key: "k", ctrlKey: true });
}

async function openPalette() {
  openWithShortcut();
  await waitFor(() => expect(dialog().open).toBe(true));
}

beforeEach(() => {
  installStorage();
  installDialog();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("SearchPalette opening", () => {
  it("starts closed, with nothing locked and nothing announced", () => {
    renderPalette();
    expect(dialog().open).toBe(false);
    expect(document.body.style.overflow).not.toBe("hidden");
    // A closed dialog is out of the accessibility tree, so its parts are
    // queried through the DOM rather than by role: they must still exist.
    expect(document.querySelector('input[role="combobox"]')).toBeTruthy();
    expect(document.querySelector('[role="status"]')?.textContent).toBe("");
  });

  it("opens on Ctrl+K and focuses the input", async () => {
    renderPalette();
    await openPalette();
    expect(document.activeElement).toBe(input());
  });

  it("opens on Cmd+K", async () => {
    renderPalette();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await waitFor(() => expect(dialog().open).toBe(true));
  });

  it("opens while typing in another input, because it is the shortcut", async () => {
    render(
      <>
        <input aria-label="other" />
        <SearchPalette index={INDEX} navigate={vi.fn()} />
      </>,
    );
    const other = screen.getByLabelText("other") as HTMLInputElement;
    other.focus();
    fireEvent.keyDown(other, { key: "k", ctrlKey: true });
    await waitFor(() => expect(dialog().open).toBe(true));
  });

  it("does not open on a bare k, or with extra modifiers", () => {
    renderPalette();
    fireEvent.keyDown(document, { key: "k" });
    fireEvent.keyDown(document, { key: "k", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document, { key: "j", ctrlKey: true });
    expect(dialog().open).toBe(false);
  });

  it("does not open twice when the shortcut is pressed again", async () => {
    renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "lockers" } });
    openWithShortcut();
    expect(input().value).toBe("lockers");
  });
});

describe("SearchPalette header trigger", () => {
  it("opens on click and carries the typed text into the dialog", async () => {
    render(
      <>
        <input data-search-trigger aria-label="search" defaultValue="lockers" />
        <SearchPalette index={INDEX} navigate={vi.fn()} />
      </>,
    );

    const trigger = screen.getByLabelText("search") as HTMLInputElement;
    fireEvent.click(trigger);

    await waitFor(() => expect(dialog().open).toBe(true));
    expect(input().value).toBe("lockers");
    // The header field is emptied and unfocused, so nothing is lost or doubled.
    expect(trigger.value).toBe("");
    expect(document.activeElement).toBe(input());
  });

  it("opens on focus (keyboard tabbing) without a click", async () => {
    render(
      <>
        <input data-search-trigger aria-label="search" />
        <SearchPalette index={INDEX} navigate={vi.fn()} />
      </>,
    );

    act(() => {
      (screen.getByLabelText("search") as HTMLInputElement).focus();
    });
    await waitFor(() => expect(dialog().open).toBe(true));
  });

  it("opens from a non-input trigger with no seed", async () => {
    render(
      <>
        <button data-search-trigger type="button">
          Search
        </button>
        <SearchPalette index={INDEX} navigate={vi.fn()} />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(dialog().open).toBe(true));
    expect(input().value).toBe("");
  });

  it("keeps the seeded text when a click is preceded by focusin", async () => {
    // A real pointer press fires `focusin` then `click`. The second handler must
    // not reopen with an empty seed after the field was already cleared.
    render(
      <>
        <input data-search-trigger aria-label="search" defaultValue="lockers" />
        <SearchPalette index={INDEX} navigate={vi.fn()} />
      </>,
    );

    const trigger = screen.getByLabelText("search") as HTMLInputElement;
    fireEvent.focusIn(trigger);
    await waitFor(() => expect(dialog().open).toBe(true));
    expect(input().value).toBe("lockers");

    fireEvent.click(trigger);
    await act(async () => {
      await Promise.resolve();
    });
    expect(input().value).toBe("lockers");
  });
});

describe("SearchPalette combobox wiring", () => {
  it("exposes the full combobox aria contract", async () => {
    renderPalette();
    await openPalette();

    const box = input();
    expect(box.getAttribute("aria-expanded")).toBe("false");
    expect(box.getAttribute("aria-autocomplete")).toBe("list");
    expect(box.getAttribute("aria-labelledby")).toBeTruthy();
    expect(box.getAttribute("aria-activedescendant")).toBeNull();
    // Nothing is controlled until a listbox exists to point at.
    expect(box.getAttribute("aria-controls")).toBeNull();

    fireEvent.change(box, { target: { value: "ticket" } });

    await waitFor(() => expect(box.getAttribute("aria-expanded")).toBe("true"));
    const controls = box.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)?.getAttribute("role")).toBe("listbox");

    const active = box.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    expect(document.getElementById(active!)).toBeTruthy();
  });

  it("labels the dialog for assistive technology", async () => {
    renderPalette();
    await openPalette();

    const labelledBy = dialog().getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe("Search TMLGUIDE");
  });

  it("announces the result count in a polite live region", async () => {
    renderPalette();
    await openPalette();

    fireEvent.change(input(), { target: { value: "lockers" } });
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    await waitFor(() => expect(status.textContent).toBe("1 result"));

    fireEvent.change(input(), { target: { value: "sale" } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/\d+ results/));
  });

  it("says nothing before a query is typed", async () => {
    renderPalette();
    await openPalette();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("groups results under a labelled kind heading", async () => {
    renderPalette();
    await openPalette();

    fireEvent.change(input(), { target: { value: "sale" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    const groups = screen.getAllByRole("group");
    expect(groups.length).toBeGreaterThan(1);
    for (const group of groups) {
      expect(group.getAttribute("aria-label")).toBeTruthy();
    }

    const labels = groups.map((group) => group.getAttribute("aria-label"));
    expect(labels).toContain("Sale");
    expect(labels).toContain("Ticket");
  });

  it("keeps only options inside a listbox group", async () => {
    renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "sale" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    // A group inside a listbox may contain options and nothing else. The visible
    // heading is aria-hidden, so it is not exposed as a child of the group.
    for (const group of screen.getAllByRole("group")) {
      for (const child of Array.from(group.children)) {
        if (child.getAttribute("aria-hidden") === "true") continue;
        expect(child.getAttribute("role")).toBe("option");
      }
      expect(group.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
    }
  });
});

describe("SearchPalette keyboard navigation", () => {
  async function openWithQuery(value: string) {
    renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());
  }

  function options(): HTMLElement[] {
    return screen.getAllByRole("option");
  }

  function selectedId(): string | null {
    const selected = options().filter((option) => option.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    return selected[0].id;
  }

  it("moves with arrow keys and wraps at both ends", async () => {
    await openWithQuery("sale");
    expect(options().length).toBeGreaterThanOrEqual(2);

    expect(selectedId()).toBe(options()[0].id);
    expect(input().getAttribute("aria-activedescendant")).toBe(options()[0].id);

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(selectedId()).toBe(options()[1].id);

    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(selectedId()).toBe(options()[0].id);

    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(selectedId()).toBe(options()[options().length - 1].id);

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(selectedId()).toBe(options()[0].id);
  });

  it("jumps with Home and End", async () => {
    await openWithQuery("sale");

    fireEvent.keyDown(input(), { key: "End" });
    expect(selectedId()).toBe(options()[options().length - 1].id);

    fireEvent.keyDown(input(), { key: "Home" });
    expect(selectedId()).toBe(options()[0].id);
  });

  it("steps through every option exactly once", async () => {
    await openWithQuery("sale");
    const ids = options().map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Every id is reachable by pressing Down from the top.
    const visited: string[] = [options()[0].id];
    for (let step = 1; step < ids.length; step += 1) {
      fireEvent.keyDown(input(), { key: "ArrowDown" });
      visited.push(selectedId()!);
    }
    expect(visited).toEqual(ids);
  });

  it("navigates with Enter and records the search", async () => {
    const { navigate } = renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "lockers" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    fireEvent.keyDown(input(), { key: "Enter" });

    expect(navigate).toHaveBeenCalledWith("/guides");
    await waitFor(() => expect(dialog().open).toBe(false));
    expect(JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)!)).toEqual(["lockers"]);
  });

  it("opens the second result after one ArrowDown", async () => {
    const { navigate } = renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "sale" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    const second = options()[1];
    const secondHref = second.getAttribute("href");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(secondHref);
  });

  it("resets the highlight when the query changes", async () => {
    await openWithQuery("sale");
    fireEvent.keyDown(input(), { key: "End" });
    expect(selectedId()).toBe(options()[options().length - 1].id);

    fireEvent.change(input(), { target: { value: "lockers" } });
    await waitFor(() => expect(options()).toHaveLength(1));
    expect(selectedId()).toBe(options()[0].id);
  });

  it("does nothing on Enter when no result matches", async () => {
    const { navigate } = renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "zzzzzz" } });
    await waitFor(() => expect(screen.getByText(/No results for/)).toBeTruthy());

    fireEvent.keyDown(input(), { key: "Enter" });
    expect(navigate).not.toHaveBeenCalled();
    expect(dialog().open).toBe(true);
  });

  it("does not move the highlight when there are no options", async () => {
    render(<SearchPalette index={[]} navigate={vi.fn()} />);
    await openPalette();
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "Home" });
    fireEvent.keyDown(input(), { key: "End" });
    expect(input().getAttribute("aria-activedescendant")).toBeNull();
  });

  it("navigates by clicking a result", async () => {
    const { navigate } = renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "easy tent" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    const option = screen.getAllByRole("option")[0];
    expect(option.textContent).toContain("Easy Tent 2P");
    fireEvent.click(option);

    expect(navigate).toHaveBeenCalledWith("/guides/tickets");
    await waitFor(() => expect(dialog().open).toBe(false));
  });

  it("reopens after choosing a result", async () => {
    const { navigate } = renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "lockers" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(navigate).toHaveBeenCalled();

    // The close path must clear the "already open" guard, or the palette is
    // permanently dead after the first navigation.
    await openPalette();
  });

  it("reopens after a quick link", async () => {
    const { navigate } = renderPalette();
    await openPalette();

    fireEvent.click(screen.getByRole("link", { name: /Tickets and packages/ }));
    expect(navigate).toHaveBeenCalledWith("/guides/tickets");

    await openPalette();
  });
});

describe("SearchPalette closing", () => {
  it("closes on Escape and restores focus to the trigger", async () => {
    render(
      <>
        <button data-search-trigger type="button">
          Open search
        </button>
        <SearchPalette index={INDEX} navigate={vi.fn()} />
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Open search" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(dialog().open).toBe(true));
    expect(document.activeElement).toBe(input());

    fireEvent.keyDown(dialog(), { key: "Escape" });

    await waitFor(() => expect(dialog().open).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("closes on a backdrop click but not on a panel click", async () => {
    renderPalette();
    await openPalette();

    fireEvent.click(input());
    expect(dialog().open).toBe(true);

    fireEvent.click(dialog());
    await waitFor(() => expect(dialog().open).toBe(false));
  });

  it("closes on the mobile close button", async () => {
    renderPalette();
    await openPalette();

    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    await waitFor(() => expect(dialog().open).toBe(false));
  });

  it("restores focus to whatever held it before opening", async () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <SearchPalette index={INDEX} navigate={vi.fn()} />
      </>,
    );

    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    act(() => elsewhere.focus());

    await openPalette();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(elsewhere));
  });

  /**
   * The regression this component exists to keep fixed. The header field is
   * itself a trigger, so restoring focus to it fires `focusin` — and an
   * unguarded handler would reopen the palette the instant it closed.
   */
  it("does not reopen when focus returns to the trigger-shaped header field", async () => {
    render(
      <>
        <input data-search-trigger aria-label="search" />
        <SearchPalette index={INDEX} navigate={vi.fn()} />
      </>,
    );

    const trigger = screen.getByLabelText("search") as HTMLInputElement;
    trigger.focus();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.keyDown(dialog(), { key: "Escape" });
    await waitFor(() => expect(dialog().open).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    // Give any stray listener time to fire.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(dialog().open).toBe(false);

    // And it still opens on a fresh click, so the guard suppressed the echo
    // rather than the trigger.
    fireEvent.click(trigger);
    await waitFor(() => expect(dialog().open).toBe(true));
  });

  it("does not reopen after a result navigation either", async () => {
    render(
      <>
        <input data-search-trigger aria-label="search" />
        <SearchPalette index={INDEX} navigate={vi.fn()} />
      </>,
    );

    const trigger = screen.getByLabelText("search") as HTMLInputElement;
    trigger.focus();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.change(input(), { target: { value: "lockers" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());
    fireEvent.keyDown(input(), { key: "Enter" });

    await waitFor(() => expect(dialog().open).toBe(false));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(dialog().open).toBe(false);
  });

  it("mirrors a native dialog close back into state", async () => {
    renderPalette();
    await openPalette();

    // Simulate the browser closing the element on its own (a platform dismiss
    // gesture), which never goes through the component's close().
    act(() => {
      dialog().dispatchEvent(new Event("cancel"));
      dialog().removeAttribute("open");
      dialog().dispatchEvent(new Event("close"));
    });

    await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));

    // The guard must be clear too, so the shortcut still works.
    await openPalette();
  });

  it("locks background scroll while open and restores it after", async () => {
    renderPalette();
    await openPalette();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(dialog(), { key: "Escape" });
    await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));
  });

  it("traps Tab inside the dialog", async () => {
    renderPalette();
    await openPalette();

    const focusable = Array.from(
      dialog().querySelectorAll<HTMLElement>(
        'a[href]:not([tabindex="-1"]), button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(focusable.length).toBeGreaterThan(1);

    const last = focusable[focusable.length - 1];
    const first = focusable[0];
    last.focus();
    fireEvent.keyDown(dialog(), { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(dialog(), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("leaves the result rows out of the Tab order, as a combobox requires", async () => {
    renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "sale" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    for (const option of screen.getAllByRole("option")) {
      expect(option.getAttribute("tabindex")).toBe("-1");
    }
  });
});

describe("SearchPalette empty and no-result states", () => {
  it("shows quick links and no recent section when there is no history", async () => {
    renderPalette();
    await openPalette();

    expect(screen.getByText("Quick links")).toBeTruthy();
    expect(screen.queryByText("Recent")).toBeNull();
    expect(input().getAttribute("aria-expanded")).toBe("false");
  });

  it("offers only real routes as quick links", async () => {
    renderPalette();
    await openPalette();

    const links = screen.getAllByRole("link");
    for (const link of links) {
      const href = link.getAttribute("href")!;
      expect(href.startsWith("/")).toBe(true);
    }
    expect(screen.getByRole("link", { name: /Ticket sale timeline/ }).getAttribute("href")).toBe(
      "/tools/sale-timeline",
    );
  });

  it("shows recent searches, newest first, and lets them be reused", async () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(["pearls", "lockers"]));
    renderPalette();
    await openPalette();

    expect(screen.getByText("Recent")).toBeTruthy();
    expect(screen.getByRole("button", { name: "pearls" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "pearls" }));
    expect(input().value).toBe("pearls");
  });

  it("clears recent searches", async () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(["pearls"]));
    renderPalette();
    await openPalette();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByText("Recent")).toBeNull();
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
  });

  it("keeps the recents out of a corrupt store without throwing", async () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, "{not json");
    renderPalette();
    await openPalette();

    expect(screen.queryByText("Recent")).toBeNull();
    expect(screen.getByText("Quick links")).toBeTruthy();
  });

  it("suggests alternatives and says plainly when nothing matches", async () => {
    renderPalette();
    await openPalette();

    fireEvent.change(input(), { target: { value: "zzzzzz" } });
    await waitFor(() => expect(screen.getByText(/No results for/)).toBeTruthy());
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("0 results");

    // A suggestion fills the field and produces results.
    fireEvent.click(screen.getByRole("button", { name: "tickets" }));
    expect(input().value).toBe("tickets");
  });

  it("makes no third-party request of its own", async () => {
    // The palette has no network code at all; the only external links it can
    // render are the provenance links in the footer, and those are inert until
    // clicked. This asserts the shape rather than the traffic: every anchor is
    // either internal or carries rel=noopener noreferrer.
    renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "day pass" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    for (const anchor of Array.from(document.querySelectorAll("a"))) {
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("/")) continue;
      expect(anchor.getAttribute("rel"), href).toContain("noopener");
      expect(anchor.getAttribute("rel"), href).toContain("noreferrer");
    }
  });
});

describe("SearchPalette highlighting", () => {
  it("emphasises the matched words without altering the text", async () => {
    renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "lockers" } });

    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());
    const marks = screen.getAllByText("lockers");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].tagName).toBe("MARK");
  });

  it("renders a title containing markup as text, never as HTML", async () => {
    const hostile: SearchEntry[] = [
      {
        id: "page:page-hostile",
        title: "<img src=x onerror=alert(1)> alert",
        snippet: "<script>alert(2)</script>",
        kind: "page",
        kindLabel: "Page",
        edition: "all",
        href: "/",
        source: "test",
      },
    ];

    render(<SearchPalette index={hostile} navigate={vi.fn()} />);
    await openPalette();
    fireEvent.change(input(), { target: { value: "alert" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    // Nothing was parsed as markup, and the angle brackets survive as text.
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(document.body.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(document.body.textContent).toContain("<script>alert(2)</script>");
  });
});

describe("SearchPalette provenance", () => {
  function footer(): HTMLElement {
    return document.querySelector("dialog > div > p:last-of-type") as HTMLElement;
  }

  it("names the source and check date of the highlighted row", async () => {
    renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "day pass" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    expect(footer().textContent).toContain("Source:");
    expect(footer().textContent).toContain("Checked 18 Nov 2026");

    const source = within(footer()).getByRole("link");
    expect(source.getAttribute("href")).toBe(
      "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
    );
    expect(source.getAttribute("target")).toBe("_blank");
    expect(source.getAttribute("rel")).toContain("noopener");
    expect(source.getAttribute("rel")).toContain("noreferrer");
  });

  it("keeps the combobox description stable as the highlight moves", async () => {
    renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "sale" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    const describedBy = input().getAttribute("aria-describedby")!;
    const before = document.getElementById(describedBy)!.textContent;

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(document.getElementById(describedBy)!.textContent).toBe(before);
  });

  it("shows the keyboard hint for a row with no citation", async () => {
    renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "community" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    expect(footer().textContent).not.toContain("Source:");
    expect(footer().textContent).toContain("to move");
  });

  it("omits an unreadable check date rather than printing Invalid Date", async () => {
    const odd: SearchEntry[] = [
      {
        id: "page:page-odd",
        title: "Odd record",
        snippet: "A record whose date is malformed.",
        kind: "page",
        kindLabel: "Page",
        edition: "all",
        href: "/",
        source: "test",
        sourceUrl: "https://example.com/odd",
        lastVerified: "not-a-date",
      },
    ];

    render(<SearchPalette index={odd} navigate={vi.fn()} />);
    await openPalette();
    fireEvent.change(input(), { target: { value: "odd" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());

    expect(footer().textContent).toContain("Source:");
    expect(footer().textContent).not.toContain("Checked");
    expect(footer().textContent).not.toContain("Invalid");
  });
});

describe("SearchPalette edition boost", () => {
  it("asks for the edition once, when it opens, not on every keystroke", async () => {
    const resolveEdition = vi.fn(() => "winter" as const);
    renderPalette({ resolveEdition });

    expect(resolveEdition).not.toHaveBeenCalled();
    await openPalette();
    expect(resolveEdition).toHaveBeenCalledTimes(1);

    fireEvent.change(input(), { target: { value: "pass" } });
    fireEvent.change(input(), { target: { value: "day pass" } });
    expect(resolveEdition).toHaveBeenCalledTimes(1);
  });

  it("still works with no resolver at all, which means no boost", async () => {
    renderPalette();
    await openPalette();
    fireEvent.change(input(), { target: { value: "pass" } });
    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());
  });
});
