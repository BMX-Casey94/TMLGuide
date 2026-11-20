"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
/* Kit styles travel with the component so any page that uses it is styled. */
import "@/components/tools/tools.css";
import { useEdition } from "@/components/shell";
import { GoldDivider } from "@/components/ui/gold-divider";
import { CheckSeparator } from "@/components/ui/source-check";
import {
  OFFICIAL_LABEL,
  PACKING_EDITIONS,
  SUGGESTION_LABEL,
  guideForEdition,
  packingItems,
  type PackingEdition,
  type PackingGuide,
  type PackingItem,
  type PackingStay,
} from "./packing-catalogue";
import {
  CUSTOM_SECTION_TITLE,
  groupBySection,
  isStayForEdition,
  itemsFor,
  progressAnnouncement,
  progressFor,
  staysForEdition,
} from "./packing-logic";
import {
  MAX_CUSTOM_ITEMS,
  MAX_CUSTOM_LABEL,
  addCustomItem,
  createPackingStore,
  removeCustomItem,
  resetTicks,
  stayAfterEditionChange,
  togglePacked,
  type PackingState,
} from "./packing-state";
import "./packing.css";

/** Edition names for the headings and the printed sheet. */
const EDITION_LABEL: Readonly<Record<PackingEdition, string>> = {
  belgium: "Belgium",
  winter: "Winter",
  brasil: "Brasil",
};

/** Transient messages shown in a live region after an action. */
type Status = { readonly kind: "idle" } | { readonly kind: "message"; readonly text: string };

export interface PackingListProps {
  /**
   * Human titles for the cited pages, keyed by URL, resolved on the server from
   * the data layer. Every official item's URL is present, because the page
   * refuses to build otherwise.
   */
  readonly sourceTitles: Readonly<Record<string, string>>;
}

/** The checkbox id for a catalogue or reader item. */
function checkboxId(itemId: string): string {
  return `packing-item-${itemId}`;
}

/**
 * The packing checklist.
 *
 * Three things are kept apart here on purpose:
 *
 * - the catalogue, which is fixed and sourced;
 * - the reader's state, which is validated before use and persisted to one
 *   localStorage key;
 * - the view, which is derived from both.
 *
 * A suggestion never renders a rule or a citation, and an official item always
 * renders its citation, so the two can never be confused for each other.
 */
