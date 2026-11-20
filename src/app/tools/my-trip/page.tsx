import type { Metadata } from "next";
import type { EditionTripData } from "@/components/tools/my-trip/trip-logic";
import { MyTrip } from "@/components/tools/my-trip/my-trip";
import { ToolShell, type ToolSource } from "@/components/tools/tool-shell";
import { buildTripData } from "./trip-data";

export const metadata: Metadata = {
  title: "My Trip",
  description:
    "Keep one private trip sheet for Tomorrowland in your browser: the weekend, your ticket, where you are staying and the sale dates, with nothing sent anywhere.",
  alternates: { canonical: "/tools/my-trip" },
};

/**
 * The sources every edition's sheet prints.
 *
 * Built from the data the sheet reads, so a price's stated source is the source
 * the sheet actually used: the ticket and package records, the shared editions
 * record that dates the weekend, and the sale windows. De-duplicated by URL,
 * because two sale tiers of the same product cite one page and should appear
 * once rather than twice.
 */
function tripSources(data: ReturnType<typeof buildTripData>): readonly ToolSource[] {
  const byUrl = new Map<string, ToolSource>();
  const add = (source: {
    url: string;
    title: string;
    lastVerified: string;
  }): void => {
    if (byUrl.has(source.url)) return;
    byUrl.set(source.url, {
      url: source.url,
      label: source.title,
      retrievedOn: source.lastVerified,
    });
  };

  for (const edition of Object.values(data) as EditionTripData[]) {
    for (const ticket of edition.tickets) {
      add({ url: ticket.sourceUrl, title: ticket.sourceTitle, lastVerified: ticket.lastVerified });
    }
    for (const pkg of edition.packages) {
      add({ url: pkg.sourceUrl, title: pkg.sourceTitle, lastVerified: pkg.lastVerified });
    }
    for (const window of edition.saleWindows) {
      add({
        url: window.sourceUrl,
        title: window.sourceTitle,
        lastVerified: window.lastVerified,
      });
    }
  }

  return [...byUrl.values()];
}

/**
 * The My Trip page.
 *
 * A Server Component. It narrows the three editions' tickets, packages, dates
 * and sale windows into the small objects the client sheet needs, and resolves
 * the guide chapter links against the live content registry so a missing chapter
 * leaves a shorter list rather than a dead link. The sheet itself is the only
 * part that runs in the browser, and it never talks to a server.
 */
export default function MyTripPage() {
  const data = buildTripData();

  return (
    <ToolShell
      kicker="Your plan"
      title="My Trip"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
        { label: "My Trip" },
      ]}
      intro={
        <>
          <p>
            One sheet for your own Tomorrowland trip: the weekend you are going to, the ticket you
            hold, where you are staying and how you are getting there, with the sale dates you should
            not miss.
          </p>
          <p>
            It is stored in this browser and nowhere else. There is no account, no cookie and no
            request to a server, so nobody else can read it, and it is yours to export as a file.
          </p>
        </>
      }
      noscriptNote={
        <p>
          Without JavaScript the sheet cannot be read or saved, because the browser&rsquo;s own
          storage is the only place it lives. The ticket names and prices in the lists below are
          still on the page, and the official sources are listed at the foot.
        </p>
      }
      sources={tripSources(data)}
    >
      <MyTrip data={data} />
    </ToolShell>
  );
}
