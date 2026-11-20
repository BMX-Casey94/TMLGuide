import type { Metadata } from "next";
import Link from "next/link";
import { JourneyPlanner } from "@/components/tools/journey/journey-planner";
import { allJourneyPlans } from "@/components/tools/journey/journey-logic";
import { ToolShell, type ToolSource } from "@/components/tools/tool-shell";
import { GoldDivider } from "@/components/ui/gold-divider";

export const metadata: Metadata = {
  title: "Journey planner",
  description:
    "Work out how to reach Tomorrowland Belgium or Winter from a published route: the days each shuttle runs, the fares an operator publishes, and a plain notice wherever 2027 is missing.",
  alternates: { canonical: "/tools/journey" },
};

/** The plans, built once from the validated data layer. */
const PLANS = allJourneyPlans();

/**
 * Every source the plans cite, de-duplicated by URL.
 *
 * Built from the plans rather than typed here, so the footer lists exactly the
 * pages the steps used. A step whose record is withdrawn takes its source with
 * it instead of leaving a citation to a page nothing reads.
 */
function journeySources(): readonly ToolSource[] {
  const byUrl = new Map<string, ToolSource>();
  for (const plan of PLANS) {
    for (const source of Object.values(plan.sources)) {
      if (byUrl.has(source.url)) continue;
      byUrl.set(source.url, {
        url: source.url,
        label: source.title,
        retrievedOn: source.checkedOn,
      });
    }
  }
  return [...byUrl.values()].sort((left, right) => left.label.localeCompare(right.label));
}

/**
 * The Journey planner page.
 *
 * A Server Component. It builds every plan from `src/data` and `src/content`,
 * passes them to the client component as plain objects, and renders the framing,
 * independence notice and source list as static HTML.
 */
export default function JourneyToolPage() {
  return (
    <ToolShell
      kicker="Travel"
      title="Journey planner"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
        { label: "Journey planner" },
      ]}
      intro={
        <>
          <p>
            Pick the edition, where you are sleeping and how you are arriving, and this page sets
            out the route in order: which days a service runs, what it costs where a fare is
            published, and where 2027 is silent.
          </p>
          <p>
            Belgium and Winter only. Brasil is not offered, because no verified timetable or fares
            are published for Parque Maeda. The{" "}
            <Link href="/guides/brasil/transport">Brasil transport chapter</Link> sets out the
            verified parts.
          </p>
        </>
      }
      noscriptNote={
        <p>
          Without JavaScript the choices cannot be changed, so the page shows the Belgium, DreamVille,
          plane plan. The sources below the tool list every page the plans were read from.
        </p>
      }
      sources={journeySources()}
    >
      <JourneyPlanner plans={PLANS} />

      <GoldDivider butterfly="right" />

      <section aria-labelledby="journey-method">
        <p className="label text-accent">Method</p>
        <h2 className="journey-section__title" id="journey-method">
          How these routes are put together
        </h2>
        <ul className="journey-limits__list">
          <li>
            Each step is one fact from the validated data files or the guide chapters, with the page
            it was read from and the date it was checked.
          </li>
          <li>
            A day pattern, a departure time or a price appears only where an official page publishes
            it. A missing one is labelled &ldquo;Not published for 2027&rdquo; rather than filled
            from an earlier year.
          </li>
          <li>
            The order of decisions is the one the edition&rsquo;s transport chapter sets out, not a
            sequence written for this tool.
          </li>
        </ul>
      </section>
    </ToolShell>
  );
}
