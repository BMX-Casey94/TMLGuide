import { formatMoney } from "./format";
import type { ToolCurrency } from "./editions";
import type { CategoryShare } from "./budget-state";

export interface CategoryChartProps {
  /** The categories to draw, already sorted largest first. */
  readonly categories: readonly CategoryShare[];
  readonly currency: ToolCurrency;
}

/* Fixed geometry in the SVG's own coordinate space, scaled by the viewBox. */
const ROW_HEIGHT = 42;
const BAR_HEIGHT = 14;
const LABEL_WIDTH = 132;
const VALUE_WIDTH = 96;
const GAP = 10;
const CHART_WIDTH = 620;

/**
 * A horizontal bar chart of the category breakdown.
 *
 * An SVG rather than styled divs because the bars are a picture of numbers: the
 * proportions have to stay exact at any width, and the print stylesheet can
 * recolour them without touching layout. Each row carries its own visible label
 * and value inside the drawing, so the chart reads on its own.
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
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - VALUE_WIDTH - GAP * 2;
  const height = categories.length * ROW_HEIGHT + 8;

  return (
    <figure className="tool-chart">
      <svg
        className="tool-chart__svg"
        viewBox={`0 0 ${CHART_WIDTH} ${height}`}
        preserveAspectRatio="xMinYMin meet"
        aria-hidden="true"
        focusable="false"
      >
        {categories.map((entry, index) => {
          const y = index * ROW_HEIGHT + 6;
          const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2 - 6;
          const ratio = entry.totalMinor / max;
          // A non-zero category always draws something visible, so a tiny slice
          // is not rendered as an empty bar.
          const barWidth =
            entry.totalMinor === 0 ? 0 : Math.max(4, Math.round(plotWidth * ratio));

          return (
            <g key={entry.category}>
              <text
                className="tool-chart__row-label"
                x={0}
                y={y + ROW_HEIGHT / 2 - 6}
                dominantBaseline="middle"
              >
                {entry.category}
              </text>
              <rect
                className="tool-chart__track"
                x={LABEL_WIDTH}
                y={barY}
                width={plotWidth}
                height={BAR_HEIGHT}
                rx={BAR_HEIGHT / 2}
              />
              <rect
                className="tool-chart__bar"
                x={LABEL_WIDTH}
                y={barY}
                width={barWidth}
                height={BAR_HEIGHT}
                rx={BAR_HEIGHT / 2}
              />
              <text
                className="tool-chart__row-value"
                x={CHART_WIDTH}
                y={y + ROW_HEIGHT / 2 - 6}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatMoney(entry.totalMinor, currency)}
              </text>
            </g>
          );
        })}
      </svg>
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
 */
export function CategoryTable({ categories, currency, id, caption, people }: CategoryTableProps) {
  if (categories.length === 0) return null;

  const grandTotal = categories.reduce((total, entry) => total + entry.totalMinor, 0);

  return (
    <div className="tool-table-wrap">
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
    </div>
  );
}
