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
    <main id="main" className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-7">
      <header className="pt-14 pb-10">
        <p className="label text-accent">24/7 · Independent guide</p>
        <h1 className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl">
          {radioStation.name}
        </h1>
        <p className="mt-4 max-w-[62ch] text-cream-mute">{radioStation.tagline}</p>
      </header>

      <RadioPanel />

      <section aria-labelledby="radio-about" className="mt-16">
        <SectionHeading
          id="radio-about"
          kicker="What it is"
          title="Tomorrowland's own station"
          lede={radioStation.description}
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-card)] border border-hair bg-surface/50 p-5">
            <p className="label text-cream-mute">Audience</p>
            <p className="mt-2 text-sm leading-relaxed text-cream">{radioStation.audience}</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-hair bg-surface/50 p-5">
            <p className="label text-cream-mute">Coverage</p>
            <p className="mt-2 text-sm leading-relaxed text-cream">{coverageSummary(broadcasts)}</p>
          </div>
        </div>
      </section>

      <GoldDivider butterfly="right" />

      <section aria-labelledby="radio-channels">
        <SectionHeading
          id="radio-channels"
          kicker="How to listen"
          title="Every published way in"
          lede="The panel above plays the public international MP3 stream. The routes below are the ones Tomorrowland documents, including the services that carry the station themselves."
        />

        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {channels.map((channel) => (
            <li key={channel.id}>
              <article className="flex h-full flex-col rounded-[var(--radius-card)] border border-hair bg-gradient-to-b from-surface-2 to-surface p-5">
                <span className="self-start rounded-full border border-hair px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-mute">
                  {RADIO_CHANNEL_KIND_LABELS[channel.kind]}
                </span>
                <h3 className="mt-3 font-display text-lg leading-snug">{channel.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-mute">{channel.description}</p>
                {channel.url === undefined ? null : (
                  <a
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex min-h-11 items-center gap-2 pt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-accent underline-offset-4 hover:underline"
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

      <section aria-labelledby="radio-countries">
        <SectionHeading
          id="radio-countries"
          kicker="Where to listen"
          title="DAB+, FM and syndication"
          lede="A country appears only where an official page states the carriage. Coverage changes: this list was checked on the date below."
        />

        <div className="mt-8 overflow-x-auto rounded-[var(--radius-card)] border border-hair">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Countries with published One World Radio carriage, and how the station reaches each
            </caption>
            <thead>
              <tr className="border-b border-hair bg-surface-2">
                <th scope="col" className="label px-4 py-3 text-cream-mute">
                  Country
                </th>
                <th scope="col" className="label px-4 py-3 text-cream-mute">
                  Method
                </th>
                <th scope="col" className="label px-4 py-3 text-cream-mute">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((broadcast) => (
                <tr key={broadcast.id} className="border-b border-hair last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-medium text-cream">
                    {broadcast.country}
                  </th>
                  <td className="px-4 py-3 text-cream">{broadcast.method}</td>
                  <td className="px-4 py-3 text-cream-mute">{broadcast.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-cream-mute">
          Not in the list? Listen online through the stream or the official app; the station reports
          listeners in more than 130 countries.
        </p>
      </section>

      <GoldDivider />

      <section aria-labelledby="radio-history">
        <SectionHeading
          id="radio-history"
          kicker="History"
          title="From anniversary project to a permanent station"
          lede="Three dated moments from Tomorrowland's own announcements."
        />

        <ol className="mt-8 flex flex-col gap-4">
          {milestones.map((milestone) => {
            const when = formatCheckDate(milestone.happenedOn);
            return (
              <li
                key={milestone.id}
                className="rounded-[var(--radius-card)] border border-hair bg-surface/50 p-5"
              >
                <p className="label text-accent">
                  {when === null ? "Date not recorded" : <time dateTime={milestone.happenedOn}>{when}</time>}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-cream">{milestone.statement}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section
        aria-labelledby="radio-sources"
        className="mt-16 rounded-[var(--radius-card)] border border-hair-strong bg-surface/60 p-5 sm:p-6"
      >
        <h2 id="radio-sources" className="font-display text-2xl">
          Sources and attribution
        </h2>
        <div className="mt-3 rounded-xl border border-hair bg-ground/40 p-4">
          <p className="label text-cream-mute">Attribution</p>
          <p className="mt-1.5 text-sm leading-relaxed text-cream">{RADIO_CREDIT}</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-cream-mute">
          The station is operated by Tomorrowland. This page is an independent guide, not affiliated
          with Tomorrowland or WeAreOne.World B.V., and the stream is linked unchanged.
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          <li>
            <a
              href={RADIO_OFFICIAL_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-accent underline-offset-4 hover:underline"
            >
              Official One World Radio site
              <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
          <li>
            <a
              href={radioStation.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-accent underline-offset-4 hover:underline"
            >
              {radioStation.source.title}
              <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        </ul>
        {checked === null ? null : (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-mute">
            Station facts checked <time dateTime={radioStation.lastVerified}>{checked}</time>
          </p>
        )}
      </section>
    </main>
  );
}
