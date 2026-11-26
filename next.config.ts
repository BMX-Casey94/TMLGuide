import path from "node:path";
import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";

import { legacyRedirects } from "./src/lib/seo/legacy-redirects";

/**
 * A build id that is a function of the commit rather than of the moment.
 *
 * Next mints a random id for every build by default and embeds it in the
 * prerendered flight payloads, so two builds of the same commit produce different
 * inline scripts and therefore different hashes. That is harmless when the hashes
 * are read from disk at runtime, and fatal for a manifest committed ahead of the
 * build: it would describe the previous build's bytes.
 *
 * Deriving the id from the commit makes a build reproducible. The same commit
 * produces the same id on a laptop, in CI and on the host, so the committed
 * manifest matches the build it ships with. `VERCEL_GIT_COMMIT_SHA` is read first
 * because it is what the platform provides; a local git checkout is the fallback.
 */
function commitBuildId(): string {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.GIT_COMMIT_SHA?.trim();
  if (fromEnv) return fromEnv.slice(0, 40);

  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: import.meta.dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (sha !== "") return sha.slice(0, 40);
  } catch {
    // Not a git checkout, or git is unavailable.
  }

  /*
    No commit to pin to. `development` is stable, so two local builds still agree
    with each other; a deployment that reaches this branch has no reproducible
    identity and the release check reports the manifest as stale rather than
    guessing.
  */
  return "development";
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
