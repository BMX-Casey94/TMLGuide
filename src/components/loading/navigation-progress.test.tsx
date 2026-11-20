import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

/**
 * `NavigationProgress` reads `usePathname` and `useSearchParams`, so it only
 * mounts inside a router. The hooks are mocked here with controllable values:
 * that is the whole point of the component's inputs, and it lets the timing
 * behaviour be driven with fake timers instead of real waits.
 */
const router = { pathname: "/", search: "" };

vi.mock("next/navigation", () => ({
  usePathname: () => router.pathname,
  useSearchParams: () => new URLSearchParams(router.search),
}));

const { NavigationProgress, PROGRESS_DELAY_MS, PROGRESS_MAX_MS, shouldTrackClick } = await import(
  "./navigation-progress"
);
const { getNavigationState, resetNavigationStore, settleNavigation, startNavigation } = await import(
  "./navigation-store"
);

function anchor(attributes: Record<string, string> = {}): HTMLAnchorElement {
  const element = document.createElement("a");
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.appendChild(element);
  return element;
}

function clickOn(element: Element, overrides: Partial<MouseEvent> = {}): MouseEvent {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...overrides,
  });
  element.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  router.pathname = "/";
  router.search = "";
  window.history.replaceState(null, "", "/");
  resetNavigationStore();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
  resetNavigationStore();
});

describe("shouldTrackClick", () => {
  function mouse(overrides: Partial<MouseEvent> = {}): MouseEvent {
    return {
      button: 0,
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      ...overrides,
    } as MouseEvent;
  }

  it("tracks a plain same-origin link", () => {
    expect(shouldTrackClick(anchor({ href: "/community" }), mouse())).toBe(true);
  });

  it("tracks a link that changes only the query", () => {
    window.history.replaceState(null, "", "/guides/tickets");
    expect(
      shouldTrackClick(anchor({ href: "/guides/tickets?edition=winter" }), mouse()),
    ).toBe(true);
  });

  it.each([
    ["a middle click", { button: 1 }],
    ["a right click", { button: 2 }],
    ["a meta click", { metaKey: true }],
    ["a ctrl click", { ctrlKey: true }],
    ["a shift click", { shiftKey: true }],
    ["an alt click", { altKey: true }],
    ["an already-handled click", { defaultPrevented: true }],
  ])("ignores %s", (_label, overrides) => {
    expect(shouldTrackClick(anchor({ href: "/community" }), mouse(overrides))).toBe(false);
  });

  it.each([
    ["a new tab", { target: "_blank" }],
    ["a named frame", { target: "player" }],
    ["a download", { download: "" }],
    ["an external link", { rel: "external" }],
  ])("ignores %s", (_label, attributes) => {
    expect(shouldTrackClick(anchor({ href: "/community", ...attributes }), mouse())).toBe(false);
  });

  it("tracks a link that explicitly targets the same frame", () => {
    expect(shouldTrackClick(anchor({ href: "/community", target: "_self" }), mouse())).toBe(true);
  });

  it("ignores an off-site link, a protocol-relative link, mailto and tel", () => {
    expect(shouldTrackClick(anchor({ href: "https://www.tomorrowland.com/" }), mouse())).toBe(false);
    expect(shouldTrackClick(anchor({ href: "//evil.example/community" }), mouse())).toBe(false);
    expect(shouldTrackClick(anchor({ href: "mailto:hi@example.com" }), mouse())).toBe(false);
    expect(shouldTrackClick(anchor({ href: "tel:+441234" }), mouse())).toBe(false);
  });

  it("ignores a hash-only link on the current page", () => {
    window.history.replaceState(null, "", "/guides");
    expect(shouldTrackClick(anchor({ href: "/guides#faq-be-x" }), mouse())).toBe(false);
  });

  it("ignores a hash-only link when the query matches too", () => {
    window.history.replaceState(null, "", "/guides/tickets?edition=winter");
    expect(
      shouldTrackClick(anchor({ href: "/guides/tickets?edition=winter#ticket-x" }), mouse()),
    ).toBe(false);
  });

  it("tracks the same path with a different query, even with a fragment", () => {
    window.history.replaceState(null, "", "/guides/tickets");
    expect(
      shouldTrackClick(anchor({ href: "/guides/tickets?edition=winter#ticket-x" }), mouse()),
    ).toBe(true);
  });

  it("tracks a query removal on the same path", () => {
    window.history.replaceState(null, "", "/guides/tickets?edition=winter");
    expect(shouldTrackClick(anchor({ href: "/guides/tickets" }), mouse())).toBe(true);
  });
});

