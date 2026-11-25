import type { Metadata } from "next";

/**
 * Open Graph and Twitter card metadata, in one place.
 *
 * Next replaces the whole `openGraph` object when a page declares one, so a
 * page that omits it inherits nothing and emits no social tags at all. Twelve
 * public pages did exactly that, which meant a link pasted into WhatsApp or
 * Discord — the two places this guide's audience actually shares links — was
 * rendered from whatever the platform could scrape. This helper gives every page
 * the same complete set, so the preview carries the page's own title, a
 * description and the correct URL rather than the home page's.
 *
 * `openGraph.locale` is `en_GB` (underscore) because the Open Graph protocol
 * specifies that form, unlike the `en-GB` BCP 47 tag used for `hreflang` and
 * `lang`.
 */

/** How Open Graph describes the kind of page; Twitter infers its card from `card`. */
export type OpenGraphType = "website" | "article";

export interface SocialMetadataInput {
  /** The page's own path, used as `og:url` so a preview links to the page itself. */
  readonly path: string;
  readonly title: string;
  readonly description: string;
  /** Defaults to "website"; a dated guide chapter uses "article". */
  readonly type?: OpenGraphType;
}

export const SITE_NAME = "TMLGuide";

/**
 * The `openGraph` and `twitter` blocks a page spreads into its metadata.
 *
 * `twitter.card` is `summary` rather than `summary_large_image`: there is no
 * per-page image, and a large-image card with no image renders as a blank
 * rectangle. When artwork exists, both this and `openGraph.images` change
 * together.
 */
export function socialMetadata({
  path,
  title,
  description,
  type = "website",
}: SocialMetadataInput): Pick<Metadata, "openGraph" | "twitter"> {
  const fullTitle = `${title} | ${SITE_NAME}`;

  return {
    openGraph: {
      type,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: path,
      locale: "en_GB",
    },
    twitter: {
      card: "summary",
      title: fullTitle,
      description,
    },
  };
}
