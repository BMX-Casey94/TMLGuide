"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { SaleBannerRecord } from "@/content/operations/sale-banner";
import "./sale-banner.css";

/**
 * The site-wide sale notice, rendered once by `SiteShell` directly under the header.
 *
 * A Client Component because dismissal is stored per browsing session. Everything else is static: the
 * record comes from `src/content/operations/sale-banner.ts`, so switching the notice on, rewording it
 * or moving its destination is one content edit.
 *
 * ## Why the notice is in the server's HTML
 *
 * While the record is enabled the notice is rendered on the server, and the stored dismissal is read
 * through `useSyncExternalStore` with a server snapshot of "not dismissed". That puts the notice in
 * the markup before any JavaScript runs, so a reader without scripts still sees it and nothing shifts
 * when scripts arrive. React re-reads the store once hydration finishes and removes the notice if
 * this tab has already dismissed this message, so a returning reader may see it for a single frame.
 * The reverse arrangement - render nothing on the server and reveal after hydration - would hide the
 * notice from those readers and push the page down when it appeared.
 *
 * ## Dismissal scope
 *
 * A session, not a visitor: no cookie, no account, no identifier, nothing that leaves the tab. The
 * key carries a fingerprint of the message, so changed wording is a new notice and shows again rather
 * than inheriting an old dismissal.
 */

/** The dismiss control's accessible name. Exported so the test asserts what the code actually ships. */
export const SALE_DISMISS_LABEL = "Dismiss sales notice";

/** The region's accessible name. */
export const SALE_REGION_LABEL = "Sales notice";

/**
 * Visible tail of the link. It names the destination and says it opens elsewhere, so the new tab is
 * not a surprise and where it goes is clear before the reader follows it.
 */
export const SALE_LINK_HINT = " (opens the official site in a new tab)";

const STORAGE_PREFIX = "tml-sale-dismissed-";

/**
 * A 32-bit FNV-1a fingerprint of the message, as eight hex characters.
 *
 * Not a security measure. It only has to change when the wording changes, and to be short enough to
 * sit in a storage key.
 */
function fingerprint(message: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < message.length; index += 1) {
    hash ^= message.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** The sessionStorage key recording that this message has been dismissed in this tab. */
export function saleBannerDismissKey(message: string): string {
  return `${STORAGE_PREFIX}${fingerprint(message)}`;
}

/* ---------------------------------------------------------------------------------------------
 * Store
 *
 * sessionStorage answers most reads, but a write can be refused (private mode, blocked site data, a
 * sandboxed frame) and the dismissal must still hold for the rest of the page view instead of leaving
 * the reader with a button that does nothing. So the dismissals made in this page view are also kept
 * in memory, against the Storage object they belong to: while that object is the document's the
 * in-memory set answers, and if the object is ever replaced both are discarded and storage is read
 * again. This mirrors the edition store in ./edition-context.
 *
 * `sessionStorage` is per tab and fires no event this component could hear, so nothing writes to the
 * cache behind the component's back: the subscription exists only to tell React that a dismissal
 * happened in this one.
 * ------------------------------------------------------------------------------------------- */

let cache: { readonly store: Storage | null; readonly dismissed: Set<string> } | null = null;
const listeners = new Set<() => void>();

/** The session store, or null where reading the property itself is refused (blocked site data). */
function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function currentCache(): { readonly store: Storage | null; readonly dismissed: Set<string> } {
  const store = sessionStore();
  if (cache === null || cache.store !== store) {
    cache = { store, dismissed: new Set() };
  }
  return cache;
}

/**
 * True only when this session has dismissed this message.
 *
 * The stored value is the source of truth, so a reload in the same tab still honours a dismissal made
 * before it. Every failure answers false, so a store that cannot be read leaves the notice up rather
 * than pretending it was dismissed: a notice that cannot be remembered must not also disappear.
 */
function isDismissed(message: string): boolean {
  const key = saleBannerDismissKey(message);
  const { store, dismissed } = currentCache();
  if (dismissed.has(key)) return true;
  if (store === null) return false;
  try {
    return store.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeDismissed(message: string): void {
  const key = saleBannerDismissKey(message);
  currentCache().dismissed.add(key);
  const store = sessionStore();
  if (store === null) return;
  try {
    store.setItem(key, "1");
  } catch {
    // The in-memory set keeps the notice hidden for this page view.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** The server has no storage, so it renders the notice. Hydration starts from the same answer. */
function getServerDismissed(): boolean {
  return false;
}

export interface SaleBannerProps {
  /** The notice to render. `enabled: false` renders nothing at all. */
  readonly record: SaleBannerRecord;
}

export function SaleBanner({ record }: SaleBannerProps) {
  const { enabled, message, href, linkLabel } = record;

  // Keyed on the message, so a reworded notice is read against its own key.
  const getSnapshot = useCallback(() => isDismissed(message), [message]);
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerDismissed);

  const handleDismiss = useCallback(() => {
    writeDismissed(message);
    emit();
  }, [message]);

  // Switched off, or already dismissed: no element, no landmark, no reserved space.
  if (!enabled || dismissed) return null;

  return (
    <section className="tml-sale" aria-label={SALE_REGION_LABEL}>
      <div className="tml-sale__inner">
        <p className="tml-sale__message">
          {message}{" "}
          <a className="tml-sale__link" href={href} target="_blank" rel="noopener noreferrer">
            {linkLabel}
            <span className="tml-sale__link-hint">{SALE_LINK_HINT}</span>
          </a>
        </p>

        <button
          type="button"
          className="tml-sale__dismiss"
          onClick={handleDismiss}
          aria-label={SALE_DISMISS_LABEL}
        >
          {/* Decorative: the button itself carries the accessible name. */}
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
            <path
              d="M5 5l10 10M15 5L5 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </section>
  );
}