describe("NavigationProgress", () => {
  it("renders nothing while idle", () => {
    const { container } = render(<NavigationProgress />);
    expect(container.querySelector(".tml-progress")).toBeNull();
  });

  it("does not show a bar for a navigation that finishes quickly", () => {
    vi.useFakeTimers();
    const { container } = render(<NavigationProgress />);

    act(() => startNavigation("/community"));
    act(() => {
      vi.advanceTimersByTime(PROGRESS_DELAY_MS - 10);
    });
    // Settled before the delay elapsed: no flash of a bar.
    act(() => settleNavigation());
    act(() => {
      vi.advanceTimersByTime(PROGRESS_DELAY_MS + 50);
    });

    expect(container.querySelector(".tml-progress")).toBeNull();
  });

  it("shows the bar once a navigation outlasts the delay", () => {
    vi.useFakeTimers();
    const { container } = render(<NavigationProgress />);

    act(() => startNavigation("/community"));
    act(() => {
      vi.advanceTimersByTime(PROGRESS_DELAY_MS + 1);
    });

    const bar = container.querySelector(".tml-progress");
    expect(bar).toBeTruthy();
    expect(bar?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".tml-progress__bar")).toBeTruthy();
  });

  it("hides the bar when the route changes", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<NavigationProgress />);

    act(() => startNavigation("/community"));
    act(() => {
      vi.advanceTimersByTime(PROGRESS_DELAY_MS + 1);
    });
    expect(container.querySelector(".tml-progress")).toBeTruthy();

    router.pathname = "/community";
    rerender(<NavigationProgress />);

    expect(container.querySelector(".tml-progress")).toBeNull();
    expect(getNavigationState().href).toBeNull();
  });

  it("clears itself at the hard timeout so it cannot run for ever", () => {
    vi.useFakeTimers();
    const { container } = render(<NavigationProgress />);

    act(() => startNavigation("/slow"));
    act(() => {
      vi.advanceTimersByTime(PROGRESS_MAX_MS + 1);
    });

    expect(container.querySelector(".tml-progress")).toBeNull();
    expect(getNavigationState().href).toBeNull();
  });

  it("starts a navigation from a same-origin link click", () => {
    render(<NavigationProgress />);
    const link = anchor({ href: "/community" });
    // jsdom has no router; this stops it trying to load a real document. The
    // store is read before the next task, which is when a cancellation is seen.
    link.addEventListener("click", (event) => event.preventDefault());

    act(() => {
      clickOn(link);
    });

    expect(getNavigationState().href).toContain("/community");
  });

  it("ignores a hash-only link click", () => {
    window.history.replaceState(null, "", "/guides");
    render(<NavigationProgress />);
    const link = anchor({ href: "/guides#faq-be-x" });
    link.addEventListener("click", (event) => event.preventDefault());

    act(() => {
      clickOn(link);
    });

    expect(getNavigationState().href).toBeNull();
  });

  it("ignores a modified click", () => {
    render(<NavigationProgress />);
    const link = anchor({ href: "/community" });
    link.addEventListener("click", (event) => event.preventDefault());

    act(() => {
      clickOn(link, { metaKey: true });
    });

    expect(getNavigationState().href).toBeNull();
  });

  it("ignores a click on something that is not a link", () => {
    render(<NavigationProgress />);
    const button = document.createElement("button");
    document.body.appendChild(button);

    act(() => {
      clickOn(button);
    });

    expect(getNavigationState().href).toBeNull();
  });

  it("clears when a link's own handler cancels the navigation", async () => {
    render(<NavigationProgress />);
    const link = anchor({ href: "/community" });
    link.addEventListener("click", (event) => event.preventDefault());

    act(() => {
      clickOn(link);
    });
    // The bar starts in capture; the cancellation is noticed on the next task.
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getNavigationState().href).toBeNull();
  });
});

describe("Progress timing constants", () => {
  it("waits 150ms before showing, as the brief specifies", () => {
    expect(PROGRESS_DELAY_MS).toBe(150);
  });

  it("has a hard stop that is long enough for a slow page but not unbounded", () => {
    expect(PROGRESS_MAX_MS).toBeGreaterThan(5000);
    expect(PROGRESS_MAX_MS).toBeLessThanOrEqual(20_000);
  });
});
