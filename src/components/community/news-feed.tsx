import type { PublishedNewsItem } from "@/lib/community/news-schema";
import type { NewsFeedState } from "@/lib/community/news";
import { CheckSeparator } from "@/components/ui/source-check";
import { formatCheckDate, sourceHost } from "./card-format";
import { parseNewsBody, parseNewsInline, type NewsBlock } from "./news-body";
import { NewsLikeButton } from "./news-like-button";
import "./news-feed.css";

export interface NewsFeedProps {
  /** Published items, newest first, exactly as the loader returned them. */
  readonly items: readonly PublishedNewsItem[];
  /**
   * Why the list is in the state it is in. `ok` with no items means nothing is
   * published; the other two mean the list could not be read, and the page must
   * not present either of those as an empty publication.
   */
  readonly state: NewsFeedState;
}

/** The date a record was published, in the site's long form. */
function formatPublishedOn(value: string): string {
  return formatCheckDate(value) ?? value;
}

function Runs({ text }: { readonly text: string }) {
  const runs = parseNewsInline(text);
  return (
    <>
      {runs.map((run, index) =>
        run.strong ? <strong key={index}>{run.text}</strong> : <span key={index}>{run.text}</span>,
      )}
    </>
  );
}

function Body({ blocks }: { readonly blocks: readonly NewsBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h3 key={index} className="tml-news-article__subhead">
              {block.text}
            </h3>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={index} className="tml-news-article__list">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Runs text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="tml-news-article__para">
            <Runs text={block.text} />
          </p>
        );
      })}
    </>
  );
}

/**
 * The copy for a feed that has no items to show.
 *
 * Three distinct statements, because collapsing them would make the page claim
 * something it does not know. "Nothing has been published" is a fact about the
 * publication; "no news database" is a fact about the deployment; "could not be
 * read" is a fault. A reader who is told the wrong one either waits for news that
 * will never come or assumes the site is ignoring an outage.
 */
const EMPTY_COPY: Readonly<
  Record<"ok" | "unconfigured" | "unavailable", { title: string; text: string }>
> = {
  ok: {
    title: "No news updates published yet",
    text: "This is where dated announcements appear: a sale date confirmed, a line-up published, a link fixed. Nothing has been published yet, so nothing is shown.",
  },
  unconfigured: {
    title: "News is not switched on yet",
    text: "This deployment has no news database configured, so there is nothing to read and nothing has been invented to fill the space. Announcements will appear here once the site operator enables publishing.",
  },
  unavailable: {
    title: "News could not be loaded",
    text: "The news list could not be read just now. Nothing has been invented to fill the space, and nothing shown here would be current, so the list has been left empty. Please try again later.",
  },
};

/**
 * The published news list.
 *
 * A Server Component. Every record arrives parsed and validated, and the only
 * interactive part is the like button, which is its own Client Component so the
 * page ships one small island rather than the whole feed.
 *
 * ## The empty state is the important one
 *
 * There is no sample article, no placeholder headline and no "coming soon" card.
 * The heading is an `h3` because the page has already opened the section with an
 * `h2`; two `h2`s at the same level would flatten the outline and tell a screen
 * reader the empty state was a sibling section of the list rather than its
 * content.
 */
export function NewsFeed({ items, state }: NewsFeedProps) {
  if (items.length === 0) {
    const copy = EMPTY_COPY[state];
    return (
      <div className="tml-news-empty">
        <h3 className="tml-news-empty__title">{copy.title}</h3>
        <p className="tml-news-empty__text">{copy.text}</p>
        <p className="tml-news-empty__note">
          The site never publishes an undated or unsourced announcement. Anything that does appear
          here will carry the source it came from and the date it was checked.
        </p>
      </div>
    );
  }

  return (
    <ul className="tml-news-list">
      {items.map(({ item, likeCount, publishedAt }) => {
        const checked = formatCheckDate(item.lastVerified);
        const host = sourceHost(item.source.url);

        return (
          <li key={item.id}>
            <article id={`news-${item.id}`} className="tml-news-article">
              <header className="tml-news-article__header">
                <p className="tml-news-article__date">
                  <time dateTime={publishedAt}>{formatPublishedOn(item.publishedOn)}</time>
                </p>
                <h2 className="tml-news-article__title">{item.title}</h2>
                <p className="tml-news-article__summary">{item.summary}</p>
              </header>

              {item.tags.length > 0 ? (
                <ul className="tml-news-article__tags" aria-label="Tags">
                  {item.tags.map((tag) => (
                    <li key={tag} className="tml-news-article__tag">
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="tml-news-article__body">
                <Body blocks={parseNewsBody(item.body)} />
              </div>

              <footer className="tml-news-article__footer">
                {/*
                  The citation is the record's structured source, not a link written
                  into the body: that is what makes the claim checkable. The host is
                  printed so a reader can see where it goes before opening it, and
                  the link says it opens in a new tab.
                */}
                <p className="tml-news-article__source">
                  Source:{" "}
                  <a
                    href={item.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tml-news-article__source-link"
                  >
                    {item.source.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  {host === null ? null : <span className="tml-news-article__host"> · {host}</span>}
                  {checked === null ? null : (
                    <>
                      <CheckSeparator />
                      Checked <time dateTime={item.lastVerified}>{checked}</time>
                    </>
                  )}
                </p>

                <NewsLikeButton id={item.id} initialCount={likeCount} itemTitle={item.title} />
              </footer>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
