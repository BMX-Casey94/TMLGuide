import type { ReactNode } from "react";

export interface TableScrollRegionProps {
  /** Names the region, and says that it scrolls, so the tab stop is not a mystery. */
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * The wrapper around a wide tool table.
 *
 * On a 320px screen four columns of money do not fit in the panel, so the
 * wrapper scrolls sideways rather than widening the page. A scroll container
 * whose content holds no focusable control cannot be scrolled from the keyboard
 * at all, which is a WCAG 2.1.1 failure: the figures past the right edge would
 * be unreachable without a pointer. Giving the region a tab stop and a name
 * fixes both halves of that, and the global `:focus-visible` rule draws its ring.
 *
 * The tab stop is present at every width, including the ones where the table
 * fits and nothing needs scrolling. That is deliberate: hiding and showing it
 * would depend on a measurement taken after paint, which means a layout shift in
 * the tab order and a server render that disagrees with the browser. One extra
 * stop before a table the reader has reached anyway costs less than that, and the
 * label is worded for both cases ("on a narrow screen").
 *
 * The table inside keeps its own `<caption>`, so the table is still named for
 * assistive technology; this label only names the scrolling box.
 */
export function TableScrollRegion({ label, children }: TableScrollRegionProps) {
  return (
    <div className="tool-table-wrap" role="group" tabIndex={0} aria-label={label}>
      {children}
    </div>
  );
}
