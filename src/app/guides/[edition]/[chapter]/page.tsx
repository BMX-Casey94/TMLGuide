import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EDITION_META,
  chapterParamsForBuild,
  editionChapters,
  editionLabel,
  getChapter,
  relatedChapters,
  type GuideChapter,
} from "@/content";
import { ChapterBlocks, tableOfContents } from "@/components/guides/blocks";
import { Breadcrumbs, chapterCrumbs } from "@/components/guides/breadcrumbs";
import {
  ChapterHeader,
  ChapterPager,
  IndependenceNote,
  RelatedChapters,
  SourcesList,
} from "@/components/guides/chapter-parts";
import { breadcrumbListJsonLd, serialiseJsonLd } from "@/components/guides/json-ld";
import { TableOfContents } from "@/components/guides/table-of-contents";
import { resolveChapterRoute } from "@/components/guides/routes";
import { socialMetadata } from "@/lib/seo/social";
import { chapterPageTitle } from "@/lib/seo/titles";
import "@/components/guides/guides.css";

/**
 * A chapter page.
 *
 * The body is a Server Component with no client work except the table of contents,
 * which only marks the active section: the anchors, the headings, the tables, the
 * sources and the prev/next links all work with JavaScript switched off.
 */

export function generateStaticParams(): { edition: string; chapter: string }[] {
  /*
    Every real chapter, or — while the content directories are still empty — one
    placeholder pair. Next 16 with `cacheComponents` refuses an empty result, and the
    placeholder resolves to no chapter, so it renders the not-found page and
    disappears the moment a chapter exists.
  */
  return chapterParamsForBuild().map((param) => ({
    edition: param.edition,
    chapter: param.chapter,
  }));
}

/**
 * Resolves the raw params to a chapter, or null.
 *
 * Exported so the not-found behaviour is a pure assertion rather than a run of the
 * server: a bad edition, a bad slug and a well-formed pair that names no chapter
 * all answer null, and the page turns that into `notFound()`.
 */
export function resolveChapterPage(edition: unknown, chapter: unknown): GuideChapter | null {
  return resolveChapterRoute(edition, chapter, getChapter);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string; chapter: string }>;
}): Promise<Metadata> {
  const { edition, chapter } = await params;
  const resolved = resolveChapterPage(edition, chapter);
  if (resolved === null) return { title: "Chapter not found" };

  const path = `/guides/${resolved.edition}/${resolved.slug}`;
  /*
    The page title is made unique here rather than left as the chapter's own
    title: Belgium and Winter both have an "Accommodation" chapter, and Brasil
    and Winter both have "Getting there", so four pairs of pages were competing
    with each other under one identical `<title>`. `chapterPageTitle` appends the
    edition, except where the title already names it.
  */
  const title = chapterPageTitle(resolved);

  return {
    title,
    description: resolved.summary,
    alternates: { canonical: path },
    /*
      `article` rather than `website`: a chapter is a dated body of prose with
      sources, not a landing page. The helper also supplies the Twitter card,
      which this route previously omitted entirely.

      Text only: no `images` entry. The site has no per-chapter artwork, and an
      Open Graph image that does not describe the chapter is worse than the
      fallback the crawler chooses.
    */
    ...socialMetadata({
      path,
      title,
      description: resolved.summary,
      type: "article",
    }),
  };
}

export interface ChapterViewProps {
  readonly chapter: GuideChapter;
  /**
   * The chapter's edition siblings, in order. Injected so a test can supply
   * fixture neighbours; the page passes the registry's list.
   */
  readonly siblings: readonly GuideChapter[];
  /**
   * The related chapters, already resolved. Injected for the same reason, and
   * because the page resolves them permissively while the tests resolve them
   * strictly.
   */
  readonly related: readonly GuideChapter[];
}

/** The chapter's markup, without any routing. */
export function ChapterView({ chapter, siblings, related }: ChapterViewProps) {
  const toc = tableOfContents(chapter);
  /*
    Neighbours are decided by `order`, not by whatever order the caller's array
    happens to be in: the edition hub and the page both hand over the registry's
    sorted list, but a reader's "next chapter" must be the next one in the edition
    even if a caller is untidy.
  */
  const ordered = [...siblings].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((candidate) => candidate.slug === chapter.slug);
  const previous = index > 0 ? (ordered[index - 1] ?? null) : null;
  const next = index >= 0 && index < ordered.length - 1 ? (ordered[index + 1] ?? null) : null;
  const crumbs = chapterCrumbs(chapter.edition, chapter.title);
  const editionMeta = EDITION_META[chapter.edition];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serialiseJsonLd(
            breadcrumbListJsonLd([
              { name: "Home", path: "/" },
              { name: "Guides", path: "/guides" },
              { name: editionMeta.title, path: `/guides/${chapter.edition}` },
              { name: chapter.title, path: `/guides/${chapter.edition}/${chapter.slug}` },
            ]),
          ),
        }}
      />

      <Breadcrumbs crumbs={crumbs} />

      <ChapterHeader chapter={chapter} titleId="chapter-title" />

      <div className="tml-guide-chapter">
        <TableOfContents entries={toc} chapterTitle={chapter.title} />

        <div className="tml-guide-chapter__main">
          {/* The article wraps the body and its source list, because the list is
              part of the same piece of content: the markers in the text refer to
              it, and a reader should not have to leave the article to check a
              figure. */}
          <article aria-labelledby="chapter-title">
            <ChapterBlocks chapter={chapter} />
            <SourcesList chapter={chapter} />
          </article>

          <ChapterPager previous={previous} next={next} />

          <RelatedChapters chapters={related} />

          {siblings.length > 1 ? (
            <p className="tml-guide-data__foot">
              <span className="label">Edition</span>{" "}
              <Link href={`/guides/${chapter.edition}`} className="tml-guide-link">
                All {siblings.length} {editionLabel(chapter.edition)} chapters
              </Link>
            </p>
          ) : null}

          <IndependenceNote />
        </div>
      </div>
    </>
  );
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ edition: string; chapter: string }>;
}) {
  const { edition, chapter } = await params;
  const resolved = resolveChapterPage(edition, chapter);
  if (resolved === null) notFound();

  return (
    <main id="main" className="tml-guide-page">
      <ChapterView
        chapter={resolved}
        siblings={editionChapters(resolved.edition)}
        /*
          Related links resolve permissively here: a stale cross-edition reference
          costs the reader a card, never the page. The test suite runs the same
          function in strict mode, so a broken reference still fails the checks.
        */
        related={relatedChapters(resolved)}
      />
    </main>
  );
}
