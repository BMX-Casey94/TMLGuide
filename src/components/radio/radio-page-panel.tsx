"use client";

import { RADIO_NAME, RADIO_STREAM_URL } from "./stream";
import { useRadio } from "./radio-context";
import {
  Equaliser,
  MuteButton,
  PlayPauseButton,
  RadioCredit,
  RadioStyles,
  StatusIndicator,
  VolumeSlider,
} from "./radio-parts";

/**
 * The full-width panel for the radio page: the same state and controls as the persistent
 * player, laid out as a card with the stream explained. There is no now-playing metadata,
 * because the stream carries none. Status changes are announced by the provider's polite
 * region; the labels here are decorative.
 */
export function RadioPanel() {
  const { status, muted, volume, toggle, toggleMute, setVolume } = useRadio();

  return (
    <section aria-labelledby="tml-radio-panel-title">
      <RadioStyles />
      <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-hair-strong bg-gradient-to-b from-surface-2 to-surface p-6 shadow-[0_30px_70px_-40px_#000] sm:p-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -right-24 size-72 rounded-full bg-[radial-gradient(circle,var(--ea),transparent_66%)] opacity-[0.16]"
        />

        <div className="relative flex flex-col gap-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
                Live station
              </p>
              <h2
                id="tml-radio-panel-title"
                className="mt-2 font-display text-3xl leading-tight sm:text-4xl"
              >
                {RADIO_NAME}
              </h2>
            </div>
            <Equaliser status={status} className="mt-1.5" />
          </div>

          <div className="flex items-center gap-4">
            <PlayPauseButton status={status} onToggle={toggle} size="large" />
            <div className="flex min-w-0 flex-col gap-1">
              <StatusIndicator status={status} />
              <span className="text-sm text-cream-mute">
                {status === "error"
                  ? "Press retry to start the stream again."
                  : "The station runs around the clock. Nothing loads until you press play."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-hair pt-6">
            <MuteButton muted={muted} onToggle={toggleMute} />
            <VolumeSlider
              id="tml-radio-panel-volume"
              volume={volume}
              onVolume={setVolume}
              className="w-[min(14rem,100%)]"
            />
          </div>

          <div className="border-t border-hair pt-5">
            <RadioCredit />
            <p className="mt-2 text-xs leading-relaxed text-cream-mute">
              Audio streams from a third party. It starts only when you press play.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-cream-mute">
              Not affiliated with Tomorrowland or WeAreOne.World B.V. The stream belongs to
              its operator and is linked here unchanged:{" "}
              <span className="break-all font-mono text-[11px]">{RADIO_STREAM_URL}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
