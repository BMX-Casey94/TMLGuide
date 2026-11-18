import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ButterflyTrail } from "@/components/ui/butterfly-trail";
import { editionFestivals, type EditionFestival, type OverviewRecord } from "./editions-summary";
import { formatDateRange } from "./format";

export interface HomeHeroProps {
  /** The shared edition overview, so the facts row is read from the data. */
  readonly editions: readonly OverviewRecord[];
  /** The oldest check date across the data the page renders. */
  readonly checkedOnLabel: string;
  /**
   * The next-sale area. It is a slot because it needs the server's clock, which
   * means it renders behind its own Suspense boundary; keeping it out of this
   * component leaves the heading and the facts row in the static shell, where a
   * crawler finds them without waiting for anything.
   */
  readonly saleSlot: ReactNode;
}

/**
 * The facts row under the sale strip: the dates each edition runs, read from the
 * shared overview. Only dates present in the data appear, so an edition without
 * a published date shows nothing rather than an estimate.
 */
function FactsRow({ festivals }: { festivals: readonly EditionFestival[] }) {
  const withDates = festivals.filter((festival) => festival.dates.length > 0);
  if (withDates.length === 0) return null;

  return (
    <ul className="home-facts" aria-label="Festival dates by edition">
      {withDates.map((festival) => (
        <li key={festival.id} className="home-fact">
          <p className="home-fact__name">{festival.name}</p>
          <ul className="home-edition__dates">
            {festival.dates.map((entry) => (
              <li key={`${entry.startsOn}-${entry.endsOn}`}>
                {entry.label === null ? null : (
                  <span className="home-fact__label">{entry.label} · </span>
                )}
                <time dateTime={entry.startsOn}>
                  {formatDateRange(entry.startsOn, entry.endsOn)}
                </time>
              </li>
            ))}
          </ul>
          {festival.location === null ? null : (
            <p className="home-fact__where">{festival.location}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The hero: one sentence about what the site is, the two things most readers
 * came for, then the next sale and the dates.
 *
 * The header already carries the wordmark, so nothing here repeats it at a large
 * size. The edition accent is the page's only large colour, applied through
 * `--ea`, which the body element drives from the edition switcher in the header.
 */
export function HomeHero({ editions, checkedOnLabel, saleSlot }: HomeHeroProps) {
  const festivals = editionFestivals(editions);

  return (
    <div className="home-hero">
      <ButterflyTrail side="right" opacity={0.5} drift="slow" priority />
      <div className="home-hero__inner">
        <p className="home-hero__kicker label">
          <span className="home-hero__kicker-rule" aria-hidden="true" />
          Independent fan guide
        </p>

        <h1 className="home-hero__title">
          The independent guide to Tomorrowland: tickets, travel, DreamVille and the tools to plan
          it
        </h1>

        <p className="home-hero__lede">
          Every price and date here names the official page it came from and the day it was checked.
          No ticket sellers, no estimates, no borrowed artwork.
        </p>

        <div className="home-hero__actions">
          <ButtonLink href="/guides" size="lg">
            Plan your trip
          </ButtonLink>
          <ButtonLink href="/tools/sale-timeline" variant="secondary" size="lg">
            Check ticket dates
          </ButtonLink>
        </div>

        {saleSlot}

        <FactsRow festivals={festivals} />

        <p className="home-hero__footnote">
          Dates read from the shared edition overview, checked {checkedOnLabel}.{" "}
          <Link className="home-trust__link" href="/about">
            How facts are checked
            <span aria-hidden="true">→</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
