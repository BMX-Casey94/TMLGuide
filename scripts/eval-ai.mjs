#!/usr/bin/env node
/**
 * Evaluation runner for "Ask the guide".
 *
 * Two modes, because they answer different questions:
 *
 * - `--retrieval-only` scores the offline lexical retriever against the 100-item
 *   evaluation set. Zero API cost, no network, no provider: it measures whether
 *   the right record is *findable*, which is the precondition for a correct
 *   answer. Run this in CI on every change to `src/data/**` or the retriever.
 * - default mode posts each question to a running `/api/ask` and scores the prose
 *   against `expectedBehaviour`, `mustInclude` and `mustNotInclude`.
 *
 * ## Scoring
 *
 * The grader contract in `docs/ai/eval-set.json` is the specification, and it is
 * followed exactly:
 *
 * - `mustInclude`: every string must appear, case-insensitively, after numeric
 *   normalisation (thousands separators removed). Currency symbols are never
 *   normalised away.
 * - `mustNotInclude`: no string may appear. Deliberately stricter than "must not
 *   assert", because a reader skimming a reply remembers the number, not the
 *   negation.
 * - `refuse`: a refusal is required, and the wording must be present.
 * - `warn`: answered, with the safety wording present.
 *
 * ## Why this is a separate script rather than a Vitest file
 *
 * Live mode needs a running server and a real provider key, and it costs money. A
 * unit test that silently skipped when the key was absent would be worse than no
 * test. This script is explicit about what it is about to do.
 *
 * Usage:
 *   node scripts/eval-ai.mjs --retrieval-only [--category=winter] [--limit=10]
 *   node scripts/eval-ai.mjs --retrieval-only --threshold=0.9
 *   node scripts/eval-ai.mjs --base-url=http://localhost:3000 --concurrency=2
 *   node scripts/eval-ai.mjs --retrieval-only --json > eval-report.json
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const EVAL_FILE = path.join(ROOT, "docs", "ai", "eval-set.json");

/* -------------------------------------------------------------------------- */
/* Argument parsing                                                            */
/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
  const options = {
    retrievalOnly: false,
    json: false,
    baseUrl: "http://localhost:3000",
    concurrency: 2,
    limit: null,
    category: null,
    verbose: false,
    threshold: null,
  };

  for (const arg of argv) {
    if (arg === "--retrieval-only") options.retrievalOnly = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--verbose" || arg === "-v") options.verbose = true;
    else if (arg.startsWith("--base-url=")) options.baseUrl = arg.slice("--base-url=".length);
    else if (arg.startsWith("--concurrency=")) options.concurrency = Number(arg.slice("--concurrency=".length));
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.slice("--limit=".length));
    else if (arg.startsWith("--category=")) options.category = arg.slice("--category=".length);
    else if (arg.startsWith("--threshold=")) options.threshold = Number(arg.slice("--threshold=".length));
    else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node scripts/eval-ai.mjs [options]",
          "",
          "  --retrieval-only      Score the offline lexical retriever. No API cost.",
          "  --base-url=URL        Base URL for live mode (default http://localhost:3000).",
          "  --concurrency=N       Parallel requests in live mode (default 2).",
          "  --limit=N             Only score the first N items.",
          "  --category=NAME       Only score items in one category.",
          "  --threshold=0.9       Exit non-zero below this pass rate.",
          "  --json                Emit machine-readable JSON instead of a table.",
          "  --verbose             Print each item's detail.",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  return options;
}

/* -------------------------------------------------------------------------- */
/* Normalisation and grading                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The normalisation the grader contract specifies.
 *
 * Thousands separators go, whitespace collapses, case folds. A currency symbol is
 * never touched, so `R$3,160` and `R$3160` match but `R$3,160` and `€1,000` never
 * do.
 */
