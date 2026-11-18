"use client";

import { useId, useState } from "react";
import { SaleTimeline } from "./sale-timeline";
import type { SaleRecord, TimelineEdition } from "./timeline-logic";

export interface EditionSales {
  readonly edition: TimelineEdition;
  readonly label: string;
  readonly records: readonly SaleRecord[];
}

export interface SaleTimelineTabsProps {
  /**
   * Every edition's sales, prepared on the server. Passing them in keeps the
   * data layer out of the client bundle: the page reads the records and hands
   * over plain objects.
   */
  readonly editions: readonly EditionSales[];
  /** The edition to open on. */
  readonly initialEdition: TimelineEdition;
}

/**
 * Edition tabs for the sale timeline.
 *
 * A tablist rather than three stacked timelines, because a reader planning one
 * trip does not want to scroll past two editions they are not going to. The
 * keyboard behaviour is the WAI-ARIA tabs pattern: one tab stop for the group,
 * arrow keys move between tabs with wrapping, and Home and End jump to the ends.
 */
export function SaleTimelineTabs({ editions, initialEdition }: SaleTimelineTabsProps) {
  const [active, setActive] = useState<TimelineEdition>(initialEdition);
  const baseId = useId();

  const tabId = (edition: TimelineEdition) => `${baseId}-tab-${edition}`;
  const panelId = (edition: TimelineEdition) => `${baseId}-panel-${edition}`;

  const move = (delta: number): void => {
    const index = editions.findIndex((entry) => entry.edition === active);
    const nextIndex = (index + delta + editions.length) % editions.length;
    const next = editions[nextIndex];
    setActive(next.edition);
    document.getElementById(tabId(next.edition))?.focus();
  };

  const jump = (to: "first" | "last"): void => {
    const next = editions[to === "first" ? 0 : editions.length - 1];
    setActive(next.edition);
    document.getElementById(tabId(next.edition))?.focus();
  };

  const current = editions.find((entry) => entry.edition === active) ?? editions[0];

  if (current === undefined) return null;

  return (
    <div>
      <div className="tool-segmented" role="tablist" aria-label="Edition">
        {editions.map((entry) => {
          const selected = entry.edition === active;
          return (
            <button
              key={entry.edition}
              id={tabId(entry.edition)}
              type="button"
              role="tab"
              className="tool-segmented__option"
              aria-selected={selected}
              aria-controls={panelId(entry.edition)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(entry.edition)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  move(1);
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  move(-1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  jump("first");
                } else if (event.key === "End") {
                  event.preventDefault();
                  jump("last");
                }
              }}
            >
              {selected ? (
                <span className="tool-segmented__tick" aria-hidden="true">
                  ✓
                </span>
              ) : null}
              {entry.label}
            </button>
          );
        })}
      </div>

      <div
        id={panelId(current.edition)}
        role="tabpanel"
        aria-labelledby={tabId(current.edition)}
        tabIndex={0}
        className="mt-4"
      >
        <SaleTimeline
          records={current.records}
          edition={current.edition}
          editionLabel={current.label}
        />
      </div>
    </div>
  );
}
