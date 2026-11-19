import Link from "next/link";
import type { GuideEdition } from "@/content/schema";
import { editionLabel, editionPath } from "@/content";
import "./guides.css";

/**
 * The breadcrumb above a chapter.
 *
 * A `nav` landmark with an ordered list, which is the shape assistive technology
 * expects, and `aria-current="page"` on the last crumb. The current page is not a
 * link, because a link to where you already are is noise in a keyboard tab order.
 */

export interface Crumb {
  readonly href?: string;
  readonly label: string;
}

export interface BreadcrumbsProps {
  readonly crumbs: readonly Crumb[];
}

export function Breadcrumbs({ crumbs }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="tml-guide-crumbs">
      <ol className="tml-guide-crumbs__list">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="tml-guide-crumbs__item">
              {crumb.href === undefined || isLast ? (
                <span
                  className="tml-guide-crumbs__current"
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="tml-guide-crumbs__link">
                  {crumb.label}
                </Link>
              )}
              {isLast ? null : (
                <span className="tml-guide-crumbs__sep" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The crumbs for an edition hub: Guides / Edition. */
export function editionCrumbs(edition: GuideEdition): readonly Crumb[] {
  return [
    { href: "/guides", label: "Guides" },
    { href: editionPath(edition), label: editionLabel(edition) },
  ];
}

/** The crumbs for a chapter: Guides / Edition / Chapter. */
export function chapterCrumbs(edition: GuideEdition, chapterTitle: string): readonly Crumb[] {
  return [...editionCrumbs(edition), { label: chapterTitle }];
}
