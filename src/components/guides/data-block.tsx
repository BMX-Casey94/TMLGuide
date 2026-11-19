import { belgiumData } from "@/data/belgium";
import { brasilData, type BrasilTicket } from "@/data/brasil";
import { winterData } from "@/data/winter";
import type {
  AddOn,
  Accommodation,
  Faq,
  SaleWindow,
  Shuttle,
  Stage,
  StageKind,
  TicketPackage,
} from "@/data/schemas";
import {
  formatCheckedDate,
  formatEuroAmount,
  formatMomentInUkTime,
  formatMomentInZone,
  formatReaisAmount,
  statusAsAt,
} from "./format";
import "./guides.css";

/**
 * Rows rendered from the verified data files.
 *
 * A guide chapter never types a price. It names a collection (`tickets`,
 * `accommodation`, `sale-windows`, `add-ons`, `faqs`, `stages`, `shuttles`), an
 * edition and optionally an id prefix, and this module reads the already-validated
 * records. The edition and the collection are enums in the content schema, so a
 * typo in a chapter cannot reach here; a prefix that matches nothing renders a
 * plain notice instead of an empty table.
 */

/** Collections priced in a currency and rendered as one row per product. */
export type PricedCollection = "tickets" | "accommodation" | "sale-windows" | "add-ons" | "faqs";
/** Collections describing a physical thing rather than a price. */
export type CatalogueCollection = "stages" | "shuttles";
export type DataCollection = PricedCollection | CatalogueCollection;
export type DataEdition = "belgium" | "winter" | "brasil";

export interface DataRow {
  readonly id: string;
  /** The record's own name, used in the source link's accessible name. */
  readonly label: string;
  readonly cells: readonly string[];
  /**
   * Text belonging to the record itself that must be read with the cell at
   * `cellIndex`, never apart from it. The shuttle records carry the operator's
   * own fare conditions here, and for the Altibus Geneva record that includes the
   * statement that the route did not run, so the note is rendered inside the
   * price cell rather than in a separate column a reader could scroll past.
   */
  readonly notes?: { readonly text: string; readonly cellIndex: number };
  /** The official page this record was read from. */
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  readonly checkedOn: string;
}

export interface DataTable {
  readonly collection: DataCollection;
  readonly edition: DataEdition;
  /** Column headers, in the same order as each row's cells. */
  readonly columns: readonly string[];
  readonly rows: readonly DataRow[];
  /** True when no row matched the filter. */
  readonly empty: boolean;
  /** True when the edition has no records for this collection at all. */
  readonly collectionEmpty: boolean;
  /** True when this edition keeps the collection in a shape this table cannot read. */
  readonly unsupported: boolean;
}

/** The year every price in these collections belongs to. */
export const PRICE_YEAR = 2027;

const NOT_PUBLISHED = "Price not published yet";

export interface DataBlockFilter {
  readonly edition: DataEdition;
  readonly collection: DataCollection;
  /** Optional exact-prefix filter on the record id. */
  readonly idPrefix?: string;
}

function matchesPrefix(id: string, prefix: string | undefined): boolean {
  if (prefix === undefined || prefix.length === 0) return true;
  return id.startsWith(prefix);
}

/* ---------------------------------------------------------------------------
 * Belgium and Winter: euros, shared ticket and accommodation schemas
 * ------------------------------------------------------------------------- */

