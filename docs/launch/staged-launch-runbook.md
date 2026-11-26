# Staged launch runbook

How to take TMLGuide v3 from a preview deployment to the public domain, and what
must be true before each step. Written for the person doing the cutover, not for
the person who wrote the code.

Currency is sterling throughout, because the AI spend cap is a UK budget agreed in
pounds.

---

## 1. Environment variables

Set these in the host's project settings, not in a committed file. The values
marked **required** have no safe default: the app will build and serve without
them, but the feature they configure will be silently absent or degraded.

### Required

| Variable | What it does | If it is missing |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The canonical origin. Every canonical tag, `og:url`, sitemap entry and JSON-LD URL is built from it. | Production falls back to `http://localhost:3000` and logs one line at build time. Every canonical is then wrong, which is worse than not launching. |
| `OPENROUTER_API_KEY` | The "Ask the guide" provider key. | `/api/ask` answers `503` with copy that points the reader at the verified pages. Nothing breaks; the feature is off. |
| `OPENROUTER_MODEL` | The OpenRouter slug to call. | Defaults to `google/gemini-3.1-flash-lite-preview`. Set it explicitly so a provider-side deprecation is a decision rather than a surprise. |
| `UPSTASH_REDIS_REST_URL` | Shared Redis for rate limiting **and** the AI spend ledger. | Both fall back to a per-instance in-memory counter. With more than one instance that multiplies the effective limits, and the spend cap becomes an alert rather than a cap. **Do not launch without this.** |
| `UPSTASH_REDIS_REST_TOKEN` | Credential for the above. | As above. |
| `RATE_LIMIT_IP_SALT` | Salt applied before a client IP is hashed into a rate-limit key. 32+ characters of random data. | Digests are unsalted, so a stored key can be matched against a list of guessed addresses. |
| `SUPABASE_URL` | The PostgREST base for the contact route, the community endpoints and the knowledge index. Must be `https:` in production. | The contact form and community writes answer with a configuration error. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only credential for those writes. Bypasses row-level security, so it must never reach the browser. | As above. |
| `AI_MONTHLY_SPEND_CAP_GBP` | The monthly ceiling for the AI guide, in pounds. A plain number (`25`) or with currency formatting (`£25`). | Defaults to £25. A non-numeric value also falls back to £25 rather than becoming unlimited. |

### Optional

| Variable | What it does | Notes |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret. Makes the bot challenge **enforced**: a missing or invalid token is refused. | Set this together with the site key. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key. Renders the widget and widens `script-src` and `frame-src` to `challenges.cloudflare.com`. | A site key **without** the secret renders a widget whose token the server never checks. That is worse than no widget, because it costs the reader effort for no protection. Set both or neither. |
| `TRUSTED_PROXY_COUNT` | How many reverse proxies sit in front of the app. Decides which `x-forwarded-for` entry is the client. | Leave at `1` on Vercel. A larger value than the real topology lets a caller evade the rate limit by prepending a forged entry. |
| `CSP_REPORT_URI` | CSP violation collector. Adds `report-uri` and `Report-To`. | Only set it if someone will read it. An unread collector looks like monitoring. |
| `NEXT_PUBLIC_ANALYTICS_ENDPOINT` | Consent-gated analytics collector. | Nothing is sent unless a visitor opts in **and** this is set. |
| `PRERENDER_OUTPUT_DIR` | Relocates `.next/server/app` for a host that keeps build output elsewhere. | Only needed for a non-standard host; see §3. |

### Checking the configuration before launch

1. **Turnstile pairing.** If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set without
   `TURNSTILE_SECRET_KEY`, the challenge is rendered but not enforced. Verify both
   are present or both absent.
2. **Salt length.** `RATE_LIMIT_IP_SALT` should be at least 32 characters. A short
   or repetitive value undermines the reason it exists.
3. **Service role key exposure.** `SUPABASE_SERVICE_ROLE_KEY` must be a server-only
   variable. If it appears in a `NEXT_PUBLIC_*` name, it is in the browser bundle.
4. **Site URL scheme.** `NEXT_PUBLIC_SITE_URL` must be `https:` and must be the
   origin only — no path, no trailing slash.

---

## 2. The CSP hash manifest, which is the one non-obvious build step

The site runs a strict nonce policy. Prerendered shells carry inline scripts that
have no nonce, so their SHA-256 digests are added to `script-src`. Those digests
come from one of two sources, and the order is documented in
`src/lib/security/csp-hashes.ts`: the build output on disk is preferred, and the
generated manifest is the fallback.

