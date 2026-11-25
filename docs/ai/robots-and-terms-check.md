# `robots.txt` and public terms check — official Tomorrowland domains

Purpose: decide, on evidence, what a retrieval-backed "Ask the guide" may do with
Tomorrowland's own pages at request time. This is the gate for the provider spike
in `docs/ai/provider-spike.md`: it fixes the retrieval contract before any model
is chosen.

- **Date checked: 25 November 2026.** The brief named 20 November 2026; the
  fetches below were actually made on 25 November 2026 and are recorded as such.
  Every response line is a live measurement, not a memory.
- Method: `Invoke-WebRequest` and `curl.exe` from a UK IP, with an identifying
  user agent (`TMLGuideBot/1.0`), no cookies, no login, no bot-check bypass, no
  JavaScript execution. `HEAD` and `GET` were both used to read status codes and
  response headers.
- What was **not** done: no page was mirrored, cached to disk, re-published, or
  added to an index. Every body fetched here was read for the compliance facts
  in this document, then discarded.

---

## 1. Status table

| Domain | `robots.txt` URL | HTTP status | Content type | Interpretation |
|---|---|---|---|---|
| Belgium (marketing) | `https://belgium.tomorrowland.com/robots.txt` | **404** | `text/html` (4,824-byte Next.js error page) | No `robots.txt` exists. |
| Winter (marketing) | `https://winter.tomorrowland.com/robots.txt` | **404** | `text/html` (4,899 B) | No `robots.txt` exists. |
| Brasil (marketing) | `https://brasil.tomorrowland.com/robots.txt` | **404** | `text/html` (4,902 B) | No `robots.txt` exists. |
| Corporate | `https://www.tomorrowland.com/robots.txt` | **404** | `text/html` (4,845 B) | No `robots.txt` exists. |
| `support.tomorrowland.com` | `https://support.tomorrowland.com/robots.txt` | **no response** | — | **Host does not exist.** DNS returns NXDOMAIN (`support.tomorrowland.com : DNS name does not exist`). There is no such host to check. |
| `tomorrowland.com` (apex) | `https://tomorrowland.com/robots.txt` | **302** → `https://www.tomorrowland.com/robots.txt` | — | Redirects to the 404 above. |

### Hosts that do exist and do publish a `robots.txt`

`support.tomorrowland.com` was named in the brief but does not resolve. The
support estate is served from three Zendesk hosts, so those were checked instead:

| Host | HTTP status | Content type | Bytes |
|---|---|---|---|
| `https://faq.tomorrowland.com/robots.txt` | **200** | `text/plain; charset=utf-8` | 2,446 |
| `https://faq.tomorrowlandwinter.com/robots.txt` | **200** | `text/plain; charset=utf-8` | 2,452 |
| `https://tomorrowlandbrasil.zendesk.com/robots.txt` | **200** | `text/plain; charset=utf-8` | 2,456 |

Also probed, all `404`: `https://belgium.tomorrowland.com/sitemap.xml`,
`https://www.tomorrowland.com/sitemap.xml`, `https://www.tomorrowland.com/llms.txt`,
`https://belgium.tomorrowland.com/llms.txt`, `https://www.tomorrowland.com/ai.txt`.
There is no published sitemap and no `llms.txt` / `ai.txt` machine-readable
permission file on any of the four marketing hosts.

---

## 2. What the four marketing `robots.txt` responses actually say

They say nothing, because they are 404s. Under RFC 9309 §2.3.1 a 4xx response
(other than 429) means "unavailable": the crawler "MAY access any resources".
So on `belgium.`, `winter.`, `brasil.` and `www.` there is **no robots-level
restriction**. That is an absence of a rule, not a grant of permission, and it
does not override the site's terms of use, which do restrict copying (§4).

Two mechanical details worth recording, because both affect how a fetcher must
behave:

