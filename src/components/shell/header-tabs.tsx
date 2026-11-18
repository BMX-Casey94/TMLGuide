"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DESKTOP_NAV, activeHref } from "./nav";

export interface HeaderTabsProps {
  /**
   * The current pathname, or null when it is not known yet. A null pathname marks nothing as
   * current, which keeps the prerender fallback and the resolved markup structurally identical.
   */
  readonly pathname: string | null;
}

/**
 * Tab sizing. At 900px five tracked labels, the edition group and the search button share one row
 * with a 190px logo, so the labels start smaller and tighten their tracking, then grow from 1100px
 * where there is room. These are the sizes at which the row stays inside a 900px viewport.
 */
const TAB_BASE =
  "relative flex h-[68px] items-center whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] transition-colors min-[1100px]:text-[12px] min-[1100px]:tracking-[0.14em]";

/**
 * Desktop tab links. Nested paths keep the covering tab active: /guides/tickets lights the Tickets
 * tab, while /guides/dreamville lights Guides because no closer tab covers it. Only one tab ever
 * carries aria-current.
 */
export function HeaderTabs({ pathname }: HeaderTabsProps) {
  const current = pathname === null ? null : activeHref(pathname, DESKTOP_NAV);

  return (
    <>
      {DESKTOP_NAV.map((item) => {
        const isActive = current === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={[
              TAB_BASE,
              isActive
                ? "text-cream after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-accent after:content-['']"
                : "text-cream-mute hover:text-cream",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

/**
 * Reads the pathname from the router. Mount it inside a Suspense boundary so routes whose dynamic
 * params are unknown at build time can still prerender the rest of the header.
 */
export function HeaderTabsLive() {
  const pathname = usePathname();
  return <HeaderTabs pathname={pathname} />;
}
