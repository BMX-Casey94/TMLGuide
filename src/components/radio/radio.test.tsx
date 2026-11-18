import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, act, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { RadioProvider, RADIO_VOLUME_STORAGE_KEY } from "./radio-context";
import { RadioPlayer } from "./radio-player";
import { RadioPanel } from "./radio-page-panel";
import { RADIO_CREDIT, RADIO_STREAM_URL } from "./stream";

/*
  This jsdom environment ships a method-less localStorage stub (Node's web storage flag),
  so the tests install a real in-memory Storage to exercise parsing and persistence.
*/
function installStorage(): void {
  const items = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return items.size;
      },
      clear() {
        items.clear();
      },
      getItem(key: string) {
        return items.get(key) ?? null;
      },
      key(index: number) {
        return Array.from(items.keys())[index] ?? null;
      },
      removeItem(key: string) {
        items.delete(key);
      },
      setItem(key: string, value: string) {
        items.set(key, String(value));
      },
    },
  });
}

function renderPlayer(children: ReactNode = <RadioPlayer />) {
  return render(<RadioProvider>{children}</RadioProvider>);
}

/** The provider creates its element lazily and appends it to <body>. */
function currentAudio(): HTMLAudioElement {
  const audio = document.querySelector("audio");
  if (!audio) throw new Error("Expected an audio element to exist");
  return audio;
}

/** The player renders both layouts, so a control can appear more than once. */
function firstButton(name: string): HTMLElement {
  return screen.getAllByRole("button", { name })[0];
}

/** The provider's single polite live region. */
function announced(): string {
  return screen.getByRole("status").textContent ?? "";
}

