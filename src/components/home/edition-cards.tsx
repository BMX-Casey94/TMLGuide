import Link from "next/link";
import { CardCarousel } from "@/components/ui/card-carousel";
import { SectionAction, SectionHeading } from "@/components/ui/section-heading";
import { editionFestivals, type EditionFestival, type OverviewRecord } from "./editions-summary";
import { formatDateRange, formatLongDate } from "./format";
import { belgiumFromPrice, brasilFromPrice, winterFromPrice, type FromPrice } from "./prices";

export interface EditionCardsProps {
  /** The shared edition overview, passed in so the section holds no data of its own. */
  readonly editions: readonly OverviewRecord[];
}

/** The accent each edition's card carries, matching `body[data-ed]` in globals.css. */
const EDITION_ACCENTS: Record<EditionFestival["id"], string> = {
  belgium: "#ffc83d",
  winter: "#8edbff",
  brasil: "#ff8a5c",
};

/** The page an edition card opens, with the edition preselected in the guide. */
export function ticketGuideHref(edition: EditionFestival["id"]): string {
  return `/guides/tickets?edition=${edition}`;
}

/** Reads the card figure for one edition from the validated data. */
function priceFor(edition: EditionFestival["id"]): FromPrice | null {
  if (edition === "belgium") return belgiumFromPrice();
  if (edition === "winter") return winterFromPrice();
  return brasilFromPrice();
}

function EditionCard({ festival }: { festival: EditionFestival }) {
  const price = priceFor(festival.id);

  return (
    <article
      className="home-edition"
      style={{ ["--ea" as string]: EDITION_ACCENTS[festival.id] }}
      aria-labelledby={`edition-${festival.id}`}
    >
      <div className="home-edition__body">
        <p className="home-edition__swatch">
          <span className="home-edition__swatch-mark" aria-hidden="true" />
          {festival.name}
        </p>

        <h3 id={`edition-${festival.id}`} className="home-edition__name">
          {/*
            One link per card, stretched over the whole surface by CSS, so a
            pointer anywhere opens the guide while the heading keeps the
            accessible name. The source link below sits above it.
          */}
          <Link href={ticketGuideHref(festival.id)} className="home-edition__stretch">
            Tomorrowland {festival.name}
          </Link>
        </h3>

        {festival.dates.length > 0 ? (
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
        ) : (
          <p className="home-edition__where">Dates are not published yet.</p>
        )}

        {festival.location === null ? null : (
          <p className="home-edition__where">{festival.location}</p>
        )}

        {price === null ? (
          <div className="home-edition__price">
            <span className="home-edition__from">Tickets</span>
            <span className="home-edition__status">No verified price</span>
            <p className="home-edition__price-note">
              No 2027 price an unauthenticated reader can see is published, so none is quoted here.
            </p>
          </div>
        ) : (
          <div className="home-edition__price">
            <span className="home-edition__from">From</span>
            <p className="home-edition__amount">{price.amountLabel}</p>
            <p className="home-edition__price-note">
              {price.productLabel}
              {price.saleLabel === null ? "" : ` · ${price.saleLabel}`}
            </p>
            {price.note === null ? null : (
              <p className="home-edition__price-note">{price.note}</p>
            )}
            {price.soldOut ? <span className="home-edition__status">Sold out</span> : null}
            <p className="home-edition__checked">
              Source{" "}
              <a
                className="home-edition__source-link"
                href={price.source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {price.source.title}
                <span aria-hidden="true"> ↗</span>
              </a>
              . Checked {formatLongDate(price.lastVerified)}.
            </p>
          </div>
        )}
      </div>

      <p className="home-edition__cta">
        Tickets guide
        <span className="home-edition__arrow" aria-hidden="true">
          →
        </span>
      </p>
    </article>
  );
}

/**
 * One card per edition: accent colour, the dates the data records, the
 * location, and a "from" price only where a figure exists. Every card opens the
 * ticket guide with its edition preselected.
 */
export function EditionCards({ editions }: EditionCardsProps) {
  const festivals = editionFestivals(editions);

  return (
    <section className="home-section" aria-labelledby="editions-heading">
      <SectionHeading
        id="editions-heading"
        kicker="Editions"
        title="Choose your edition"
        lede="Belgium is two July weekends in Boom. Winter is one week in the Alps, where a lift pass comes with the ticket. Brasil is a single weekend outside São Paulo, priced in reais."
        action={<SectionAction href="/guides">All guides</SectionAction>}
      />

      <CardCarousel label="Tomorrowland editions" className="mt-8">
        {festivals.map((festival) => (
          <EditionCard key={festival.id} festival={festival} />
        ))}
      </CardCarousel>
    </section>
  );
}