export function normalise(value) {
  return String(value)
    .toLowerCase()
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when `haystack` contains `phrase` as a whole figure rather than as part of a
 * longer one.
 *
 * The plain `includes` the contract specifies has one defect that matters here:
 * after separator removal, `€2,500` becomes `€2500`, which *contains* the banned
 * string `€25`. That produces a failure for an answer that never mentioned €25, and
 * a grader that cries wolf is worse than no grader. The rule is narrow: when a phrase
 * ends in a digit, the haystack must not continue with another digit; when it starts
 * with a digit, it must not be preceded by one. Word phrases are unaffected, because
 * a trailing letter boundary would wrongly reject "€144" inside "€144 each".
 */
export function containsPhrase(haystack, phrase) {
  const needle = normalise(phrase);
  if (needle === "") return false;

  const startsNumeric = /^[€£]?\d/.test(needle);
  const endsNumeric = /\d$/.test(needle);

  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const after = haystack[at + needle.length];
    const before = at > 0 ? haystack[at - 1] : undefined;
    const afterOk = !endsNumeric || after === undefined || !/\d/.test(after);
    const beforeOk = !startsNumeric || before === undefined || !/\d/.test(before);
    if (afterOk && beforeOk) return true;
    from = at + 1;
  }
}

/**
 * Scores one answer against one item.
 *
 * Returns a list of failures rather than a boolean, so a report can say which
 * phrase was missing. A boolean tells a reviewer nothing.
 */
export function gradeAnswer(item, answerText) {
  const haystack = normalise(answerText);
  const failures = [];

  for (const phrase of item.mustInclude ?? []) {
    if (!containsPhrase(haystack, phrase)) failures.push(`missing: ${JSON.stringify(phrase)}`);
  }

  for (const phrase of item.mustNotInclude ?? []) {
    if (containsPhrase(haystack, phrase)) failures.push(`banned: ${JSON.stringify(phrase)}`);
  }

  return failures;
}

/**
 * How many passages a retrieval run scores.
 *
 * Six, matching {@link DEFAULT_TOP_K}: the number the pipeline actually sends to
 * the model. Scoring a longer list would measure something a reader never
 * experiences.
 */
export const RETRIEVAL_K = 6;

/**
 * Maps a `sourceRef` file to the kinds of chunk that file produces.
 *
 * The evaluation set names the record each question should be answered from, which
 * is a far better retrieval target than the answer's wording: `mustInclude`
 * measures whether the *model* used the fact, and this measures whether the
 * *retriever* found it. Conflating the two makes a retrieval run fail for reasons
 * that belong to the prompt, and makes the pass rate impossible to act on.
 */
const SOURCE_REF_KINDS = {
  "src/data/belgium/tickets.ts": { edition: "belgium", kinds: ["ticket"] },
  "src/data/belgium/accommodation.ts": { edition: "belgium", kinds: ["accommodation"] },
  "src/data/belgium/add-ons.ts": { edition: "belgium", kinds: ["add-on"] },
  "src/data/belgium/facts.ts": { edition: "belgium", kinds: ["fact"] },
  "src/data/belgium/faqs.ts": { edition: "belgium", kinds: ["faq"] },
  "src/data/belgium/sale-windows.ts": { edition: "belgium", kinds: ["sale-window"] },
  "src/data/belgium/shuttles.ts": { edition: "belgium", kinds: ["shuttle"] },
  "src/data/belgium/lockers.ts": { edition: "belgium", kinds: ["locker"] },
  "src/data/belgium/pearl-bundles.ts": { edition: "belgium", kinds: ["pearl"] },
  "src/data/belgium/stages.ts": { edition: "belgium", kinds: ["stage"] },
  "src/data/winter/facts.ts": { edition: "winter", kinds: ["fact"] },
  "src/data/winter/tickets.ts": { edition: "winter", kinds: ["ticket"] },
  "src/data/winter/accommodation.ts": { edition: "winter", kinds: ["accommodation"] },
  "src/data/winter/sale-windows.ts": { edition: "winter", kinds: ["sale-window"] },
  "src/data/brasil/facts.ts": { edition: "brasil", kinds: ["fact", "ticket", "sale-window"] },
  "src/data/shared/editions.ts": { edition: "all", kinds: ["edition"] },
};

/**
 * The chunk kinds a `sourceRef` names.
 *
 * A `sourceRef` that names only omission or factcheck documents — the ones where
 * the correct behaviour is an honest refusal — yields an empty list, which grades
 * as "abstention is the pass condition".
 */
export function targetKindsFor(sourceRef) {
  const files = String(sourceRef)
    .split(";")
    .map((part) => part.split("#")[0]?.trim())
    .filter((part) => part !== undefined && part.length > 0);

  const kinds = new Set();
  for (const file of files) {
    const entry = SOURCE_REF_KINDS[file];
    if (entry === undefined) continue;
    for (const kind of entry.kinds) kinds.add(`${entry.edition}:${kind}`);
  }
  return [...kinds];
}

