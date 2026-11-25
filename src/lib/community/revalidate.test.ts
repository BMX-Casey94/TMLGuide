// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/*
  `revalidateTag` throws outside a request scope, which is exactly the situation a
  unit test is in. That makes this the one place the wrapper's failure path can be
  exercised for real, which is worth doing: the whole point of the wrapper is that
  a caller never has to handle that throw.
*/

const revalidateTagMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

const { revalidateCommunityNews } = await import("./revalidate");

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("revalidateCommunityNews", () => {
  it("invalidates the news tag with the recommended stale-while-revalidate profile", () => {
    revalidateTagMock.mockImplementation(() => undefined);

    expect(revalidateCommunityNews()).toBe(true);
    // `"max"` is the documented profile: the next request is served stale content
    // while a fresh one is built behind it, so an editor never waits on a rebuild.
    expect(revalidateTagMock).toHaveBeenCalledWith("community-news", "max");
  });

  it("returns false and warns instead of throwing when there is no request scope", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // This is what `revalidateTag` really does outside a route handler.
    revalidateTagMock.mockImplementation(() => {
      throw new Error("Invariant: static generation store missing in revalidateTag");
    });

    expect(revalidateCommunityNews()).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    // The warning names the tag, so an operator seeing a stale page can find it.
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain("community-news");
  });

  it("never propagates an exception to its caller", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    revalidateTagMock.mockImplementation(() => {
      throw new TypeError("unexpected");
    });

    expect(() => revalidateCommunityNews()).not.toThrow();
  });
});
