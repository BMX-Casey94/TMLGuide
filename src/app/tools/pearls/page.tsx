import type { Metadata } from "next";
import { PearlCalculator } from "@/components/tools/pearl-calculator";
import { ToolShell, type ToolSource } from "@/components/tools/tool-shell";
import { sharedData } from "@/data/shared";

export const metadata: Metadata = {
  title: "Pearl calculator",
  description:
    "Convert between euros and Tomorrowland Pearls at a rate you supply. The 2027 Pearl rate is not published, so this tool asks for it rather than assuming one.",
  alternates: { canonical: "/tools/pearls" },
};

/**
 * The FAQ entries that explain the cashless system.
 *
 * Looked up by id from the shared data, so the page links to the same official
 * source the FAQ itself cites. The Pearl rate is not read out of this prose: it
 * belongs to a previous edition, and the brief is explicit that the tool asks
 * the reader for a rate instead of scraping one.
 */
const RATE_TIMING_FAQ_ID = "pearls-rate-timing";
const PEARLS_FAQ_ID = "pearls";

function pearlSources(): readonly ToolSource[] {
  const sources: ToolSource[] = [];
  const seen = new Set<string>();

  for (const faqId of [RATE_TIMING_FAQ_ID, PEARLS_FAQ_ID]) {
    const entry = sharedData.faqs.find((faq) => faq.id === faqId);
    if (entry === undefined) continue;
    if (seen.has(entry.source.url)) continue;
    seen.add(entry.source.url);
    sources.push({
      url: entry.source.url,
      label: entry.source.title,
      retrievedOn: entry.source.retrievedOn,
    });
  }

  return sources;
}

/**
 * The URL of the page where the rate will be announced.
 *
 * Taken from the FAQ's own citation rather than written here, so it points at
 * the page the guide actually checked.
 */
function rateInformationUrl(): string {
  const entry = sharedData.faqs.find((faq) => faq.id === RATE_TIMING_FAQ_ID);
  return entry?.source.url ?? "https://belgium.tomorrowland.com/en/my-bracelet/cashless-information/";
}

/**
 * The Pearl calculator page.
 *
 * A Server Component that resolves the official cashless page from the data
 * layer and gives the client calculator only that URL. No rate is passed in,
 * because there is no 2027 rate to pass.
 */
export default function PearlToolPage() {
  return (
    <ToolShell
      kicker="Cashless"
      title="Pearl calculator"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
        { label: "Pearl calculator" },
      ]}
      intro={
        <>
          <p>
            Pearls are the festival&rsquo;s cashless currency, loaded onto your bracelet. This tool
            converts between euros and Pearls so you can judge how far a top-up goes.
          </p>
          <p>
            The rate for 2027 has not been announced, so you type it in. The organisers publish the
            value of a Pearl only when top-ups open, which for a July festival means around June.
          </p>
        </>
      }
      noscriptNote={
        <p>
          Without JavaScript the conversion cannot run. The official cashless page, linked under
          Sources, carries the rate once it is published.
        </p>
      }
      sources={pearlSources()}
    >
      <PearlCalculator rateInformationUrl={rateInformationUrl()} />
    </ToolShell>
  );
}
