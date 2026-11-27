/**
 * The knowledge base behind "Ask the guide".
 *
 * Every passage the model ever sees comes from here: the validated records in
 * `src/data/**`, which are parsed by their Zod schemas at import time, plus the
 * guide's own food-and-drink chapters. Nothing is fetched, generated or
 * paraphrased. That is the whole safety argument — a figure in an answer has a
 * record behind it, and that record has a citation and a verification date.
 *
 * Community food and drink estimates are the labelled exception. They are
 * indexed only from `src/data/shared/food-estimates.ts`. Every such chunk says
 * it is a community estimate and not an official Tomorrowland price, cites the
 * source URL, and keeps the currency as stored (EUR, BRL or Pearls). Bounds are
 * minor units and are written out in that currency; they are not converted
 * into another one. A 2027 figure that is not in a passage is still refused.
 *
 * Two retrievers share one chunk set:
 *
 * - **Lexical (BM25)** — deterministic, offline, free, and the default. It runs
 *   in the route on every question, and it is what `scripts/eval-ai.mjs
 *   --retrieval-only` measures. Determinism matters: the same question must
 *   retrieve the same passages in a test, a preview and production.
 * - **pgvector over Supabase** — used only when `SUPABASE_URL`,
 *   `SUPABASE_SERVICE_ROLE_KEY` and an embedding endpoint are all configured.
 *   It is an optional improvement on the lexical ranking, never a replacement for
 *   the verified data: it stores chunk ids and vectors, and a returned row is
 *   resolved back through this module's own chunk map. A row whose id is not in
 *   the map is discarded rather than trusted.
 *
 * ## What is deliberately absent
 *
 * Official page text. `docs/ai/robots-and-terms-check.md` §6 prohibits storing or
 * indexing Tomorrowland's own copy, so the vector store holds our own summaries
 * of our own verified records, not fetched pages. Live pages are read per
 * question by `live-fetch.ts` and discarded.
 */

import { accommodation as belgiumAccommodationData } from "@/data/belgium/accommodation";
import { addOns as belgiumAddOns } from "@/data/belgium/add-ons";
import { belgiumFacts } from "@/data/belgium/facts";
import { faqs as belgiumFaqs } from "@/data/belgium/faqs";
import { lockers as belgiumLockers } from "@/data/belgium/lockers";
import { pearlBundles as belgiumPearlBundles } from "@/data/belgium/pearl-bundles";
import { saleWindows as belgiumSaleWindows } from "@/data/belgium/sale-windows";
import { shuttles as belgiumShuttles } from "@/data/belgium/shuttles";
import { stages as belgiumStages } from "@/data/belgium/stages";
import { tickets as belgiumTickets } from "@/data/belgium/tickets";
import { brasilData } from "@/data/brasil";
import { partners, resources, whatsappGroups } from "@/data/community";
import type { EditionId, EditionScope, Source } from "@/data/schemas";
import { editions, validatedGeneralFaqs as sharedFaqs } from "@/data/shared";
import { FOOD_ESTIMATE_DISCLAIMER, foodEstimates } from "@/data/shared/food-estimates";
import { winterAddOns } from "@/data/winter/add-ons";
import { winterFacts } from "@/data/winter/facts";
import { winterFaqs } from "@/data/winter/faqs";
import { winterSaleWindows } from "@/data/winter/sale-windows";
import { winterShuttles } from "@/data/winter/shuttles";
import { winterStages } from "@/data/winter/stages";
import { winterTickets } from "@/data/winter/tickets";
import { allChapters, type GuideChapter } from "@/content";
import type { GuideBlock } from "@/content/schema";

/** Cross-edition passages are scoped "all", matching the data layer. */
export type Edition = EditionId | "all";

/** The kinds of record a passage can come from. Used for ranking and display. */
export type ChunkKind =
  | "fact"
  | "ticket"
  | "accommodation"
  | "add-on"
  | "shuttle"
  | "locker"
  | "pearl"
  | "stage"
  | "sale-window"
  | "faq"
  | "edition"
  | "resource"
  | "partner"
  | "community-group"
  | "chapter"
  | "food-estimate";

export interface KnowledgeChunk {
  /** Stable across builds: `edition:kind:record-id`. Vector rows reference this. */
  readonly id: string;
  readonly edition: Edition;
  readonly kind: ChunkKind;
  readonly title: string;
  readonly content: string;
  /** The official page this record cites. Never model-generated. */
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  /** ISO date the record was checked against its source. */
  readonly lastVerified: string;
  /**
   * Searchable words that identify what this record *is*: its edition and its
   * kind ("Belgium 2027 ticket").
   *
   * A separate field rather than a prefix on {@link title}, because the two behave
   * differently in ranking. These words are true of every record of that kind, so
   * they are low-value evidence: worth including, not worth the weight of a title
   * match. Folding them into the title made every ticket outrank the sale-date
   * record for "when do tickets go on sale", which is the wrong answer.
   */
  readonly context: string;
}

export interface ScoredChunk {
  readonly chunk: KnowledgeChunk;
  readonly score: number;
  /** Share of the question's known meaning this record accounts for, 0 to 1. */
  readonly coverage: number;
}

export interface RetrieveOptions {
  /** Restrict to one edition. Passages scoped "all" are still eligible. */
  readonly edition?: Edition;
  /** Maximum passages returned. Defaults to {@link DEFAULT_TOP_K}. */
  readonly limit?: number;
  /** Scores below this are dropped. Defaults to {@link DEFAULT_MIN_SCORE}. */
  readonly minScore?: number;
  /** Coverage below this is dropped. Defaults to {@link MIN_COVERAGE}. */
  readonly minCoverage?: number;
}

export const DEFAULT_TOP_K = 6;

/**
 * The relevance floor, as a multiple of the field's median score.
 *
 * Kept for questions where the whole corpus is a poor fit, but deliberately lenient:
 * a subject-matched question often has several good records, and a strict relative
 * gate removed the right one. The abstention decision lives in the prompt and the
 * validator (see {@link MIN_COVERAGE}).
 */
export const RELATIVE_FLOOR = 1.6;

/**
 * The absolute floor, as a noise gate.
 *
 * Low by design: it rejects noise, not relevance. Relevance is judged by
 * {@link MIN_COVERAGE} and by the ordering; abstention on an unpublished figure is
 * the prompt's job and the validator's, not a similarity score's.
 */
export const DEFAULT_MIN_SCORE = 0.35;

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * "€144", "€1,087", "€2,500.50".
 *
 * Trailing `.00` is dropped because no record stores a meaningfully fractional
 * euro price, and "€735" reads better than "€735.00" in a passage the model is
 * about to quote. Pinned to en-GB so a passage is identical on every machine.
 */
export function formatEur(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  const formatted = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `€${formatted}`;
}

/**
 * "R$3,160".
 *
 * Brazilian prices are whole reais in the data set and are rendered with the
 * separators an English reader expects on the site's own pages, so a quoted
 * figure matches what the reader sees in the guide. No euro conversion exists
 * anywhere, by design.
 */
export function formatBrl(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  return `R$${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(amount)}`;
}

/**
 * "Saturday 30 January 2027, 17:00 CET" from an ISO instant and its zone.
 *
 * Sale windows are stored as instants, but a passage that says
 * `2027-01-30T17:00:00+01:00` is unquotable: a reader asks "when do tickets go on
 * sale" and neither the model nor the retriever can match "30 January" against a
 * machine timestamp. Rendering in the record's own zone also makes the passage state
 * the local time and the abbreviation, which is the form the official pages use and
 * the form a reader needs.
 */
export function formatInstant(instant: string, timeZone: string): string {
  const epoch = Date.parse(instant);
  if (!Number.isFinite(epoch)) return instant;

  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
    timeZone,
  }).formatToParts(new Date(epoch));

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const date = `${pick("weekday")} ${pick("day")} ${pick("month")} ${pick("year")}`.trim();
  const time = `${pick("hour")}:${pick("minute")} ${pick("timeZoneName")}`.trim();
  return `${date}, ${time}`;
}

/** "20–27 March 2027" from two ISO dates, collapsing where the parts agree. */
export function formatDateRange(startsOn: string, endsOn: string): string {
  const parse = (iso: string): { day: number; month: number; year: number } | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (match === null) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  };
  const from = parse(startsOn);
  const to = parse(endsOn);
  if (from === null || to === null) return `${startsOn} to ${endsOn}`;

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  if (from.year !== to.year) {
    return `${from.day} ${months[from.month - 1]} ${from.year} to ${to.day} ${months[to.month - 1]} ${to.year}`;
  }
  if (from.month !== to.month) {
    return `${from.day} ${months[from.month - 1]} to ${to.day} ${months[to.month - 1]} ${to.year}`;
  }
  return `${from.day}–${to.day} ${months[from.month - 1]} ${to.year}`;
}

/**
 * Markdown to one line of prose.
 *
 * FAQ answers are Markdown source. A model reads `**bold**` as noise and a
 * passage full of list markers is harder to quote accurately, so the markers go
 * and the words stay.
 */
