import Link from "next/link";
import type { GuideChapter, GuideEdition } from "@/content/schema";
import { chapterPath, editionChapters, editionLabel, latestCheckedOn } from "@/content";
import { formatCheckedDate } from "./format";
import "./guides.css";

/**
 * The cards the two hub pages are built from.
 *
 * Both are server components and both are whole-card links, so a reader clicks
 * anywhere on the card and a keyboard user gets one tab stop per chapter.
 */

export interface EditionCardProps {
  readonly edition: GuideEdition;
  readonly title: string;
  readonly summary: string;
  readonly chapters: readonly GuideChapter[];
}

/**
 * One edition on the `/guides` hub: the title, what it covers, and every chapter
 * with its summary and check date.
 */
export function EditionCard({ edition, title, summary, chapters }: EditionCardProps) {
  const latest = latestCheckedOn(chapters);
  const latestLabel = latest === null ? null : formatCheckedDate(latest);

  return (
    <section className="tml-guide-edition" aria-labelledby={`edition-${edition}`}>
      <p className="label text-cream-mute">Edition</p>
      <h2 className="tml-guide-edition__title" id={`edition-${edition}`}>
        <Link href={`/guides/${edition}`} className="tml-guide-link">
          {title}
        </Link>
      </h2>
      <p className="tml-guide-edition__summary">{summary}</p>

      {chapters.length === 0 ? (
        <p className="tml-guide-edition__empty">
          Chapters for this edition are being checked against the official site and will appear here
          once verified.
        </p>
      ) : (
        <>
          <ul className="tml-guide-edition__chapters">
            {chapters.map((chapter) => {
              const checked = formatCheckedDate(chapter.lastVerified);
              return (
                <li key={chapter.slug}>
                  <Link href={chapterPath(chapter)} className="tml-guide-link">
                    <span className="tml-guide-edition__chapter-title">{chapter.title}</span>
                  </Link>
                  <span className="tml-guide-edition__chapter-summary">{chapter.summary}</span>
                  {checked === null ? null : (
                    <span className="tml-guide-edition__checked">
                      Checked{" "}
                      <time dateTime={chapter.lastVerified}>{checked}</time>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {latestLabel === null ? null : (
            <p className="tml-guide-chapter-card__meta">
              {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"} · last checked{" "}
              <time dateTime={latest ?? undefined}>{latestLabel}</time>
            </p>
          )}
        </>
      )}
    </section>
  );
}

export interface ChapterCardProps {
  readonly chapter: GuideChapter;
}

/**
 * One chapter on an edition hub: order, title, summary and the check date. The
 * whole card is a single link, and the order is part of the link's accessible name
 * so a screen reader hears the sequence.
 */
export function ChapterCard({ chapter }: ChapterCardProps) {
  const checked = formatCheckedDate(chapter.lastVerified);

  return (
    <Link href={chapterPath(chapter)} className="tml-guide-chapter-card">
      <span className="tml-guide-chapter-card__order">
        Chapter {chapter.order} · {editionLabel(chapter.edition)}
      </span>
      <span className="tml-guide-chapter-card__title">{chapter.title}</span>
      <span className="tml-guide-chapter-card__summary">{chapter.summary}</span>
      {checked === null ? null : (
        <span className="tml-guide-chapter-card__meta">
          Checked <time dateTime={chapter.lastVerified}>{checked}</time>
        </span>
      )}
    </Link>
  );
}

export interface EditionChapterListProps {
  readonly edition: GuideEdition;
}

/** The chapter cards of one edition, read from the registry. */
export function EditionChapterList({ edition }: EditionChapterListProps) {
  const chapters = editionChapters(edition);

  if (chapters.length === 0) {
    return (
      <div className="tml-guide-empty">
        <p className="tml-guide-empty__title">Being checked</p>
        <p>
          Chapters for this edition are being checked against the official site and will appear here
          once verified.
        </p>
      </div>
    );
  }

  return (
    <div className="tml-guide-grid">
      {chapters.map((chapter) => (
        <ChapterCard key={chapter.slug} chapter={chapter} />
      ))}
    </div>
  );
}
