import { Spinner } from "./spinner";
import "./loading.css";

/**
 * The route-level Suspense fallback: `src/app/loading.tsx` renders this.
 *
 * Next swaps this in immediately on a navigation and replaces it when the new
 * segment streams in, so it is the first thing a visitor sees after clicking
 * into a page whose data is not cached. It says three things and nothing more: a
 * sparkle, one word, and a status a screen reader can hear.
 *
 * The height is a viewport unit rather than a fixed pixel count, so the fallback
 * occupies the same region the page will: the footer does not jump into view and
 * then back down when the content arrives.
 *
 * A Server Component: no state, no clock, no client JavaScript. The animation is
 * CSS on the client side of the boundary (`spinner.tsx` is only needed where the
 * palette reuses it), and a static sparkle is a perfectly good fallback if a
 * script never arrives.
 */
export function PageLoading() {
  return (
    <div className="tml-page-loading">
      <Spinner size="page" label="Loading page" />
      <p className="tml-page-loading__text" aria-hidden="true">
        Loading…
      </p>
    </div>
  );
}

export default PageLoading;