1. The 404 is served with `Content-Type: text/html` and a full HTML error page,
   through CloudFront (`X-Cache: Error from cloudfront`, `X-Powered-By: Next.js`).
   Any fetcher that treats "200 or not" as the only signal, or that follows the
   Next.js soft-404 rewrite, will silently parse an error page as content.
   A retrieval layer must require `content-type` to start with `text/html` **and**
   reject a body matching the site's 404 template.
2. `Cache-Control` on the marketing hosts is `s-maxage=86400, max-age=120,
   stale-while-revalidate=60, stale-if-error=3600`. A retrieved page can be up to 24
   hours stale at the edge, and the `stale-if-error` directive means a stale copy can
   be served for a further hour even when the origin is failing. A retrieval layer
   must therefore display a retrieval timestamp and must not present a fetched price
   as "now" without one.

### Sampling check: are individual pages indexable?

`<meta name="robots" content="index,follow">` was present on each of:

- `https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/`
- `https://winter.tomorrowland.com/en/add-ons/`
- `https://brasil.tomorrowland.com/en/`

No `X-Robots-Tag` header appeared on any of the three, and none declared a
`rel="canonical"`. So the marketing pages are deliberately open to indexing by
search engines. That is the strongest signal on the marketing estate, and it
supports point 1 below only for the narrow case of reading a page in order to
answer a user's question about it.

---

## 3. What the Zendesk `robots.txt` files say

These are near-identical Zendesk defaults, and they do contain real rules. The
`User-agent: *` group on `faq.tomorrowland.com` disallows, among others:

```
Disallow: /hc/*/search
Disallow: /hc/requests/
Disallow: /hc/*/requests/
Allow: /hc/*/requests/new
Disallow: /access/
Disallow: /auth/
Disallow: /tickets
```

Two points matter here:

- **`Disallow: /tickets` sits in the `User-agent: *` group.** Anything that is not
  literally named `AppleBot` in its own group obeys the `*` group, so the
  `/tickets` path is off limits to us. The `AppleBot` group carries only a
  `# Allow /tickets` **comment** and no `Allow:` directive; a comment is not a
  rule, and it does not help us either way.
- **`Disallow: /hc/*/search`.** Help-centre search endpoints are disallowed. A
  retrieval design that calls a Zendesk search endpoint is outside the rules,
  so retrieval must be by article URL only.

### AI-crawler rules

**There is no `GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`, `PerplexityBot`
or `anthropic-ai` group on any of the seven `robots.txt` files checked.** The only
user-agent groups present are `AppleBot` and `*`.

An absent AI-crawler group means the `*` group applies. It does **not** mean AI
use is permitted, and it does **not** mean it is forbidden. The controlling text
is the website terms of use, not `robots.txt`.

---

## 4. The website Terms of Use — the decisive document

Canonical URL: <https://www.tomorrowland.com/article/website-terms-of-use/>
(reached from `https://www.tomorrowland.com/en/website-terms-of-use`, HTTP 200,
19,671 bytes). Operator named in the terms: **WEAREONE.world bv**, Kattendijkdok-Westkaai 12, 2000 Antwerp, Belgium, CBE 0867.239.782.

The clause that governs us, verbatim:

> "It is prohibited, without the prior written consent of Tomorrowland, to store,
> reproduce, modify, disclose, distribute or transmit, sell or transfer the
> information provided on and through this website (other than necessary to view
> the website), or grant any rights thereto to third parties."

And, on accuracy:

> "Tomorrowland does not warrant that the information, software, products and
> services of this website are accurate, up to date and complete".

Governing law: Belgian law; exclusive jurisdiction the courts of Antwerp. There is
no robots or AI clause, no crawler licence, and no text-and-data-mining
reservation stated expressly — but the storage/reproduction prohibition is broad
enough to cover both, so the safe reading is that it applies to us.

**Practical consequence.** The parenthetical "other than necessary to view the
website" is what a live, transient fetch relies on: fetching a page so a reader
can be shown what it says is arguably "necessary to view". Anything beyond that —
persisting the copy, indexing it, embedding it into a vector store held on our
side, or paraphrasing it into our own content set — is storage and reproduction,
and is prohibited without written consent.

