"use client";

import { RADIO_NAME } from "./stream";
import { useRadio } from "./radio-context";
import {
  Equaliser,
  MuteButton,
  PlayPauseButton,
  RadioStyles,
  StatusIndicator,
  VolumeSlider,
} from "./radio-parts";

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

  return (
    <>
      <RadioStyles />

      {/* Desktop: floating pill, bottom-right, 16px from each edge. */}
      <section
        aria-label={`${RADIO_NAME} player`}
        className="fixed right-4 bottom-4 z-50 hidden max-w-[calc(100vw-32px)] items-center gap-3.5 rounded-full border border-hair-strong bg-surface/90 py-2.5 pr-5 pl-2.5 shadow-[0_24px_50px_-20px_#000,0_0_0_1px_rgb(0_0_0/0.4)] backdrop-blur-lg min-[900px]:flex"
      >
        <PlayPauseButton status={status} onToggle={toggle} />

        <div className="flex min-w-0 flex-col">
          <StatusIndicator status={status} playingLabel="LIVE" />
          <span className="truncate font-display text-[17px] leading-tight">{RADIO_NAME}</span>
        </div>

        <Equaliser status={status} className="ml-1" />

        <div className="flex items-center gap-1">
          <MuteButton muted={muted} onToggle={toggleMute} />
          <VolumeSlider
            id="tml-radio-volume"
            volume={volume}
            onVolume={setVolume}
            className="w-[84px]"
          />
        </div>
      </section>

      {/*
        Mobile: docked mini-player above the bottom tab bar, 56px high, 12px side margins.
        It collapses to the button and station name until the listener engages, at which
        point the status line appears. No volume slider: hardware buttons do that job.
      */}
      <section
        aria-label={`${RADIO_NAME} mini-player`}
        className="fixed right-3 left-3 z-50 flex h-14 items-center gap-3 rounded-[22px] border border-hair-strong bg-surface/95 py-1.5 pr-1.5 pl-1.5 shadow-[0_18px_40px_-18px_#000] backdrop-blur-lg min-[900px]:hidden"
        style={{ bottom: "calc(var(--tabbar-h, 64px) + env(safe-area-inset-bottom))" }}
      >
        <PlayPauseButton status={status} onToggle={toggle} className="size-11" />

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {dockVisible ? <StatusIndicator status={status} /> : null}
          <span className="truncate font-display text-[17px] leading-tight">{RADIO_NAME}</span>
        </div>

        <Equaliser status={status} className="mr-1" />

        <MuteButton muted={muted} onToggle={toggleMute} />
      </section>
    </>
  );
}