export function plainMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]{1,3}/g, "")
    .replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    /*
      `EUR 346` becomes `€346`. Three records write their figures in the spelled-out
      form, and a passage where one price is `€735` and the next is `EUR 346` invites a
      model to quote the inconsistent one and a reader to mistrust both. This is
      formatting of our own data, not a change to it: the number and the currency are
      untouched and no rate is applied.
    */
    .replace(/\bEUR\s?(\d[\d.,]*)/g, "€$1")
    .replace(/\bBRL\s?(\d[\d.,]*)/g, "R$$1")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Chunk construction                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The noun each kind of record is. Included in a chunk's searchable title so a
 * question naming the thing ("ticket", "locker", "shuttle") matches the record
 * that *is* that thing, rather than only a record that happens to mention the word
 * in prose.
 */
const KIND_NOUNS: Readonly<Record<ChunkKind, string>> = {
  fact: "fact",
  ticket: "ticket",
  accommodation: "accommodation DreamVille",
  "add-on": "add-on",
  shuttle: "shuttle transport",
  locker: "locker storage",
  pearl: "Pearl cashless",
  stage: "stage",
  "sale-window": "sale date",
  faq: "question",
  edition: "edition dates",
  resource: "link resource",
  partner: "partner",
  "community-group": "community group",
  chapter: "guide chapter",
  "food-estimate": "food drink stall price community estimate",
};

function chunk(
  edition: Edition,
  kind: ChunkKind,
  recordId: string,
  title: string,
  content: string,
  source: Source,
  lastVerified: string,
): KnowledgeChunk {
  return {
    id: `${edition}:${kind}:${recordId}`,
    edition,
    kind,
    title: title.trim(),
    content: content.trim(),
    sourceUrl: source.url,
    sourceTitle: source.title,
    lastVerified,
    /*
      The brand, the edition and the kind. Without the brand, a ticket record never
      contains the word "Tomorrowland" — its title is "Day Pass" and its notes talk
      about access — so a reader asking "how much is a Tomorrowland Belgium day pass"
      matched a sale-window record that happens to say "Tomorrowland" in passing,
      while the record with the price scored as only partly about the question.

      These words are true of every record of that kind, so they sit in a separately
      weighted field rather than in the title: present and searchable, never strong
      enough to outrank real evidence.
    */
    context: `Tomorrowland ${labelForEdition(edition)} ${KIND_NOUNS[kind]} ${edition} ${kind}`,
  };
}

/** Splits a Pascal/camel-case key into words: `ticketCaps` → "ticket caps". */
function humaniseKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Flattens a verified fact's `value` into `label: value` lines.
 *
 * The facts objects nest three or four levels deep and carry booleans that mean
 * the opposite of what a bare `false` would read as ("same day re-entry: false").
 * Rendering them as explicit lines, with booleans spelled out, is what makes the
 * passage quotable and keeps a model from inverting a negative.
 */
function flattenFactValue(value: unknown, path: readonly string[]): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenFactValue(item, path));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      flattenFactValue(nested, [...path, humaniseKey(key)]),
    );
  }
  const label = path.filter((part) => part.length > 0).join(", ") || "value";
  if (typeof value === "boolean") {
    return [`${label}: ${value ? "yes" : "no"}`];
  }
  if (typeof value === "number") {
    return [`${label}: ${value}`];
  }
  return [`${label}: ${String(value)}`];
}

interface SourcedFact {
  readonly value: unknown;
  readonly source: Source;
  readonly lastVerified: string;
}

function isSourcedFact(value: unknown): value is SourcedFact {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { value?: unknown; source?: unknown; lastVerified?: unknown };
  return (
    candidate.value !== undefined &&
    typeof candidate.source === "object" &&
    candidate.source !== null &&
    typeof candidate.lastVerified === "string"
  );
}

/**
 * Turns a nested facts object into one chunk per top-level key.
 *
 * Per-key rather than per-file: a question about the ticket cap should not drag
 * in the DreamVille opening hours, and a chunk of two thousand words scores
 * poorly against any single question.
 */
function factChunks(
  edition: EditionId,
  prefix: string,
  facts: Record<string, unknown>,
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  for (const [key, entry] of Object.entries(facts)) {
    if (key === "edition") continue;

    if (isSourcedFact(entry)) {
      const lines = flattenFactValue(entry.value, []);
      if (lines.length === 0) continue;
      chunks.push(
        chunk(
          edition,
          "fact",
          `${prefix}-${key}`,
          `${labelForEdition(edition)} — ${humaniseKey(key)}`,
          `${humaniseKey(key)}: ${lines.join("; ")}.`,
          entry.source,
          entry.lastVerified,
        ),
      );
      continue;
    }

    if (typeof entry === "object" && entry !== null) {
      // A group of sourced facts, such as `dreamville`.
      for (const [nestedKey, nested] of Object.entries(entry as Record<string, unknown>)) {
        if (!isSourcedFact(nested)) continue;
        const lines = flattenFactValue(nested.value, []);
        if (lines.length === 0) continue;
        chunks.push(
          chunk(
            edition,
            "fact",
            `${prefix}-${key}-${nestedKey}`,
            `${labelForEdition(edition)} — ${humaniseKey(key)}, ${humaniseKey(nestedKey)}`,
            `${humaniseKey(key)}, ${humaniseKey(nestedKey)}: ${lines.join("; ")}.`,
            nested.source,
            nested.lastVerified,
          ),
        );
      }
    }
  }

  return chunks;
}

function labelForEdition(edition: Edition | EditionScope): string {
  switch (edition) {
    case "belgium":
      return "Belgium 2027";
    case "winter":
      return "Winter 2027";
    case "brasil":
      return "Brasil 2027";
    default:
      return "All editions";
  }
}

const TIER_LABELS: Readonly<Record<string, string>> = {
  regular: "Regular",
  comfort: "Comfort",
  premium: "Pleasure",
  hospitality: "Hospitality",
};

const PRICING_LABELS: Readonly<Record<string, string>> = {
  "per-night": "per night",
  "per-stay": "for the whole stay",
};

const AVAILABILITY_LABELS: Readonly<Record<string, string>> = {
  "sold-out": "Sold out",
  "on-sale": "On sale",
};

/* -------------------------------------------------------------------------- */
/* Food chapters and community estimates                                       */
/* -------------------------------------------------------------------------- */

/**
 * The sentence every community-estimate passage carries.
 *
 * The dataset may add its own disclaimer. This sentence is always present so a
 * passage can be recognised, and quoted, as an estimate rather than an official
 * Tomorrowland price.
 */
export const COMMUNITY_ESTIMATE_LABEL = "Community estimate, not an official Tomorrowland price.";

/**
 * One row of `src/data/shared/food-estimates.ts`.
 *
 * Structural on purpose: that module is owned elsewhere, and this indexer only
 * depends on the fields the row is specified to have. `confidence` is fixed so
 * an official price cannot enter through this path.
 */
export interface FoodEstimateRecord {
  readonly edition: Edition;
  readonly kind: string;
  readonly name: string;
  readonly summary: string;
  /**
   * Null when the source did not give a range. EUR, BRL and pearls are never
   * converted into each other.
   */
  readonly currency: string | null;
  /**
   * Minor units when `currency` is set: euro cents, Brazilian centavos, or
   * hundredths of a Pearl (150 is 1.50 Pearls). Null when no range is stored.
   */
  readonly low: number | null;
  readonly high: number | null;
  readonly source: {
    readonly url: string;
    readonly title: string;
    /** Present on rows built before `checkedOn` was the dataset's field. */
    readonly retrievedOn?: string;
    /** When the source page was read for this estimate. */
    readonly checkedOn?: string;
  };
  readonly confidence: "community-estimate";
}

/** A kebab-case id fragment. Stable for a given label: punctuation folds, case does not matter. */
function slugifyLabel(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug.length > 0 ? slug : "item";
}

/**
 * Writes a minor-unit integer as a major-unit amount.
 *
 * 665 cents is €6.65, not €665. 150 hundredths of a Pearl is 1.50 Pearls.
 * A whole amount drops the decimals; a fraction keeps two places so 380 cents
 * is 3.80, matching the figure the source printed.
 */