---

## 5. Adjacent public terms that shape the product (not the retrieval)

These do not change what may be fetched, but they constrain what the guide may
say, so they belong in the same compliance record.

### 5.1 Official sales channels

<https://belgium.tomorrowland.com/en/sales-info/official-ticket-channels/> (HTTP 200):

> "Do not buy your tickets through the secondary market."
> "Tickets that have been resold illegitimately will be canceled"
> "It is forbidden by Law to resell a ticket with profit (law of 30 July 2013 - fines up to 60.000 euros)."
> "please email: fraude@tomorrowland.com"

The same page names only three official routes: the Paylogic ticket shop via a
Tomorrowland Account, the Official Travel Shop, and Official External Travel
Partners. This directly supports the resale-scam evaluation category: the guide
must never call Viagogo, StubHub or TicketSwap official, and must never encourage
a secondary-market purchase.

### 5.2 Privacy policy

Centre: <https://www.tomorrowland.com/article/tomorrowland-privacy-policy-center/>;
policy itself: <https://belgium.tomorrowland.com/en/sales-info/your-privacy/privacy-policy/> (HTTP 200).

Recorded because the guide links to official pages and must not misdescribe how
Tomorrowland handles data. The policy states that transfers outside the EEA rely
on adequacy decisions (naming the UK and Switzerland), the EU Standard Contractual
Clauses, and the EU–US Data Privacy Framework where the recipient is certified.
This is Tomorrowland's posture, not ours: it says nothing about our own transfers,
which are covered in the provider spike.

### 5.3 Nothing here grants a licence to reproduce

Neither the terms of use nor any other page reviewed offers a licence to reuse
official copy, images or prices in a competing dataset. The guide's own verified
numbers live in `src/data/**` with their own source citations; the AI guide may
quote a figure in an answer, but it may not become a second copy of Tomorrowland's
site.

---

## 6. Decision: what retrieval is permitted

### Permitted, with the controls in §7

1. **Live, allow-listed, on-demand fetch of a specific public page**, at the moment
   a user asks a question, to answer that question, with a visible link back to the
   source URL and a retrieval timestamp.
2. **Reading the fetched page transiently in memory** long enough to select the
   relevant passages and pass them to the model as untrusted context.
3. **Quoting a short figure or sentence in the answer itself** — for example
   "€735, made up of a €346 festival element and a €389 lift and ski pass" — with
   the source URL shown. Short quotation for the purpose of answering is the only
   use the "necessary to view" carve-out can plausibly cover; it is not a licence
   to reproduce a page.
4. **Answering from the guide's own verified data first**, and fetching only when
   the verified data does not cover the question. This is the preferred path: it
   is faster, it is auditable against `docs/factcheck/`, and it keeps official
   fetching to a minimum.

### Not permitted

1. **Storing or indexing official copy.** No crawl-to-disk, no vector database of
   Tomorrowland page text held on our side, no nightly mirror, no embeddings
   persisted from fetched pages. This is the clear target of the terms' storage
   prohibition.
2. **Re-publishing official copy.** No cached page text served to users, no
   "source excerpt" block reproducing whole sections, no shadow copy of prices
   presented as our own data.
3. **Fetching the disallowed paths** on the Zendesk hosts: `/tickets`,
   `/hc/*/search`, `/hc/requests/`, `/access/`, `/auth/`, and anything under
   `/api/`.
4. **Fetching behind a login, a paywall or a bot check**, or circumventing any of
   them. None was attempted here.
5. **Bulk or speculative crawling.** No sitemap sweep, no "fetch every product page
   once a day". One page, one question, one reader.
6. **Treating a 404 as content.** The soft-404 HTML must be rejected, not parsed.
7. **Presenting the result as Tomorrowland's word.** The guide is independent; an
   answer must attribute, and must not imply endorsement.

### The honest gap in this position

The terms of use do not expressly address automated retrieval, and there is no
`robots.txt` on the marketing estate to settle it either way. The position in §6
is a defensible reading, not a granted right. Two consequences:

