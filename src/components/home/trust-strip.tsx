export interface TrustStripProps {
  /**
   * The date every fact on the page was last checked, as a calendar date. It is
   * passed in rather than read here so the page and this strip cannot disagree
   * about the date.
   */
  readonly checkedOn: string;
  /** The same date, already formatted for display. */
  readonly checkedOnLabel: string;
}

/**
 * The independence statement, shown as a band across the page rather than a
 * line in the footer, because "who made this and who paid for it" is the
 * question a reader asks before trusting a price.
 *
 * No decorative image here on purpose. The hero and the closing panel each carry
 * one butterfly trail, which is as much of that motif as the page needs; a third
 * would turn a flourish into a pattern.
 */
export function TrustStrip({ checkedOn, checkedOnLabel }: TrustStripProps) {
  return (
    <section className="home-trust" aria-labelledby="trust-heading">
      <div className="home-trust__inner">
        <h2 id="trust-heading" className="home-trust__line">
          <span className="home-trust__mark" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="12" height="12" focusable="false">
              <path
                d="M3 8.4 6.2 11.5 13 4.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Facts checked against official sources on{" "}
          <time dateTime={checkedOn}>{checkedOnLabel}</time>
        </h2>

        <div>
          <p className="home-trust__statement">
            TMLGuide is written and run independently. It is not affiliated with, endorsed by or
            sponsored by Tomorrowland or WeAreOne.World B.V., and no ticket, package or partner
            listing here is sold by us. Every price and date names the official page it came from
            and the day it was checked.{" "}
            <a className="home-trust__link" href="/about">
              How this site is checked
              <span aria-hidden="true">→</span>
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
