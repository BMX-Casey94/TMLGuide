// @vitest-environment node
import { describe, expect, it } from "vitest";

import { socialMetadata } from "./social";

/**
 * The Open Graph and Twitter block every public page spreads in.
 *
 * Next replaces the whole `openGraph` object rather than merging it, so a page
 * that declares one must declare all of it: a partial object silently loses
 * `siteName` and `locale`. This helper exists so the complete set is written
 * once, and these tests pin what "complete" means.
 */

const INPUT = {
  path: "/tools/maps",
  title: "Venue & DreamVille maps",
  description: "Schematic planning maps for De Schorre and DreamVille.",
} as const;

describe("socialMetadata", () => {
  it("builds an Open Graph block for a website by default", () => {
    expect(socialMetadata(INPUT).openGraph).toMatchObject({
      type: "website",
      siteName: "TMLGuide",
      title: "Venue & DreamVille maps | TMLGuide",
      description: INPUT.description,
      url: "/tools/maps",
      locale: "en_GB",
    });
  });

  it("uses the article type when a page asks for it", () => {
    expect(socialMetadata({ ...INPUT, type: "article" }).openGraph).toMatchObject({
      type: "article",
    });
  });

  it("uses the underscore form of the locale, which Open Graph specifies", () => {
    // `en-GB` is the BCP 47 tag for `lang` and `hreflang`; `og:locale` wants
    // `en_GB`, and a crawler given the hyphenated form ignores it.
    expect(socialMetadata(INPUT).openGraph).toMatchObject({ locale: "en_GB" });
  });

  it("keeps the page's own path as og:url, so a share links to the page", () => {
    for (const path of ["/", "/community", "/tools/winter-timer", "/community/news"]) {
      expect(socialMetadata({ ...INPUT, path }).openGraph).toMatchObject({ url: path });
    }
  });

  it("builds a summary card carrying the same title and description", () => {
    expect(socialMetadata(INPUT).twitter).toMatchObject({
      card: "summary",
      title: "Venue & DreamVille maps | TMLGuide",
      description: INPUT.description,
    });
  });

  it("claims no image, because there is no per-page artwork to claim", () => {
    // A `summary_large_image` card with no image renders as a blank rectangle,
    // so the card stays `summary` until artwork exists.
    const result = socialMetadata(INPUT);
    const openGraph = result.openGraph as { images?: unknown };
    const twitter = result.twitter as { images?: unknown; card?: string };

    expect(openGraph.images).toBeUndefined();
    expect(twitter.images).toBeUndefined();
    expect(twitter.card).toBe("summary");
  });

  it("does not duplicate the site name when the title already carries it", () => {
    // `TITLE | TMLGuide` is this module's job, so a page title containing it would
    // otherwise render as `X | TMLGuide | TMLGuide`.
    const result = socialMetadata({ ...INPUT, title: "Maps" });
    expect((result.openGraph as { title?: string }).title).toBe("Maps | TMLGuide");
  });
});
