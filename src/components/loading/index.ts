/**
 * Loading indicators shared across the app.
 *
 * `Spinner` is the branded sparkle, `NavigationProgress` the thin bar that
 * reports an in-flight client navigation, and `PageLoading` the route-level
 * fallback `src/app/loading.tsx` renders. The navigation store is exported
 * because the palette has to *start* a navigation the router cannot see the
 * beginning of.
 */
export { Spinner, type SpinnerProps, type SpinnerSize } from "./spinner";
export { useNavigationPending, useSettleNavigation } from "./pending";
export {
  NavigationProgress,
  PROGRESS_DELAY_MS,
  PROGRESS_MAX_MS,
  shouldTrackClick,
} from "./navigation-progress";
export { PageLoading } from "./page-loading";
export {
  getNavigationState,
  getServerNavigationState,
  settleNavigation,
  startNavigation,
  subscribeToNavigation,
  withNavigation,
  type NavigationState,
} from "./navigation-store";
