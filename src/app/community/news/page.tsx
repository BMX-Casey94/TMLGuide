import type { Metadata } from "next";
import Link from "next/link";
import { NewsFeed } from "@/components/community/news-feed";
import { ReportLinkForm } from "@/components/community/report-link-form";
import { GoldDivider } from "@/components/ui/gold-divider";
import { getPublishedNews, type NewsFeed as NewsFeedData } from "@/lib/community/news";
import "./news-page.css";

export const metadata: Metadata = {
  title: "News",
  description:
    "Dated announcements about Tomorrowland, each with the source it came from and the date it was checked. No undated claims and no announcements without a citation.",
  alternates: { canonical: "/community/news" },
};

/**
 * The page's markup, with the feed supplied as a value.
 *
 * Split from the route so a test can render every state — populated, published-
 * and-empty, and unreadable — without a database. The alternative would be a
 * mock of the loader inside a Suspense boundary that never resolves in jsdom,
 * which tests the mock rather than the page.
 */
export function CommunityNewsView({ feed }: { readonly feed: NewsFeedData }) {
  return (
    <main id="main" className="tml-news-page">
      <header className="tml-news-hero">
        <p className="label text-accent">Community · News</p>
        <h1 className="tml-news-hero__title">News</h1>
        <p className="tml-news-hero__lede">
          Dated announcements about the festival and the links this guide publishes: a sale date
          confirmed, a line-up published, an invite that moved. Every item carries the page it came
          from and the date that page was checked.
        </p>
        <p className="tml-news-hero__meta">
          Nothing is published here without a source ·{" "}
          <Link href="/community" className="tml-news-hero__link">
            Back to the community hub
          </Link>
        </p>
      </header>

      <section className="tml-news-section" aria-labelledby="news-latest">
        <h2 className="tml-news-section__title" id="news-latest">
          Latest updates
        </h2>
        <p className="tml-news-section__lede">
          Newest first. If the list is empty, nothing has been published yet — this page does not
          fill the space with examples.
        </p>

        <NewsFeed items={feed.items} state={feed.state} />
      </section>

      <GoldDivider butterfly="left" />

      <section className="tml-news-section" aria-labelledby="news-report">
        <h2 className="tml-news-section__title" id="news-report">
          Found something wrong?
        </h2>
        <p className="tml-news-section__lede">
          A dead invite or a link that no longer opens what it claims is worth reporting. The report
          is checked before anything changes.
        </p>
        <ReportLinkForm page="/community/news" />
      </section>

      <div className="tml-news-footnote">
        <p className="tml-news-footnote__text">
          TMLGuide is an independent fan guide and is not affiliated with Tomorrowland. An item here
          reports what an official page said on the date it was checked; the official page remains
          the only authority on its own content.
        </p>
      </div>
    </main>
  );
}

/**
 * The community news page.
 *
 * The feed is read through `getPublishedNews`, which is a `use cache` function
 * tagged `community-news`. Cached data may be awaited at the top of a route under
 * `cacheComponents`, so the page prerenders into the static shell with the feed
 * already in it and needs no `<Suspense>` boundary. A boundary here would only
 * ever produce a fallback that is immediately replaced on every request, which is
 * the sort of loading state readers learn to ignore.
 *
 * When the backend is absent the loader returns an empty, unconfigured feed and
 * the page says plainly that it could not load — it never fills the space with a
 * sample article. `cacheLife("minutes")` bounds how long that state can persist
 * once the operator configures the project.
 */
export default async function CommunityNewsPage() {
  const feed = await getPublishedNews();
  return <CommunityNewsView feed={feed} />;
}
