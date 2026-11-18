"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { resolveSearchEdition } from "@/lib/search/edition-scope";
import type { EditionScope, SearchEntry } from "@/lib/search/types";
import { SearchPalette } from "./search-palette";

export interface SearchDialogClientProps {
  /** The index, built on the server and passed down as data. */
  index: readonly SearchEntry[];
}

/**
 * The palette with Next.js wiring attached: navigation through the App Router,
 * and the edition to boost, read from the address when it is opened.
 *
 * This is the only file in the search folder that knows about Next, so the
 * palette itself stays a plain React component that the behaviour tests can
 * render without a router.
 */
export function SearchDialogClient({ index }: SearchDialogClientProps) {
  const router = useRouter();

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

  /**
   * Read lazily, when the palette opens, rather than on every render.
   *
   * The edition a visitor wants depends on the address they are on *now*, and
   * that can change between two openings without this component re-rendering
   * (a push to another route does not remount a layout child). Reading
   * `window.location` at open time is both cheaper and more accurate than
   * subscribing to `usePathname`, and it sidesteps the Suspense boundary that
   * hook needs under `cacheComponents`.
   */
  const edition = useCallback((): EditionScope | null => {
    return resolveSearchEdition({
      pathname: window.location.pathname,
      search: window.location.search,
      bodyEdition: document.body.dataset.ed,
    });
  }, []);

  return <SearchPalette index={index} navigate={navigate} resolveEdition={edition} />;
}