/** True when `chunkId` is of a kind and edition the item's `sourceRef` names. */
export function matchesTarget(chunkId, targets) {
  if (targets.length === 0) return false;
  const [edition, kind] = String(chunkId).split(":");
  return targets.includes(`${edition}:${kind}`);
}

/**
 * A retrieval item passes when the passages would let the model answer it well.
 *
 * Three signals, and the reason each is needed:
 *
 * 1. **Target kind.** `sourceRef` names the record the answer is built from, so a
 *    chunk of that edition and kind is strong precision evidence.
 * 2. **Union coverage.** The `mustInclude` phrases present across the *whole*
 *    retrieved set, not in one passage. Some questions genuinely need two records —
 *    "how many Global Journey packages, and when does that sale open" needs the cap
 *    from one FAQ and the date from a sale window — and requiring a single passage to
 *    hold both would fail a retrieval that is in fact correct.
 * 3. **Gradable phrases only.** A phrase that appears nowhere in the knowledge base is
 *    a requirement on the *answer*, not a fact retrieval can find: "independent",
 *    "cannot approve" and "not yet" are things the model must say. Grading retrieval
 *    on them measured the prompt, not the retriever.
 *
 * ## Refusal items
 *
 * A `refuse` item cannot be graded on `mustInclude` at all: its required words are
 * the wording of an honest "not published", which the model writes. What retrieval
 * can determine is whether it handed the model *permission to be wrong*. So a
 * refusal item passes when the retrieved passages contain **no banned claim** — no
 * carried-forward 2026 figure, no invented price — and either found nothing or found
 * material about the right subject. That is the failure worth catching, and it is the
 * one this can actually see.
 */
