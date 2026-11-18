import type { Metadata } from "next";
import Link from "next/link";
import { GoldDivider } from "@/components/ui/gold-divider";
import { SectionHeading } from "@/components/ui/section-heading";
import { CommunityHub } from "@/components/community/community-hub";
import { PartnerCard } from "@/components/community/partner-card";
import { PartnerDisclosure, PARTNER_LIST_INTRO } from "@/components/community/partner-disclosure";
import { ResourceDirectory } from "@/components/community/resource-directory";
import { WhatsappDirectory } from "@/components/community/whatsapp-directory";
import { communityCounts, whatsappSummary } from "@/components/community/community-counts";
import { partners, resources, whatsappGroups } from "@/data/community";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Community-run WhatsApp groups, third-party resources and partner offers for Tomorrowland, with every link checked and every partner disclosure printed in full.",
  alternates: { canonical: "/community" },
};

/**
 * The community hub.
 *
 * A Server Component. Every record is imported here and rendered into the panels
 * before the hub is handed them, so the page ships only the interactive shell
 * (tabs and the directory's filters) to the browser.
 *
 * Safety rule applied throughout: the WhatsApp groups and most of the resources
 * are run by other attendees, and the partners are commercial. Each of those gets
 * its warning where the reader meets it, not in a footnote.
 */
export default function CommunityPage() {
  const counts = communityCounts(whatsappGroups, resources, partners);

  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-7">
      <header className="pt-14 pb-4">
        <p className="label text-accent">Independent guide</p>
        <h1 className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl">
          Community
        </h1>
        <p className="mt-4 max-w-[62ch] text-cream-mute">
          Attendee-run chats, the links worth keeping, and the partners the community site used to
          carry. None of it is run by Tomorrowland, and none of it is a substitute for the official
          channels.
        </p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-cream-mute">
          {counts.whatsappGroups} groups · {counts.resources} resources · {counts.partners} partners
        </p>
      </header>

      <CommunityHub
        whatsappPanel={
          <div>
            <SectionHeading
              id="community-whatsapp"
              kicker="01 · WhatsApp groups"
              title="Chats run by other attendees"
              lede={whatsappSummary(whatsappGroups)}
            />
            <WhatsappDirectory groups={whatsappGroups} />
          </div>
        }
        resourcesPanel={
          <div>
            <SectionHeading
              id="community-resources"
              kicker="02 · Resources"
              title="Links worth keeping"
              lede="Grouped by what they are for. Official Tomorrowland pages carry an Official badge; anything else says plainly that it is not."
            />
            <ResourceDirectory resources={resources} />
          </div>
        }
        partnersPanel={
          <div>
            <SectionHeading
              id="community-partners"
              kicker="03 · Partners"
              title="Partner offers"
              lede={PARTNER_LIST_INTRO}
            />
            <PartnerDisclosure />
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {partners.map((partner) => (
                <li key={partner.id} className="flex">
                  <PartnerCard partner={partner} className="w-full" />
                </li>
              ))}
            </ul>
          </div>
        }
      />

      <GoldDivider butterfly="right" />

      <section aria-labelledby="community-official" className="mt-4">
        <h2 id="community-official" className="font-display text-2xl">
          Where the official answers are
        </h2>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-cream-mute">
          For tickets, transfers, bracelets and anything that involves money or personal details,
          use Tomorrowland&rsquo;s own pages rather than a community chat. TMLGuide is independent and
          cannot resolve a dispute with a seller or a partner.
        </p>
        <p className="mt-4">
          <Link
            href="/guides"
            className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent underline-offset-4 hover:underline"
          >
            Read the guides
            <span aria-hidden="true">→</span>
          </Link>
        </p>
      </section>
    </main>
  );
}
