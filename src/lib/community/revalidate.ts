/**
 * Community news invalidation.
 *
 * `revalidateTag` only works inside a request scope, because it records the
 * invalidation on the render store. A route handler has that store; a unit test,
 * a script and a build-time module do not, and calling the function there throws
 * an invariant error.
 *
 * This wrapper exists so the admin route has one call it can make unconditionally,
 * and so that the one situation where the call is impossible is logged rather than
 * thrown. The alternative — the route wrapping it in a `try`/`catch` of its own —
 * would hide the same failure somewhere less obvious and would have to be repeated
 * in every future mutation route.
 *
 * A failure here is not silent: it is logged at warn level, naming the tag, so an
 * operator who sees a stale news page has something to search the log for.
 */

import { revalidateTag } from "next/cache";
import { COMMUNITY_NEWS_TAG } from "./news";

/**
 * Marks the community news cache stale.
 *
 * `"max"` is the recommended profile: the next request is served the stale entry
 * and a fresh one is built behind it. For a news list that is the right trade —
 * an administrator who has just saved an article should not wait on a rebuild, and
 * a reader should not see a slow page because of one.
 *
 * @returns true when the invalidation was recorded, false when there was no
 *   request scope to record it in.
 */
export function revalidateCommunityNews(): boolean {
  try {
    revalidateTag(COMMUNITY_NEWS_TAG, "max");
    return true;
  } catch (error) {
    console.warn(
      `[community/news] Could not revalidate "${COMMUNITY_NEWS_TAG}": ` +
        "no request scope is available here, so the tag will clear on its own lifetime instead.",
      error,
    );
    return false;
  }
}
