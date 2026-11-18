/**
 * JSON-LD for the site's two top-level pages.
 *
 * Two rules apply. Nothing here claims an organisation: TMLGuide is not a
 * company, and `Organization` markup with no registered entity behind it is a
 * false claim to a search engine. Nothing here advertises a search endpoint
 * either: `SearchAction` describes a `?q=` URL that actually returns results,
 * and this site's search box does not yet, so the markup waits until it does.
 *
 * The output is a plain object serialised with `JSON.stringify` and with every
 * `<` escaped, which is the guidance in `node_modules/next/dist/docs/01-app/
 * 02-guides/json-ld.md`: the escape means a `</script>` inside any string cannot
 * close the element early.
 */
import { absoluteUrl } from "./routes";

/** A schema.org description of the site, without an organisation or a search action. */
export interface WebSiteJsonLd {
  readonly "@context": "https://schema.org";
  readonly "@type": "WebSite";
  readonly name: string;
  readonly url: string;
  readonly description: string;
  readonly inLanguage: string;
}

/** A schema.org description of one page within the site. */
export interface WebPageJsonLd {
  readonly "@context": "https://schema.org";
  readonly "@type": "WebPage";
  readonly name: string;
  readonly url: string;
  readonly description: string;
  readonly inLanguage: string;
  readonly isPartOf: { readonly "@type": "WebSite"; readonly name: string; readonly url: string };
}

export const SITE_NAME = "TMLGuide";

const SITE_DESCRIPTION =
  "An independent, fan-made guide to Tomorrowland: tickets, sale dates, DreamVille, travel, add-ons and Pearls, with every fact sourced and dated.";

/** The site-level description, shared with the root layout's metadata. */
export const SITE_JSONLD_DESCRIPTION = SITE_DESCRIPTION;

/** Site-level markup: name, URL, description and language. No organisation, no search action. */
export function websiteJsonLd(): WebSiteJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "en-GB",
  };
}

/**
 * Page-level markup, tied back to the site node by name and URL rather than by
 * `@id`, because a `@id` reference to a node on another page resolves to
 * nothing on a page that only carries its own script.
 */
export function webPageJsonLd(path: string, name: string, description: string): WebPageJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    url: absoluteUrl(path),
    description,
    inLanguage: "en-GB",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
  };
}

/**
 * Serialises markup for a `<script type="application/ld+json">` element.
 *
 * `<` is escaped because a `</script>` sequence anywhere in a string would end
 * the element early; `&` is escaped for the same class of reason and costs
 * nothing here.
 */
export function serialiseJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/&/g, "\\u0026");
}
