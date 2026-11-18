import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadTextFile } from "./download";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Stubs the Blob URL API, which jsdom does not implement. */
function stubBlobUrls() {
  const blobs: Blob[] = [];
  const createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return "blob:test-url";
  });
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  return { createObjectURL, revokeObjectURL, blobs };
}

describe("downloadTextFile", () => {
  it("creates a Blob URL and clicks an anchor carrying the filename", () => {
    const { createObjectURL, blobs } = stubBlobUrls();
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this);
    });

    expect(downloadTextFile("sales.ics", "BEGIN:VCALENDAR")).toBe(true);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(blobs[0].type).toBe("text/calendar;charset=utf-8");

    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe("sales.ics");
    expect(clicks[0].href).toContain("blob:test-url");
  });

  it("leaves no anchor behind in the page", () => {
    stubBlobUrls();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadTextFile("sales.ics", "BEGIN:VCALENDAR");

    expect(document.querySelectorAll("a[download]")).toHaveLength(0);
  });

  it("revokes the object URL so a series of exports cannot leak", async () => {
    const { revokeObjectURL } = stubBlobUrls();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadTextFile("one.ics", "x");

    // Revocation is deferred by a turn, so it cannot cancel the download.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("returns false rather than throwing when a Blob URL cannot be made", () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: () => {
        throw new Error("unsupported");
      },
    });

    expect(downloadTextFile("sales.ics", "x")).toBe(false);
  });

  it("accepts a caller-supplied MIME type", () => {
    const { blobs } = stubBlobUrls();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadTextFile("notes.txt", "text", "text/plain;charset=utf-8");
    expect(blobs[0].type).toBe("text/plain;charset=utf-8");
  });
});
