import type { Metadata } from "next";
import Link from "next/link";
import { AskGuide } from "@/components/ai/ask-guide";
import { readTurnstileSiteKey } from "@/lib/security/csp";
import { socialMetadata } from "@/lib/seo/social";

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
 * The order of the page is a decision about what matters. The heading is one line,
 * the chat sits immediately under it — above the fold on a phone — and the
 * non-affiliation and no-transcript notices follow as a compact two-column strip.
 * They are server-rendered prose rather than part of the client component, so a
 * crawler, a reader with JavaScript off, and a reader whose bundle failed all get
 * the same statement about what this is and what it does with their question. The
 * copy is kept short for the same reason: a trust note that needs scrolling is one
 * nobody reads.
 */

const TITLE = "Ask the guide";
const DESCRIPTION =
  "Ask a question about Tomorrowland Belgium, Winter or Brasil and get an answer drawn only from this guide's verified, dated records, with the official source beside it.";
const PATH = "/ask";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  ...socialMetadata({ path: PATH, title: TITLE, description: DESCRIPTION }),
};

/**
 * The Turnstile site key, when the deployment has one.
 *
 * Read at module scope so it is inlined at build time. Passing it down rather
 * than letting the client component read `process.env` keeps the environment out
 * of the browser bundle and makes the widget's presence a build-time decision.
 *
 * `readTurnstileSiteKey` validates the value, so a malformed key renders nothing
 * rather than a broken widget — and, more importantly, the proxy and this page
 * derive the same answer from the same function, so the policy exemption and the
 * widget cannot disagree about whether the challenge is in use.
 */
function turnstileSiteKey(): string | undefined {
  return readTurnstileSiteKey() ?? undefined;
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
        <h1 className="tml-ai-hero__title">Ask the guide</h1>
        <p className="tml-ai-hero__lede">
          Tickets, DreamVille, sale dates, Winter and Brasil. Every answer comes from records this
          guide has verified and dated, with the official page beside it.
        </p>
      </header>

      <AskGuide {...(siteKey === undefined ? {} : { turnstileSiteKey: siteKey })} />

      <div className="tml-ai-notices">
        <p className="tml-ai-notice">
          <strong className="tml-ai-notice__title">Independent, not official</strong>
          TMLGuide is a fan-made guide with no connection to Tomorrowland. The assistant cannot act
          for them, approve a refund or issue a code. The{" "}
          <Link href="/about">about page</Link> covers how the site is funded.
        </p>
        <p className="tml-ai-notice">
          <strong className="tml-ai-notice__title">No transcripts kept</strong>
          Your question is sent to the AI provider to be answered and is not saved by this site: no
          transcript, no account, no history. Operational logs record a timestamp, a hashed address
          and a cost, never the words you typed.
        </p>
      </div>

      <section className="tml-ai-foot" aria-labelledby="ask-limits-heading">
        <h2 id="ask-limits-heading" className="label text-cream-mute">
          What this can and cannot do
        </h2>
        <p>
          It answers from the guide&rsquo;s own verified data: prices, dates, rules and caps for
          Belgium, Winter and Brasil, each with the official page it was checked against. It reads
          one official page at the moment you ask, only when the guide&rsquo;s records do not cover
          the question, and it shows you that page and when it was read.
        </p>
        <p>
          It will refuse rather than guess. Where Tomorrowland has not published a 2027 figure, the
          honest answer is that it is not published, and that is what you will get. It does not
          convert prices between currencies: Brasil prices stay in reais, Belgium and Winter in
          euros.
        </p>
        <p>
          It does not give legal, immigration or medical advice, and it will not help copy content
          from Tomorrowland&rsquo;s site, which their terms prohibit without written consent.
        </p>
      </section>
    </main>
  );
}