export function gradeRetrieval(item, passages, corpusText) {
  const targets = targetKindsFor(item.sourceRef);
  const notes = passages.map((passage) => `${passage.chunk.title} ${passage.chunk.content}`).join(" ");
  const haystack = normalise(notes);

  if (item.expectedBehaviour === "refuse") {
    const leaked = (item.mustNotInclude ?? []).filter((phrase) => containsPhrase(haystack, phrase));
    if (leaked.length > 0) {
      return { passed: false, note: `retrieved text contains a banned claim: ${JSON.stringify(leaked[0])}` };
    }
    if (passages.length === 0) return { passed: true, note: "correctly retrieved nothing above the floor" };
    return { passed: true, note: `${passages.length} subject passage(s), no banned claim` };
  }

  const hit = passages.find((passage) => matchesTarget(passage.chunk.id, targets));
  if (hit !== undefined) return { passed: true, note: `retrieved ${hit.chunk.id}` };

  const corpus = normalise(corpusText);
  const phrases = item.mustInclude ?? [];
  const gradable = phrases.filter((phrase) => containsPhrase(corpus, phrase));

  if (gradable.length > 0 && gradable.every((phrase) => containsPhrase(haystack, phrase))) {
    return { passed: true, note: "facts present across the retrieved passages" };
  }

  if (gradable.length === 0) {
    // Every required phrase is answer wording, so the only test is that something
    // was retrieved for the model to ground on.
    return {
      passed: passages.length > 0,
      note: passages.length > 0 ? "no gradable fact; subject passages retrieved" : "nothing retrieved",
    };
  }

  return {
    passed: false,
    note: `expected ${targets.length === 0 ? "a grounding record" : targets.join(" or ")}, top ${passages[0]?.chunk.id ?? "-"}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Offline retrieval mode                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Imports the retriever through Vite's SSR loader.
 *
 * `src/lib/ai/knowledge.ts` is TypeScript using the `@/` path alias, and this
 * script runs on bare Node. Reusing the Vitest config keeps alias resolution
 * identical to the app's, so this measures the code the site ships rather than a
 * re-implementation of it.
 */
async function loadRetriever() {
  const { createServer } = await import("vite");
  const server = await createServer({
    configFile: path.join(ROOT, "vitest.config.mts"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
    root: ROOT,
  });
  try {
    const knowledge = await server.ssrLoadModule("/src/lib/ai/knowledge.ts");
    const chunks = knowledge.getKnowledgeBase();
    const corpusText = chunks.map((chunk) => `${chunk.title} ${chunk.content}`).join(" ");
    return { retrieve: knowledge.retrieve, corpusText, close: () => server.close() };
  } catch (error) {
    await server.close();
    throw error;
  }
}

/**
 * The edition to search for a category, or "all" where a category spans editions.
 *
 * `sales-and-exchange` deliberately spans all three editions (it contains both a
 * Belgium ticket-cap question and a Brasil one), so pinning it to Belgium made the
 * Brasil item unanswerable. The retriever's own edition filter is the right place to
 * narrow, and only where the category genuinely names one edition.
 */
const EDITION_BY_CATEGORY = {
  "belgium-tickets": "belgium",
  "dreamville-montagoe": "belgium",
  winter: "winter",
  brasil: "brasil",
};

async function runRetrievalOnly(items) {
  const { retrieve, corpusText, close } = await loadRetriever();

  try {
    const results = [];
    for (const item of items) {
      const edition = EDITION_BY_CATEGORY[item.category] ?? "all";
      const passages = retrieve(item.question, { edition, limit: RETRIEVAL_K });
      const grade = gradeRetrieval(item, passages, corpusText);
      results.push({
        id: item.id,
        category: item.category,
        question: item.question,
        expectedBehaviour: item.expectedBehaviour,
        edition,
        topScore: Number((passages[0]?.score ?? 0).toFixed(2)),
        topIds: passages.slice(0, 3).map((passage) => passage.chunk.id),
        note: grade.note,
        failures: grade.passed ? [] : [grade.note],
        passed: grade.passed,
      });
    }
    return results;
  } finally {
    await close();
  }
}

/* -------------------------------------------------------------------------- */
/* Live mode                                                                   */
/* -------------------------------------------------------------------------- */

async function askLive(item, options) {
  const edition = EDITION_BY_CATEGORY[item.category] ?? "all";
  const origin = options.baseUrl.replace(/\/+$/, "");

  const response = await fetch(`${origin}/api/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // The route rejects a mutation with no Origin, so the script identifies
      // itself as the site it is testing.
      Origin: origin,
    },
    body: JSON.stringify({ question: item.question, edition }),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Left null; reported with the status below.
  }

  if (!response.ok) {
    return {
      passed: false,
      status: response.status,
      failures: [`HTTP ${response.status}: ${text.slice(0, 200)}`],
      answer: "",
      citations: [],
    };
  }

  const answer = typeof parsed?.answer === "string" ? parsed.answer : "";
  const refusal = parsed?.refusal ?? null;
  // A refusal's message is the answer for grading purposes: on a `refuse` item the
  // expected wording ("not published") lives there, not in the empty `answer`.
  const prose = refusal === null ? answer : `${answer} ${refusal.message}`.trim();

  // A `refuse` item is a pass only when the service refused; an `answer` item must
  // not have been refused.
  const behaviourFailures = [];
  if (item.expectedBehaviour === "refuse" && refusal === null) {
    behaviourFailures.push("expected a refusal but the service answered");
  }
  if (item.expectedBehaviour !== "refuse" && refusal !== null) {
    behaviourFailures.push(`expected an answer but the service refused (${refusal.reason})`);
  }

  const failures = [...behaviourFailures, ...gradeAnswer(item, prose)];

  return {
    passed: failures.length === 0,
    status: response.status,
    failures,
    answer: prose,
    citations: Array.isArray(parsed?.citations) ? parsed.citations : [],
    model: parsed?.model ?? null,
  };
}

/** Runs `worker` over `items` with at most `concurrency` in flight. */
async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const size = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: size }, async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    }),
  );

  return results;
}

