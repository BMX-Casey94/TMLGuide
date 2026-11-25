"use client";

/**
 * The side-by-side comparison table.
 *
 * Table markup rather than a grid of divs, so a screen reader announces the row
 * and column headers for every cell and can navigate by cell. The wrapper
 * scrolls horizontally. The first column stays put from 900px up; on a phone it
 * scrolls with the prices, because pinning it covered the figures.
 *
 * Price rows are keyed by sale moment rather than by position: if one package has
 * a pre-sale price and another does not, the missing one shows an explicit dash
 * with a spoken label instead of silently shifting into the wrong row.
 */
import { formatIndicativeGbp } from "@/lib/currency/gbp-estimate";
import { formatMoney } from "./format";
import { COMPARISON_LIMIT, useComparison } from "./comparison";
import type { CatalogueItem, PriceTier } from "./types";
import "./tickets.css";

export interface ComparisonTableProps {
  /** Every item the table may show, in catalogue order. */
  items: readonly CatalogueItem[];
  /** The edition label, used in the caption. */
  editionLabel: string;
}

const MISSING_CELL_TEXT = "Not published";

function tierRowLabel(tier: PriceTier): string {
  return `${tier.label} · ${tier.year}`;
}

export function ComparisonTable({ items, editionLabel }: ComparisonTableProps) {
  const { selectedIds, remove, clear } = useComparison();

  const selected = selectedIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is CatalogueItem => item !== undefined);

  if (selected.length === 0) {
    return (
      <section className="tml-tix-compare-wrap" aria-labelledby="comparison-title">
        <div className="tml-tix-compare-head">
          <div>
            <h2 className="tml-tix-compare-title" id="comparison-title">
              Compare packages
            </h2>
            <p className="tml-tix-compare-hint">
              Tick up to {COMPARISON_LIMIT} packages to see their prices and inclusions side by
              side.
            </p>
          </div>
        </div>
      </section>
    );
  }

  /* Rows are the union of tier keys across the selection, in first-seen order, so
     two products sold in the same moments line up on the same row. */
  const tierKeys: string[] = [];
  for (const item of selected) {
    for (const tier of item.tiers) {
      if (!tierKeys.includes(tier.key)) tierKeys.push(tier.key);
    }
  }

  const currenciesDiffer = new Set(selected.flatMap((item) => item.tiers.map((t) => t.currency)))
    .size > 1;

  return (
    <section className="tml-tix-compare-wrap" aria-labelledby="comparison-title">
      <div className="tml-tix-compare-head">
        <div>
          <h2 className="tml-tix-compare-title" id="comparison-title">
            Compare packages
          </h2>
          <p className="tml-tix-compare-hint">
            {selected.length} of {COMPARISON_LIMIT} selected. Scroll the table sideways to see
            every column.
          </p>
        </div>
        <button type="button" className="tml-tix-open" onClick={clear}>
          Clear comparison
        </button>
      </div>

      <div className="tml-tix-table-scroll" tabIndex={0} role="group" aria-label="Comparison table, scrollable">
        <table className="tml-tix-table">
          <caption>
            {editionLabel} tickets and packages compared. Each figure is the price published on
            the date shown in its own row.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="tml-tix-table__sticky">
                Package
              </th>
              {selected.map((item) => (
                /*
                  The remove button lives inside its column header so it sits with
                  the package it removes. The header therefore carries an explicit
                  name: without it, a screen reader would announce the column as
                  "Day Pass Remove", and every cell in that column would repeat it.
                */
                <th scope="col" key={item.id} aria-label={item.name}>
                  <span aria-hidden="true">{item.name}</span>
                  <button
                    type="button"
                    className="tml-tix-compare"
                    onClick={() => remove(item.id)}
                    aria-label={`Remove ${item.name} from the comparison`}
                  >
                    Remove
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selected.some((item) => item.qualifier !== undefined) ? (
              <tr>
                <th scope="row" className="tml-tix-table__sticky">
                  Covers
                </th>
                {selected.map((item) => (
                  <td key={item.id}>{item.qualifier ?? "—"}</td>
                ))}
              </tr>
            ) : null}

            {tierKeys.map((key) => {
              const labelSource = selected
                .flatMap((item) => item.tiers)
                .find((tier) => tier.key === key);
              return (
                <tr key={key}>
                  <th scope="row" className="tml-tix-table__sticky">
                    {labelSource === undefined ? key : tierRowLabel(labelSource)}
                  </th>
                  {selected.map((item) => {
                    const tier = item.tiers.find((candidate) => candidate.key === key);
                    if (tier === undefined) {
                      return (
                        <td key={item.id} className="tml-tix-table__missing">
                          <span aria-hidden="true">—</span>
                          <span className="tml-tix-sr">
                            {MISSING_CELL_TEXT} for this sale moment
                          </span>
                        </td>
                      );
                    }
                    const gbpEstimate = formatIndicativeGbp(tier.amount, tier.currency);
                    return (
                      <td key={item.id}>
                        <span className="tml-tix-table__amount">
                          {formatMoney(tier.amount, tier.currency)}
                        </span>
                        {gbpEstimate ? (
                          <span className="tml-tix-table__gbp">
                            {gbpEstimate}
                            <span className="tml-tix-sr"> (indicative estimate)</span>
                          </span>
                        ) : null}
                        {tier.unit ? <span className="tml-tix-table__missing">{tier.unit}</span> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {currenciesDiffer ? (
              <tr>
                <th scope="row" className="tml-tix-table__sticky">
                  Note
                </th>
                <td colSpan={selected.length}>
                  Figures are shown in the currency each edition publishes. They are never
                  converted between euros and reais.
                </td>
              </tr>
            ) : null}

            {selected.some((item) => item.includes.length > 0) ? (
              <tr>
                <th scope="row" className="tml-tix-table__sticky">
                  Included
                </th>
                {selected.map((item) => (
                  <td key={item.id}>
                    {item.includes.length === 0 ? (
                      <span className="tml-tix-table__missing">
                        Not listed as a checklist
                      </span>
                    ) : (
                      <ul className="tml-tix-table__list">
                        {item.includes.map((inclusion) => (
                          <li key={inclusion}>{inclusion}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                ))}
              </tr>
            ) : null}

            <tr>
              <th scope="row" className="tml-tix-table__sticky">
                Status
              </th>
              {selected.map((item) => (
                <td key={item.id}>
                  {item.badges.length > 0 ? item.badges.join(", ") : "On sale as published"}
                </td>
              ))}
            </tr>

            <tr>
              <th scope="row" className="tml-tix-table__sticky">
                Source
              </th>
              {selected.map((item) => (
                <td key={item.id}>
                  <a
                    className="tml-tix-source__link"
                    href={item.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.source.title}
                    <span className="tml-tix-sr"> (opens in a new tab)</span>
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