- **Where an official figure is already verified in `src/data/**`, answer from
  there and cite the same URL.** That avoids the question entirely for the
  majority of questions, because the verified data covers prices, dates, hours,
  rules and caps for all three editions.
- **If Tomorrowland ever publishes a crawler policy, `robots.txt` or a licence,
  this document is superseded on the day it appears.** Re-check before launch and
  after any change.

If a written licence is ever needed — for example to hold a persistent index of
official pages — the contact named in the terms is `info@tomorrowland.com`, and
fraud and ticket-abuse reports go to `fraude@tomorrowland.com`. Neither has been
contacted; no permission has been granted.

---

## 7. Controls the retrieval layer must implement

These follow from the findings above; they are requirements, not suggestions.

| # | Control | Why, from this check |
|---|---|---|
| 1 | Hard allow-list of hostnames: `belgium.tomorrowland.com`, `winter.tomorrowland.com`, `brasil.tomorrowland.com`, `www.tomorrowland.com`, `press.belgium.tomorrowland.com`, `press.winter.tomorrowland.com`, `press.brasil.tomorrowland.com`, `faq.tomorrowland.com`, `faq.tomorrowlandwinter.com`, `tomorrowlandbrasil.zendesk.com` | Prevents SSRF and prevents a retrieved page from steering the fetcher elsewhere. The `press.` hosts are included because `src/data/**` already cites them; every host used as a source must appear here or the citation is unresolvable at fetch time. |
| 2 | Hard deny-list of path prefixes, checked **before** the host allow-list: `/tickets`, `/hc/*/search`, `/hc/requests/`, `/hc/*/requests/`, `/access/`, `/auth/`, `/api/`, `/account`, `/accounts`, `/console`, `/users`, `/search` | Matches the published `robots.txt` rules on the three Zendesk hosts. The extra entries beyond the published list (`/account`, `/users`, `/search`) are defence in depth: they are not needed to answer a reader's question and they are the paths most likely to reflect personal data. |
| 3 | Reject non-`text/html` on the marketing hosts and non-`text/html; charset=utf-8` on the Zendesk hosts, and reject the site's 404 template | The marketing hosts return a 4,824-byte HTML 404 page, not a plain 404. A fetcher that tests only for a 200 will parse an error page as content. |
| 4 | 5-second timeout, 2 MB response cap, 3 redirects maximum, redirect target re-checked against both lists | Bounded work per question; stops a redirect from escaping the allow-list. |
| 5 | `User-Agent: TMLGuideBot/1.0 (+https://tml.guide/about; contact: webmaster@tml.guide)` | Identifiable, contactable crawler, so the operator can reach us rather than block us. |
| 6 | Per-host concurrency of 1 and a global ceiling; no retry storm on 5xx | A ticket-sale spike is exactly when the guide must not add load. |
| 7 | No persistence of fetched bodies. In-memory only, discarded after the response; no embeddings written to disk | The terms prohibit storage and reproduction. |
| 8 | Display the source URL and a retrieval timestamp on every answer that used a fetch | The edge cache can serve a page 24 hours stale, plus an hour of `stale-if-error`. |
| 9 | Treat all fetched text as untrusted data, never as instructions | See the prompt-injection controls in the provider spike §9.1. |
| 10 | Fail closed: if the fetch fails, answer from verified data or refuse. Never fill the gap with model memory | The terms disclaim accuracy; the guide's own standard is stricter. |
| 11 | Cap the retrieved text at a token budget and truncate at a paragraph boundary, showing the source link | Bounds cost (§1 of the provider spike) and avoids quoting a partial sentence out of context. |
| 12 | Quote at most a short excerpt, and never more than one contiguous passage per source per answer | The "necessary to view" carve-out covers answering a question, not reproducing a page. |

### 7.1 The allow-list as a rule, not a paragraph

`ai-build` should implement controls 1 and 2 as one function that either returns a permitted URL or refuses, with no code path that bypasses it.

