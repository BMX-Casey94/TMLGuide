import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SaleTimeline } from "./sale-timeline";
import { SaleTimelineTabs } from "./sale-timeline-tabs";
import type { SaleRecord } from "./timeline-logic";

const records: readonly SaleRecord[] = [
  {
    id: "worldwide-ticket-sale",
    name: "WorldWide Ticket Sale",
    audience: "Everyone who pre-registered",
    notes: "General sale of tickets and DreamVille packages.",
    opensAt: "2027-02-13T17:00:00+01:00",
    source: { url: "https://example.test/sale" },
    lastVerified: "2026-11-18",
  },
  {
    id: "worldwide-pre-sale",
    name: "WorldWide Pre-Sale",
    audience: "Pre-registered accounts",
    opensAt: "2027-02-06T17:00:00+01:00",
    source: { url: "https://example.test/presale" },
    lastVerified: "2026-11-18",
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T15:45:00Z"));
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A stub Blob URL API, since jsdom does not implement it. */
function stubDownloads() {
  const createObjectURL = vi.fn(() => "blob:stub");
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  return { createObjectURL, revokeObjectURL };
}

describe("SaleTimeline", () => {
  it("lists every sale with its audience, in chronological order", async () => {
    render(<SaleTimeline records={records} edition="belgium" editionLabel="Belgium" />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "WorldWide Pre-Sale",
      "WorldWide Ticket Sale",
    ]);
    expect(screen.getByText("Pre-registered accounts")).toBeInTheDocument();
  });

  it("shows the next sale as upcoming and starts a countdown to it", async () => {
    render(<SaleTimeline records={records} edition="belgium" editionLabel="Belgium" />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Both sales are ahead, so both are labelled upcoming.
    expect(screen.getAllByText("Upcoming")).toHaveLength(2);
    // The countdown targets the soonest sale, the pre-sale on 6 February.
    expect(screen.getByText(/Next sale opens in/i)).toBeInTheDocument();
    expect(screen.getByText(/WorldWide Pre-Sale — Pre-registered accounts/i)).toBeInTheDocument();
  });

  it("shows a sale's time in both the visitor's zone and Brussels", async () => {
    render(<SaleTimeline records={records} edition="belgium" editionLabel="Belgium" />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // The reader's zone is resolved on mount; Brussels is always shown.
    expect(screen.getAllByText("Brussels").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sat 06 Feb 2027, 17:00 CET/).length).toBeGreaterThan(0);
  });

  it("marks a sale that opened within the last day as open now", async () => {
    const opened: readonly SaleRecord[] = [
      {
        ...records[0],
        opensAt: new Date(Date.now() - 3_600_000).toISOString(),
      },
    ];
    render(<SaleTimeline records={opened} edition="belgium" editionLabel="Belgium" />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByText("Open now")).toBeInTheDocument();
  });

  it("says plainly when no further sales are announced", async () => {
    const past: readonly SaleRecord[] = [
      { ...records[0], opensAt: "2026-02-13T17:00:00+01:00" },
    ];
    render(<SaleTimeline records={past} edition="belgium" editionLabel="Belgium" />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByRole("heading", { level: 2, name: /No further sales announced/i })).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("handles an edition with no sale dates at all", async () => {
    render(<SaleTimeline records={[]} edition="winter" editionLabel="Winter" />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByText(/No sale dates for Winter have been published yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download all Winter sales/i })).toBeDisabled();
  });

  it("downloads a single sale's calendar file and confirms it", async () => {
    const { createObjectURL } = stubDownloads();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<SaleTimeline records={records} edition="belgium" editionLabel="Belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const buttons = screen.getAllByRole("button", { name: /Add .* to your calendar/i });
    await act(async () => {
      fireEvent.click(buttons[0]);
    });

    // Assertions are synchronous: under fake timers `waitFor` would never settle.
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Calendar file for WorldWide Pre-Sale downloaded/i)).toBeInTheDocument();
  });

  it("downloads every sale as one calendar", async () => {
    const { createObjectURL } = stubDownloads();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<SaleTimeline records={records} edition="belgium" editionLabel="Belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Download all Belgium sales/i }));
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/Calendar file with all 2 Belgium sales downloaded/i),
    ).toBeInTheDocument();
  });

  it("reports a failed download rather than claiming success", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: () => {
        throw new Error("blocked");
      },
    });

    render(<SaleTimeline records={records} edition="belgium" editionLabel="Belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Download all Belgium sales/i }));
    });

    expect(screen.getByText(/could not start a download/i)).toBeInTheDocument();
  });

  it("links each sale to its official page in a new tab, safely", async () => {
    render(<SaleTimeline records={records} edition="belgium" editionLabel="Belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const links = screen.getAllByRole("link", { name: "Official page" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("says the Exchange Desk is the only official resale route", async () => {
    render(<SaleTimeline records={records} edition="belgium" editionLabel="Belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const note = screen.getByText(/Exchange Desk is the only official resale route/i);
    expect(note).toBeInTheDocument();
    expect(note.textContent).not.toMatch(/ticketswap/i);
  });

  it("explains the two reminders in the calendar file", async () => {
    render(<SaleTimeline records={records} edition="belgium" editionLabel="Belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByText(/30 minutes before the sale opens, and 1 day/i)).toBeInTheDocument();
  });

  it("warns when the reader's zone and Brussels fall on different days", async () => {
    // A late-evening instant in Brussels is still the previous day far west.
    const lateNight: readonly SaleRecord[] = [{ ...records[0], opensAt: "2027-03-27T23:30:00Z" }];
    const resolved = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({
        locale: "en-GB",
        timeZone: "America/Los_Angeles",
      } as Intl.ResolvedDateTimeFormatOptions);

    render(<SaleTimeline records={lateNight} edition="belgium" editionLabel="Belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByText(/different calendar days for this sale/i)).toBeInTheDocument();
    resolved.mockRestore();
  });
});

describe("SaleTimelineTabs", () => {
  const editions = [
    { edition: "belgium" as const, label: "Belgium", records },
    { edition: "winter" as const, label: "Winter", records: [] },
    {
      edition: "brasil" as const,
      label: "Brasil",
      records: [
        {
          id: "brasil-sale",
          name: "Brasil WorldWide Sale",
          audience: "General sale",
          opensAt: "2027-02-20T10:00:00-03:00",
          source: { url: "https://example.test/brasil" },
          lastVerified: "2026-11-18",
        },
      ],
    },
  ];

  it("exposes a named tablist with one selected tab", async () => {
    render(<SaleTimelineTabs editions={editions} initialEdition="belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const tablist = screen.getByRole("tablist", { name: "Edition" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs.filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: /Belgium/ })).toHaveAttribute("aria-selected", "true");
    expect(tablist).toBeInTheDocument();
  });

  it("gives the group a single tab stop", async () => {
    render(<SaleTimelineTabs editions={editions} initialEdition="belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const tabbable = screen.getAllByRole("tab").filter((tab) => tab.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
  });

  it("switches the panel when another tab is chosen", async () => {
    render(<SaleTimelineTabs editions={editions} initialEdition="belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    fireEvent.click(screen.getByRole("tab", { name: /Brasil/ }));

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByRole("tab", { name: /Brasil/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Brasil WorldWide Sale")).toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys and wraps at both ends", async () => {
    render(<SaleTimelineTabs editions={editions} initialEdition="belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const belgium = screen.getByRole("tab", { name: /Belgium/ });
    fireEvent.keyDown(belgium, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Winter/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: /Winter/ }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /Belgium/ })).toHaveAttribute("aria-selected", "true");

    // Wrapping backwards from the first tab lands on the last.
    fireEvent.keyDown(screen.getByRole("tab", { name: /Belgium/ }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /Brasil/ })).toHaveAttribute("aria-selected", "true");
  });

  it("supports Home and End", async () => {
    render(<SaleTimelineTabs editions={editions} initialEdition="winter" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    fireEvent.keyDown(screen.getByRole("tab", { name: /Winter/ }), { key: "End" });
    expect(screen.getByRole("tab", { name: /Brasil/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: /Brasil/ }), { key: "Home" });
    expect(screen.getByRole("tab", { name: /Belgium/ })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps each panel associated with its tab", async () => {
    render(<SaleTimelineTabs editions={editions} initialEdition="belgium" />);
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const panel = screen.getByRole("tabpanel");
    const tab = screen.getByRole("tab", { name: /Belgium/ });
    expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
    expect(tab.getAttribute("aria-controls")).toBe(panel.id);
  });
});
