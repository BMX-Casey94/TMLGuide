"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { RADIO_NAME, RADIO_STREAM_URL } from "./stream";

export type RadioStatus = "idle" | "loading" | "playing" | "paused" | "error";

/** The listener-facing status copy, shared by every player so the wording cannot drift. */
export const RADIO_STATUS_MESSAGES: Record<RadioStatus, string> = {
  idle: "Tap to listen",
  loading: "Connecting…",
  playing: "Live now",
  paused: "Paused",
  error: "Stream unavailable. Tap to retry.",
};

export const RADIO_VOLUME_STORAGE_KEY = "tml-radio-volume";
export const RADIO_DEFAULT_VOLUME = 0.25;

const PLAYBACK_BLOCKED_MESSAGE =
  "Your browser blocked playback. Press play again to allow sound.";
const STREAM_UNREACHABLE_MESSAGE =
  "The stream could not be reached. Check your connection and try again.";
const STREAM_UNPLAYABLE_MESSAGE = "The stream could not be played. Try again in a moment.";

/*
  Volume lives in localStorage so it survives navigation, reloads and other tabs.

  The store keeps no copy of the value: each snapshot re-reads storage. A number is a
  stable snapshot for React, every radio on the page stays in step, and the value can be
  read outside React when the audio element is created on the first tap. If storage is
  denied (private mode, embedded webviews), the value is held in memory instead.
*/
let fallbackVolume = RADIO_DEFAULT_VOLUME;
const volumeListeners = new Set<() => void>();

function readStoredVolume(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RADIO_VOLUME_STORAGE_KEY);
    if (raw === null || raw.trim() === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
  } catch {
    return null;
  }
}

function getVolumeSnapshot(): number {
  return readStoredVolume() ?? fallbackVolume;
}

function getVolumeServerSnapshot(): number {
  return RADIO_DEFAULT_VOLUME;
}

function subscribeToVolume(listener: () => void): () => void {
  volumeListeners.add(listener);
  if (typeof window === "undefined") return () => volumeListeners.delete(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== RADIO_VOLUME_STORAGE_KEY) return;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    volumeListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeVolume(value: number): void {
  try {
    window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, String(value));
  } catch {
    fallbackVolume = value;
  }
  for (const listener of volumeListeners) listener();
}

function hasSource(audio: HTMLAudioElement): boolean {
  const src = audio.getAttribute("src");
  return src !== null && src !== "";
}

/**
 * Stops the stream and frees the connection, which matters for a live stream that would
 * otherwise keep downloading in the background.
 *
 * The attribute is removed rather than set to "": an empty string resolves against the
 * document URL, so the element would request the page itself. Removal leaves the element
 * genuinely empty; load() then returns it to an idle state with no network activity.
 */
function releaseStream(audio: HTMLAudioElement): void {
  audio.pause();
  audio.removeAttribute("src");
  try {
    audio.load();
  } catch {
    /* Nothing to load: the element is already empty. */
  }
}

function attemptPlay(audio: HTMLAudioElement, onFailure: (reason: unknown) => void): void {
  let result: Promise<void> | undefined;
  try {
    result = audio.play();
  } catch (error) {
    onFailure(error);
    return;
  }
  if (result && typeof result.then === "function") {
    result.then(undefined, onFailure);
  }
}

function setMediaSessionPlaybackState(state: MediaSessionPlaybackState): void {
  if (typeof navigator === "undefined") return;
  const session = navigator.mediaSession;
  if (!session) return;
  try {
    session.playbackState = state;
  } catch {
    /* Some implementations keep this read-only; playback is unaffected. */
  }
}

function describePlayFailure(reason: unknown): string {
  if (typeof DOMException !== "undefined" && reason instanceof DOMException) {
    if (reason.name === "NotAllowedError" || reason.name === "SecurityError") {
      return PLAYBACK_BLOCKED_MESSAGE;
    }
    if (reason.name === "NotSupportedError") return STREAM_UNPLAYABLE_MESSAGE;
  }
  return STREAM_UNREACHABLE_MESSAGE;
}

function describeMediaError(audio: HTMLAudioElement): string {
  // 1 is an abort (we released the source), 2 a network failure, 3 decoding, 4 unusable.
  return audio.error?.code === 4 ? STREAM_UNPLAYABLE_MESSAGE : STREAM_UNREACHABLE_MESSAGE;
}

export interface RadioState {
  status: RadioStatus;
  /** Plain explanation of the last failure, or null. */
  errorMessage: string | null;
  /** Playback volume from 0 to 1, persisted in localStorage. */
  volume: number;
  muted: boolean;
  /**
   * True once the listener has engaged with the radio. The docked mini-player uses it to
   * grow from its collapsed state (play button and station name) to show the status line.
   */
  dockVisible: boolean;
}

export interface RadioControls {
  play: () => void;
  pause: () => void;
  /** Plays, pauses, or retries depending on the current status. */
  toggle: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  retry: () => void;
}

export type RadioContextValue = RadioState & RadioControls;

const RadioContext = createContext<RadioContextValue | null>(null);

