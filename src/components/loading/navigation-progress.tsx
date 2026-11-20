"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getNavigationState,
  settleNavigation,
  startNavigation,
  subscribeToNavigation,
} from "./navigation-store";

/** How long a navigation may take before the bar is worth showing. */
export const PROGRESS_DELAY_MS = 150;

/**
 * A hard stop, so a navigation that never resolves cannot leave a bar running for
 * ever. Generous: a slow 3G page can genuinely take this long, and the bar is
 * indeterminate rather than a promise of progress.
 */
export const PROGRESS_MAX_MS = 15_000;

/**
 * Should this click start the progress bar?
 *
 * Only a plain left click on a same-origin link that actually changes the
 * document's address. Everything else is either not a navigation (a hash-only
 * link, a `mailto:`, a download) or one the browser handles itself (`target`,
 * `download`, a modified click opening a new tab), and a bar in those cases
 * would be a lie that has nothing to clear it.
 *
 * Exported for tests: the decision is the interesting part, and it is easier to
 * assert on than the pixels.
 */
export function shouldTrackClick(anchor: HTMLAnchorElement, event: MouseEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const target = anchor.getAttribute("target");
  if (target !== null && target !== "" && target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const rel = anchor.getAttribute("rel") ?? "";
  if (/\bexternal\b/.test(rel)) return false;

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  // `mailto:`, `tel:` and anything else with another scheme resolves to a
  // different origin, but a same-origin check alone would not catch a protocol
  // the parser keeps relative.
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  // A hash-only link scrolls the page; it does not fetch a route.
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return false;
  }

  return true;
}

/**
 * The thin indeterminate bar at the top of the page.
 *
 * It exists because the owner reported the opposite of progress: a modal closing
 * and a blank wait with nothing to say the click had registered. The bar answers
 * "did that work?" within a fifth of a second, and never appears at all for a
 * navigation that finishes faster than that — the flash of a bar for a 40ms
 * cached route is more distracting than no bar.
 *
 * Accessibility: it is `aria-hidden`, because a progress bar that is genuinely
 * indeterminate has nothing to report, and a live region announcing "loading"
 * for every navigation is noise. A screen reader learns about a page change from
 * the new page itself (Next moves focus to the document and announces the title
 * on a route push). The one place a spoken message belongs is the palette, where
 * the reader is waiting on a specific result and gets "Opening…" plus a failure
 * message if it does not arrive.
 *
 * No layout shift: the bar is `position: fixed` with no space reserved for it,
 * and it never changes the flow of the page.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const [visible, setVisible] = useState(false);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (delayRef.current !== null) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (maxRef.current !== null) {
      clearTimeout(maxRef.current);
      maxRef.current = null;
    }
  };

  /* The store says a navigation started; this decides whether it lasts long
     enough to be worth showing. */
  useEffect(() => {
    return subscribeToNavigation(() => {
      const pending = getNavigationState().href !== null;

      if (!pending) {
        clearTimers();
        setVisible(false);
        return;
      }

      if (delayRef.current !== null || maxRef.current !== null) return;
      delayRef.current = setTimeout(() => {
        delayRef.current = null;
        setVisible(true);
      }, PROGRESS_DELAY_MS);
      maxRef.current = setTimeout(() => {
        maxRef.current = null;
        settleNavigation();
      }, PROGRESS_MAX_MS);
    });
  }, []);

  /*
    The router settling. A pathname or search change is the only reliable signal
    that the new page is live; a hash change alone is not a navigation and does
    not move either value, so an anchor link never starts the bar in the first
    place (see `shouldTrackClick`).
  */
  useEffect(() => {
    settleNavigation();
  }, [pathname, search]);

  /*
    Click interception, in the capture phase.

    Capture matters: a link may have its own click handler that calls
    `preventDefault` and does something else, and by the time the event bubbles
    the decision is already made. In capture the bar starts before anyone can
    cancel — which is right, because a cancelled click costs at most 150ms of a
    bar that then clears on the next tick.
  */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!shouldTrackClick(anchor, event)) return;
      startNavigation(anchor.href);
      // A handler further down may preventDefault; clear on the next task if so.
      setTimeout(() => {
        if (event.defaultPrevented) settleNavigation();
      }, 0);
    };

    /* A navigation the browser aborts (the visitor presses Escape, or clicks a
       third time) fires `popstate` with no route change on some engines; a
       beforeunload is a full document load, where the bar dies with the page. */
    const onAbort = () => settleNavigation();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onAbort);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onAbort);
    };
  }, []);

  useEffect(() => clearTimers, []);

  if (!visible) return null;

  return (
    <div className="tml-progress" aria-hidden="true">
      <span className="tml-progress__bar" />
    </div>
  );
}
