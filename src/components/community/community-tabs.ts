/**
 * Tab order and hash mapping for the community hub.
 *
 * Separated from the component so the keyboard model can be tested as plain
 * functions. The order is fixed rather than derived, because the tab order is a
 * deliberate reading order (join a group, then find a tool, then read the
 * partner disclosures) and must not change when a section is empty.
 */

export const COMMUNITY_TAB_IDS = ["whatsapp", "resources", "partners"] as const;

export type CommunityTabId = (typeof COMMUNITY_TAB_IDS)[number];

export interface CommunityTabDefinition {
  readonly id: CommunityTabId;
  /** Visible tab label. */
  readonly label: string;
  /** The URL hash that deep-links to this tab, without the "#". */
  readonly hash: string;
}

export const COMMUNITY_TABS: readonly CommunityTabDefinition[] = [
  { id: "whatsapp", label: "WhatsApp groups", hash: "whatsapp-groups" },
  { id: "resources", label: "Resources", hash: "resources" },
  { id: "partners", label: "Partners", hash: "partners" },
];

export const DEFAULT_COMMUNITY_TAB: CommunityTabId = "whatsapp";

/** Maps a `location.hash` (with or without "#") to a tab, or null when it names none. */
export function tabFromHash(hash: string): CommunityTabId | null {
  const value = hash.replace(/^#/, "").trim().toLowerCase();
  if (value === "") return null;
  const match = COMMUNITY_TABS.find((tab) => tab.hash === value || tab.id === value);
  return match?.id ?? null;
}

/** The hash for a tab, including "#". */
export function hashForTab(id: CommunityTabId): string {
  const tab = COMMUNITY_TABS.find((candidate) => candidate.id === id);
  return `#${tab?.hash ?? COMMUNITY_TABS[0].hash}`;
}

/**
 * The tab a key press moves to, following the WAI-ARIA tabs pattern:
 * Left/Right wrap around, Home/End jump to the ends, and any other key returns
 * null so the caller leaves the event alone.
 */
export function nextTabForKey(
  current: CommunityTabId,
  key: string,
): CommunityTabId | null {
  const index = COMMUNITY_TAB_IDS.indexOf(current);
  if (index === -1) return null;

  switch (key) {
    case "ArrowRight":
      return COMMUNITY_TAB_IDS[(index + 1) % COMMUNITY_TAB_IDS.length];
    case "ArrowLeft":
      return COMMUNITY_TAB_IDS[(index - 1 + COMMUNITY_TAB_IDS.length) % COMMUNITY_TAB_IDS.length];
    case "Home":
      return COMMUNITY_TAB_IDS[0];
    case "End":
      return COMMUNITY_TAB_IDS[COMMUNITY_TAB_IDS.length - 1];
    default:
      return null;
  }
}

