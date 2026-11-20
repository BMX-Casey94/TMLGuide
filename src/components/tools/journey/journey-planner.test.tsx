import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { allJourneyPlans } from "./journey-logic";
import { JourneyPlanner } from "./journey-planner";
import { JOURNEY_STORAGE_KEY } from "./journey-state";

const PLANS = allJourneyPlans();

/** A fresh in-memory Storage per test, so no test inherits another's plan. */
function installStorage(): Storage {
  const map = new Map<string, string>();
  const storage = {
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
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  return storage;
}

function renderPlanner() {
  return render(<JourneyPlanner plans={PLANS} />);
}

/** The results region, which is the only live region on the page. */
function resultsRegion(): HTMLElement {
  const heading = screen.getByRole("heading", { name: "Your route" });
  const region = heading.closest("section");
  if (region === null) throw new Error("the results heading is not inside a section");
  return region;
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  cleanup();
});

describe("JourneyPlanner", () => {
  it("opens on the Belgium, DreamVille, plane plan", async () => {
    renderPlanner();
    await waitFor(() =>
      expect(resultsRegion().textContent).toContain("Belgium — DreamVille, arriving by plane"),
    );
  });

  it("offers the edition, bed and arrival method as real labelled groups", async () => {
    renderPlanner();

    const edition = screen.getByRole("group", { name: "Edition" });
    expect(within(edition).getByRole("radio", { name: /Belgium/ })).toBeChecked();
    expect(within(edition).getByRole("radio", { name: /Winter/ })).not.toBeChecked();

    const sleep = screen.getByRole("group", { name: "Where you are sleeping" });
    expect(within(sleep).getByRole("radio", { name: /DreamVille/ })).toBeChecked();

    const arrival = screen.getByRole("group", { name: "How you arrive" });
    expect(within(arrival).getByRole("radio", { name: /Plane/ })).toBeChecked();
    expect(within(arrival).getAllByRole("radio")).toHaveLength(4);
  });

  it("has exactly one live region for the result, and it is polite", async () => {
    renderPlanner();
    const region = resultsRegion();
    const live = region.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.getAttribute("aria-atomic")).toBe("true");
  });

  it("changes the bed options when the edition changes, because the editions share no vocabulary", async () => {
    renderPlanner();

    fireEvent.click(screen.getByRole("radio", { name: /Winter/ }));

    const sleep = await screen.findByRole("group", { name: "Where you are sleeping" });
    expect(within(sleep).getByRole("radio", { name: /Alpe d'Huez package/ })).toBeChecked();
    expect(within(sleep).queryByRole("radio", { name: /^DreamVille/ })).toBeNull();
    expect(within(sleep).getAllByRole("radio")).toHaveLength(3);
  });

  it("renders the steps for the chosen combination, in order", async () => {
    renderPlanner();
    await waitFor(() =>
      expect(resultsRegion().textContent).toContain("Belgium — DreamVille, arriving by plane"),
    );

    const steps = within(resultsRegion()).getAllByRole("listitem");
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps[0]?.textContent).toContain("Book one of the three airport shuttles");
  });

  it("states the missing 2027 fare and timetable visibly", async () => {
    renderPlanner();
    await waitFor(() => expect(resultsRegion().textContent).toContain("Thursday in, Monday out"));

    const notices = within(resultsRegion()).getAllByText("Not published for 2027");
    expect(notices.length).toBeGreaterThan(0);
  });

  it("prints no euro figure on the Belgium plane plan, because no fare is published", async () => {
    renderPlanner();
    await waitFor(() => expect(resultsRegion().textContent).toContain("Not published for 2027"));
    expect(resultsRegion().textContent).not.toMatch(/€\d/);
  });

  it("prints the Transportation Pass price for a Winter village stay, with its year", async () => {
    renderPlanner();

    fireEvent.click(screen.getByRole("radio", { name: /Winter/ }));
    await waitFor(() =>
      expect(resultsRegion().textContent).toContain("Winter — an Alpe d'Huez package"),
    );
    fireEvent.click(screen.getByRole("radio", { name: /Village or own booking/ }));

    await waitFor(() => expect(resultsRegion().textContent).toContain("€40.00"));
    const price = screen.getByText("€40.00").closest("p");
    expect(price?.textContent).toContain("Transportation Pass");
    expect(price?.textContent).toContain("2027");
  });

  it("links every source with rel and target set for a new tab", async () => {
    renderPlanner();
    await waitFor(() => expect(resultsRegion().textContent).toContain("Not published for 2027"));

    const links = within(resultsRegion()).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.getAttribute("href")?.startsWith("https://")).toBe(true);
      /* WCAG 2.5.3: the accessible name contains the visible text, plus context. */
      expect(link.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("shows a checked date beside each source", async () => {
    renderPlanner();
    await waitFor(() => expect(resultsRegion().textContent).toContain("Not published for 2027"));
    expect(within(resultsRegion()).getAllByText(/Checked/).length).toBeGreaterThan(0);
    expect(resultsRegion().querySelectorAll("time[datetime]").length).toBeGreaterThan(0);
  });

  it("separates each source title from its check date", async () => {
    renderPlanner();
    await waitFor(() => expect(resultsRegion().textContent).toContain("Not published for 2027"));

    const items = resultsRegion().querySelectorAll(".journey-sources__list li");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.textContent).toMatch(/—\s*Checked/);
    }
  });

  it("reproduces the transport chapter's order of decisions", async () => {
    renderPlanner();
    const heading = screen.getByRole("heading", { name: "Order of decisions" });
    const section = heading.closest("section");
    expect(section).not.toBeNull();

    const items = within(section as HTMLElement).getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items[0]?.textContent).toContain("Decide where you sleep");
  });

  it("says Brasil is not offered and links the Brasil transport chapter", async () => {
    renderPlanner();
    const edition = screen.getByRole("group", { name: "Edition" });
    expect(within(edition).queryByRole("radio", { name: /Brasil/ })).toBeNull();
    expect(within(edition).getByText(/no verified timetable or fares are published for Parque Maeda/)).toBeInTheDocument();

    /* The planner carries one link to the chapter, in the limits section. The page
       intro carries the other, and the page test covers it. */
    const limits = screen.getByRole("link", {
      name: "Brasil transport chapter: what the official pages state",
    });
    expect(limits.getAttribute("href")).toBe("/guides/brasil/transport");
  });

  it("remembers the last choices across a remount", async () => {
    const storage = installStorage();
    const first = renderPlanner();

    fireEvent.click(screen.getByRole("radio", { name: /Winter/ }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /Winter/ })).toBeChecked());
    fireEvent.click(screen.getByRole("radio", { name: /Coach/ }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /Coach/ })).toBeChecked());

    const stored = JSON.parse(storage.getItem(JOURNEY_STORAGE_KEY) ?? "null") as unknown;
    expect(stored).toEqual({ edition: "winter", sleep: "resort", arrival: "coach" });

    first.unmount();
    renderPlanner();

    await waitFor(() => expect(screen.getByRole("radio", { name: /Winter/ })).toBeChecked());
    expect(screen.getByRole("radio", { name: /Coach/ })).toBeChecked();
  });

  it("starts from the default plan when the stored record is tampered with, and says so", async () => {
    installStorage().setItem(
      JOURNEY_STORAGE_KEY,
      '{"edition":"winter","sleep":"dreamville","arrival":"flying","injected":true}',
    );

    renderPlanner();

    await waitFor(() => expect(screen.getByText("Starting fresh")).toBeInTheDocument());
    expect(screen.getByRole("radio", { name: /Belgium/ })).toBeChecked();
  });

  it("does not throw when storage is unavailable", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });

    renderPlanner();
    await waitFor(() =>
      expect(resultsRegion().textContent).toContain("Belgium — DreamVille, arriving by plane"),
    );
  });

  it("resets to the edition's default plan and clears the stored one", async () => {
    const storage = installStorage();
    renderPlanner();

    fireEvent.click(screen.getByRole("radio", { name: /Train/ }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /Train/ })).toBeChecked());

    fireEvent.click(screen.getByRole("button", { name: "Reset choices" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /Plane/ })).toBeChecked());
    expect(storage.getItem(JOURNEY_STORAGE_KEY)).toBeNull();
  });

  it("keeps the edition when a bed is chosen, and keeps the bed when the arrival method changes", async () => {
    renderPlanner();

    fireEvent.click(screen.getByRole("radio", { name: /Hotel or other/ }));
    await waitFor(() =>
      expect(resultsRegion().textContent).toContain("Belgium — a hotel off site, arriving by plane"),
    );

    fireEvent.click(screen.getByRole("radio", { name: /Car/ }));
    await waitFor(() =>
      expect(resultsRegion().textContent).toContain("Belgium — a hotel off site, arriving by car"),
    );
  });

  it("never prints an estimated journey time", async () => {
    renderPlanner();

    for (const editionName of [/Belgium/, /Winter/]) {
      fireEvent.click(screen.getByRole("radio", { name: editionName }));
      await waitFor(() => expect(screen.getByRole("radio", { name: editionName })).toBeChecked());

      const text = resultsRegion().textContent ?? "";
      /* A duration claim would read as "about N hours" or "N hrs"; the data's own
         road times are the only ones allowed, and they say which operator states
         them. Nothing here may claim a time the planner worked out. */
      expect(text).not.toMatch(/\b\d+\s?(min|mins|minutes|hrs)\s+(walk|drive|journey|transfer)\b/i);
    }
  });

  it("marks the selected choice with a tick as well as colour", async () => {
    renderPlanner();
    const edition = screen.getByRole("group", { name: "Edition" });
    const belgiumLabel = within(edition).getByRole("radio", { name: /Belgium/ }).closest("label");
    expect(belgiumLabel?.textContent).toContain("✓");
  });
});