The fallback exists because the proxy runs in its own function on Vercel, with no
view of `.next/server/app`. Without the manifest, every prerendered page is served
a policy that blocks its own bootstrap scripts, and no page hydrates.

**The build is therefore two passes, and the order matters:**

```bash
# Pass 1: produce .next/server/app/*.html from the current source.
npx next build

# Generate the manifest from that output, with the production origin set.
NEXT_PUBLIC_SITE_URL=https://www.tmlguide.com node scripts/generate-csp-hashes.mjs

# Pass 2: rebuild, so the proxy bundle contains the manifest that was just written.
npx next build

# Verify that what is committed matches what this build produced.
NEXT_PUBLIC_SITE_URL=https://www.tmlguide.com node scripts/generate-csp-hashes.mjs --check
```

Why two passes: the manifest is a TypeScript module the proxy imports, so it is
compiled into the proxy bundle. Generating it after the final build would leave the
deployed bundle holding the previous build's digests.

Why it is stable: `next.config.ts` derives the build id from the commit
(`generateBuildId`), rather than letting Next mint a random one. Without that, the
flight payloads embed a different id on every build, the inline scripts differ, and
no committed manifest can ever match. With it, two builds of the same commit
produce byte-identical inline scripts; measured, 0 of 60 shells changed across a
rebuild.

`--check` exits non-zero when the committed manifest does not match the build. Make
it part of the release process: a stale manifest fails silently in the browser.

`npm run build:release` runs the whole sequence above.

### The manifest is tied to one origin

The prerendered flight payloads embed absolute URLs built from
`NEXT_PUBLIC_SITE_URL`. Measured on this project, changing that origin altered
**47 of the 60 shells**, so the digests describe a particular origin and no other.

The manifest records the origin it was built for, in `CSP_MANIFEST_SITE_URL`, and
`csp-hashes.ts` compares it against the running deployment's
`NEXT_PUBLIC_SITE_URL`. On a mismatch the manifest is refused rather than used,
because its digests could not match and the page would fail to hydrate with no
server-side error at all. `describeHashCoverage()` names both origins when that
happens.

Two consequences for the rollout:

- **The preview and production need different manifests, or the preview needs the
  build output.** A preview deployment carries production's manifest, so the guard
  refuses it and the preview runs nonce-only — which is fine for a smoke test and is
  exactly why the stage 2 CSP check must be read carefully: expect the hashes to be
  absent on a preview unless you generate a preview manifest or set
  `PRERENDER_OUTPUT_DIR`.
- **Changing the domain means regenerating.** A move from a preview domain to the
  real one is a rebuild, not only a DNS change.

`PRERENDER_OUTPUT_DIR` sidesteps all of this on a host that can keep the build
output beside the server: the runtime read is exact and needs no manifest.

---

## 3. Staged rollout

### Stage 1 — preview deployment

Deploy the branch to the preview URL with **all** production variables set, except
`NEXT_PUBLIC_SITE_URL`, which should point at the preview origin for this stage so
canonical tags are internally consistent. Then work through the checks in stage 2
against the preview.

Acceptance: the build log shows no `[seo] NEXT_PUBLIC_SITE_URL is not set` line,
and `--check` passes for the manifest.

### Stage 2 — smoke and CSP check

Run these against the preview origin before any DNS change.

| Check | How | Pass condition |
| --- | --- | --- |
| Pages render | Visit `/`, `/guides`, `/guides/belgium/overview`, `/tools/budget`, `/community`, `/ask`, `/radio` | Each returns `200` with its content visible |
| CSP does not block hydration | DevTools → Console, then click a client-side link | No `Refused to execute inline script` entries, and the link navigates without a full page load |
| Security headers present | `curl -sI https://<origin>/about` | `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` all present |
| Script hashes are sufficient | In DevTools → Console, look for CSP violations on a 404 page and on a dynamic `notFound()` | None. These are the two cases the shared bootstrap set exists for |
| Manifest coverage is what you expect | Check the server log for a `[security] CSP hashes:` line | On a preview, the origin guard will usually refuse production's manifest and say so — that is the guard working, not a fault. On production, expect the manifest line and no warning |
| Redirects | `curl -sI https://<origin>/tools/budget-calculator` | `308` to `/tools/budget` |
| Live routes are not shadowed | `curl -sI https://<origin>/tools/budget`, `/news`, `/community` | `200` for the first and third; `/news` redirects as intended |
| AI guardrails | Open `/ask` and ask one question | An answer or an honest refusal. Never a fabricated figure |
| Contact form | Submit once with a real address | Accepted, and the row appears in the Supabase table |
| Sitemap and robots | `curl -s https://<origin>/sitemap.xml` | Every URL uses the canonical origin |

