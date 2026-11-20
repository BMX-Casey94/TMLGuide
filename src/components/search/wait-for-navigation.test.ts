import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NAVIGATION_POLL_MS,
  NAVIGATION_TIMEOUT_MS,
  hasArrived,
  navigationTarget,
  normalizeSearch,
  waitForNavigation,
} from "./wait-for-navigation";

/**
 * The palette decides to close on "arrived", so this module is the definition of
 * arrived. The interesting cases are the two failures it must not produce: never
 * resolving (the palette would sit open for ever) and resolving on the wrong page
 * (the palette would close while the reader was still somewhere else).
 */

const at = (pathname: string, search = "") => ({ pathname, search });

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = "";
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = "";
});

describe("navigationTarget", () => {
  it("splits a plain route", () => {
    expect(navigationTarget("/community")).toEqual({
      pathname: "/community",
      search: "",
      anchor: null,
    });
  });

  it("splits a route with an anchor", () => {
    expect(navigationTarget("/community#partner-x")).toEqual({
      pathname: "/community",
      search: "",
      anchor: "partner-x",
    });
  });

  it("splits a query and an anchor", () => {
    expect(navigationTarget("/guides/tickets?edition=winter#ticket-x")).toEqual({
      pathname: "/guides/tickets",
      search: "?edition=winter",
      anchor: "ticket-x",
    });
  });

  it("returns null for anything that is not an internal href", () => {
    expect(navigationTarget("https://evil.example/")).toBeNull();
    expect(navigationTarget("//evil.example/")).toBeNull();
    expect(navigationTarget("javascript:alert(1)")).toBeNull();
    expect(navigationTarget("#anchor")).toBeNull();
  });
});

describe("normalizeSearch", () => {
  it("gives every empty form the same value", () => {
    expect(normalizeSearch("")).toBe("");
    expect(normalizeSearch("?")).toBe("");
  });

  it("keeps a real query, with its question mark", () => {
    expect(normalizeSearch("edition=winter")).toBe("?edition=winter");
    expect(normalizeSearch("?edition=winter")).toBe("?edition=winter");
  });
});

describe("hasArrived", () => {
  it("is false while the address has not moved", () => {
    expect(
      hasArrived(navigationTarget("/community")!, at("/"), {
        ...at("/"),
        document,
      }),
    ).toBe(false);
  });

  it("is true once the path matches", () => {
    expect(
      hasArrived(navigationTarget("/community")!, at("/"), {
        ...at("/community"),
        document,
      }),
    ).toBe(true);
  });

  it("does not accept a redirect to a different path", () => {
    expect(
      hasArrived(navigationTarget("/community")!, at("/"), {
        ...at("/radio"),
        document,
      }),
    ).toBe(false);
  });

  it("requires the query to match as well as the path", () => {
    const target = navigationTarget("/guides/tickets?edition=winter")!;
    expect(hasArrived(target, at("/guides/tickets"), { ...at("/guides/tickets"), document })).toBe(
      false,
    );
    expect(
      hasArrived(target, at("/guides/tickets"), {
        pathname: "/guides/tickets",
        search: "?edition=winter",
        document,
      }),
    ).toBe(true);
  });

  it("treats a query-less arrival as done even when the link names an anchor", () => {
    // The whole point: the page has opened. Whether the record's id exists yet
    // is `scrollToHash`'s problem, and it retries on its own.
    const target = navigationTarget("/guides#faq-be-x")!;
    expect(hasArrived(target, at("/"), { ...at("/guides"), document })).toBe(true);
  });

  it("waits for a hash-only link until the element exists", () => {
    const target = navigationTarget("/guides#faq-be-x")!;
    const here = at("/guides");
    expect(hasArrived(target, here, { ...here, document })).toBe(false);

    const element = document.createElement("div");
    element.id = "faq-be-x";
    document.body.appendChild(element);
    expect(hasArrived(target, here, { ...here, document })).toBe(true);
  });

  it("treats a hash-only link with no anchor as already arrived", () => {
    const target = navigationTarget("/guides#faq-be-x")!;
    const here = at("/guides");
    // Nothing to wait for and nothing to scroll to.
    expect(hasArrived({ ...target, anchor: null }, here, { ...here, document })).toBe(true);
  });
});

describe("waitForNavigation", () => {
  it("resolves immediately when the address has already moved", async () => {
    window.history.replaceState(null, "", "/community");
    const arrived = await waitForNavigation("/community", { from: at("/") });
    expect(arrived).toBe(true);
  });

  it("resolves once the router moves the address", async () => {
    const promise = waitForNavigation("/community", {
      from: at("/"),
      timeoutMs: 500,
      pollMs: 10,
    });
    setTimeout(() => window.history.pushState(null, "", "/community"), 30);
    expect(await promise).toBe(true);
  });

  it("resolves false after the timeout, without throwing", async () => {
    const arrived = await waitForNavigation("/community", {
      from: at("/"),
      timeoutMs: 60,
      pollMs: 10,
    });
    expect(arrived).toBe(false);
  });

  it("resolves false for an href it cannot parse", async () => {
    expect(await waitForNavigation("javascript:alert(1)", { from: at("/") })).toBe(false);
    expect(await waitForNavigation("https://evil.example/", { from: at("/") })).toBe(false);
  });

  it("resolves once a same-page anchor element appears", async () => {
    window.history.replaceState(null, "", "/guides");
    const promise = waitForNavigation("/guides#faq-be-x", {
      from: at("/guides"),
      timeoutMs: 500,
      pollMs: 10,
    });
    setTimeout(() => {
      const element = document.createElement("div");
      element.id = "faq-be-x";
      document.body.appendChild(element);
    }, 30);
    expect(await promise).toBe(true);
  });

  it("uses an eight-second budget by default, which is what the message promises", () => {
    expect(NAVIGATION_TIMEOUT_MS).toBe(8000);
    expect(NAVIGATION_POLL_MS).toBeLessThanOrEqual(100);
  });
});
