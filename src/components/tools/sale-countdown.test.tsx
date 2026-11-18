import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

import { SaleCountdown } from "./sale-countdown";

const OPENS_AT = "2027-01-30T16:00:00Z";
const SALE_NAME = "WorldWide Ticket Sale";

/** Puts the fake clock at a chosen instant. */
function setClock(iso: string): void {
  vi.setSystemTime(new Date(iso));
}

/** Advance the fake clock by whole seconds, flushing effects between ticks. */
function advanceSeconds(seconds: number): void {
  for (let index = 0; index < seconds; index += 1) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T15:45:00Z"));
  // jsdom reports the document as visible by default; make that explicit.
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SaleCountdown", () => {
  it("shows the distance to the opening as days, hours, minutes and seconds", () => {
    setClock("2026-11-18T15:45:00Z");
    render(<SaleCountdown opensAtIso={OPENS_AT} saleName={SALE_NAME} />);

    // 73 days and 15 minutes to 30 January 2027 at 16:00Z.
    const digits = document.querySelector(".countdown__digits") as HTMLElement;
    expect(digits.textContent).toContain("73");
    expect(digits.textContent).toContain("15");
    // The day, hour, minute and second values each carry their own name.
    for (const name of ["days", "hours", "minutes", "seconds"]) {
      expect(digits.textContent).toContain(name);
    }
  });

  it("counts down by the second", () => {
    setClock("2027-01-30T15:59:50Z");
    render(<SaleCountdown opensAtIso={OPENS_AT} saleName={SALE_NAME} />);

    const seconds = () =>
      (document.querySelector(".countdown__digits") as HTMLElement).textContent ?? "";

    expect(seconds()).toContain("10");

    advanceSeconds(1);
    expect(seconds()).toContain("09");

    advanceSeconds(4);
    expect(seconds()).toContain("05");
  });

  it("marks the digits as decorative so sixty updates a minute are not spoken", () => {
    setClock("2027-01-30T15:59:50Z");
    render(<SaleCountdown opensAtIso={OPENS_AT} saleName={SALE_NAME} />);

    expect(document.querySelector(".countdown__digits")).toHaveAttribute("aria-hidden", "true");
  });

  it("puts the announcement in a polite status region", () => {
    setClock("2027-01-30T15:59:50Z");
    render(<SaleCountdown opensAtIso={OPENS_AT} saleName={SALE_NAME} />);

    const region = document.querySelector('[role="status"]');
    expect(region).toBeTruthy();
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("announces once a minute, not once a second", () => {
    setClock("2027-01-30T15:57:30Z");
    render(<SaleCountdown opensAtIso={OPENS_AT} saleName={SALE_NAME} />);

    const region = document.querySelector('[role="status"]') as HTMLElement;
    // The first render sets no sentence: the reader has just arrived, and the
    // visible digits already say the time remaining.
    expect(region.textContent).toBe("");

    // 15 seconds in, still inside the same minute: nothing announced.
    advanceSeconds(15);
    expect(region.textContent).toBe("");

    // Crossing the next whole minute before the opening produces one sentence.
    advanceSeconds(20);
    expect(region.textContent).toMatch(/until WorldWide Ticket Sale\.$/);

    const afterBoundary = region.textContent;
    // A further 30 seconds does not cross another boundary.
    advanceSeconds(30);
    expect(region.textContent).toBe(afterBoundary);
  });

  it("announces the opening itself once, and stops counting", () => {
    setClock("2027-01-30T15:59:58Z");
    render(<SaleCountdown opensAtIso={OPENS_AT} saleName={SALE_NAME} />);

    advanceSeconds(3);

    expect(screen.getByText("This sale has opened.")).toBeInTheDocument();
    const region = document.querySelector('[role="status"]') as HTMLElement;
    expect(region.textContent).toBe(`${SALE_NAME} has opened.`);

    // Further time passes without another announcement or a resumed count.
    advanceSeconds(30);
    expect(region.textContent).toBe(`${SALE_NAME} has opened.`);
  });

  it("does not tick while the tab is hidden, and shows the right figure when it returns", () => {
    setClock("2027-01-30T15:59:50Z");
    render(<SaleCountdown opensAtIso={OPENS_AT} saleName={SALE_NAME} />);

    const digits = () => document.querySelector(".countdown__digits") as HTMLElement;
    expect(digits().textContent).toContain("10");

    // Hide the tab, then let a minute pass on the wall clock.
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
      vi.setSystemTime(new Date("2027-01-30T16:00:50Z"));
    });

    // Still showing the figure from before the tab was hidden.
    expect(digits().textContent).toContain("10");

    // On return the countdown reads the clock again rather than replaying
    // sixty ticks, so it lands on the correct state immediately.
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByText("This sale has opened.")).toBeInTheDocument();
  });

  it("resumes counting when the tab becomes visible again before the opening", () => {
    setClock("2027-01-30T15:59:50Z");
    render(<SaleCountdown opensAtIso={OPENS_AT} saleName={SALE_NAME} />);

    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => {
      // Only the wall clock moves; no timers run while the tab is hidden.
      vi.setSystemTime(new Date("2027-01-30T15:59:55Z"));
    });
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Five seconds remain, so the first visible frame is already correct.
    const digits = document.querySelector(".countdown__digits") as HTMLElement;
    expect(digits.textContent).toContain("05");
  });

  it("exposes the exact opening instant in a machine-readable element", () => {
    setClock("2027-01-30T15:59:50Z");
    render(<SaleCountdown opensAtIso={OPENS_AT} saleName={SALE_NAME} />);

    const time = document.querySelector("time");
    expect(time).toHaveAttribute("datetime", OPENS_AT);
  });

  it("clears its timer on unmount so nothing keeps running", () => {
    setClock("2027-01-30T15:59:50Z");
    const { unmount } = render(<SaleCountdown opensAtIso={OPENS_AT} saleName={SALE_NAME} />);
    unmount();

    // No timer is left behind: advancing the clock runs nothing.
    expect(() => {
      vi.advanceTimersByTime(10_000);
    }).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
