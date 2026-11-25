import type { MetadataRoute } from "next";

import { sitemapRoutes } from "@/lib/seo/routes";
import { absoluteUrl, siteOrigin } from "@/lib/seo/site";

/**
 * `/sitemap.xml`.
 *
 * Built from `@/lib/seo/routes`, which is also what the tests and the audit
 * read, so the file cannot advertise a route the code does not list or omit one
 * it does. URLs are absolute, because a sitemap's `<loc>` must be.
 *
 * `lastModified` is a date the content was actually checked, never `new Date()`:
 * a build timestamp would tell a crawler that every page changed at every
 * deploy, and an unreliable `lastmod` is ignored for the whole file.
 *
 * Rendered statically at build time. The route reads no request data, so Next
 * prerenders it once; `siteOrigin()` is a build-time value.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();

  return sitemapRoutes().map((route) => ({
    url: absoluteUrl(route.path, origin),
    ...(route.lastModified === undefined ? {} : { lastModified: route.lastModified }),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
