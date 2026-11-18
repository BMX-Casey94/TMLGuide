import Link from "next/link";
import type { ReactNode } from "react";
/* Kit styles travel with the component so any page that uses it is styled. */
import "@/components/ui/ui.css";
import "./tools.css";

/** The independence statement every tool page carries, worded for a calculator. */
export const TOOL_DISCLAIMER =
  "Every figure here is an independent estimate built from published prices. It is not an official calculator and it is not endorsed by Tomorrowland. Check the official site before you commit money.";

/** Where a fact or price on the tool page came from. */
export interface ToolSource {
  readonly label: string;
  readonly url: string;
  /** ISO date the source was read, rendered as "18 Nov 2026". */
  readonly retrievedOn: string;
}

export interface ToolCrumb {
  readonly label: string;
  /** Omitted on the current page, which renders as plain text. */
  readonly href?: string;
}

export interface ToolShellProps {
  /** Mono eyebrow above the title. */
  readonly kicker: string;
  /** The page title, rendered as the h1. */
  readonly title: string;
  /** One or two sentences explaining what the tool answers. */
  readonly intro: ReactNode;
  /** Breadcrumb trail ending with this page. */
  readonly crumbs: readonly ToolCrumb[];
  /** Sources shown in the footer of the tool, each with its read date. */
  readonly sources: readonly ToolSource[];
  /** The tool's own content. */
  readonly children: ReactNode;
  /**
   * Extra detail for the noscript notice. A tool that cannot run without
   * JavaScript must say what a reader can still do from the server-rendered
   * page, which is normally the source data and the official link.
   */
  readonly noscriptNote?: ReactNode;
}

const sourceDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  /* Pinned so the server and the browser cannot disagree about the day. */
  timeZone: "UTC",
});

/** Formats a source's read date, returning null when it is unparseable. */
function formatSourceDate(iso: string): string | null {
  const normalised = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso;
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return null;
  return sourceDateFormatter.format(date);
}

/**
 * The frame every tool page shares: breadcrumbs, a title block, the tool itself,
 * the independence disclaimer and the sources it was built from.
 *
 * A Server Component. The calculators inside it are Client Components, so the
 * frame, the disclaimer and the source list are static HTML that a reader sees
 * even if the script never runs.
 */
export function ToolShell({
  kicker,
  title,
  intro,
  crumbs,
  sources,
  children,
  noscriptNote,
}: ToolShellProps) {
  return (
    <main id="main" className="tool-page">
      <div className="tool-page__inner">
        <nav aria-label="Breadcrumb">
          <ol className="tool-crumbs">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="tool-crumbs__item">
                  {crumb.href === undefined || isLast ? (
                    <span aria-current={isLast ? "page" : undefined}>{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  )}
                  {isLast ? null : (
                    <span className="tool-crumbs__sep" aria-hidden="true">
                      /
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <header className="tool-head">
          <p className="label text-accent">{kicker}</p>
          <h1 className="tool-head__title">{title}</h1>
          <div className="tool-head__intro">{intro}</div>
        </header>

        <noscript>
          <div className="tool-noscript">
            <p className="label">JavaScript is off</p>
            <p>
              This page works without JavaScript: the prices, dates and sources below are all
              rendered on the server. The interactive parts of the tool need it, so a figure you
              calculate will not update until JavaScript is enabled.
            </p>
            {noscriptNote === undefined ? null : <div className="tool-noscript__extra">{noscriptNote}</div>}
          </div>
        </noscript>

        {children}

        <section className="tool-foot" aria-labelledby="tool-sources-heading">
          <h2 id="tool-sources-heading" className="label text-cream-mute">
            Sources
          </h2>
          <ul className="tool-sources">
            {sources.map((source) => {
              const checked = formatSourceDate(source.retrievedOn);
              return (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.label}
                  </a>
                  {checked === null ? null : (
                    <>
                      {" "}
                      <span className="tool-sources__date">
                        Checked <time dateTime={source.retrievedOn}>{checked}</time>
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="tool-disclaimer">{TOOL_DISCLAIMER}</p>
        </section>
      </div>
    </main>
  );
}
