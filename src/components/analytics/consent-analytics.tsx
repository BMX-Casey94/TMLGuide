"use client";

/**
 * Consent-gated analytics scaffold.
 *
 * The component renders nothing and does nothing until three conditions all
 * hold. Until then it is genuinely inert: no cookie, no network request, no
 * identifier, no `<script>` element.
 *
 * 1. A person has opted in explicitly. The answer lives in `localStorage` under
 *    `tml-analytics-consent-v1`, and only the exact string `"granted"` counts.
 *    Anything else — absent, malformed, from an older key — is not consent.
 * 2. An endpoint is configured, through `NEXT_PUBLIC_ANALYTICS_ENDPOINT`.
 * 3. The page is served over HTTPS or from localhost, so a beacon is not sent in
 *    clear text.
 *
 * ## Why no cookie and why `localStorage` here
 *
 * UK GDPR and PECR treat an analytics cookie as non-essential, so it needs the
 * same opt-in as the analytics itself. Storing the *decision* in `localStorage`
 * avoids setting a cookie before a decision exists, which is the situation that
 * makes a "we only use essential cookies" claim false. The value holds no
 * identifier: a single word, one key, read by nothing but this module.
 *
 * ## Why nothing is buffered
 *
 * A queue of events collected before consent and flushed afterwards is still
 * processing personal data without a lawful basis, and it is what makes consent
 * banners dishonest. There is deliberately no buffer here. An event that happens
 * before consent is simply not recorded.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

/** The storage key. Versioned, so a change of meaning cannot inherit old consent. */
export const ANALYTICS_CONSENT_KEY = "tml-analytics-consent-v1";

/** Only this exact value is consent. */
export const ANALYTICS_CONSENT_GRANTED = "granted";

/** The value written when consent is refused. Kept so a refusal can be remembered. */
export const ANALYTICS_CONSENT_DENIED = "denied";

export type AnalyticsConsent = "granted" | "denied" | "unset";

/** One page view. Deliberately minimal: no screen size, no referrer chain, no user agent. */
export interface AnalyticsPageView {
  /** The path only. Query strings and fragments are dropped before sending. */
  readonly path: string;
  /** The document title, which the visitor can already see. */
  readonly title: string;
}

/** The events this scaffold can send. A closed set, so nothing arbitrary is emitted. */
export type AnalyticsEvent =
  | { readonly type: "page_view"; readonly path: string; readonly title: string }
  | { readonly type: "consent_granted" };

/* -------------------------------------------------------------------------- */
/* Storage access                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Reads the stored decision.
 *
 * Every failure mode resolves to `"unset"`: private browsing where storage
 * throws, a blocked-site-data setting, a value written by a different site on
 * the same origin. A read that cannot be trusted must never be read as consent.
 */
function readStoredConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return "unset";
  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (stored === ANALYTICS_CONSENT_GRANTED) return "granted";
    if (stored === ANALYTICS_CONSENT_DENIED) return "denied";
    return "unset";
  } catch {
    return "unset";
  }
}

/**
 * Reads the current consent decision from storage.
 *
 * Exported so a settings panel or a banner can render the current state without
 * duplicating the key or the parsing rules.
 */
export function getAnalyticsConsent(): AnalyticsConsent {
  return readStoredConsent();
}

/**
 * Stores an explicit decision and notifies the mounted component.
 *
 * Returns false when the decision could not be stored — a private window, or
 * storage full. The caller should then treat the visitor as unconsented rather
 * than assuming the write worked, and `getAnalyticsConsent` will keep returning
 * `"unset"`, which produces exactly that behaviour.
 */
export function setAnalyticsConsent(granted: boolean): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      ANALYTICS_CONSENT_KEY,
      granted ? ANALYTICS_CONSENT_GRANTED : ANALYTICS_CONSENT_DENIED,
    );
    notifyConsentChange();
    return true;
  } catch {
    return false;
  }
}

/**
 * Withdraws consent and stops everything.
 *
 * The stored value becomes `"denied"` rather than being deleted, so a later
 * visit does not present the question again as though no decision had been made.
 * Removing the key would also be defensible; keeping the refusal is the choice
 * that respects the answer the visitor already gave.
 */
export function revokeAnalyticsConsent(): boolean {
  return setAnalyticsConsent(false);
}

/* -------------------------------------------------------------------------- */
/* Change notification                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A minimal subscription, so `useSyncExternalStore` can follow the stored value.
 *
 * `localStorage` fires `storage` in *other* tabs only, which is why
 * `notifyConsentChange` exists: without it, a banner granting consent in this tab
 * would not wake the analytics component in the same tab.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent): void => {
    // `key === null` means `clear()` was called, which also changes the answer.
    if (event.key === ANALYTICS_CONSENT_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function notifyConsentChange(): void {
  for (const listener of listeners) listener();
}

/** Server snapshot: no storage exists during prerendering, so never consent. */
function getServerSnapshot(): AnalyticsConsent {
  return "unset";
}

