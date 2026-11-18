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

/** The desktop player, collapsed to an edge tab until its panel is opened. */
function desktopPlayer(): HTMLElement {
  return screen.getByRole("region", { name: "One World Radio player" });
}

/*
  The desktop player starts collapsed, so its transport, mute and volume controls only
  exist once the panel is open. jsdom applies no CSS, so the phone mini-player is in the
  DOM as well; scoping to the desktop region keeps every query unambiguous and fails loudly
  if a control is ever rendered twice inside the one panel.
*/
function desktopButton(name: string): HTMLElement {
  return within(desktopPlayer()).getByRole("button", { name });
}

/** The desktop panel's only slider: the phone dock deliberately has none. */
function desktopSlider(): HTMLElement {
  return within(desktopPlayer()).getByRole("slider", { name: "Radio volume" });
}

/** Expands the desktop edge tab, which is what reveals its controls. */
function openDesktopPanel(): HTMLElement {
  fireEvent.click(desktopButton("Open One World Radio player"));
  return desktopPlayer();
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
    openDesktopPanel();
    fireEvent.click(desktopButton("Play One World Radio"));

    const audio = currentAudio();
    expect(audio.getAttribute("src")).toBe(RADIO_STREAM_URL);
    expect(audio.preload).toBe("none");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(announced()).toBe("Connecting…");
  });

  it("moves from loading to playing on the playing event", () => {
    renderPlayer();
    openDesktopPanel();
    fireEvent.click(desktopButton("Play One World Radio"));
    expect(announced()).toBe("Connecting…");

    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });

    expect(announced()).toBe("Live now");
    // Only the open desktop panel has transport controls: the phone tab stays collapsed.
    expect(screen.getAllByRole("button", { name: "Pause One World Radio" })).toHaveLength(1);
    expect(within(desktopPlayer()).getByRole("button", { name: "Pause One World Radio" })).toBeInTheDocument();
    // The desktop panel prints the design's LIVE label.
    expect(within(desktopPlayer()).getByText("LIVE")).toBeInTheDocument();
  });

  it("returns to loading when the stream stalls or waits", () => {
    renderPlayer();
    openDesktopPanel();
    fireEvent.click(desktopButton("Play One World Radio"));
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
    openDesktopPanel();
    await act(async () => {
      fireEvent.click(desktopButton("Play One World Radio"));
    });

    expect(announced()).toBe("Stream unavailable. Tap to retry.");
    expect(within(desktopPlayer()).getByText("Stream unavailable. Tap to retry.")).toBeInTheDocument();

    const retry = desktopButton("Retry One World Radio");
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
    openDesktopPanel();
    fireEvent.click(desktopButton("Play One World Radio"));
    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });
    act(() => {
      currentAudio().dispatchEvent(new Event("error"));
    });

    expect(announced()).toBe("Stream unavailable. Tap to retry.");
    expect(desktopButton("Retry One World Radio")).toBeInTheDocument();
  });

  it("releases the stream on pause and rebuilds it on the next play", () => {
    renderPlayer();
    openDesktopPanel();
    fireEvent.click(desktopButton("Play One World Radio"));
    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });

    const audio = currentAudio();
    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    vi.mocked(HTMLMediaElement.prototype.load).mockClear();

    fireEvent.click(desktopButton("Pause One World Radio"));

    expect(audio.hasAttribute("src")).toBe(false);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
    expect(announced()).toBe("Paused");

    fireEvent.click(desktopButton("Play One World Radio"));
    expect(currentAudio().getAttribute("src")).toBe(RADIO_STREAM_URL);
    expect(currentAudio()).toBe(audio);
  });

  it("persists volume and ignores invalid stored values", () => {
    window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, "0.6");
    const view = renderPlayer();
    openDesktopPanel();

    // The phone dock has no slider, so the open desktop panel's is the only one on the page.
    expect(screen.getAllByRole("slider", { name: "Radio volume" })).toHaveLength(1);
    const slider = desktopSlider();
    expect(slider).toHaveValue("60");

    fireEvent.change(slider, { target: { value: "35" } });

    expect(window.localStorage.getItem(RADIO_VOLUME_STORAGE_KEY)).toBe("0.35");
    expect(desktopSlider()).toHaveValue("35");

    for (const stored of ["not-a-number", "4.2", "-1", "", "NaN"]) {
      view.unmount();
      window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, stored);
      renderPlayer();
      openDesktopPanel();
      expect(desktopSlider()).toHaveValue("25");
      cleanup();
    }
  });

  it("keeps a valid stored volume of zero", () => {
    window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, "0");
    renderPlayer();
    openDesktopPanel();

    expect(desktopSlider()).toHaveValue("0");
  });

  it("applies the stored volume when the element is created", () => {
    window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, "0.45");
    renderPlayer();
    openDesktopPanel();

    fireEvent.click(desktopButton("Play One World Radio"));
    expect(announced()).toBe("Connecting…");

    const audio = currentAudio();
    expect(audio.volume).toBeCloseTo(0.45);
    // Nothing about opening the panel or playing touches the persisted volume.
    expect(window.localStorage.getItem(RADIO_VOLUME_STORAGE_KEY)).toBe("0.45");
  });

  it("changes the live volume when the slider moves", () => {
    renderPlayer();
    openDesktopPanel();
    fireEvent.click(desktopButton("Play One World Radio"));

    const slider = desktopSlider();
    fireEvent.change(slider, { target: { value: "80" } });

    expect(currentAudio().volume).toBeCloseTo(0.8);
  });

  it("toggles mute with a name that reflects the state", () => {
    renderPlayer();
    openDesktopPanel();
    fireEvent.click(desktopButton("Play One World Radio"));

    fireEvent.click(desktopButton("Mute One World Radio"));
    expect(screen.getAllByRole("button", { name: "Unmute One World Radio" })).toHaveLength(1);
    expect(within(desktopPlayer()).getByRole("button", { name: "Unmute One World Radio" })).toBeInTheDocument();
    expect(currentAudio().muted).toBe(true);

    fireEvent.click(desktopButton("Unmute One World Radio"));
    expect(screen.getAllByRole("button", { name: "Mute One World Radio" })).toHaveLength(1);
    expect(within(desktopPlayer()).getByRole("button", { name: "Mute One World Radio" })).toBeInTheDocument();
    expect(currentAudio().muted).toBe(false);
  });

  it("remembers mute across the first play and never fetches on a mute tap", () => {
    renderPlayer();
    openDesktopPanel();

    fireEvent.click(desktopButton("Mute One World Radio"));
    // Muting alone must not start the stream or create an element.
    expect(document.querySelector("audio")).toBeNull();

    fireEvent.click(desktopButton("Play One World Radio"));

    expect(currentAudio().muted).toBe(true);
  });

  it("announces every state once through a polite region", () => {
    renderPlayer();
    openDesktopPanel();
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Tap to listen");

    fireEvent.click(desktopButton("Play One World Radio"));
    expect(region).toHaveTextContent("Connecting…");

    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });
    expect(region).toHaveTextContent("Live now");

    fireEvent.click(desktopButton("Pause One World Radio"));
    expect(region).toHaveTextContent("Paused");

    // Exactly one live region, so a change is never announced twice.
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("starts the phone player as a slim tab and expands it on request", () => {
    renderPlayer();
    const dock = screen.getByRole("region", { name: "One World Radio mini-player" });

    // Collapsed: only the edge tab exists. No transport controls, no status line, no stream.
    const open = within(dock).getByRole("button", { name: "Open One World Radio player" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(within(dock).queryByRole("button", { name: "Play One World Radio" })).toBeNull();
    expect(within(dock).queryByText("Tap to listen")).toBeNull();
    expect(document.querySelector("audio")).toBeNull();

    fireEvent.click(open);

    // Expanded: transport, name and a minimise control. The stream still has not started.
    expect(within(dock).getByText("One World Radio")).toBeInTheDocument();
    expect(within(dock).queryByRole("slider")).toBeNull();
    expect(document.querySelector("audio")).toBeNull();

    fireEvent.click(within(dock).getByRole("button", { name: "Play One World Radio" }));
    expect(within(dock).getByText("Connecting…")).toBeInTheDocument();

    fireEvent.click(within(dock).getByRole("button", { name: "Minimise One World Radio player" }));
    expect(within(dock).getByRole("button", { name: "Open One World Radio player" })).toBeInTheDocument();
    // Minimising must not stop playback.
    expect(currentAudio().getAttribute("src")).toBe(RADIO_STREAM_URL);
  });

  it("starts the desktop player collapsed as an edge tab", () => {
    renderPlayer();
    const desktop = desktopPlayer();

    const open = within(desktop).getByRole("button", { name: "Open One World Radio player" });
    expect(open).toHaveAttribute("aria-expanded", "false");

    // Collapsed: no transport, no mute, no volume slider, no status line, no stream.
    expect(within(desktop).queryByRole("button", { name: "Play One World Radio" })).toBeNull();
    expect(within(desktop).queryByRole("button", { name: "Mute One World Radio" })).toBeNull();
    expect(within(desktop).queryByRole("slider")).toBeNull();
    expect(within(desktop).queryByText("Tap to listen")).toBeNull();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("opens the desktop panel with its controls and a minimise button", () => {
    renderPlayer();
    const desktop = openDesktopPanel();

    // Expanded: exactly one of each control, because only this panel is open.
    expect(within(desktop).getAllByRole("button", { name: "Play One World Radio" })).toHaveLength(1);
    expect(within(desktop).getAllByRole("button", { name: "Mute One World Radio" })).toHaveLength(1);
    expect(within(desktop).getAllByRole("slider", { name: "Radio volume" })).toHaveLength(1);
    expect(within(desktop).getByText("One World Radio")).toBeInTheDocument();

    const minimise = within(desktop).getByRole("button", { name: "Minimise One World Radio player" });
    expect(minimise).toHaveAttribute("aria-expanded", "true");
    expect(within(desktop).queryByRole("button", { name: "Open One World Radio player" })).toBeNull();
    // Opening the panel alone must not start the stream.
    expect(document.querySelector("audio")).toBeNull();

    // The two layouts keep separate state: opening the desktop panel leaves the phone tab shut.
    const dock = screen.getByRole("region", { name: "One World Radio mini-player" });
    expect(within(dock).getByRole("button", { name: "Open One World Radio player" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(within(dock).queryByRole("button", { name: "Play One World Radio" })).toBeNull();
  });

  it("collapses the desktop panel on Escape without stopping playback", () => {
    renderPlayer();
    const desktop = openDesktopPanel();
    const play = within(desktop).getByRole("button", { name: "Play One World Radio" });
    play.focus();
    expect(play).toHaveFocus();

    fireEvent.click(play);
    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });
    expect(announced()).toBe("Live now");

    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    // The key arrives from a real Escape press, which lands on the document, not the panel.
    fireEvent.keyDown(play, { key: "Escape" });

    // The panel gives way to the tab, and the tab reports the collapsed state to assistive tech.
    const open = within(desktopPlayer()).getByRole("button", { name: "Open One World Radio player" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(within(desktopPlayer()).queryByRole("slider")).toBeNull();
    expect(within(desktopPlayer()).queryByRole("button", { name: "Pause One World Radio" })).toBeNull();
    // The collapsed state does not depend on where focus was: the panel it described is gone.
    expect(play).not.toBeInTheDocument();
    // The tab that replaces it stays reachable, so a keyboard listener can still reopen.
    expect(open).toBeEnabled();
    expect(open).not.toHaveAttribute("hidden");

    // Escape is a layout change, not a transport command.
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(currentAudio().getAttribute("src")).toBe(RADIO_STREAM_URL);
    expect(announced()).toBe("Live now");
  });

  it("keeps playing when the desktop panel is minimised", () => {
    renderPlayer();
    const desktop = openDesktopPanel();
    fireEvent.click(within(desktop).getByRole("button", { name: "Play One World Radio" }));
    act(() => {
      currentAudio().dispatchEvent(new Event("playing"));
    });

    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    fireEvent.click(within(desktop).getByRole("button", { name: "Minimise One World Radio player" }));

    expect(within(desktopPlayer()).getByRole("button", { name: "Open One World Radio player" })).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(currentAudio().getAttribute("src")).toBe(RADIO_STREAM_URL);
    expect(announced()).toBe("Live now");
  });

  it("removes the Escape listener once the desktop panel is collapsed", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    renderPlayer();
    openDesktopPanel();

    const added = addSpy.mock.calls.filter(([type]) => type === "keydown").map(([, listener]) => listener);
    expect(added).toHaveLength(1);
    // While open, no keydown listener has been torn down.
    expect(removeSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(0);

    fireEvent.keyDown(window, { key: "Escape" });

    // The exact handler reference that was added is the one removed.
    const removed = removeSpy.mock.calls.filter(([type]) => type === "keydown").map(([, listener]) => listener);
    expect(removed).toHaveLength(1);
    expect(removed[0]).toBe(added[0]);

    // A further Escape reaches no stale handler: the state cannot change from a dead listener.
    expect(() => fireEvent.keyDown(window, { key: "Escape" })).not.toThrow();
    expect(within(desktopPlayer()).getByRole("button", { name: "Open One World Radio player" })).toBeInTheDocument();
    expect(removeSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);

    // Reopening subscribes again, and closing again tears that one down too: no accumulation.
    openDesktopPanel();
    expect(addSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(2);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(removeSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(2);
    expect(within(desktopPlayer()).getByRole("button", { name: "Open One World Radio player" })).toBeInTheDocument();
  });

  it("removes the element and its listeners on unmount", () => {
    const view = renderPlayer();
    openDesktopPanel();
    fireEvent.click(desktopButton("Play One World Radio"));
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
    // Collapsed layouts expose no transport, so neither edge tab offers Play yet.
    expect(screen.queryAllByRole("button", { name: "Play One World Radio" })).toHaveLength(0);

    openDesktopPanel();
    // Opening only the desktop panel reveals exactly one Play button across both layouts.
    expect(screen.getAllByRole("button", { name: "Play One World Radio" })).toHaveLength(1);
    expect(within(desktopPlayer()).getByRole("button", { name: "Play One World Radio" })).toBeInTheDocument();
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
