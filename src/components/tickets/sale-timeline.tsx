/**
 * The edition's sale calendar as a vertical strip.
 *
 * Each window shows the published local time with its zone abbreviation, the
 * audience and a source line. The visitor's own clock is added by a small client
 * island: the server cannot know the browser's zone, so it renders only the
 * published time and the island fills in the conversion after hydration.
 */
import { formatInstantParts } from "./format";
import { SourceLine } from "./source-line";
import { VisitorTime } from "./visitor-time";
import type { CatalogueSaleWindow } from "./types";
import "./tickets.css";

export interface SaleTimelineProps {
  windows: readonly CatalogueSaleWindow[];
  /** The edition label, for the region's accessible name. */
  editionLabel: string;
}

export function SaleTimeline({ windows, editionLabel }: SaleTimelineProps) {
  if (windows.length === 0) {
    return (
      <p className="tml-tix-note">
        No sale window for {editionLabel} is published in the official sources checked for this
        guide.
      </p>
    );
  }

  return (
    <ol className="tml-tix-timeline">
      {windows.map((window) => {
        const parts = formatInstantParts(window.opensAt, window.timeZone, "short");
        return (
          <li key={window.id} className="tml-tix-window">
            <div>
              <time className="tml-tix-window__when" dateTime={window.opensAt}>
                {parts.date}, {parts.time} {parts.zone}
              </time>
              <span className="tml-tix-window__local">
                <VisitorTime instant={window.opensAt} />
              </span>
            </div>

            <div>
              <h3 className="tml-tix-window__name">{window.name}</h3>
              <p className="tml-tix-window__audience">{window.audience}</p>
              {window.notes ? <p className="tml-tix-note">{window.notes}</p> : null}
              <SourceLine source={window.source} lastVerified={window.lastVerified} />
            </div>

            {window.statusLabel ? (
              <span className="tml-tix-window__status">{window.statusLabel}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
