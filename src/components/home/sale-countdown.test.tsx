import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { SaleCountdown, spokenRemaining } from "./sale-countdown";

const NOW = "2027-01-30T15:00:00Z";
const OPENS = "2027-01-30T16:00:00Z";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SaleCountdown", () => {
  it("renders the distance in days, hours, minutes and seconds", () => {
    const { container } = render(<SaleCountdown opensAtIso={OPENS} serverNowIso={NOW} />);

    const values = Array.from(container.querySelectorAll(".home-count__value")).map(
      (element) => element.textContent,
    );
    const labels = Array.from(container.querySelectorAll(".home-count__label")).map(
      (element) => element.textContent,
    );

    expect(values).toEqual(["0", "01", "00", "00"]);
    expect(labels).toEqual(["Days", "Hours", "Minutes", "Seconds"]);
  });

  it("hides the ticking numerals from assistive technology", () => {
    const { container } = render(<SaleCountdown opensAtIso={OPENS} serverNowIso={NOW} />);
    expect(container.querySelector("ol")).toHaveAttribute("aria-hidden", "true");
  });

  it("announces the remaining time in a polite live region", () => {
    render(<SaleCountdown opensAtIso={OPENS} serverNowIso={NOW} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("1 hour and 0 minutes until this sale opens");
  });

  it("says the sale has opened once the moment has passed", () => {
    vi.setSystemTime(new Date("2027-01-30T17:00:00Z"));
    render(<SaleCountdown opensAtIso={OPENS} serverNowIso="2027-01-30T17:00:00Z" />);

    expect(screen.getByText("Sale opened")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("This sale has opened");
  });

  it("treats the opening moment itself as open, not as a second to go", () => {
    vi.setSystemTime(new Date(OPENS));
    render(<SaleCountdown opensAtIso={OPENS} serverNowIso={OPENS} />);
    expect(screen.getByText("Sale opened")).toBeInTheDocument();
  });

  it("ticks down on the browser's clock after mount", () => {
    vi.setSystemTime(new Date("2027-01-30T15:59:59Z"));
    render(<SaleCountdown opensAtIso={OPENS} serverNowIso="2027-01-30T15:59:59Z" />);

    expect(screen.getByRole("status")).toHaveTextContent("less than a minute");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("Sale opened")).toBeInTheDocument();
  });

  it("stops its timer once the sale has opened", () => {
    vi.setSystemTime(new Date("2027-01-30T16:00:30Z"));
    render(<SaleCountdown opensAtIso={OPENS} serverNowIso="2027-01-30T16:00:30Z" />);

    // The first tick already finds the sale open, so no interval is scheduled.
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByText("Sale opened")).toBeInTheDocument();
  });

  it("clears its interval on unmount", () => {
    const { unmount } = render(<SaleCountdown opensAtIso={OPENS} serverNowIso={NOW} />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("renders the server's clock on the server, so hydration cannot disagree", () => {
    // No effects run during a string render, which is exactly the server's
    // situation: the output must come from `serverNowIso`, not from the clock.
    vi.setSystemTime(new Date("2027-01-30T15:59:00Z"));
    const html = renderToString(<SaleCountdown opensAtIso={OPENS} serverNowIso={NOW} />);

    // An hour from the server's now, not the minute the clock would give.
    expect(html).toContain("1 hour and 0 minutes");
    expect(html).toContain("until this sale opens");
    expect(html).toContain(">01<"); // one hour left
  });
});

describe("spokenRemaining", () => {
  it("names days, hours and minutes when days remain", () => {
    expect(spokenRemaining({ days: 2, hours: 3, minutes: 14 })).toBe("2 days, 3 hours, 14 minutes");
  });

  it("drops the day when none remain", () => {
    expect(spokenRemaining({ days: 0, hours: 3, minutes: 14 })).toBe("3 hours and 14 minutes");
  });

  it("drops the hour when none remain", () => {
    expect(spokenRemaining({ days: 0, hours: 0, minutes: 14 })).toBe("14 minutes");
  });

  it("says less than a minute at the end, rather than zero minutes", () => {
    expect(spokenRemaining({ days: 0, hours: 0, minutes: 0 })).toBe("less than a minute");
  });

  it("uses singular units for a single day, hour and minute", () => {
    expect(spokenRemaining({ days: 1, hours: 1, minutes: 1 })).toBe("1 day, 1 hour, 1 minute");
  });

  it("never mentions seconds, so the sentence changes only once a minute", () => {
    expect(spokenRemaining({ days: 0, hours: 1, minutes: 2 })).not.toContain("second");
  });
});
