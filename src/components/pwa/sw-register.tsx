"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import "./pwa.css";

function subscribeOnlineStatus(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOfflineSnapshot(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function getServerOfflineSnapshot(): boolean {
  return false;
}

function shouldRegisterServiceWorker(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return false;
  }
  return true;
}

/**
 * Registers the TMLGuide service worker in supported browsers and renders a
 * subtle, accessible status banner whenever the device goes offline.
 */
export function SwRegister() {
  const isOffline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOfflineSnapshot,
    getServerOfflineSnapshot,
  );

  useEffect(() => {
    if (!shouldRegisterServiceWorker()) {
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Service worker registration can be blocked in private browsing or strict
      // enterprise profiles; fail quietly so the site continues normally.
    });
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="tml-pwa-offline-banner" role="status" aria-live="polite">
      <span className="tml-pwa-offline-banner__badge">
        <span className="tml-pwa-offline-banner__dot" aria-hidden="true" />
        Offline
      </span>
      <p className="tml-pwa-offline-banner__text">
        You are offline. Cached guides remain available until your connection returns.
      </p>
      <Link href="/offline" className="tml-pwa-offline-banner__link">
        Offline guides
      </Link>
    </div>
  );
}
