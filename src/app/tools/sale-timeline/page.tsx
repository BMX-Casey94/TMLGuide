import type { Metadata } from "next";
import { SaleTimelineTabs, type EditionSales } from "@/components/tools/sale-timeline-tabs";
import { ToolShell, type ToolSource } from "@/components/tools/tool-shell";
import type { SaleRecord } from "@/components/tools/timeline-logic";
import { saleWindows as belgiumSaleWindows } from "@/data/belgium";
import { winterSaleWindows } from "@/data/winter";
import { brasilSaleWindows } from "@/data/brasil";

export const metadata: Metadata = {
  title: "Ticket sale timeline",
  description:
    "Every published Tomorrowland ticket sale for Belgium, Winter and Brasil, with a live countdown, times in your own zone and Brussels time, and a calendar export carrying two reminders.",
  alternates: { canonical: "/tools/sale-timeline" },
};

/**
 * Reduces a data record to the fields the client timeline needs.
 *
 * Passing whole records over the boundary would ship source metadata and
 * edition scoping the browser never reads, so the page narrows each one here.
 */
function toRecord(record: {
  id: string;
  name: string;
  audience: string;
  notes?: string;
  opensAt: string;
  source: { url: string };
  lastVerified: string;
}): SaleRecord {
  return {
    id: record.id,
    name: record.name,
    audience: record.audience,
    ...(record.notes === undefined ? {} : { notes: record.notes }),
    opensAt: record.opensAt,
    source: { url: record.source.url },
    lastVerified: record.lastVerified,
  };
}

/** The sources for every sale listed on the page, de-duplicated by URL. */
function timelineSources(): readonly ToolSource[] {
  const byUrl = new Map<string, ToolSource>();
  const collections = [belgiumSaleWindows, winterSaleWindows, brasilSaleWindows];

  for (const records of collections) {
    for (const record of records) {
      const key = record.source.url;
      if (byUrl.has(key)) continue;
      // The record's own title is the official page's name, which is more
      // useful than a generic edition label when two sales cite different pages.
      byUrl.set(key, {
        url: key,
        label: record.source.title,
        retrievedOn: record.source.retrievedOn,
      });
    }
  }

  return [...byUrl.values()];
}

/**
 * The sale timeline page.
 *
 * A Server Component. It reads the three editions' sale windows from the data
 * layer, narrows them, and hands them to the interactive tabs. The countdown
 * itself is the only part that needs a clock.
 */
export default function SaleTimelinePage() {
  const editions: readonly EditionSales[] = [
    {
      edition: "belgium",
      label: "Belgium",
      records: belgiumSaleWindows.map(toRecord),
    },
    {
      edition: "winter",
      label: "Winter",
      records: winterSaleWindows.map(toRecord),
    },
    {
      edition: "brasil",
      label: "Brasil",
      records: brasilSaleWindows.map(toRecord),
    },
  ];

  return (
    <ToolShell
      kicker="Dates"
      title="Ticket sale timeline"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
        { label: "Sale timeline" },
      ]}
      intro={
        <>
          <p>
            Every sale moment the organisers have published, in the order they open, with a countdown
            to the next one. Times are shown in your own zone and in the festival&rsquo;s zone.
          </p>
          <p>
            Calendar events carry two reminders, 30 minutes and 1 day before each sale. The Exchange
            Desk is the only official resale route.
          </p>
        </>
      }
      noscriptNote={
        <p>
          Without JavaScript the countdown cannot run and the calendar files cannot be generated.
          Every date, its audience and its official source are still listed above and below.
        </p>
      }
      sources={timelineSources()}
    >
      <SaleTimelineTabs editions={editions} initialEdition="belgium" />

      <p className="tool-note tool-note--info">
        <span className="tool-note__label">About the countdown</span>
        <span>
          The countdown pauses while the tab is in the background, so it neither drifts nor keeps a
          phone awake. A screen reader hears the time remaining once a minute rather than every
          second.
        </span>
      </p>
    </ToolShell>
  );
}
