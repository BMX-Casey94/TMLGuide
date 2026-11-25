# `docs/ai` — AI guide spike artefacts

Everything here is an evaluation or design artefact for the "Ask the guide" feature. None of it is shipped code; `src/` and `public/` are untouched by this workstream.

| File | What it is | Read it if you are… |
|---|---|---|
| `robots-and-terms-check.md` | What may legally be fetched from Tomorrowland's own sites, on evidence, with the allow-list rules and a tested implementation of them | …implementing retrieval, or asking "can we just scrape it?" (no) |
| `provider-spike.md` | Comparison of the three candidate provider approaches, costs per 1,000 questions, the `AiProvider` interface, and the safeguard architecture | …choosing or swapping a model, or implementing `ai-build` |
| `eval-set.json` | 100 grounded questions with expected behaviour, required facts, banned hallucinations and a source reference for each | …testing a model or adapter against the real acceptance bar |
| `validate-eval-set.mjs` | Structural check on the evaluation set: 100 items, unique ids, required fields, no unsatisfiable item, currency discipline | …editing `eval-set.json` |
| `check-sourcerefs.mjs` | Confirms every `sourceRef` file exists and every record fragment is present in it | …editing `eval-set.json`, or after a data refactor |
| `cost-model.mjs` | Recomputes every cost figure in the provider spike from the live list prices it records | …checking a number in `provider-spike.md` |
| `../scripts/eval-ai.mjs` | Scores the offline retriever (`--retrieval-only`, zero cost) or a live `/api/ask` against `eval-set.json` | …measuring retrieval coverage, or grading a provider |

## Running the checks

```bash
node docs/ai/validate-eval-set.mjs
node docs/ai/check-sourcerefs.mjs
node docs/ai/cost-model.mjs

# Retrieval coverage, offline, free. Exits non-zero below the threshold.
node scripts/eval-ai.mjs --retrieval-only --threshold=0.9

# Live grading against a deployment with a key. Spends real provider budget.
node scripts/eval-ai.mjs --base-url=http://localhost:3000 --threshold=0.9
```

Both checkers exit non-zero on failure, so they can be wired into CI without changes. They have no dependencies beyond Node.

## The two rules that matter most

1. **No festival price is ever converted.** Belgium and Winter stay in EUR, Brasil stays in BRL. No official source states a rate, so a sterling or euro conversion of a R$ figure is an invention, not a convenience.
2. **Unpublished means refused.** Where Tomorrowland has not published a 2027 figure, the correct answer is an explicit "not published" with a pointer to where it will appear. Twenty-seven of the 100 items test exactly that, because a model's default behaviour is to be helpful and produce a plausible number.

## Status

`ai-build` is implemented. The adapter, retriever, live fetcher, spend ledger, route,
UI and evaluation runner all exist and are tested; `scripts/eval-ai.mjs
--retrieval-only` scores 98/100 on retrieval coverage offline at zero cost.

**Still outstanding before launch**, and unchanged by the code being written:

- The launch conditions in `provider-spike.md` §8 are unresolved. The UK transfer
  instrument and the Mistral rate limits still need a conversation with the provider.
- Latency has not been measured against a real key. Nothing in `ai-build` calls a
  provider in the test suite or in CI, by design.
- Quality against the full 100-item set has not been measured, because that requires a
  key. Run `node scripts/eval-ai.mjs --base-url=<url> --threshold=0.9` against a
  deployment with a key in place.

## Environment variables `ai-build` reads

`.env.example` already carries `AI_PROVIDER`, `AI_API_KEY` and
`AI_MONTHLY_SPEND_CAP_GBP`. `ai-build` reads these additional names. They are listed
here rather than added to `.env.example`, which the admin and community workstream also
owns.

| Variable | Required | Default | What it does |
|---|---|---|---|
| `OPENROUTER_API_KEY` | yes, for the default provider | — | Server-only. Without it `/api/ask` answers `503` and says so; it never fakes an answer. |
| `OPENROUTER_MODEL` | no | `google/gemini-3.1-flash-lite-preview` | Any OpenRouter model slug. The Pro preview is `google/gemini-3.1-pro-preview`. |
| `AI_PROVIDER` | no | `openrouter` | `openrouter` or `mistral`. Any other value is a startup error rather than a silent fallback. |
| `MISTRAL_API_KEY` | only for `AI_PROVIDER=mistral` | — | Server-only, for `api.eu.mistral.ai`. |
| `MISTRAL_MODEL` | no | `mistral-small-latest` | Any Mistral model slug. |
| `AI_USD_PER_GBP` | no | `1.3102` | Overrides the conversion used to price a call in pence. Re-price without a deploy. |
| `AI_MONTHLY_SPEND_CAP_GBP` | recommended | `25` | Hard monthly stop. A non-numeric or negative value falls back to the default rather than disabling the cap. |
| `AI_LIVE_FETCH` | no | on | Set to `off` to disable live reads of official pages entirely, leaving only the verified data. |
| `AI_EMBEDDING_ENDPOINT`, `AI_EMBEDDING_API_KEY`, `AI_EMBEDDING_MODEL`, `AI_MATCH_RPC` | no | — | Optional pgvector retrieval. All of `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and an embedding endpoint must be set together; a half-configured store is ignored. |

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (already documented) are used
for the spend counter as well as the rate limiter. Without them the cap runs in memory
and is per instance, which the route logs once.

## What `ai-build` requires of the security workstream

Turnstile's widget loads a script from `challenges.cloudflare.com` and renders an
iframe. The CSP in `src/lib/security/csp.ts` allows neither today. A deployment that
sets `TURNSTILE_SECRET_KEY` must also add:

- `https://challenges.cloudflare.com` to `script-src`
- `https://challenges.cloudflare.com` to `frame-src`

`src/components/ai/turnstile-widget.tsx` documents this at the point it matters and
degrades to a clear message when the script is blocked, rather than showing an empty
box. Server-side verification is unaffected either way: it is the control, and it is
enforced whenever the secret is set.

