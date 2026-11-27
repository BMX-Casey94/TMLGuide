"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useEdition } from "@/components/shell";
import { GoldDivider } from "@/components/ui/gold-divider";
import { CustomSelect } from "@/components/ui/custom-select";
import { downloadTextFile } from "../download";
import { EDITION_LABEL, TOOL_EDITIONS, type ToolEdition } from "../editions";
import { safeLocalStorage } from "../state";
import {
  WINDOW_STATUS_LABEL,
  buildWindowViews,
  formatDateRange,
  missingParts,
  nextStepsFor,
  priceLabel,
  priceYearLabel,
  repairTripAgainstEdition,
  selectedPackage,
  selectedSlot,
  selectedTicket,
  tripCurrency,
  type EditionTripData,
  type TripData,
  type TripRepair,
} from "./trip-logic";
import {
  FREE_TEXT_MAX,
  MAX_IMPORT_BYTES,
  MAX_PARTY_SIZE,
  MIN_PARTY_SIZE,
  clearTripState,
  defaultTripState,
  parseTripImport,
  readTripState,
  saveTripState,
  serialiseTripState,
  type TripField,
  type TripState,
} from "./trip-state";
import { buildTripHtmlExport, tripHtmlExportFilename } from "./trip-html-export";
/* Kit and tool styles travel with the component, so a page that renders it
   cannot forget them. This tool's own rules live in my-trip.css. */
import "@/components/ui/ui.css";
import "../tools.css";
import "./my-trip.css";

/** Everything the reader types or picks, kept exactly as typed. */
interface Drafts {
  readonly accommodation: string;
  readonly travel: string;
  readonly notes: string;
  readonly partySize: string;
}

function draftsFromState(state: TripState): Drafts {
  return {
    accommodation: state.accommodationNote,
    travel: state.travelNote,
    notes: state.notes,
    partySize: String(state.partySize),
  };
}

/**
 * Where the sheet stands with the browser's storage.
 *
 * There is no "saving" state on purpose: it would replace the live region's text
 * twice per keystroke, so a screen-reader user would hear constant chatter. The
 * region holds a quiet line while the reader types and changes once, to "Saved
 * in this browser", when the write has actually landed.
 */
type SaveStatus = "idle" | "saved" | "refused" | "too-large" | "no-storage";

/** How long typing has to stop before the trip is written and announced. */
const SAVE_DEBOUNCE_MS = 450;

/** Reads a whole number within bounds, or null when the text is not one. */
function parsePartySize(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (value < MIN_PARTY_SIZE || value > MAX_PARTY_SIZE) return null;
  return value;
}

/**
 * Switches the sheet to another edition.
 *
 * The notes and the party size travel with the reader, because those describe
 * the trip rather than a product. The weekend, the ticket and the package are
 * ids from the previous edition's data and mean nothing in the new one, so they
 * are cleared and reported. Keeping them would print a Belgium package price
 * under a Brasil heading.
 */
function switchEdition(state: TripState, data: TripData, edition: ToolEdition): TripRepair {
  if (state.edition === edition) return { state, repaired: [] };

  const cleared: TripField[] = [];
  if (state.slotId !== null) cleared.push("slotId");
  if (state.ticketId !== null) cleared.push("ticketId");
  if (state.packageId !== null) cleared.push("packageId");

  const moved: TripState = { ...state, edition, slotId: null, ticketId: null, packageId: null };
  const repair = repairTripAgainstEdition(moved, data[edition]);
  return { state: repair.state, repaired: [...cleared, ...repair.repaired] };
}

/** How each cleared field is named to a reader. */
const FIELD_NOUN: Readonly<Record<TripField, string>> = {
  edition: "the edition",
  slotId: "the weekend",
  ticketId: "the ticket",
  packageId: "the accommodation package",
  partySize: "the party size",
  accommodationNote: "the accommodation note",
  travelNote: "the travel note",
  notes: "the notes",
};

