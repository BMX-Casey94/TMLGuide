"use client";

import type { ButtonHTMLAttributes } from "react";
import { RADIO_CREDIT, RADIO_NAME } from "./stream";
import { RADIO_STATUS_MESSAGES, type RadioStatus } from "./radio-context";

/*
  Presentation shared by the floating player, the docked mini-player and the page panel.

  The keyframes live in a hoisted <style> because the equaliser needs per-bar delays and a
  height animation that a utility class cannot express, and the shared stylesheet is owned
  elsewhere. The reduced-motion query is repeated here so the bars stay still even if the
  global rule is ever removed.
*/
export function RadioStyles() {
  return (
    <style href="tml-radio-player" precedence="default">{`
      @keyframes tml-radio-eq { 0%, 100% { height: 5px } 50% { height: 22px } }
      @keyframes tml-radio-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgb(240 82 127 / 0.5) }
        50% { box-shadow: 0 0 0 4px rgb(240 82 127 / 0.16) }
      }
      .tml-radio-eq-bar {
        width: 3px;
        height: 6px;
        border-radius: 2px;
        background: var(--ea);
        opacity: 0.45;
      }
      [data-eq="playing"] .tml-radio-eq-bar {
        opacity: 1;
        animation: tml-radio-eq 1s ease-in-out infinite;
      }
      [data-eq="playing"] .tml-radio-eq-bar:nth-child(2) { animation-delay: -0.3s }
      [data-eq="playing"] .tml-radio-eq-bar:nth-child(3) { animation-delay: -0.6s }
      [data-eq="playing"] .tml-radio-eq-bar:nth-child(4) { animation-delay: -0.15s }
      .tml-radio-dot[data-live="true"] { animation: tml-radio-pulse 2s ease-in-out infinite }
      @media (prefers-reduced-motion: reduce) {
        [data-eq="playing"] .tml-radio-eq-bar { animation: none; height: 6px }
        .tml-radio-dot[data-live="true"] { animation: none; box-shadow: 0 0 0 3px rgb(240 82 127 / 0.22) }
      }
    `}</style>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
      <path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l11-6.8a1 1 0 0 0 0-1.8l-11-6.8A1 1 0 0 0 8 5.2z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-current">
      <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
    </svg>
  );
}

function SpeakerOnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        d="M4 9.5h3.2L12 5.4a.8.8 0 0 1 1.3.6v12a.8.8 0 0 1-1.3.6L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"
        fill="currentColor"
      />
      <path
        d="M16.4 8.6a4.8 4.8 0 0 1 0 6.8M18.9 6.1a8.3 8.3 0 0 1 0 11.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        d="M4 9.5h3.2L12 5.4a.8.8 0 0 1 1.3.6v12a.8.8 0 0 1-1.3.6L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"
        fill="currentColor"
      />
      <path
        d="M16.3 9.7l4.6 4.6M20.9 9.7l-4.6 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Accessible name for the transport control: it names the action it will perform. */
export function playLabel(status: RadioStatus): string {
  if (status === "playing" || status === "loading") return `Pause ${RADIO_NAME}`;
  if (status === "error") return `Retry ${RADIO_NAME}`;
  return `Play ${RADIO_NAME}`;
}

interface PlayPauseButtonProps {
  status: RadioStatus;
  onToggle: () => void;
  className?: string;
  size?: "default" | "large";
}

export function PlayPauseButton({
  status,
  onToggle,
  className = "",
  size = "default",
}: PlayPauseButtonProps) {
  const active = status === "playing" || status === "loading";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playLabel(status)}
      className={`grid flex-none place-items-center rounded-full bg-accent text-on-accent shadow-[0_8px_22px_-8px_var(--ea)] transition-transform duration-200 hover:scale-105 focus-visible:rounded-full! active:scale-95 ${
        size === "large" ? "size-14" : "size-12"
      } ${className}`}
    >
      {active ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

interface StatusIndicatorProps {
  status: RadioStatus;
  className?: string;
  /**
   * The word shown while audio flows. The desktop pill uses the design's "LIVE" label;
   * every other surface prints the plain status.
   */
  playingLabel?: string;
}

/**
 * The visible station line: a dot that only pulses while playing, plus the state in words.
 * It is decorative for assistive technology, because the provider's polite region owns the
 * announcement and stating each change here as well would double it.
 */
export function StatusIndicator({
  status,
  className = "",
  playingLabel,
}: StatusIndicatorProps) {
  const live = status === "playing";
  const label = live
    ? (playingLabel ?? RADIO_STATUS_MESSAGES.playing)
    : RADIO_STATUS_MESSAGES[status];
  return (
    <span
      aria-hidden="true"
      className={`flex min-w-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-cream-mute ${className}`}
    >
      <span
        data-live={live ? "true" : "false"}
        className={`tml-radio-dot size-[7px] flex-none rounded-full ${
          live ? "bg-rose" : status === "error" ? "bg-rose/60" : "bg-hair-strong"
        }`}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Four CSS-only bars. Only the playing state animates, and reduced motion stops it. */
export function Equaliser({ status, className = "" }: { status: RadioStatus; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-eq={status === "playing" ? "playing" : "idle"}
      className={`flex h-[22px] flex-none items-end gap-[3px] ${className}`}
    >
      <b className="tml-radio-eq-bar" />
      <b className="tml-radio-eq-bar" />
      <b className="tml-radio-eq-bar" />
      <b className="tml-radio-eq-bar" />
    </span>
  );
}

interface MuteButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> {
  muted: boolean;
  onToggle: () => void;
}

export function MuteButton({ muted, onToggle, className = "", ...rest }: MuteButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? `Unmute ${RADIO_NAME}` : `Mute ${RADIO_NAME}`}
      className={`grid size-11 flex-none place-items-center rounded-full text-cream-mute transition-colors hover:bg-surface-2 focus-visible:rounded-full! hover:text-cream ${className}`}
      {...rest}
    >
      {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
    </button>
  );
}

interface VolumeSliderProps {
  id: string;
  volume: number;
  onVolume: (value: number) => void;
  className?: string;
}

export function VolumeSlider({ id, volume, onVolume, className = "" }: VolumeSliderProps) {
  const percent = Math.round(volume * 100);
  return (
    <input
      id={id}
      type="range"
      min={0}
      max={100}
      step={1}
      value={percent}
      aria-label="Radio volume"
      aria-valuetext={`${percent}%`}
      onChange={(event) => onVolume(Number(event.target.value) / 100)}
      className={`h-11 flex-none cursor-pointer accent-accent ${className}`}
    />
  );
}

export function RadioCredit({ className = "" }: { className?: string }) {
  return <p className={`text-xs leading-relaxed text-cream-mute ${className}`}>{RADIO_CREDIT}</p>;
}