function belgiumWinterTickets(records: readonly TicketPackage[]): DataRow[] {
  return records.map((record) => ({
    id: record.id,
    label: record.name,
    cells: [
      record.name,
      `${formatEuroAmount(record.priceEur)} (${PRICE_YEAR})`,
      record.includes.join("; "),
    ],
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

const ACCOMMODATION_KIND_LABELS: Readonly<Record<Accommodation["kind"], string>> = {
  "dreamville-tent": "DreamVille tent",
  "dreamville-lodge": "DreamVille lodge",
  hotel: "Hotel",
  camping: "Camping",
  other: "Other",
};

function belgiumWinterAccommodation(records: readonly Accommodation[]): DataRow[] {
  return records.map((record) => ({
    id: record.id,
    label: record.name,
    cells: [
      record.name,
      formatEuroAmount(record.nightlyOrTotalEur),
      record.pricing === "per-night" ? "Per night" : "Whole stay",
      `${record.capacity} ${record.capacity === 1 ? "person" : "people"}`,
      ACCOMMODATION_KIND_LABELS[record.kind],
    ],
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

function belgiumWinterAddOns(records: readonly AddOn[]): DataRow[] {
  return records.map((record) => ({
    id: record.id,
    label: record.name,
    cells: [record.name, formatEuroAmount(record.priceEur), record.category],
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

function saleWindowRows(records: readonly SaleWindow[]): DataRow[] {
  return records.map((record) => {
    const local = formatMomentInZone(record.opensAt, record.timeZone);
    const uk = formatMomentInUkTime(record.opensAt);
    const status = statusAsAt(record.opensAt, record.lastVerified);
    return {
      id: record.id,
      label: record.name,
      cells: [
        record.name,
        local,
        uk,
        record.audience,
        status === "past" ? "Opened before this check" : "Still to come",
      ],
      sourceUrl: record.source.url,
      sourceTitle: record.source.title,
      checkedOn: record.lastVerified,
    };
  });
}

function faqRows(records: readonly Faq[]): DataRow[] {
  return records.map((record) => ({
    id: record.id,
    label: record.question,
    cells: [record.question, shortAnswer(record.answer)],
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

/**
 * The first sentence of an FAQ answer, as plain text.
 *
 * The stored answer is Markdown source; a table cell cannot carry paragraphs, so
 * emphasis markers are stripped and the answer is cut at the first sentence end.
 */
export function shortAnswer(answer: string): string {
  const flat = answer
    .replace(/\r?\n+/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const sentenceEnd = /[.!?](\s|$)/g;
  sentenceEnd.lastIndex = 0;
  const first = sentenceEnd.exec(flat);
  const sentence = first === null ? flat : flat.slice(0, first.index + 1);
  return sentence.length > 220 ? `${sentence.slice(0, 217).trimEnd()}…` : sentence;
}

/* ---------------------------------------------------------------------------
 * Winter and Belgium: stages and shuttles, the shared catalogue schemas
 * ------------------------------------------------------------------------- */

const STAGE_KIND_LABELS: Readonly<Record<StageKind, string>> = {
  mainstage: "Main stage",
  "open-air": "Open air",
  indoor: "Indoor",
  club: "Club",
  experience: "Experience",
  other: "Other",
};

/**
 * A marker for a record the data does not class as official.
 *
 * `common.ts` is explicit that an unverified record must not be presented as
 * confirmed, and a table cell reads as confirmed whatever the data says. Every
 * record in both catalogue collections is official today, so this renders
 * nothing; it exists so a future community-sourced or unverified record cannot
 * slip into a table looking like the rest.
 */
export function confidenceMarker(confidence: string): string | null {
  if (confidence === "official") return null;
  return confidence === "community" ? "community-sourced" : "unverified";
}

/** "Name" for an official record, "Name (unverified)" otherwise. */
function withConfidence(name: string, confidence: string): string {
  const marker = confidenceMarker(confidence);
  return marker === null ? name : `${name} (${marker})`;
}

/**
 * Columns for the two catalogue collections.
 *
 * The shuttle price header names the season rather than a calendar year, because
 * these are the operators' 2026–27 season fares, the season that contains the
 * March 2027 festival, not prices published for the festival year.
 */
const CATALOGUE_COLUMNS: Readonly<Record<CatalogueCollection, readonly string[]>> = {
  stages: ["Stage", "Kind", "What the official page says"],
  shuttles: ["Route", "Operator", "Direction", "Price (2026–27 season)"],
};

function stageRows(records: readonly Stage[]): DataRow[] {
  return records.map((record) => ({
    id: record.id,
    label: record.name,
    /* The description is the record's own wording, so a stage with no published
       structure reads here exactly as the official page leaves it. */
    cells: [
      withConfidence(record.name, record.confidence),
      STAGE_KIND_LABELS[record.kind],
      record.description,
    ],
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

/**
 * The direction a shuttle record describes.
 *
 * The shared schema has no direction field, so this reads the word the record
 * itself uses in its name ("single", "return") and falls back to the id suffix
 * the same records carry. A record that states neither is labelled "Not stated"
 * rather than guessed.
 */
export function shuttleDirection(record: Pick<Shuttle, "id" | "name">): "Single" | "Return" | "Not stated" {
  const lowerName = record.name.toLowerCase();
  if (/\breturn\b/.test(lowerName)) return "Return";
  if (/\bsingle\b/.test(lowerName)) return "Single";
  const lowerId = record.id.toLowerCase();
  if (lowerId.endsWith("-return")) return "Return";
  if (lowerId.endsWith("-single")) return "Single";
  return "Not stated";
}

/**
 * The index of the price cell, taken from the column list itself so adding or
 * reordering a column cannot silently detach a note from its figure.
 */
function shuttlePriceCell(): number {
  const index = CATALOGUE_COLUMNS.shuttles.findIndex((column) => column.startsWith("Price"));
  if (index < 0) throw new Error("the shuttle column list has no price column");
  return index;
}

function shuttleRows(records: readonly Shuttle[]): DataRow[] {
  const priceCell = shuttlePriceCell();
  return records.map((record) => ({
    id: record.id,
    label: record.name,
    cells: [
      withConfidence(record.route, record.confidence),
      record.operator,
      shuttleDirection(record),
      formatEuroAmount(record.priceEur),
    ],
    /* The record's own notes sit in the price cell, not in a column of their
       own: the Altibus Geneva note states that the route did not run, and a
       reader must never see that fare without it. */
    notes: { text: record.notes, cellIndex: priceCell },
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

/* ---------------------------------------------------------------------------
 * Brasil: reais, its own record types
 * ------------------------------------------------------------------------- */

const BRASIL_VARIANT_LABELS: Readonly<Record<BrasilTicket["variant"], string>> = {
  standard: "Standard",
  "half-price": "Half-price (meia-entrada)",
  social: "Social",
  "bybit-early-bird": "Bybit early bird",
  "bybit-early-bird-half-price": "Bybit early bird, half-price",
  "bybit-early-bird-social": "Bybit early bird, social",
};

function brasilTickets(): DataRow[] {
  return brasilData.tickets.map((record) => ({
    id: record.id,
    label: record.name,
    cells: [
      record.name,
      formatReaisAmount(record.price.amount),
      `${record.validDays} ${record.validDays === 1 ? "day" : "days"}`,
      BRASIL_VARIANT_LABELS[record.variant],
      record.availability === "sold-out" ? "Sold out" : "On sale",
    ],
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

function brasilAccommodation(): DataRow[] {
  return brasilData.dreamvillePackages.map((record) => ({
    id: record.id,
    label: record.name,
    cells: [
      record.name,
      formatReaisAmount(record.price.amount),
      `${record.capacity} ${record.capacity === 1 ? "person" : "people"}`,
      record.tier === "no1" ? "N°1" : record.tier === "comfort" ? "Comfort" : "Standard",
      record.availability === "sold-out" ? "Sold out" : "On sale",
    ],
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

function brasilSaleWindows(): DataRow[] {
  return brasilData.saleWindows.map((record) => ({
    id: record.id,
    label: record.name,
    cells: [
      record.name,
      formatMomentInZone(record.opensAt, record.timeZone),
      formatMomentInUkTime(record.opensAt),
      record.audience,
      record.status === "past" ? "Past" : record.status === "open" ? "Open" : "Upcoming",
    ],
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

function brasilAddOns(): DataRow[] {
  /* Brasil publishes shuttle products rather than a priced add-on catalogue; the
     two shuttle records are the only products the 2027 add-on shop listed. */
  return brasilData.shuttles.map((record) => ({
    id: record.id,
    label: record.name,
    cells: [record.name, record.departureCities.join(", "), NOT_PUBLISHED],
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

function brasilFaqs(): DataRow[] {
  /* Brasil publishes statements rather than question-and-answer entries, so the
     FAQ collection renders those facts as question-free rows. */
  return brasilData.facts.map((record) => ({
    id: record.id,
    label: record.topic,
    cells: [record.topic, record.statement],
    sourceUrl: record.source.url,
    sourceTitle: record.source.title,
    checkedOn: record.lastVerified,
  }));
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */

const BRASIL_COLUMNS: Readonly<Record<PricedCollection, readonly string[]>> = {
  tickets: ["Ticket", "Price (2027)", "Valid for", "Variant", "Availability"],
  accommodation: ["Package", "Price (2027)", "Sleeps", "Tier", "Availability"],
  "sale-windows": ["Sale", "Opens (festival time)", "Opens (UK time)", "Who can buy", "Status"],
  "add-ons": ["Product", "Departure cities", "Price (2027)"],
  faqs: ["Topic", "What the data records"],
};

const EURO_COLUMNS: Readonly<Record<PricedCollection, readonly string[]>> = {
  tickets: ["Ticket", "Price (2027)", "Included"],
  accommodation: ["Package", "Price (2027)", "Priced", "Sleeps", "Type"],
  "sale-windows": ["Sale", "Opens (festival time)", "Opens (UK time)", "Who can buy", "Status"],
  "add-ons": ["Add-on", "Price (2027)", "Category"],
  faqs: ["Question", "Answer"],
};

/** True when the edition keeps this collection in a shape this table cannot read. */
export function isUnsupportedCollection(
  edition: DataEdition,
  collection: DataCollection,
): boolean {
  /* Brasil's transfers live in `src/data/brasil/facts.ts` with their own types and
     reais amounts, and Brasil publishes no stage records. Neither collection can
     be read through the shared stage and shuttle schemas, so the block says so
     rather than printing a table that would misdescribe the data. */
  return edition === "brasil" && (collection === "stages" || collection === "shuttles");
}

function catalogueRecords(edition: DataEdition, collection: "stages"): readonly Stage[];
function catalogueRecords(edition: DataEdition, collection: "shuttles"): readonly Shuttle[];
function catalogueRecords(
  edition: DataEdition,
  collection: CatalogueCollection,
): readonly (Stage | Shuttle)[] {
  /* Brasil never reaches here: `isUnsupportedCollection` short-circuits first, and
     its stage and shuttle records use their own types in `src/data/brasil/facts.ts`. */
  const dataset = edition === "belgium" ? belgiumData : winterData;
  return collection === "stages" ? dataset.stages : dataset.shuttles;
}

function catalogueRows(edition: DataEdition, collection: CatalogueCollection): DataRow[] {
  return collection === "stages"
    ? stageRows(catalogueRecords(edition, "stages"))
    : shuttleRows(catalogueRecords(edition, "shuttles"));
}

/**
 * Builds the table a `data` block renders.
 *
 * The filter is applied by id prefix. A prefix that matches no record leaves
 * `rows` empty and sets `empty`, which is what the renderer shows as a plain
 * notice; `collectionEmpty` says whether the edition holds no records for the
 * whole collection, so the notice can be accurate rather than blame the prefix.
 */
export function buildDataTable(filter: DataBlockFilter): DataTable {
  const { edition, collection } = filter;

  if (isUnsupportedCollection(edition, collection)) {
    return {
      collection,
      edition,
      columns: [],
      rows: [],
      empty: true,
      collectionEmpty: true,
      unsupported: true,
    };
  }

  let allRows: DataRow[];
  let columns: readonly string[];
  if (collection === "stages" || collection === "shuttles") {
    columns = CATALOGUE_COLUMNS[collection];
    allRows = catalogueRows(edition, collection);
  } else if (edition === "brasil") {
    columns = BRASIL_COLUMNS[collection];
    switch (collection) {
      case "tickets":
        allRows = brasilTickets();
        break;
      case "accommodation":
        allRows = brasilAccommodation();
        break;
      case "sale-windows":
        allRows = brasilSaleWindows();
        break;
      case "add-ons":
        allRows = brasilAddOns();
        break;
      case "faqs":
        allRows = brasilFaqs();
        break;
    }
  } else if (edition === "belgium") {
    columns = EURO_COLUMNS[collection];
    switch (collection) {
      case "tickets":
        allRows = belgiumWinterTickets(belgiumData.tickets);
        break;
      case "accommodation":
        allRows = belgiumWinterAccommodation(belgiumData.accommodation);
        break;
      case "sale-windows":
        allRows = saleWindowRows(belgiumData.saleWindows);
        break;
      case "add-ons":
        allRows = belgiumWinterAddOns(belgiumData.addOns);
        break;
      case "faqs":
        allRows = faqRows(belgiumData.faqs);
        break;
    }
  } else {
    columns = EURO_COLUMNS[collection];
    switch (collection) {
      case "tickets":
        allRows = belgiumWinterTickets(winterData.tickets);
        break;
      case "accommodation":
        allRows = belgiumWinterAccommodation(winterData.accommodation);
        break;
      case "sale-windows":
        allRows = saleWindowRows(winterData.saleWindows);
        break;
      case "add-ons":
        allRows = belgiumWinterAddOns(winterData.addOns);
        break;
      case "faqs":
        allRows = faqRows(winterData.faqs);
        break;
    }
  }

  const filtered = allRows.filter((row) => matchesPrefix(row.id, filter.idPrefix));
  return {
    collection,
    edition,
    columns,
    rows: filtered,
    empty: filtered.length === 0,
    collectionEmpty: allRows.length === 0,
    unsupported: false,
  };
}

/** The records one `data` block resolves to, for tests and for the empty-state copy. */
export function dataRowCount(filter: DataBlockFilter): number {
  return buildDataTable(filter).rows.length;
}

export interface DataBlockProps {
  readonly edition: DataEdition;
  readonly collection: DataCollection;
  readonly idPrefix?: string;
  /** The block's own caption, used as the table's `<caption>`. */
  readonly caption: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The noun a notice uses for a collection, so the copy reads as English. */
const COLLECTION_NOUNS: Readonly<Record<DataCollection, string>> = {
  tickets: "ticket",
  accommodation: "accommodation",
  "sale-windows": "sale window",
  "add-ons": "add-on",
  faqs: "FAQ",
  stages: "stage",
  shuttles: "shuttle",
};

/** The edition as a reader would write it, for the notices below. */
const EDITION_NAMES: Readonly<Record<DataEdition, string>> = {
  belgium: "Belgium",
  winter: "Winter",
  brasil: "Brasil",
};

/**
 * The notice a block shows instead of a table.
 *
 * Three different situations must not read as one. A Brasil stage or shuttle
 * block names a collection that edition keeps in its own record types, so the
 * block says the table cannot read it. A collection the edition holds no records
 * for says exactly that. A prefix that matched nothing says the prefix matched
 * nothing. In every case the alternative would be a table that implies a figure
 * or a record the data does not hold.
 */
function EmptyNotice({
  edition,
  collection,
  idPrefix,
  unsupported,
  collectionEmpty,
}: {
  edition: DataEdition;
  collection: DataCollection;
  idPrefix: string | undefined;
  unsupported: boolean;
  collectionEmpty: boolean;
}) {
  const noun = COLLECTION_NOUNS[collection];
  const editionName = EDITION_NAMES[edition];

  if (unsupported) {
    return (
      <div className="tml-guide-data__empty" role="note">
        <p className="tml-guide-data__empty-title">Not available as a table</p>
        <p>
          This table reads the shared {collection} records that Belgium and Winter use. Brasil does
          not publish its {collection} in that form, so no {collection} table is shown for the Brasil
          edition. Whatever the official pages do state about them is set out in the chapter text
          with its own source.
        </p>
      </div>
    );
  }

  if (collectionEmpty) {
    return (
      <div className="tml-guide-data__empty" role="note">
        <p className="tml-guide-data__empty-title">No checked {noun} records for this edition</p>
        <p>
          The {editionName} data holds no {collection} records. No official page publishes one that
          this site can cite, so the table is left out rather than filled with a figure from another
          season.
        </p>
      </div>
    );
  }

  return (
    <div className="tml-guide-data__empty" role="note">
      <p className="tml-guide-data__empty-title">No checked records for this section yet</p>
      <p>
        The data behind this block has no entry matching{" "}
        <code className="tml-guide-code">{idPrefix ?? "(all records)"}</code> for {editionName}.
        Rather than print a figure this site cannot cite, the table is left out until the official
        page publishes one.
      </p>
    </div>
  );
}

/**
 * A compact responsive table of verified records.
 *
 * Every row links its own source, so a reader can check the figure the page
 * printed. The check date under the table is the oldest in the set, because the
 * table as a whole is only as current as its stalest row.
 */
export function DataBlock({ edition, collection, idPrefix, caption }: DataBlockProps) {
  const table = buildDataTable({ edition, collection, ...(idPrefix === undefined ? {} : { idPrefix }) });

  if (table.empty) {
    return (
      <EmptyNotice
        edition={edition}
        collection={collection}
        idPrefix={idPrefix}
        unsupported={table.unsupported}
        collectionEmpty={table.collectionEmpty}
      />
    );
  }

  const checkedDates = table.rows.map((row) => row.checkedOn).sort();
  const oldestChecked = checkedDates[0] ?? null;
  const checkedLabel = oldestChecked === null ? null : formatCheckedDate(oldestChecked);
  /* Notes exist in a shuttle table, and the footer has to say what they are: the
     reader needs to know the caveat is the operator's wording, not this site's. */
  const hasNotes = table.rows.some((row) => row.notes !== undefined);

  return (
    <div className="tml-guide-data">
      <div className="tml-guide-data__scroll">
        <table className="tml-guide-table">
          <caption className="tml-guide-table__caption">{caption}</caption>
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
              {/* The body gives every row a source cell, so the header needs a
                  matching column: a table whose rows are wider than its header is
                  ambiguous to a screen reader, which associates the extra cell with
                  no column. The facts block already labels this column. */}
              <th scope="col" className="tml-guide-table__source">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, index) => {
                  /* Notes belong to one cell and are rendered inside it, so the
                     record's own caveat cannot be separated from its figure. */
                  const notes = row.notes?.cellIndex === index ? row.notes.text : null;
                  const content =
                    notes === null ? (
                      cell
                    ) : (
                      <>
                        {cell}
                        <span className="tml-guide-data__note">{notes}</span>
                      </>
                    );
                  return index === 0 ? (
                    <th key={`${row.id}-${index}`} scope="row">
                      {content}
                    </th>
                  ) : (
                    <td key={`${row.id}-${index}`}>{content}</td>
                  );
                })}
                <td className="tml-guide-table__source">
                  {/* The visible text is the host, which is short enough to sit in
                      a narrow column; the record's own source title is carried in
                      the accessible name so the link is unambiguous out of
                      context. */}
                  <a
                    href={row.sourceUrl}
                    rel="noopener noreferrer"
                    className="tml-guide-link"
                    aria-label={`Source for ${row.label}: ${row.sourceTitle}`}
                  >
                    {hostOf(row.sourceUrl)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="tml-guide-data__foot">
        <span className="label">Source</span> Every row links the official page it was read from.
        {hasNotes ? " Notes are the operator's own wording, shown with the record they qualify." : null}
        {checkedLabel === null ? null : (
          <>
            {" "}
            All records checked <time dateTime={oldestChecked ?? undefined}>{checkedLabel}</time>.
          </>
        )}
      </p>
    </div>
  );
}

/** Kept for the tickets explorer link the hub uses. */
export const TICKETS_EXPLORER_HREF = "/guides/tickets";
