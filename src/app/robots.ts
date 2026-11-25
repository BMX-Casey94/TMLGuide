import type { MetadataRoute } from "next";

import { absoluteUrl, siteOrigin } from "@/lib/seo/site";

/**
 * `/robots.txt`.
 *
 * `allow: "/"` rather than a list of allowed paths: a crawler that meets only
 * `Disallow` lines for four prefixes and no `Allow` may treat everything else as
 * unclear, and the site wants its public pages crawled.
 *
 * The three disallowed prefixes are the routes that must not be indexed even if
 * a crawler ignores the `noindex` meta tag:
 *
 * - `/admin` — the publishing console.
 * - `/api/` — route handlers. A crawler that reaches one spends the site's
 *   rate-limit budget and gets JSON it cannot index.
 * - `/offline` — the service-worker fallback, which is meaningless without a
 *   dropped connection behind it.
 *
 * `/kit` is not listed. It is `noindex, nofollow` in its own metadata and is not
 * linked from anywhere, and robots.txt is a public file: naming the internal UI
 * reference there advertises it. The meta tag is the control that matters, and it
 * works without publishing the path.
 *
 * The `sitemap` line is absolute. A relative value is not valid here, and some
 * crawlers silently skip the file rather than resolving it.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/offline"],
    },
    sitemap: absoluteUrl("/sitemap.xml", origin),
  };
}
