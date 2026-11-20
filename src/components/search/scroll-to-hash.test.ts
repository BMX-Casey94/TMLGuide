import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import {
  ANCHOR_POLL_MS,
  ANCHOR_TIMEOUT_MS,
  SCROLL_SETTLE_MS,
  WAKE_RETRY_MS,
  focusTarget,
  hashId,
  prefersReducedMotion,
  scrollClearOfHeader,
  scrollOffset,
  scrollToHash,
  wakeHashListeners,
} from "./scroll-to-hash";

/**
 * jsdom has no layout, so `scrollIntoView` does not exist on its elements. These
 * tests install a spy on it: the assertion is about what the helper *asks* the
 * browser to do (where, and with which motion), which is the part that can be
 * wrong.
 */
let scrollIntoView: ReturnType<typeof vi.fn>;
/** The engine's own `scrollTo`, put back after each case that stubs it. */
let originalScrollTo: typeof window.scrollTo;
let originalScrollBy: typeof window.scrollBy;

beforeEach(() => {
  originalScrollTo = window.scrollTo;
  originalScrollBy = window.scrollBy;
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView as unknown as Element["scrollIntoView"];
  // jsdom leaves `scrollBy` unimplemented and logs an error when it is called;
  // the header correction calls it, so it is stubbed here rather than left to
  // produce noise that looks like a failure.
  Object.defineProperty(window, "scrollBy", { configurable: true, writable: true, value: () => {} });
  document.documentElement.removeAttribute("data-a11y-motion");
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  // A stub installed with `defineProperty` survives `restoreAllMocks`, so the
  // engine's own methods are put back explicitly; otherwise a later case in this
  // file would inherit an assertion spy.
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    writable: true,
    value: originalScrollTo,
  });
  Object.defineProperty(window, "scrollBy", {
    configurable: true,
    writable: true,
    value: originalScrollBy,
  });
  document.documentElement.removeAttribute("data-a11y-motion");
});

function addTarget(id: string, tag = "div"): HTMLElement {
  const element = document.createElement(tag);
  element.id = id;
  document.body.appendChild(element);
  return element;
}

describe("hashId", () => {
  it("strips one leading hash", () => {
    expect(hashId("#faq-be-lockers")).toBe("faq-be-lockers");
    expect(hashId("faq-be-lockers")).toBe("faq-be-lockers");
  });

  it("decodes a percent-encoded id", () => {
    expect(hashId("#faq%2Dbe")).toBe("faq-be");
  });

  it("refuses an empty hash and a malformed escape", () => {
    expect(hashId("#")).toBeNull();
    expect(hashId("")).toBeNull();
    expect(hashId("#%")).toBeNull();
    expect(hashId("#%zz")).toBeNull();
  });

  it("refuses an absurdly long id", () => {
    expect(hashId(`#${"a".repeat(201)}`)).toBeNull();
    expect(hashId(`#${"a".repeat(200)}`)).toBe("a".repeat(200));
  });

  it("returns null for a non-string", () => {
    expect(hashId(undefined as unknown as string)).toBeNull();
  });
});

