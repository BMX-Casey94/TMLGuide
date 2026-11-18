"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { RADIO_NAME } from "./stream";
import { useRadio } from "./radio-context";
import {
  Headphones,
  MuteButton,
  PlayPauseButton,
  RadioStyles,
  StatusIndicator,
  VolumeSlider,
} from "./radio-parts";

/**
 * Moves focus into a disclosure panel when it opens and back to its tab when it closes, so the
 * unmounted trigger never leaves keyboard focus on <body>. Skips the first render.
 */
function useDisclosureFocus(
  expanded: boolean,
  tabRef: RefObject<HTMLButtonElement | null>,
  panelRef: RefObject<HTMLDivElement | null>,
) {
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (expanded) panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    else tabRef.current?.focus();
  }, [expanded, tabRef, panelRef]);
}

/** Clear of the tab bar by a full 16px, plus the home-indicator inset. */
const MOBILE_BOTTOM = "calc(var(--tabbar-h, 64px) + env(safe-area-inset-bottom) + 16px)";

/**
 * The persistent radio player.
 *
 * Both layouts are always rendered and swapped by CSS at the 900px breakpoint, so the
 * server output and the first client render agree: nothing reads the viewport width and
 * there is no hydration flash. The layout that is display:none leaves the accessibility
 * tree. Status changes are announced by the provider's single polite region, so the
 * visible labels here are decorative. The player renders no audio element: the provider
 * creates it on the first tap.
 */
export function RadioPlayer() {
  const { status, muted, volume, dockVisible, toggle, toggleMute, setVolume } = useRadio();
  // On phones the player starts as a slim tab on the right edge and slides out when tapped, so it
  // never covers content or touches the tab bar until the listener asks for it.
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const desktopPanelId = useId();
  const desktopTabRef = useRef<HTMLButtonElement>(null);
  const desktopPanelRef = useRef<HTMLDivElement>(null);
  const mobileTabRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const [desktopExpanded, setDesktopExpanded] = useState(false);

  useDisclosureFocus(desktopExpanded, desktopTabRef, desktopPanelRef);
  useDisclosureFocus(expanded, mobileTabRef, mobilePanelRef);

  useEffect(() => {
    if (!desktopExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDesktopExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desktopExpanded]);

  return (
    <>
      <RadioStyles />

      {/* Desktop: edge tab on the right, vertically centred; expands into a side panel. */}
      <section aria-label={`${RADIO_NAME} player`} className="hidden min-[900px]:block">
        {desktopExpanded ? (
          <div
            id={desktopPanelId}
            ref={desktopPanelRef}
            className="tml-radio-slide fixed top-1/2 right-0 z-50 flex w-[300px] -translate-y-1/2 flex-col gap-4 rounded-l-[22px] border border-r-0 border-hair-strong bg-surface/95 p-4 shadow-[0_24px_50px_-20px_#000,0_0_0_1px_rgb(0_0_0/0.4)] backdrop-blur-lg"
          >
            <div className="flex items-center gap-3">
              <PlayPauseButton status={status} onToggle={toggle} />
              <div className="flex min-w-0 flex-1 flex-col">
                <StatusIndicator status={status} playingLabel="LIVE" />
                <span className="truncate font-display text-[17px] leading-tight">{RADIO_NAME}</span>
              </div>
              <Headphones status={status} />
              <button
                type="button"
                onClick={() => setDesktopExpanded(false)}
                aria-label={`Minimise ${RADIO_NAME} player`}
                aria-expanded="true"
                aria-controls={desktopPanelId}
                className="grid size-10 flex-none place-items-center rounded-full text-cream-mute transition-colors hover:bg-surface-2 hover:text-cream focus-visible:rounded-full!"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <MuteButton muted={muted} onToggle={toggleMute} />
              <VolumeSlider id="tml-radio-volume" volume={volume} onVolume={setVolume} className="min-w-0 flex-1" />
            </div>
          </div>
        ) : (
          <button
            type="button"
            ref={desktopTabRef}
            onClick={() => setDesktopExpanded(true)}
            aria-label={`Open ${RADIO_NAME} player`}
            aria-expanded="false"
            aria-controls={desktopPanelId}
            className="fixed top-1/2 right-0 z-50 grid h-16 w-12 -translate-y-1/2 place-items-center overflow-visible rounded-l-[18px] border border-r-0 border-hair-strong bg-surface/95 shadow-[0_14px_30px_-14px_#000] backdrop-blur-lg transition-colors hover:bg-surface-2 focus-visible:rounded-l-[18px]!"
          >
            <Headphones status={status} />
          </button>
        )}
      </section>

      {/*
        Mobile: docked mini-player above the bottom tab bar, 56px high, 12px side margins.
        It collapses to the button and station name until the listener engages, at which
        point the status line appears. No volume slider: hardware buttons do that job.
      */}
      <section
        aria-label={`${RADIO_NAME} mini-player`}
        className="min-[900px]:hidden"
      >
        {expanded ? (
          <div
            id={panelId}
            ref={mobilePanelRef}
            className="tml-radio-slide fixed right-3 left-3 z-50 flex h-14 items-center gap-2 rounded-[22px] border border-hair-strong bg-surface/95 py-1.5 pr-1 pl-1.5 shadow-[0_18px_40px_-18px_#000] backdrop-blur-lg"
            style={{ bottom: MOBILE_BOTTOM }}
          >
            <PlayPauseButton status={status} onToggle={toggle} className="size-11" />

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              {dockVisible ? <StatusIndicator status={status} /> : null}
              <span className="truncate font-display text-[17px] leading-tight">{RADIO_NAME}</span>
            </div>

            <Headphones status={status} className="mr-1" />

            <MuteButton muted={muted} onToggle={toggleMute} />
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label={`Minimise ${RADIO_NAME} player`}
              aria-expanded="true"
              aria-controls={panelId}
              className="grid size-11 flex-none place-items-center rounded-full text-cream-mute transition-colors hover:bg-surface-2 hover:text-cream focus-visible:rounded-full!"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            ref={mobileTabRef}
            onClick={() => setExpanded(true)}
            aria-label={`Open ${RADIO_NAME} player`}
            aria-expanded="false"
            aria-controls={panelId}
            className="fixed right-0 z-50 grid h-14 w-12 place-items-center overflow-visible rounded-l-[18px] border border-r-0 border-hair-strong bg-surface/95 shadow-[0_14px_30px_-14px_#000] backdrop-blur-lg transition-colors hover:bg-surface-2 focus-visible:rounded-l-[18px]!"
            style={{ bottom: MOBILE_BOTTOM }}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`size-6 transition-colors ${
                status === "playing" || status === "loading" ? "text-accent" : "text-cream"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Headphones: band over two ear cups. */}
              <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
              <rect x="3" y="14" width="4.5" height="7" rx="1.6" />
              <rect x="16.5" y="14" width="4.5" height="7" rx="1.6" />
            </svg>
            {status === "playing" ? (
              <span
                aria-hidden="true"
                data-live="true"
                className="tml-radio-dot absolute top-2 right-2 size-[7px] rounded-full bg-rose"
              />
            ) : null}
          </button>
        )}
      </section>
    </>
  );
}