async function runLive(items, options) {
  return mapPool(items, options.concurrency, async (item) => {
    try {
      const result = await askLive(item, options);
      return { id: item.id, category: item.category, question: item.question, ...result };
    } catch (error) {
      return {
        id: item.id,
        category: item.category,
        question: item.question,
        passed: false,
        status: 0,
        failures: [`request failed: ${error instanceof Error ? error.message : String(error)}`],
        answer: "",
        citations: [],
      };
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Reporting                                                                   */
/* -------------------------------------------------------------------------- */

export function summarise(results, mode) {
  const byCategory = new Map();
  const byBehaviour = new Map();

  for (const result of results) {
    const category = byCategory.get(result.category) ?? { passed: 0, total: 0 };
    category.total += 1;
    if (result.passed) category.passed += 1;
    byCategory.set(result.category, category);

    const behaviour = byBehaviour.get(result.expectedBehaviour) ?? { passed: 0, total: 0 };
    behaviour.total += 1;
    if (result.passed) behaviour.passed += 1;
    byBehaviour.set(result.expectedBehaviour, behaviour);
  }

  const passed = results.filter((result) => result.passed).length;
  return {
    mode,
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length === 0 ? 0 : passed / results.length,
    byCategory: Object.fromEntries(byCategory),
    byBehaviour: Object.fromEntries(byBehaviour),
  };
}

function printTable(results, summary, options) {
  console.log("");
  console.log(`Mode: ${summary.mode}   Items: ${summary.total}   Passed: ${summary.passed}   Failed: ${summary.failed}`);
  console.log(`Pass rate: ${(summary.passRate * 100).toFixed(1)}%`);
  console.log("");
  console.log("By category:");

  for (const [category, counts] of Object.entries(summary.byCategory)) {
    const rate = counts.total === 0 ? 0 : (counts.passed / counts.total) * 100;
    console.log(
      `  ${category.padEnd(24)} ${String(counts.passed).padStart(3)}/${String(counts.total).padEnd(3)} ${rate.toFixed(0).padStart(3)}%`,
    );
  }

  console.log("");
  console.log("By expected behaviour:");
  for (const [behaviour, counts] of Object.entries(summary.byBehaviour)) {
    const rate = counts.total === 0 ? 0 : (counts.passed / counts.total) * 100;
    console.log(
      `  ${behaviour.padEnd(24)} ${String(counts.passed).padStart(3)}/${String(counts.total).padEnd(3)} ${rate.toFixed(0).padStart(3)}%`,
    );
  }

  const failures = results.filter((result) => !result.passed);
  if (failures.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const failure of failures) {
      console.log(`  ${failure.id.padEnd(8)} ${failure.question}`);
      for (const reason of failure.failures.slice(0, 6)) console.log(`           ${reason}`);
      if (options.verbose && failure.topIds !== undefined) {
        console.log(`           retrieved: ${failure.topIds.join(", ")}`);
      }
      if (options.verbose && failure.answer) {
        console.log(`           answer: ${failure.answer.slice(0, 400)}`);
      }
    }
  }

  console.log("");
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(EVAL_FILE)) {
    console.error(`Evaluation set not found: ${EVAL_FILE}`);
    process.exit(2);
  }

  const set = JSON.parse(fs.readFileSync(EVAL_FILE, "utf8"));
  let items = Array.isArray(set.items) ? set.items : [];
  if (options.category !== null) items = items.filter((item) => item.category === options.category);
  if (options.limit !== null && Number.isFinite(options.limit)) items = items.slice(0, Math.max(0, options.limit));

  if (items.length === 0) {
    console.error("No items selected. Check --category and --limit.");
    process.exit(2);
  }

  if (options.retrievalOnly) {
    if (!options.json) {
      console.log(`Retrieval-only: ${items.length} questions against the lexical retriever. No API calls, no cost.`);
    }
    const results = await runRetrievalOnly(items);
    const summary = summarise(results, "retrieval-only");

    if (options.json) console.log(JSON.stringify({ summary, results }, null, 2));
    else printTable(results, summary, options);

    const threshold = options.threshold ?? 0;
    process.exit(summary.passRate >= threshold ? 0 : 1);
  }

  if (!options.json) {
    console.log(
      `Live mode: ${items.length} questions to ${options.baseUrl}/api/ask, concurrency ${options.concurrency}. ` +
        "This spends real provider budget.",
    );
  }

  const results = await runLive(items, options);
  const summary = summarise(results, "live");

  if (options.json) console.log(JSON.stringify({ summary, results }, null, 2));
  else printTable(results, summary, options);

  const threshold = options.threshold ?? 0;
  process.exit(summary.passRate >= threshold ? 0 : 1);
}

// Only run when invoked directly, so the exported graders can be imported by a
// test without starting an evaluation.
const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  });
}
