"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  A11Y_CONTRASTS,
  A11Y_FONTS,
  A11Y_LINK_STYLES,
  A11Y_MOTIONS,
  A11Y_SPACINGS,
  A11Y_TEXT_SIZES,
  RESET_ANNOUNCEMENT,
  describePrefChange,
  type A11yPrefKey,
  type A11yPrefs,
} from "./a11y-prefs";
import {
  A11Y_PANEL_ID,
  A11Y_PANEL_TITLE_ID,
  closeA11yPanel,
  openA11yPanel,
  takeA11yReturnFocus,
  useA11yPanelOpen,
} from "./a11y-panel-store";
import { syncDocumentWithStoredPrefs, useA11yPrefs } from "./a11y-store";
/* The preference rules travel with the component: any page that mounts the toolbar is styled. */
import "./a11y.css";

/** Elements that can receive focus inside the panel, in tab order. */
const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/* ---------------------------------------------------------------------------------------------
 * Trigger
 * ------------------------------------------------------------------------------------------- */

export interface A11yTriggerProps {
  /**
   * "header" is the 44px circle in the desktop header; "dock" is a bare button the mobile tab bar
   * sizes as one of its own cells. Only the skin differs: the name and the `aria-*` contract are the
   * same in both, so the two cannot drift apart.
   */
  readonly variant: "header" | "dock";
  /** Extra classes from the surface that hosts the trigger, so it can adopt that surface's cell. */
  readonly className?: string;
}

/**
 * The button that opens the accessibility panel.
 *
 * The accessible name comes from visually hidden text rather than `aria-label`, so the visible glyph
 * ("Aa", "Settings") can stay out of the name without depending on how a browser treats it. There is
 * one panel for both triggers: two dialogs with the same id would break `aria-controls` and give a
 * screen reader two copies of every control.
 */
