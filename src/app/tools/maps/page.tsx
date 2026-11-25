import type { Metadata } from "next";
import { ToolShell, type ToolSource } from "@/components/tools/tool-shell";
import { VenueMapsTool } from "@/components/tools/maps/venue-maps-tool";
import { GoldDivider } from "@/components/ui/gold-divider";
import { belgiumFacts } from "@/data/belgium/facts";

export const metadata: Metadata = {
  title: "Venue & DreamVille maps",
  description:
    "Original schematic planning maps for De Schorre and DreamVille in Belgium, with a point-to-point walking-time estimator in minutes and miles plus peak crowd-surge notes.",
  alternates: { canonical: "/tools/maps" },
};

function mapSources(): readonly ToolSource[] {
  const candidates = [
    belgiumFacts.festival.venue.source,
    belgiumFacts.headlineStats.source,
    belgiumFacts.festivalHours.source,
    belgiumFacts.dreamvilleCrossings.source,
    belgiumFacts.reEntry.source,
  ];
  const byUrl = new Map<string, ToolSource>();
  for (const source of candidates) {
    if (byUrl.has(source.url)) continue;
    byUrl.set(source.url, {
      url: source.url,
      label: source.title,
      retrievedOn: source.retrievedOn,
    });
  }
  return [...byUrl.values()];
}

export default function VenueMapsPage() {
  return (
    <ToolShell
      kicker="Orientation"
      title="Venue & DreamVille maps"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
        { label: "Venue & DreamVille maps" },
      ]}
      intro={
        <>
          <p>
            Clean, original schematic diagrams of De Schorre and DreamVille for planning walks
            between stages, entrances, and camping sectors. Pick any two zones to see estimated
            normal and peak-changeover walking times alongside approximate distances in miles.
          </p>
          <p>
            Every diagram here is an independent planning schematic, not an official Tomorrowland
            map. Official 2027 stage maps are released by the organiser closer to the festival.
          </p>
        </>
      }
      noscriptNote={
        <p>
          Without JavaScript the interactive route estimator cannot update, but the verified
          opening hours, re-entry rules, and DreamVille crossing times below remain readable.
        </p>
      }
      sources={mapSources()}
    >
      <VenueMapsTool />

      <GoldDivider butterfly="right" />

      <section aria-labelledby="maps-verified-facts">
        <p className="label text-accent">Verified Belgium 2027 facts</p>
        <h2 id="maps-verified-facts" className="tool-panel__title">
          Hours and crossing rules that affect your walk
        </h2>
        <div className="tml-map-facts-grid">
          <div className="tml-map-fact-card">
            <p className="tml-map-fact-card__label">Festival hours</p>
            <p className="tml-map-fact-card__value">
              Friday {belgiumFacts.festivalHours.value.friday} (last entry{" "}
              {belgiumFacts.festivalHours.value.lastEntryFriday}), Saturday{" "}
              {belgiumFacts.festivalHours.value.saturday} (last entry{" "}
              {belgiumFacts.festivalHours.value.lastEntrySaturday}), Sunday{" "}
              {belgiumFacts.festivalHours.value.sunday} (last entry{" "}
              {belgiumFacts.festivalHours.value.lastEntrySunday}).
            </p>
          </div>

          <div className="tml-map-fact-card">
            <p className="tml-map-fact-card__label">DreamVille crossings</p>
            <p className="tml-map-fact-card__value">
              Return from the festival to DreamVille from{" "}
              {belgiumFacts.dreamvilleCrossings.value.dreamvilleFromFestivalFrom}. Entry from
              DreamVille to the festival is open until{" "}
              {belgiumFacts.dreamvilleCrossings.value.festivalFromDreamvilleUntil}.
            </p>
          </div>

          <div className="tml-map-fact-card">
            <p className="tml-map-fact-card__label">Same-day re-entry</p>
            <p className="tml-map-fact-card__value">{belgiumFacts.reEntry.value.summary}</p>
          </div>

          <div className="tml-map-fact-card">
            <p className="tml-map-fact-card__label">DreamVille opening window</p>
            <p className="tml-map-fact-card__value">
              Opens {belgiumFacts.dreamville.openingWindow.value.opensOnDay} at{" "}
              {belgiumFacts.dreamville.openingWindow.value.opensAt} and closes{" "}
              {belgiumFacts.dreamville.openingWindow.value.closesOnDay} at{" "}
              {belgiumFacts.dreamville.openingWindow.value.closesAt}. The Gathering runs{" "}
              {belgiumFacts.dreamville.gathering.value.day}{" "}
              {belgiumFacts.dreamville.gathering.value.opensAt}–
              {belgiumFacts.dreamville.gathering.value.closesAt} for DreamVille guests.
            </p>
          </div>
        </div>
      </section>
    </ToolShell>
  );
}
