/**
 * One product in a list: name, price tiers, inclusions and its citation.
 *
 * A Server Component, so the whole list is readable with JavaScript disabled.
 * The only interaction it offers is the comparison tickbox, which is supplied by
 * the explorer as a slot: the card itself stays presentational, which keeps the
 * card testable without a client boundary.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { recordAnchor } from "@/lib/search/anchors";
import { PriceTiers } from "./price-tiers";
import { SourceLine } from "./source-line";
import type { CatalogueItem } from "./types";
import "./tickets.css";

export interface PackageCardProps {
  item: CatalogueItem;
  /** Link to the product's own view. */
  detailHref: string;
  /** The comparison control, when the explorer is interactive. */
  compareControl?: ReactNode;
  /** Heading level for the product name. */
  headingLevel?: 3 | 4;
}

export function PackageCard({
  item,
  detailHref,
  compareControl,
  headingLevel = 4,
}: PackageCardProps) {
  const Heading = `h${headingLevel}` as "h3" | "h4";
  const unpublished = item.priceStatus === "unpublished";

  return (
    <article
      id={recordAnchor(item.categoryId === "festival-tickets" ? "ticket" : "stay", item.id)}
      className={
        unpublished ? "tml-tix-card tml-tix-card--unpublished" : "tml-tix-card"
      }
      aria-labelledby={`pkg-${item.id}`}
    >
      <div className="tml-tix-card__head">
        {item.badges.length > 0 ? (
          <ul className="tml-tix-card__badges">
            {item.badges.map((badge) => (
              <li key={badge} className="tml-tix-badge">
                {badge}
              </li>
            ))}
          </ul>
        ) : null}
        <Heading className="tml-tix-card__title" id={`pkg-${item.id}`}>
          {item.name}
        </Heading>
        {item.qualifier ? <p className="tml-tix-card__qualifier">{item.qualifier}</p> : null}
      </div>

      <PriceTiers item={item} />

      {item.includes.length > 0 ? (
        <ul className="tml-tix-includes">
          {item.includes.map((inclusion) => (
            <li key={inclusion}>{inclusion}</li>
          ))}
        </ul>
      ) : null}

      <SourceLine source={item.source} lastVerified={item.lastVerified} />

      <div className="tml-tix-actions">
        <Link className="tml-tix-open" href={detailHref} aria-label={`Details for ${item.name}`}>
          Details
          <span aria-hidden="true">→</span>
        </Link>
        {compareControl}
      </div>
    </article>
  );
}
