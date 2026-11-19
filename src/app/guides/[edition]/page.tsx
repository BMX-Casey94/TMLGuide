import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EDITION_META,
  GUIDE_EDITIONS,
  editionChapters,
  editionLabel,
  latestCheckedOn,
  type GuideChapter,
  type GuideEdition,
} from "@/content";
import { Breadcrumbs, editionCrumbs } from "@/components/guides/breadcrumbs";
import { ChapterCard } from "@/components/guides/chapter-cards";
import { formatCheckedDate } from "@/components/guides/format";
import { breadcrumbListJsonLd, serialiseJsonLd } from "@/components/guides/json-ld";
import { parseEditionParam } from "@/components/guides/routes";
import "@/components/guides/guides.css";

interface EditionPageData {
  readonly edition: GuideEdition;
  readonly title: string;
  readonly summary: string;
}

/** Resolves a raw `[edition]` segment to the data the page and its metadata need. */
function editionPageData(value: unknown): EditionPageData | null {
  const edition = parseEditionParam(value);
  if (edition === null) return null;
  const meta = EDITION_META[edition];
  return { edition, title: meta.title, summary: meta.summary };
}

/** Every edition the hub serves, for `generateStaticParams`. */
export function generateStaticParams(): { edition: GuideEdition }[] {
  return GUIDE_EDITIONS.map((edition) => ({ edition }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  const { edition: editionValue } = await params;
  const data = editionPageData(editionValue);
  if (data === null) return { title: "Edition not found" };

  const path = `/guides/${data.edition}`;
  return {
    title: data.title,
    description: data.summary,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "TMLGuide",
      title: `${data.title} | TMLGuide`,
      description: data.summary,
      url: path,
      locale: "en_GB",
    },
    twitter: {
      card: "summary",
      title: `${data.title} | TMLGuide`,
      description: data.summary,
    },
  };
}

export interface EditionHubProps {
  readonly edition: GuideEdition;
  /**
   * The chapters to list. Injected so a test can render a hub with a fixture
   * chapter while the real content directories are still being written; the page
   * passes the registry's own list.
   */
  readonly chapters: readonly GuideChapter[];
}

/**
 * The edition hub's markup, without any routing.
 *
 * Separated from the page so a test can render it with fixture chapters. An
 * edition with none says so plainly in the same words the guides hub uses, and the
 * state disappears on its own when the first chapter lands, because the list is
 * data rather than a flag.
 */
export function EditionHub({ edition, chapters }: EditionHubProps) {
  const meta = EDITION_META[edition];
  const latest = latestCheckedOn(chapters);
  const latestLabel = latest === null ? null : formatCheckedDate(latest);
  const crumbs = editionCrumbs(edition);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serialiseJsonLd(
            breadcrumbListJsonLd([
              { name: "Home", path: "/" },
              ...crumbs.map((crumb) => ({
                name: crumb.label,
                path: crumb.href ?? `/guides/${edition}`,
              })),
            ]),
          ),
        }}
      />

      <Breadcrumbs crumbs={crumbs} />

      <header className="tml-guide-hero">
        <p className="label text-accent">{editionLabel(edition)}</p>
        <h1 className="tml-guide-hero__title">{meta.title}</h1>
        <p className="tml-guide-hero__lede">{meta.summary}</p>
        {latestLabel === null ? null : (
          <p className="tml-guide-hero__meta">
            <span>
              {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
            </span>
            <span>
              Latest check <time dateTime={latest ?? undefined}>{latestLabel}</time>
            </span>
          </p>
        )}
      </header>

      <section className="tml-guide-section" aria-labelledby="chapters-heading">
        <h2 className="tml-guide-section__title" id="chapters-heading">
          Chapters
        </h2>
        <p className="tml-guide-section__lede">
          In the order a trip takes. Each chapter stands on its own, so you can read only the part you
          need.
        </p>

        {chapters.length === 0 ? (
          <div className="tml-guide-empty">
            <p className="tml-guide-empty__title">Being checked</p>
            <p>
              Chapters for this edition are being checked against the official site and will appear
              here once verified.
            </p>
          </div>
        ) : (
          <div className="tml-guide-grid">
            {chapters.map((chapter) => (
              <ChapterCard key={chapter.slug} chapter={chapter} />
            ))}
          </div>
        )}
      </section>

      <p className="tml-guide-note">
        Every chapter is checked against the official Tomorrowland pages, and each one shows the date
        of its last check. This is an independent fan guide, not an official festival page.{" "}
        <Link href="/guides" className="tml-guide-link">
          All guides
        </Link>
        .
      </p>
    </>
  );
}

/** An edition hub: the chapter cards, their order, summary and check date. */
export default async function EditionPage({ params }: { params: Promise<{ edition: string }> }) {
  const { edition: editionValue } = await params;
  const data = editionPageData(editionValue);
  if (data === null) notFound();

  return (
    <main id="main" className="tml-guide-page">
      <EditionHub edition={data.edition} chapters={editionChapters(data.edition)} />
    </main>
  );
}
