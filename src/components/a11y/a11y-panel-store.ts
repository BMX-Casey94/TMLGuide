"use client";

import { useSyncExternalStore } from "react";

/**
 * Open state for the accessibility panel, shared by every trigger and the one dialog.
 *
 * The trigger sits in two places (the desktop header and the mobile tab bar), but there is only one
 * panel: two dialogs with the same id would break `aria-controls` and give assistive technology two
 * copies of every control. So the panel is mounted once, in the shell, and this small store is what
 * the triggers talk to.
 *
 * The element that opened the panel is recorded here rather than in the dialog, because by the time
 * the dialog opens the trigger has already lost focus to the top layer. That element is where focus
 * goes when the panel closes.
 */

let open = false;
let returnFocusTo: HTMLElement | null = null;
const listeners = new Set<() => void>();

/** The id of the panel element. Both triggers point at it with `aria-controls`. */
export const A11Y_PANEL_ID = "a11y-settings-panel";

/** The label element that names the panel. */
export const A11Y_PANEL_TITLE_ID = "a11y-settings-title";

function emit(): void {
  for (const listener of listeners) listener();
}

export function isA11yPanelOpen(): boolean {
  return open;
}

/**
 * Opens the panel. `trigger` is the control that was activated; without one the active element is
 * used, so a future caller that opens the panel from a keyboard shortcut still returns focus
 * somewhere sensible.
 */
export function openA11yPanel(trigger?: HTMLElement | null): void {
  if (open) return;
  const active = typeof document === "undefined" ? null : document.activeElement;
  returnFocusTo =
    trigger ?? (active instanceof HTMLElement && active !== document.body ? active : null);
  open = true;
  emit();
}

export function closeA11yPanel(): void {
  if (!open) return;
  open = false;
  emit();
}

/**
 * Hands the recorded trigger back once, or null when there is nothing left to focus (the element
 * was removed from the document in the meantime). Clearing it means a second close cannot move
 * focus a second time.
 */
export function takeA11yReturnFocus(): HTMLElement | null {
  const target = returnFocusTo;
  returnFocusTo = null;
  return target !== null && target.isConnected ? target : null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getServerSnapshot(): boolean {
  // The panel is always shut during server rendering and during hydration, so the markup agrees.
  return false;
}

export function useA11yPanelOpen(): boolean {
  return useSyncExternalStore(subscribe, isA11yPanelOpen, getServerSnapshot);
}
