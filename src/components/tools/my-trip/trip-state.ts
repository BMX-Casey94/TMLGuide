import { z } from "zod";
import { toolEditionSchema, type ToolEdition } from "../editions";
import type { StorageLike } from "../state";

/**
 * The saved trip sheet: its shape, its version, and every way it can be read or
 * written.
 *
 * A trip sheet lives in exactly one place, `localStorage` under
 * {@link TRIP_STORAGE_KEY}, and there is no account, no cookie and no network
 * call anywhere in this module. That means every byte read here came from a
 * browser this code does not control: a previous version of the page, another
 * tab on the same origin, a reader with a developer console open, or a file a
 * reader hand-edited before importing it.
 *
 * Two reading paths, deliberately different:
 *
 * - {@link readTripState} reads stored state **field by field**, so one bad
 *   value costs that value rather than the whole sheet. A reader who typed a
 *   long note in a build that allowed 400 characters keeps it, truncated.
 * - {@link parseTripImport} reads an imported file **strictly**: every field is
 *   required, unknown fields are refused, and one bad value rejects the file.
 *   A partial import would leave a sheet that looks complete but is not.
 *
 * Neither path throws. Storage can be absent (private mode), block reads
 * (`getItem` throws when site data is blocked) or refuse writes (quota), and a
 * failed write is reported to the caller so the page can say so rather than
 * claim the trip is safe.
 */

/** The one place a trip sheet is stored. */
export const TRIP_STORAGE_KEY = "tml-my-trip-v1";

/** The version stamped on a stored record, and on an exported file. */
export const TRIP_STATE_VERSION = 1;

/** Identifies an exported file as this tool's, so another tool's JSON is refused. */
export const TRIP_EXPORT_APP = "tmlguide";
export const TRIP_EXPORT_TOOL = "my-trip";

/** Every free-text field is capped at this many characters. */
export const FREE_TEXT_MAX = 200;

export const MIN_PARTY_SIZE = 1;
export const MAX_PARTY_SIZE = 20;

/**
 * The largest record this tool will store or read, in characters.
 *
 * Three 200-character notes plus identifiers and keys come to roughly 1 KB, so
 * 8 KB is generous. The cap exists because reading a multi-megabyte string out
 * of storage on every page load would freeze the tab, and because a value that
 * large never came from this page.
 */
export const MAX_STORED_CHARACTERS = 8_000;

/** The largest file this tool will read on import, in bytes (covers HTML and JSON exports). */
export const MAX_IMPORT_BYTES = 65_536;

/** The fields of a sheet, for repair messages and test assertions. */
export type TripField =
  | "edition"
  | "slotId"
  | "ticketId"
  | "packageId"
  | "partySize"
  | "accommodationNote"
  | "travelNote"
  | "notes";

/** How each field is named to a reader when something about it is wrong. */
export const TRIP_FIELD_LABEL: Readonly<Record<TripField, string>> = {
  edition: "edition",
  slotId: "weekend",
  ticketId: "ticket",
  packageId: "accommodation package",
  partySize: "party size",
  accommodationNote: "accommodation note",
  travelNote: "travel note",
  notes: "notes",
};

/**
 * One sheet.
 *
 * `slotId`, `ticketId` and `packageId` are ids from the validated data layer,
 * never names: a name shown in the file would go stale the moment the
 * organisers renamed a product, while an id can be checked against the data and
 * reported as unknown.
 *
 * `null` means "nothing chosen", which is different from the empty string: the
 * sheet starts with nothing chosen, and that is a truthful state to show.
 */
export interface TripState {
  readonly version: number;
  readonly edition: ToolEdition;
  /** A dated weekend or week from the shared editions overview. */
  readonly slotId: string | null;
  /** A ticket product the edition publishes. */
  readonly ticketId: string | null;
  /** A verified accommodation package the edition publishes. */
  readonly packageId: string | null;
  readonly accommodationNote: string;
  readonly travelNote: string;
  readonly partySize: number;
  readonly notes: string;
}

