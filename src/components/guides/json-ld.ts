/**
 * JSON-LD for the guide pages.
 *
 * `BreadcrumbList` only. Article and Product markup are deliberately absent: a
 * chapter carries a check date that moves, and an Offer built from a price the site
 * does not own would be a claim it cannot keep current. A stale rich result is worse
 * than no rich result.
 *
 * Every `<` is escaped before the payload is handed to `<script>`, so a chapter
 * title containing `</script>` cannot close the element early.
 */

export interface BreadcrumbEntry {
  readonly name: string;
  readonly path: string;
}

export interface BreadcrumbListJsonLd {
  readonly "@context": "https://schema.org";
  readonly "@type": "BreadcrumbList";
  readonly itemListElement: readonly {
    readonly "@type": "ListItem";
    readonly position: number;
    readonly name: string;
    readonly item: string;
  }[];
}

/** Builds a `BreadcrumbList` from site paths, with positions starting at 1. */
export function breadcrumbListJsonLd(entries: readonly BreadcrumbEntry[]): BreadcrumbListJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.path,
    })),
  };
}

/**
 * Serialises markup for a `<script type="application/ld+json">` element.
 *
 * `<` is escaped because a `</script>` inside any string would end the element
 * early; `&` is escaped for the same class of reason and costs nothing here.
 */
export function serialiseJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/&/g, "\\u0026");
}