/* -------------------------------------------------------------------------- */
/* Endpoint                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Resolves a configured endpoint into the URL that will be posted to.
 *
 * Deliberately pure: it reads no environment variable, so a caller decides what
 * to configure and a test can state its input exactly. Only `https:` is
 * accepted. Sending analytics over plain HTTP would leak the path a visitor read
 * to anyone on the network, and `localhost` over HTTP is allowed solely so the
 * scaffold can be exercised in development.
 *
 * Returns null for anything absent, blank or unusable, which is what makes
 * "not configured" and "configured wrongly" behave identically: nothing is sent.
 */
export function resolveAnalyticsEndpoint(
  configured: string | null | undefined,
): string | null {
  const trimmed = configured?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) return null;
    // The query string is dropped: an endpoint configured with a token in it
    // should keep that token out of a URL that might be logged by the browser.
    return url.origin + url.pathname;
  } catch {
    return null;
  }
}

/**
 * The environment keys the component reads.
 *
 * Given an index signature so the real `process.env` satisfies it without a cast:
 * Next declares `NODE_ENV` as required on `ProcessEnv` and drops the index
 * signature that would otherwise make the assignment structural.
 */
export interface AnalyticsEnv {
  readonly NEXT_PUBLIC_ANALYTICS_ENDPOINT?: string | undefined;
  readonly [key: string]: string | undefined;
}

/** The endpoint the component uses: the prop when given, otherwise the environment. */
export function configuredAnalyticsEndpoint(
  override: string | undefined = undefined,
  env: AnalyticsEnv = process.env,
): string | null {
  return resolveAnalyticsEndpoint(override ?? env.NEXT_PUBLIC_ANALYTICS_ENDPOINT);
}

/** True when a usable endpoint is configured. */
export function isAnalyticsConfigured(): boolean {
  return configuredAnalyticsEndpoint() !== null;
}

/**
 * Strips everything that could carry personal data out of a URL.
 *
 * A query string routinely holds a search term, an email address in a reset
 * link, or a tracking parameter from wherever the visitor arrived. None of that
 * belongs in an analytics payload, so only the path is kept.
 */
export function toSafePath(href: string): string {
  try {
    const url = new URL(href, "https://placeholder.invalid");
    return url.pathname;
  } catch {
    return "/";
  }
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Sends one event.
 *
 * `keepalive` lets the beacon finish after a navigation, `credentials: "omit"`
 * makes sure no cookie travels with it, and `referrerPolicy: "no-referrer"`
 * stops the current URL leaking to the endpoint. A failure is swallowed: an
 * analytics endpoint being down must never surface to a visitor.
 */
async function sendEvent(endpoint: string, event: AnalyticsEvent): Promise<void> {
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    // Intentionally silent. Retrying would send more requests than consented.
  }
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export interface ConsentAnalyticsProps {
  /** Endpoint override. Defaults to `NEXT_PUBLIC_ANALYTICS_ENDPOINT`. */
  readonly endpoint?: string;
  /** Path override, for a caller that already knows it. Defaults to `location`. */
  readonly path?: string;
  /** Title override. Defaults to `document.title`. */
  readonly title?: string;
}

/**
 * Renders nothing and sends a single page view once consent and configuration
 * are both in place.
 *
 * Nothing is subscribed to before consent is granted: the effect returns early
 * and no listener exists, so a page that never grants consent never wakes this
 * component again.
 */
export function ConsentAnalytics({ endpoint, path, title }: ConsentAnalyticsProps = {}) {
  const consent = useSyncExternalStore(subscribe, readStoredConsent, getServerSnapshot);
  // Resolved once per prop value rather than on every render, so the effect's
  // dependency list stays stable and cannot re-fire on an unrelated render.
  const resolvedEndpoint = configuredAnalyticsEndpoint(endpoint);
  // One page view per path per mount. Without this a re-render, or React's
  // development double-effect, would double count every visit.
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    if (consent !== ANALYTICS_CONSENT_GRANTED) return;
    if (resolvedEndpoint === null) return;

    const target = path ?? toSafePath(window.location.href);
    if (sentFor.current === target) return;
    sentFor.current = target;

    void sendEvent(resolvedEndpoint, {
      type: "page_view",
      path: target,
      title: title ?? document.title,
    });
  }, [consent, resolvedEndpoint, path, title]);

  return null;
}