describe("radio", () => {
  beforeEach(() => {
    installStorage();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    document.querySelectorAll("audio").forEach((node) => node.remove());
  });

  it("touches no media element and no source before the first tap", () => {
    renderPlayer();

    expect(document.querySelector("audio")).toBeNull();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
    expect(announced()).toBe("Tap to listen");
  });

  it("creates the element on the first toggle with the exact stream URL", () => {
    renderPlayer();
    fireEvent.click(firstButton("Play One World Radio"));

    const audio = currentAudio();
    expect(audio.getAttribute("src")).toBe(RADIO_STREAM_URL);
    expect(audio.preload).toBe("none");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(announced()).toBe("Connecting…");
  });

  it("moves from loading to playing on the playing event", () => {
    renderPlayer();
    fireEvent.click(firstButton("Play One World Radio"));
    expect(announced()).toBe("Connecting…");

    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });

    expect(announced()).toBe("Live now");
    expect(screen.getAllByRole("button", { name: "Pause One World Radio" })).toHaveLength(2);
    // The desktop pill prints the design's LIVE label.
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("returns to loading when the stream stalls or waits", () => {
    renderPlayer();
    fireEvent.click(firstButton("Play One World Radio"));
    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });
    act(() => {
      currentAudio().dispatchEvent(new Event("stalled"));
    });
    expect(announced()).toBe("Connecting…");

    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });
    act(() => {
      currentAudio().dispatchEvent(new Event("waiting"));
    });
    expect(announced()).toBe("Connecting…");
  });

  it("shows an error when play() rejects, then recovers through retry", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() =>
      Promise.reject(new DOMException("Blocked by policy", "NotAllowedError")),
    );

    renderPlayer();
    await act(async () => {
      fireEvent.click(firstButton("Play One World Radio"));
    });

    expect(announced()).toBe("Stream unavailable. Tap to retry.");
    expect(screen.getAllByText("Stream unavailable. Tap to retry.").length).toBeGreaterThan(0);

    const retry = firstButton("Retry One World Radio");
    expect(retry).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(retry);
    });

    const audio = currentAudio();
    expect(audio.getAttribute("src")).toBe(RADIO_STREAM_URL);
    // The redirect URL never takes a cache-busting query: retry reloads the same source.
    expect(audio.getAttribute("src")).not.toContain("?");
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
    expect(announced()).toBe("Connecting…");

    act(() => {
      audio.dispatchEvent(new Event("playing"));
    });
    expect(announced()).toBe("Live now");
  });

  it("shows an error on the media error event", () => {
    renderPlayer();
    fireEvent.click(firstButton("Play One World Radio"));
    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });
    act(() => {
      currentAudio().dispatchEvent(new Event("error"));
    });

    expect(announced()).toBe("Stream unavailable. Tap to retry.");
    expect(firstButton("Retry One World Radio")).toBeInTheDocument();
  });

  it("releases the stream on pause and rebuilds it on the next play", () => {
    renderPlayer();
    fireEvent.click(firstButton("Play One World Radio"));
    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });

    const audio = currentAudio();
    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    vi.mocked(HTMLMediaElement.prototype.load).mockClear();

    fireEvent.click(firstButton("Pause One World Radio"));

    expect(audio.hasAttribute("src")).toBe(false);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
    expect(announced()).toBe("Paused");

    fireEvent.click(firstButton("Play One World Radio"));
    expect(currentAudio().getAttribute("src")).toBe(RADIO_STREAM_URL);
    expect(currentAudio()).toBe(audio);
  });

  it("persists volume and ignores invalid stored values", () => {
    window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, "0.6");
    const view = renderPlayer();

    const slider = screen.getAllByRole("slider", { name: "Radio volume" })[0];
    expect(slider).toHaveValue("60");

    fireEvent.change(slider, { target: { value: "35" } });

    expect(window.localStorage.getItem(RADIO_VOLUME_STORAGE_KEY)).toBe("0.35");
    expect(screen.getAllByRole("slider", { name: "Radio volume" })[0]).toHaveValue("35");

    for (const stored of ["not-a-number", "4.2", "-1", "", "NaN"]) {
      view.unmount();
      window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, stored);
      renderPlayer();
      expect(screen.getAllByRole("slider", { name: "Radio volume" })[0]).toHaveValue("25");
      cleanup();
    }
  });

  it("keeps a valid stored volume of zero", () => {
    window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, "0");
    renderPlayer();

    expect(screen.getAllByRole("slider", { name: "Radio volume" })[0]).toHaveValue("0");
  });

  it("applies the stored volume when the element is created", () => {
    window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, "0.45");
    renderPlayer();

    fireEvent.click(firstButton("Play One World Radio"));

    expect(currentAudio().volume).toBeCloseTo(0.45);
  });

  it("changes the live volume when the slider moves", () => {
    renderPlayer();
    fireEvent.click(firstButton("Play One World Radio"));

    const slider = screen.getAllByRole("slider", { name: "Radio volume" })[0];
    fireEvent.change(slider, { target: { value: "80" } });

    expect(currentAudio().volume).toBeCloseTo(0.8);
  });

  it("toggles mute with a name that reflects the state", () => {
    renderPlayer();
    fireEvent.click(firstButton("Play One World Radio"));

    fireEvent.click(firstButton("Mute One World Radio"));
    expect(screen.getAllByRole("button", { name: "Unmute One World Radio" })).toHaveLength(2);
    expect(currentAudio().muted).toBe(true);

    fireEvent.click(firstButton("Unmute One World Radio"));
    expect(screen.getAllByRole("button", { name: "Mute One World Radio" })).toHaveLength(2);
    expect(currentAudio().muted).toBe(false);
  });

  it("remembers mute across the first play and never fetches on a mute tap", () => {
    renderPlayer();

    fireEvent.click(firstButton("Mute One World Radio"));
    // Muting alone must not start the stream or create an element.
    expect(document.querySelector("audio")).toBeNull();

    fireEvent.click(firstButton("Play One World Radio"));

    expect(currentAudio().muted).toBe(true);
  });

  it("announces every state once through a polite region", () => {
    renderPlayer();
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Tap to listen");

    fireEvent.click(firstButton("Play One World Radio"));
    expect(region).toHaveTextContent("Connecting…");

    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });
    expect(region).toHaveTextContent("Live now");

    fireEvent.click(firstButton("Pause One World Radio"));
    expect(region).toHaveTextContent("Paused");

    // Exactly one live region, so a change is never announced twice.
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("keeps the docked status line hidden until the listener engages", () => {
    renderPlayer();
    const dock = screen.getByRole("region", { name: "One World Radio mini-player" });

    // Collapsed: the mini-player shows only the button and the station name.
    expect(within(dock).queryByText("Tap to listen")).toBeNull();
    expect(within(dock).getByText("One World Radio")).toBeInTheDocument();
    expect(within(dock).queryByRole("slider")).toBeNull();

    fireEvent.click(within(dock).getByRole("button", { name: "Play One World Radio" }));

    expect(within(dock).getByText("Connecting…")).toBeInTheDocument();
  });

  it("removes the element and its listeners on unmount", () => {
    const view = renderPlayer();
    fireEvent.click(firstButton("Play One World Radio"));
    const audio = currentAudio();

    view.unmount();

    expect(document.querySelector("audio")).toBeNull();
    expect(() => audio.dispatchEvent(new Event("playing"))).not.toThrow();
  });

  it("registers Media Session metadata and handlers", () => {
    const setActionHandler = vi.fn();
    const mediaSession = {
      metadata: null as MediaMetadata | null,
      playbackState: "none" as MediaSessionPlaybackState,
      setActionHandler,
    };

    class FakeMetadata {
      title?: string;
      artist?: string;
      constructor(init: MediaMetadataInit = {}) {
        this.title = init.title;
        this.artist = init.artist;
      }
    }

    vi.stubGlobal("MediaMetadata", FakeMetadata);
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: mediaSession,
    });

    try {
      renderPlayer();

      expect(setActionHandler).toHaveBeenCalledWith("play", expect.any(Function));
      expect(setActionHandler).toHaveBeenCalledWith("pause", expect.any(Function));
      expect(mediaSession.metadata?.title).toBe("One World Radio");
      expect(mediaSession.metadata?.artist).toBe("Live");

      const playHandler = setActionHandler.mock.calls.find(([action]) => action === "play")?.[1] as
        | (() => void)
        | undefined;
      expect(playHandler).toBeTypeOf("function");
      act(() => {
        playHandler?.();
      });

      expect(currentAudio().getAttribute("src")).toBe(RADIO_STREAM_URL);
      expect(mediaSession.playbackState).toBe("playing");

      const pauseHandler = setActionHandler.mock.calls.find(
        ([action]) => action === "pause",
      )?.[1] as (() => void) | undefined;
      act(() => {
        pauseHandler?.();
      });
      expect(announced()).toBe("Paused");
      expect(mediaSession.playbackState).toBe("paused");
    } finally {
      cleanup();
      Object.defineProperty(navigator, "mediaSession", {
        configurable: true,
        value: undefined,
      });
      vi.unstubAllGlobals();
    }
  });

  it("works when the Media Session API is absent", () => {
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: undefined,
    });
    expect(() => renderPlayer()).not.toThrow();
    expect(screen.getAllByRole("button", { name: "Play One World Radio" })).toHaveLength(2);
  });
});