/** A first visit: the edition asked for, and nothing chosen yet. */
export function defaultTripState(edition: ToolEdition = "belgium"): TripState {
  return {
    version: TRIP_STATE_VERSION,
    edition,
    slotId: null,
    ticketId: null,
    packageId: null,
    accommodationNote: "",
    travelNote: "",
    partySize: MIN_PARTY_SIZE,
    notes: "",
  };
}

/** Serialises a sheet exactly as it is stored, so a caller can compare snapshots. */
export function serialiseTripState(state: TripState): string {
  return JSON.stringify(state);
}

/* ---------------------------------------------------------------------------------------------
 * Reading stored state
 * ------------------------------------------------------------------------------------------- */

/**
 * The outcome of reading storage.
 *
 * `discarded` means a value was there and could not be used at all (not JSON, a
 * record from a newer version, or something absurdly long). `repaired` lists the
 * individual fields that were replaced inside an otherwise usable record. The
 * page distinguishes the two so a reader is told what happened rather than
 * finding their answers silently missing.
 */
export interface TripReadResult {
  readonly state: TripState;
  readonly origin: "storage" | "default";
  readonly repaired: readonly TripField[];
  readonly discarded: boolean;
}

/** The result of a write, so the page can report a refusal instead of pretending. */
export type TripSaveResult = "saved" | "refused" | "too-large" | "no-storage";

export interface TripMigration {
  /** The record to read fields from. */
  readonly value: Record<string, unknown>;
  /** The version it carried, or null when it carried none. */
  readonly fromVersion: number | null;
  /** True when the record came from a build newer than this one. */
  readonly tooNew: boolean;
}

/**
 * Brings a stored record up to the current version.
 *
 * Version 1 is the first release, so the only real work is to accept a record
 * that carries no version stamp at all and to refuse one from a newer build. A
 * record from a newer build is refused rather than guessed at: a future version
 * may give a field a different meaning, and reading it under today's rules
 * could show a reader a trip they never planned.
 *
 * When version 2 arrives, its field changes belong here, in the case for
 * version 1. Nothing else in the module needs to change.
 */
export function migrateTripState(raw: unknown): TripMigration {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { value: {}, fromVersion: null, tooNew: false };
  }

  const record = raw as Record<string, unknown>;
  const version =
    typeof record.version === "number" && Number.isInteger(record.version) ? record.version : null;

  if (version !== null && version > TRIP_STATE_VERSION) {
    return { value: record, fromVersion: version, tooNew: true };
  }

  switch (version) {
    case null:
    case 0:
      // No stamp: the sheet was written before versioning, which for this tool
      // means the version 1 field names. Stamping it makes the next write clear.
      return { value: { ...record, version: TRIP_STATE_VERSION }, fromVersion: version, tooNew: false };
    default:
      return { value: record, fromVersion: version, tooNew: false };
  }
}

/** Reads a text field, truncating an over-long value rather than dropping the sheet. */
function readText(
  record: Record<string, unknown>,
  field: TripField,
  repaired: TripField[],
): string {
  if (!Object.hasOwn(record, field)) return "";
  const value = record[field];
  if (typeof value !== "string") {
    repaired.push(field);
    return "";
  }
  if (value.length > FREE_TEXT_MAX) {
    repaired.push(field);
    return value.slice(0, FREE_TEXT_MAX);
  }
  return value;
}

/** Reads an id field. An id that is not a usable string becomes "nothing chosen". */
function readId(
  record: Record<string, unknown>,
  field: TripField,
  repaired: TripField[],
): string | null {
  const value = record[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > 80) {
    repaired.push(field);
    return null;
  }
  return value;
}

function readPartySize(record: Record<string, unknown>, repaired: TripField[]): number {
  const value = record.partySize;
  if (value === undefined) return MIN_PARTY_SIZE;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    repaired.push("partySize");
    return MIN_PARTY_SIZE;
  }
  if (value < MIN_PARTY_SIZE || value > MAX_PARTY_SIZE) {
    repaired.push("partySize");
    return Math.min(MAX_PARTY_SIZE, Math.max(MIN_PARTY_SIZE, value));
  }
  return value;
}