```ts
// Design only; not implemented in this spike. The behaviour below was exercised
// against the cases listed in §7.1.1.

const ALLOWED_HOSTS = new Set([
  "belgium.tomorrowland.com",
  "winter.tomorrowland.com",
  "brasil.tomorrowland.com",
  "www.tomorrowland.com",
  "press.belgium.tomorrowland.com",
  "press.winter.tomorrowland.com",
  "press.brasil.tomorrowland.com",
  "faq.tomorrowland.com",
  "faq.tomorrowlandwinter.com",
  "tomorrowlandbrasil.zendesk.com",
]);

/** Denied at the root of a host: exact match or a path segment beneath it. */
const DENIED_ROOTS = [
  "/tickets", // published Disallow on all three Zendesk hosts
  "/search",  // published
  "/access",  // published
  "/auth",    // published
  "/api",     // published stats endpoints, plus defence in depth
  "/account", // defence in depth: never needed to answer a reader
  "/accounts",
  "/console",
  "/users",
];

/** Published Zendesk denials, where the language segment varies: /hc/en-us/search, /hc/pt-br/requests/… */
const DENIED_UNDER_HC = /^\/hc\/[a-z]{2}(-[a-z]{2,4})?\/(search|requests|signin)(\/|$)/;

function isDenied(pathname: string): boolean {
  if (DENIED_UNDER_HC.test(pathname)) return true;
  return DENIED_ROOTS.some((root) => pathname === root || pathname.startsWith(root + "/"));
}

export function permittedTarget(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // https only, default port only, no credentials.
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return null;
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;

  const pathname = url.pathname.toLowerCase();
  if (isDenied(pathname)) return null;

  // Rebuild without the fragment: it is never sent to the server, and keeping it
  // would let a caller smuggle a misleading citation into the answer's link.
  return url.origin + pathname + url.search;
}
```

Four details that are easy to get wrong, each of which has been a real vulnerability somewhere:

- **Hostname comparison must be exact, not `endsWith`.** `endsWith("tomorrowland.com")` accepts `eviltomorrowland.com`. The `Set` lookup above is deliberate; do not "simplify" it to a suffix test.
- **Deny is evaluated before host trust.** A permitted host does not make a denied path safe, and the check order should be obvious from the code so a later refactor cannot invert it.
- **`/tickets` is a path prefix, not a substring.** On a marketing host the ticket pages live under `/en/tickets/…` and are legitimate citations; on the Zendesk hosts the same word appears at the root and is published as `Disallow: /tickets`. Prefix matching at the root satisfies both without blocking the pages the guide actually cites.
- **`/hc/*/search` is expanded, not globbed at request time.** The language segment varies (`/hc/en-us/`, `/hc/pt-br/`), so a literal string comparison silently misses the Portuguese help centre, which is where much of the Brasil data comes from.

#### 7.1.1 Cases the rule was tested against

Twenty-one cases were run against the logic above, and all behaved as intended. They are listed so that `ai-build` can turn them into unit tests rather than re-deriving them:

