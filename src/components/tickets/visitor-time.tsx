"use client";

/**
 * The visitor's own clock, added beside the published festival time.
 *
 * Sale times are published in the festival's time zone, so a visitor in another
 * country has to convert them in their head. This does the conversion with `Intl`,
 * which knows the offset in force on that exact date, so a January sale and a July
 * one are converted with the right daylight-saving rules rather than a fixed
 * offset.
 *
 * The zone is only knowable in the browser. It is read through
 * `useSyncExternalStore`, whose server snapshot is always null: the prerendered
 * HTML therefore carries no guessed zone, and React re-renders with the real one
 * immediately after hydration. The value is cached because constructing an
 * `Intl.DateTimeFormat` on every render is measurable, and the browser's zone
 * cannot change without a page reload.
 */
import { useSyncExternalStore } from "react";
import { formatInstantLong } from "./format";

/** How an instant reads in the visitor's own zone. */
export interface VisitorReading {
  /** The IANA name, for example "Europe/London". */
  zone: string;
  /** The instant as it reads there, for example "Sat 30 Jan 2027, 16:00 GMT". */
  text: string;
}

let cachedZone: string | null | undefined;

/** The browser's IANA zone, or null when `Intl` is unavailable or reports nothing. */
function readZone(): string | null {
  if (cachedZone !== undefined) return cachedZone;
  try {
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    cachedZone = typeof zone === "string" && zone.length > 0 ? zone : null;
  } catch {
    // A locked-down browser can refuse Intl entirely; the published time still stands.
    cachedZone = null;
  }
  return cachedZone;
}

/** Nothing to subscribe to: the zone changes only across a page load. */
function subscribe(): () => void {
  return () => {};
}

/** The server has no zone to report, so it renders nothing rather than a guess. */
function getServerSnapshot(): string | null {
  return null;
}

/**
 * Formats an instant in the visitor's zone.
 *
 * Returns null when the zone is unknown or the instant cannot be rendered there,
 * so a caller can omit the line instead of printing a broken one.
 */
export function visitorReading(instant: string, zone: string | null): VisitorReading | null {
  if (zone === null) return null;
  try {
    return { zone, text: formatInstantLong(instant, zone) };
  } catch {
    return null;
  }
}

/** The visitor's IANA time zone, or null before hydration and when unavailable. */
export function useVisitorZone(): string | null {
  return useSyncExternalStore(subscribe, readZone, getServerSnapshot);
}

export interface VisitorTimeProps {
  /** ISO 8601 instant with an explicit offset. */
  instant: string;
  className?: string;
}

export function VisitorTime({ instant, className }: VisitorTimeProps) {
  const zone = useVisitorZone();
  /* Reading the clock during render is pure: the zone is a browser constant for the
     life of the page, so no effect has to write it back into state. */
  const reading = visitorReading(instant, zone);

  if (reading === null) {
    /* Reserve the line so nothing shifts once the zone resolves. */
    return <span className={className} aria-hidden="true" />;
  }

  return (
    <span className={className}>
      {reading.text}
      <span className="tml-tix-sr"> in your time zone, {reading.zone}</span>
    </span>
  );
}
