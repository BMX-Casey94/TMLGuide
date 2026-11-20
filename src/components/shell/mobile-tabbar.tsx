"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { A11yTrigger } from "@/components/a11y/a11y-toolbar";
import { MOBILE_TABS, activeHref, threeDIconSrc } from "./nav";
import { TABBAR_HEIGHT_PX } from "./layout-metrics";

/**
 * The tab bar's own content height, border and total footprint are declared in ./layout-metrics and
 * re-exported here so callers can take them from the component they are reading about. Server
 * Components such as the footer import the same values from ./layout-metrics: a constant imported
 * from a Client Component module arrives on the server as a client reference, not a number.
 *
 * The layout owner should set `--tabbar-h: 64px` on :root and pad any full-height layout by
 * `calc(var(--tabbar-h) + 1px + env(safe-area-inset-bottom))` (border plus inset), so nothing can
 * sit beneath the bar. The footer already reserves exactly that space below 900px.
 */
export { TABBAR_BORDER_PX, TABBAR_HEIGHT_PX, TABBAR_TOTAL_HEIGHT_PX } from "./layout-metrics";

export interface MobileTabBarProps {
  /**
   * Current pathname, or null when unknown. A null pathname marks nothing as current, which keeps
   * the prerender fallback identical in shape to the resolved markup.
   */
  readonly pathname: string | null;
}

/** The bottom tab bar. Visible below 900px only; the desktop header covers those destinations. */
export function MobileTabBar({ pathname }: MobileTabBarProps) {
  const current = pathname === null ? null : activeHref(pathname, MOBILE_TABS);

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-hair bg-ground/92 backdrop-blur-xl min-[900px]:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/*
        Six cells: the five destinations plus the accessibility trigger, which belongs here because
        the desktop header hides its own trigger below 900px and a reader on a phone needs the same
        control. Six cells at 320px are 53px wide, so the tracking starts at its tightest and relaxes
        as the viewport gives each cell room.
      */}
      <ul
        className="mx-auto grid max-w-[560px] grid-cols-6"
        style={{ height: `${TABBAR_HEIGHT_PX}px` }}
      >
        {MOBILE_TABS.map((item) => {
          // activeHref already resolves overlaps (the longest covering href wins), and matchesPath
          // makes Home match only "/", so exactly one tab can be current at a time.
          const isActive = current === item.href;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  // "Community" is nine monospace characters; at a 320px viewport a cell is 53px,
                  // so the label starts at 9px and tightens its tracking, then grows from 380px.
                  "relative flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl font-mono text-[9px] uppercase tracking-[0.02em] transition-colors min-[380px]:text-[10px] min-[380px]:tracking-[0.04em] min-[520px]:tracking-[0.1em]",
                  isActive ? "text-accent" : "text-cream-mute",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "absolute inset-x-3 top-0 h-0.5 rounded-full",
                    isActive ? "bg-accent" : "bg-transparent",
                  ].join(" ")}
                />
                {item.icon === undefined ? null : (
                  <Image
                    src={threeDIconSrc(item.icon)}
                    // Decorative: the label beneath the icon names the destination.
                    alt=""
                    width={28}
                    height={28}
                    className={[
                      "h-6 w-6 shrink-0 transition-opacity min-[380px]:h-7 min-[380px]:w-7",
                      isActive ? "opacity-100" : "opacity-75",
                    ].join(" ")}
                  />
                )}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex">
          {/* Matches the tab cells so the row reads as six peers rather than five and an oddity. */}
          <A11yTrigger
            variant="dock"
            className="text-[9px] tracking-[0.02em] min-[380px]:text-[10px] min-[380px]:tracking-[0.04em] min-[520px]:tracking-[0.1em]"
          />
        </li>
      </ul>
    </nav>
  );
}

/**
 * Reads the pathname and renders the bar. Mount inside a Suspense boundary (see SiteShell) so
 * routes with unresolved dynamic params can prerender.
 */
export function MobileTabBarLive() {
  const pathname = usePathname();
  return <MobileTabBar pathname={pathname} />;
}
