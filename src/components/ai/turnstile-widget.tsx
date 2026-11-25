"use client";

/**
 * The Cloudflare Turnstile widget.
 *
 * Server-side verification is the control that matters: `/api/ask` verifies the
 * token against `siteverify` and refuses without one whenever
 * `TURNSTILE_SECRET_KEY` is set. This component only produces that token, so a
 * reader is never shown a challenge they cannot pass.
 *
 * ## The policy support this component needs
 *
 * Turnstile loads a script from `challenges.cloudflare.com` and renders an
 * iframe. Both are admitted by `src/lib/security/csp.ts` when
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is configured, and neither is admitted when it
 * is not — so an unconfigured deployment keeps `frame-src 'none'`. That module
 * owns the decision rather than this one: a component cannot know whether the
 * proxy running in front of it granted an exemption.
 *
 * When the script fails to load anyway — an ad blocker, a proxy stripping the
 * header, a key configured after the last deploy — the component says so plainly
 * instead of leaving an empty box, and the answer panel tells the reader the
 * check is required but unavailable. It never silently pretends to have passed.
 */

import { useEffect, useRef, useState } from "react";

/** Cloudflare's widget script. `render=explicit` so mount order is ours. */
export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export interface TurnstileWidgetProps {
  /** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. */
  readonly siteKey: string;
  /** Called with the token when Cloudflare issues one, and with null when it expires. */
  readonly onToken: (token: string | null) => void;
}

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "dark" | "light" | "auto";
      action?: string;
    },
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type LoadState = "loading" | "ready" | "failed";

export function TurnstileWidget({ siteKey, onToken }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  /*
    The latest `onToken` is held in a ref so the widget effect does not need to re-run
    when the parent re-renders with a new callback identity. It is written in an effect,
    not during render: React 19 forbids mutating a ref while rendering, because a render
    may be discarded and the mutation would leak out of it.
  */
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled) return;
      const api = window.turnstile;
      const container = containerRef.current;
      if (api === undefined || container === null) {
        setState("failed");
        return;
      }
      if (widgetIdRef.current !== null) return;

      widgetIdRef.current = api.render(container, {
        sitekey: siteKey,
        theme: "dark",
        action: "ask",
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(null),
        "error-callback": () => onTokenRef.current(null),
      });
      setState("ready");
    };

    if (window.turnstile !== undefined) {
      renderWidget();
      return () => {
        cancelled = true;
        const id = widgetIdRef.current;
        if (id !== null && window.turnstile !== undefined) {
          try {
            window.turnstile.remove(id);
          } catch {
            // A failed removal leaves nothing behind that matters: the script
            // outlives the component and the container is gone.
          }
        }
        widgetIdRef.current = null;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");

    const onLoad = () => {
      if (!cancelled) renderWidget();
    };
    const onError = () => {
      if (!cancelled) setState("failed");
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if (existing === null) {
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      const id = widgetIdRef.current;
      if (id !== null && window.turnstile !== undefined) {
        try {
          window.turnstile.remove(id);
        } catch {
          // See above.
        }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey]);

  return (
    <div className="tml-ai-field">
      <span className="tml-ai-label">Verification</span>
      <div ref={containerRef} />
      {state === "failed" ? (
        <p className="tml-ai-error" role="alert">
          The verification check could not load, so questions cannot be sent from this browser right
          now. This is usually a network or content-security-policy problem rather than anything you
          did. Every fact the guide would cite is on its own pages in the meantime.
        </p>
      ) : null}
    </div>
  );
}
