/**
 * The global search palette.
 *
 * `SearchDialog` is the component the layout mounts: it builds the index on the
 * server and supplies the router and edition wiring. `SearchPalette` is the same
 * UI without any Next.js dependency, which is what the behaviour tests render.
 * `buildSearchIndex` is re-exported so a consumer needs only this module.
 */
export { SearchDialog } from "./search-dialog";
export { SearchPalette, NO_RESULT_SUGGESTIONS, QUICK_LINKS, SEARCH_TRIGGER_ATTRIBUTE } from "./search-palette";
export type { SearchPaletteProps } from "./search-palette";
export { buildSearchIndex } from "@/lib/search/build";
