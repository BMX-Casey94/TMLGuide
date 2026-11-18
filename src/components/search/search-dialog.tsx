import { cache } from "react";
import { buildSearchIndex } from "@/lib/search/build";
import type { SearchEntry } from "@/lib/search/types";
import { SearchDialogClient } from "./search-dialog-client";

/**
 * The index, built once per request.
 *
 * `cache` is React's request-scoped memo: within one render pass the index is
 * built once however many components ask for it, and the cache is discarded
 * between requests. That is the only safe place for this memo — a module-level
 * variable would be shared across concurrent requests and could be poisoned by a
 * test.
 */
const getIndex = cache((): SearchEntry[] => buildSearchIndex());

/**
 * The global search palette, mounted once in the layout.
 *
 * A Server Component: it builds the index from the validated data files on the
 * server and hands it to the client palette as data. That keeps every dataset out
 * of the browser bundle — the client receives finished entries, not the modules
 * that produced them — and it means the palette has its results before the
 * visitor types a character.
 */
export function SearchDialog() {
  return <SearchDialogClient index={getIndex()} />;
}
