import { SALE_EDITION_LABELS, type NextSale } from "./next-sale";
import { SaleCountdown } from "./sale-countdown";

export interface NextSaleStripProps {
  /** The soonest unopened sale, or null when every verified moment has opened. */
  readonly next: NextSale | null;
  /** The date the data was last checked, as a calendar date. */
  readonly checkedOn: string;
  /** The same date, formatted for display. */
  readonly checkedOnLabel: string;
  /** The server's clock as an ISO instant, handed to the countdown as its start. */
  readonly serverNowIso: string;
}

/**
 * The "next sale" strip beneath the hero.
 *
 * It shows one moment: the soonest across every edition, in the zone the sale
 * was published in, plus the same instant in London because most of this site's
 * readers plan from the UK. The countdown is the only interactive part, and it
 * receives the server's clock so its first paint matches the server's HTML.
 *
 * When nothing is ahead the strip says so and points at the sale timeline rather
 * than inventing a date.
 */
export function NextSaleStrip({ next, checkedOn, checkedOnLabel, serverNowIso }: NextSaleStripProps) {
  if (next === null) {
    return (
      <section className="home-next" aria-labelledby="next-sale-heading">
        <div className="home-next__headline">
          <p className="label text-accent">Next sale</p>
          <h2 id="next-sale-heading" className="home-next__title">
            No further sale is published
          </h2>
          <p className="home-next__empty">
            Every sale moment verified so far has opened, and no later one has been announced. The
            sale timeline keeps the full list, with the source and the check date for each moment.
          </p>
        </div>
      </section>
    );
  }

  const { window: sale } = next;

  return (
    <section className="home-next" aria-labelledby="next-sale-heading">
      <div className="home-next__grid">
        <div className="home-next__headline">
          <p className="label text-accent">Next sale · {SALE_EDITION_LABELS[sale.edition]}</p>
          <h2 id="next-sale-heading" className="home-next__title">
            {sale.name}
          </h2>
          <p className="home-next__meta">
            <span className="home-next__meta-item">
              <span className="label text-cream-mute">Local</span>
              <time dateTime={sale.opensAtIso}>{next.localLabel}</time>
            </span>
            <span className="home-next__meta-item">
              <span className="label text-cream-mute">London</span>
              {next.londonLabel}
            </span>
          </p>
          <p className="home-next__audience">{sale.audience}</p>
        </div>

        <SaleCountdown opensAtIso={sale.opensAtIso} serverNowIso={serverNowIso} />
      </div>

      <p className="home-next__source">
        Source{" "}
        <a className="home-next__source-link" href={sale.source.url} target="_blank" rel="noopener noreferrer">
          {sale.source.title}
          <span aria-hidden="true"> ↗</span>
        </a>
        . Checked <time dateTime={checkedOn}>{checkedOnLabel}</time>.{" "}
        <a className="home-next__source-link" href="/tools/sale-timeline">
          Full sale timeline
          <span aria-hidden="true"> →</span>
        </a>
      </p>
    </section>
  );
}
