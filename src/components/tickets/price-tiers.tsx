/**
 * Price tiers for one product.
 *
 * A product can carry more than one published price (pre-sale and WorldWide sale,
 * or standard and half-price), and every price belongs to a named sale moment in a
 * named year. The year is rendered with each tier because a bare figure beside a
 * product name is exactly how a previous season's price gets mistaken for this
 * one.
 *
 * A product with no published price renders "Price not published yet" and a link
 * to the official page instead of a figure. That state is visible and labelled,
 * never a blank a reader could read as free.
 */
import { formatIndicativeGbp } from "@/lib/currency/gbp-estimate";
import { formatMoney } from "./format";
import type { CatalogueItem } from "./types";
import "./tickets.css";

export interface PriceTiersProps {
  item: CatalogueItem;
}

/** The visible missing-price sentence, exported so a test asserts the same text. */
export const UNPUBLISHED_LABEL = "Price not published yet";

export function PriceTiers({ item }: PriceTiersProps) {
  if (item.priceStatus === "unpublished" || item.tiers.length === 0) {
    return (
      <div className="tml-tix-unpublished">
        <p className="tml-tix-unpublished__label">{UNPUBLISHED_LABEL}</p>
        {item.missingReason ? (
          <p className="tml-tix-unpublished__reason">{item.missingReason}</p>
        ) : null}
        {item.officialUrl ? (
          <p className="tml-tix-unpublished__link">
            <a
              className="tml-tix-source__link"
              href={item.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Official page
              <span className="tml-tix-sr"> for {item.name} (opens in a new tab)</span>
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="tml-tix-tiers">
      {item.tiers.map((tier) => {
        const gbpEstimate = formatIndicativeGbp(tier.amount, tier.currency);
        return (
          <li key={tier.key} className="tml-tix-tier">
            <span className="tml-tix-tier__label">
              {tier.label}
              <span className="tml-tix-sr">, {tier.year} price</span>
              <span aria-hidden="true"> · {tier.year}</span>
            </span>
            <span className="tml-tix-tier__amount">
              <span>{formatMoney(tier.amount, tier.currency)}</span>
              {gbpEstimate ? (
                <span className="tml-tix-tier__gbp">
                  {gbpEstimate}
                  <span className="tml-tix-sr"> (indicative estimate)</span>
                </span>
              ) : null}
              {tier.unit ? <span className="tml-tix-tier__unit">{tier.unit}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
