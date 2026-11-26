import path from "node:path";
import type { NextConfig } from "next";

import { legacyRedirects } from "./src/lib/seo/legacy-redirects";

/**
 * A stable build id so the committed CSP hash manifest matches Vercel's build.
 *
 * Next mints a random id for every build by default (and using `git rev-parse HEAD`
 * creates a chicken-and-egg mismatch: committing the generated manifest changes
 * `VERCEL_GIT_COMMIT_SHA` on Vercel, which changes the buildId inline script hash).
 * A stable id ensures the local release build and Vercel's build emit identical
 * inline bootstrap scripts.
 */
function commitBuildId(): string {
  return "tmlguide-v3";
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  generateBuildId: async () => commitBuildId(),
  /**
   * Permanent redirects for the addresses the previous sites published.
   *
   * The table lives in `src/lib/seo/legacy-redirects.ts` so a unit test reads the
   * same rules the build applies. It asserts there are no loops, that every
   * destination is a route v3 actually serves, and that no source shadows one.
   *
   * `redirects()` is matched before the filesystem, so a rule whose source is also
   * a live page would make that page unreachable. That is the failure this table is
   * most exposed to as v3 grows, which is why the test reads the real route list
   * rather than a copy of it.
   */
  async redirects() {
    return legacyRedirects();
  },
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
