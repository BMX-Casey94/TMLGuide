import type { Metadata } from "next";
import Link from "next/link";
import { AskGuide } from "@/components/ai/ask-guide";

/**
 * `/ask` — "Ask the guide".
 *
 * A Server Component with no request-time data, so it keeps its static shell under
 * `cacheComponents: true`. There is deliberately no `headers()` call here: the
 * proxy already gives every route a nonce, and reading a header in this component
 * would make the whole page dynamic for no benefit. The only per-deployment value
 * is the Turnstile site key, which is a build-time constant read from a
 * `NEXT_PUBLIC_` variable.
 *
 * The non-affiliation and privacy notices are server-rendered prose, not client
 * state, so a reader always sees them: a crawler, a reader with JavaScript off,
 * and a reader whose bundle failed all get the same statement about what this is
 * and what it does with their question.
 */

const TITLE = "Ask the guide";
const DESCRIPTION =
  "Ask a question about Tomorrowland Belgium, Winter or Brasil and get an answer drawn only from this guide's verified, dated records, with the official source beside it.";
const PATH = "/ask";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    siteName: "TMLGuide",
    title: `${TITLE} | TMLGuide`,
    description: DESCRIPTION,
    url: PATH,
    locale: "en_GB",
  },
  twitter: {
    card: "summary",
    title: `${TITLE} | TMLGuide`,
    description: DESCRIPTION,
  },
};

/**
 * The Turnstile site key, when the deployment has one.
 *
 * Read at module scope so it is inlined at build time. Passing it down rather
 * than letting the client component read `process.env` keeps the environment out
 * of the browser bundle and makes the widget's presence a build-time decision.
 */
function turnstileSiteKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key ? key : undefined;
}

export default function AskPage() {
  const siteKey = turnstileSiteKey();

  return (
    <main id="main" className="tml-ai-main">
      <nav aria-label="Breadcrumb">
        <ol className="tml-ai-crumbs">
          <li className="tml-ai-crumbs__item">
            <Link href="/">Home</Link>
            <span className="tml-ai-crumbs__sep" aria-hidden="true">
              /
            </span>
          </li>
          <li className="tml-ai-crumbs__item">
            <span aria-current="page">Ask the guide</span>
          </li>
        </ol>
      </nav>

      <header className="tml-ai-hero">
        <p className="label text-accent">Ask the guide</p>
        <h1 className="tml-ai-hero__title">A question about Tomorrowland, answered from checked records</h1>
        <p className="tml-ai-hero__lede">
          Ask about tickets, DreamVille, sale dates, Winter or Brasil. The answer is built only from
          the facts this guide has verified and dated, and every answer shows the official page behind
          it so you can check the figure yourself before you spend anything.
        </p>
      </header>

      <div className="tml-ai-notices">
        <p className="tml-ai-notice">
          <strong className="tml-ai-notice__title">Independent, not official</strong>
          TMLGuide is a fan-made guide with no connection to Tomorrowland. The assistant below is not
          Tomorrowland, cannot act for them, and cannot approve a refund or issue a code. Read the{" "}
          <Link href="/about">about page</Link> for how the site is funded.
        </p>
        <p className="tml-ai-notice">
          <strong className="tml-ai-notice__title">Questions are not stored as transcripts</strong>
          Your question is sent to the AI provider to be answered and is not saved by this site: no
          transcript, no account, no history. Operational logs record a timestamp, a hashed address
          and a cost, never the words you typed. See the{" "}
          <Link href="/privacy">privacy page</Link>.
        </p>
      </div>

      <AskGuide {...(siteKey === undefined ? {} : { turnstileSiteKey: siteKey })} />

      <section className="tml-ai-foot" aria-labelledby="ask-limits-heading">
        <h2 id="ask-limits-heading" className="label text-cream-mute">
          What this can and cannot do
        </h2>
        <p>
          It answers from the guide&rsquo;s own verified data: prices, dates, rules and caps for Belgium,
          Winter and Brasil, each with the official page it was checked against. It reads one official
          page at the moment you ask, only when the guide&rsquo;s records do not cover the question, and it
          shows you that page and when it was read.
        </p>
        <p>
          It will refuse rather than guess. Where Tomorrowland has not published a 2027 figure, the
          honest answer is that it is not published, and that is what you will get. It does not
          convert prices between currencies: Brasil prices stay in reais, Belgium and Winter in euros.
        </p>
        <p>
          It does not give legal, immigration or medical advice, and it will not help copy content from
          Tomorrowland&rsquo;s site, which their terms prohibit without written consent.
        </p>
      </section>
    </main>
  );
}
