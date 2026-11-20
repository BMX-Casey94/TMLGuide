import type { Metadata } from "next";
import { GoldDivider } from "@/components/ui/gold-divider";
import { SectionHeading } from "@/components/ui/section-heading";
import { RADIO_CREDIT } from "@/components/radio";
import { RadioPanel } from "@/components/radio/radio-page-panel";
import { radioBroadcasts, radioChannels, radioMilestones, radioStation } from "@/data/shared";
import { formatCheckDate } from "@/components/community/card-format";
import {
  RADIO_CHANNEL_KIND_LABELS,
  RADIO_OFFICIAL_SITE,
  coverageSummary,
  orderRadioBroadcasts,
  orderRadioChannels,
  orderRadioMilestones,
} from "./radio-facts";
import "./radio-page.css";

export const metadata: Metadata = {
  title: "One World Radio",
  description:
    "How to listen to One World Radio, Tomorrowland's own station: the official stream, the apps and services that carry it, and which countries have DAB+, FM or syndicated coverage.",
  alternates: { canonical: "/radio" },
};

/* Server rendered: the panel is the only client component on the page. */
export default function RadioPage() {
  const checked = formatCheckDate(radioStation.lastVerified);
  const channels = orderRadioChannels(radioChannels);
  const broadcasts = orderRadioBroadcasts(radioBroadcasts);
  const milestones = orderRadioMilestones(radioMilestones);

  return (
    <main id="main" className="tml-radio-page">
      <header className="tml-radio-hero">
        <p className="label text-accent">24/7 · Independent guide</p>
        <h1 className="tml-radio-hero__title">{radioStation.name}</h1>
        <p className="tml-radio-hero__lede">{radioStation.tagline}</p>
      </header>

      <RadioPanel />

      <section aria-labelledby="radio-about" className="tml-radio-section">
        <SectionHeading
          id="radio-about"
          kicker="What it is"
          title="Tomorrowland's own station"
          lede={radioStation.description}
        />
        <div className="tml-radio-facts">
          <div className="tml-radio-fact">
            <p className="label text-cream-mute">Audience</p>
            <p className="tml-radio-fact__value">{radioStation.audience}</p>
          </div>
          <div className="tml-radio-fact">
            <p className="label text-cream-mute">Coverage</p>
            <p className="tml-radio-fact__value">{coverageSummary(broadcasts)}</p>
          </div>
        </div>
      </section>

      <GoldDivider butterfly="right" />

      <section aria-labelledby="radio-channels" className="tml-radio-section">
        <SectionHeading
          id="radio-channels"
          kicker="How to listen"
          title="Every published way in"
          lede="The panel above plays the public international MP3 stream. The routes below are the ones Tomorrowland documents, including the services that carry the station themselves."
          hairline="none"
        />

        <ul className="tml-radio-channels">
          {channels.map((channel) => (
            <li key={channel.id}>
              <article className="tml-radio-channel">
                <span className="tml-radio-channel__kind">
                  {RADIO_CHANNEL_KIND_LABELS[channel.kind]}
                </span>
                <h3 className="tml-radio-channel__name">{channel.name}</h3>
                <p className="tml-radio-channel__text">{channel.description}</p>
                {channel.url === undefined ? null : (
                  <a
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tml-radio-channel__link"
                  >
                    Open
                    <span aria-hidden="true">↗</span>
                    {/* The visible word repeats across cards, so the name says which channel. */}
                    <span className="sr-only">{` — ${channel.name} (opens in a new tab)`}</span>
                  </a>
                )}
              </article>
            </li>
          ))}
        </ul>
      </section>

      <GoldDivider butterfly="left" />

      <section aria-labelledby="radio-countries" className="tml-radio-section">
        <SectionHeading
          id="radio-countries"
          kicker="Where to listen"
          title="DAB+, FM and syndication"
          lede="A country appears only where an official page states the carriage. Coverage changes: this list was checked on the date below."
          hairline="none"
        />

        <div
          className="tml-radio-table-wrap"
          role="region"
          aria-label="Countries with published One World Radio carriage"
          tabIndex={0}
        >
          <table className="tml-radio-table">
            <caption className="sr-only">
              Countries with published One World Radio carriage, and how the station reaches each
            </caption>
            <thead>
              <tr>
                <th scope="col">Country</th>
                <th scope="col">Method</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((broadcast) => (
                <tr key={broadcast.id}>
                  <th scope="row">{broadcast.country}</th>
                  <td>{broadcast.method}</td>
                  <td className="tml-radio-table__detail">{broadcast.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="tml-radio-note">
          Not in the list? Listen online through the stream or the official app; the station reports
          listeners in more than 130 countries.
        </p>
      </section>

      <GoldDivider />

      <section aria-labelledby="radio-history" className="tml-radio-section">
        <SectionHeading
          id="radio-history"
          kicker="History"
          title="From anniversary project to a permanent station"
          lede="Three dated moments from Tomorrowland's own announcements."
          hairline="none"
        />

        <ol className="tml-radio-history">
          {milestones.map((milestone) => {
            const when = formatCheckDate(milestone.happenedOn);
            return (
              <li key={milestone.id} className="tml-radio-milestone">
                <p className="label text-accent">
                  {when === null ? (
                    "Date not recorded"
                  ) : (
                    <time dateTime={milestone.happenedOn}>{when}</time>
                  )}
                </p>
                <p className="tml-radio-milestone__text">{milestone.statement}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="radio-sources" className="tml-radio-sources">
        <h2 id="radio-sources" className="tml-radio-sources__title">
          Sources and attribution
        </h2>
        <div className="tml-radio-attribution">
          <p className="label text-cream-mute">Attribution</p>
          <p className="tml-radio-attribution__text">{RADIO_CREDIT}</p>
        </div>
        <p className="tml-radio-sources__text">
          The station is operated by Tomorrowland. This page is an independent guide, not affiliated
          with Tomorrowland or WeAreOne.World B.V., and the stream is linked unchanged.
        </p>
        <ul className="tml-radio-sources__links">
          <li>
            <a href={RADIO_OFFICIAL_SITE} target="_blank" rel="noopener noreferrer">
              Official One World Radio site
              <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
          <li>
            <a href={radioStation.source.url} target="_blank" rel="noopener noreferrer">
              {radioStation.source.title}
              <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        </ul>
        {checked === null ? null : (
          <p className="tml-radio-checked">
            Station facts checked <time dateTime={radioStation.lastVerified}>{checked}</time>
          </p>
        )}
      </section>
    </main>
  );
}