A quick way to check the CSP for blocking is to open each page with DevTools
preserving the console and reloading: the violations appear on load, not on
interaction.

### Stage 3 — DNS cutover

1. Set `NEXT_PUBLIC_SITE_URL` to the final production origin for the production
   environment, and redeploy so the canonical tags and the manifest both use it.
2. Add both `tmlguide.com` and `www.tmlguide.com` to the host, and redirect one to
   the other **before** pointing DNS at the host, so no reader reaches a URL that
   then redirects cross-origin.
3. Lower the TTL on the existing records to 300 seconds at least an hour before the
   change, so a rollback is quick.
4. Point DNS at the host, keeping HTTPS issuance in mind: the certificate must be
   valid before HSTS is served, or the site is unreachable for the two-year max-age
   it advertises.
5. Keep the previous host reachable for 24 hours. Do not delete it on the day.

Rollback: point DNS back at the previous records. Because the redirects are `308`,
a browser that saw one will keep using it; that is intended for `/tools/*`, and no
`308` is served from a URL that still needs to work.

### Stage 4 — monitoring and the monthly spend alert

For the first 72 hours:

- **Errors.** Watch the host's function logs for 5xx responses, and for the
  `[security] No inline-script hashes are available` line. That line means the
  manifest did not deploy and pages are not hydrating.
- **Rate limiting.** A sudden rise in `429` responses suggests either an attack or a
  `TRUSTED_PROXY_COUNT` that does not match the topology.
- **AI spend.** Confirm the Upstash key `tml:ai:spend:<month>` is advancing. The cap
  is a stop, not an alert: once the month's reservations reach
  `AI_MONTHLY_SPEND_CAP_GBP`, `/api/ask` refuses further calls until the month
  rolls over at midnight Europe/London.

Monthly, on the first working day:

1. Read the spend for the previous month from Upstash.
2. Compare it with `AI_MONTHLY_SPEND_CAP_GBP`. If spend reached the cap, that is a
   decision about the cap, not only about cost — readers were refused answers.
3. Re-check the OpenRouter pricing for the configured model, because the cost
   estimate is computed from a table in `src/lib/ai/provider.ts`.
4. Re-check `docs/factcheck/links.md` and the community link run
   (`node scripts/check-community-links.mjs`) for links that have rotted.

---

## 4. Operator-supplied items still outstanding

These need a decision or a fact from the operator. They are not code defects, and
none of them should be invented to fill a gap.

| Item | What is needed | Current state |
| --- | --- | --- |
| **Privacy policy** (`/privacy`) | The legal entity's name, a contact address, and confirmation of which processors are in use (hosting, Supabase, Upstash, OpenRouter, Cloudflare if Turnstile is enabled). | No page. The About page's privacy section describes the site as it behaves today and says so. |
| **Terms of use** (`/terms`) | Trading name, jurisdiction, and whether anything is sold. | No page. |
| **Cookie policy** (`/cookies`) | Confirmation of the cookie and `localStorage` inventory, and whether analytics is switched on. | No page. The only client storage today is the selected edition, the radio volume and the accessibility preference. |
| **Contact route** (`/contact`) | A monitored address, or a decision that `/community` is the only channel. | `CORRECTIONS_EMAIL` is `null`, so the About page renders its contact line only as a plain statement. The `/api/contact` handler exists and writes to Supabase. |

Two consequences worth stating plainly:

- **`/privacy`, `/terms`, `/cookies` and `/contact` return 404 today.** They are
  deliberately absent from the redirect table in `src/lib/seo/legacy-redirects.ts`,
  because redirecting them to a substitute would mislead a reader looking for a
  policy and would shadow the real page on the day it lands.
- **The About page does not claim a policy exists.** It describes the current
  behaviour and says that analytics would require this text and a consent step to
  change with it. That is the honest position until the operator supplies the
  details above.

---

## 5. Pre-launch checklist

- [ ] Every required variable from §1 is set in the production environment
- [ ] `NEXT_PUBLIC_SITE_URL` is the final `https:` origin, with no path or trailing slash
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, and the spend key is advancing
- [ ] `RATE_LIMIT_IP_SALT` is 32+ random characters
- [ ] Turnstile is configured with both keys or neither
- [ ] `npm run build:release` completed, and `node scripts/generate-csp-hashes.mjs --check` passed
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] The stage 2 table passed against the preview
- [ ] The canonical origin in `sitemap.xml` is correct
- [ ] The www/apex pair redirects one way, decided in advance
- [ ] DNS TTL was lowered an hour before the change
- [ ] The previous host is still reachable, and will be for 24 hours
