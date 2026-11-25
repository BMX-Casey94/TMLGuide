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

## Running the checks

```bash
node docs/ai/validate-eval-set.mjs
node docs/ai/check-sourcerefs.mjs
node docs/ai/cost-model.mjs
```

Both checkers exit non-zero on failure, so they can be wired into CI without changes. They have no dependencies beyond Node.

## The two rules that matter most

1. **No festival price is ever converted.** Belgium and Winter stay in EUR, Brasil stays in BRL. No official source states a rate, so a sterling or euro conversion of a R$ figure is an invention, not a convenience.
2. **Unpublished means refused.** Where Tomorrowland has not published a 2027 figure, the correct answer is an explicit "not published" with a pointer to where it will appear. Twenty-seven of the 100 items test exactly that, because a model's default behaviour is to be helpful and produce a plausible number.

## Status

The spike is complete. `ai-build` has not started: there is no adapter, no route and no spend ledger yet. The launch conditions in `provider-spike.md` §8 are unresolved, and two of them — the UK transfer instrument and the rate limits — need a conversation with the provider before any code is worth writing against it.
