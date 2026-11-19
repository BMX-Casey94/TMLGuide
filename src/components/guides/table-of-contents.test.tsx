import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TableOfContents } from "./table-of-contents";

afterEach(cleanup);

/**
 * A controllable stand-in for `IntersectionObserver`.
 *
 * jsdom implements no layout and ships no observer, so the component's effect exits
 * early without one. This double records what was observed and lets a test deliver
 * an entry list, which is the only way to assert the active-section behaviour.
 */
class FakeObserver {
  static instances: FakeObserver[] = [];
  static supported = true;

  readonly observed: Element[] = [];
  readonly callback: IntersectionObserverCallback;
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  emit(entries: Partial<IntersectionObserverEntry>[]): void {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

const ENTRIES = [
  { id: "opening", text: "Opening section", level: 2 as const },
  { id: "detail", text: "A detail", level: 3 as const },
];

function prepareDocument(): void {
  for (const entry of ENTRIES) {
    const heading = document.createElement(entry.level === 2 ? "h2" : "h3");
    heading.id = entry.id;
    document.body.append(heading);
  }
}

beforeEach(() => {
  FakeObserver.instances = [];
  document.body.innerHTML = "";
  prepareDocument();
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("active section highlighting", () => {
  it("observes each heading the chapter contains", () => {
    render(<TableOfContents entries={ENTRIES} chapterTitle="Chapter" />);

    expect(FakeObserver.instances).toHaveLength(1);
    expect(FakeObserver.instances[0]?.observed.map((element) => element.id)).toEqual([
      "opening",
      "detail",
    ]);
  });

  it("marks the first heading current before any intersection is reported", () => {
    render(<TableOfContents entries={ENTRIES} chapterTitle="Chapter" />);

    const links = screen.getAllByRole("link", { name: "Opening section" });
    for (const link of links) expect(link).toHaveAttribute("aria-current", "true");
    for (const link of screen.getAllByRole("link", { name: "A detail" })) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("moves the current marker to the section that entered the reading zone", () => {
    render(<TableOfContents entries={ENTRIES} chapterTitle="Chapter" />);

    const observer = FakeObserver.instances[0];
    expect(observer).toBeDefined();

    act(() => {
      observer?.emit([{ target: document.getElementById("detail") as Element, isIntersecting: true, boundingClientRect: { top: 200 } as DOMRect }]);
    });

    for (const link of screen.getAllByRole("link", { name: "A detail" })) {
      expect(link).toHaveAttribute("aria-current", "true");
    }
    for (const link of screen.getAllByRole("link", { name: "Opening section" })) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("ignores a section that left the zone, so the marker does not jump backwards", () => {
    render(<TableOfContents entries={ENTRIES} chapterTitle="Chapter" />);

    const observer = FakeObserver.instances[0];
    act(() => {
      observer?.emit([
        { target: document.getElementById("detail") as Element, isIntersecting: true, boundingClientRect: { top: 200 } as DOMRect },
      ]);
    });
    act(() => {
      observer?.emit([
        { target: document.getElementById("detail") as Element, isIntersecting: false, boundingClientRect: { top: -400 } as DOMRect },
      ]);
    });

    // Nothing is intersecting, so the last known section stays current rather than
    // clearing to nothing.
    expect(screen.getAllByRole("link", { name: "A detail" })[0]).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("disconnects the observer when it unmounts", () => {
    const view = render(<TableOfContents entries={ENTRIES} chapterTitle="Chapter" />);
    const observer = FakeObserver.instances[0];

    view.unmount();

    expect(observer?.disconnected).toBe(true);
  });

  it("still renders the list when the browser has no observer", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    render(<TableOfContents entries={ENTRIES} chapterTitle="Chapter" />);

    expect(screen.getAllByRole("link", { name: "Opening section" })).toHaveLength(2);
  });
});
