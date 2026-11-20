import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANCHOR_POLL_MS,
  ANCHOR_TIMEOUT_MS,
  SCROLL_SETTLE_MS,
  focusTarget,
  hashId,
  prefersReducedMotion,
  scrollClearOfHeader,
  scrollOffset,
  scrollToHash,
} from "./scroll-to-hash";

/**
 * jsdom has no layout, so `scrollIntoView` does not exist on its elements. These
 * tests install a spy on it: the assertion is about what the helper *asks* the
 * browser to do (where, and with which motion), which is the part that can be
 * wrong.
 */
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
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
    // jsdom reports every rect as 0, so `top < offset` holds and the correction
    // runs. The spy replaces the method jsdom leaves unimplemented.
    const scrollBy = vi.fn();
    Object.defineProperty(window, "scrollBy", { configurable: true, writable: true, value: scrollBy });
    const target = addTarget("section-c");

    scrollClearOfHeader(target, { reducedMotion: false });
    expect(scrollBy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SCROLL_SETTLE_MS + 1);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));

    vi.useRealTimers();
  });

  it("never throws when there is no viewport to correct against", () => {
    const target = addTarget("section-d");
    expect(() => scrollClearOfHeader(target, { reducedMotion: true })).not.toThrow();
  });
});
