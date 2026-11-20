import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  getNavigationState,
  resetNavigationStore,
  settleNavigation,
  startNavigation,
  subscribeToNavigation,
  withNavigation,
} from "./navigation-store";

/**
 * The store is the one thing both the page-level bar and the palette agree on, so
 * these tests are about the contract: a start is visible, a settle clears it, a
 * second start still notifies, and a listener that unsubscribes stops hearing.
 */

beforeEach(() => {
  resetNavigationStore();
});

afterEach(() => {
  cleanup();
  resetNavigationStore();
});

describe("navigation store", () => {
  it("starts idle", () => {
    expect(getNavigationState().href).toBeNull();
  });

  it("reports a started navigation", () => {
    startNavigation("/community");
    expect(getNavigationState().href).toBe("/community");
  });

  it("clears on settle", () => {
    startNavigation("/community");
    settleNavigation();
    expect(getNavigationState().href).toBeNull();
  });

  it("notifies a subscriber on start and on settle", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToNavigation(listener);

    startNavigation("/a");
    settleNavigation();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    startNavigation("/b");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("notifies a second navigation to the same href", () => {
    const listener = vi.fn();
    subscribeToNavigation(listener);

    startNavigation("/community");
    settleNavigation();
    startNavigation("/community");
    // Two starts and one settle: three notifications, despite the href repeating.
    expect(listener).toHaveBeenCalledTimes(3);
    expect(getNavigationState().seq).toBeGreaterThanOrEqual(3);
  });

  it("does not notify on a settle when nothing is in flight", () => {
    const listener = vi.fn();
    subscribeToNavigation(listener);
    settleNavigation();
    expect(listener).not.toHaveBeenCalled();
  });

  it("clears the store when navigate throws", () => {
    expect(() =>
      withNavigation("/community", () => {
        throw new Error("router refused");
      }),
    ).toThrow("router refused");
    expect(getNavigationState().href).toBeNull();
  });

  it("returns what navigate returned", () => {
    const result = withNavigation("/community", () => "pushed");
    expect(result).toBe("pushed");
    expect(getNavigationState().href).toBe("/community");
  });
});

describe("Spinner", () => {
  it("renders a decorative sparkle when given no label", async () => {
    const { Spinner } = await import("./spinner");
    const { container } = render(<Spinner />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    // Decorative: no live region, nothing for a screen reader to read twice.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("announces its label politely when it has one", async () => {
    const { Spinner } = await import("./spinner");
    render(<Spinner label="Loading page" />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Loading page");
    // The visible art stays out of the tree; the text carries the meaning.
    expect(status.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("exposes a size for each of the two uses", async () => {
    const { Spinner } = await import("./spinner");
    const { container, rerender } = render(<Spinner size="inline" />);
    expect(container.querySelector(".tml-spinner--inline")).toBeTruthy();

    rerender(<Spinner size="page" />);
    expect(container.querySelector(".tml-spinner--page")).toBeTruthy();
  });

  it("defaults to the inline size", async () => {
    const { Spinner } = await import("./spinner");
    const { container } = render(<Spinner />);
    expect(container.querySelector(".tml-spinner--inline")).toBeTruthy();
  });

  it("draws the same sparkle geometry as GoldDivider", async () => {
    const { SPARKLE_PATH } = await import("./sparkle");
    const { Spinner } = await import("./spinner");
    const { container } = render(<Spinner />);
    expect(container.querySelector("path")?.getAttribute("d")).toBe(SPARKLE_PATH);
    // A four-point star: four curve segments and nothing else.
    expect((SPARKLE_PATH.match(/C/g) ?? []).length).toBe(4);
  });
});

describe("PageLoading", () => {
  it("centres a labelled spinner and a visually hidden status", async () => {
    const { PageLoading } = await import("./page-loading");
    const { container } = render(<PageLoading />);

    expect(container.querySelector(".tml-page-loading")).toBeTruthy();
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Loading page");

    // The visible word is decoration on top of the announced status: one
    // announcement, not two.
    const visible = container.querySelector(".tml-page-loading__text");
    expect(visible?.getAttribute("aria-hidden")).toBe("true");
  });
});