export function PackingList({ sourceTitles }: PackingListProps) {
  const { edition: siteEdition } = useEdition();

  /*
    The store is built once per mount, keyed on the site's edition, which is only
    the fallback for a first visit. `useSyncExternalStore` then renders the server
    snapshot first and the stored record immediately after, so the markup the
    browser receives always matches what React hydrates. Once a record is loaded
    the tool's own control governs the edition, so the site's choice cannot move a
    reader's ticks underneath them.
  */
  const store = useMemo(() => createPackingStore(siteEdition), [siteEdition]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const { state, discarded, repaired } = snapshot;

  const [showUnpacked, setShowUnpacked] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [draft, setDraft] = useState("");
  const [draftProblem, setDraftProblem] = useState<string | null>(null);

  /* The checkbox to focus after a tick, set only when the tick hides its own row. */
  const focusAfterRef = useRef<string | null>(null);

  const fieldId = useId();
  const field = useCallback((name: string) => `${fieldId}-${name}`, [fieldId]);

  /* -------------------------------- derived -------------------------------- */

  const catalogueItems = useMemo(
    () => itemsFor(packingItems, state.edition, state.stay),
    [state.edition, state.stay],
  );

  const packed = useMemo(() => new Set(state.packed), [state.packed]);
  /* One count over everything the reader can see, including their own items. */
  const allEntries = useMemo(() => [...catalogueItems, ...state.custom], [catalogueItems, state.custom]);
  const progress = progressFor(allEntries, packed);
  const guide: PackingGuide = useMemo(() => guideForEdition(state.edition), [state.edition]);
  const stays = staysForEdition(state.edition);

  const groups = useMemo(() => groupBySection(catalogueItems), [catalogueItems]);

  /* The visible rows, in DOM order, so a tick can move focus to the next one. */
  const visibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        if (showUnpacked && packed.has(item.id)) continue;
        ids.push(item.id);
      }
    }
    for (const item of state.custom) {
      if (showUnpacked && packed.has(item.id)) continue;
      ids.push(item.id);
    }
    return ids;
  }, [groups, state.custom, showUnpacked, packed]);

  useEffect(() => {
    const target = focusAfterRef.current;
    if (target === null) return;
    focusAfterRef.current = null;
    const element = document.getElementById(checkboxId(target));
    if (element instanceof HTMLInputElement) element.focus();
  }, [visibleIds]);

  /* -------------------------------- actions -------------------------------- */

  const commit = useCallback(
    (next: PackingState) => {
      store.update(() => next);
      setStatus({ kind: "idle" });
    },
    [store],
  );

  const onToggle = useCallback(
    (itemId: string, checked: boolean) => {
      if (!checked && showUnpacked) {
        /*
          Ticking with "show unpacked only" on hides the row the reader just
          used. Without moving focus the next Tab press would restart at the top
          of the document, so focus goes to the next visible row, then the
          previous one, and finally to the filter that is hiding things.
        */
        const index = visibleIds.indexOf(itemId);
        const next = visibleIds[index + 1] ?? visibleIds[index - 1] ?? null;
        focusAfterRef.current = next ?? field("filter");
      }
      commit(togglePacked(state, itemId));
    },
    [commit, field, showUnpacked, state, visibleIds],
  );

  const onReset = useCallback(() => {
    const cleared = resetTicks(state);
    commit(cleared);
    setShowUnpacked(false);
    setStatus({ kind: "message", text: "Every tick cleared. Your own items are still here." });
  }, [commit, state]);

  const onAdd = useCallback(
    () => {
      const result = addCustomItem(state, draft);
      if (result.problem !== null) {
        setDraftProblem(
          result.problem === "empty"
            ? "Type the item you want to add."
            : result.problem === "too-long"
              ? `Keep an item to ${MAX_CUSTOM_LABEL} characters or fewer.`
              : result.problem === "duplicate"
                ? "That item is already on your list."
                : `Your own list holds ${MAX_CUSTOM_ITEMS} items, which is the limit.`,
        );
        setStatus({ kind: "idle" });
        return;
      }
      setDraft("");
      setDraftProblem(null);
      store.update(() => result.state);
      setStatus({ kind: "message", text: "Added to your own items." });
    },
    [draft, state, store],
  );

  const onRemove = useCallback(
    (itemId: string, label: string) => {
      store.update((current) => removeCustomItem(current, itemId));
      setStatus({ kind: "message", text: `Removed ${label}.` });
      window.setTimeout(() => {
        document.getElementById(field("new-item"))?.focus();
      }, 0);
    },
    [field, store],
  );

  const onPrint = useCallback(() => {
    window.print();
  }, []);

  const onEdition = useCallback(
    (edition: PackingEdition) => {
      commit({
        ...state,
        edition,
        stay: stayAfterEditionChange(edition, state.stay),
      });
      setShowUnpacked(false);
    },
    [commit, state],
  );

  const onStay = useCallback(
    (stay: PackingStay) => {
      if (!isStayForEdition(stay, state.edition)) return;
      commit({ ...state, stay });
    },
    [commit, state],
  );

  const customFull = state.custom.length >= MAX_CUSTOM_ITEMS;
  const draftLength = draft.length;
  const nothingVisible = visibleIds.length === 0;

  return (
    <div className="packing">
      {discarded ? (
        <p className="tool-note tool-note--info" role="status">
          <span className="tool-note__label">Starting fresh</span>
          <span>
            The saved list on this device could not be read, so the checklist starts empty. Nothing
            else on the page is affected.
          </span>
        </p>
      ) : null}

      {repaired ? (
        <p className="tool-note tool-note--info" role="status">
          <span className="tool-note__label">Stay reset</span>
          <span>
            The saved list named a stay that does not belong to {EDITION_LABEL[state.edition]}, so it
            is set to that edition&rsquo;s first stay. Your ticks and your own items were kept.
          </span>
        </p>
      ) : null}

      {/* ------------------------------ controls ------------------------------ */}
      <section className="tool-panel packing-controls" aria-labelledby={field("heading")}>
        <div className="tool-panel__head">
          <h2 className="tool-panel__title" id={field("heading")}>
            Build your list
          </h2>
          <p className="tool-panel__hint">
            Pick the edition you are going to and the kind of bed you have booked. Items that only
            apply to one or the other appear and disappear with the choice.
          </p>
        </div>

        <div className="tool-fields">
          <div className="tool-field">
            <span className="tool-field__label" id={field("edition-label")}>
              Edition
            </span>
            <div className="tool-segmented" role="group" aria-labelledby={field("edition-label")}>
              {PACKING_EDITIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="tool-segmented__option"
                  aria-pressed={state.edition === option}
                  onClick={() => onEdition(option)}
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
          </div>

          <fieldset className="packing-stays">
            <legend className="tool-field__label">Where you are staying</legend>
            <div className="packing-stays__options">
              {stays.map((option) => (
                <label
                  key={option.id}
                  className="packing-stay"
                  data-selected={state.stay === option.id ? "true" : undefined}
                >
                  <input
                    type="radio"
                    name={field("stay")}
                    value={option.id}
                    checked={state.stay === option.id}
                    onChange={() => onStay(option.id)}
                  />
                  <span className="packing-stay__text">
                    <span className="packing-stay__label">{option.label}</span>
                    <span className="packing-stay__hint">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="packing-summary">
          <div className="packing-progress">
            <p className="packing-progress__label">Your list for {EDITION_LABEL[state.edition]}</p>
            <p className="packing-progress__value" role="status" aria-live="polite">
              {progressAnnouncement(progress)}
            </p>
            <div className="packing-progress__track" aria-hidden="true">
              <span
                className="packing-progress__fill"
                style={{
                  width:
                    progress.total === 0 ? "0%" : `${Math.round((progress.packed / progress.total) * 100)}%`,
                }}
              />
            </div>
            <p className="packing-progress__aside">
              {progress.complete
                ? "Every item is ticked. Print it as a record or start again."
                : "Ticks save on this device as you go, and your own items are kept when you reset."}
            </p>
          </div>

          <div className="packing-actions">
            <label className="packing-filter" htmlFor={field("filter")}>
              <input
                id={field("filter")}
                type="checkbox"
                checked={showUnpacked}
                onChange={(event) => setShowUnpacked(event.target.checked)}
              />
              <span>Show unpacked only</span>
            </label>
            <div className="packing-actions__buttons">
              <button type="button" className="tool-btn" onClick={onReset}>
                Reset{" "}
                <span className="sr-only">all ticks</span>
              </button>
              <button type="button" className="tool-btn" onClick={onPrint}>
                Print{" "}
                <span className="sr-only">this checklist</span>
              </button>
            </div>
          </div>
        </div>

        <p className="packing-status" role="status" aria-live="polite">
          {status.kind === "message" ? status.text : ""}
        </p>
      </section>

      <GoldDivider butterfly="left" />

      {/* ------------------------------ checklist ----------------------------- */}
      <section className="packing-sheet" aria-labelledby={field("list-heading")}>
        <div className="packing-print-head" aria-hidden="true">
          <p className="label">TMLGuide packing list</p>
          <p>
            {EDITION_LABEL[state.edition]} ·{" "}
            {stays.find((stay) => stay.id === state.stay)?.label ?? "Your stay"}
          </p>
        </div>

        <div className="packing-sheet__head">
          <p className="label text-accent">Checklist</p>
          <h2 className="packing-sheet__title" id={field("list-heading")}>
            {EDITION_LABEL[state.edition]} packing list
          </h2>
          <p className="packing-sheet__intro">{guide.summary}</p>
        </div>

        {nothingVisible ? (
          <p className="packing-empty">
            {showUnpacked
              ? "Everything on this list is packed. Untick “Show unpacked only” to see the whole list again."
              : "There are no items for this choice."}
          </p>
        ) : (
          <div className="packing-list" data-unpacked-only={showUnpacked ? "true" : undefined}>
            {groups.map((group, index) => (
              <fieldset className="packing-group" key={group.id}>
                <legend className="packing-group__title">
                  <span className="packing-group__index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {group.title}
                </legend>
                <ul className="packing-items" role="list">
                  {group.items.map((item) => (
                    <PackingRow
                      key={item.id}
                      item={item}
                      packed={packed.has(item.id)}
                      sourceTitle={item.basis === "official" ? sourceTitles[item.sourceUrl] : undefined}
                      onToggle={onToggle}
                      hiddenByFilter={showUnpacked && packed.has(item.id)}
                    />
                  ))}
                </ul>
              </fieldset>
            ))}

            <fieldset className="packing-group">
              <legend className="packing-group__title">
                <span className="packing-group__index" aria-hidden="true">
                  {String(groups.length + 1).padStart(2, "0")}
                </span>
                {CUSTOM_SECTION_TITLE}
              </legend>

              {state.custom.length === 0 ? (
                <p className="packing-group__empty">
                  Nothing of your own yet. Anything you add here is saved on this device only.
                </p>
              ) : (
                <ul className="packing-items" role="list">
                  {state.custom.map((item) => (
                    <li
                      className="packing-item packing-item--custom"
                      key={item.id}
                      data-packed={packed.has(item.id) ? "true" : undefined}
                      hidden={showUnpacked && packed.has(item.id)}
                    >
                      <input
                        id={checkboxId(item.id)}
                        className="packing-item__box"
                        type="checkbox"
                        checked={packed.has(item.id)}
                        onChange={(event) => onToggle(item.id, event.target.checked)}
                      />
                      <label className="packing-item__label" htmlFor={checkboxId(item.id)}>
                        <span className="packing-item__text">{item.label}</span>
                      </label>
                      <button
                        type="button"
                        className="packing-item__remove"
                        onClick={() => onRemove(item.id, item.label)}
                      >
                        Remove{" "}
                        <span className="sr-only">{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form
                className="packing-add"
                onSubmit={(event) => {
                  event.preventDefault();
                  onAdd();
                }}
              >
                <label className="packing-add__label" htmlFor={field("new-item")}>
                  Add your own item
                </label>
                <div className="packing-add__row">
                  <input
                    id={field("new-item")}
                    className="tool-input packing-add__input"
                    type="text"
                    value={draft}
                    maxLength={MAX_CUSTOM_LABEL}
                    autoComplete="off"
                    disabled={customFull}
                    aria-invalid={draftProblem === null ? undefined : true}
                    aria-describedby={
                      draftProblem === null ? field("new-item-note") : field("new-item-error")
                    }
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (draftProblem !== null) setDraftProblem(null);
                    }}
                  />
                  <button type="submit" className="tool-btn" disabled={customFull}>
                    Add{" "}
                    <span className="sr-only">item to your list</span>
                  </button>
                </div>
                {draftProblem === null ? (
                  <p className="tool-field__note" id={field("new-item-note")}>
                    {customFull
                      ? `Your own list holds ${MAX_CUSTOM_ITEMS} items, which is the limit.`
                      : `${MAX_CUSTOM_LABEL - draftLength} characters left. Your items are stored on this device only and never leave it.`}
                  </p>
                ) : (
                  <p className="tool-field__error" id={field("new-item-error")}>
                    {draftProblem}
                  </p>
                )}
              </form>
            </fieldset>
          </div>
        )}
      </section>

      <GoldDivider butterfly="right" />

      {/* ------------------------------ guidance ------------------------------ */}
      <section className="packing-guidance" aria-labelledby={field("guidance-heading")}>
        <div className="packing-sheet__head">
          <p className="label text-accent">Before you pack</p>
          <h2 className="packing-sheet__title" id={field("guidance-heading")}>
            What the official pages say
          </h2>
        </div>

        <div className="packing-guidance__block">
          <h3 className="packing-guidance__title">Not allowed</h3>
          {guide.notAllowed.length === 0 ? (
            <p className="packing-guidance__text">{guide.notAllowedGap}</p>
          ) : (
            <ul className="packing-notes" role="list">
              {guide.notAllowed.map((note) => (
                <li key={note.text} className="packing-note packing-note--stop">
                  <span className="packing-note__flag">{OFFICIAL_LABEL}</span>
                  <span className="packing-note__text">{note.text}</span>
                  <SourceLine
                    url={note.sourceUrl}
                    title={sourceTitles[note.sourceUrl]}
                    checkedOn={note.checkedOn}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="packing-guidance__block">
          <h3 className="packing-guidance__title">Already covered</h3>
          <ul className="packing-notes" role="list">
            {guide.included.map((note) => (
              <li key={note.text} className="packing-note">
                <span className="packing-note__flag">{OFFICIAL_LABEL}</span>
                <span className="packing-note__text">{note.text}</span>
                <SourceLine
                  url={note.sourceUrl}
                  title={sourceTitles[note.sourceUrl]}
                  checkedOn={note.checkedOn}
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="packing-guidance__block">
          <h3 className="packing-guidance__title">Not published</h3>
          <p className="packing-guidance__text">
            These gaps are why the list gives no figure or rule for them. They are stated here rather
            than filled in.
          </p>
          <ul className="packing-notes packing-notes--gap" role="list">
            {guide.unpublished.map((gap) => (
              <li key={gap.text} className="packing-note packing-note--gap">
                <span className="packing-note__text">{gap.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                        */
/* -------------------------------------------------------------------------- */

interface PackingRowProps {
  readonly item: PackingItem;
  readonly packed: boolean;
  readonly sourceTitle: string | undefined;
  readonly onToggle: (id: string, checked: boolean) => void;
  readonly hiddenByFilter: boolean;
}

/**
 * One catalogue item.
 *
 * The checkbox is a real input and the label is its own `<label>`, so the hit
 * area is the full 44px row and a screen reader reads the item text as the
 * control's name. The official/suggestion distinction is carried in words, not
 * in colour.
 */
function PackingRow({ item, packed, sourceTitle, onToggle, hiddenByFilter }: PackingRowProps) {
  return (    <li
      className="packing-item"
      data-packed={packed ? "true" : undefined}
      data-basis={item.basis}
      hidden={hiddenByFilter}
    >
      <input
        id={checkboxId(item.id)}
        className="packing-item__box"
        type="checkbox"
        checked={packed}
        onChange={(event) => onToggle(item.id, event.target.checked)}
      />
      <label className="packing-item__label" htmlFor={checkboxId(item.id)}>
        <span className="packing-item__text">{item.label}</span>
        <span className="packing-item__meta">
          {item.basis === "official" ? (
            <span className="packing-tag packing-tag--official">{OFFICIAL_LABEL}</span>
          ) : (
            <span className="packing-tag packing-tag--suggestion">{SUGGESTION_LABEL}</span>
          )}
          {item.basis === "official" ? (
            <SourceLine
              url={item.sourceUrl}
              title={sourceTitle}
              checkedOn={item.checkedOn}
              compact
            />
          ) : null}
        </span>
        {item.basis === "official" ? (
          <>
            <span className="packing-item__rule">{item.rule}</span>
            {item.caveat === undefined ? null : (
              <span className="packing-item__caveat">{item.caveat}</span>
            )}
          </>
        ) : null}
      </label>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Source citation                                                             */
/* -------------------------------------------------------------------------- */

const SOURCE_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatChecked(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return SOURCE_DATE.format(parsed);
}

interface SourceLineProps {
  readonly url: string;
  readonly title: string | undefined;
  readonly checkedOn: string;
  readonly compact?: boolean;
}

/**
 * The citation under an official item.
 *
 * The visible text is the page's own title, so the link announces where it
 * goes; the read date follows it. A missing title would mean the page failed to
 * resolve it from the data, which the page build prevents, so the URL is shown
 * instead of a bare "source".
 */
function SourceLine({ url, title, checkedOn, compact = false }: SourceLineProps) {
  return (
    <span className={compact ? "packing-source packing-source--compact" : "packing-source"}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {title ?? url}
      </a>
      <span className="packing-source__date">
        <CheckSeparator />
        checked <time dateTime={checkedOn}>{formatChecked(checkedOn)}</time>
      </span>
    </span>
  );
}
