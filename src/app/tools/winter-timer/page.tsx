import type { Metadata } from "next";
import { ToolShell, type ToolSource } from "@/components/tools/tool-shell";
import { WinterTimerTool } from "@/components/tools/winter-timer/winter-timer-tool";
import { GoldDivider } from "@/components/ui/gold-divider";
import { winterFacts } from "@/data/winter/facts";
import { winterStages } from "@/data/winter/stages";
import { socialMetadata } from "@/lib/seo/social";

const TITLE = "Winter stage-hopping & lift timer";
const DESCRIPTION =
  "Estimate transit times between Alpe d'Huez mountain stages, village stages, and resort hubs for Tomorrowland Winter 2027, broken down into walk or ski, lift ride, and queue buffer.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/winter-timer" },
  ...socialMetadata({ path: "/tools/winter-timer", title: TITLE, description: DESCRIPTION }),
};

const RELEVANT_FACT_IDS = new Set([
  "mountain-stage-opening-hours",
  "main-area-hours",
  "main-area-last-admission",
  "village-lift-last-departures",
  "transportation-pass-price",
  "free-town-lifts",
  "free-village-buses",
  "pedestrian-mountain-access",
  "walking-between-villages-prohibited",
  "resort-altitude-and-ski-area",
]);

function winterTimerSources(): readonly ToolSource[] {
  const byUrl = new Map<string, ToolSource>();

  for (const stage of winterStages) {
    if (byUrl.has(stage.source.url)) continue;
    byUrl.set(stage.source.url, {
      url: stage.source.url,
      label: stage.source.title,
      retrievedOn: stage.source.retrievedOn,
    });
  }

  for (const fact of winterFacts) {
    if (!RELEVANT_FACT_IDS.has(fact.id)) continue;
    if (byUrl.has(fact.source.url)) continue;
    byUrl.set(fact.source.url, {
      url: fact.source.url,
      label: fact.source.title,
      retrievedOn: fact.source.retrievedOn,
    });
  }

  return [...byUrl.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export default function WinterTimerPage() {
  const liftFact = winterFacts.find((f) => f.id === "village-lift-last-departures");
  const townLiftsFact = winterFacts.find((f) => f.id === "free-town-lifts");
  const busesFact = winterFacts.find((f) => f.id === "free-village-buses");

  return (
    <ToolShell
      kicker="Tomorrowland Winter"
      title="Winter stage-hopping & lift timer"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
        { label: "Winter stage-hopping & lift timer" },
      ]}
      intro={
        <>
          <p>
            Work out when to leave one Alpe d&apos;Huez stage or resort hub to catch a set at
            another. Choose ski/snowboard or pedestrian/gondola mode to see a transparent breakdown
            of walking or skiing, lift ride time, and queue buffer.
          </p>
          <p>
            All timings are independent planning estimates and depend on Alpine weather, lift
            queues, and resort operations. Distances are shown in miles.
          </p>
        </>
      }
      noscriptNote={
        <p>
          Without JavaScript the route timer cannot recalculate, but the verified Alpe d&apos;Huez
          lift hours, free town lifts, and official links below remain available.
        </p>
      }
      sources={winterTimerSources()}
    >
      <WinterTimerTool />

      <GoldDivider butterfly="left" />

      <section aria-labelledby="winter-timer-resort-facts">
        <p className="label text-accent">Verified Alpe d&apos;Huez transport</p>
        <h2 id="winter-timer-resort-facts" className="tool-panel__title">
          Key resort lift and shuttle rules
        </h2>
        <ul className="tool-sources">
          {liftFact ? (
            <li>
              <strong>{liftFact.label}:</strong> {liftFact.value}. {liftFact.detail}
            </li>
          ) : null}
          {townLiftsFact ? (
            <li>
              <strong>{townLiftsFact.label}:</strong> {townLiftsFact.value}. {townLiftsFact.detail}
            </li>
          ) : null}
          {busesFact ? (
            <li>
              <strong>{busesFact.label}:</strong> {busesFact.value}. {busesFact.detail}
            </li>
          ) : null}
        </ul>
      </section>
    </ToolShell>
  );
}
