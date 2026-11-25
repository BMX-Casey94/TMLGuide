/**
 * Tests for the consent-gated analytics scaffold.
 *
 * The property that matters is inertness: before an explicit opt-in there must
 * be no request, no cookie and no stored identifier. Most of this file is
 * therefore about proving a negative, which is why every case asserts the
 * absence of a network call rather than merely trusting the effect's early
 * return.
 */

// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMemoryStorage } from "@/components/shell/test-storage";
import {
  ANALYTICS_CONSENT_DENIED,
  ANALYTICS_CONSENT_GRANTED,
  ANALYTICS_CONSENT_KEY,
  ConsentAnalytics,
  getAnalyticsConsent,
  isAnalyticsConfigured,
  resolveAnalyticsEndpoint,
  revokeAnalyticsConsent,
  setAnalyticsConsent,
  toSafePath,
} from "./consent-analytics";

const ENDPOINT = "https://analytics.example.com/collect";

let fetchSpy: ReturnType<typeof vi.fn>;

/*
  The test environment installs an inert `localStorage` stub over jsdom's own, so
  a real in-memory Storage is installed per test. Without it every assertion
  about persistence and every guard against a throwing store would be testing the
  stub rather than the component.
*/
beforeEach(() => {
  installMemoryStorage();
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", ENDPOINT);
  fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  // Vitest's globals are off in this project, so Testing Library cannot register
  // its automatic cleanup. Without this, a component mounted in one test keeps
  // its effects alive and its fetches appear in the next test's spy.
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  installMemoryStorage();
  vi.restoreAllMocks();
});

/** Renders the component and returns a promise that settles after effects run. */
async function renderAnalytics() {
  const result = render(<ConsentAnalytics />);
  // An empty macrotask lets every effect that was going to fire do so.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return result;
}

describe("storage key", () => {
  it("is the documented, versioned key", () => {
    expect(ANALYTICS_CONSENT_KEY).toBe("tml-analytics-consent-v1");
  });

  it("uses explicit granted and denied values", () => {
    expect(ANALYTICS_CONSENT_GRANTED).toBe("granted");
    expect(ANALYTICS_CONSENT_DENIED).toBe("denied");
  });
});

describe("consent reading and writing", () => {
  it("defaults to unset with no stored value", () => {
    expect(getAnalyticsConsent()).toBe("unset");
  });

  it("stores a grant and reads it back", () => {
    expect(setAnalyticsConsent(true)).toBe(true);
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("granted");
    expect(getAnalyticsConsent()).toBe("granted");
  });

  it("stores a refusal and reads it back", () => {
    expect(setAnalyticsConsent(false)).toBe(true);
    expect(getAnalyticsConsent()).toBe("denied");
  });

  it("treats an unrecognised stored value as unset, never as consent", () => {
    for (const value of ["true", "1", "yes", "GRANTED", "{granted}", ""]) {
      window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
      expect(getAnalyticsConsent()).toBe("unset");
    }
  });

  it("revokes a grant and remembers the refusal", () => {
    setAnalyticsConsent(true);
    expect(revokeAnalyticsConsent()).toBe(true);
    expect(getAnalyticsConsent()).toBe("denied");
    // A refusal is remembered so the visitor is not asked again as though they
    // had never answered.
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("denied");
  });

  it("reports failure rather than pretending when storage throws", () => {
    // The installed store is a plain object, not a `Storage` instance, so the
    // spy has to sit on the object itself rather than on `Storage.prototype`.
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(setAnalyticsConsent(true)).toBe(false);
  });

  it("reads as unset when storage access throws", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(getAnalyticsConsent()).toBe("unset");
  });

  it("reports failure when no storage exists at all", () => {
    Object.defineProperty(window, "localStorage", { configurable: true, value: undefined });
    expect(setAnalyticsConsent(true)).toBe(false);
    expect(getAnalyticsConsent()).toBe("unset");
  });
});

