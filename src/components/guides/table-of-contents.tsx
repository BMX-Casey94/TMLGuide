"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "./blocks";
import "./guides.css";

/**
 * The chapter's table of contents.
 *
 * Progressive enhancement only. The markup is a plain list of anchor links that
 * works with no JavaScript at all: on wide screens it sits in a sticky sidebar,
 * and on narrower ones it folds into a `<details>` element with "On this page" as
 * its summary. The script layer adds one thing — marking the section the reader is
 * in — through an `IntersectionObserver`, so no scroll listener runs.
 *
 * Active-section highlighting is deliberately additive: `aria-current="true"` is
 * added to the matching link, and the rule also draws a left bar, so the state is
 * never carried by colour alone.
 */

export interface TableOfContentsProps {
  readonly entries: readonly TocEntry[];
  /** The chapter title, used to label the navigation landmark. */
  readonly chapterTitle: string;
}

export function TableOfContents({ entries, chapterTitle }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    if (entries.length === 0) return;
    if (typeof IntersectionObserver === "undefined") return;

    const ids = entries.map((entry) => entry.id);
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (headings.length === 0) return;

    /*
      The root margin puts the switch point a third of the way down the viewport,
      just below the sticky header: the section whose heading has most recently
      passed that line is the one the reader is in. Sections already scrolled past
      stay "intersecting" (they are above the line), so the topmost is chosen.
    */
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first !== undefined) setActiveId(first.target.id);
      },
      { rootMargin: "-120px 0px -66% 0px", threshold: 0 },
    );

    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  const links = (
    <ol className="tml-guide-toc__list">
      {entries.map((entry) => (
        <li key={entry.id} className={`tml-guide-toc__item tml-guide-toc__item--h${entry.level}`}>
          <a
            href={`#${entry.id}`}
            className="tml-guide-toc__link"
            aria-current={activeId === entry.id ? "true" : undefined}
          >
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <nav className="tml-guide-toc" aria-label={`On this page: ${chapterTitle}`}>
      {/* Wide screens: a labelled list in the sticky sidebar, no disclosure needed. */}
      <div className="tml-guide-toc__wide">
        <p className="label tml-guide-toc__title">On this page</p>
        {links}
      </div>

      {/* Narrower screens: the same list, folded behind a summary. */}
      <details className="tml-guide-toc__narrow">
        <summary className="tml-guide-toc__summary label">On this page</summary>
        {links}
      </details>
    </nav>
  );
}
