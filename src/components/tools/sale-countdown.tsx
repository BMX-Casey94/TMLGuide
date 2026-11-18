"use client";

import { useEffect, useRef, useState } from "react";
import { countdownTo } from "./timeline-logic";
import { describeDuration, formatWholeNumber } from "./numbers";

export interface SaleCountdownProps {
  /** The sale's opening instant, as an ISO string with an offset. */
  readonly opensAtIso: string;
  /** The sale's name, used in the announcement sentence. */
  readonly saleName: string;
}

interface Shown {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly isPast: boolean;
  readonly totalSeconds: number;
}

/**
 * A live countdown to a sale opening.
 *
 * Three rules shape the implementation:
 *
 * 1. It is accurate to the second, so it ticks every second rather than every
 *    minute. The tick is aligned to the next whole second so the digits change
 *    when the clock does, not a fraction after it.
 * 2. It stops while the tab is hidden. A background tab has no reader looking at
 *    it, and a timer per tab is wasted work on a phone; the countdown resets its
 *    base when the page becomes visible again, so the first visible frame is
 *    already correct rather than a second behind.
 * 3. It does not announce every second. A live region that updates sixty times a
 *    minute makes a screen reader unusable, so the visible digits are
 *    `aria-hidden` and a polite region speaks once per minute boundary, plus
 *    once when the sale opens.
 *
 * The displayed value is derived from a base instant and a monotonic elapsed
 * time, so a long-running timer cannot drift away from the wall clock.
 */
export function SaleCountdown({ opensAtIso, saleName }: SaleCountdownProps) {
  /*
    `shown` is null until the first tick has read the clock. That is what the
    placeholder renders on, so no separate "mounted" flag is needed: a piece of
    state that only exists to trigger a re-render would be one render too many.
  */
  const [shown, setShown] = useState<Shown | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const lastAnnouncedMinute = useRef<number | null>(null);
  const didAnnounceOpen = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    /** Reads the clock once and schedules the next tick on a whole second. */
    const tick = (): void => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        // Nothing to draw and nothing to announce while the tab is hidden.
        timer = null;
        return;
      }

      const now = new Date();
      const next = countdownTo(opensAtIso, now);
      setShown({
        days: next.days,
        hours: next.hours,
        minutes: next.minutes,
        seconds: next.seconds,
        isPast: next.isPast,
        totalSeconds: next.totalSeconds,
      });

      if (next.isPast) {
        if (!didAnnounceOpen.current) {
          didAnnounceOpen.current = true;
          setAnnouncement(`${saleName} has opened.`);
        }
        // Stop ticking: there is nothing left to count towards.
        timer = null;
        return;
      }

      /*
        Announce once per minute, bucketed by the minutes remaining rounded up.
        That aligns each announcement with a whole minute before the opening
        rather than with the arbitrary moment the reader arrived, so a boundary
        is never crossed a second after the page loads.
      */
      const minutesRemaining = Math.ceil(next.totalSeconds / 60);
      if (lastAnnouncedMinute.current !== minutesRemaining) {
        const isFirst = lastAnnouncedMinute.current === null;
        lastAnnouncedMinute.current = minutesRemaining;
        if (!isFirst) {
          setAnnouncement(`${describeDuration(next.totalSeconds)} until ${saleName}.`);
        }
      }

      /*
        Align the next tick to the whole second so the digits change when the
        clock does. No guard is added: `setTimeout` never fires early, so the
        tick lands on or just after the boundary and re-schedules from the real
        clock, which keeps a long countdown from drifting.
      */
      const msIntoSecond = now.getTime() % 1000;
      timer = setTimeout(tick, 1000 - msIntoSecond);
    };

    const start = (): void => {
      if (cancelled) return;
      if (timer !== null) clearTimeout(timer);
      // Re-announce from scratch after a hidden spell: the reader is looking
      // again, and the minute value they last heard may be far out of date.
      lastAnnouncedMinute.current = null;
      tick();
    };

    const onVisibility = (): void => {
      if (document.hidden) {
        if (timer !== null) clearTimeout(timer);
        timer = null;
      } else {
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    // A tab restored from the back/forward cache resumes without a
    // visibilitychange event, so the first visible paint is a fair trigger.
    window.addEventListener("pageshow", start);
    window.addEventListener("focus", start);

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", start);
      window.removeEventListener("focus", start);
    };
  }, [opensAtIso, saleName]);

  if (shown === null) {
    // The server cannot know the current time, so the first paint shows the
    // structure with placeholder digits rather than a wrong figure that would
    // then jump.
    return (
      <div className="countdown" aria-busy="true">
        <p className="label text-cream-mute">Next sale opens in</p>
        <p className="countdown__digits countdown__digits--pending" aria-hidden="true">
          -- : -- : -- : --
        </p>
        <p className="countdown__announcement" role="status">
          Loading the countdown to {saleName}.
        </p>
      </div>
    );
  }

  if (shown.isPast) {
    return (
      <div className="countdown">
        <p className="label text-accent">Sale open</p>
        <p className="countdown__open">This sale has opened.</p>
        <p className="countdown__announcement" role="status">
          {announcement}
        </p>
      </div>
    );
  }

  return (
    <div className="countdown">
      <p className="label text-cream-mute">Next sale opens in</p>
      {/* Hidden from assistive technology: the polite region below speaks the
          same distance once a minute instead of sixty times. */}
      <p className="countdown__digits" aria-hidden="true">
        <span className="countdown__unit">
          <span className="countdown__value">{formatWholeNumber(shown.days)}</span>
          <span className="countdown__name">days</span>
        </span>
        <span className="countdown__colon" aria-hidden="true">
          :
        </span>
        <span className="countdown__unit">
          <span className="countdown__value">{String(shown.hours).padStart(2, "0")}</span>
          <span className="countdown__name">hours</span>
        </span>
        <span className="countdown__colon" aria-hidden="true">
          :
        </span>
        <span className="countdown__unit">
          <span className="countdown__value">{String(shown.minutes).padStart(2, "0")}</span>
          <span className="countdown__name">minutes</span>
        </span>
        <span className="countdown__colon" aria-hidden="true">
          :
        </span>
        <span className="countdown__unit">
          <span className="countdown__value">{String(shown.seconds).padStart(2, "0")}</span>
          <span className="countdown__name">seconds</span>
        </span>
      </p>
      {/* A machine-readable instant, so a reader can copy the exact time even
          while the digits tick. */}
      <time className="countdown__instant" dateTime={opensAtIso}>
        Opens at {opensAtIso}
      </time>
      <p className="countdown__announcement" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