function formatMinorUnits(minor: number): string {
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const whole = Math.trunc(absolute / 100);
  const fraction = absolute % 100;
  const wholeText = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(whole);
  const body = fraction === 0 ? wholeText : `${wholeText}.${String(fraction).padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

/**
 * Renders one stored amount without converting it into another currency.
 *
 * `minor` is euro cents, centavos, or hundredths of a Pearl. EUR is shown as
 * `€` on Belgium and Winter. A Brasil passage must not carry a euro or pound
 * symbol, so a Brasil row stored as EUR is written `EUR 9` — the stored code,
 * not a conversion into reais. BRL stays `R$`. Pearls stay Pearls.
 */
function formatEstimateAmount(edition: Edition, currency: string, minor: number): string {
  if (!Number.isInteger(minor)) return "";
  const rendered = formatMinorUnits(minor);
  const code = currency.trim().toLowerCase();
  if (code === "pearl" || code === "pearls") {
    const major = minor / 100;
    return `${rendered} ${major === 1 ? "Pearl" : "Pearls"}`;
  }
  if (code === "brl" || code === "real" || code === "reais") return `R$${rendered}`;
  if (code === "eur" || code === "euro" || code === "euros") {
    if (edition === "brasil") return `EUR ${rendered}`;
    return `€${rendered}`;
  }
  return `${rendered} ${currency.trim()}`;
}

function formatEstimateRange(edition: Edition, currency: string, low: number, high: number): string {
  const from = formatEstimateAmount(edition, currency, low);
  const to = formatEstimateAmount(edition, currency, high);
  if (from.length === 0 || to.length === 0) return "";
  if (low === high) return from;
  return `${from} to ${to}`;
}

/** The dataset disclaimer, plus the required label when the disclaimer does not already say it. */
function joinEstimateDisclaimer(moduleDisclaimer: string): string {
  const extra = moduleDisclaimer.replace(/\s+/g, " ").trim();
  const required = COMMUNITY_ESTIMATE_LABEL;
  if (extra.length === 0) return required;
  const folded = extra.toLowerCase();
  if (folded.includes("community estimate") && folded.includes("not an official")) return extra;
  return `${required} ${extra}`;
}

/**
 * One chunk per community food or drink estimate.
 *
 * The currency is rendered as stored. The disclaimer and the source URL are in
 * the passage text, because that text is what the model is allowed to quote
 * and what the output validator checks figures against.
 */
function estimateCheckedOn(source: FoodEstimateRecord["source"]): string {
  if (typeof source.checkedOn === "string" && source.checkedOn.length > 0) return source.checkedOn;
  if (typeof source.retrievedOn === "string" && source.retrievedOn.length > 0) return source.retrievedOn;
  return "";
}

/**
 * One chunk per community food or drink estimate.
 *
 * Bounds are minor units and are written out in the stored currency. A row
 * with no currency is still indexed: it describes a stall or a marketplace
 * the source did not price. The disclaimer and the source URL are in the
 * passage text, because that text is what the model may quote and what the
 * output validator checks figures against.
 */
export function foodEstimateChunks(
  estimates: readonly FoodEstimateRecord[],
  disclaimer: string,
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const used = new Set<string>();

  for (const record of estimates) {
    if (record.confidence !== "community-estimate") continue;
    const name = record.name.trim();
    if (name.length === 0) continue;

    const checkedOn = estimateCheckedOn(record.source);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) continue;

    const priced = record.currency !== null && record.low !== null && record.high !== null;
    const unpriced = record.currency === null && record.low === null && record.high === null;
    if (!priced && !unpriced) continue;

    let amountLine = "No sourced range is stored.";
    if (priced && record.currency !== null && record.low !== null && record.high !== null) {
      const range = formatEstimateRange(record.edition, record.currency, record.low, record.high);
      if (range.length === 0) continue;
      amountLine =
        record.low === record.high
          ? `Estimated amount ${range}. The stored integer is minor units of ${record.currency}, already written out above.`
          : `Estimated range ${range}. The stored integers are minor units of ${record.currency}, already written out above.`;
    }

    let recordId = `${slugifyLabel(record.kind)}-${slugifyLabel(name)}`;
    if (used.has(`${record.edition}:${recordId}`)) {
      let suffix = 2;
      while (used.has(`${record.edition}:${recordId}-${suffix}`)) suffix += 1;
      recordId = `${recordId}-${suffix}`;
    }
    used.add(`${record.edition}:${recordId}`);

    const label = joinEstimateDisclaimer(disclaimer);

    chunks.push(
      chunk(
        record.edition,
        "food-estimate",
        recordId,
        `${name} — food and drink community estimate`,
        [
          `${name}.`,
          `Kind: ${record.kind.trim()}.`,
          amountLine,
          plainMarkdown(record.summary),
          "Marked as a community estimate.",
          "Not an official 2027 price.",
          label.endsWith(".") ? label : `${label}.`,
          `Source: ${record.source.url}.`,
        ]
          .filter((part) => part.length > 0)
          .join(" "),
        { url: record.source.url, title: record.source.title, retrievedOn: checkedOn },
        checkedOn,
      ),
    );
  }

  return chunks;
}

function isFoodChapter(chapter: GuideChapter): boolean {
  return chapter.slug === "food" || chapter.slug.startsWith("food-");
}

function editionForChapter(edition: GuideChapter["edition"]): Edition {
  switch (edition) {
    case "belgium":
    case "winter":
    case "brasil":
      return edition;
    case "general":
      return "all";
    default: {
      const exhaustive: never = edition;
      return exhaustive;
    }
  }
}

function sourceIdsIn(block: GuideBlock): readonly string[] {
  if (block.type === "facts") return block.rows.flatMap((row) => row.sources);
  if (block.type === "p" || block.type === "ul" || block.type === "ol" || block.type === "callout") {
    return block.sources ?? [];
  }
  return [];
}

function blockToProse(block: GuideBlock): string {
  switch (block.type) {
    case "p":
      return plainMarkdown(block.text);
    case "callout":
      return `${block.title}. ${plainMarkdown(block.text)}`;
    case "ul":
    case "ol":
      return block.items.map((item) => plainMarkdown(item)).join("; ");
    case "facts":
      return block.rows.map((row) => `${row.label}: ${plainMarkdown(row.value)}`).join("; ");
    case "h3":
      return block.text;
    case "h2":
    case "data":
      return "";
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

interface FoodSection {
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly GuideBlock[];
}

/** Splits a chapter on its h2s. The lead, before the first h2, is "overview". */
function foodSections(chapter: GuideChapter): FoodSection[] {
  const sections: FoodSection[] = [];
  let current: { id: string; heading: string; blocks: GuideBlock[] } = {
    id: "overview",
    heading: chapter.title,
    blocks: [],
  };

  const flush = (): void => {
    if (current.blocks.length > 0) sections.push(current);
  };

  for (const block of chapter.blocks) {
    if (block.type === "h2") {
      flush();
      current = { id: block.id, heading: block.text, blocks: [] };
      continue;
    }
    current.blocks.push(block);
  }
  flush();
  return sections;
}

/**
 * The citation for a section: the source its blocks cite most often.
 *
 * A section has one citation slot. The source that supports the most of its
 * lines is the one a reader should land on; ties keep the chapter's source
 * order, which is stable.
 */
function primarySource(chapter: GuideChapter, ids: readonly string[]): { url: string; title: string } | null {
  if (chapter.sources.length === 0) return null;
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);

  let chosen = chapter.sources[0];
  let bestCount = -1;
  for (const source of chapter.sources) {
    const count = counts.get(source.id) ?? 0;
    if (count > bestCount) {
      chosen = source;
      bestCount = count;
    }
  }
  if (chosen === undefined) return null;
  return { url: chosen.url, title: chosen.title };
}

/**
 * Indexes food-and-drink chapters from the guide registry.
 *
 * One path, the registry, rather than a direct import of each chapter file:
 * a Winter or Brasil food chapter is picked up when it is added to its edition
 * index, and a chapter that is not registered is not indexed. Chunk ids are
 * `edition:chapter:slug:heading-id`, with the lead called `overview`.
 */
function foodGuideChapterChunks(chapters: readonly GuideChapter[]): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  for (const chapter of chapters) {
    if (!isFoodChapter(chapter)) continue;
    const edition = editionForChapter(chapter.edition);

    for (const section of foodSections(chapter)) {
      const prose = section.blocks.map((block) => blockToProse(block)).filter((part) => part.length > 0);
      if (prose.length === 0 && section.id !== "overview") continue;

      const cited = section.blocks.flatMap((block) => [...sourceIdsIn(block)]);
      const source = primarySource(chapter, cited);
      if (source === null) continue;

      const content = [
        `${chapter.title}.`,
        section.id === "overview" ? plainMarkdown(chapter.summary) : `${section.heading}.`,
        ...prose,
      ]
        .filter((part) => part.length > 0)
        .join(" ");

      chunks.push(
        chunk(
          edition,
          "chapter",
          `${chapter.slug}:${section.id}`,
          section.id === "overview" ? chapter.title : `${chapter.title} — ${section.heading}`,
          content,
          { url: source.url, title: source.title, retrievedOn: chapter.lastVerified },
          chapter.lastVerified,
        ),
      );
    }
  }

  return chunks;
}

/**
 * Every chunk in the knowledge base, built once on first use.
 *
 * A function rather than a top-level constant so a test can import the module
 * without paying for the whole build, and so the build order is explicit.
 */
export function buildKnowledgeBase(): readonly KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  /* ------------------------------- Belgium ------------------------------- */
  chunks.push(...factChunks("belgium", "be", belgiumFacts as unknown as Record<string, unknown>));

  for (const ticket of belgiumTickets) {
    chunks.push(
      chunk(
        "belgium",
        "ticket",
        ticket.id,
        ticket.name,
        [
          `${ticket.name}.`,
          `Price ${formatEur(ticket.priceEur)} per person.`,
          `Tier: ${TIER_LABELS[ticket.tier] ?? ticket.tier}.`,
          ticket.nights > 0 ? `${ticket.nights} nights.` : "No overnight stay included.",
          `Includes: ${ticket.includes.join("; ")}.`,
          ticket.notes === undefined ? "" : `${plainMarkdown(ticket.notes)}.`,
        ]
          .filter((part) => part.length > 0)
          .join(" "),
        ticket.source,
        ticket.lastVerified,
      ),
    );
  }

  for (const item of belgiumAccommodationData) {
    chunks.push(
      chunk(
        "belgium",
        "accommodation",
        item.id,
        item.name,
        [
          `${item.name}.`,
          `Price ${formatEur(item.nightlyOrTotalEur)} ${PRICING_LABELS[item.pricing] ?? item.pricing}, for up to ${item.capacity} ${item.capacity === 1 ? "person" : "people"}.`,
          `${plainMarkdown(item.notes)}.`,
        ].join(" "),
        item.source,
        item.lastVerified,
      ),
    );
  }

  for (const addOn of belgiumAddOns) {
    chunks.push(
      chunk(
        "belgium",
        "add-on",
        addOn.id,
        addOn.name,
        `${addOn.name}. Price ${formatEur(addOn.priceEur)}. Category: ${addOn.category}.`,
        addOn.source,
        addOn.lastVerified,
      ),
    );
  }

  for (const locker of belgiumLockers) {
    chunks.push(
      chunk(
        "belgium",
        "locker",
        locker.id,
        locker.name,
        `${locker.name}. Size ${locker.size}. Price ${formatEur(locker.priceEur)}. ${plainMarkdown(locker.notes)}.`,
        locker.source,
        locker.lastVerified,
      ),
    );
  }

  for (const bundle of belgiumPearlBundles) {
    chunks.push(
      chunk(
        "belgium",
        "pearl",
        bundle.id,
        `Pearl bundle — ${bundle.pearls} Pearls`,
        `${bundle.pearls} Pearls for ${formatEur(bundle.priceEur)}.`,
        bundle.source,
        bundle.lastVerified,
      ),
    );
  }

  for (const shuttle of belgiumShuttles) {
    chunks.push(
      chunk(
        "belgium",
        "shuttle",
        shuttle.id,
        shuttle.name,
        `${shuttle.name}. Route: ${shuttle.route}. Operator: ${shuttle.operator}. Price ${formatEur(shuttle.priceEur)}. ${plainMarkdown(shuttle.notes)}.`,
        shuttle.source,
        shuttle.lastVerified,
      ),
    );
  }

  for (const stage of belgiumStages) {
    chunks.push(
      chunk(
        "belgium",
        "stage",
        stage.id,
        stage.name,
        `${stage.name}. Kind: ${stage.kind}. ${plainMarkdown(stage.description)}`,
        stage.source,
        stage.lastVerified,
      ),
    );
  }

  for (const window of belgiumSaleWindows) {
    chunks.push(
      chunk(
        "belgium",
        "sale-window",
        window.id,
        window.name,
        [
          `${window.name}. Opens ${formatInstant(window.opensAt, window.timeZone)}.`,
          `Audience: ${window.audience}.`,
          window.notes === undefined ? "" : `${plainMarkdown(window.notes)}.`,
        ]
          .filter((part) => part.length > 0)
          .join(" "),
        window.source,
        window.lastVerified,
      ),
    );
  }

  /* -------------------------------- Winter ------------------------------- */
  for (const fact of winterFacts) {
    chunks.push(
      chunk(
        "winter",
        "fact",
        fact.id,
        `Winter 2027 — ${fact.label}`,
        [
          `${fact.label}: ${fact.value}.`,
          fact.detail === undefined ? "" : `${plainMarkdown(fact.detail)}.`,
          `Category: ${fact.category}.`,
        ]
          .filter((part) => part.length > 0)
          .join(" "),
        fact.source,
        fact.lastVerified,
      ),
    );
  }

  for (const ticket of winterTickets) {
    chunks.push(
      chunk(
        "winter",
        "ticket",
        ticket.id,
        ticket.name,
        `${ticket.name}. Price ${formatEur(ticket.priceEur)} per person. Includes: ${ticket.includes.join("; ")}. ${plainMarkdown(ticket.notes ?? "")}.`,
        ticket.source,
        ticket.lastVerified,
      ),
    );
  }

  for (const addOn of winterAddOns) {
    chunks.push(
      chunk(
        "winter",
        "add-on",
        addOn.id,
        addOn.name,
        `${addOn.name}. Price ${formatEur(addOn.priceEur)}. Category: ${addOn.category}.`,
        addOn.source,
        addOn.lastVerified,
      ),
    );
  }

  for (const shuttle of winterShuttles) {
    chunks.push(
      chunk(
        "winter",
        "shuttle",
        shuttle.id,
        shuttle.name,
        `${shuttle.name}. Route: ${shuttle.route}. Operator: ${shuttle.operator}. Price ${formatEur(shuttle.priceEur)}. ${plainMarkdown(shuttle.notes)}.`,
        shuttle.source,
        shuttle.lastVerified,
      ),
    );
  }

  for (const stage of winterStages) {
    chunks.push(
      chunk(
        "winter",
        "stage",
        stage.id,
        stage.name,
        `${stage.name}. Kind: ${stage.kind}. ${plainMarkdown(stage.description)}`,
        stage.source,
        stage.lastVerified,
      ),
    );
  }

  for (const window of winterSaleWindows) {
    chunks.push(
      chunk(
        "winter",
        "sale-window",
        window.id,
        window.name,
        `${window.name}. Opens ${formatInstant(window.opensAt, window.timeZone)}. Audience: ${window.audience}. ${plainMarkdown(window.notes ?? "")}`.trim(),
        window.source,
        window.lastVerified,
      ),
    );
  }

  /* -------------------------------- Brasil ------------------------------- */
  for (const fact of brasilData.facts) {
    chunks.push(
      chunk(
        "brasil",
        "fact",
        fact.id,
        `Brasil 2027 — ${humaniseKey(fact.topic)}`,
        `${plainMarkdown(fact.statement)}`,
        fact.source,
        fact.lastVerified,
      ),
    );
  }

  for (const ticket of brasilData.tickets) {
    chunks.push(
      chunk(
        "brasil",
        "ticket",
        ticket.id,
        ticket.name,
        [
          `${ticket.name}.`,
          `Price ${formatBrl(ticket.price.amount)} (Brazilian reais).`,
          `Valid for ${ticket.validDays} ${ticket.validDays === 1 ? "day" : "days"}.`,
          `Availability: ${AVAILABILITY_LABELS[ticket.availability] ?? ticket.availability}.`,
          `${plainMarkdown(ticket.notes)}.`,
        ].join(" "),
        ticket.source,
        ticket.lastVerified,
      ),
    );
  }

  for (const pkg of brasilData.dreamvillePackages) {
    chunks.push(
      chunk(
        "brasil",
        "accommodation",
        pkg.id,
        pkg.name,
        `${pkg.name}. Price ${formatBrl(pkg.price.amount)} (Brazilian reais) for ${pkg.capacity} ${pkg.capacity === 1 ? "person" : "people"}. Family: ${pkg.family}, tier: ${pkg.tier}, sale moment: ${pkg.saleMoment}. Availability: ${AVAILABILITY_LABELS[pkg.availability] ?? pkg.availability}. ${plainMarkdown(pkg.notes)}.`,
        pkg.source,
        pkg.lastVerified,
      ),
    );
  }

  for (const shuttle of brasilData.shuttles) {
    chunks.push(
      chunk(
        "brasil",
        "shuttle",
        shuttle.id,
        shuttle.name,
        `${shuttle.name}. Departure cities: ${shuttle.departureCities.join(", ")}. Boarding points: ${shuttle.boardingPoints.join(", ") || "not published"}. ${plainMarkdown(shuttle.notes)}.`,
        shuttle.source,
        shuttle.lastVerified,
      ),
    );
  }

  for (const window of brasilData.saleWindows) {
    chunks.push(
      chunk(
        "brasil",
        "sale-window",
        window.id,
        window.name,
        `${window.name}. Opens ${formatInstant(window.opensAt, window.timeZone)}. Status: ${window.status}. Audience: ${window.audience}. ${plainMarkdown(window.notes)}.`,
        window.source,
        window.lastVerified,
      ),
    );
  }

  /* --------------------------------- FAQs -------------------------------- */
  const faqSets: ReadonlyArray<{ readonly edition: Edition; readonly prefix: string; readonly records: typeof belgiumFaqs }> = [
    { edition: "belgium", prefix: "be", records: belgiumFaqs },
    { edition: "winter", prefix: "wi", records: winterFaqs },
    { edition: "all", prefix: "sh", records: sharedFaqs },
  ];

  for (const set of faqSets) {
    for (const faq of set.records) {
      chunks.push(
        chunk(
          set.edition,
          "faq",
          `${set.prefix}-${faq.id}`,
          faq.question,
          `${faq.question} ${plainMarkdown(faq.answer)}`,
          faq.source,
          faq.lastVerified,
        ),
      );
    }
  }

  /* ------------------------------- Shared -------------------------------- */
  for (const edition of editions) {
    chunks.push(
      chunk(
        "all",
        "edition",
        edition.id,
        edition.name,
        `${edition.name}. ${formatDateRange(edition.startsOn, edition.endsOn)} at ${edition.venue}, ${edition.location}. Status: ${edition.status}. ${edition.notes === undefined ? "" : `${plainMarkdown(edition.notes)}.`}`.trim(),
        edition.source,
        edition.lastVerified,
      ),
    );
  }

  /* ------------------------------ Community ------------------------------ */
  for (const resource of resources) {
    chunks.push(
      chunk(
        "all",
        "resource",
        resource.id,
        resource.title,
        `${resource.title}. ${plainMarkdown(resource.description)} Category: ${resource.category}.`,
        resource.source,
        resource.lastVerified,
      ),
    );
  }

  for (const partner of partners) {
    chunks.push(
      chunk(
        "all",
        "partner",
        partner.id,
        partner.name,
        `${partner.name}. Offer: ${plainMarkdown(partner.offer)}. ${plainMarkdown(partner.disclosure)}`,
        partner.source,
        partner.lastVerified,
      ),
    );
  }

  for (const group of whatsappGroups) {
    chunks.push(
      chunk(
        "all",
        "community-group",
        group.id,
        group.title,
        `${group.title}. Region: ${group.region}. Link status: ${group.linkStatus}.`,
        group.source,
        group.lastVerified,
      ),
    );
  }

  /*
    Food and drink prose, from the guide registry. Pearls, the cup deposit and
    what a reader may carry in live in the chapter, not in a price table.
  */
  chunks.push(...foodGuideChapterChunks(allChapters()));

  chunks.push(...foodEstimateChunks(foodEstimates, FOOD_ESTIMATE_DISCLAIMER));

  return chunks;
}

let cachedChunks: readonly KnowledgeChunk[] | null = null;

/** The chunk set, built once per process. */
export function getKnowledgeBase(): readonly KnowledgeChunk[] {
  if (cachedChunks === null) cachedChunks = buildKnowledgeBase();
  return cachedChunks;
}

/** A chunk by id, for resolving a vector-store row back to verified data. */
export function getChunkById(id: string): KnowledgeChunk | undefined {
  return getKnowledgeBase().find((candidate) => candidate.id === id);
}

/* -------------------------------------------------------------------------- */
/* Lexical retrieval                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Words too common to carry meaning in a question about this festival. Removing
 * them stops "how much is a ticket" from scoring highly against every record that
 * happens to contain "is", and stops the filler in "can you tell me how much one
 * day costs" from diluting the terms that matter.
 *
 * Words that look meaningful but are not, in this domain: "much" (a price
 * question, where the price token does the work), "one" (a number that is never
 * the distinguishing feature once "day pass" or "Pearl" is present), and the
 * conversational verbs a reader naturally writes.
 */
const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "again",
  "all",
  "also",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "done",
  "either",
  "else",
  "even",
  "ever",
  "every",
  "exactly",
  "for",
  "from",
  "get",
  "gets",
  "getting",
  "give",
  "go",
  "going",
  "got",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "know",
  "let",
  "like",
  "lot",
  "make",
  "many",
  "may",
  "me",
  "might",
  "mine",
  "more",
  "most",
  "much",
  "must",
  "my",
  "need",
  "no",
  "not",
  "of",
  "off",
  "on",
  "once",
  "one",
  "only",
  "or",
  "other",
  "ought",
  "our",
  "out",
  "over",
  "own",
  "please",
  "quite",
  "rather",
  "really",
  "right",
  "said",
  "same",
  "say",
  "see",
  "she",
  "should",
  "since",
  "so",
  "some",
  "still",
  "such",
  "sure",
  "take",
  "tell",
  "than",
  "thank",
  "thanks",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "think",
  "this",
  "those",
  "through",
  "to",
  "too",
  "try",
  "under",
  "up",
  "us",
  "very",
  "want",
  "was",
  "way",
  "we",
  "well",
  "were",
  "what",
  "when",
  "where",
  "whether",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
  "yours",
]);

/**
 * Domain synonyms, applied to the query only.
 *
 * This is a small curated table, not a general thesaurus, and it exists because
 * the vocabulary of this subject is fixed: a reader writes "ticket" and the
 * records say "Day Pass", or writes "camping" and the records say "Magnificent
 * Greens". Each group is one concept; a query term in a group also scores every
 * other term in it, at a discount, so the literal word still wins a tie.
 *
 * Deliberately absent: anything that would conflate two different things. "Pearl"
 * is not a synonym for "price"; "locker" is not "storage"; "winter" is not
 * "snow".
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["ticket", "pass", "admission"],
  ["camping", "dreamville", "campsite", "camp"],
  ["accommodation", "lodging", "sleep", "stay", "hotel", "tent"],
  ["pearl", "cashless", "topup"],
  ["price", "cost", "expensive", "cheap", "pay"],
  ["refund", "cancel", "cancellation", "reimburs"],
  ["resale", "resell", "secondari", "scam", "scammer", "fraud"],
  ["shuttle", "bus", "coach", "transfer"],
  ["train", "rail", "station"],
  ["parking", "park", "car"],
  ["locker", "storage"],
  ["accessibility", "wheelchair", "disabled"],
  ["food", "drink", "eat", "meal", "restaur", "stall", "marketplace"],
  ["carry", "bring", "prohibited", "banned"],
  ["lineup", "artist", "dj"],
  ["stage", "arena"],
  ["shower", "toilet", "sanitari"],
  ["deposit", "cup", "reusable"],
];

/** Stemmed synonyms, computed once. */
const SYNONYM_MAP: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    const stems = group.map((word) => stem(word.toLowerCase()));
    for (const source of stems) {
      const others = stems.filter((candidate) => candidate !== source);
      const existing = map.get(source) ?? [];
      map.set(source, [...new Set([...existing, ...others])]);
    }
  }
  return map;
})();

/**
 * Light plural folding.
 *
 * A real stemmer would conflate words the guide needs kept apart ("passes" the
 * ticket against "pass" the verb is fine; "prices" against "price" is the
 * intended win). Two rules cover the vocabulary here: `-ies` → `y` and a trailing
 * `s` that is not part of `ss`.
 */
export function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("sses")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/**
 * Splits text into searchable tokens.
 *
 * Currency amounts are preserved as single tokens with the symbol folded in
 * (`€144` → `eur144`, `R$3,160` → `brl3160`), so a question that quotes a price
 * scores against the record carrying that price and not against every record
 * carrying any number. Years are kept as plain tokens (`2027`) because they are
 * the single most important discriminator in this data set: every edition has a
 * 2026 and a 2027 record, and confusing them is the worst failure the guide can
 * make.
 */
export function tokenise(text: string): string[] {
  const normalised = text
    .toLowerCase()
    .replace(/r\$\s?([\d.,]+)/g, (_match, digits: string) => ` brl${digits.replace(/[.,]/g, "")} `)
    .replace(/€\s?([\d.,]+)/g, (_match, digits: string) => ` eur${digits.replace(/[.,]/g, "")} `)
    .replace(/£\s?([\d.,]+)/g, (_match, digits: string) => ` gbp${digits.replace(/[.,]/g, "")} `)
    .replace(/[^a-z0-9]+/g, " ");

  const tokens: string[] = [];
  for (const raw of normalised.split(" ")) {
    if (raw.length === 0) continue;
    if (STOPWORDS.has(raw)) continue;
    if (raw.length === 1 && !/\d/.test(raw)) continue;
    tokens.push(stem(raw));
  }
  return tokens;
}

/** A query term and the weight it carries: literal terms outrank synonyms. */
export interface WeightedTerm {
  readonly term: string;
  readonly weight: number;
}

/** How much a synonym contributes next to the word the reader actually wrote. */
export const SYNONYM_WEIGHT = 0.45;

/**
 * Adjacent word pairs and triples are indexed as their own terms, joined by a
 * space.
 *
 * This is what makes the retriever work on this vocabulary. Single tokens cannot
 * tell "Winter 2027" from a Brasil record that happens to contain the verb "held",
 * because the rare verb wins on inverse document frequency. A phrase can: "winter
 * 2027" appears in the Winter records and nowhere else.
 *
 * A phrase outweighs its words individually, so a record containing the phrase
 * always beats one containing the words apart.
 */
export const PHRASE_WEIGHT = 1.7;
export const TRIGRAM_WEIGHT = 2.3;

/**
 * Builds the unigrams plus adjacent phrases of a token list.
 *
 * Phrases are formed *after* stopword removal, so "how much is a day ticket"
 * yields the bigram "day ticket" rather than "a day". That is deliberate: the
 * filler between two meaningful words is noise, and dropping it before forming the
 * pair is what lets "pearl worth" match "one Pearl worth in 2027".
 */
export function withPhrases(tokens: readonly string[]): string[] {
  if (tokens.length < 2) return [...tokens];
  const out = [...tokens];
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    out.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    out.push(`${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`);
  }
  return out;
}

/**
 * Expands a query into weighted terms.
 *
 * Literal words score at 1, synonyms at {@link SYNONYM_WEIGHT}, adjacent pairs at
 * {@link PHRASE_WEIGHT} and triples at {@link TRIGRAM_WEIGHT}. Duplicates are
 * removed with the highest weight winning, so a word that is also part of a
 * matched phrase is not counted twice at the lower weight.
 */
export function expandQuery(text: string): WeightedTerm[] {
  const literals = tokenise(text);
  const weights = new Map<string, number>();

  for (const term of literals) weights.set(term, 1);

  for (const term of new Set(literals)) {
    for (const synonym of SYNONYM_MAP.get(term) ?? []) {
      const existing = weights.get(synonym);
      if (existing !== undefined && existing >= SYNONYM_WEIGHT) continue;
      weights.set(synonym, SYNONYM_WEIGHT);
    }
  }

  for (let index = 0; index + 1 < literals.length; index += 1) {
    weights.set(`${literals[index]} ${literals[index + 1]}`, PHRASE_WEIGHT);
  }
  for (let index = 0; index + 2 < literals.length; index += 1) {
    weights.set(`${literals[index]} ${literals[index + 1]} ${literals[index + 2]}`, TRIGRAM_WEIGHT);
  }

  return [...weights].map(([term, weight]) => ({ term, weight }));
}

/**
 * The literals that must be accounted for in the coverage ratio, with the weight
 * each carries.
 *
 * **Unigrams only.** A phrase is a stronger *form* of words already in this set, so
 * it belongs in the BM25 sum as extra evidence, not in the denominator as an extra
 * requirement. Including phrases here was measurably wrong: a question containing
 * "day ticket" made every record that says "ticket" and "day" separately score as
 * half-covered, which pushed short records with no real relevance above the floor.
 */
export function queryLiterals(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const term of tokenise(text)) map.set(term, 1);
  return map;
}

interface IndexedChunk {
  readonly chunk: KnowledgeChunk;
  /** Term frequencies over title (weighted), context and body, with phrases. */
  readonly termFrequencies: ReadonlyMap<string, number>;
  readonly length: number;
  /** Years the record names, so a mismatch can be penalised. */
  readonly years: ReadonlySet<string>;
}

interface Bm25Index {
  readonly documents: readonly IndexedChunk[];
  readonly documentFrequency: ReadonlyMap<string, number>;
  readonly averageLength: number;
}

const K1 = 1.2;
const B = 0.75;

/** Extracts four-digit years from a record, for the mismatch penalty. */
function yearsIn(text: string): Set<string> {
  const years = new Set<string>();
  for (const match of text.matchAll(/\b(20\d{2})\b/g)) {
    if (match[1] !== undefined) years.add(match[1]);
  }
  return years;
}

/** Builds the term index. Pure, so a test can build it from a fixed chunk list. */
export function buildIndex(chunks: readonly KnowledgeChunk[]): Bm25Index {
  const documents: IndexedChunk[] = [];
  const documentFrequency = new Map<string, number>();
  let totalLength = 0;

  for (const entry of chunks) {
    /*
      Three sources of evidence, weighted by how much each says about what the
      record is, and two of them treated differently for a reason:

      1. **Title**, counted three times, with its adjacent phrases. A title is a
         curated label: "Winter 2027 — 7-Day Festival Ticket" appearing as a phrase
         is strong evidence. Phrases are formed here because a title is short and
         deliberate.
      2. **Context** (edition and kind), counted once, unigrams only. True of every
         record of that kind, so worth having and worth little.
      3. **Body**, counted once, unigrams only. Prose phrases are incidental: a long
         record will contain "the day" and "of the" somewhere, and indexing those as
         phrases adds noise that swamps the signal. Only the title's phrases are
         trusted.
    */
    const tokens = [
      ...withPhrases(tokenise(entry.title)),
      ...withPhrases(tokenise(entry.title)),
      ...withPhrases(tokenise(entry.title)),
      ...tokenise(entry.context),
      ...tokenise(entry.content),
    ];
    const termFrequencies = new Map<string, number>();
    for (const token of tokens) termFrequencies.set(token, (termFrequencies.get(token) ?? 0) + 1);
    for (const token of termFrequencies.keys()) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
    documents.push({
      chunk: entry,
      termFrequencies,
      length: tokens.length,
      years: yearsIn(`${entry.title} ${entry.content}`),
    });
    totalLength += tokens.length;
  }

  return {
    documents,
    documentFrequency,
    averageLength: documents.length === 0 ? 0 : totalLength / documents.length,
  };
}

let cachedIndex: Bm25Index | null = null;

function getIndex(): Bm25Index {
  if (cachedIndex === null) cachedIndex = buildIndex(getKnowledgeBase());
  return cachedIndex;
}

function inverseDocumentFrequency(index: Bm25Index, term: string): number {
  const df = index.documentFrequency.get(term) ?? 0;
  const total = index.documents.length;
  return Math.log(1 + (total - df + 0.5) / (df + 0.5));
}

/**
 * How much a record is penalised for naming a year the question did not ask about.
 *
 * This is the check that keeps a 2026 fact out of a 2027 answer. "When is
 * Tomorrowland Winter 2027?" shares "Tomorrowland" and "Winter" with the 2026
 * record, and without a penalty the 2026 record can outrank the 2027 one. A
 * record naming the right year is not boosted — it is correct by default — only a
 * mismatched one is marked down.
 */
const YEAR_MISMATCH_FACTOR = 0.35;

/**
 * A question whose answer is a figure, and a record that carries one.
 *
 * "How much is a day pass" and "what does it cost" are the most common questions on
 * this site, and a lexical score handles them badly: "how much" becomes the single
 * token "much" (removed as filler), leaving "day" and "ticket", which every record in
 * the corpus contains. The record with the price then competes on the same footing as
 * a FAQ about re-entry.
 *
 * This is a legitimate intent signal rather than a fitted weight: the guide knows
 * which questions are price questions, and it knows which of its own records state a
 * price, because every one of them renders a currency amount. A price question
 * prefers a record that answers it.
 */
const PRICE_INTENT = /\b(?:how much|price|prices|cost|costs|fee|fees|expensive|cheap|worth|charge)\b/i;

const CURRENCY_IN_TEXT = /(?:€|£|R\$)\s?\d/;

/**
 * A Pearl amount, written as a digit or a small word.
 *
 * Cup deposits and refund fees are priced in Pearls, not euros. A price
 * question about them must prefer the chapter that states "one Pearl" over a
 * record that merely shares the word "festival" and carries no figure.
 */
const PEARL_FIGURE = /\b(?:\d[\d.,]*|one|two|three|four|five|six|seven|eight|nine|ten)\s+pearls?\b/i;

/** True when a passage states a currency amount or a Pearl amount. */
function textStatesFigure(text: string): boolean {
  return CURRENCY_IN_TEXT.test(text) || PEARL_FIGURE.test(text);
}

/** How much a record is preferred when it satisfies a price question. */
const PRICE_INTENT_BONUS = 1.6;

/** How much a record is marked down for carrying no figure when one was asked for. */
const NO_PRICE_FACTOR = 0.55;

/** True when a question is asking for a figure. */
export function hasPriceIntent(question: string): boolean {
  return PRICE_INTENT.test(question);
}

/**
 * The edition a question names, or "all" when it names none or names several.
 *
 * The reader's filter defaults to "all editions", and with no inference a question
 * that says "Tomorrowland Belgium" could be answered with a Winter coach fare —
 * because both are shuttle prices in euros and the edition filter was not applied.
 * The reader named the edition; using it is reading the question, not guessing.
 *
 * Naming more than one edition returns "all": a question that compares Belgium and
 * Brasil needs both sets of records, and picking one would make the comparison
 * impossible to answer.
 */
export function inferEdition(question: string): Edition {
  const lower = question.toLowerCase();
  const named: Edition[] = [];
  if (/\bbelgium\b|\bboom\b|\bdreamville\b|\bdeschorre\b|\bde schorre\b|\bbelgian\b/.test(lower)) named.push("belgium");
  if (/\bwinter\b|\balpe\b|\bhuez\b|\bski(?:ing)?\b/.test(lower)) named.push("winter");
  if (/\bbrasil\b|\bbrazil\b|\bmaeda\b|\breais\b|\bs[aã]o paulo\b/.test(lower)) named.push("brasil");
  return named.length === 1 ? (named[0] ?? "all") : "all";
}

/** How much a record scoped to the reader's own edition is worth over a shared one. */
const EDITION_MATCH_BONUS = 1.15;

/**
 * The largest share of a document's evidence any single term may contribute.
 *
 * A third: enough that a rare, decisive word still dominates a weak field, low
 * enough that the ranking needs corroboration. See the note in
 * {@link scoreDocumentWeighted} for the failure this fixes.
 */
const MAX_TERM_SHARE = 0.34;

/**
 * The coverage a record must reach to be used as a passage.
 *
 * A **noise floor**, not a relevance judgement. Coverage is the share of the
 * question's known meaning a record accounts for, and it is comparable across
 * questions, so it is the right instrument for rejecting a record that shares only
 * the festival's name. It is not the right instrument for deciding whether a figure
 * has been published: "how much is a 4-day Winter ticket" uses exactly the
 * vocabulary of the Winter records, and no lexical score can tell that the *answer*
 * is missing when the *subject* is present.
 *
 * That distinction is the architecture: the retriever finds the best material about
 * the subject, and the prompt plus {@link validateAnswer} refuse to state a figure
 * that is not in it. Trying to make a similarity score perform semantic abstention
 * produced measurably worse results in both directions — it dropped the correct
 * ticket record for a question phrased with an injection prefix, and it kept
 * irrelevant records for a question about accessibility.
 *
 * 0.2 is set below every record that answers an evaluation item and above a record
 * matching on brand words alone.
 */
export const MIN_COVERAGE = 0.2;

/**
 * How strongly a passage is penalised for repeating ground an earlier pick covers.
 *
 * 0.75, so a near-duplicate keeps a quarter of its relevance and can still be chosen
 * when there is nothing else — but loses to any reasonable alternative. Higher and a
 * genuinely complementary record with a lower score would be dropped; lower and the
 * same FAQ crowds out the sale window that answers the second half of the question.
 */
const DUPLICATE_PENALTY = 0.75;

/**
 * How good a record kind is as evidence, independent of its words.
 *
 * A lexical score cannot see that the edition-overview record is a two-line date
 * range while a ticket record carries the price the reader asked for. Measured on
 * the evaluation set, the overview records were winning questions about ticket
 * prices purely because their titles contain "Tomorrowland Belgium 2027" and they
 * are short enough for length normalisation to reward them.
 *
 * These multipliers are the judgement that a price, rule or FAQ answer is stronger
 * evidence than a summary line, expressed once rather than by fitting term
 * weights. A community group is the weakest of all: an invite link is never the
 * answer to a factual question, and it must not outrank one.
 */
const KIND_PRIOR: Readonly<Record<ChunkKind, number>> = {
  ticket: 1,
  accommodation: 1,
  "add-on": 1,
  fact: 1,
  faq: 1,
  "sale-window": 1,
  shuttle: 0.9,
  locker: 0.9,
  pearl: 0.9,
  stage: 0.85,
  edition: 0.45,
  resource: 0.6,
  partner: 0.5,
  "community-group": 0.4,
  chapter: 1,
  "food-estimate": 1,
};

/**
 * Scores one document against a query.
 *
 * Exported for the evaluation runner, which reports the score distribution so a
 * floor can be set from evidence rather than guessed.
 */
export function scoreDocument(
  index: Bm25Index,
  document: IndexedChunk,
  queryTerms: readonly string[],
): number {
  const text = queryTerms.join(" ");
  return scoreDocumentWeighted(index, document, expandQuery(text), queryLiterals(text), undefined);
}

/**
 * The scoring core.
 *
 * Four factors multiply together, each catching a failure seen on the evaluation
 * set:
 *
 * 1. **BM25** over title-weighted term frequencies, with IDF, so a rare word
 *    ("Magnificent") counts for more than a common one ("ticket").
 * 2. **IDF-weighted coverage.** The share of the question's *distinctive* meaning
 *    the record accounts for. This is the factor that makes abstention work: a
 *    question about a visa shares only common words ("Belgium", "festival") with
 *    every record, so every coverage score is low, and nothing clears the floor.
 *    An unweighted share would let a record that repeats "Belgium" look like a
 *    match.
 * 3. **Year agreement.** A record naming only wrong years is marked down hard.
 * 4. **Edition agreement.** A record scoped to the reader's edition beats a shared
 *    one at equal relevance.
 */
export function scoreDocumentWeighted(
  index: Bm25Index,
  document: IndexedChunk,
  queryTerms: readonly WeightedTerm[],
  literalTerms: ReadonlyMap<string, number>,
  filterEdition?: Edition,
  hints: ScoreHints = {},
): number {
  const scored = scoreDocumentFull(index, document, queryTerms, literalTerms, filterEdition, hints);
  return scored === null ? 0 : scored.score;
}

interface FullScore {
  readonly score: number;
  readonly coverage: number;
}

/**
 * Extra signals a caller can supply about the question.
 *
 * `priceIntent` says the reader asked for a figure, which lets a record that states one
 * win over a record that merely uses the same words. It is a hint rather than a filter,
 * so no record is excluded outright.
 */
export interface ScoreHints {
  readonly priceIntent?: boolean;
}

/**
 * The scoring core, returning both the ordering score and the coverage ratio.
 *
 * Four factors multiply together, each catching a failure seen on the evaluation
 * set:
 *
 * 1. **BM25** over title-weighted term frequencies, with IDF and a per-term cap, so
 *    no single phrase decides the ranking.
 * 2. **Coverage.** The share of the question's *distinctive* meaning the record
 *    accounts for, squared. Returned separately from the score because it is the
 *    signal the caller can threshold across questions, while the score cannot be.
 * 3. **Year agreement.** A record naming only wrong years is marked down hard.
 * 4. **Edition and kind priors.** A record scoped to the reader's edition beats a
 *    shared one, and a record that carries a price or a rule beats a summary line.
 */
export function scoreDocumentFull(
  index: Bm25Index,
  document: IndexedChunk,
  queryTerms: readonly WeightedTerm[],
  literalTerms: ReadonlyMap<string, number>,
  filterEdition?: Edition,
  hints: ScoreHints = {},
): FullScore | null {
  const average = index.averageLength === 0 ? 1 : index.averageLength;

  let matchedIdf = 0;
  let knownIdf = 0;

  /** Per-term contributions, so no single term can dominate the total. */
  const contributions: number[] = [];

  for (const { term, weight } of queryTerms) {
    const literalWeight = literalTerms.get(term);
    const tf = document.termFrequencies.get(term) ?? 0;

    const idf = inverseDocumentFrequency(index, term);
    const isKnown = (index.documentFrequency.get(term) ?? 0) > 0;

    if (literalWeight !== undefined && isKnown) knownIdf += idf * literalWeight;
    if (tf === 0) continue;
    if (literalWeight !== undefined && isKnown) matchedIdf += idf * literalWeight;

    const normaliser = tf + K1 * (1 - B + (B * document.length) / average);
    contributions.push(idf * weight * ((tf * (K1 + 1)) / normaliser));
  }

  if (contributions.length === 0) return null;

  /*
    No term may contribute more than {@link MAX_TERM_SHARE} of the summed evidence.

    Without this cap one long phrase decides the ranking. "Tomorrowland Belgium
    2027" matches the edition-overview record's title exactly, and that single
    trigram outscored every ticket record for the question "how much is a one-day
    ticket for Tomorrowland Belgium 2027" — the record that answers it never reached
    the model. Capping is a standard smoothing step and it is what makes the ranking
    depend on several pieces of evidence rather than the most literal one.
  */
  const total = contributions.reduce((sum, value) => sum + value, 0);
  const limit = total * MAX_TERM_SHARE;
  const bm25 = contributions.reduce((sum, value) => sum + Math.min(value, limit), 0);

  /*
    Relevance is measured over the terms the corpus actually knows about. Abstention
    is measured separately by {@link unknownQuestionShare}, because the two answer
    different questions: "is this record about the question?" and "is there any
    record about it at all?".
  */
  const coverage = knownIdf === 0 ? 1 : matchedIdf / knownIdf;

  // Squared, so half the meaning is worth a quarter of the score rather than half.
  const coverageFactor = 0.15 + 0.85 * coverage * coverage;

  const years = yearsIn(`${document.chunk.title} ${document.chunk.content}`);
  const askedYears = [...literalTerms.keys()].filter((term) => /^20\d{2}$/.test(term));
  let yearFactor = 1;
  if (askedYears.length > 0) {
    const agreed = askedYears.some((year) => years.has(year));
    if (!agreed && years.size > 0) yearFactor = YEAR_MISMATCH_FACTOR;
  }

  const editionFactor =
    filterEdition !== undefined && filterEdition !== "all" && document.chunk.edition === filterEdition
      ? EDITION_MATCH_BONUS
      : 1;

  const kindFactor = KIND_PRIOR[document.chunk.kind] ?? 1;

  /*
    Price intent. A record that states a figure is the better answer to "how much",
    and a record with no figure is a worse one — but only relatively, because the
    question may still need a rule from a record that carries no price. The markdown
    is a factor rather than a filter so nothing is excluded outright.

    Applied only to records scoped to the reader's edition or shared. A price in
    another edition's currency and context is not an answer to this question: without
    that guard, "what do the airport shuttles cost" pulled a Winter coach fare in euros
    above the Belgium FAQ that says no 2027 fare is published.
  */
  const editionMatches =
    filterEdition === undefined || filterEdition === "all" || document.chunk.edition === "all" || document.chunk.edition === filterEdition;
  const hasFigure = textStatesFigure(`${document.chunk.title} ${document.chunk.content}`);
  const priceFactor =
    hints.priceIntent === true && editionMatches ? (hasFigure ? PRICE_INTENT_BONUS : NO_PRICE_FACTOR) : 1;

  return {
    score: bm25 * coverageFactor * yearFactor * editionFactor * kindFactor * priceFactor,
    coverage,
  };
}

/** Editions a query may draw on, given the reader's filter. */
function editionAllowed(chunkEdition: Edition, filter: Edition | undefined): boolean {
  if (filter === undefined || filter === "all") return true;
  return chunkEdition === "all" || chunkEdition === filter;
}

/**
 * Retrieves the best passages for a question.
 *
 * Deterministic: the same question and the same chunk set always produce the
 * same ordering, with ties broken by chunk id. That is what lets a test assert on
 * ranking and a reviewer reproduce a failure.
 */
/**
 * Retrieves the best passages for a question.
 *
 * Deterministic: the same question and the same chunk set always produce the same
 * ordering, with ties broken by chunk id. That is what lets a test assert on
 * ranking and a reviewer reproduce a failure.
 *
 * Relevance is judged on two scale-free measures rather than a raw BM25 sum:
 * {@link ScoredChunk.coverage}, the share of the question's known meaning the record
 * accounts for, and the presence of the question's distinctive words. A raw sum
 * cannot be thresholded across questions — one question's best score is 1.4 and
 * another's is 40 — so the sum is used only to order the survivors.
 */
export function retrieve(
  query: string,
  options: RetrieveOptions = {},
  chunks: readonly KnowledgeChunk[] = getKnowledgeBase(),
): ScoredChunk[] {
  const limit = Math.max(1, options.limit ?? DEFAULT_TOP_K);
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const minCoverage = options.minCoverage ?? MIN_COVERAGE;
  const literalTerms = queryLiterals(query);
  if (literalTerms.size === 0) return [];

  /*
    The edition to search is the reader's filter, narrowed by the edition the question
    names. A filter of "all editions" plus a question that says "Belgium" must not
    return a Winter fare, and a filter that names an edition always wins over the
    question: the reader chose it deliberately.
  */
  const edition: Edition =
    options.edition === undefined || options.edition === "all" ? inferEdition(query) : options.edition;

  const queryTerms = expandQuery(query);
  const index = chunks === getKnowledgeBase() ? getIndex() : buildIndex(chunks);
  const hints: ScoreHints = { priceIntent: hasPriceIntent(query) };

  const candidates: ScoredChunk[] = [];
  for (const document of index.documents) {
    if (!editionAllowed(document.chunk.edition, edition)) continue;
    const scored = scoreDocumentFull(index, document, queryTerms, literalTerms, edition, hints);
    if (scored === null) continue;
    if (scored.coverage < minCoverage) continue;
    if (scored.score < minScore) continue;
    candidates.push({ chunk: document.chunk, score: scored.score, coverage: scored.coverage });
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.chunk.id.localeCompare(right.chunk.id);
  });

  // Diversify picks, but the picks must still be presented in relevance order: a
  // caller that shows the first passage first must not be given the third-best.
  return diversify(candidates, limit).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.chunk.id.localeCompare(right.chunk.id);
  });
}

/**
 * Picks `limit` passages that cover different ground rather than restating one.
 *
 * The evaluation set showed why this matters: "how many Global Journey packages can
 * one account buy" retrieved four near-identical Global Journey FAQ chunks and cut
 * off the sale-window record that carries the date the question also asks for. Six
 * restatements of one point spend the whole context budget and shrink what the model
 * can know, so the selection is greedy over marginal gain: each pick is scored on its
 * own relevance less a penalty for how much it repeats what is already chosen.
 *
 * Similarity is the Jaccard overlap of title and content tokens. That is cheap,
 * deterministic and adequate here: chunks that say the same thing share most of their
 * vocabulary, and chunks that say different things share almost none.
 */
export function diversify(candidates: readonly ScoredChunk[], limit: number): ScoredChunk[] {
  const selected: ScoredChunk[] = [];
  const remaining = [...candidates];
  const selectedTokens: Set<string>[] = [];

  while (selected.length < limit && remaining.length > 0) {
    let bestIndex = 0;
    let bestValue = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      if (candidate === undefined) continue;
      const tokens = new Set(tokenise(`${candidate.chunk.title} ${candidate.chunk.content}`));

      let overlap = 0;
      for (const chosen of selectedTokens) {
        let shared = 0;
        for (const token of tokens) if (chosen.has(token)) shared += 1;
        const union = tokens.size + chosen.size - shared;
        if (union > 0) overlap = Math.max(overlap, shared / union);
      }

      // The penalty is a multiplier, so a genuinely more relevant record can still
      // win; it only loses when a near-duplicate would otherwise crowd it out.
      const value = candidate.score * (1 - DUPLICATE_PENALTY * overlap);
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    if (chosen === undefined) break;
    selected.push(chosen);
    selectedTokens.push(new Set(tokenise(`${chosen.chunk.title} ${chosen.chunk.content}`)));
  }

  return selected;
}

/** Highest score a question can reach in the current index, for diagnostics. */
export function bestScore(query: string, options: RetrieveOptions = {}): number {
  const results = retrieve(query, { ...options, limit: 1, minScore: 0 });
  return results[0]?.score ?? 0;
}

/**
 * The share of a question's distinctive words that does not appear anywhere in the
 * knowledge base.
 *
 * **Exposed for diagnostics and for the out-of-scope copy, not as a gate.** Measured
 * on the evaluation set it separates cleanly for questions that name a subject the
 * guide has never covered (Thailand, a visa) but not at all for questions that use
 * the guide's own vocabulary to ask for an unpublished figure ("how much is a 4-day
 * Winter ticket"). A gate on it would refuse the second group, which is the whole
 * subject of the guide, and it would pass the injection items, which use ordinary
 * words. Abstention therefore lives in the prompt and the answer validator.
 */
export function unknownQuestionShare(
  query: string,
  chunks: readonly KnowledgeChunk[] = getKnowledgeBase(),
): number {
  const index = chunks === getKnowledgeBase() ? getIndex() : buildIndex(chunks);
  const literals = tokenise(query);
  if (literals.length === 0) return 1;

  let total = 0;
  let unknown = 0;
  for (const term of new Set(literals)) {
    const idf = inverseDocumentFrequency(index, term);
    total += idf;
    if ((index.documentFrequency.get(term) ?? 0) === 0) unknown += idf;
  }

  return total === 0 ? 1 : unknown / total;
}

/* -------------------------------------------------------------------------- */
/* Optional pgvector retrieval                                                 */
/* -------------------------------------------------------------------------- */

export interface VectorConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly rpcName: string;
  readonly embeddingEndpoint: string;
  readonly embeddingApiKey: string;
  readonly embeddingModel: string;
}

export const DEFAULT_MATCH_RPC = "match_tmlguide_chunks";
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export interface VectorEnv {
  readonly SUPABASE_URL?: string | undefined;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
  readonly AI_EMBEDDING_ENDPOINT?: string | undefined;
  readonly AI_EMBEDDING_API_KEY?: string | undefined;
  readonly AI_EMBEDDING_MODEL?: string | undefined;
  readonly AI_MATCH_RPC?: string | undefined;
  readonly [key: string]: string | undefined;
}

/**
 * Reads the optional vector configuration.
 *
 * All of it or none of it. A half-configured store is worse than none: it would
 * appear in the health output as working while silently falling back on every
 * request. The embedding endpoint is required because pgvector matches vectors,
 * and inventing an embedding locally would return confident nonsense.
 */
export function readVectorConfig(env: VectorEnv = process.env): VectorConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const embeddingEndpoint = env.AI_EMBEDDING_ENDPOINT?.trim();
  const embeddingApiKey = env.AI_EMBEDDING_API_KEY?.trim();
  if (!url || !serviceRoleKey || !embeddingEndpoint || !embeddingApiKey) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return null;
    }
  } catch {
    return null;
  }

  return {
    url: url.replace(/\/+$/, ""),
    serviceRoleKey,
    rpcName: env.AI_MATCH_RPC?.trim() || DEFAULT_MATCH_RPC,
    embeddingEndpoint,
    embeddingApiKey,
    embeddingModel: env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
  };
}

export interface VectorRetriever {
  readonly kind: "pgvector";
  /**
   * Returns scored chunks, or `null` when the store could not answer.
   *
   * `null` rather than `[]`: an empty array would look like a confident "nothing
   * matches" and the route would refuse, when the correct behaviour is to fall
   * back to the lexical retriever that is known to work.
   */
  retrieve(query: string, options: RetrieveOptions): Promise<ScoredChunk[] | null>;
}

interface VectorRow {
  readonly chunk_id?: unknown;
  readonly similarity?: unknown;
  readonly score?: unknown;
}

/**
 * Builds the pgvector retriever.
 *
 * The RPC is expected to accept `{ query_embedding, match_threshold,
 * match_count, filter_edition }` and return rows of `{ chunk_id, similarity }`.
 * Whatever it returns is resolved through `getChunkById`, so a row naming a chunk
 * that no longer exists — a stale index after a data change — is dropped rather
 * than rendered as a citation to nothing.
 */
export function createVectorRetriever(
  config: VectorConfig,
  deps: { readonly fetchImpl?: typeof fetch; readonly timeoutMs?: number } = {},
): VectorRetriever {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const timeoutMs = deps.timeoutMs ?? 4000;

  return {
    kind: "pgvector",

    async retrieve(query, options): Promise<ScoredChunk[] | null> {
      const limit = Math.max(1, options.limit ?? DEFAULT_TOP_K);
      const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

      try {
        const embeddingResponse = await fetchImpl(config.embeddingEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.embeddingApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: config.embeddingModel, input: query }),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
        if (!embeddingResponse.ok) return null;

        const embeddingBody: unknown = await embeddingResponse.json();
        const vector = readEmbedding(embeddingBody);
        if (vector === null) return null;

        const rpcResponse = await fetchImpl(`${config.url}/rest/v1/rpc/${config.rpcName}`, {
          method: "POST",
          headers: {
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query_embedding: vector,
            match_threshold: 0,
            match_count: limit * 2,
            filter_edition: options.edition ?? null,
          }),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
        if (!rpcResponse.ok) return null;

        const rows: unknown = await rpcResponse.json();
        if (!Array.isArray(rows)) return null;

        const resolved: ScoredChunk[] = [];
        for (const row of rows as VectorRow[]) {
          if (typeof row.chunk_id !== "string") continue;
          const entry = getChunkById(row.chunk_id);
          if (entry === undefined) continue;
          if (!editionAllowed(entry.edition, options.edition)) continue;
          const similarity = Number(row.similarity ?? row.score);
          if (!Number.isFinite(similarity)) continue;
          /*
            pgvector similarity is a cosine score in 0..1, on a different scale from the
            lexical sum, so the caller's lexical floor is not applied to it and the row
            count does the limiting. `coverage` carries the similarity, because for a
            vector hit that *is* the measure of how much of the question it accounts for.
          */
          resolved.push({ chunk: entry, score: similarity, coverage: similarity });
          if (resolved.length >= limit) break;
        }

        if (resolved.length === 0) return null;
        // `minScore` is deliberately not applied: a cosine score is not an
        // inverse-document-frequency sum, and comparing them would reject every
        // good vector hit. Ranking is the store's job; the passage set is still
        // only ever verified records.
        void minScore;
        return resolved;
      } catch {
        return null;
      }
    },
  };
}

function readEmbedding(body: unknown): number[] | null {
  if (typeof body !== "object" || body === null) return null;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  if (typeof first !== "object" || first === null) return null;
  const embedding = (first as { embedding?: unknown }).embedding;
  if (!Array.isArray(embedding)) return null;
  const vector = embedding.map((value) => Number(value));
  if (vector.some((value) => !Number.isFinite(value))) return null;
  return vector;
}