describe("prefersReducedMotion", () => {
  it("is false by default in this environment", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    expect(prefersReducedMotion()).toBe(false);
  });

  it("follows the media query", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    expect(prefersReducedMotion()).toBe(true);
  });

  it("lets the site toggle win over a system that asks for motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    document.documentElement.dataset.a11yMotion = "reduce";
    expect(prefersReducedMotion()).toBe(true);
  });

  it("does not throw when matchMedia is missing or refuses", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);

    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => {
        throw new Error("blocked");
      }),
    );
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("focusTarget", () => {
  it("makes a non-focusable element focusable and focuses it", () => {
    const target = addTarget("section-a", "section");
    focusTarget(target);
    expect(target.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(target);
  });

  it("does not add a tabindex to something already focusable", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    focusTarget(button);
    expect(button.hasAttribute("tabindex")).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it("treats a link with no href as not focusable", () => {
    const anchor = document.createElement("a");
    document.body.appendChild(anchor);
    focusTarget(anchor);
    expect(anchor.getAttribute("tabindex")).toBe("-1");
  });

  it("never throws on a detached element", () => {
    const orphan = document.createElement("div");
    expect(() => focusTarget(orphan)).not.toThrow();
  });
});

describe("scrollToHash", () => {
  it("scrolls to an element that is already on the page", async () => {
    const target = addTarget("faq-be-lockers");
    const reached = await scrollToHash("#faq-be-lockers", { reducedMotion: true });

    expect(reached).toBe(target);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("uses a smooth scroll when motion is allowed", async () => {
    addTarget("faq-be-lockers");
    await scrollToHash("#faq-be-lockers", { reducedMotion: false });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("focuses the element it scrolled to", async () => {
    const target = addTarget("resource-a", "article");
    await scrollToHash("#resource-a", { reducedMotion: true });
    expect(document.activeElement).toBe(target);
    expect(target.getAttribute("tabindex")).toBe("-1");
  });

  it("waits for a target that renders after navigation", async () => {
    const promise = scrollToHash("#late", { reducedMotion: true, timeoutMs: 500, pollMs: 10 });
    setTimeout(() => addTarget("late"), 40);

    const reached = await promise;
    expect(reached).not.toBeNull();
    expect(reached?.id).toBe("late");
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("resolves null when the target never appears, without throwing", async () => {
    const reached = await scrollToHash("#never", { reducedMotion: true, timeoutMs: 60, pollMs: 10 });
    expect(reached).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("resolves null immediately for an unusable hash", async () => {
    expect(await scrollToHash("#", { reducedMotion: true })).toBeNull();
    expect(await scrollToHash("#%", { reducedMotion: true })).toBeNull();
  });

  it("reads the reduced-motion setting when no override is given", async () => {
    document.documentElement.dataset.a11yMotion = "reduce";
    addTarget("faq-a");
    await scrollToHash("#faq-a");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("does not throw when the engine rejects the options object", async () => {
    addTarget("faq-b");
    scrollIntoView.mockImplementation(() => {
      throw new TypeError("no options here");
    });
    const reached = await scrollToHash("#faq-b", { reducedMotion: true });
    expect(reached?.id).toBe("faq-b");
  });

  it("keeps its own timeout and poll constants sane", () => {
    // The brief asks for a retry of about a second; the poll must be short
    // enough that a fast page does not look like a slow one.
    expect(ANCHOR_TIMEOUT_MS).toBe(1000);
    expect(ANCHOR_POLL_MS).toBeLessThanOrEqual(100);
  });
});

/**
 * A tabbed page keeps every panel mounted and hides the inactive ones with the
 * `hidden` attribute. The record is therefore in the DOM from the first paint,
 * but nothing can be scrolled to or focused inside it: landing on it before the
 * tab switch would focus an invisible element and end the wait.
 */
describe("scrollToHash inside a hidden panel", () => {
  function addHiddenPanelWithTarget(id: string): { panel: HTMLElement; target: HTMLElement } {
    const panel = document.createElement("section");
    panel.setAttribute("hidden", "");
    const target = document.createElement("article");
    target.id = id;
    panel.appendChild(target);
    document.body.appendChild(panel);
    return { panel, target };
  }

  it("waits for the panel to be shown, then lands on the record", async () => {
    const { panel, target } = addHiddenPanelWithTarget("partner-dca-travel");

    const promise = scrollToHash("#partner-dca-travel", {
      reducedMotion: true,
      timeoutMs: 500,
      pollMs: 10,
    });
    // The tab switch happens a render after the hash arrives.
    setTimeout(() => panel.removeAttribute("hidden"), 40);

    const reached = await promise;
    expect(reached).toBe(target);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(document.activeElement).toBe(target);
  });

  it("resolves null when the panel never becomes visible, without scrolling", async () => {
    addHiddenPanelWithTarget("partner-never-shown");

    const reached = await scrollToHash("#partner-never-shown", {
      reducedMotion: true,
      timeoutMs: 60,
      pollMs: 10,
    });

    expect(reached).toBeNull();
    // Focusing an invisible record would have been worse than arriving nowhere.
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("does not treat a hidden ancestor as an unreachable target forever", async () => {
    // A record nested two levels down is still found once both wrappers show.
    const outer = document.createElement("div");
    outer.setAttribute("hidden", "");
    const inner = document.createElement("div");
    inner.setAttribute("hidden", "");
    const target = document.createElement("div");
    target.id = "wa-nested";
    inner.appendChild(target);
    outer.appendChild(inner);
    document.body.appendChild(outer);

    const promise = scrollToHash("#wa-nested", {
      reducedMotion: true,
      timeoutMs: 500,
      pollMs: 10,
    });
    setTimeout(() => {
      outer.removeAttribute("hidden");
      inner.removeAttribute("hidden");
    }, 30);

    expect(await promise).toBe(target);
  });
});

/**
 * Every FAQ answer on `/guides` is a `<details>`, and a link to a collapsed one
 * landed on a summary the reader had to open themselves — the record was on
 * screen but its answer was not.
 */
describe("scrollToHash and closed details", () => {
  function addDetails(id: string): HTMLDetailsElement {
    const details = document.createElement("details");
    details.id = id;
    const summary = document.createElement("summary");
    summary.textContent = "Are there lockers?";
    const answer = document.createElement("p");
    answer.textContent = "Yes, and they are best pre-booked.";
    details.append(summary, answer);
    document.body.appendChild(details);
    return details;
  }

  it("opens a closed details element it is asked to land on", async () => {
    const details = addDetails("faq-be-lockers");
    expect(details.open).toBe(false);

    const reached = await scrollToHash("#faq-be-lockers", { reducedMotion: true });
    expect(reached).toBe(details);
    expect(details.open).toBe(true);
  });

  it("opens a closed details ancestor, so a heading inside an answer is visible", async () => {
    const details = addDetails("faq-be-ancestor");
    const heading = document.createElement("h3");
    heading.id = "faq-be-ancestor-heading";
    details.appendChild(heading);

    const reached = await scrollToHash("#faq-be-ancestor-heading", { reducedMotion: true });
    expect(reached).toBe(heading);
    expect(details.open).toBe(true);
  });

  it("opens details after expanding, but before scrolling, so the height is real", async () => {
    const details = addDetails("faq-be-order");
    let openAtScroll: boolean | null = null;
    scrollIntoView.mockImplementation(() => {
      openAtScroll = details.open;
    });

    await scrollToHash("#faq-be-order", { reducedMotion: true });
    expect(openAtScroll).toBe(true);
  });

  it("leaves an already open details element open", async () => {
    const details = addDetails("faq-be-already-open");
    details.open = true;

    await scrollToHash("#faq-be-already-open", { reducedMotion: true });
    expect(details.open).toBe(true);
  });
});

/**
 * The App Router pushes with `history.pushState`, which fires no `hashchange`,
 * so a page whose selected tab lives in the URL never hears about a same-page
 * search result. One event, dispatched against a hash that really is the
 * anchor's, is what wakes it.
 */
describe("wakeHashListeners", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("dispatches hashchange when the address names the anchor", () => {
    window.history.replaceState(null, "", "/community#partner-dca-travel");
    const listener = vi.fn();
    window.addEventListener("hashchange", listener);

    wakeHashListeners("#partner-dca-travel");
    window.removeEventListener("hashchange", listener);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the address still names something else", () => {
    // A listener woken on the previous hash would read the wrong tab. A single
    // check is enough here: the caller's own poll is what covers a late write.
    window.history.replaceState(null, "", "/community#partners");
    const listener = vi.fn();
    window.addEventListener("hashchange", listener);

    wakeHashListeners("#partner-dca-travel", { timeoutMs: 0 });
    window.removeEventListener("hashchange", listener);

    expect(listener).not.toHaveBeenCalled();
  });

  it("waits a moment for a router that writes the hash after the push returns", async () => {
    window.history.replaceState(null, "", "/community");
    const listener = vi.fn();
    window.addEventListener("hashchange", listener);

    wakeHashListeners("#partner-dca-travel", { timeoutMs: 500 });
    // The router settles a frame later.
    setTimeout(() => window.history.replaceState(null, "", "/community#partner-dca-travel"), 40);

    await waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener("hashchange", listener);
  });

  it("stays quiet for a hash that names nothing", () => {
    window.history.replaceState(null, "", "/community");
    const listener = vi.fn();
    window.addEventListener("hashchange", listener);

    wakeHashListeners("#", { timeoutMs: 0 });
    window.removeEventListener("hashchange", listener);

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops watching when the caller cancels", async () => {
    // An abandoned navigation — Escape, or a second result — must not leave a
    // timer running towards an event nobody wants.
    window.history.replaceState(null, "", "/community");
    const listener = vi.fn();
    window.addEventListener("hashchange", listener);

    const cancel = wakeHashListeners("#partner-dca-travel", { timeoutMs: 400 });
    cancel();
    window.history.replaceState(null, "", "/community#partner-dca-travel");

    await new Promise((resolve) => setTimeout(resolve, 120));
    window.removeEventListener("hashchange", listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it("is safe to cancel twice, and after it has already dispatched", () => {
    window.history.replaceState(null, "", "/community#partner-dca-travel");
    const listener = vi.fn();
    window.addEventListener("hashchange", listener);

    const cancel = wakeHashListeners("#partner-dca-travel", { timeoutMs: 0 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(() => {
      cancel();
      cancel();
    }).not.toThrow();

    window.removeEventListener("hashchange", listener);
  });

  it("is dispatched by scrollToHash itself, so a caller cannot forget it", async () => {
    window.history.replaceState(null, "", "/community#partner-dca-travel");
    addTarget("partner-dca-travel");
    const listener = vi.fn();
    window.addEventListener("hashchange", listener);

    await scrollToHash("#partner-dca-travel", { reducedMotion: true });
    window.removeEventListener("hashchange", listener);

    expect(listener).toHaveBeenCalled();
  });

  it("wakes again while the record stays hidden, in case the tab mounted late", async () => {
    window.history.replaceState(null, "", "/tools/sale-timeline#sale-belgium-worldwide");
    const panel = document.createElement("section");
    panel.setAttribute("hidden", "");
    const target = document.createElement("li");
    target.id = "sale-belgium-worldwide";
    panel.appendChild(target);
    document.body.appendChild(panel);

    const listener = vi.fn();
    window.addEventListener("hashchange", listener);
    const promise = scrollToHash("#sale-belgium-worldwide", {
      reducedMotion: true,
      timeoutMs: 1500,
      pollMs: 10,
    });
    setTimeout(() => panel.removeAttribute("hidden"), WAKE_RETRY_MS + 60);

    expect(await promise).toBe(target);
    window.removeEventListener("hashchange", listener);
    expect(listener.mock.calls.length).toBeGreaterThan(1);
  }, 10_000);
});

describe("scrollOffset", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--header-h");
    document.querySelector("header")?.remove();
  });

  it("reads --header-h from the document and adds clearance", () => {
    document.documentElement.style.setProperty("--header-h", "76px");
    expect(scrollOffset(document)).toBe(92);
  });

  it("measures the sticky header when the variable is absent", () => {
    // jsdom reports 0 for every rect, so the fallback is what is observable
    // here; the measurement path is covered by the browser e2e run.
    expect(scrollOffset(document)).toBe(92);
  });
});

describe("scrollClearOfHeader", () => {
  it("scrolls the element to the start of its scrolling box", () => {
    const target = addTarget("section-a");
    scrollClearOfHeader(target, { reducedMotion: false });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("scrolls instantly when motion is reduced", () => {
    const target = addTarget("section-b");
    scrollClearOfHeader(target, { reducedMotion: true });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("corrects the header offset after a smooth scroll has settled", () => {
    vi.useFakeTimers();
    // jsdom reports every rect as 0, so the element is treated as unlaid-out and
    // the correction is clamped to the top of the document. The spy replaces the
    // method jsdom leaves unimplemented.
    const scrollBy = vi.fn();
    Object.defineProperty(window, "scrollBy", { configurable: true, writable: true, value: scrollBy });
    const target = addTarget("section-c");

    scrollClearOfHeader(target, { reducedMotion: false });
    expect(scrollBy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SCROLL_SETTLE_MS + 1);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));

    vi.useRealTimers();
  });

  it("does not correct against a layout it does not have", () => {
    // jsdom reports a zero-height rect, which means nothing was laid out: a
    // document position computed from it would be a guess, so only the
    // relative form is used.
    const scrollTo = vi.fn();
    const scrollBy = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: scrollTo });
    Object.defineProperty(window, "scrollBy", { configurable: true, writable: true, value: scrollBy });
    const target = addTarget("section-no-layout");

    scrollClearOfHeader(target, { reducedMotion: true });

    expect(scrollTo).not.toHaveBeenCalled();
    // Clamped at the top of the document rather than a negative position.
    expect(scrollBy).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  it("uses the absolute position when there is a layout to measure", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: scrollTo });
    const target = addTarget("section-laid-out");
    // A real rect: 400px down the document, tall enough to be laid out.
    target.getBoundingClientRect = () =>
      ({ top: 400, height: 320, bottom: 720, left: 0, right: 0, width: 0, x: 0, y: 400 }) as
        DOMRect;

    scrollClearOfHeader(target, { reducedMotion: true });

    // 400 down the document, minus the 92px header clearance.
    expect(scrollTo).toHaveBeenCalledWith({ top: 308, behavior: "auto" });
  });

  it("uses the absolute position for an element already at the top of the document", () => {
    // A zero height with a zero top is what jsdom reports, but a laid-out
    // element sitting at the very top of the page is a real position, not a
    // missing one: it still has a width.
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: scrollTo });
    const target = addTarget("section-at-top");
    target.getBoundingClientRect = () =>
      ({ top: 0, height: 0, bottom: 0, left: 0, right: 640, width: 640, x: 0, y: 0 }) as DOMRect;

    scrollClearOfHeader(target, { reducedMotion: true });
    // Clamped at the top, expressed absolutely rather than as a delta.
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  it("never scrolls above the top of the document", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: scrollTo });
    const target = addTarget("section-near-top");
    target.getBoundingClientRect = () =>
      ({ top: 20, height: 300, bottom: 320, left: 0, right: 0, width: 0, x: 0, y: 20 }) as DOMRect;

    scrollClearOfHeader(target, { reducedMotion: true });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  it("never throws when there is no viewport to correct against", () => {
    const target = addTarget("section-d");
    expect(() => scrollClearOfHeader(target, { reducedMotion: true })).not.toThrow();
  });
});
