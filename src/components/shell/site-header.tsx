import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { EditionSwitcher } from "./edition-switcher";
import { HeaderTabs, HeaderTabsLive } from "./header-tabs";

/** Header row height from 900px up. Anchored content is offset with scroll-padding-top. */
export const HEADER_HEIGHT_PX = 68;

/** Header row height on phones, where vertical space is at a premium. */
export const HEADER_HEIGHT_MOBILE_PX = 60;

/**
 * How far the logo's bottom edge sits below the header row's bottom border.
 *
 * The header never clips, so the logo paints over the row's hairline and the space beneath it, and
 * the header's own stacking context (z-40) keeps it above page content.
 *
 * The logo is a direct child of a plain wrapper rather than of the blurred row. Both the row and
 * the mobile edition bar set backdrop-filter, and that alone creates a stacking context, so a logo
 * nested inside the row could never paint above the bar that follows it. From the wrapper, the
 * logo's z-index applies across the whole header and the overhang stays visible on phones, where it
 * sits in the edition bar's top padding.
 */
export const LOGO_OVERHANG_PX = 20;

/**
 * Site header: sticky, blurred, hairline-ruled, with the logo overhanging the bottom edge.
 *
 * A Server Component. The edition switcher and the tab links are the only interactive pieces.
 *
 * The tabs read the pathname, so they sit in a Suspense boundary: routes whose dynamic params are
 * unknown at build time can then still prerender the header (see the cacheComponents notes in
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md). The fallback
 * renders the same list with nothing marked current, so nothing shifts when the pathname arrives.
 *
 * Space at 900px is tight: five tracked labels, the edition group and the search button must all
 * fit on one row beside a 190px logo. The sizes below are the ones at which that fits, and they
 * relax from 1100px where there is room.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      <div className="relative">
        {/*
          The logo comes first in the DOM so it is the first tab stop in the header; it is
          absolutely positioned, so DOM order has no visual effect. Its box is exactly the row's
          height, and the link is pushed LOGO_OVERHANG_PX below it. The box must not intercept
          pointer events: only the link does.
        */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[60px] min-[900px]:h-[68px]">
          <Link
            href="/"
            className="pointer-events-auto absolute bottom-0 left-4 z-10 block min-[900px]:left-7"
            style={{ transform: `translateY(${LOGO_OVERHANG_PX}px)` }}
          >
            {/* The image's alt text is the link's accessible name. */}
            <Image
              src="/brand/logo-640.webp"
              alt="TMLGuide home"
              width={1682}
              height={488}
              sizes="(min-width: 900px) 190px, 150px"
              loading="eager"
              fetchPriority="high"
              className="h-auto w-[150px] min-[900px]:w-[190px]"
            />
          </Link>
        </div>

        <div className="border-b border-hair bg-ground/85 backdrop-blur-xl">
          <div className="mx-auto flex h-[60px] max-w-[1240px] items-center gap-3 px-4 min-[900px]:h-[68px] min-[900px]:gap-4 min-[1100px]:gap-5 min-[900px]:px-7">
            {/* Reserves the logo's horizontal space; the logo itself is out of flow. */}
            <div aria-hidden="true" className="w-[150px] shrink-0 min-[900px]:w-[190px]" />

            <nav
              aria-label="Primary"
              className="hidden min-w-0 flex-1 items-center justify-center gap-4 min-[900px]:flex min-[1100px]:gap-5"
            >
              <Suspense fallback={<HeaderTabs pathname={null} />}>
                <HeaderTabsLive />
              </Suspense>
            </nav>

            <div className="ml-auto flex items-center gap-2 min-[900px]:gap-3">
              <div className="hidden min-[900px]:block">
                <EditionSwitcher variant="inline" />
              </div>
              {/*
                The search overlay is built by another workstream and mounts on this button, found
                by the data-search-trigger attribute. No handler belongs here until then.
              */}
              <button
                type="button"
                aria-label="Search"
                data-search-trigger=""
                className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-hair-strong px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-cream-mute transition-colors hover:border-hair-strong hover:text-cream min-[1100px]:px-3.5"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  className="h-4 w-4 shrink-0"
                >
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="m12.9 12.9 4 4" />
                </svg>
                <span className="hidden min-[1100px]:inline">Search</span>
              </button>
            </div>
          </div>
        </div>

        {/*
          Phones get the edition switch in a slim bar under the header. The top padding leaves the
          logo's overhang a clear strip of empty bar, so the logo never lands on the segments.
        */}
        <div className="border-b border-hair bg-ground/90 px-4 pb-2 pt-7 backdrop-blur-xl min-[900px]:hidden">
          <EditionSwitcher variant="stacked" />
        </div>

        {/*
          From 900px up nothing clears the logo overhang except this strip, so the header reserves
          the space itself instead of leaving every page to add top padding. It is transparent, so
          the logo still reads as overhanging the row's hairline, and content scrolling up passes
          behind it exactly as the design calls for. Phones need no strip: the edition bar above
          already has padding over the same distance.
        */}
        <div aria-hidden="true" className="hidden min-[900px]:block" style={{ height: LOGO_OVERHANG_PX }} />
      </div>
    </header>
  );
}