function readEdition(
  record: Record<string, unknown>,
  fallback: ToolEdition,
  repaired: TripField[],
): ToolEdition {
  if (!Object.hasOwn(record, "edition")) return fallback;
  const parsed = toolEditionSchema.safeParse(record.edition);
  if (parsed.success) return parsed.data;
  repaired.push("edition");
  return fallback;
}

/**
 * Reads the sheet from storage.
 *
 * Never throws. A record that cannot be used at all is reported as
 * `discarded`, and each unusable field inside a usable record is reported in
 * `repaired`, so the page can say which of the two happened.
 *
 * @param storage - `safeLocalStorage()`, or a test double, or null when storage
 *   cannot be reached at all.
 * @param fallbackEdition - The edition to use when the record names none. The
 *   page passes the reader's site edition, so a first save follows the site.
 */
export function readTripState(
  storage: StorageLike | null,
  fallbackEdition: ToolEdition = "belgium",
): TripReadResult {
  const fresh = (): TripReadResult => ({
    state: defaultTripState(fallbackEdition),
    origin: "default",
    repaired: [],
    discarded: false,
  });

  if (storage === null) return fresh();

  let raw: string | null;
  try {
    raw = storage.getItem(TRIP_STORAGE_KEY);
  } catch {
    // Site data blocked outright: as good as nothing stored.
    return fresh();
  }

  if (raw === null || raw.trim() === "") return fresh();

  if (raw.length > MAX_STORED_CHARACTERS) {
    return { ...fresh(), discarded: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ...fresh(), discarded: true };
  }

  /*
    A sheet is a JSON object. An array, a string, a number or `null` parses as
    valid JSON but is not a sheet, so it is discarded rather than read as an
    empty record: something wrote a value here that this tool never wrote, and
    pretending it was a blank trip would hide that.
  */
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...fresh(), discarded: true };
  }

  const migration = migrateTripState(parsed);
  if (migration.tooNew) return { ...fresh(), discarded: true };

  const repaired: TripField[] = [];
  const record = migration.value;

  const state: TripState = {
    version: TRIP_STATE_VERSION,
    edition: readEdition(record, fallbackEdition, repaired),
    slotId: readId(record, "slotId", repaired),
    ticketId: readId(record, "ticketId", repaired),
    packageId: readId(record, "packageId", repaired),
    accommodationNote: readText(record, "accommodationNote", repaired),
    travelNote: readText(record, "travelNote", repaired),
    partySize: readPartySize(record, repaired),
    notes: readText(record, "notes", repaired),
  };

  return { state, origin: "storage", repaired, discarded: false };
}

/**
 * Writes the sheet, reporting a refusal rather than swallowing it.
 *
 * The size check runs before the write because an over-long value would be
 * refused by the browser anyway, and "too large" is a more useful thing to tell
 * a reader than "the browser said no".
 */
export function saveTripState(storage: StorageLike | null, state: TripState): TripSaveResult {
  if (storage === null) return "no-storage";

  let text: string;
  try {
    text = serialiseTripState(state);
  } catch {
    return "refused";
  }

  if (text.length > MAX_STORED_CHARACTERS) return "too-large";

  try {
    storage.setItem(TRIP_STORAGE_KEY, text);
    return "saved";
  } catch {
    // Quota, private mode, or site data blocked between the read and the write.
    return "refused";
  }
}

