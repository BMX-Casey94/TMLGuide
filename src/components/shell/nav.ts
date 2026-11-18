/**
 * Navigation configuration for the site shell.
 *
 * Every destination below is a planned route. Some routes do not exist yet; the header and tab bar
 * are built now so that pages can be added without touching the shell.
 *
 * Icons come from the shared 3D icon set in src/components/ui/icon-3d, whose name list is checked
 * against public/icons/3d by that component's own test. Reusing the type means the shell cannot
 * reference an icon that does not exist on disk.
 */

import type { Icon3DName } from "@/components/ui/icon-3d";

export type ThreeDIconName = Icon3DName;

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon?: ThreeDIconName;
}

/** Path for a 3D icon, sized for a 2x display at 28px. */
export function threeDIconSrc(name: ThreeDIconName): string {
  return `/icons/3d/${name}.webp`;
}

/**
 * Height of the mobile tab bar, re-exported from ./layout-metrics so the navigation config is a
 * single import for consumers that want destinations and metrics together.
 */
export { TABBAR_BORDER_PX, TABBAR_HEIGHT_PX, TABBAR_TOTAL_HEIGHT_PX } from "./layout-metrics";

/** Primary destinations, shown as tabs in the desktop header. */
export const DESKTOP_NAV: readonly NavItem[] = [
  { href: "/guides", label: "Guides", icon: "notebook" },
  { href: "/guides/tickets", label: "Tickets", icon: "gift" },
  { href: "/tools", label: "Tools", icon: "tools" },
  { href: "/community", label: "Community", icon: "thumb-up" },
  { href: "/radio", label: "Radio", icon: "headphone" },
];

/** Five thumb-reach destinations for the mobile bottom bar. */
export const MOBILE_TABS: readonly NavItem[] = [
  { href: "/", label: "Home", icon: "flag" },
  { href: "/guides", label: "Guides", icon: "notebook" },
  { href: "/tools", label: "Tools", icon: "tools" },
  { href: "/community", label: "Community", icon: "thumb-up" },
  { href: "/more", label: "More", icon: "setting" },
];

export interface FooterLink {
  readonly href: string;
  readonly label: string;
}

export interface FooterColumn {
  readonly title: string;
  readonly links: readonly FooterLink[];
}

/**
 * Link columns in the site footer.
 *
 * Only destinations that already exist in the navigation configuration are listed, so the footer
 * never advertises a route the site does not plan to serve. Column titles match the header tabs.
 */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: "Guides",
    links: [
      { href: "/guides", label: "All guides" },
      { href: "/guides/tickets", label: "Tickets" },
    ],
  },
  {
    title: "Tools",
    links: [{ href: "/tools", label: "Tools" }],
  },
  {
    title: "Community",
    links: [
      { href: "/community", label: "Community" },
      { href: "/radio", label: "Radio" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

/** Legal destinations in the footer's bottom row. */
export const FOOTER_LEGAL: readonly FooterLink[] = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/cookies", label: "Cookies" },
];

/**
 * True when `href` covers `pathname`. Nested paths count as active, so `/guides/tickets` keeps the
 * Guides tab lit. The home route only matches itself.
 */
export function matchesPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The single best match in `items`: the longest href that covers `pathname`. Returns null when the
 * current path belongs to none of them, so a nav never lights two entries at once.
 */
export function activeHref(pathname: string, items: readonly NavItem[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (!matchesPath(pathname, item.href)) continue;
    if (best === null || item.href.length > best.length) best = item.href;
  }
  return best;
}