| URL | Expected | Why it is a case |
|---|---|---|
| `https://belgium.tomorrowland.com/en/tickets/festival-tickets/full-madness-pass/` | allow | A real citation; proves the `/tickets` root rule does not over-reach into `/en/tickets/` |
| `https://belgium.tomorrowland.com/en/practical/opening-hours/` | allow | The source for the hours facts |
| `https://winter.tomorrowland.com/en/add-ons/` | allow | The source for the Winter add-ons |
| `https://faq.tomorrowland.com/hc/en-us/articles/…-Can-I-re-enter-the-festival` | allow | Article URLs are the only permitted shape on a Zendesk host |
| `https://tomorrowlandbrasil.zendesk.com/hc/pt-br/articles/13511236435348` | allow | Proves the Portuguese segment is not accidentally denied |
| `https://press.brasil.tomorrowland.com/tomorrowland-brasil-2027` | allow | A press host already cited in `src/data/brasil` |
| `https://faq.tomorrowland.com/tickets` | deny | Published `Disallow: /tickets` |
| `https://faq.tomorrowland.com/hc/en-us/search?query=tickets` | deny | Published `Disallow: /hc/*/search` |
| `https://faq.tomorrowland.com/hc/pt-br/search` | deny | The case a naive string match misses |
| `https://faq.tomorrowland.com/hc/en-us/requests/123` | deny | Published `Disallow: /hc/*/requests/`, and it would expose a reader's own ticket |
| `https://access.tomorrowland.com/` | deny | Host not on the list |
| `https://faq.tomorrowland.com/access/normal` | deny | Published `Disallow: /access/` |
| `https://belgium.tomorrowland.com/api/v2/help_center/x` | deny | Published `Disallow: /api/` |
| `https://eviltomorrowland.com/robots.txt` | deny | The `endsWith` trap |
| `https://tomorrowland.com.evil.test/` | deny | Suffix in the wrong position |
| `https://belgium.tomorrowland.com@evil.test/` | deny | Userinfo trick: the host is `evil.test` |
| `http://belgium.tomorrowland.com/en/` | deny | Plaintext HTTP |
| `https://belgium.tomorrowland.com:8080/en/` | deny | Non-default port |
| `https://169.254.169.254/latest/meta-data/` | deny | Cloud metadata SSRF |
| `file:///etc/passwd` | deny | Scheme other than https |
| `https://www.tomorrowland.com/tickets` | deny | Not a real page; denying the root costs nothing and closes an unknown |

The last row is a judgement call rather than a published rule: there is no `/tickets` page on `www`, so denying it cannot break a citation, and denying by default is the correct posture when the target's existence is unverified.

### 7.2 What "short quoted excerpt" means in practice

The brief requires short quoted excerpts with links back, and nothing stored or indexed. Operationally:

| Allowed | Not allowed |
|---|---|
| One passage of up to about 200 words, in memory, passed to the model as untrusted context | A whole article, or several articles from the same host |
| A single sentence or figure quoted in the answer, with the source URL and retrieval date | A block quoting several paragraphs, or a "source excerpt" panel that reproduces a section |
| The answer summarising what the source says, attributed and linked | The answer restating the page in our own words as though it were our data |
| Discarding the fetched body at the end of the request | Writing it to disk, a cache, a vector store, or a log |

If a question genuinely needs more than one page to answer, the honest response is to answer from verified data and link to the pages, not to fetch and merge several of them.

---

## 8. Re-check schedule

| When | What to re-check |
|---|---|
| Before launch | All seven `robots.txt` URLs, the terms-of-use article, and the three legal paths. Record status and any diff. |
| Quarterly | Same list. A newly published `robots.txt` or `llms.txt` on a marketing host changes §2 and §6. |
| On any 403/429 from an allow-listed host | Stop fetching that host, fall back to verified data, and re-read the terms before resuming. |

---

## 9. Findings in one place

1. **Four of the five hosts named in the brief publish no `robots.txt`** — all four
   marketing hosts return 404 with an HTML error page. There are no `Disallow`
   rules, and no `GPTBot`, `ClaudeBot` or `CCBot` group, anywhere on them.
2. **`support.tomorrowland.com` does not exist.** The support estate is three
   Zendesk hosts, all of which do publish `robots.txt`, and all of which disallow
   `/tickets` and `/hc/*/search` for `User-agent: *`.
3. **No AI-crawler directive exists on any host, in either direction.** The
   question is therefore decided by the website Terms of Use, not by `robots.txt`.
4. **The Terms of Use prohibit storing and reproducing site content** without
   prior written consent, and permit only what is "necessary to view the website".
   That is the boundary: live transient retrieval is defensible; a stored index is
   not.
5. **The marketing pages are open to search indexing** (`index,follow`, no
   `X-Robots-Tag`), which supports question-time reading but is not a licence to
   copy.
6. **The guide's own verified data should answer most questions**, with official
   fetching reserved for gaps. That is both the compliant design and the faster
   one.
