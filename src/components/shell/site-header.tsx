import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { A11yTrigger } from "@/components/a11y/a11y-toolbar";
import { EditionSwitcher } from "./edition-switcher";
import { HeaderTabs, HeaderTabsLive } from "./header-tabs";

/** Header row height from 900px up. Anchored content is offset with scroll-padding-top. */
export const HEADER_HEIGHT_PX = 68;

/** Header row height on phones, where vertical space is at a premium. */
export const HEADER_HEIGHT_MOBILE_PX = 60;

/**
 * Site header: sticky, blurred and hairline-ruled. The logo sits inside the row, vertically
 * centred, so it is the first tab stop and nothing hangs below the bar.
 *
 * A Server Component. The edition switcher and the tab links are the only interactive pieces.
 *
 * The tabs read the pathname, so they sit in a Suspense boundary: routes whose dynamic params are
 * unknown at build time can then still prerender the header (see the cacheComponents notes in
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md). The fallback
 * renders the same list with nothing marked current, so nothing shifts when the pathname arrives.
 *
 * Space at 900px is tight: five tracked labels and the search pill (with the edition switcher
 * inside it) must fit on one row beside the logo. The sizes below are the ones at which that
 * fits, and they relax from 1100px where there is room.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      <div className="border-b border-hair bg-ground/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-[1280px] items-center gap-4 pl-4 pr-3 min-[900px]:h-[68px] min-[900px]:gap-4 min-[900px]:pl-6 min-[900px]:pr-3 min-[1100px]:gap-5 min-[1100px]:pr-4">
          <Link href="/" className="block shrink-0">
            {/* The image's alt text is the link's accessible name. */}
            <Image
              src="/brand/logo-640.webp"
              alt="TMLGuide home"
              width={1682}
              height={488}
              sizes="(min-width: 1100px) 188px, (min-width: 900px) 160px, 120px"
              loading="eager"
              fetchPriority="high"
              className="h-auto w-[120px] min-[900px]:w-[160px] min-[1100px]:w-[188px]"
            />
          </Link>

          <nav
            aria-label="Primary"
            className="hidden min-w-0 flex-1 items-center justify-center gap-5 min-[900px]:flex min-[1100px]:gap-8"
          >
            <Suspense fallback={<HeaderTabs pathname={null} />}>
              <HeaderTabsLive />
            </Suspense>
          </nav>

          {/*
            One pill: the search field on the left, the edition switcher inside its right-hand
            end. They are siblings, because a button cannot contain a radio group.

            The widths below pay for the accessibility trigger that follows. At 900px the row is
            logo, five tab labels, pill and button; the pill keeps its original 280px because the
            tabs have just enough slack to give it (they need 310px of the 332px left over), and it
            grows at 1100px and again from 1200px, where the 1280px column has room to spare.
          */}
          <div className="group ml-auto flex h-11 min-w-0 max-w-[208px] flex-1 items-center rounded-full border border-hair-strong bg-surface/60 pr-1 transition-[border-color,box-shadow] duration-200 hover:border-accent/60 has-[input:focus]:border-accent has-[input:focus]:shadow-[0_0_0_3px_rgb(255_200_61/0.14)] min-[900px]:w-[280px] min-[900px]:max-w-none min-[900px]:flex-none min-[1100px]:w-[340px] min-[1200px]:w-[420px]">
            {/*
              A real text field. The results overlay and index come with the search workstream,
              which attaches to the data-search-trigger attribute; until then the field accepts
              input and nothing is submitted. The focus ring is drawn on the pill (border and
              glow), so the input itself shows no outline.
            */}
            <label className="flex h-full min-w-0 flex-1 cursor-text items-center gap-2 pl-3.5 pr-2">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                className="h-4 w-4 shrink-0 text-cream-mute transition-colors group-has-[input:focus]:text-accent"
              >
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m12.9 12.9 4 4" />
              </svg>
              <input
                type="search"
                name="q"
                autoComplete="off"
                enterKeyHint="search"
                aria-label="Search the guide"
                placeholder="Search"
                data-search-trigger=""
                className="search-field h-full min-w-0 flex-1 bg-transparent font-mono text-[11px] uppercase tracking-[0.12em] text-cream outline-none! ring-0! placeholder:text-cream-mute [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
            {/*
              On phones, focusing the field folds the edition switcher away so the field has the
              room; it unfolds again when focus leaves. From 900px there is room for both.
            */}
            <div className="max-w-[140px] overflow-hidden transition-[max-width,opacity] duration-300 ease-out group-has-[input:focus]:max-w-0 group-has-[input:focus]:opacity-0 min-[900px]:max-w-none min-[900px]:group-has-[input:focus]:max-w-none min-[900px]:group-has-[input:focus]:opacity-100">
              <EditionSwitcher variant="inline" />
            </div>
          </div>

          {/*
            The accessibility trigger is the last stop on the row, after the pill, so it moves
            neither the search field nor the edition switcher and the tabs stay centred between the
            logo and this end. It is hidden below 900px, where the header is tight and the mobile
            tab bar carries the same trigger as its sixth cell; the pill keeps its width there.
          */}
          <A11yTrigger variant="header" className="hidden min-[900px]:grid" />
        </div>
      </div>
    </header>
  );
}
