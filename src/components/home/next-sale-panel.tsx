import { io } from "next/cache";
import { NextSaleStrip } from "./next-sale-strip";
import { nextSaleNow } from "./next-sale";

export interface NextSalePanelProps {
  /** The date the data was last checked, as a calendar date. */
  readonly checkedOn: string;
  /** The same date, formatted for display. */
  readonly checkedOnLabel: string;
}

/**
 * Works out the next sale against the clock of the request, not the clock of
 * the build.
 *
 * Under Cache Components a prerender has no current time: `new Date()` during
 * prerendering is an error, because the value would be baked into the static
 * shell and every reader afterwards would see a countdown to a moment in the
 * past. `await io()` marks the read as request-time work, so everything after it
 * is excluded from the prerender and the surrounding `<Suspense>` boundary
 * streams in the strip while the rest of the page is already on screen.
 *
 * The same instant is then handed to the countdown as its starting value, so the
 * server's HTML and the browser's first render agree on the numbers.
 */
export async function NextSalePanel({ checkedOn, checkedOnLabel }: NextSalePanelProps) {
  await io();
  const now = new Date();
  const next = nextSaleNow(now);

  return (
    <NextSaleStrip next={next} checkedOn={checkedOn} checkedOnLabel={checkedOnLabel} serverNowIso={now.toISOString()} />
  );
}

/**
 * What the strip's slot shows while the request-time work is pending. It holds
 * the same border, label and height as the strip so the page does not jump when
 * the real content arrives.
 */
export function NextSalePanelFallback() {
  return (
    <section className="home-next" aria-labelledby="next-sale-heading">
      <div className="home-next__headline">
        <p className="label text-accent">Next sale</p>
        <h2 id="next-sale-heading" className="home-next__title">
          Checking the sale calendar
        </h2>
        <p className="home-next__empty">
          The soonest sale across every edition is loading, with its local time and a countdown.
        </p>
      </div>
    </section>
  );
}
