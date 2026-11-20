import { PageLoading } from "@/components/loading/page-loading";

/**
 * The route-level Suspense fallback for the whole app.
 *
 * Next renders this instantly on a navigation and replaces it when the segment
 * streams in. Before it existed, a click that had to wait for a server render
 * showed nothing at all: the palette closed and the old page sat there, which is
 * what made the wait look like a failure.
 *
 * `role="status"` with `aria-live="polite"` is inside `PageLoading`, so a screen
 * reader hears "Loading page" once rather than silence. The visual text is
 * `aria-hidden` because it says the same thing: two announcements for one wait
 * is noise.
 */
export default function Loading() {
  return <PageLoading />;
}