describe("inertness before consent", () => {
  it("renders nothing", async () => {
    const { container } = await renderAnalytics();
    expect(container.innerHTML).toBe("");
  });

  it("makes no network request", async () => {
    await renderAnalytics();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sets no cookie", async () => {
    await renderAnalytics();
    expect(document.cookie).toBe("");
  });

  it("writes nothing to storage", async () => {
    await renderAnalytics();
    expect(window.localStorage.length).toBe(0);
  });

  it("makes no request when consent was explicitly refused", async () => {
    setAnalyticsConsent(false);
    await renderAnalytics();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("makes no request when the stored value is garbage", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "maybe");
    await renderAnalytics();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("makes no request when no endpoint is configured, even with consent", async () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "");
    setAnalyticsConsent(true);
    await renderAnalytics();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("makes no request when the endpoint is insecure, even with consent", async () => {
    // Sending a page path over plain HTTP would leak it to the network.
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "http://analytics.example.com/collect");
    setAnalyticsConsent(true);
    await renderAnalytics();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("makes no request when the endpoint is malformed", async () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "not a url");
    setAnalyticsConsent(true);
    await renderAnalytics();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("after consent", () => {
  it("sends exactly one page view", async () => {
    setAnalyticsConsent(true);
    await renderAnalytics();

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");

    const payload = JSON.parse(String(init.body)) as { type: string; path: string; title: string };
    expect(payload.type).toBe("page_view");
    expect(payload.path).toBe("/");
    expect(typeof payload.title).toBe("string");
  });

  it("sends no credentials and no referrer", async () => {
    setAnalyticsConsent(true);
    await renderAnalytics();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(init.cache).toBe("no-store");
  });

  it("does not send a query string, which can carry personal data", async () => {
    setAnalyticsConsent(true);
    window.history.replaceState({}, "", "/guides/tickets?email=someone@example.com&token=secret");
    await renderAnalytics();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { path: string };
    expect(payload.path).toBe("/guides/tickets");
    expect(String(init.body)).not.toContain("someone@example.com");
    expect(String(init.body)).not.toContain("secret");

    window.history.replaceState({}, "", "/");
  });

  it("sends only when consent arrives after mount", async () => {
    await renderAnalytics();
    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => {
      setAnalyticsConsent(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  });

  it("stops sending after consent is revoked", async () => {
    setAnalyticsConsent(true);
    await renderAnalytics();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    await act(async () => {
      revokeAnalyticsConsent();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("counts one view per path, even under StrictMode double effects", async () => {
    setAnalyticsConsent(true);
    render(
      <StrictMode>
        <ConsentAnalytics />
      </StrictMode>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("uses a path override instead of the location", async () => {
    setAnalyticsConsent(true);
    render(<ConsentAnalytics path="/custom/path" title="Custom" />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      type: "page_view",
      path: "/custom/path",
      title: "Custom",
    });
  });

  it("accepts an endpoint prop over the environment variable", async () => {
    setAnalyticsConsent(true);
    render(<ConsentAnalytics endpoint="https://other.example.com/track" />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url] = fetchSpy.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://other.example.com/track");
  });

  it("swallows a failing endpoint without surfacing an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    setAnalyticsConsent(true);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await renderAnalytics();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Nothing rendered, nothing logged to the visitor's console.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("resolveAnalyticsEndpoint", () => {
  it("returns null for an absent or blank value", () => {
    expect(resolveAnalyticsEndpoint(undefined)).toBeNull();
    expect(resolveAnalyticsEndpoint(null)).toBeNull();
    expect(resolveAnalyticsEndpoint("")).toBeNull();
    expect(resolveAnalyticsEndpoint("   ")).toBeNull();
  });

  it("accepts an https endpoint and drops the query string", () => {
    expect(resolveAnalyticsEndpoint("https://a.example.com/collect?token=abc")).toBe(
      "https://a.example.com/collect",
    );
  });

  it("accepts a localhost http endpoint for development", () => {
    expect(resolveAnalyticsEndpoint("http://localhost:4000/collect")).toBe(
      "http://localhost:4000/collect",
    );
  });

  it("rejects plain http on a public host", () => {
    expect(resolveAnalyticsEndpoint("http://a.example.com/collect")).toBeNull();
  });

  it("rejects a non-web scheme", () => {
    expect(resolveAnalyticsEndpoint("javascript:alert(1)")).toBeNull();
  });

  it("reports configuration correctly", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", ENDPOINT);
    expect(isAnalyticsConfigured()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENDPOINT", "");
    expect(isAnalyticsConfigured()).toBe(false);
  });
});

describe("toSafePath", () => {
  it("keeps the path and drops the query and fragment", () => {
    expect(toSafePath("https://tmlguide.com/guides/tickets?email=a@b.com#top")).toBe(
      "/guides/tickets",
    );
  });

  it("handles a relative path", () => {
    expect(toSafePath("/about?x=1")).toBe("/about");
  });

  it("returns a root path for something unparseable", () => {
    expect(toSafePath("")).toBe("/");
  });

  it("never returns the origin or a credential", () => {
    expect(toSafePath("https://user:pass@example.com/a")).toBe("/a");
  });
});
