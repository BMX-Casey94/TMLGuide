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
import { flattenGroups, groupResults } from "@/lib/search/group";
import { formatCheckedDate } from "@/lib/search/format";
import { search } from "@/lib/search/rank";
import {
  addRecentSearch,
  clearRecentSearches,
  readRecentSearches,
} from "@/lib/search/recent";
import { queryTokens } from "@/lib/search/text";
import type { EditionScope, RankedEntry, SearchEntry } from "@/lib/search/types";
import { cx } from "@/components/ui/cx";
import { Highlight } from "./highlight";

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

  /* Mirrors `isOpen` synchronously. A trigger fires `focusin` before `click`,
   * so the two handlers must not both act; a state read is flushed later than
   * this check needs it. */
  const isOpenRef = useRef(false);

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
   * this guard exists to prevent. */
  useEffect(() => {
    if (isOpen) return;
    const target = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (!target || !target.isConnected) return;

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
    (entry: RankedEntry) => {
      if (trimmedQuery) setRecent(addRecentSearch(trimmedQuery));
      close();
      navigate(entry.href);
    },
    [close, navigate, trimmedQuery],
  );

  const goToHref = useCallback(
    (href: string) => {
      close();
      navigate(href);
    },
    [close, navigate],
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
          go(entry);
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
      className="fixed inset-0 z-[100] m-auto w-[calc(100%-2rem)] max-w-[640px] border-0 bg-transparent p-0 text-cream backdrop:bg-ground/80 backdrop:backdrop-blur-sm max-sm:h-full max-sm:max-h-none max-sm:w-full max-sm:max-w-none"
    >
      <div className="flex max-h-[min(86dvh,660px)] flex-col overflow-hidden rounded-panel border border-hair bg-surface shadow-[0_40px_120px_-40px_rgb(0_0_0/0.95)] max-sm:h-full max-sm:max-h-none max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0">
        <h2 id={labelId} className="sr-only">
          Search TMLGUIDE
        </h2>

        <div className="flex items-center gap-3 border-b border-hair px-4 py-3 transition-colors focus-within:border-accent/60 sm:px-5">
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
            placeholder="Search tickets, dates, DreamVille, community…"            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            className="min-w-0 flex-1 bg-transparent py-2 text-base text-cream placeholder:text-cream-mute"
          />

          <kbd className="label hidden shrink-0 rounded border border-hair px-1.5 py-0.5 text-cream-mute sm:block">
            Esc
          </kbd>

          <button
            type="button"
            onClick={close}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-cream-mute transition-colors hover:text-cream sm:hidden"
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
          Type to search. Use the up and down arrow keys to move through results, and Enter to open
          the highlighted one. Escape closes the search.
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
                  return (
                    <a
                      key={entry.id}
                      id={`${baseId}-option-${entry.id}`}
                      data-index={index}
                      role="option"
                      aria-selected={selected}
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
                        go(entry);
                      }}
                      onMouseMove={() => {
                        if (!selected) setActiveIndex(index);
                      }}
                      className={cx(
                        "flex min-h-14 items-start gap-3 border-l-2 px-4 py-3 transition-colors max-sm:min-h-16 sm:px-5",
                        selected
                          ? "border-accent bg-surface-2"
                          : "border-transparent hover:bg-surface-2/60",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug font-medium text-cream">
                          <Highlight text={entry.title} tokens={tokens} />
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-cream-mute">
                          <Highlight text={entry.snippet} tokens={tokens} />
                        </span>
                      </span>
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
                  {QUICK_LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={(event) => {
                          event.preventDefault();
                          goToHref(link.href);
                        }}
                        className="flex min-h-11 items-center justify-between gap-4 rounded-lg px-3 text-sm text-cream-mute transition-colors hover:bg-surface-2 hover:text-cream"
                      >
                        {link.label}
                        <span aria-hidden="true" className="text-accent/70">
                          →
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>

        <p className="flex min-h-11 items-center justify-between gap-3 border-t border-hair px-4 py-2.5 text-[0.68rem] text-cream-mute sm:px-5">
          {/* Provenance for the highlighted row, replacing the keyboard model
           * only while there is something to attribute: the footer is one line,
           * so it can say which page a figure came from or how to drive the
           * palette, never both. Every price in a snippet is a figure from an
           * official page, and this is where it names that page and its date. */}
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
              {activeChecked === null ? null : <> · Checked {activeChecked}</>}
            </span>
          ) : (
            <span className="hidden sm:inline">
              <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> to move ·{" "}
              <kbd className="font-mono">Enter</kbd> to open
            </span>
          )}
          {activeSourceUrl !== undefined && activeHost !== null ? null : (
            <span className="sm:hidden">Tap a result to open it</span>
          )}
          <span className="label shrink-0 text-cream-mute">TMLGUIDE</span>
        </p>
      </div>
    </dialog>
  );
}
