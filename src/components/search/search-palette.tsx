"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { CheckSeparator } from "@/components/ui/source-check";
import { flattenGroups, groupResults } from "@/lib/search/group";
import { formatCheckedDate } from "@/lib/search/format";
import { search } from "@/lib/search/rank";
import {
  addRecentSearch,
  clearRecentSearches,
  readRecentSearches,
} from "@/lib/search/recent";
import { queryTokens } from "@/lib/search/text";
import type { EditionScope, SearchEntry } from "@/lib/search/types";
import { cx } from "@/components/ui/cx";
import { Spinner } from "@/components/loading/spinner";
import { settleNavigation, startNavigation } from "@/components/loading/navigation-store";
import { Highlight } from "./highlight";
import { scrollToHash, wakeHashListeners } from "./scroll-to-hash";
import { NAVIGATION_TIMEOUT_MS, waitForNavigation } from "./wait-for-navigation";
import "./search-palette.css";

/** Attribute that marks any element able to open the palette. */
export const SEARCH_TRIGGER_ATTRIBUTE = "data-search-trigger";

/**
 * Quick links offered before anything is typed. Every href below is a route the
 * site renders today, and the labels are each page's own title.
 */
export const QUICK_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/guides/tickets", label: "Tickets and packages" },
  { href: "/tools/sale-timeline", label: "Ticket sale timeline" },
  { href: "/tools/budget", label: "Festival budget calculator" },
  { href: "/tools/pearls", label: "Pearl calculator" },
  { href: "/community", label: "Community" },
  { href: "/radio", label: "One World Radio" },
];

/** Suggestions offered when a query matches nothing. */
export const NO_RESULT_SUGGESTIONS = ["tickets", "dreamville", "pearls", "winter"] as const;

/**
 * Elements that can receive focus inside the dialog, in tab order.
 *
 * Result rows are anchors with `tabindex="-1"`: they are reachable with the
 * arrow keys, not with Tab, so including them would make the Tab trap compute
 * the wrong "last" element and let focus escape the top layer.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface SearchPaletteProps {
  /** The index to search. Built on the server and passed down as data. */
  index: readonly SearchEntry[];
  /** Navigate to an internal route. Receives the plain, locale-free href. */
  navigate: (href: string) => void;
  /**
   * The edition to boost, read when the palette opens.
   *
   * A callback rather than a value: the answer depends on the address at the
   * moment of opening, and reading it then is both cheaper and more accurate
   * than subscribing to the pathname for a dialog that is usually shut.
   */
  resolveEdition?: () => EditionScope | null;
  /** Maximum results to show. */
  limit?: number;
}

function isTextEntry(
  element: Element | null,
): element is HTMLInputElement | HTMLTextAreaElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

/**
 * Clear a field the way a user would, so a controlled React input elsewhere on
 * the page updates its own state instead of snapping the value back.
 */
function clearField(field: HTMLInputElement | HTMLTextAreaElement): void {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(field, "");
  else field.value = "";
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

/** A source URL reduced to its host, so the footer stays on one line. */
function sourceHost(url: string | undefined): string | null {
  if (url === undefined) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // A malformed URL is a data problem, not a reason to break the palette.
    return null;
  }
}

/**
 * "18 Nov 2026", or null when the entry carries no usable date.
 *
 * The shared formatter throws on anything that is not a real calendar date, so a
 * bad value in the data would take the whole palette down. Provenance is a
 * footnote: the honest failure is to leave the date out, not to break the search.
 */
function checkedDateOrNull(iso: string | undefined): string | null {
  if (iso === undefined) return null;
  try {
    return formatCheckedDate(iso);
  } catch {
    return null;
  }
}

