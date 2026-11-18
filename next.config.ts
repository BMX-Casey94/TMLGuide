import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The Tailwind loader scans source files as a side effect that the persistent dev cache does
    // not track, so cached CSS went stale and new utility classes (for example the radio tab's
    // top-1/2) were missing in development. Production builds are unaffected.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    root: path.resolve(import.meta.dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
