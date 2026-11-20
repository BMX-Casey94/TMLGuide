/**
 * Landing on an anchor after a client-side navigation.
 *
 * A plain `router.push("/community#partner-x")` does not scroll for you in every
 * case, and it never moves focus. Next's App Router does honour the fragment on
 * a same-page push, but the element it points at may not exist yet: the target
 * page can render inside `<Suspense>`, so the hash resolves against a streamed
 * shell that has no ids in it, and a tabbed page may keep the record inside a
 * panel that is `hidden` or not mounted at all. This module covers the whole
 * landing: it wakes a page that only listens for `hashchange`, waits for the
 * element (polling), opens any `<details>` it sits inside, scrolls to it clear of
 * the sticky header, and moves focus into it so a keyboard or screen-reader
 * visitor continues from where the search put them rather than at the top of the
 * page.
 *
 * It is a plain function with no React import, so it can be unit-tested against
 * jsdom directly, and it takes its environment (`document`, `window`) from the
 * global scope that jsdom supplies.
 */

/** How long to keep looking for the target before giving up. */
export const ANCHOR_TIMEOUT_MS = 1000;

/**
 * How often to look while waiting.
 *
 * Also the delay that lets a tab switch finish: a record inside a `[hidden]`
 * panel is found but not reachable, so the poll keeps going until the panel is
 * shown, which is one React render away.
 */
export const ANCHOR_POLL_MS = 50;

/**
 * How often a page is reminded of the hash while the record stays unreachable.
 *
 * A record inside a `[hidden]` panel means no listener acted on an earlier wake:
 * the tab component may not have mounted yet, or the router may have written the
 * hash after the dispatch. Reminding on this cadence is cheap — the listener
 * only re-reads the URL — and it is what lets a late-mounted tab still switch.
 */
export const WAKE_RETRY_MS = 250;

/**
 * How long the address bar is watched for the hash before a wake is abandoned,
 * and how often it is re-read.
 *
 * The router writes the URL while it processes the navigation, so in practice
 * this is a few polls. A caller inside its own poll loop passes `timeoutMs: 0`
 * and gets a single check, because that loop is already the timer.
 */
export const HASH_WAKE_TIMEOUT_MS = 2000;

/** How often the address bar is re-read while waiting for the hash. */
export const HASH_WAKE_POLL_MS = 25;

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

/** The window a document belongs to, or null when there is no browser at all. */
function viewFor(root: Document): Window | null {
  if (typeof window !== "undefined") return window;
  return root.defaultView;
}

/** How far the document is already scrolled, or 0 when the engine will not say. */
function currentScrollY(win: Window): number {
  const value = win.scrollY;
  if (Number.isFinite(value)) return value;
  const legacy = win.pageYOffset;
  return Number.isFinite(legacy) ? legacy : 0;
}

/**
 * True when the engine has a real layout to measure, rather than the all-zero
 * rectangles jsdom reports.
 *
 * All zeros means the element is not laid out at all — a hidden panel, or a test
 * environment — and a document position computed from that would be a guess. Any
 * non-zero dimension or offset proves a layout exists, so an element that happens
 * to sit at the very top of the document is not mistaken for one that was never
 * rendered.
 */
function hasLayout(element: HTMLElement): boolean {
  try {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 || rect.top !== 0;
  } catch {
    return false;
  }
}

/**
 * Move the window so its top edge sits at document position `top`.
 *
 * `scrollTo` is the precise primitive: it takes the position itself, so calling
 * it twice lands in the same place. It is only usable where there is a layout to
 * have measured, which is why `scrollIntoView` runs first and this is the
 * correction; without a layout — jsdom, or an engine that stubbed the method out
 * — the equivalent delta is handed to `scrollBy`, read at the moment of the call
 * so a repeat still resolves to the same position rather than replaying a stale
 * distance.
 */
