export { buildSearchIndex, kindLabel } from "./build";
export { editionFromPath, resolveSearchEdition } from "./edition-scope";
export { formatCheckedDate, formatEuro, formatInstantLong, formatReal } from "./format";
export { flattenGroups, groupResults, type ResultGroup } from "./group";
export { KIND_LABELS, KIND_ORDER, kindPrefix } from "./kinds";
export { DEFAULT_LIMIT, MAX_LIMIT, TYPO_MIN_LENGTH, WEIGHTS, search } from "./rank";
export {
  MAX_RECENT_SEARCHES,
  RECENT_SEARCHES_KEY,
  addRecentSearch,
  clearRecentSearches,
  readRecentSearches,
} from "./recent";
export { KNOWN_ROUTES, isKnownRoute, ticketsRoute, type KnownRoute } from "./routes";
export {
  QUERY_MAX,
  SNIPPET_MAX,
  collapseWhitespace,
  fold,
  highlightSegments,
  queryTokens,
  snippet,
  tokenise,
  withinOneEdit,
  type HighlightSegment,
} from "./text";
export {
  EDITION_IDS,
  EDITION_SCOPES,
  isEditionId,
  type EditionId,
  type EditionScope,
  type RankedEntry,
  type SearchEntry,
  type SearchKind,
  type SearchOptions,
} from "./types";
