import { formatMoney } from "./format";
import type { ToolCurrency } from "./editions";
import type { CategoryShare } from "./budget-state";
import { TableScrollRegion } from "./table-scroll";

export interface CategoryChartProps {
  /** The categories to draw, already sorted largest first. */
  readonly categories: readonly CategoryShare[];
  readonly currency: ToolCurrency;
}

/**
 * A horizontal bar chart of the category breakdown.
 *
 * Drawn in HTML rather than as an SVG with a fixed viewBox. A viewBox scales
 * its own text with the drawing, so in a 238px-wide panel on a 320px screen the
 * 13px labels came out about 5px tall, and at 200 percent zoom the same thing
 * happened again. Here the label and the value are ordinary text at their
 * declared size, and only the bar's length changes, so the chart stays legible
 * at any width and reflows instead of needing a sideways scroll.
 *
 * The bar is a proportion of the largest category rather than of the total,
 * which is what makes the comparison readable on one screen. The exact shares
 * are in the table beside it.
 *
 * The chart is `aria-hidden`. It is a second copy of figures that the table
 * beside it already gives in full, and exposing both would make a screen reader
 * read the same breakdown twice; the table is the accessible form, and it
 * carries more detail (a per-person column and each share). The heading above
 * labels the whole section, which a sighted reader sees.
 */
export function CategoryChart({ categories, currency }: CategoryChartProps) {
  if (categories.length === 0) return null;

  const max = Math.max(...categories.map((entry) => entry.totalMinor), 1);

  return (
    <figure className="tool-chart" aria-hidden="true">
      <ul className="tool-chart__rows">
        {categories.map((entry) => {
          /*
            A non-zero category always draws something visible, so a tiny slice
            is not rendered as an empty bar. Zero is drawn as nothing at all,
            because a visible bar for nothing would be a lie.
          */
          const share = entry.totalMinor === 0 ? 0 : Math.max(2, (entry.totalMinor / max) * 100);

          return (
            <li className="tool-chart__row" key={entry.category}>
              <span className="tool-chart__row-label">{entry.category}</span>
              <span className="tool-chart__track">
                <span
                  className="tool-chart__bar"
                  style={{ width: `${share.toFixed(1)}%` }}
                  data-value={entry.totalMinor}
                />
              </span>
              <span className="tool-chart__row-value">
                {formatMoney(entry.totalMinor, currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

export interface CategoryTableProps {
  readonly categories: readonly CategoryShare[];
  readonly currency: ToolCurrency;
  readonly id: string;
  /** Caption for the table, which is also its accessible name. */
  readonly caption: string;
  /** How many people the total is split across, for the per-person column. */
  readonly people: number;
}

/**
 * The category breakdown as a table: the text alternative to the chart, and the
 * form that prints and copies cleanly.
 *
 * A `<caption>` rather than a heading, so it names the table for assistive
 * technology without competing with the page's heading order.
 *
 * The wrapper scrolls sideways on a narrow screen, because four columns of
 * money do not fit in a 238px panel. A scroll container with no focusable
 * content cannot be scrolled from the keyboard, so {@link TableScrollRegion}
 * gives it a tab stop and a name: a keyboard user can then reach it and use the
 * arrow keys.
 */
export function CategoryTable({ categories, currency, id, caption, people }: CategoryTableProps) {
  if (categories.length === 0) return null;

  const grandTotal = categories.reduce((total, entry) => total + entry.totalMinor, 0);

  return (
    <TableScrollRegion label={`${caption}. The table scrolls sideways on a narrow screen.`}>
      <table className="tool-table" id={id}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col" className="tool-table__amount">
              Total
            </th>
            <th scope="col" className="tool-table__amount">
              Per person
            </th>
            <th scope="col" className="tool-table__amount">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((entry) => (
            <tr key={entry.category}>
              <th scope="row">{entry.category}</th>
              <td className="tool-table__amount">{formatMoney(entry.totalMinor, currency)}</td>
              <td className="tool-table__amount">
                {formatMoney(Math.round(entry.totalMinor / people), currency)}
              </td>
              <td className="tool-table__amount">{entry.percent}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="tool-table__amount">{formatMoney(grandTotal, currency)}</td>
            <td className="tool-table__amount">
              {formatMoney(Math.round(grandTotal / people), currency)}
            </td>
            <td className="tool-table__amount">100%</td>
          </tr>
        </tfoot>
      </table>
    </TableScrollRegion>
  );
}