function describeFields(fields: readonly TripField[]): string {
  const names = fields.map((field) => FIELD_NOUN[field]);
  if (names.length === 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1] ?? ""}`;
}

export interface MyTripProps {
  /** The three editions' narrowed data, built on the server from the data layer. */
  readonly data: TripData;
}

/**
 * The trip sheet.
 *
 * One `TripState` lives in this browser's `localStorage` and nowhere else. The
 * component keeps three things in step: the validated state, the draft text the
 * reader is typing, and the stored copy. Only a draft that parses becomes state,
 * and the stored copy is written once typing stops, so a sentence is not
 * rewritten on every key.
 *
 * The first render must match the server's, so the default sheet renders first
 * and the stored one replaces it in an effect. The clock and the reader's time
 * zone are read the same way, which is why the dates panel shows the published
 * zone alone until the browser has been read.
 */
export function MyTrip({ data }: MyTripProps) {
  const { edition: siteEdition } = useEdition();

  const initial = useMemo(() => defaultTripState("belgium"), []);
  const [state, setState] = useState<TripState>(initial);
  const [drafts, setDrafts] = useState<Drafts>(() => draftsFromState(initial));
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [restored, setRestored] = useState(false);
  const [repairedFields, setRepairedFields] = useState<readonly TripField[]>([]);
  const [discarded, setDiscarded] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [localZone, setLocalZone] = useState<string | null>(null);

  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const clearButtonRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /**
   * True once the stored sheet has been read.
   *
   * The restore runs once, and a ref rather than state is what makes that
   * certain: a second render caused by the restore itself must not read storage
   * again and overwrite what the reader has begun typing.
   */
  const restoredOnceRef = useRef(false);
  /**
   * The serialised sheet as it stands in storage.
   *
   * The save effect compares against this so opening the page never writes:
   * without it, a first visit would store a blank sheet and announce "Saved"
   * before the reader had typed anything, which is both noise and a claim.
   */
  const storedRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True when the confirm panel was dismissed, so focus can return to its trigger. */
  const returnFocusRef = useRef(false);

  const baseId = useId();
  const field = useCallback((name: string) => `${baseId}-${name}`, [baseId]);

  const editionData: EditionTripData = data[state.edition];
  const currency = tripCurrency(state.edition);
  const slot = selectedSlot(state, editionData);
  const ticket = selectedTicket(state, editionData);
  const chosenPackage = selectedPackage(state, editionData);

  const windows = useMemo(
    () => buildWindowViews(editionData.saleWindows, localZone, now),
    [editionData.saleWindows, localZone, now],
  );
  const steps = useMemo(() => nextStepsFor(editionData), [editionData]);
  const open = useMemo(() => missingParts(state), [state]);

  /* Restore once, after hydration, so the server's HTML and the first client
     render agree. A stored sheet for another edition is kept as it is: it is the
     reader's own trip, and the page shows which edition it belongs to. */
  useEffect(() => {
    if (restoredOnceRef.current) return;
    restoredOnceRef.current = true;

    const storage = safeLocalStorage();
    const read = readTripState(storage, siteEdition);
    const repair = repairTripAgainstEdition(read.state, data[read.state.edition]);

    setState(repair.state);
    setDrafts(draftsFromState(repair.state));
    setRestored(read.origin === "storage" && !read.discarded);
    setDiscarded(read.discarded);
    setRepairedFields([...read.repaired, ...repair.repaired]);
    /*
      The sheet now in memory is the baseline: nothing is written until the
      reader changes something. Setting this even on a first visit is what stops
      the save effect storing a blank sheet and announcing "Saved" before the
      reader has typed a character.
    */
    storedRef.current = serialiseTripState(repair.state);
    setHydrated(true);
  }, [data, siteEdition]);

  /* The reader's clock and zone, read once the browser is available. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(new Date());
      try {
        setLocalZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      } catch {
        setLocalZone("UTC");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  /*
    Following the site's edition happens once, at mount: the restore read above
    passes `siteEdition` as the fallback for a sheet that names no edition. No
    effect follows later switches, because a reader who changes the site edition
    while reading has not changed their trip, and rewriting an open sheet behind
    them would be a surprise.
  */

  /* Write once typing stops, and say so in the live region. */
  useEffect(() => {
    if (!hydrated) return;

    const serialised = serialiseTripState(state);
    if (storedRef.current === serialised) {
      setSaveStatus("idle");
      return;
    }

    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const result = saveTripState(safeLocalStorage(), state);
      if (result === "saved") {
        storedRef.current = serialised;
        setSaveStatus("saved");
        return;
      }
      setSaveStatus(result);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    };
  }, [hydrated, state]);

  /* The confirm panel takes focus when it opens, and the trigger takes it back
     when the panel closes, so a keyboard user is never dropped at the top of
     the document. The trigger stays mounted throughout, which is why it can
     receive that focus. */
  useEffect(() => {
    if (confirmingClear) {
      confirmButtonRef.current?.focus();
      return;
    }
    if (returnFocusRef.current) {
      returnFocusRef.current = false;
      clearButtonRef.current?.focus();
    }
  }, [confirmingClear]);

  const commit = useCallback((next: TripState) => {
    setState(next);
    setActionNote(null);
    setImportError(null);
    setCleared(false);
  }, []);

  const onEditionChange = useCallback(
    (edition: ToolEdition) => {
      if (edition === state.edition) return;
      const switched = switchEdition(state, data, edition);
      commit(switched.state);
      setDrafts(draftsFromState(switched.state));
      setRepairedFields(switched.repaired);
      setDiscarded(false);
      setRestored(false);
    },
    [commit, data, state],
  );

  const onDraftChange = useCallback(
    (key: keyof Drafts, text: string) => {
      setDrafts((current) => ({ ...current, [key]: text }));
      if (key === "accommodation") commit({ ...state, accommodationNote: text.slice(0, FREE_TEXT_MAX) });
      else if (key === "travel") commit({ ...state, travelNote: text.slice(0, FREE_TEXT_MAX) });
      else if (key === "notes") commit({ ...state, notes: text.slice(0, FREE_TEXT_MAX) });
      else {
        const parsed = parsePartySize(text);
        if (parsed !== null) commit({ ...state, partySize: parsed });
      }
    },
    [commit, state],
  );

  const onExport = useCallback(() => {
    const started = downloadTextFile(
      tripHtmlExportFilename(state),
      buildTripHtmlExport(state, editionData, new Date()),
      "text/html;charset=utf-8",
    );
    setActionNote(
      started
        ? "Trip sheet downloaded as an interactive HTML file. Open it in any browser to tick off stages, edit notes and save an updated copy — or re-import it here later."
        : "This browser could not start a download, so the trip sheet was not saved. Try another browser, or print this page.",
    );
  }, [editionData, state]);

  /**
   * Reads a chosen file.
   *
   * Every failure is reported and nothing is applied, because a half-imported
   * sheet would look complete while missing fields. The file's own edition
   * decides which data its references are checked against, so importing a Brasil
   * trip while reading Belgium restores a Brasil trip.
   */
  const onImportFile = useCallback(
    async (file: File) => {
      setActionNote(null);
      setImportError(null);

      if (file.size > MAX_IMPORT_BYTES) {
        setImportError(
          "This file was not imported: it is larger than a trip sheet can be. Your saved trip is unchanged.",
        );
        return;
      }

      let text: string;
      try {
        text = await file.text();
      } catch {
        setImportError(
          "This file could not be read. Your saved trip is unchanged. Try exporting it again from the browser you wrote it in.",
        );
        return;
      }

      const parsed = parseTripImport(text);
      if (!parsed.ok) {
        setImportError(parsed.message);
        return;
      }

      const repair = repairTripAgainstEdition(parsed.state, data[parsed.state.edition]);
      commit(repair.state);
      setDrafts(draftsFromState(repair.state));
      setRepairedFields(repair.repaired);
      setDiscarded(false);
      setRestored(false);
      setActionNote(
        repair.repaired.length === 0
          ? "Trip imported. It replaced the sheet in this browser and is saved there now."
          : `Trip imported, but ${describeFields(repair.repaired)} could not be matched to the published data and was cleared.`,
      );
    },
    [commit, data],
  );

  const onClear = useCallback(() => {
    clearTripState(safeLocalStorage());
    const fresh = defaultTripState(state.edition);
    setState(fresh);
    setDrafts(draftsFromState(fresh));
    /*
      The blank sheet is the new baseline, so the save effect stays quiet and
      storage is left empty rather than holding an empty record. The reader's
      next edit writes again.
    */
    storedRef.current = serialiseTripState(fresh);
    setConfirmingClear(false);
    setRepairedFields([]);
    setDiscarded(false);
    setRestored(false);
    setActionNote(null);
    setImportError(null);
    setCleared(true);
    setSaveStatus("idle");
  }, [state.edition]);

  const partyValid = parsePartySize(drafts.partySize) !== null;

  return (
    <div className="trip">
      <section className="trip-section" aria-labelledby={field("sheet-heading")}>
        <div className="trip-section__head">
          <h2 className="trip-section__title" id={field("sheet-heading")}>
            Your trip
          </h2>
          <p className="trip-section__intro">
            Everything here is stored in this browser and nowhere else. Nothing is sent anywhere,
            there is no account, and no cookie is set.
          </p>
        </div>

        {discarded ? (
          <div className="trip-note trip-note--warning" role="status">
            <span className="trip-note__label">Starting fresh</span>
            <p>
              A saved trip could not be read, so this page started with an empty sheet. The stored
              copy has been left alone in case it came from a different version of this tool.
            </p>
          </div>
        ) : null}

        {repairedFields.length > 0 && !discarded ? (
          <div className="trip-note" role="status">
            <span className="trip-note__label">Part of the sheet changed</span>
            <p>
              {describeFields(repairedFields)}{" "}
              {repairedFields.length === 1 ? "was" : "were"} not something the published{" "}
              {editionData.label} data still holds, so{" "}
              {repairedFields.length === 1 ? "it was" : "they were"} cleared. Everything else was
              kept.
            </p>
          </div>
        ) : null}

        {restored && repairedFields.length === 0 && !cleared ? (
          <p className="trip-note trip-note--ok" role="status">
            <span className="trip-note__label">Restored</span>
            <span>The trip saved in this browser is open below.</span>
          </p>
        ) : null}

        <form className="trip-form" onSubmit={(event) => event.preventDefault()}>
          <div className="tool-field">
            <span className="tool-field__label" id={field("edition-label")}>
              Edition
            </span>
            <div className="tool-segmented" role="group" aria-labelledby={field("edition-label")}>
              {TOOL_EDITIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="tool-segmented__option"
                  aria-pressed={state.edition === option}
                  onClick={() => onEditionChange(option)}
                >
                  {state.edition === option ? (
                    <span className="tool-segmented__tick" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                  {EDITION_LABEL[option]}
                </button>
              ))}
            </div>
            <p className="tool-field__note">
              Switching edition keeps your notes and the number of people, and clears the weekend,
              ticket and package because those belong to the edition you left. Prices are in{" "}
              {currency === "BRL" ? "reais" : "euros"} and are never converted.
            </p>
          </div>

          <fieldset className="trip-fieldset">
            <legend className="trip-legend">Which weekend or week</legend>
            <p className="trip-hint" id={field("slot-hint")}>
              Only the dates the organisers have published for {editionData.label} are listed. The
              dates are theirs, not this guide&rsquo;s.
            </p>
            {editionData.slots.length === 0 ? (
              <p className="tool-field__note">
                No dated {editionData.label} edition is published yet, so there is nothing to choose.
                The official site announces the dates first.
              </p>
            ) : (
              <div className="trip-options" role="radiogroup" aria-describedby={field("slot-hint")}>
                {editionData.slots.map((option) => (
                  <label className="trip-option" key={option.id}>
                    <input
                      type="radio"
                      name={field("slot")}
                      value={option.id}
                      checked={state.slotId === option.id}
                      onChange={() => commit({ ...state, slotId: option.id })}
                    />
                    <span className="trip-option__body">
                      <span className="trip-option__name">{option.name}</span>
                      <span className="trip-option__meta">
                        {option.kind === "week" ? "One week" : "Weekend"} ·{" "}
                        {formatDateRange(option.startsOn, option.endsOn)}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="trip-option">
                  <input
                    type="radio"
                    name={field("slot")}
                    value=""
                    checked={state.slotId === null}
                    onChange={() => commit({ ...state, slotId: null })}
                  />
                  <span className="trip-option__body">
                    <span className="trip-option__name">Not decided yet</span>
                    <span className="trip-option__meta">Leave this open</span>
                  </span>
                </label>
              </div>
            )}

            {slot === null ? null : (
              <div className="trip-detail">
                <p className="trip-detail__figures">
                  <span className="trip-detail__year">Dates</span>
                  <span className="trip-detail__price">
                    {formatDateRange(slot.startsOn, slot.endsOn)}
                  </span>
                </p>
                <p className="trip-detail__text">
                  {slot.kind === "week" ? "One week, as published." : "One weekend, as published."}{" "}
                  The dates come from the shared editions data, the same record the rest of the guide
                  reads.
                </p>
              </div>
            )}
          </fieldset>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={field("ticket")}>
              The ticket you hold
            </label>
            <CustomSelect
              id={field("ticket")}
              ariaLabel="The ticket you hold"
              ariaDescribedBy={field("ticket-note")}
              value={state.ticketId ?? ""}
              placeholder="No ticket chosen yet"
              onChange={(next) => commit({ ...state, ticketId: next === "" ? null : next })}
              options={[
                { value: "", label: "No ticket chosen yet" },
                ...editionData.tickets.map((option) => ({ value: option.id, label: option.name })),
              ]}
            />
            <p className="tool-field__note" id={field("ticket-note")}>
              The published {editionData.label} products, by name. The price, its year and the page
              it came from are shown once you pick one.
            </p>

            {ticket === null ? null : (
              <div className="trip-detail">
                <p className="trip-detail__figures">
                  <span className="trip-detail__price">{priceLabel(ticket, currency)}</span>
                  <span className="trip-detail__year">{priceYearLabel(ticket.priceYear)}</span>
                  {ticket.soldOut ? <span className="trip-flag">Sold out</span> : null}
                </p>
                <p className="trip-detail__text">{ticket.detail}</p>
                <p className="trip-detail__source">
                  <a href={ticket.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {ticket.sourceTitle}{" "}
                    <span className="sr-only">(official page, opens in a new tab)</span>
                  </a>
                </p>
              </div>
            )}
          </div>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={field("accommodation")}>
              Where you are staying
            </label>
            <textarea
              id={field("accommodation")}
              className="trip-textarea"
              rows={3}
              maxLength={FREE_TEXT_MAX}
              value={drafts.accommodation}
              aria-describedby={field("accommodation-note")}
              placeholder="A hotel in Boom, a friend's flat, a DreamVille package"
              onChange={(event) => onDraftChange("accommodation", event.target.value)}
            />
            <span className="trip-count" aria-hidden="true">
              {drafts.accommodation.length}/{FREE_TEXT_MAX}
            </span>
            <p className="tool-field__note" id={field("accommodation-note")}>
              Your own words, up to {FREE_TEXT_MAX} characters. Nothing here is checked against the
              data, so it is a note to yourself rather than a booking.
            </p>
          </div>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={field("package")}>
              A published accommodation package, if you booked one
            </label>
            <CustomSelect
              id={field("package")}
              ariaLabel="A published accommodation package, if you booked one"
              ariaDescribedBy={field("package-note")}
              value={state.packageId ?? ""}
              placeholder="No package chosen"
              onChange={(next) => commit({ ...state, packageId: next === "" ? null : next })}
              options={[
                { value: "", label: "No package chosen" },
                ...editionData.packages.map((option) => ({ value: option.id, label: option.name })),
              ]}
            />
            <p className="tool-field__note" id={field("package-note")}>
              {editionData.packagesNote}
            </p>

            {chosenPackage === null ? null : (
              <div className="trip-detail">
                <p className="trip-detail__figures">
                  <span className="trip-detail__price">
                    {priceLabel(chosenPackage, currency)}
                  </span>
                  <span className="trip-detail__year">
                    {priceYearLabel(chosenPackage.priceYear)}
                  </span>
                  <span className="trip-flag">
                    {chosenPackage.capacity} {chosenPackage.capacity === 1 ? "person" : "people"}
                  </span>
                  {chosenPackage.soldOut ? <span className="trip-flag">Sold out</span> : null}
                </p>
                <p className="trip-detail__text">{chosenPackage.detail}</p>
                <p className="trip-detail__source">
                  <a href={chosenPackage.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {chosenPackage.sourceTitle}{" "}
                    <span className="sr-only">(official page, opens in a new tab)</span>
                  </a>
                </p>
              </div>
            )}
          </div>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={field("travel")}>
              How you are travelling
            </label>
            <textarea
              id={field("travel")}
              className="trip-textarea"
              rows={3}
              maxLength={FREE_TEXT_MAX}
              value={drafts.travel}
              aria-describedby={field("travel-note")}
              placeholder="Flight to Brussels, then the train to Boom"
              onChange={(event) => onDraftChange("travel", event.target.value)}
            />
            <span className="trip-count" aria-hidden="true">
              {drafts.travel.length}/{FREE_TEXT_MAX}
            </span>
            <p className="tool-field__note" id={field("travel-note")}>
              Your own words, up to {FREE_TEXT_MAX} characters.
            </p>
          </div>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={field("party")}>
              How many of you are going
            </label>
            <input
              id={field("party")}
              className="tool-input"
              type="number"
              inputMode="numeric"
              min={MIN_PARTY_SIZE}
              max={MAX_PARTY_SIZE}
              step={1}
              autoComplete="off"
              value={drafts.partySize}
              aria-invalid={partyValid ? undefined : true}
              aria-describedby={partyValid ? field("party-note") : field("party-error")}
              onChange={(event) => onDraftChange("partySize", event.target.value)}
              onBlur={() => {
                if (!partyValid) {
                  setDrafts((current) => ({ ...current, partySize: String(state.partySize) }));
                }
              }}
            />
            {partyValid ? (
              <p className="tool-field__note" id={field("party-note")}>
                From {MIN_PARTY_SIZE} to {MAX_PARTY_SIZE}. Count everyone on the booking, including
                yourself.
              </p>
            ) : (
              <p className="tool-field__error" id={field("party-error")}>
                Enter a whole number from {MIN_PARTY_SIZE} to {MAX_PARTY_SIZE}.
              </p>
            )}
          </div>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={field("notes")}>
              Anything else
            </label>
            <textarea
              id={field("notes")}
              className="trip-textarea"
              rows={4}
              maxLength={FREE_TEXT_MAX}
              value={drafts.notes}
              aria-describedby={field("notes-note")}
              placeholder="Meeting point, who has the tickets, a reminder to yourself"
              onChange={(event) => onDraftChange("notes", event.target.value)}
            />
            <span className="trip-count" aria-hidden="true">
              {drafts.notes.length}/{FREE_TEXT_MAX}
            </span>
            <p className="tool-field__note" id={field("notes-note")}>
              Your own words, up to {FREE_TEXT_MAX} characters. Use this field for anything personal:
              it never leaves this device.
            </p>
          </div>
        </form>

        <p
          className={
            saveStatus === "saved"
              ? "trip-save"
              : saveStatus === "idle"
                ? "trip-save trip-save--idle"
                : "trip-save trip-save--warning"
          }
          role="status"
        >
          {saveStatus === "saved" ? "Saved in this browser" : null}
          {saveStatus === "refused"
            ? "Not saved: this browser refused to store the trip. It will be lost when you leave the page."
            : null}
          {saveStatus === "too-large"
            ? "Not saved: the trip is too large for this tool to store. Shorten the notes."
            : null}
          {saveStatus === "no-storage"
            ? "Not saved: this browser does not allow site storage. The trip will be lost when you leave the page."
            : null}
          {saveStatus === "idle" ? "Changes are saved in this browser as you type" : null}
        </p>

        <div className="trip-actions">
          <button type="button" className="tool-btn tool-btn--primary" onClick={onExport}>
            Export my trip
          </button>
          <button type="button" className="tool-btn" onClick={() => fileInputRef.current?.click()}>
            Import a trip file
          </button>
          <input
            ref={fileInputRef}
            className="trip-file"
            type="file"
            accept=".html,text/html,application/json,.json"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Clearing the value lets the reader pick the same file again after
              // a failed import, which would otherwise fire no change event.
              event.target.value = "";
              if (file !== undefined) void onImportFile(file);
            }}
          />
          <button
            ref={clearButtonRef}
            type="button"
            className="tool-btn tool-btn--quiet"
            aria-expanded={confirmingClear}
            onClick={() => {
              returnFocusRef.current = false;
              setConfirmingClear((current) => !current);
            }}
          >
            Clear this trip
          </button>
        </div>

        {confirmingClear ? (
          <div
            className="trip-confirm"
            role="group"
            aria-labelledby={field("confirm-question")}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                returnFocusRef.current = true;
                setConfirmingClear(false);
              }
            }}
          >
            <p className="trip-confirm__question" id={field("confirm-question")}>
              Clear every field and delete the saved copy from this browser? A file you exported
              earlier is not affected.
            </p>
            <button
              ref={confirmButtonRef}
              type="button"
              className="tool-btn"
              onClick={onClear}
              aria-describedby={field("confirm-question")}
            >
              Yes, clear the trip
            </button>
            <button
              type="button"
              className="tool-btn tool-btn--quiet"
              onClick={() => {
                returnFocusRef.current = true;
                setConfirmingClear(false);
              }}
            >
              Keep it
            </button>
          </div>
        ) : null}
        {actionNote === null ? null : (
          <p className="trip-note trip-note--ok" role="status">
            <span className="trip-note__label">Export and import</span>
            <span>{actionNote}</span>
          </p>
        )}

        {importError === null ? null : (
          <p className="trip-note trip-note--warning" role="alert">
            <span className="trip-note__label">Import failed</span>
            <span>{importError}</span>
          </p>
        )}

        {cleared ? (
          <p className="trip-note" role="status">
            <span className="trip-note__label">Cleared</span>
            <span>The sheet is empty and the saved copy is gone from this browser.</span>
          </p>
        ) : null}
      </section>

      <GoldDivider />

      <section className="trip-section" aria-labelledby={field("dates-heading")}>
        <div className="trip-section__head">
          <h2 className="trip-section__title" id={field("dates-heading")}>
            Dates to remember
          </h2>
          <p className="trip-section__intro">
            Every {editionData.label} sale the organisers have published, in the order they open.
            Each one is shown in your own time zone and in the zone it was published in.
          </p>
        </div>

        {windows.length === 0 ? (
          <p className="tool-field__note">
            No {editionData.label} sale dates are published, so there is nothing to list yet. The
            official site announces them first, and this panel fills itself when the data does.
          </p>
        ) : (
          <ol className="trip-windows">
            {windows.map((window) => (
              <li className="trip-window" key={window.id}>
                <div className="trip-window__head">
                  <h3 className="trip-window__name">{window.name}</h3>
                  {window.status === null ? null : (
                    <span className={`tool-status tool-status--${window.status}`}>
                      {WINDOW_STATUS_LABEL[window.status]}
                    </span>
                  )}
                </div>
                <p className="trip-window__audience">{window.audience}</p>

                <dl className="trip-window__times">
                  <div>
                    <dt>{window.localZone === null ? "Published time" : "Your time"}</dt>
                    <dd>
                      <time dateTime={window.opensAtIso}>{window.local ?? window.source}</time>
                    </dd>
                  </div>
                  <div>
                    <dt>As published ({window.sourceZone})</dt>
                    <dd>{window.source}</dd>
                  </div>
                </dl>

                {window.dayDiffers ? (
                  <p className="trip-window__notice">
                    Your zone and the published zone fall on different calendar days for this sale.
                  </p>
                ) : null}

                {window.notes === undefined ? null : (
                  <p className="trip-window__notes">{window.notes}</p>
                )}

                <div className="trip-window__foot">
                  <a
                    className="trip-window__link"
                    href={window.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Official page for this sale{" "}
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </div>
              </li>
            ))}
          </ol>
        )}

        <p className="tool-field__note">
          A sale opening is not a guarantee of a ticket, and the Exchange Desk is the only official
          resale route.{" "}
          <Link className="trip-window__link" href="/tools/sale-timeline">
            Open the sale timeline <span className="sr-only">for countdowns and calendar files</span>
          </Link>
        </p>
      </section>

      <GoldDivider />

      <section className="trip-section" aria-labelledby={field("steps-heading")}>
        <div className="trip-section__head">
          <h2 className="trip-section__title" id={field("steps-heading")}>
            Next steps
          </h2>
          <p className="trip-section__intro">
            What usually comes next when a trip starts taking shape, in the order it is worth doing.
          </p>
        </div>

        {open.length > 0 ? (
          <div className="trip-note">
            <p className="trip-note__label">Still open</p>
            <ul className="trip-repairs">
              {open.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="trip-note trip-note--ok">
            <p className="trip-note__label">Filled in</p>
            <p>
              Every part of the sheet has something in it. Check the sale dates above before you rely
              on any of it.
            </p>
          </div>
        )}

        <ul className="trip-steps">
          {steps.map((step) => (
            <li className="trip-step" key={step.href}>
              <Link className="trip-step__link" href={step.href}>
                <span className="trip-step__body">
                  <span className="trip-step__label">{step.label}</span>
                  <span className="trip-step__why">{step.why}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="trip-note">
          <span className="trip-note__label">About this sheet</span>
          <p>
            This trip is stored only in this browser, under one local key. It is not backed up, it is
            not on a server, and it is lost if you clear this site&rsquo;s data or open the site in
            another browser or on another device. Export it if you want a copy you can keep.
          </p>
        </div>
      </section>
    </div>
  );
}
