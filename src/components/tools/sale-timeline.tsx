"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildEditionCalendar, buildSaleCalendar, editionFilename, saleFilename } from "./calendar-export";
import { downloadTextFile } from "./download";
import {
  buildTimeline,
  countdownTarget,
  describeSaleTime,
  detectLocalZone,
  type SaleRecord,
  type TimelineEdition,
  type TimelineSale,
} from "./timeline-logic";
import { recordAnchor } from "@/lib/search/anchors";
import { SaleCountdown } from "./sale-countdown";

const STATUS_LABEL: Readonly<Record<TimelineSale["status"], string>> = {
  past: "Closed",
  open: "Open now",
  upcoming: "Upcoming",
};

export interface SaleTimelineProps {
  /** The edition's sale records, already read and validated on the server. */
  readonly records: readonly SaleRecord[];
  readonly edition: TimelineEdition;
  /** The edition's label, for headings and calendar titles. */
  readonly editionLabel: string;
}

/**
 * The ticket sale timeline.
 *
 * Statuses are computed against a `now` read on mount, not during render. That
 * is deliberate: with Cache Components a `new Date()` during prerender is a
 * build error, and a per-request clock would make the page uncacheable. Until
 * the clock arrives the list is classified against an instant one millisecond
 * before the earliest sale, so nothing can claim to be open before the reader's
 * own clock has been read.
 */
export function SaleTimeline({ records, edition, editionLabel }: SaleTimelineProps) {
  /*
    `now` and `localZone` are null until the browser has been read. Null is the
    honest state before that: the server cannot know either, and a state flag
    whose only job is to force a re-render would be an extra render for nothing.
  */
  const [now, setNow] = useState<Date | null>(null);
  const [localZone, setLocalZone] = useState<string | null>(null);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);

  useEffect(() => {
    /*
      A timer rather than a direct set, so this is a subscription to the clock
      rather than a render-triggering write inside an effect. Zero delay means
      the first read still happens in the same tick as hydration.
    */
    const initial = setTimeout(() => {
      setNow(new Date());
      setLocalZone(detectLocalZone());
    }, 0);
    return () => clearTimeout(initial);
  }, []);

  const reference = useMemo(() => {
    if (now !== null) return now;
    const earliest = records
      .map((record) => Date.parse(record.opensAt))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)[0];
    return new Date(Number.isFinite(earliest) ? earliest - 1 : 0);
  }, [now, records]);

  const sales = useMemo(
    () => buildTimeline(records, edition, reference),
    [records, edition, reference],
  );
  const target = useMemo(() => countdownTarget(sales, reference), [sales, reference]);

  /*
    The reader's zone is unknown on the server, so until it is resolved every
    sale is shown in Brussels time and labelled as such. That keeps the
    server's HTML honest rather than showing a zone the server guessed.
  */
  const zone = localZone ?? "Europe/Brussels";
  const zoneIsLocal = localZone !== null;

  const onDownloadOne = useCallback((sale: TimelineSale) => {
    const started = downloadTextFile(saleFilename(sale), buildSaleCalendar(sale, new Date()));
    setDownloadNote(
      started
        ? `Calendar file for ${sale.name} downloaded. Open it to add the sale and its two reminders.`
        : "This browser could not start a download, so the calendar file was not saved.",
    );
  }, []);

  const onDownloadAll = useCallback(() => {
    const started = downloadTextFile(
      editionFilename(edition),
      buildEditionCalendar(sales, new Date()),
    );
    setDownloadNote(
      started
        ? `Calendar file with all ${sales.length} ${editionLabel} sales downloaded.`
        : "This browser could not start a download, so the calendar file was not saved.",
    );
  }, [edition, editionLabel, sales]);

  return (
    <div>
      <section className="tool-panel" aria-labelledby={`timeline-countdown-${edition}`}>
        <div className="tool-panel__head">
          <h2 className="tool-panel__title" id={`timeline-countdown-${edition}`}>
            {target === null ? "No further sales announced" : "Next sale"}
          </h2>
          {target === null ? (
            <p className="tool-panel__hint">
              Every {editionLabel} sale in the published cycle has opened. The dates below are kept as
              a record, and the organisers announce a new cycle on the official site.
            </p>
          ) : (
            <p className="tool-panel__hint">
              {target.name} — {target.audience}.
            </p>
          )}
        </div>

        {target === null ? null : (
          <SaleCountdown opensAtIso={target.opensAtIso} saleName={target.name} />
        )}
      </section>

      <section className="tool-panel" aria-labelledby={`timeline-list-${edition}`}>
        <div className="tool-panel__head">
          <h2 className="tool-panel__title" id={`timeline-list-${edition}`}>
            Every {editionLabel} sale
          </h2>
          <p className="tool-panel__hint">
            Each sale is shown in{" "}
            {zoneIsLocal ? "your own time zone and in Brussels time" : "Brussels time"}. Both are the
            same instant, so an hour&rsquo;s difference is the clocks, not the sale.
          </p>
        </div>

        {sales.length === 0 ? (
          <p className="tool-panel__hint">
            No sale dates for {editionLabel} have been published yet. When the organisers announce
            them they appear here, with a calendar export.
          </p>
        ) : (
          <ol className="timeline">
            {sales.map((sale) => {
              const times = describeSaleTime(sale.opensAtIso, zone);
              const isTarget = target?.id === sale.id;
              return (
                <li
                  key={sale.id}
                  id={recordAnchor("sale", sale.id)}
                  className={`timeline__row${isTarget ? " timeline__row--next" : ""}`}
                >
                  <div className="timeline__main">
                    <div className="timeline__headline">
                      <h3 className="timeline__title">{sale.name}</h3>
                      <span className={`tool-status tool-status--${sale.status}`}>
                        {STATUS_LABEL[sale.status]}
                      </span>
                    </div>
                    <p className="timeline__audience">{sale.audience}</p>

                    <dl className="timeline__times">
                      <div>
                        <dt>{zoneIsLocal ? "Your time" : "Festival time"}</dt>
                        <dd>
                          <time dateTime={sale.opensAtIso}>{times.local}</time>
                        </dd>
                      </div>
                      <div>
                        <dt>Brussels</dt>
                        <dd>{times.brussels}</dd>
                      </div>
                    </dl>

                    {times.dayDiffers ? (
                      <p className="timeline__notice">
                        Your zone and Brussels fall on different calendar days for this sale.
                      </p>
                    ) : null}

                    {sale.notes === undefined ? null : <p className="timeline__notes">{sale.notes}</p>}
                  </div>

                  <div className="timeline__actions">
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => onDownloadOne(sale)}
                    >
                      Add to calendar{" "}
                      <span className="sr-only">{`for ${sale.name}`}</span>
                    </button>
                    <a
                      className="timeline__source"
                      href={sale.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Official page{" "}
                      <span className="sr-only">{`for ${sale.name} (opens in a new tab)`}</span>
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="tool-actions">
          <button
            type="button"
            className="tool-btn tool-btn--primary"
            onClick={onDownloadAll}
            disabled={sales.length === 0}
          >
            Download all {editionLabel} sales
          </button>
        </div>

        <p className="tool-field__note">
          Each calendar event carries two reminders: 30 minutes before the sale opens, and 1 day
          before. Times inside the file are absolute, so your calendar shows them in whatever zone you
          are in.
        </p>

        <p className="tool-field__note">
          The Exchange Desk is the only official resale route, and a sale opening is not a guarantee
          of a ticket.
        </p>

        {downloadNote === null ? null : (
          <p className="tool-copy-status" role="status">
            {downloadNote}
          </p>
        )}
      </section>
    </div>
  );
}