export function A11yTrigger({ variant, className = "" }: A11yTriggerProps) {
  const open = useA11yPanelOpen();

  if (variant === "dock") {
    return (
      <button
        type="button"
        aria-expanded={open}
        aria-controls={A11Y_PANEL_ID}
        onClick={(event) => openA11yPanel(event.currentTarget)}
        className={`flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl font-mono text-[10px] uppercase tracking-[0.04em] text-cream-mute transition-colors hover:text-cream ${className}`}
      >
        <span aria-hidden="true" className="text-[15px] leading-none font-semibold">
          Aa
        </span>
        {/*
          "Settings" is visible so the cell reads like its neighbours, and it is a substring of the
          accessible name, which is what WCAG 2.5.3 (Label in Name) requires for speech input.
        */}
        <span aria-hidden="true">Settings</span>
        <span className="sr-only">Accessibility settings</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={A11Y_PANEL_ID}
      onClick={(event) => openA11yPanel(event.currentTarget)}
      className={`grid size-11 shrink-0 place-items-center rounded-full border border-hair text-cream-mute transition-colors hover:border-hair-strong hover:text-cream ${className}`}
    >
      <span aria-hidden="true" className="font-mono text-[13px] leading-none tracking-[0.02em]">
        Aa
      </span>
      <span className="sr-only">Accessibility settings</span>
    </button>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Panel
 * ------------------------------------------------------------------------------------------- */

interface ChoiceProps {
  readonly name: string;
  readonly value: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onSelect: () => void;
}

/**
 * One option in a segmented group: a real `<input type="radio">` inside its own `<label>`.
 *
 * The radio is transparent and stretched over the whole label rather than clipped off-screen. That
 * keeps the platform's own behaviour — arrow-key navigation within the group, one tab stop per
 * group, the checked state, and a click anywhere on the cell landing on the input — while the label
 * underneath carries the visible text. `opacity: 0` keeps it in the accessibility tree; `display:
 * none` or `visibility: hidden` would not.
 */
function Choice({ name, value, label, checked, onSelect }: ChoiceProps) {
  return (
    <label className="a11y-option">
      <input
        type="radio"
        className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
      />
      <span>{label}</span>
    </label>
  );
}

export function A11yPanel() {
  const open = useA11yPanelOpen();
  const { prefs, setPref, reset } = useA11yPrefs();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const baseId = useId();
  const [announcement, setAnnouncement] = useState("");

  /**
   * Reads whatever was stored and republishes it. The inline boot script has already done this
   * before the first paint; this call exists for development, where React's Strict Mode remounts
   * the tree and resets `<html>` to the attributes it manages from JSX, wiping the script's work.
   * Doing it outside an effect would touch the DOM during render, which is what this avoids.
   */
  useEffect(() => {
    syncDocumentWithStoredPrefs();
  }, []);

  /* Mirror the open state onto the native dialog, which supplies the top layer, the inert page
     behind it and the `cancel` event. The attribute fallback keeps the panel usable where
     `showModal` is missing; a real browser always takes the first branch. */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");

      // The dialog itself takes focus, so its accessible name is announced before the controls.
      dialog.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  /* Back to the control that opened the panel. The store holds it, because it was recorded before
     the top layer moved focus. */
  useEffect(() => {
    if (open) return;
    const target = takeA11yReturnFocus();
    target?.focus({ preventScroll: true });
  }, [open]);

  /* Escape. The native `cancel` event is the primary path; the key handler covers engines and test
     environments that do not dispatch it, and the duplicate close is a no-op. */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    const onCancel = (event: Event) => {
      event.preventDefault();
      closeA11yPanel();
    };
    const onNativeClose = () => closeA11yPanel();

    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onNativeClose);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onNativeClose);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeA11yPanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /* Background scroll lock, so a wheel gesture over the panel cannot move the page behind it. */
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [open]);

  /**
   * Tab stays inside the panel. A modal dialog already makes the page inert, but looping here means
   * the behaviour does not depend on that: focus cannot land behind the panel in any engine.
   */
  const onDialogKeyDown = useCallback((event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (dialog === null) return;

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === dialog)) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  const change = useCallback(
    <K extends A11yPrefKey>(key: K, value: A11yPrefs[K]) => {
      setPref(key, value);
      setAnnouncement(describePrefChange(key, { ...prefs, [key]: value }));
    },
    [prefs, setPref],
  );

  const onReset = useCallback(() => {
    reset();
    setAnnouncement(RESET_ANNOUNCEMENT);
  }, [reset]);

  return (
    <dialog
      ref={dialogRef}
      id={A11Y_PANEL_ID}
      aria-labelledby={A11Y_PANEL_TITLE_ID}
      tabIndex={-1}
      onKeyDown={onDialogKeyDown}
      onClick={(event) => {
        // A click that lands on the dialog itself hit the backdrop: the panel fills it.
        if (event.target === event.currentTarget) closeA11yPanel();
      }}
      className="a11y-panel"
    >
      <div className="a11y-panel__body">
        <div className="flex items-start justify-between gap-3 border-b border-hair px-5 pt-5 pb-4">
          <div>
            <p className="label text-cream-mute">Display</p>
            <h2 id={A11Y_PANEL_TITLE_ID} className="mt-1.5 font-display text-[1.35rem] leading-tight">
              Accessibility settings
            </h2>
          </div>
          <button
            type="button"
            onClick={closeA11yPanel}
            className="-mt-1 grid size-11 shrink-0 place-items-center rounded-full text-cream-mute transition-colors hover:bg-surface-2 hover:text-cream"
          >
            <span className="sr-only">Close accessibility settings</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <fieldset className="a11y-group">
            <legend className="label text-cream-mute">Text size</legend>
            <div className="a11y-options a11y-options--four">
              {A11Y_TEXT_SIZES.map((size) => (
                <Choice
                  key={size}
                  name={`${baseId}-text-size`}
                  value={String(size)}
                  label={`${size}%`}
                  checked={prefs.textSize === size}
                  onSelect={() => change("textSize", size)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="a11y-group">
            <legend className="label text-cream-mute">Line and letter spacing</legend>
            <div className="a11y-options">
              {A11Y_SPACINGS.map((spacing) => (
                <Choice
                  key={spacing}
                  name={`${baseId}-spacing`}
                  value={spacing}
                  label={spacing === "normal" ? "Normal" : "Relaxed"}
                  checked={prefs.spacing === spacing}
                  onSelect={() => change("spacing", spacing)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="a11y-group">
            <legend className="label text-cream-mute">Contrast</legend>
            <div className="a11y-options">
              {A11Y_CONTRASTS.map((contrast) => (
                <Choice
                  key={contrast}
                  name={`${baseId}-contrast`}
                  value={contrast}
                  label={contrast === "standard" ? "Standard" : "High"}
                  checked={prefs.contrast === contrast}
                  onSelect={() => change("contrast", contrast)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="a11y-group">
            <legend className="label text-cream-mute">Motion</legend>
            <div className="a11y-options">
              {A11Y_MOTIONS.map((motion) => (
                <Choice
                  key={motion}
                  name={`${baseId}-motion`}
                  value={motion}
                  label={motion === "system" ? "Follow system" : "Reduce"}
                  checked={prefs.motion === motion}
                  onSelect={() => change("motion", motion)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="a11y-group">
            <legend className="label text-cream-mute">Underline links</legend>
            <div className="a11y-options">
              {A11Y_LINK_STYLES.map((links) => (
                <Choice
                  key={links}
                  name={`${baseId}-links`}
                  value={links}
                  label={links === "on" ? "On" : "Off"}
                  checked={prefs.links === links}
                  onSelect={() => change("links", links)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="a11y-group">
            <legend className="label text-cream-mute">Readable font</legend>
            <div className="a11y-options">
              {A11Y_FONTS.map((font) => (
                <Choice
                  key={font}
                  name={`${baseId}-font`}
                  value={font}
                  label={font === "readable" ? "On" : "Off"}
                  checked={prefs.font === font}
                  onSelect={() => change("font", font)}
                />
              ))}
            </div>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-cream-mute">
              Replaces the display serif with a plain sans-serif, for headings as well as body text.
            </p>
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair px-5 py-4">
          <button type="button" onClick={onReset} className="a11y-panel__reset">
            Reset to defaults
          </button>
          <p className="max-w-[18ch] text-[0.6875rem] leading-snug text-cream-mute">
            Saved in this browser only.
          </p>
        </div>

        {/*
          Present from the first render with only its text changing, which is what a live region needs
          in order to be announced. Polite, so a screen-reader user is not cut off mid-word.
        */}
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </p>
      </div>
    </dialog>
  );
}
