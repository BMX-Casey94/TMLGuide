import { Suspense, type ReactNode } from "react";
import { EditionProvider } from "./edition-context";
import { MobileTabBar, MobileTabBarLive } from "./mobile-tabbar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export interface SiteShellProps {
  children: ReactNode;
}

/**
 * Composes the site chrome: edition state, header, page content, footer and the mobile tab bar.
 *
 * A Server Component on purpose. The interactive pieces (edition state, tab links, tab bar) are
 * Client Components mounted inside it, so the shell itself ships no JavaScript.
 *
 * Pages render their own <main id="main">, which is where the skip link in the root layout sends
 * focus. This component therefore only supplies the skip-link target and never a second landmark,
 * and it adds no top offset: the header reserves its own logo overhang, so pages start flush.
 *
 * The column is at least one viewport tall and the content wrapper grows, so short pages still put
 * the footer at the bottom of the window rather than halfway up it.
 */
export function SiteShell({ children }: SiteShellProps) {
  return (
    <EditionProvider>
      <div id="content-start" className="flex min-h-dvh flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </div>
      {/*
        The bar reads the pathname, so it sits in a Suspense boundary: routes whose dynamic params
        are unknown at build time can then still prerender the shell. The fallback draws the same
        bar with nothing marked current, so the fixed element never pops in after hydration.
      */}
      <Suspense fallback={<MobileTabBar pathname={null} />}>
        <MobileTabBarLive />
      </Suspense>
    </EditionProvider>
  );
}
