"use client";

import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
/* The styles travel with the component, so a page that renders a select cannot
   forget them. Plain CSS, prefixed `.tml-select-`, no CSS modules. */
import "./custom-select.css";
import { cx } from "./cx";

/**
 * One selectable row in a `CustomSelect`.
 *
 * `label` is the visible text and is also what assistive technology reads, so it
 * has to name the choice on its own; `value` is the identifier the caller stores.
 */
export interface CustomSelectOption {
  readonly value: string;
  readonly label: string;
  /** A disabled option is shown but cannot be chosen, and the arrow keys pass over it. */
  readonly disabled?: boolean;
}

/** A named run of options, for a list whose groups a reader needs to see. */
export interface CustomSelectGroup {
  readonly label: string;
  readonly options: readonly CustomSelectOption[];
}

export interface CustomSelectProps {
  /** Id of the trigger, so an external `<label htmlFor>` can point at it. */
  readonly id?: string;
  /** The chosen value, or `""` when nothing is chosen yet. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** A flat list. Use `groups` instead when the options fall into named groups. */
  readonly options?: readonly CustomSelectOption[];
  /** Grouped options, each group named on screen and in the accessibility tree. */
  readonly groups?: readonly CustomSelectGroup[];
  /** Accessible name, for a control with no visible label of its own. */
  readonly ariaLabel?: string;
  /** Id of the element that names the control. */
  readonly ariaLabelledBy?: string;
  /** Id of the note that explains the control, kept associated while it has focus. */
  readonly ariaDescribedBy?: string;
  /** Shown when `value` matches no option, or when nothing is chosen. */
  readonly placeholder?: string;
  /** Applied to the wrapper rather than the trigger. */
  readonly className?: string;
  readonly disabled?: boolean;
}

/** Milliseconds of quiet that ends a type-ahead search. */
const TYPEAHEAD_RESET_MS = 600;

/** Gap between the trigger and the list, in pixels. */
const MENU_GAP = 6;

/** Read a pixel length from a custom property, or 0 when it is absent or not a number. */
function readPx(raw: string): number {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Room the sticky header and the mobile tab bar take, read from the same custom
 * properties those elements are sized with. Reading them keeps this component
 * from knowing the header's height, and a missing property simply reads as 0.
 */
function viewportInsets(): { readonly top: number; readonly bottom: number } {
  if (typeof window === "undefined") return { top: 0, bottom: 0 };
  const styles = getComputedStyle(document.documentElement);
  const top = readPx(styles.getPropertyValue("--header-h"));
  let bottom = 0;
  try {
    if (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 899px)").matches) {
      bottom = readPx(styles.getPropertyValue("--tabbar-h"));
    }
  } catch {
    bottom = 0;
  }
  return { top, bottom };
}

/**
 * A select built from a button and a listbox.
 *
 * A native `<select>` cannot carry this surface: the popup is drawn by the
 * operating system, so the rounded card, the hairline border and the gold
 * checkmark are out of reach. This control draws its own list instead.
 *
 * The interaction follows the WAI-ARIA select-only combobox pattern. Focus stays
 * on the trigger for the whole interaction and the highlighted row is reported
 * through `aria-activedescendant`, which is why the rows are not tab stops of
 * their own: Tab leaves the control rather than walking every option. A pointer
 * press on a row is prevented from moving focus, so the mouse and the keyboard
 * drive one piece of state.
 *
 * The list is positioned absolutely inside the wrapper, so it travels with the
 * page as the document scrolls and needs no measurement or repositioning code.
 * An ancestor that clips its overflow would clip the list, so a caller placing
 * this inside `overflow: hidden` must give the wrapper room.
 *
 * `data-value` on the trigger mirrors the current value for tests and styling,
 * the same way `data-open` and `data-disabled` report the control's state.
 */
