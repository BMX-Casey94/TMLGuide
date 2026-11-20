/**
 * Landing on an anchor after a client-side navigation.
 *
 * A plain `router.push("/community#partner-x")` does not scroll for you in every
 * case, and it never moves focus. Next's App Router does honour the fragment on
 * a same-page push, but the element it points at may not exist yet: the target
 * page can render inside `<Suspense>`, so the hash resolves against a streamed
 * shell that has no ids in it. This module covers both halves: it waits for the
 * element (up to a second, polling), then scrolls to it, then moves focus into
 * it so a keyboard or screen-reader visitor continues from where the search put
 * them rather than at the top of the page.
 *
 * It is a plain function with no React import, so it can be unit-tested against
 * jsdom directly, and it takes its environment (`document`, `window`) from the
 * global scope that jsdom supplies.
 */

/** How long to keep looking for the target before giving up. */
export const ANCHOR_TIMEOUT_MS = 1000;

/** How often to look while waiting. */
export const ANCHOR_POLL_MS = 50;

/**
 * How far down from the top of the viewport a scrolled-to element must sit.
 *
 * The site header is sticky and 60px on a phone, 68px from 900px up. An element
 * scrolled to `block: "start"` lands at y = 0, underneath it — the heading is
 * there, selected and focused, and invisible. `scroll-margin-top` on the target
 * is the tidier fix and is what `docs/briefs/search-anchors.md` asks the page
 * owners to add; this function compensates for the pages that have not been
 * updated yet, so the behaviour is correct either way and the two agree when
 * both are present.
 *
 * `--header-h` is read first because the anchors doc introduces it as the single
 * source of the header height. Otherwise the sticky header is measured, and
 * otherwise a sane default is used: a wrong value here costs a few pixels of
 * clearance, never a broken scroll.
 */
export function scrollOffset(root: Document = document): number {
  const declared = root.documentElement;
  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const raw = window.getComputedStyle(declared).getPropertyValue("--header-h").trim();
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed + 16;
  }
  const header = root.querySelector<HTMLElement>("header");
  if (header !== null) {
    const rect = header.getBoundingClientRect();
    if (rect.height > 0) return rect.height + 16;
  }
  return 92;
}

/**
 * Nudge the window by `deltaY`, if there is a window that can.
 *
 * Wrapped because jsdom leaves `scrollBy` unimplemented and because an engine
 * with no layout has nothing to move.
 */
function nudgeWindow(deltaY: number): void {
  if (typeof window === "undefined" || typeof window.scrollBy !== "function") return;
  try {
    window.scrollBy({ top: deltaY, behavior: "auto" });
  } catch {
    // No viewport to move; the scroll above is all there is.
  }
}

/** How far the top of `element` sits from the top of the viewport, or null. */
function distanceFromTop(element: HTMLElement): number | null {
  try {
    const top = element.getBoundingClientRect().top;
    return Number.isFinite(top) ? top : null;
  } catch {
    return null;
  }
}

/**
 * Scroll to `element` and make sure it is clear of the sticky header.
 *
 * Two steps, because one cannot do both jobs: `scrollIntoView` is the only way
 * to ask for a smooth scroll that the engine animates, and `scrollBy` is the
 * only way to add an offset to it. With reduced motion the whole thing is an
 * instant reposition, which is also what a smooth-scroll-then-adjust would look
 * like to someone who asked for no motion.
 */
