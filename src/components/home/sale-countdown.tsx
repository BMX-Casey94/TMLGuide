"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/tools";

export interface SaleCountdownProps {
  /** The opening moment, an ISO instant with an explicit offset. */
  readonly opensAtIso: string;
  /**
   * The moment the page was rendered, taken from the server's clock. The first
   * render on both sides uses this value, so the server HTML and the hydrated
   * markup agree, and the browser's clock only takes over after mount.
   */
  readonly serverNowIso: string;
}

const UNITS = ["days", "hours", "minutes", "seconds"] as const;
type Unit = (typeof UNITS)[number];

const UNIT_LABELS: Record<Unit, string> = {
  days: "Days",
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds",
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Turns the distance to a sale into one spoken sentence, with only the units
 * that carry information: days appear only when there are days left, and
 * "less than a minute" replaces "0 minutes" so the last minute reads correctly.
 *
 * Seconds are deliberately absent. The sentence is the live region's text, and
 * a sentence that changes every second would interrupt a screen-reader user
 * sixty times a minute for information they cannot act on any faster.
 */
export function spokenRemaining(parts: {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
}): string {
  const chunks: string[] = [];
  if (parts.days > 0) {
    chunks.push(`${parts.days} ${parts.days === 1 ? "day" : "days"}`);
    chunks.push(`${parts.hours} ${parts.hours === 1 ? "hour" : "hours"}`);
    chunks.push(`${parts.minutes} ${parts.minutes === 1 ? "minute" : "minutes"}`);
    return chunks.join(", ");
  }
  if (parts.hours > 0) {
    chunks.push(`${parts.hours} ${parts.hours === 1 ? "hour" : "hours"}`);
    chunks.push(`${parts.minutes} ${parts.minutes === 1 ? "minute" : "minutes"}`);
    return chunks.join(" and ");
  }
  if (parts.minutes > 0) {
    return `${parts.minutes} ${parts.minutes === 1 ? "minute" : "minutes"}`;
  }
  return "less than a minute";
}

/**
 * Countdown to a ticket sale.
 *
 * The numerals update every second, but they are hidden from assistive
 * technology, and the live region beside them holds a sentence built from days,
 * hours and minutes only. That sentence is therefore rewritten once a minute
 * rather than once a second, so a screen reader announces the remaining time at
 * a volume a listener can follow.
 *
 * Once the opening moment is reached the interval is cleared, the numerals give
 * way to a plain statement that the sale has opened, and the live region says
 * so once.
 */
export function SaleCountdown({ opensAtIso, serverNowIso }: SaleCountdownProps) {
  const [nowMs, setNowMs] = useState(() => Date.parse(serverNowIso));

  useEffect(() => {
    const opensAtMs = Date.parse(opensAtIso);
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    const tick = () => {
      const current = Date.now();
      setNowMs(current);
      // Stop at the moment the sale opens: nothing after it changes.
      if (current >= opensAtMs) stop();
    };

    tick();
    // A sale that has already opened needs no timer at all, so the interval is
    // only created when the first reading is still short of the opening.
    if (Date.now() < opensAtMs) timer = setInterval(tick, 1000);

    return stop;
  }, [opensAtIso]);

  const remaining = countdown(opensAtIso, new Date(nowMs));

  if (remaining.isPast) {
    return (
      <div className="home-next__countdown">
        <p className="label text-accent">Sale opened</p>
        <p className="home-next__source" role="status">
          This sale has opened. Check the sale page for what is still available.
        </p>
      </div>
    );
  }

  const values: Record<Unit, string> = {
    days: String(remaining.days),
    hours: pad(remaining.hours),
    minutes: pad(remaining.minutes),
    seconds: pad(remaining.seconds),
  };

  return (
    <div className="home-next__countdown">
      <p className="label text-cream-mute">Opens in</p>
      <ol className="home-count" aria-hidden="true">
        {UNITS.map((unit) => (
          <li key={unit} className="home-count__unit">
            <span className="home-count__value">{values[unit]}</span>
            <span className="home-count__label">{UNIT_LABELS[unit]}</span>
          </li>
        ))}
      </ol>
      {/*
        The sentence a screen reader hears, shown to everyone as well. Making it
        visible keeps the two audiences in step: nobody has to do the arithmetic
        on the numerals, and the live region is announcing text that is actually
        on the page.
      */}
      <p className="home-count__spoken" role="status" aria-live="polite">
        {spokenRemaining(remaining)} until this sale opens.
      </p>
    </div>
  );
}
