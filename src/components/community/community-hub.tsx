"use client";

import {
  useCallback,
  useId,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "@/components/ui/cx";
import {
  COMMUNITY_TABS,
  DEFAULT_COMMUNITY_TAB,
  hashForTab,
  nextTabForKey,
  panelForAnchor,
  tabFromHash,
  type CommunityTabId,
} from "./community-tabs";
import {
  currentPathname,
  getHashSnapshot,
  getSearchSnapshot,
  getServerHashSnapshot,
  subscribeToUrl,
  writeUrl,
} from "./url-store";

export interface CommunityHubProps {
  whatsappPanel: ReactNode;
  resourcesPanel: ReactNode;
  partnersPanel: ReactNode;
}

/**
 * The community hub: three sections behind one tab list.
 *
 * The panels arrive already rendered, so the data stays on the server and this
 * component only decides which one is visible.
 *
 * Accessibility and no-JavaScript behaviour are the same decision: every panel
 * is in the DOM, and the inactive two carry `hidden`. A crawler indexes all
 * three sections, and a visitor whose JavaScript fails still reads every section
 * in order; only the switching stops working.
 *
 * Keyboard model follows the WAI-ARIA tabs pattern: arrow keys move between tabs
 * with wrap-around, Home and End jump to the ends, and only the selected tab is
 * in the tab sequence, so the list costs the keyboard user one stop, not three.
 *
 * State: the selected tab is the URL hash and nothing else. It is read through
 * `useSyncExternalStore`, so there is no copy in React state to fall out of step
 * with a deep link, a hand-edited hash or the back button. Writes use
 * `replaceState` because switching tabs is not a navigation, and filling the back
 * button with tab switches would make leaving the page tedious.
 */
export function CommunityHub({ whatsappPanel, resourcesPanel, partnersPanel }: CommunityHubProps) {
  const prefix = useId();
  const hash = useSyncExternalStore(subscribeToUrl, getHashSnapshot, getServerHashSnapshot);
  const search = useSyncExternalStore(subscribeToUrl, getSearchSnapshot, () => "");
  const active: CommunityTabId =
    tabFromHash(hash) ?? panelForAnchor(hash) ?? DEFAULT_COMMUNITY_TAB;
  const tabRefs = useRef<Partial<Record<CommunityTabId, HTMLButtonElement | null>>>({});

  const panels: Record<CommunityTabId, ReactNode> = {
    whatsapp: whatsappPanel,
    resources: resourcesPanel,
    partners: partnersPanel,
  };

  const selectTab = useCallback(
    (next: CommunityTabId, moveFocus: boolean) => {
      // The query string is carried over: a filtered directory stays filtered
      // when the reader looks at the resources and comes back.
      writeUrl(`${currentPathname()}${search}${hashForTab(next)}`, "replace");
      if (moveFocus) tabRefs.current[next]?.focus();
    },
    [search],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: CommunityTabId) => {
    const next = nextTabForKey(current, event.key);
    if (next === null) return;
    // Only the keys handled here are claimed: Tab, Escape and typing pass through.
    event.preventDefault();
    selectTab(next, true);
  };

  return (
    <div className="mt-6">
      {/*
        No rule under the tab row. Each panel opens with a `SectionHeading`, whose
        own hairline is the single break at that boundary; a `border-b` here put a
        second rule a few pixels above it, which is the doubled break the divider
        convention forbids.
      */}
      <div
        role="tablist"
        aria-label="Community sections"
        aria-orientation="horizontal"
        className="flex flex-wrap gap-2"
      >
        {COMMUNITY_TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              type="button"
              role="tab"
              id={`${prefix}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${prefix}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab.id, false)}
              onKeyDown={(event) => onKeyDown(event, tab.id)}
              className={cx(
                "inline-flex min-h-11 items-center rounded-full border px-4 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
                selected
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-hair-strong text-cream-mute hover:border-accent/60 hover:text-cream",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {COMMUNITY_TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <section
            key={tab.id}
            role="tabpanel"
            id={`${prefix}-panel-${tab.id}`}
            aria-labelledby={`${prefix}-tab-${tab.id}`}
            hidden={!selected}
            className="pt-8"
          >
            {panels[tab.id]}
          </section>
        );
      })}
    </div>
  );
}