export function scrollClearOfHeader(
  element: HTMLElement,
  options: { readonly reducedMotion: boolean; readonly root?: Document },
): void {
  const root = options.root ?? document;
  const offset = scrollOffset(root);

  try {
    element.scrollIntoView({
      behavior: options.reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  } catch {
    // jsdom has no layout, and some older engines reject the options object.
  }

  if (options.reducedMotion) {
    // Instant: correct the offset now rather than after an animation that is
    // not going to happen.
    const top = distanceFromTop(element);
    if (top !== null && top < offset) nudgeWindow(top - offset);
    return;
  }

  /*
    Smooth: the offset is corrected once the animation has run its course. A
    fixed short delay rather than a scroll listener, because `scrollend` is not
    available everywhere and a listener would have to guess when the sequence is
    over anyway. If the page cannot scroll far enough the element simply stays
    where it is, which is the best the browser can do.
  */
  setTimeout(() => {
    const top = distanceFromTop(element);
    if (top !== null && top < offset) nudgeWindow(top - offset);
  }, SCROLL_SETTLE_MS);
}

/** How long a smooth scroll is given before the header offset is corrected. */
export const SCROLL_SETTLE_MS = 450;

/**
 * How long after focusing a target focus is asserted again.
 *
 * Long enough for a closing native dialog to finish restoring focus to whatever
 * held it before `showModal()`, short enough that a reader does not see the
 * caret move. Not a poll loop: one extra call.
 */
export const FOCUS_REASSERT_MS = 180;

/**
 * True when the visitor has asked for less motion, by system setting or the site's own toggle.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof document !== "undefined") {
    // The site toggle is an explicit request and wins over the media query, the
    // same order `a11y.css` uses.
    if (document.documentElement.dataset.a11yMotion === "reduce") return true;
  }
  if (typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * The id in a URL hash, decoded and validated, or null.
 *
 * `decodeURIComponent` can throw on a malformed escape (`#%`), and a hash can
 * carry anything a person typed, so this never assumes it is well formed. The
 * value is only ever passed to `getElementById`, never to a selector, so there
 * is no injection surface — but an empty or absurdly long value is refused
 * anyway rather than searched for.
 */
export function hashId(hash: string): string | null {
  if (typeof hash !== "string") return null;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (raw === "") return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded === "" || decoded.length > 200) return null;
  return decoded;
}

/** An element that can hold focus: anything a browser will focus, plus a heading with tabindex. */
function isFocusable(element: HTMLElement): boolean {
  if (element.hasAttribute("tabindex")) return true;
  if (element.isContentEditable) return true;
  const name = element.tagName;
  if (name === "A" || name === "AREA") return element.hasAttribute("href");
  if (name === "BUTTON" || name === "SELECT" || name === "TEXTAREA") return true;
  if (name === "INPUT") return (element as HTMLInputElement).type !== "hidden";
  return false;
}

/**
 * Move focus to `element` without letting it scroll again.
 *
 * A heading, a table row or a card is not focusable, so it gets `tabindex="-1"`
 * first: that makes it a programmatic focus target without adding a tab stop.
 * The attribute is left in place afterwards — removing it while it still has
 * focus would drop the visitor back to `<body>`.
 */
export function focusTarget(element: HTMLElement): void {
  if (!isFocusable(element)) element.setAttribute("tabindex", "-1");
  try {
    element.focus({ preventScroll: true });
  } catch {
    // A detached or inert element cannot take focus; the scroll still happened.
  }
}

export interface ScrollToHashOptions {
  /** Override the wait, for tests. */
  readonly timeoutMs?: number;
  /** Override the poll interval, for tests. */
  readonly pollMs?: number;
  /** Override the reduced-motion answer, for tests. */
  readonly reducedMotion?: boolean;
  /** Override the document, for tests. */
  readonly root?: Document;
}

/**
 * Scroll to `hash` (with or without `#`) and focus the element, waiting up to
 * {@link ANCHOR_TIMEOUT_MS} for it to appear.
 *
 * Resolves with the element it reached, or null when nothing with that id
 * rendered in time. It never rejects: a missing anchor is a normal outcome (the
 * page may simply not have been updated yet), and the caller's job is to carry
 * on rather than to show an error.
 *
 * `scroll-behavior` is set explicitly rather than inherited: `globals.css` sets
 * `scroll-behavior: smooth` on `html`, and a smooth scroll is exactly what a
 * reduced-motion visitor asked not to have. The explicit `auto` also survives
 * the `!important` rule in `a11y.css` because this is an inline call option, not
 * a CSS declaration.
 */
export function scrollToHash(
  hash: string,
  options: ScrollToHashOptions = {},
): Promise<HTMLElement | null> {
  const id = hashId(hash);
  if (id === null) return Promise.resolve(null);

  const root = options.root ?? (typeof document === "undefined" ? null : document);
  if (root === null) return Promise.resolve(null);

  const timeoutMs = options.timeoutMs ?? ANCHOR_TIMEOUT_MS;
  const pollMs = options.pollMs ?? ANCHOR_POLL_MS;

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (element: HTMLElement | null) => {
      if (timer !== null) clearTimeout(timer);
      resolve(element);
    };

    const attempt = () => {
      const found = root.getElementById(id);
      const element = found instanceof HTMLElement ? found : null;

      if (element === null) {
        if (Date.now() >= deadline) {
          settle(null);
          return;
        }
        timer = setTimeout(attempt, pollMs);
        return;
      }

      const reduced = options.reducedMotion ?? prefersReducedMotion();
      // Scrolls, then corrects for the sticky header so the target is not hidden
      // underneath it. See `scrollClearOfHeader`.
      scrollClearOfHeader(element, { reducedMotion: reduced, root });

      /*
        Focus, and it has to win.

        Three things can steal it back: the palette restoring focus to its
        trigger, a native `<dialog>` restoring focus to whatever was focused
        before `showModal()` — which the browser does asynchronously on close, so
        it lands *after* this call on a phone — and the router's own focus
        handling on a route push. One call is therefore not enough. Focus is set
        immediately, on the next frame, and once more shortly after, each with
        `preventScroll` so none of them cancels the smooth scroll above.

        Repeating the call cannot produce a focus loop: `focusTarget` is
        idempotent, and nothing here listens for focus.
      */
      focusTarget(element);
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => focusTarget(element));
      }
      setTimeout(() => focusTarget(element), FOCUS_REASSERT_MS);
      settle(element);
    };

    attempt();
  });
}