/** Removes the stored sheet, reporting whether the browser allowed it. */
export function clearTripState(storage: StorageLike | null): boolean {
  if (storage === null) return false;
  try {
    storage.removeItem(TRIP_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------------------------
 * Export and import
 * ------------------------------------------------------------------------------------------- */

/**
 * The strict shape of an imported sheet.
 *
 * Strict in both directions: every field is required, and a key this tool does
 * not know rejects the file. `version` is a literal, so a file from another
 * version is named as such rather than partially understood.
 */
const importedTextField = z
  .string({ error: "must be text" })
  .max(FREE_TEXT_MAX, { error: `must be ${FREE_TEXT_MAX} characters or fewer` });

const importedIdField = z
  .string({ error: "must be text" })
  .min(1, { error: "must not be blank" })
  .max(80, { error: "must be 80 characters or fewer" })
  .nullable();

export const tripStateImportSchema = z.strictObject({
  version: z.literal(TRIP_STATE_VERSION, {
    error: "was written by a different version of this tool",
  }),
  edition: toolEditionSchema,
  slotId: importedIdField,
  ticketId: importedIdField,
  packageId: importedIdField,
  accommodationNote: importedTextField,
  travelNote: importedTextField,
  partySize: z
    .number({ error: "must be a whole number" })
    .int({ error: "must be a whole number" })
    .min(MIN_PARTY_SIZE, { error: `must be ${MIN_PARTY_SIZE} to ${MAX_PARTY_SIZE}` })
    .max(MAX_PARTY_SIZE, { error: `must be ${MIN_PARTY_SIZE} to ${MAX_PARTY_SIZE}` }),
  notes: importedTextField,
});

const exportedAtField = z
  .string({ error: "must be a date" })
  .refine((value) => Number.isFinite(Date.parse(value)), { error: "must be a date" });

/** The document an export writes, so a reader can tell what the file belongs to. */
export const tripExportSchema = z.strictObject({
  app: z.literal(TRIP_EXPORT_APP, { error: "is not a TMLGUIDE file" }),
  tool: z.literal(TRIP_EXPORT_TOOL, { error: "is not a My Trip file" }),
  version: z.literal(TRIP_STATE_VERSION, {
    error: "was written by a different version of this tool",
  }),
  exportedAt: exportedAtField,
  trip: tripStateImportSchema,
});

export type TripExportFile = z.infer<typeof tripExportSchema>;

/** Every field an imported sheet must carry, for a plain-English missing-field message. */
const IMPORT_FIELDS: ReadonlyArray<{ readonly key: string; readonly label: string }> = [
  { key: "edition", label: TRIP_FIELD_LABEL.edition },
  { key: "slotId", label: TRIP_FIELD_LABEL.slotId },
  { key: "ticketId", label: TRIP_FIELD_LABEL.ticketId },
  { key: "packageId", label: TRIP_FIELD_LABEL.packageId },
  { key: "partySize", label: TRIP_FIELD_LABEL.partySize },
  { key: "accommodationNote", label: TRIP_FIELD_LABEL.accommodationNote },
  { key: "travelNote", label: TRIP_FIELD_LABEL.travelNote },
  { key: "notes", label: TRIP_FIELD_LABEL.notes },
];

/** Builds the exported document. `exportedAt` is supplied so a test can pin it. */
export function buildTripExport(state: TripState, exportedAt: Date): TripExportFile {
  return {
    app: TRIP_EXPORT_APP,
    tool: TRIP_EXPORT_TOOL,
    version: TRIP_STATE_VERSION,
    exportedAt: exportedAt.toISOString(),
    trip: {
      version: TRIP_STATE_VERSION,
      edition: state.edition,
      slotId: state.slotId,
      ticketId: state.ticketId,
      packageId: state.packageId,
      accommodationNote: state.accommodationNote,
      travelNote: state.travelNote,
      partySize: state.partySize,
      notes: state.notes,
    },
  };
}

/** The exported document as indented JSON, which is the file a reader downloads. */
export function serialiseTripExport(state: TripState, exportedAt: Date): string {
  return `${JSON.stringify(buildTripExport(state, exportedAt), null, 2)}\n`;
}

/**
 * The download filename.
 *
 * The edition is a value from a closed enum, so it is already safe to put in a
 * filename; nothing the reader typed reaches this string.
 */
export function tripExportFilename(state: TripState): string {
  return `tmlguide-my-trip-${state.edition}.json`;
}

export type TripImportResult =
  | { readonly ok: true; readonly state: TripState }
  | { readonly ok: false; readonly message: string };

/** Turns zod's issues into one sentence naming the first field that failed. */
function describeImportProblem(
  issues: readonly { readonly path: PropertyKey[]; readonly message: string }[],
): string {
  const first = issues[0];
  if (first === undefined) return "the file could not be read as a trip sheet";

  /*
    An envelope's issues are pathed `trip.travelNote`, and a reader thinks in
    "the travel note", not in a JSON path. The last segment is the field; the
    envelope's own segments are dropped so the message names the thing the reader
    filled in.
  */
  const segments = first.path.map(String).filter((segment) => segment !== "trip");
  const last = segments[segments.length - 1];
  const label =
    last === undefined
      ? "file"
      : (TRIP_FIELD_LABEL[last as TripField] ?? segments.join("."));

  return `the ${label} could not be read: it ${first.message}`;
}

function importFailure(problem: string): TripImportResult {
  return { ok: false, message: `This file was not imported: ${problem}. Your saved trip is unchanged.` };
}

const EMBEDDED_TRIP_DATA_PATTERN =
  /<script\b[^>]*\bid=["']tmlguide-trip-data["'][^>]*>([\s\S]*?)<\/script>/i;

/**
 * Reads an imported file.
 *
 * Accepts the interactive HTML trip sheet this tool exports (reading the JSON
 * embedded in `#tmlguide-trip-data`), a JSON export envelope, or a bare trip
 * object. Either way the validation is strict and all-or-nothing: nothing is
 * applied unless every field is present and valid, because a half-imported
 * sheet is worse than a refusal.
 *
 * Cross-field checks — does this weekend exist for this edition, is this ticket
 * one the edition sells — need the data layer, so they run in the page through
 * `validateTripForEdition` before the state is applied.
 */
export function parseTripImport(text: string): TripImportResult {
  if (typeof text !== "string" || text.trim() === "") {
    return importFailure("the file is empty");
  }

  let jsonText = text;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<!doctype") || trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    const match = EMBEDDED_TRIP_DATA_PATTERN.exec(text);
    if (match === null || match[1] === undefined) {
      return importFailure("the HTML file does not contain a TMLGuide trip sheet");
    }
    jsonText = match[1];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    return importFailure("the file is not a valid trip sheet or JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return importFailure("the file does not contain a trip sheet");
  }

  const record = parsed as Record<string, unknown>;
  const isEnvelope = Object.hasOwn(record, "trip");

  if (!isEnvelope) {
    for (const field of IMPORT_FIELDS) {
      if (!Object.hasOwn(record, field.key)) {
        return importFailure(`the file is missing the ${field.label}`);
      }
    }
  }

  if (isEnvelope) {
    const envelope = tripExportSchema.safeParse(record);
    if (!envelope.success) return importFailure(describeImportProblem(envelope.error.issues));
    const trip = envelope.data.trip;
    return {
      ok: true,
      state: {
        version: TRIP_STATE_VERSION,
        edition: trip.edition,
        slotId: trip.slotId,
        ticketId: trip.ticketId,
        packageId: trip.packageId,
        accommodationNote: trip.accommodationNote,
        travelNote: trip.travelNote,
        partySize: trip.partySize,
        notes: trip.notes,
      },
    };
  }

  const bare = tripStateImportSchema.safeParse(record);
  if (!bare.success) return importFailure(describeImportProblem(bare.error.issues));

  return {
    ok: true,
    state: {
      version: TRIP_STATE_VERSION,
      edition: bare.data.edition,
      slotId: bare.data.slotId,
      ticketId: bare.data.ticketId,
      packageId: bare.data.packageId,
      accommodationNote: bare.data.accommodationNote,
      travelNote: bare.data.travelNote,
      partySize: bare.data.partySize,
      notes: bare.data.notes,
    },
  };
}
