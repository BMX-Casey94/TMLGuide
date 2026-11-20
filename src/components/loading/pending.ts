"use client";

import { useCallback } from "react";
import { useSyncExternalStore } from "react";
import {
  getNavigationState,
  getServerNavigationState,
  settleNavigation,
  subscribeToNavigation,
} from "./navigation-store";

/**
 * True while a client navigation is in flight, read from the shared store.
 *
 * `useSyncExternalStore` rather than context: the store is module-level, there is
 * nothing to render on the server, and the snapshot is a frozen object, so
 * React's identity comparison cannot loop.
 */
export function useNavigationPending(): boolean {
  const snapshot = useSyncExternalStore(
    subscribeToNavigation,
    getNavigationState,
    getServerNavigationState,
  );
  return snapshot.href !== null;
}

/** A stable function that clears the in-flight state, for a caller that owns the outcome. */
export function useSettleNavigation(): () => void {
  return useCallback(() => settleNavigation(), []);
}