export function RadioProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RadioStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const volume = useSyncExternalStore(
    subscribeToVolume,
    getVolumeSnapshot,
    getVolumeServerSnapshot,
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);

  const attachListeners = useCallback((audio: HTMLAudioElement) => {
    const onPlaying = () => {
      if (!hasSource(audio)) return;
      setErrorMessage(null);
      setStatus("playing");
      setMediaSessionPlaybackState("playing");
    };

    const onBuffering = () => {
      if (!hasSource(audio)) return;
      setStatus("loading");
      setMediaSessionPlaybackState("playing");
    };

    const onError = () => {
      // A released element reports no source: ignore anything after that.
      if (!hasSource(audio)) return;
      setErrorMessage(describeMediaError(audio));
      setStatus("error");
      setMediaSessionPlaybackState("paused");
      releaseStream(audio);
    };

    const listeners: Array<[keyof HTMLMediaElementEventMap, () => void]> = [
      ["playing", onPlaying],
      ["waiting", onBuffering],
      ["stalled", onBuffering],
      ["error", onError],
    ];

    for (const [type, listener] of listeners) {
      audio.addEventListener(type, listener);
    }

    return () => {
      for (const [type, listener] of listeners) {
        audio.removeEventListener(type, listener);
      }
    };
  }, []);

  /*
    The element is created on the first tap, so nothing is requested, buffered or decoded
    before the listener asks for sound. It is attached to the document because Media
    Session metadata and background playback behave more predictably for a connected
    element; unmount removes it again.
  */
  const ensureAudio = useCallback((): HTMLAudioElement | null => {
    const existing = audioRef.current;
    if (existing) return existing;
    if (typeof document === "undefined") return null;

    const audio = document.createElement("audio");
    audio.preload = "none";
    audio.hidden = true;
    audio.volume = getVolumeSnapshot();
    audio.muted = mutedRef.current;
    attachListeners(audio);
    document.body.appendChild(audio);
    audioRef.current = audio;
    return audio;
  }, [attachListeners]);

  const handlePlayFailure = useCallback((reason: unknown) => {
    const audio = audioRef.current;
    /*
      A released source means the listener paused (or the stream already failed) after this
      play() was requested. Reporting an error now would overwrite a deliberate pause.
    */
    if (audio && !hasSource(audio)) return;
    if (audio) releaseStream(audio);
    // Pausing interrupts a pending play() with AbortError; that is not a failure.
    if (typeof DOMException !== "undefined" && reason instanceof DOMException) {
      if (reason.name === "AbortError") return;
    }
    setErrorMessage(describePlayFailure(reason));
    setStatus("error");
    setMediaSessionPlaybackState("paused");
  }, []);

  const startStream = useCallback(
    (audio: HTMLAudioElement, reloadFirst: boolean) => {
      setErrorMessage(null);
      setStatus("loading");
      setMediaSessionPlaybackState("playing");
      audio.src = RADIO_STREAM_URL;
      if (reloadFirst) {
        try {
          audio.load();
        } catch {
          /* A load failure surfaces through the error event. */
        }
      }
      attemptPlay(audio, handlePlayFailure);
    },
    [handlePlayFailure],
  );

  const play = useCallback(() => {
    const audio = ensureAudio();
    if (!audio) {
      setErrorMessage(STREAM_UNPLAYABLE_MESSAGE);
      setStatus("error");
      return;
    }
    startStream(audio, false);
  }, [ensureAudio, startStream]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    // Nothing has started yet: there is no stream to stop and no state to change.
    if (!audio) return;
    setErrorMessage(null);
    releaseStream(audio);
    setStatus("paused");
    setMediaSessionPlaybackState("paused");
  }, []);

  const retry = useCallback(() => {
    const audio = ensureAudio();
    if (!audio) {
      setErrorMessage(STREAM_UNPLAYABLE_MESSAGE);
      setStatus("error");
      return;
    }
    /*
      The published redirect URL must stay byte-for-byte as given, so retry reloads the
      same source rather than appending a cache-busting query. load() restarts the request.
    */
    startStream(audio, true);
  }, [ensureAudio, startStream]);

  const toggle = useCallback(() => {
    if (status === "playing" || status === "loading") {
      pause();
    } else if (status === "error") {
      retry();
    } else {
      play();
    }
  }, [pause, play, retry, status]);

  const setVolume = useCallback((next: number) => {
    const value = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : RADIO_DEFAULT_VOLUME;
    writeVolume(value);
    const audio = audioRef.current;
    if (audio) audio.volume = value;
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    const audio = audioRef.current;
    if (audio) audio.muted = next;
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const session = navigator.mediaSession;
    if (!session || typeof session.setActionHandler !== "function") return;

    if (typeof MediaMetadata !== "undefined") {
      session.metadata = new MediaMetadata({ title: RADIO_NAME, artist: "Live" });
    }

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => play()],
      ["pause", () => pause()],
    ];

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        /* Actions a browser does not support are allowed to reject. */
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          /* Nothing to release if the browser refused the handler. */
        }
      }
    };
  }, [pause, play]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) {
        releaseStream(audio);
        audio.remove();
      }
    };
  }, []);

  const value = useMemo<RadioContextValue>(
    () => ({
      status,
      errorMessage,
      volume,
      muted,
      dockVisible: status !== "idle",
      play,
      pause,
      toggle,
      setVolume,
      toggleMute,
      retry,
    }),
    [status, errorMessage, volume, muted, play, pause, toggle, setVolume, toggleMute, retry],
  );

  return (
    <RadioContext.Provider value={value}>
      {children}
      {/*
        One polite live region for the whole app, mounted before any status changes so the
        announcement is reliable. It lives here rather than in a player because the layout
        player and the radio page panel can both be on screen; a region per player would
        announce every change twice. It is visually hidden and purely for assistive
        technology, so the visible labels stay decorative.
      */}
      <span role="status" aria-live="polite" className="sr-only">
        {RADIO_STATUS_MESSAGES[status]}
      </span>
    </RadioContext.Provider>
  );
}

export function useRadio(): RadioContextValue {
  const context = useContext(RadioContext);
  if (!context) {
    throw new Error("useRadio must be used inside a RadioProvider.");
  }
  return context;
}