export function SearchPalette({
  index,
  navigate,
  resolveEdition,
  limit = 12,
}: SearchPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const triggerListenersRef = useRef<{ attach: () => void; detach: () => void } | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  /**
   * Captured when the palette opens. Held in state rather than read during
   * render so the result set cannot change while the dialog is open, and so the
   * server-rendered markup (which has no window to read) matches the first
   * client render exactly.
   */
  const [edition, setEdition] = useState<EditionScope | null>(null);
  /**
   * The row the visitor has chosen, waiting for the page to arrive.
   *
   * `id` is the result's id — or a `quick:` key for a quick link — so exactly one
   * row shows the spinner. `href` is kept so a retry can reuse it.
   */
  const [pending, setPending] = useState<{ id: string; href: string } | null>(null);
  /** True when the last attempt gave up: the page did not open. */
  const [failed, setFailed] = useState(false);
  /* Bumped on every attempt, so a late resolution from an abandoned navigation
     cannot close a palette that has since been reopened. */
  const attemptRef = useRef(0);

  /**
   * The cancel handle for the wake sent alongside the most recent attempt.
   *
   * A wake is a timer, and a navigation the reader abandons — Escape, a new
   * search, a second result — must not leave one running towards an event nobody
   * wants. Cancelled in `close()` and before each new attempt, which are the two
   * ways an attempt ends.
   */
  const cancelWakeRef = useRef<() => void>(() => {});

  /* Mirrors `isOpen` synchronously. A trigger fires `focusin` before `click`,
   * so the two handlers must not both act; a state read is flushed later than
   * this check needs it. */
  const isOpenRef = useRef(false);

  /**
   * The anchor a chosen result asked to land on, held until the palette has
   * actually closed.
   *
   * The landing cannot happen at click time. While the dialog is open the page
   * behind it is inert and `document.body.style.overflow` is `hidden`, so a
   * `scrollIntoView` or a `scrollBy` against it is silently dropped; the scroll
   * has to wait until `dialog.close()` and the scroll-lock cleanup have both run.
   * A ref rather than state because it is consumed by an effect exactly once and
   * must not cause a render of its own.
   */
  const pendingAnchorRef = useRef<string | null>(null);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const labelId = `${baseId}-label`;
  const statusId = `${baseId}-status`;
  const hintId = `${baseId}-hint`;

  const results = useMemo(
    () => search(query, { index, edition, limit }),
    [query, index, edition, limit],
  );
  const groups = useMemo(() => groupResults(results), [results]);
  const options = useMemo(() => flattenGroups(groups), [groups]);
  const tokens = useMemo(() => queryTokens(query), [query]);

  const trimmedQuery = query.trim();
  const showResults = trimmedQuery.length > 0;
  const showListbox = showResults && options.length > 0;

  /* ---------------------------------------------------------------- open */

  /**
   * The single entry point for opening. `trigger` is the element that was
   * activated, when there was one, so focus can go back to it on close.
   */
  const openWith = useCallback(
    (seed: string, trigger?: HTMLElement | null) => {
      const dialog = dialogRef.current;
      if (isOpenRef.current || dialog?.open) return;
      isOpenRef.current = true;

      // Captured before any blur, so an input trigger is still the active element.
      const active = document.activeElement;
      restoreFocusRef.current =
        trigger ?? (active instanceof HTMLElement && active !== document.body ? active : null);

      setRecent(readRecentSearches());
      setEdition(resolveEdition ? resolveEdition() : null);
      setQuery(seed);
      setActiveIndex(0);
      // A fresh opening starts with no navigation in flight, no stale error and
      // no anchor left over from the last result that was chosen.
      attemptRef.current += 1;
      pendingAnchorRef.current = null;
      cancelWakeRef.current();
      cancelWakeRef.current = () => {};
      setPending(null);
      setFailed(false);
      setIsOpen(true);
    },
    [resolveEdition],
  );

  /**
   * The single entry point for closing. Every path out of the palette goes
   * through here — Escape, the close button, the backdrop, a chosen result, a
   * quick link — so the guard, the state and the focus restore cannot drift
   * apart between them.
   */
  const close = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
    /* Any wait still running is abandoned: its late resolution must not touch a
       palette that has since been closed or reopened. The store is cleared too,
       so the progress bar does not outlive a dismissed palette. */
    attemptRef.current += 1;
    cancelWakeRef.current();
    cancelWakeRef.current = () => {};
    setPending(null);
    setFailed(false);
    settleNavigation();
  }, []);

  /* Mirror state onto the native dialog, which supplies the top layer, makes
   * the rest of the page inert and blocks background scroll on its own. */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");

      const input = inputRef.current;
      if (input) {
        input.focus();
        // Put the caret after any seeded text, so typing appends to what the
        // visitor already wrote in the header field.
        const end = input.value.length;
        try {
          input.setSelectionRange(end, end);
        } catch {
          // Some input types reject selection APIs; focus alone is enough.
        }
      }
    } else if (!isOpen && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [isOpen]);

  /* Restore focus on close.
   *
   * The trigger listeners are detached around the focus call. The header field
   * carries `data-search-trigger`, so focusing it would otherwise reopen the
   * palette that was just closed — the "Escape then immediately back in" loop
   * this guard exists to prevent.
   *
   * Not after a navigation. The visitor chose a result and is being delivered to
   * a page; putting focus back on the header field would put them at the top of
   * a page they did not ask to be at the top of, and it races the anchor landing
   * that moves focus to the record. `navigatingRef` records that case. */
  const navigatingRef = useRef(false);
  useEffect(() => {
    if (isOpen) return;
    const navigating = navigatingRef.current;
    navigatingRef.current = false;

    const target = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (navigating || !target || !target.isConnected) return;

    const listeners = triggerListenersRef.current;
    listeners?.detach();
    target.focus({ preventScroll: true });
    listeners?.attach();
  }, [isOpen]);

  /* Scroll lock for the page behind, with scrollbar compensation so the layout
   * does not jump sideways as the bar disappears. */
  useEffect(() => {
    if (!isOpen) return;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [isOpen]);

  /**
   * Land on the chosen record — once the palette is really gone.
   *
   * This effect exists for its position in the file. Effects run in declaration
   * order, and React runs every cleanup before any effect body when a dependency
   * changes, so by the time this one runs: the dialog-close effect above has
   * called `dialog.close()` (releasing the top layer and the inert background),
   * the scroll-lock cleanup has restored `document.body.style.overflow`, and the
   * router has already been asked for the page.
   *
   * Landing at click time instead — as an earlier version did, synchronously
   * after `setIsOpen(false)` — was silently dropped on a real browser: the body
   * was still `overflow: hidden` and the page was still inert, so
   * `scrollIntoView` and `scrollBy` were both ignored and the visitor arrived at
   * the top of the page.
   *
   * A frame is given back first, so the scroll is measured against the page as
   * it is after the dialog has gone rather than during the same commit.
   */
  useEffect(() => {
    if (isOpen) return;
    const anchor = pendingAnchorRef.current;
    if (anchor === null) return;
    // Consumed immediately: a later close must not replay this landing.
    pendingAnchorRef.current = null;

    const land = () => {
      void scrollToHash(anchor, { timeoutMs: NAVIGATION_TIMEOUT_MS });
    };

    if (typeof requestAnimationFrame === "function") requestAnimationFrame(land);
    else land();
  }, [isOpen]);

  /* A native `cancel` (Escape, and the dismiss gesture on some platforms) and a
   * native `close` change the element without going through `close()`, so both
   * are funnelled back through it here. That keeps one exit path: the guard, the
   * state and the focus restore cannot drift apart between them. */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onNativeClose = () => close();

    dialog.addEventListener("close", onNativeClose);
    dialog.addEventListener("cancel", onNativeClose);
    return () => {
      dialog.removeEventListener("close", onNativeClose);
      dialog.removeEventListener("cancel", onNativeClose);
    };
  }, [close]);

  /* ------------------------------------------------ global open triggers */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // Ctrl+K / Cmd+K fires everywhere, including inside another input: it is
      // the shortcut, not incidental typing.
      const isShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "k";
      if (!isShortcut) return;
      event.preventDefault();
      openWith("");
    };

    const onTrigger = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Never react to anything inside the open dialog itself.
      if (target.closest("dialog[open]")) return;

      const trigger = target.closest(`[${SEARCH_TRIGGER_ATTRIBUTE}]`);
      if (!(trigger instanceof HTMLElement)) return;
      if (dialogRef.current?.open) return;

      const seed = isTextEntry(trigger) ? trigger.value : "";

      if (isTextEntry(trigger) && trigger.value) clearField(trigger);
      trigger.blur();
      openWith(seed, trigger);
    };

    const attach = () => {
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("click", onTrigger);
      document.addEventListener("focusin", onTrigger);
    };
    const detach = () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onTrigger);
      document.removeEventListener("focusin", onTrigger);
    };

    triggerListenersRef.current = { attach, detach };
    attach();

    return () => {
      detach();
      triggerListenersRef.current = null;
    };
  }, [openWith]);

  /* -------------------------------------------------------- interactions */

  const go = useCallback(
    (id: string, href: string) => {
      if (isOpenRef.current === false || pending !== null) return;
      if (trimmedQuery) setRecent(addRecentSearch(trimmedQuery));

      setFailed(false);
      setPending({ id, href });

      const attempt = attemptRef.current + 1;
      attemptRef.current = attempt;
      const anchor = href.includes("#") ? href.slice(href.indexOf("#")) : null;
      const from = { pathname: window.location.pathname, search: window.location.search };

      startNavigation(href);
      try {
        navigate(href);
      } catch {
        settleNavigation();
        setPending(null);
        setFailed(true);
        return;
      }

      /*
        Wake a page whose selected tab lives in the URL, and do it now rather
        than at landing time.

        `router.push` uses `history.pushState`, which fires no `hashchange`, so
        `/community` and `/tools/sale-timeline` would never learn about a
        same-page result and would keep the record inside a panel that is hidden
        or not mounted. That is also why it has to happen before the arrival
        check below: on the sale timeline the record does not exist until the tab
        switches, and the arrival check is waiting for exactly that element. The
        call waits for the router to write the hash — for as long as the
        navigation itself is allowed — and only then dispatches, so the listener
        never reads a stale tab. The handle is kept so `close()` can stop it.
      */
      cancelWakeRef.current();
      cancelWakeRef.current =
        anchor === null
          ? () => {}
          : wakeHashListeners(anchor, { timeoutMs: NAVIGATION_TIMEOUT_MS });

      void waitForNavigation(href, { from }).then((arrived) => {
        if (attemptRef.current !== attempt) return;
        settleNavigation();
        /* The wake has served its purpose either way: on success the address
           carries the hash and the tabbed page has already switched (or, on a
           route change, the new page reads the hash when it mounts); on failure
           there is nothing left to announce. */
        cancelWakeRef.current();
        cancelWakeRef.current = () => {};
        if (!arrived) {
          setPending(null);
          setFailed(true);
          return;
        }
        /* Close, but keep the attempt valid: `close()` abandons waits, and this
           one has already succeeded. Focus is not restored to the trigger: the
           reader is being delivered to a record, and `scrollToHash` focuses it.

           The anchor is recorded for the close effect rather than scrolled to
           here. The page behind the dialog is still inert and scroll-locked at
           this instant, so a scroll now would be dropped; the effect that runs
           after `dialog.close()` and the scroll-lock cleanup does the landing. */
        pendingAnchorRef.current = anchor;
        setPending(null);
        navigatingRef.current = true;
        isOpenRef.current = false;
        setIsOpen(false);
      });
    },
    [navigate, pending, trimmedQuery],
  );

  const goToHref = useCallback(
    (href: string) => {
      go(`quick:${href}`, href);
    },
    [go],
  );

  /* A click that lands on the dialog element itself hit the backdrop: the panel
   * fills it, so any click inside targets a descendant. */
  const onDialogClick = useCallback(
    (event: ReactMouseEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) close();
    },
    [close],
  );

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(0);
    // A new query is a fresh start: a previous "did not open" no longer applies.
    setFailed(false);
  }, []);

  const onInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case "ArrowDown":
          if (options.length === 0) return;
          event.preventDefault();
          setActiveIndex((current) => (current + 1) % options.length);
          return;
        case "ArrowUp":
          if (options.length === 0) return;
          event.preventDefault();
          setActiveIndex((current) => (current - 1 + options.length) % options.length);
          return;
        case "Home":
          if (options.length === 0) return;
          event.preventDefault();
          setActiveIndex(0);
          return;
        case "End":
          if (options.length === 0) return;
          event.preventDefault();
          setActiveIndex(options.length - 1);
          return;
        case "Enter": {
          const entry = options[activeIndex];
          if (entry === undefined) return;
          event.preventDefault();
          go(`option:${entry.id}`, entry.href);
          return;
        }
        default:
      }
    },
    [activeIndex, go, options],
  );

  /* Escape closes from anywhere in the dialog. Native dialogs already do this
   * through `cancel`; handling it directly keeps the behaviour identical where
   * that event is not dispatched. Tab is trapped inside the panel so a keyboard
   * user cannot fall out of the top layer into the inert page behind. */
  const onDialogKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDialogElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [close],
  );

  /* Keep the highlighted row visible without scrolling the page behind. */
  useEffect(() => {
    if (!isOpen || options.length === 0) return;
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen, options.length]);

  /* -------------------------------------------------------------- render */

  const activeOption = options[activeIndex];
  const activeOptionId = activeOption ? `${baseId}-option-${activeOption.id}` : undefined;

  const statusMessage = showResults
    ? `${options.length} ${options.length === 1 ? "result" : "results"}`
    : "";

  // Provenance for the highlighted row, shown in the footer. A price or a date
  // in a snippet must name where it came from and the day it was checked. The
  // footer is the only place a source link can sit: nesting one inside the
  // row's own anchor would be invalid HTML and unusable by keyboard.
  const activeChecked = checkedDateOrNull(activeOption?.lastVerified);
  const activeSourceUrl = activeOption?.sourceUrl;
  const activeHost = sourceHost(activeSourceUrl);

  let optionCursor = -1;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelId}
      onClick={onDialogClick}
      onKeyDown={onDialogKeyDown}
      // The panel inside centres itself in the viewport. `m-auto` centres a
      // dialog that has a size; on a phone the panel is full-bleed, so it takes
      // the whole viewport instead.
      //
      // `tml-search-dialog` removes the global focus outline from this element
      // only: it is focused programmatically as a scroll container and focus
      // trap, and a square ring around a rounded panel is not a control anyone
      // activated. See search-palette.css.
      className="tml-search-dialog fixed inset-0 z-[100] m-auto w-[calc(100%-2rem)] max-w-[640px] border-0 bg-transparent p-0 text-cream backdrop:bg-ground/80 backdrop:backdrop-blur-sm max-sm:h-full max-sm:max-h-none max-sm:w-full max-sm:max-w-none"
    >
      <div className="flex max-h-[min(86dvh,660px)] flex-col overflow-hidden rounded-panel border border-hair bg-surface shadow-[0_40px_120px_-40px_rgb(0_0_0/0.95)] max-sm:h-full max-sm:max-h-none max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0">
        <h2 id={labelId} className="sr-only">
          Search TMLGUIDE
        </h2>

        {/* The focus indicator for the field: the row turns accent and gains a
            halo while anything inside it has focus. The field itself draws
            nothing, so no square appears inside the rounded row. */}
        <div className="tml-search-head flex items-center gap-3 border-b border-hair px-4 py-3 sm:px-5">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            className="h-4 w-4 shrink-0 text-cream-mute"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m12.9 12.9 4 4" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showListbox}
            aria-controls={showListbox ? listboxId : undefined}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-labelledby={labelId}
            aria-describedby={hintId}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Search tickets, dates, DreamVille, community…"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            className="tml-search-field min-w-0 flex-1 bg-transparent py-2 text-base text-cream"
          />

          <kbd
            aria-hidden="true"
            className="tml-search-escape label hidden shrink-0 rounded border border-hair px-1.5 py-0.5 text-cream-mute sm:block"
          >
            Esc
          </kbd>

          <button
            type="button"
            onClick={close}
            className="tml-search-close flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-cream-mute transition-colors hover:text-cream sm:hidden"
          >
            <span className="sr-only">Close search</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <p id={statusId} role="status" aria-live="polite" className="sr-only">
          {statusMessage}
        </p>

        {/* A stable description for the combobox. It must not change as the
         * highlight moves: a description that names the current row would be
         * re-announced on every arrow key, which is exhausting. The visible
         * footer below carries the per-row provenance instead. */}
        <p id={hintId} className="sr-only">
          Type to search. Choose a result to open it. Escape closes the search.
        </p>

        <div
          ref={listRef}
          id={listboxId}
          role={showListbox ? "listbox" : undefined}
          aria-labelledby={showListbox ? labelId : undefined}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {showListbox &&
            groups.map((group) => (
              /* A group inside a listbox may contain options and nothing else,
               * so the visible heading is hidden from the accessibility tree and
               * the group's name is supplied through `aria-label`. The reader
               * still hears the heading as the group is entered, and the
               * structure stays valid. */
              <div key={group.kind} role="group" aria-label={group.label}>
                <p
                  aria-hidden="true"
                  className="label sticky top-0 z-10 border-b border-hair bg-surface-2/95 px-4 py-2 text-cream-mute backdrop-blur-sm sm:px-5"
                >
                  {group.label}
                </p>
                {group.entries.map((entry) => {
                  optionCursor += 1;
                  const index = optionCursor;
                  const selected = index === activeIndex;
                  const pendingRow = pending !== null && pending.id === `option:${entry.id}`;
                  const busy = pending !== null;
                  return (
                    <a
                      key={entry.id}
                      id={`${baseId}-option-${entry.id}`}
                      data-index={index}
                      data-pending={pendingRow ? "true" : undefined}
                      role="option"
                      aria-selected={selected}
                      aria-busy={pendingRow || undefined}
                      href={entry.href}
                      tabIndex={-1}
                      onClick={(event) => {
                        // A modified click means "open elsewhere": let the
                        // anchor do what the browser would normally do.
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey ||
                          event.button !== 0
                        ) {
                          close();
                          return;
                        }
                        event.preventDefault();
                        go(`option:${entry.id}`, entry.href);
                      }}
                      onMouseMove={() => {
                        if (!selected) setActiveIndex(index);
                      }}
                      aria-disabled={busy ? true : undefined}
                      className={cx(
                        "tml-search-option flex min-h-14 items-start gap-3 border-l-2 px-4 py-3 transition-colors max-sm:min-h-16 sm:px-5",
                        selected
                          ? "border-accent bg-surface-2"
                          : "border-transparent hover:bg-surface-2/60",
                        busy && !pendingRow && "opacity-60",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="tml-search-option__label block text-sm leading-snug font-medium text-cream">
                          <Highlight text={entry.title} tokens={tokens} />
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-cream-mute">
                          {pendingRow ? (
                            "Opening…"
                          ) : (
                            <Highlight text={entry.snippet} tokens={tokens} />
                          )}
                        </span>
                      </span>
                      {pendingRow ? <Spinner size="inline" /> : null}
                    </a>
                  );
                })}
              </div>
            ))}

          {showResults && options.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-cream">No results for “{trimmedQuery}”.</p>
              <p className="mx-auto mt-2 max-w-[42ch] text-xs leading-relaxed text-cream-mute">
                Try a shorter term, a ticket name, or an edition such as Belgium, Winter or Brasil.
              </p>
              <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {NO_RESULT_SUGGESTIONS.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => changeQuery(suggestion)}
                      className="min-h-11 rounded-full border border-hair px-4 text-xs text-cream-mute transition-colors hover:border-hair-strong hover:text-cream"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!showResults && (
            <div className="px-4 py-5 sm:px-5">
              {recent.length > 0 && (
                <section aria-labelledby={`${baseId}-recent`}>
                  <div className="flex items-center justify-between gap-4">
                    <p id={`${baseId}-recent`} className="label text-cream-mute">
                      Recent
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentSearches();
                        setRecent([]);
                      }}
                      className="min-h-11 px-2 text-xs text-cream-mute transition-colors hover:text-accent"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {recent.map((item) => (
                      <li key={item}>
                        <button
                          type="button"
                          onClick={() => changeQuery(item)}
                          className="min-h-11 rounded-full border border-hair bg-surface-2 px-4 text-xs text-cream transition-colors hover:border-accent/60"
                        >
                          {item}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section
                aria-labelledby={`${baseId}-quick`}
                className={recent.length > 0 ? "mt-6" : undefined}
              >
                <p id={`${baseId}-quick`} className="label text-cream-mute">
                  Quick links
                </p>
                <ul className="mt-2">
                  {QUICK_LINKS.map((link) => {
                    const quickPending = pending !== null && pending.id === `quick:${link.href}`;
                    return (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          aria-busy={quickPending || undefined}
                          onClick={(event) => {
                            event.preventDefault();
                            goToHref(link.href);
                          }}
                          className={cx(
                            "flex min-h-11 items-center justify-between gap-4 rounded-lg px-3 text-sm text-cream-mute transition-colors hover:bg-surface-2 hover:text-cream",
                            pending !== null && !quickPending && "opacity-60",
                          )}
                        >
                          {quickPending ? "Opening…" : link.label}
                          {quickPending ? (
                            <Spinner size="inline" />
                          ) : (
                            <span aria-hidden="true" className="text-accent/70">
                              →
                            </span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          )}
        </div>

        {/* The failure message sits between the list and the footer: it is
         * inside the dialog, above the fold of the panel, and it is a live
         * region so a screen reader hears it without hunting for it. The list is
         * re-enabled by clearing `pending`, which `go` does before setting this. */}
        {failed ? (
          <p role="alert" className="tml-search-error px-4 py-2.5 text-xs sm:px-5">
            That page did not open. Try again.
          </p>
        ) : null}

        <p className="flex min-h-11 items-center justify-between gap-3 border-t border-hair px-4 py-2.5 text-[0.68rem] text-cream-mute sm:px-5">
          {/* Provenance for the highlighted row. Every price in a snippet is a
           * figure from an official page, and this is where it names that page
           * and its date. There is no keyboard-model hint here: arrow and Enter
           * handling is unreliable in this dialog, so the footer must not claim
           * it works. */}
          {activeSourceUrl !== undefined && activeHost !== null ? (
            <span className="min-w-0 truncate">
              Source:{" "}
              <a
                href={activeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cream underline decoration-hair-strong underline-offset-4 hover:decoration-accent"
              >
                {activeHost}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              {activeChecked === null ? null : (
                <>
                  <CheckSeparator />
                  Checked {activeChecked}
                </>
              )}
            </span>
          ) : (
            <span className="sm:hidden">Tap a result to open it</span>
          )}
          <span className="label shrink-0 text-cream-mute">TMLGUIDE</span>
        </p>
      </div>
    </dialog>
  );
}
