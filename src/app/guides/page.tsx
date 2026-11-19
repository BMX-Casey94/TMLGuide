import type { Metadata } from "next";
import Link from "next/link";
import { EDITION_META, GUIDE_EDITIONS, editionChapters, type GuideChapter, type GuideEdition } from "@/content";
import { ChapterCard, EditionCard } from "@/components/guides/chapter-cards";
import { TICKETS_EXPLORER_HREF } from "@/components/guides/data-block";
import { breadcrumbListJsonLd, serialiseJsonLd } from "@/components/guides/json-ld";
import "@/components/guides/guides.css";

const TITLE = "Guides";
const DESCRIPTION =
  "Chapter-by-chapter guides to Tomorrowland Belgium, Winter and Brasil, plus the chapters that apply to every edition: tickets, DreamVille, travel, Pearls and the rules, each checked against the official pages.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides" },
  openGraph: {
    type: "website",
    siteName: "TMLGuide",
    title: `${TITLE} | TMLGuide`,
    description: DESCRIPTION,
    url: "/guides",
    locale: "en_GB",
  },
  twitter: {
    card: "summary",
    title: `${TITLE} | TMLGuide`,
    description: DESCRIPTION,
  },
};

/** The three editions, in the order the hub presents them. */
const EDITION_ORDER = ["belgium", "winter", "brasil"] as const;

export type HubChapters = Readonly<Record<GuideEdition, readonly GuideChapter[]>>;

export interface GuidesHubProps {
  /**
   * The chapters to list, per edition. Injected so a test can render the hub with
   * fixture chapters while the real content directories are being written; the
   * page passes the registry's own lists.
   */
  readonly chapters: HubChapters;
}

/**
 * The guides hub's markup, without any routing.
 *
 * Three edition cards, each listing its chapters with their summaries and check
 * dates, then the "Good to know" group for chapters that are not tied to one
 * edition. An edition with no chapters yet says so plainly rather than showing an
 * empty card, and the state disappears on its own when the first chapter lands.
 */
export function GuidesHub({ chapters }: GuidesHubProps) {
  const generalMeta = EDITION_META.general;
  const generalChapters = chapters.general;

  return (
    <>
      <script
        type="application/ld+json"
        /* A static object of our own strings, with `<` escaped, so nothing in a
           chapter title can close the element early. */
        dangerouslySetInnerHTML={{
          __html: serialiseJsonLd(
            breadcrumbListJsonLd([
              { name: "Home", path: "/" },
              { name: "Guides", path: "/guides" },
            ]),
          ),
        }}
      />

      <header className="tml-guide-hero">
        <p className="label text-accent">Guides</p>
        <h1 className="tml-guide-hero__title">The guide, in chapters</h1>
        <p className="tml-guide-hero__lede">
          Each edition is a short set of chapters that follows the order a trip takes: what the
          edition is, when tickets go on sale, where you sleep, how you get there, and what it costs
          once you are inside. Every chapter names the official pages behind it and the date it was
          checked.
        </p>
      </header>

      <section className="tml-guide-section" aria-labelledby="editions-heading">
        <h2 className="tml-guide-section__title" id="editions-heading">
          Editions
        </h2>
        <p className="tml-guide-section__lede">
          Pick the edition you are going to. The chapters inside each one cover only that edition.
        </p>

        <div className="tml-guide-grid">
          {EDITION_ORDER.map((edition) => {
            const meta = EDITION_META[edition];
            return (
              <EditionCard
                key={edition}
                edition={edition}
                title={meta.title}
                summary={meta.summary}
                chapters={chapters[edition]}
              />
            );
          })}
        </div>
      </section>

      <section className="tml-guide-section" aria-labelledby="general-heading">
        <h2 className="tml-guide-section__title" id="general-heading">
          {generalMeta.title}
        </h2>
        <p className="tml-guide-section__lede">{generalMeta.summary}</p>

        {generalChapters.length === 0 ? (
          <div className="tml-guide-empty">
            <p className="tml-guide-empty__title">Being checked</p>
            <p>
              Chapters for this edition are being checked against the official site and will appear
              here once verified.
            </p>
          </div>
        ) : (
          <div className="tml-guide-grid">
            {generalChapters.map((chapter) => (
              <ChapterCard key={chapter.slug} chapter={chapter} />
            ))}
          </div>
        )}
      </section>

      <section className="tml-guide-section" aria-labelledby="tickets-heading">
        <h2 className="tml-guide-section__title" id="tickets-heading">
          Prices, in one place
        </h2>
        <p className="tml-guide-section__lede">
          The tickets explorer holds every published price for all three editions, with the sale
          calendar and what each package includes. The chapters explain what the figures mean; the
          explorer is where you compare them.
        </p>
        <p>
          <Link href={TICKETS_EXPLORER_HREF} className="tml-guide-link">
            Open the tickets and packages explorer
          </Link>
        </p>
      </section>

      <p className="tml-guide-note">
        TMLGuide is an independent fan guide, not affiliated with, endorsed by or sponsored by
        Tomorrowland or WeAreOne.World B.V. {GUIDE_EDITIONS.length} editions are covered here, and
        every figure comes from an official page checked on the date shown beside it.
      </p>
    </>
  );
}

/**
 * The guides hub.
 *
 * A Server Component that reads the registry. Every chapter it names comes from
 * `src/content`, so a chapter that has not been written yet simply does not appear.
 */
export default function GuidesPage() {
  const chapters: Record<GuideEdition, readonly GuideChapter[]> = {
    belgium: editionChapters("belgium"),
    winter: editionChapters("winter"),
    brasil: editionChapters("brasil"),
    general: editionChapters("general"),
  };

  return (
    <main id="main" className="tml-guide-page">
      <GuidesHub chapters={chapters} />
    </main>
  );
}