function moveWindowTo(win: Window, top: number, behavior: ScrollBehavior, absolute: boolean): void {
  if (absolute && typeof win.scrollTo === "function") {
    try {
      win.scrollTo({ top, behavior });
      return;
    } catch {
      // An engine that rejects the options object may still take the delta form.
    }
  }

  const delta = top - currentScrollY(win);
  if (typeof win.scrollBy !== "function") return;
  try {
    win.scrollBy({ top: delta, behavior });
  } catch {
    // No viewport to move; the `scrollIntoView` above is all there is.
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
 * `scrollIntoView` asks for the scroll (and provides the only way to request a
 * smooth one that the engine animates); it cannot express the header offset, so
 * the resting position is then corrected to an exact document position,
 * `scrollY + rect.top - offset`. Computing the target rather than nudging by a
 * delta is what makes the landing reliable when `scrollIntoView` was clipped by
 * the end of the document or interrupted by a competing scroll: whatever
 * position the first call reached, the correction still resolves to the same
 * place.
 *
 * With reduced motion the whole thing is one instant reposition, which is also
 * what a smooth-scroll-then-adjust would look like to someone who asked for no
 * motion.
 */
export function scrollClearOfHeader(
  element: HTMLElement,
  options: { readonly reducedMotion: boolean; readonly root?: Document },
): void {
  const root = options.root ?? document;
  const win = viewFor(root);
  const offset = scrollOffset(root);
  const behavior: ScrollBehavior = options.reducedMotion ? "auto" : "smooth";

  try {
    element.scrollIntoView({ behavior, block: "start" });
  } catch {
    // jsdom has no layout, and some older engines reject the options object.
  }

  /**
   * Put the element `offset` pixels below the top of the viewport.
   *
   * `scrollY + rect.top` is the element's position in the document, measured at
   * the moment of the call, so this corrects whatever `scrollIntoView` managed
   * — including the case where it was clipped by the end of the document or
   * interrupted by a competing scroll. The correction itself is instant: the
   * motion the reader asked for has already happened, and animating the last 90
   * pixels would be a second scroll they did not ask for.
   */
  const settle = () => {
    const top = distanceFromTop(element);
    if (top === null || win === null) return;
    const target = Math.max(0, currentScrollY(win) + top - offset);
    moveWindowTo(win, target, "auto", hasLayout(element));
  };

  if (options.reducedMotion) {
    settle();
    return;
  }

  /*
    Smooth: the offset is corrected once the animation has run its course. A
    fixed short delay rather than a scroll listener, because `scrollend` is not
    available everywhere and a listener would have to guess when the sequence is
    over anyway. If the page cannot scroll far enough the element simply stays
    where it is, which is the best the browser can do.
  */
  setTimeout(settle, SCROLL_SETTLE_MS);
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

/**
 * Tell a page that only listens for `hashchange` that the address now names
 * `hash`.
 *
 * The App Router navigates with `history.pushState`, and a push — even to a URL
 * with a fragment — fires no `hashchange` at all. `CommunityHub` and
 * `SaleTimelineTabs` keep their selected tab in the URL and only re-read it when
 * that event arrives, so a same-page search result would leave the record inside
 * a `[hidden]` panel, or inside a tab that is not mounted, and the landing would
 * have nothing to land on.
 *
 * The event is dispatched only once `window.location.hash` really does name this
 * anchor: a listener woken on the old hash would read the previous tab, or a hash
 * that is not a tab at all. The router writes the hash as part of the push, which
 * can be a frame after the call returns, so the address is given a bounded wait
 * rather than being trusted to be ready. `timeoutMs: 0` means one check, for a
 * caller that is already polling.
 *
 * Returns a cancel handle. A caller that abandons the navigation — the reader
 * dismisses the palette, or a second attempt starts — calls it so no timer keeps
 * ticking towards an event nobody wants.
 */
export function wakeHashListeners(
  hash: string,
  options: { readonly root?: Document; readonly timeoutMs?: number } = {},
): () => void {
  const noop = () => {};
  const id = hashId(hash);
  if (id === null) return noop;

  const root = options.root ?? (typeof document === "undefined" ? null : document);
  if (root === null) return noop;
  const win = viewFor(root);
  if (win === null) return noop;

  const deadline = Date.now() + (options.timeoutMs ?? HASH_WAKE_TIMEOUT_MS);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let done = false;

  const check = () => {
    timer = null;
    if (done) return;
    if (hashId(win.location.hash) === id) {
      done = true;
      win.dispatchEvent(new Event("hashchange"));
      return;
    }
    if (Date.now() >= deadline) {
      done = true;
      return;
    }
    timer = setTimeout(check, HASH_WAKE_POLL_MS);
  };

  check();

  return () => {
    done = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}

/**
 * A record that is in the document but not yet reachable.
 *
 * A tabbed page keeps its inactive sections mounted with `hidden`, so the
 * element exists while nothing can be scrolled to or focused. Treating that as
 * "found" would focus an invisible record and end the wait; treating it as "not
 * yet" lets the tab switch that `wakeHashListeners` triggered finish first.
 */
function isHidden(element: HTMLElement): boolean {
  try {
    return element.closest("[hidden]") !== null;
  } catch {
    // A detached element cannot be inside anything; it is still not reachable.
    return true;
  }
}

/**
 * Open `element` and every closed `<details>` it sits inside.
 *
 * An FAQ answer on `/guides` is a `<details>` element whose id is the anchor, so
 * linking to it landed on a collapsed summary: the reader arrived at a row they
 * had to open themselves. Opening the target and its ancestors keeps the
 * landing honest, and has to happen before the scroll so the position is
 * measured against the expanded layout.
 */
function openDetails(element: HTMLElement): void {
  const Details = typeof HTMLDetailsElement === "undefined" ? null : HTMLDetailsElement;
  if (Details === null) return;

  if (element instanceof Details) element.open = true;
  let ancestor = element.parentElement;
  while (ancestor !== null) {
    if (ancestor instanceof Details) ancestor.open = true;
    ancestor = ancestor.parentElement;
  }
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
 * {@link ANCHOR_TIMEOUT_MS} for it to appear — and, when it is present but
 * inside a `[hidden]` panel, for the tab switch it triggered to show it.
 *
 * Resolves with the element it reached, or null when nothing with that id
 * rendered in time, or when its panel never became visible. It never rejects: a
 * missing anchor is a normal outcome (the page may simply not have been updated
 * yet), and the caller's job is to carry on rather than to show an error.
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

  /* One wake before the first look: a tabbed page holding the record in a
     `[hidden]` panel exposes nothing until it hears the new hash, and the tab
     switch then needs a render before the poll can find the element. The wake
     is capped by this call's own time, so nothing is left polling after the
     landing has given up, and it is cancelled on every exit path. */
  let cancelWake = wakeHashListeners(hash, {
    root,
    timeoutMs: Math.min(timeoutMs, HASH_WAKE_TIMEOUT_MS),
  });
  let lastWake = Date.now();

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (element: HTMLElement | null) => {
      if (timer !== null) clearTimeout(timer);
      cancelWake();
      cancelWake = () => {};
      resolve(element);
    };

    const attempt = () => {
      const found = root.getElementById(id);
      const element = found instanceof HTMLElement ? found : null;

      if (element === null || isHidden(element)) {
        /* The record is there but its panel is not, or it has not rendered at
           all. Either way a page that only listens for `hashchange` may still be
           the reason, so it is reminded — at a calm cadence, with a single
           check, since this loop is the timer. */
        if (Date.now() - lastWake >= WAKE_RETRY_MS) {
          lastWake = Date.now();
          cancelWake();
          cancelWake = wakeHashListeners(hash, { root, timeoutMs: 0 });
        }

        if (Date.now() >= deadline) {
          settle(null);
          return;
        }
        timer = setTimeout(attempt, pollMs);
        return;
      }

      // Before measuring: a collapsed answer has no height to scroll to.
      openDetails(element);

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