describe("RadioPanel", () => {
  beforeEach(() => {
    installStorage();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows one set of controls, the credit and the third-party note", () => {
    renderPlayer(<RadioPanel />);

    expect(screen.getAllByRole("button", { name: "Play One World Radio" })).toHaveLength(1);
    expect(screen.getAllByRole("slider", { name: "Radio volume" })).toHaveLength(1);
    expect(screen.getByText(RADIO_CREDIT)).toBeInTheDocument();
    expect(
      screen.getByText("Audio streams from a third party. It starts only when you press play."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "One World Radio" })).toBeInTheDocument();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("does not turn a deliberate pause into an error when play() rejects late", async () => {
    let rejectPlay: ((reason: unknown) => void) | undefined;
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPlay = reject;
        }),
    );

    renderPlayer(<RadioPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Play One World Radio" }));
    expect(announced()).toBe("Connecting…");

    // The listener changes their mind while the request is still pending.
    fireEvent.click(screen.getByRole("button", { name: "Pause One World Radio" }));
    expect(announced()).toBe("Paused");

    await act(async () => {
      rejectPlay?.(new DOMException("Interrupted", "AbortError"));
    });

    expect(announced()).toBe("Paused");
  });

  it("reports a failure and offers a retry", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() =>
      Promise.reject(new DOMException("Blocked", "NotAllowedError")),
    );

    renderPlayer(<RadioPanel />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Play One World Radio" }));
    });

    expect(announced()).toBe("Stream unavailable. Tap to retry.");
    expect(screen.getByRole("button", { name: "Retry One World Radio" })).toBeInTheDocument();
  });
});

describe("useRadio", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("refuses to run outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<RadioPlayer />)).toThrow(/RadioProvider/);
  });
});
