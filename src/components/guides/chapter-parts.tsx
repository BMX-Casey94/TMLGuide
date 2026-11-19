import Link from "next/link";
import type { GuideChapter, GuideEdition } from "@/content/schema";
import { chapterPath, editionLabel } from "@/content";
import { formatCheckedDate, formatLongCheckedDate } from "./format";
import "./guides.css";

/**
 * The pieces around a chapter body: the source list, the previous/next cards, the
 * related chapters, and the independence note.
 *
 * Each one is a separate export rather than a section of one component so a test
 * can render the part it is about, and so the page can order them explicitly.
 */

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface SourcesListProps {
  readonly chapter: GuideChapter;
}

/**
 * Every source the chapter cites, numbered to match the markers in the text.
 *
 * The anchor id is built from the chapter slug and the source position, which is
 * what the markers in the body link to. The number is inside the link's accessible
 * name through the surrounding list item's label, so a screen reader hears
 * "Source 1, …" rather than a bare title.
 */
export function SourcesList({ chapter }: SourcesListProps) {
  return (
    <section className="tml-guide-sources" id="sources" aria-labelledby="sources-heading">
      <h2 className="tml-guide-sources__title" id="sources-heading">
        Sources
      </h2>
      <p className="tml-guide-sources__lede">
        Every statement above is checked against one of these pages. The numbers match the markers
        in the text.
      </p>
      <ol className="tml-guide-sources__list">
        {chapter.sources.map((source, index) => {
          const checked = formatCheckedDate(source.checkedOn);
          return (
            <li
              key={source.id}
              id={`source-${chapter.slug}-${index + 1}`}
              className="tml-guide-source"
            >
              <span className="tml-guide-source__number" aria-hidden="true">
                [{index + 1}]
              </span>
              <span className="tml-guide-source__body">
                <a
                  className="tml-guide-source__link"
                  href={source.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  /* The visible text is the title; the number and the new-tab
                     warning are in the accessible name so a screen reader hears
                     "Source 1: …" and knows the link leaves the site. */
                  aria-label={`Source ${index + 1}: ${source.title} (opens in a new tab)`}
                >
                  {source.title}
                </a>
                <span className="tml-guide-source__host">{hostOf(source.url)}</span>
                {checked === null ? null : (
                  <span className="tml-guide-source__checked">
                    Checked <time dateTime={source.checkedOn}>{checked}</time>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export interface ChapterPagerProps {
  readonly previous: GuideChapter | null;
  readonly next: GuideChapter | null;
}

/** The two cards that carry a reader forward or back within the edition. */
export function ChapterPager({ previous, next }: ChapterPagerProps) {
  if (previous === null && next === null) return null;

  return (
    <nav className="tml-guide-pager" aria-label="Chapters in this edition">
      {previous === null ? null : (
        <Link href={chapterPath(previous)} className="tml-guide-pager__link">
          <span className="tml-guide-pager__direction">← Previous chapter</span>
          <span className="tml-guide-pager__title">{previous.title}</span>
        </Link>
      )}
      {next === null ? null : (
        <Link href={chapterPath(next)} className="tml-guide-pager__link tml-guide-pager__link--next">
          <span className="tml-guide-pager__direction">Next chapter →</span>
          <span className="tml-guide-pager__title">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}

export interface RelatedChaptersProps {
  readonly chapters: readonly GuideChapter[];
}

/** Chapters elsewhere in the guide that cover related ground. */
export function RelatedChapters({ chapters }: RelatedChaptersProps) {
  if (chapters.length === 0) return null;

  return (
    <section className="tml-guide-related" aria-labelledby="related-heading">
      <h2 className="tml-guide-related__title" id="related-heading">
        Related chapters
      </h2>
      <ul className="tml-guide-related__list">
        {chapters.map((chapter) => (
          <li key={`${chapter.edition}/${chapter.slug}`}>
            <Link href={chapterPath(chapter)} className="tml-guide-related__link">
              <span className="tml-guide-related__edition">{editionLabel(chapter.edition)}</span>
              <span>{chapter.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The short note that repeats, on every chapter, what this site is and is not. */
export function IndependenceNote() {
  return (
    <aside className="tml-guide-note" aria-label="About this guide">
      <p>
        TMLGuide is an independent fan guide, not affiliated with, endorsed by or sponsored by
        Tomorrowland or WeAreOne.World B.V. Each chapter carries the date it was last checked against
        the official pages. <Link href="/about" className="tml-guide-link">How the facts are checked</Link>.
      </p>
    </aside>
  );
}

export interface ChapterHeaderProps {
  readonly chapter: GuideChapter;
  /** Id for the chapter title, so the article can be labelled by it. */
  readonly titleId?: string;
}

/** The chapter opener: edition label, title, summary and check date. */
export function ChapterHeader({ chapter, titleId }: ChapterHeaderProps) {
  /* The header states the check date in full, as the brief asks: "Checked
     18 November 2026". The shorter "18 Nov 2026" is kept for the compact card and
     source lines, where the space is tighter. */
  const checked = formatLongCheckedDate(chapter.lastVerified);

  return (
    <header className="tml-guide-hero">
      <p className="label text-accent">{editionLabel(chapter.edition)} · Guide chapter</p>
      <h1 className="tml-guide-hero__title" id={titleId}>
        {chapter.title}
      </h1>
      <p className="tml-guide-hero__lede">{chapter.summary}</p>
      {checked === null ? null : (
        <p className="tml-guide-hero__meta">
          <span>
            Checked <time dateTime={chapter.lastVerified}>{checked}</time>
          </span>
          <span>{chapter.sources.length} sources cited</span>
        </p>
      )}
    </header>
  );
}

/** The label of a chapter's edition, for the hub's chapter cards. */
export function chapterEditionLabel(edition: GuideEdition): string {
  return editionLabel(edition);
}
