import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GoldDivider } from "@/components/ui/gold-divider";
import { EditionSync } from "@/components/tickets/edition-sync";
import { formatCheckedDate } from "@/components/tickets/format";
import { parseTicketView, TICKET_EDITIONS, type TicketEditionId } from "@/components/tickets/routes";
import { SaleTimeline } from "@/components/tickets/sale-timeline";
import { buildCatalogue } from "@/components/tickets/selectors";
import { TicketsExplorer } from "@/components/tickets/tickets-explorer";
import "./tickets-page.css";

const PAGE_TITLE = "Tickets and packages";
const PAGE_DESCRIPTION =
  "Tomorrowland ticket and package prices for Belgium, Winter and Brasil, with the 2027 sale dates, what each package includes and the official page behind every figure.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/guides/tickets" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: "article",
    url: "/guides/tickets",
  },
};

/**
 * The edition tabs.
 *
 * Plain links, not buttons: each edition has its own address, so the tabs work
 * without JavaScript, can be opened in a new tab and are followed by a crawler.
 * The current tab carries `aria-current="page"` and the whole group is a labelled
 * navigation landmark rather than a tablist, because these navigate rather than
 * swap a panel in place.
 */
function EditionTabs({ current }: { current: TicketEditionId }) {
  return (
    <nav aria-label="Edition" className="tml-tix-tabs">
      {TICKET_EDITIONS.map((edition) => {
        const label = edition === "belgium" ? "Belgium" : edition === "winter" ? "Winter" : "Brasil";
        const href =
          edition === "belgium" ? "/guides/tickets" : `/guides/tickets?edition=${edition}`;
        return (
          <Link
            key={edition}
            href={href}
            className="tml-tix-tab"
            aria-current={edition === current ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** The explainer, drawn only from facts the datasets carry with a citation. */
function HowSalesWork({ rows }: { rows: ReturnType<typeof buildCatalogue>["explainer"] }) {
  return (
    <section aria-labelledby="how-sales-work" className="tml-tix-section">
      <h2 className="tml-tix-section__title" id="how-sales-work">
        How Tomorrowland ticket sales work
      </h2>
      <ul className="tml-tix-explain">
        {rows.map((row) => (
          <li key={row.id} className="tml-tix-explain__row">
            <h3 className="tml-tix-explain__term">{row.term}</h3>
            <p className="tml-tix-explain__detail">{row.detail}</p>
            <ul className="tml-tix-explain__sources">
              {row.sources.map((source) => (
                <li key={source.url}>
                  <a
                    className="tml-tix-source__link"
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title}
                    <span className="tml-tix-sr"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The independence notice, shown above the catalogue where it cannot be missed. */
function Disclaimer({ links }: { links: ReturnType<typeof buildCatalogue>["officialLinks"] }) {
  return (
    <aside className="tml-tix-notice" aria-labelledby="disclaimer-label">
      <p className="tml-tix-notice__label" id="disclaimer-label">
        Independent fan guide
      </p>
      <p>
        TMLGuide is not affiliated with, endorsed by or sponsored by Tomorrowland or WeAreOne.World
        B.V. Every price on this page is the figure the official site listed on the date shown
        beside it. Prices and package contents change, so confirm on the official site before you
        buy anything.
      </p>
      <ul className="tml-tix-links">
        {links.map((link) => (
          <li key={link.url}>
            <a
              className="tml-tix-source__link"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
              <span className="tml-tix-sr"> (official Tomorrowland page, opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Placeholder while the edition is read from the URL, sized to avoid a jump. */
function CataloguePending() {
  return (
    <div className="tml-tix-pending" aria-hidden="true">
      <div className="tml-tix-pending__tabs" />
      <div className="tml-tix-pending__grid">
        <div className="tml-tix-pending__card" />
        <div className="tml-tix-pending__card" />
        <div className="tml-tix-pending__card" />
      </div>
    </div>
  );
}

/**
 * Everything that depends on the URL.
 *
 * It is a separate async component so the page shell above and below it stays
 * static: only this region waits for `searchParams`, which is request-time data.
 * It is exported so a test can resolve it directly, which is the only way to
 * assert on server-rendered output without a running server.
 */
export async function EditionContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const view = parseTicketView(await searchParams);
  const catalogue = buildCatalogue(view.edition);
  const checked = formatCheckedDate(catalogue.checkedOn);

  return (
    <>
      <EditionTabs current={view.edition} />
      <EditionSync edition={view.edition} />

      <p className="tml-tix-lede">
        {catalogue.label} {catalogue.year}: {catalogue.categories.reduce(
          (total, category) => total + category.items.length,
          0,
        )}{" "}
        published products, every price checked against the official site
        {checked === null ? null : (
          <>
            {" "}
            on <time dateTime={catalogue.checkedOn}>{checked}</time>
          </>
        )}
        .
      </p>

      <HowSalesWork rows={catalogue.explainer} />

      <section aria-labelledby="sale-timeline" className="tml-tix-section">
        <h2 className="tml-tix-section__title" id="sale-timeline">
          {catalogue.label} {catalogue.year} sale dates
        </h2>
        <p className="tml-tix-section__lede">
          Each window opens at the published festival time, with the visitor&apos;s own clock
          alongside it.
        </p>
        <SaleTimeline windows={catalogue.windows} editionLabel={catalogue.label} />
      </section>

      <section aria-labelledby="explorer-heading" className="tml-tix-section">
        <h2 className="tml-tix-section__title" id="explorer-heading">
          Tickets and packages
        </h2>
        <p className="tml-tix-section__lede">
          Choose a category, then a package, for the full price breakdown and what it includes.
        </p>
        <TicketsExplorer
          catalogue={catalogue}
          categoryId={view.category}
          packageId={view.package}
        />
      </section>

      <Disclaimer links={catalogue.officialLinks} />
    </>
  );
}

/**
 * The tickets and packages page.
 *
 * A Server Component that never awaits the URL itself: the request-dependent part
 * sits inside a Suspense boundary, so the heading, the methodology and the
 * disclaimer ship as a static shell and the catalogue streams in.
 *
 * The edition is read from `?edition=`, never from storage, so every view is
 * shareable, crawlable and identical for two visitors opening the same link.
 */
export default function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /*
    Structured data is limited to the breadcrumb. Product and Offer markup is
    deliberately absent: a price that may change without the page being rebuilt
    would be a claim the site cannot stand behind, and a stale Offer in search
    results is worse than no rich result at all.
  */
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Tickets and packages", item: "/guides/tickets" },
    ],
  };

  return (
    <main id="main" className="tml-tix-page">
      <script
        type="application/ld+json"
        // A static object of our own strings: no user input reaches this payload.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }}
      />

      <header className="tml-tix-hero">
        <p className="label text-accent">Guides · Tickets</p>
        <h1 className="tml-tix-hero__title">Tickets and packages</h1>
        <p className="tml-tix-hero__lede">
          Every ticket, DreamVille package and travel package the official site prices for the
          2027 editions, with the sale calendar, what each product includes and a link to the page
          each figure came from. Nothing here is estimated: where Tomorrowland publishes no price,
          the page says so and links to the official page instead.
        </p>
      </header>

      <Suspense fallback={<CataloguePending />}>
        <EditionContent searchParams={searchParams} />
      </Suspense>

      <GoldDivider butterfly="right" />

      <footer className="tml-tix-footnote">
        <p>
          Prices are shown in the currency each edition publishes: euros for Belgium and Winter,
          Brazilian reais for Brasil. Official euro figures appear alongside indicative GBP (£)
          estimates for planning only (never an official Tomorrowland rate), while Brasil prices
          remain in reais without conversion. No figure is converted between currencies officially,
          because no official exchange rate is published for them.
        </p>
        <p>
          The Exchange Desk is the only official resale route. TMLGuide does not verify listings on
          any other marketplace, and a ticket bought outside the official channels can be
          cancelled before the gate.
        </p>
      </footer>
    </main>
  );
}