export function CustomSelect({
  id,
  value,
  onChange,
  options,
  groups,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  placeholder = "Choose an option",
  className,
  disabled = false,
}: CustomSelectProps) {
  const baseId = useId();
  const triggerId = id ?? `${baseId}-trigger`;
  const listboxId = `${baseId}-listbox`;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const typeahead = useRef<string>("");
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /* Which side of the trigger the list sits on. Measured when it opens; a list
     that fits below stays below, which is where a reader looks first. */
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const menuRef = useRef<HTMLDivElement | null>(null);

  /*
    Every row is numbered in one flat sequence, so an index means the same row
    whether the options arrived flat or grouped. The keyboard moves through that
    sequence, and each group records where it starts. The start is a running total
    of the group sizes, rebuilt on each call rather than accumulated in a mutable
    counter during render.
  */
  const sections = useMemo(() => {
    const source: readonly CustomSelectGroup[] =
      groups ?? [{ label: "", options: options ?? [] }];
    const sizes = source.map((section) => section.options.length);
    return source.map((section, index) => ({
      label: section.label,
      options: section.options,
      start: sizes.slice(0, index).reduce((total, size) => total + size, 0),
    }));
  }, [groups, options]);

  const flatOptions = useMemo<readonly CustomSelectOption[]>(
    () => sections.flatMap((section) => section.options),
    [sections],
  );

  const selectedIndex = flatOptions.findIndex((option) => option.value === value);
  const selectedLabel = selectedIndex === -1 ? null : (flatOptions[selectedIndex]?.label ?? null);

  function isEnabled(index: number): boolean {
    const option = flatOptions[index];
    return option !== undefined && option.disabled !== true;
  }

  /** The next enabled row in `step` direction, wrapping. `-1` when none exists. */
  function stepIndex(from: number, step: 1 | -1): number {
    const count = flatOptions.length;
    for (let distance = 1; distance <= count; distance += 1) {
      const candidate = (((from + step * distance) % count) + count) % count;
      if (isEnabled(candidate)) return candidate;
    }
    return -1;
  }

  function close() {
    setOpen(false);
  }

  /** Opens the list, with `step` deciding which row opens highlighted. */
  function openMenu(step: 1 | -1) {
    if (disabled || flatOptions.length === 0) return;
    /* Opening downward starts above the first row, so the first arrow press lands
       on the top option; opening upward starts below the list for the mirror of
       that. A chosen value always opens on itself, where the reader's attention
       already is. */
    const base = selectedIndex !== -1 ? selectedIndex : step === 1 ? -1 : 0;
    setActiveIndex(stepIndex(base, step));
    setOpen(true);
  }

  function choose(index: number) {
    if (!isEnabled(index)) return;
    const option = flatOptions[index];
    if (option === undefined) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  /* Close on a press anywhere else. Pointer events cover mouse, pen and touch;
     `mousedown` is the fallback for a browser without them. A repeated close is
     harmless, and both listeners go when the list closes or unmounts. */
  useEffect(() => {
    if (!open) return;
    function handlePress(event: Event) {
      const wrapper = wrapperRef.current;
      if (wrapper === null) return;
      if (event.target instanceof Node && wrapper.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePress);
    document.addEventListener("mousedown", handlePress);
    return () => {
      document.removeEventListener("pointerdown", handlePress);
      document.removeEventListener("mousedown", handlePress);
    };
  }, [open]);

  /* Keep the highlighted row inside the scrolling list. */
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const row = optionRefs.current[activeIndex];
    if (row !== null && row !== undefined && typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex]);

  /*
    Choose the side of the trigger the list hangs from. A field low in a long form
    has no room beneath it, and a list drawn below the fold is a list the reader
    cannot see. The measurement runs before paint, so the list is never drawn on
    the wrong side first.
  */
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (trigger === null || menu === null) return;

    const rect = trigger.getBoundingClientRect();
    const insets = viewportInsets();
    /* `scrollHeight` is the list's natural height; the CSS max-height caps what is
       drawn, and a capped list needs 16rem of room at most. */
    const natural = menu.scrollHeight;
    const needed = Math.min(natural > 0 ? natural : flatOptions.length * 44 + 16, 256);
    const spaceBelow = window.innerHeight - insets.bottom - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - insets.top - MENU_GAP;
    const next: "down" | "up" = spaceBelow < needed && spaceAbove > spaceBelow ? "up" : "down";
    setPlacement((current) => (current === next ? current : next));
  }, [open, flatOptions.length]);

  useEffect(() => {
    return () => {
      if (typeaheadTimer.current !== null) clearTimeout(typeaheadTimer.current);
    };
  }, []);

  /**
   * Jumps to the next option whose label starts with what has been typed in the
   * last moment. Fifteen stages are quicker to reach by letter than by arrow, and
   * the search restarts after a pause, so "ca" and "c" then "a" behave as a
   * reader expects.
   */
  function searchByLetter(character: string) {
    if (typeaheadTimer.current !== null) clearTimeout(typeaheadTimer.current);
    typeaheadTimer.current = setTimeout(() => {
      typeahead.current = "";
    }, TYPEAHEAD_RESET_MS);
    typeahead.current += character.toLowerCase();

    const count = flatOptions.length;
    if (count === 0) return;
    const start = activeIndex !== -1 ? activeIndex : selectedIndex;
    for (let distance = 1; distance <= count; distance += 1) {
      const candidate = (((start + distance) % count) + count) % count;
      const option = flatOptions[candidate];
      if (option !== undefined && option.disabled !== true) {
        if (option.label.toLowerCase().startsWith(typeahead.current)) {
          setActiveIndex(candidate);
          setOpen(true);
          return;
        }
      }
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const { key } = event;

    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      const step: 1 | -1 = key === "ArrowDown" ? 1 : -1;
      if (!open) {
        openMenu(step);
        return;
      }
      const next = stepIndex(activeIndex, step);
      if (next !== -1) setActiveIndex(next);
      return;
    }

    if (key === "Home" || key === "End") {
      if (!open) return;
      event.preventDefault();
      const indices = [...flatOptions.keys()];
      if (key === "End") indices.reverse();
      for (const index of indices) {
        if (isEnabled(index)) {
          setActiveIndex(index);
          break;
        }
      }
      return;
    }

    if (key === "Enter" || key === " " || key === "Spacebar") {
      /* Prevented so the browser does not also synthesise a click, which would
         reopen the list this same press has just closed. */
      event.preventDefault();
      if (!open) {
        openMenu(1);
        return;
      }
      choose(activeIndex);
      return;
    }

    if (key === "Escape") {
      if (!open) return;
      event.preventDefault();
      close();
      return;
    }

    if (key === "Tab") {
      /* Tab is left to the browser; the list only has to get out of the way. */
      if (open) close();
      return;
    }

    if (key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      searchByLetter(key);
    }
  }

  const activeId = open && activeIndex >= 0 ? `${baseId}-option-${activeIndex}` : undefined;

  return (
    <div
      ref={wrapperRef}
      className={cx("tml-select", className)}
      data-open={open ? "true" : "false"}
      data-disabled={disabled ? "true" : undefined}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="tml-select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        data-value={value}
        onClick={() => {
          if (open) close();
          else openMenu(1);
        }}
        onKeyDown={onKeyDown}
      >
        <span
          className={cx(
            "tml-select-trigger__label",
            selectedLabel === null ? "tml-select-trigger__label--placeholder" : undefined,
          )}
        >
          {selectedLabel ?? placeholder}
        </span>
        <svg
          className="tml-select-chevron"
          data-open={open ? "true" : "false"}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="tml-select-menu"
          data-placement={placement}
          id={listboxId}
          role="listbox"
          /* Named by whatever names the trigger, so a control labelled only by a
             visible `<label for>` does not open a nameless list. */
          aria-labelledby={ariaLabelledBy ?? triggerId}
        >
          {sections.map((section, sectionIndex) => {
            const rows = section.options.map((option, offset) => {
              const index = section.start + offset;
              const isSelected = option.value === value;
              const isOptionDisabled = option.disabled === true;
              return (
                <div
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  id={`${baseId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isOptionDisabled || undefined}
                  className="tml-select-option"
                  data-value={option.value}
                  data-active={index === activeIndex ? "true" : "false"}
                  data-disabled={isOptionDisabled ? "true" : undefined}
                  onMouseMove={() => {
                    if (!isOptionDisabled && index !== activeIndex) setActiveIndex(index);
                  }}
                  onMouseDown={(event) => {
                    /* Keeps focus on the trigger, so one focus owner drives the state. */
                    event.preventDefault();
                  }}
                  onClick={() => choose(index)}
                >
                  <span className="tml-select-option__label">{option.label}</span>
                  {isSelected ? (
                    <svg
                      className="tml-select-option__check"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : null}
                </div>
              );
            });

            /* An ungrouped list needs no wrapper: a group with no name would be
               announced as an unnamed group, which is worse than no group. */
            if (section.label === "") {
              return <Fragment key={`section-${sectionIndex}`}>{rows}</Fragment>;
            }

            return (
              <div
                key={`section-${sectionIndex}-${section.label}`}
                className="tml-select-group"
                role="group"
                aria-label={section.label}
              >
                <p className="tml-select-group__label" aria-hidden="true">
                  {section.label}
                </p>
                {rows}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
