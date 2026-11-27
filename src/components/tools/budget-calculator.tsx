"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useEdition } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  BUDGET_QUERY_KEY,
  BUDGET_STORAGE_KEY,
  MAX_PEOPLE,
  MIN_PEOPLE,
  budgetLinesFor,
  budgetStateSchema,
  buildInstalmentHint,
  computeBudgetResult,
  defaultBudgetState,
  repairBudgetState,
  resolveTicket,
  type BudgetState,
  type PaymentTermsFact,
} from "./budget-state";
import { CategoryChart, CategoryTable } from "./category-chart";
import { currencyForEdition, EDITION_LABEL, TOOL_EDITIONS, type ToolCurrency, type ToolEdition } from "./editions";
import {
  AMOUNT_PROBLEM_MESSAGE,
  currencySymbol,
  formatAmount,
  formatMoney,
  parseAmountInput,
  parseWholeNumber,
} from "./format";
import { CUSTOM_TICKET_ID, ticketChoicesFor } from "./ticket-choices";
import { buildShareUrl, clearToolState, loadToolState, safeLocalStorage, saveToolState } from "./state";
import { TableScrollRegion } from "./table-scroll";

/** Text buffers for the money fields, kept exactly as typed so partial input works. */
interface Drafts {
  readonly ticketCustom: string;
  readonly accommodation: string;
  readonly travel: string;
  readonly foodDrink: string;
  readonly extras: string;
  readonly people: string;
}

/** The money fields, and the draft and state keys each one writes. */
type MoneyFieldName = "ticketCustom" | "accommodation" | "travel" | "foodDrink" | "extras";

const STATE_KEY_BY_FIELD: Readonly<Record<MoneyFieldName, keyof BudgetState>> = {
  ticketCustom: "ticketCustomMinor",
  accommodation: "accommodationMinor",
  travel: "travelMinor",
  foodDrink: "foodDrinkMinor",
  extras: "extrasMinor",
};

/** Renders minor units into a draft buffer the reader can keep editing. */
function draftOf(minor: number | null): string {
  return minor === null ? "" : formatAmount(minor);
}

function draftsFromState(state: BudgetState): Drafts {
  return {
    ticketCustom: draftOf(state.ticketCustomMinor),
    accommodation: draftOf(state.accommodationMinor),
    travel: draftOf(state.travelMinor),
    foodDrink: draftOf(state.foodDrinkMinor),
    extras: draftOf(state.extrasMinor),
    people: String(state.people),
  };
}

/**
 * True when a plan holds nothing beyond its default ticket choice, which is the
 * one case where following the site's edition is safe.
 */
function isPristine(state: BudgetState): boolean {
  return (
    state.ticketCustomMinor === null &&
    state.accommodationMinor === null &&
    state.travelMinor === null &&
    state.foodDrinkMinor === null &&
    state.extrasMinor === null &&
    !state.accommodationPerGroup &&
    state.people === 1 &&
    state.ticketId === defaultBudgetState(state.edition).ticketId
  );
}

export interface BudgetCalculatorProps {
  /**
   * The verified Winter payment-terms fact, read from the data layer on the
   * server. Absent when the edition has no such fact, which is what suppresses
   * the part-payment hint rather than an edition check hard-coded in the UI.
   */
  readonly paymentTerms?: PaymentTermsFact;
}

/**
 * The festival budget calculator.
 *
 * Three stores have to stay consistent: the validated `BudgetState` that the
 * arithmetic uses, the draft text the reader is typing, and the URL plus
 * localStorage that survive a reload or a share. Only a draft that parses
 * becomes state, so the arithmetic can never receive NaN, a negative amount or
 * a figure beyond the tool's limits.
 *
 * Nothing converts currency. The plan's edition decides whether an amount is in
 * euros or reais, and every figure on the page is shown in that one currency.
 */
export function BudgetCalculator({ paymentTerms }: BudgetCalculatorProps) {
  const { edition: siteEdition } = useEdition();

  const initial = useMemo(() => defaultBudgetState("belgium"), []);
  const [state, setState] = useState<BudgetState>(initial);
  const [drafts, setDrafts] = useState<Drafts>(() => draftsFromState(initial));
  const [hydrated, setHydrated] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const [repaired, setRepaired] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const siteEditionRef = useRef<ToolEdition>(siteEdition);
  const hydratedRef = useRef(false);

  const fieldId = useId();
  const field = useCallback((name: string) => `${fieldId}-${name}`, [fieldId]);

  const currency = currencyForEdition(state.edition);
  const choices = ticketChoicesFor(state.edition);
  const ticket = resolveTicket(state);
  const result = useMemo(() => computeBudgetResult(state), [state]);
  const hint = useMemo(
    () => buildInstalmentHint(state.edition, result.grandTotalMinor, paymentTerms),
    [state.edition, result.grandTotalMinor, paymentTerms],
  );

  /*
    The total changes silently: a sighted reader watches the figure move, but a
    screen-reader user heard nothing at all when an amount was typed. This polite
    region carries the headline sentence, and the first render is not announced
    because nothing has changed yet and the figure is already in the document.

    The update is debounced rather than immediate. Every keystroke in an amount
    field recomputes the total, and a region that spoke on each one would read
    "total one hundred and forty four ... total one hundred and forty five" over
    the reader typing. One announcement after the typing stops is what is wanted.
  */
  const [announcement, setAnnouncement] = useState("");
  const announcedOnce = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (!announcedOnce.current) {
      announcedOnce.current = true;
      return;
    }
    const timer = setTimeout(() => {
      setAnnouncement(
        result.isEmpty
          ? `Nothing entered yet. Total ${formatMoney(result.grandTotalMinor, currency)}.`
          : `Total for ${result.people} ${result.people === 1 ? "person" : "people"}: ${formatMoney(
              result.grandTotalMinor,
              currency,
            )}, ${formatMoney(result.perPersonMinor, currency)} each.`,
      );
    }, 600);
    return () => clearTimeout(timer);
  }, [hydrated, result.isEmpty, result.grandTotalMinor, result.perPersonMinor, result.people, currency]);

  /**
   * Restores the saved plan once, after hydration.
   *
   * The initial render must match the server's, so the default state renders
   * first and the stored plan replaces it here. A plan from another edition is
   * kept rather than discarded: it is the reader's own plan, and the page shows
   * which edition it belongs to.
   */
  useEffect(() => {
    const stored = loadToolState({
      schema: budgetStateSchema,
      queryKey: BUDGET_QUERY_KEY,
      storageKey: BUDGET_STORAGE_KEY,
      search: window.location.search,
      storage: safeLocalStorage(),
    });

    const candidate = stored.state ?? defaultBudgetState(siteEditionRef.current);
    const fixed = repairBudgetState(candidate);

    setState(fixed.state);
    setDrafts(draftsFromState(fixed.state));
    setDiscarded(stored.discarded);
    setRepaired(fixed.repaired);
    hydratedRef.current = true;
    setHydrated(true);
  }, []);

  /* Follow the site's edition only while the plan holds nothing worth keeping. */
  useEffect(() => {
    siteEditionRef.current = siteEdition;
    if (!hydratedRef.current) return;
    setState((current) => {
      if (current.edition === siteEdition || !isPristine(current)) return current;
      const next = defaultBudgetState(siteEdition);
      setDrafts(draftsFromState(next));
      return next;
    });
  }, [siteEdition]);

  /* Persist each committed state, but not the one before the restore. */
  useEffect(() => {
    if (!hydrated) return;
    saveToolState(safeLocalStorage(), BUDGET_STORAGE_KEY, state);
  }, [hydrated, state]);

  const commit = useCallback((next: BudgetState) => {
    setState(next);
    setShareUrl(null);
    setCopyStatus("idle");
  }, []);

  /**
   * Reads one money field. An empty buffer clears the amount rather than storing
   * zero, so the breakdown only lists what was entered; unparseable text clears
   * it too, and the field shows its own error.
   */
  const onMoneyChange = useCallback((name: MoneyFieldName, text: string) => {
    setDrafts((current) => ({ ...current, [name]: text }));
    const parsed = parseAmountInput(text);
    const stateKey = STATE_KEY_BY_FIELD[name];
    setState((current) => ({
      ...current,
      [stateKey]: parsed.kind === "valid" ? parsed.minorUnits : null,
    }));
    setShareUrl(null);
    setCopyStatus("idle");
  }, []);

  const onPeopleChange = useCallback((text: string) => {
    setDrafts((current) => ({ ...current, people: text }));
    const parsed = parseWholeNumber(text, MIN_PEOPLE, MAX_PEOPLE);
    if (parsed === null) return;
    setState((current) => ({ ...current, people: parsed }));
    setShareUrl(null);
    setCopyStatus("idle");
  }, []);

  const onEditionChange = useCallback(
    (nextEdition: ToolEdition) => {
      if (nextEdition === state.edition) return;
      const next = defaultBudgetState(nextEdition);
      commit(next);
      setDrafts(draftsFromState(next));
      setRepaired(false);
      setDiscarded(false);
    },
    [commit, state.edition],
  );

  const onReset = useCallback(() => {
    const fresh = defaultBudgetState(state.edition);
    commit(fresh);
    setDrafts(draftsFromState(fresh));
    clearToolState(safeLocalStorage(), BUDGET_STORAGE_KEY);
    setDiscarded(false);
    setRepaired(false);
  }, [commit, state.edition]);

  /**
   * Switches the ticket choice. A typed price is cleared when a published
   * product is chosen, so a stale custom figure cannot sit behind a real one.
   */
  const onTicketChange = useCallback(
    (ticketId: string) => {
      const next: BudgetState =
        ticketId === CUSTOM_TICKET_ID
          ? { ...state, ticketId }
          : { ...state, ticketId, ticketCustomMinor: null };
      commit(next);
      if (ticketId !== CUSTOM_TICKET_ID) {
        setDrafts((current) => ({ ...current, ticketCustom: "" }));
      }
    },
    [commit, state],
  );

  /** A plain-text summary, for the clipboard and for pasting into a note. */
  const summaryText = useMemo(() => {
    const lines: string[] = [
      `TMLGuide budget estimate — ${EDITION_LABEL[state.edition]} 2027, ${result.people} ${
        result.people === 1 ? "person" : "people"
      }`,
      "",
    ];
    for (const line of budgetLinesFor(state)) {
      const total = line.amountEurCents * line.quantity;
      const suffix = line.quantity > 1 ? ` × ${line.quantity}` : "";
      lines.push(`- ${line.label}${suffix}: ${formatMoney(total, currency)}`);
    }
    lines.push("");
    lines.push(`Total: ${formatMoney(result.grandTotalMinor, currency)}`);
    lines.push(`Per person: ${formatMoney(result.perPersonMinor, currency)}`);
    if (hint !== null && hint.upfrontMinor !== null && hint.balanceMinor !== null) {
      lines.push(
        `Winter part-payment: ${formatMoney(hint.upfrontMinor, currency)} at purchase, ${formatMoney(
          hint.balanceMinor,
          currency,
        )} within 30 days.`,
      );
    }
    lines.push("");
    lines.push("An independent estimate, not an official calculator. Check official prices before booking.");
    return lines.join("\n");
  }, [state, currency, result, hint]);

  const onCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText !== undefined) {
        await navigator.clipboard.writeText(summaryText);
      } else {
        // Older or restricted browsers: copy from a temporary selection.
        const area = document.createElement("textarea");
        area.value = summaryText;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(area);
        if (!copied) throw new Error("copy refused");
      }
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyStatus("idle"), 5000);
  }, [summaryText]);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    },
    [],
  );

  const onShare = useCallback(() => {
    setShareUrl(buildShareUrl(window.location.origin, window.location.pathname, BUDGET_QUERY_KEY, state));
  }, [state]);

  const onPrint = useCallback(() => {
    window.print();
  }, []);

  const customActive = state.ticketId === CUSTOM_TICKET_ID;
  const peopleValid = parseWholeNumber(drafts.people, MIN_PEOPLE, MAX_PEOPLE) !== null;

  return (
    <div>
      {discarded ? (
        <p className="tool-note tool-note--info" role="status">
          <span className="tool-note__label">Starting fresh</span>
          <span>
            A saved or shared plan could not be read, so this page started from a blank budget.
          </span>
        </p>
      ) : null}

      {repaired ? (
        <p className="tool-note tool-note--info" role="status">
          <span className="tool-note__label">Ticket changed</span>
          <span>
            The saved plan named a ticket that is not sold for {EDITION_LABEL[state.edition]}, so the
            ticket is set to that edition&rsquo;s first published price. Every other figure was kept.
          </span>
        </p>
      ) : null}

      <section className="tool-panel" aria-labelledby={field("form-heading")}>
        <div className="tool-panel__head">
          <h2 className="tool-panel__title" id={field("form-heading")}>
            Your trip
          </h2>
          <p className="tool-panel__hint">
            Amounts are per person unless a field says otherwise, and in{" "}
            {currency === "BRL" ? "Brazilian reais" : "euros"}. Leave anything you are not paying
            blank.
          </p>
        </div>

        <div className="tool-fields">
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
              Switching edition starts a new plan, because another edition has different tickets and,
              for Brasil, a different currency.
            </p>
          </div>

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={field("ticket")}>
              Ticket
            </label>
            <CustomSelect
              id={field("ticket")}
              ariaLabel="Ticket"
              value={state.ticketId}
              placeholder="Choose a ticket"
              onChange={onTicketChange}
              options={[
                ...choices.map((choice) => ({
                  value: choice.id,
                  label: `${choice.label} — ${formatMoney(choice.priceMinor, currency)}${choice.soldOut ? " (sold out)" : ""}`,
                })),
                { value: CUSTOM_TICKET_ID, label: "My own ticket price" },
              ]}
            />
            {ticket.choice === undefined ? (
              <p className="tool-field__note">
                Type the price you paid or expect to pay, per person.
              </p>
            ) : (
              <p className="tool-field__note">{ticket.choice.detail}</p>
            )}
          </div>

          {customActive ? (
            <MoneyField
              id={field("ticket-custom")}
              label="Your ticket price, per person"
              currency={currency}
              text={drafts.ticketCustom}
              onChange={(text) => onMoneyChange("ticketCustom", text)}
            />
          ) : null}

          <MoneyField
            id={field("accommodation")}
            label="Accommodation"
            currency={currency}
            text={drafts.accommodation}
            onChange={(text) => onMoneyChange("accommodation", text)}
            note={
              state.accommodationPerGroup
                ? "The whole group's accommodation, not multiplied by the group size."
                : "Per person for the whole stay."
            }
            suffix={
              <label className="tool-checkbox">
                <input
                  type="checkbox"
                  checked={state.accommodationPerGroup}
                  onChange={(event) => commit({ ...state, accommodationPerGroup: event.target.checked })}
                />
                <span>Shared total</span>
              </label>
            }
          />

          <div className="tool-fields tool-fields--two">
            <MoneyField
              id={field("travel")}
              label="Travel"
              currency={currency}
              text={drafts.travel}
              onChange={(text) => onMoneyChange("travel", text)}
            />
            <MoneyField
              id={field("food")}
              label="Food and drink"
              currency={currency}
              text={drafts.foodDrink}
              onChange={(text) => onMoneyChange("foodDrink", text)}
            />
          </div>

          <MoneyField
            id={field("extras")}
            label="Extras"
            currency={currency}
            text={drafts.extras}
            onChange={(text) => onMoneyChange("extras", text)}
            note="Lockers, merchandise, parking, anything else you are budgeting for."
          />

          <div className="tool-field">
            <label className="tool-field__label" htmlFor={field("people")}>
              Number of people
            </label>
            <input
              id={field("people")}
              className="tool-input"
              inputMode="numeric"
              autoComplete="off"
              value={drafts.people}
              aria-invalid={peopleValid ? undefined : true}
              aria-describedby={peopleValid ? field("people-note") : field("people-error")}
              onChange={(event) => onPeopleChange(event.target.value)}
              onBlur={() => {
                // Leave the field showing a figure that matches the state.
                if (!peopleValid) {
                  setDrafts((current) => ({ ...current, people: String(state.people) }));
                }
              }}
            />
            {peopleValid ? (
              <p className="tool-field__note" id={field("people-note")}>
                From {MIN_PEOPLE} to {MAX_PEOPLE}. Every per-person amount is multiplied by this.
              </p>
            ) : (
              <p className="tool-field__error" id={field("people-error")}>
                Enter a whole number from {MIN_PEOPLE} to {MAX_PEOPLE}.
              </p>
            )}
          </div>
        </div>

        <div className="tool-actions">
          <Button variant="secondary" onClick={onReset}>
            Reset
          </Button>
          <button type="button" className="tool-btn" onClick={onShare}>
            Share this plan
          </button>
          <button type="button" className="tool-btn" onClick={onCopy}>
            Copy summary
          </button>
          <button type="button" className="tool-btn" onClick={onPrint}>
            Print
          </button>
          {copyStatus === "copied" ? (
            <span className="tool-copy-status" role="status">
              Summary copied
            </span>
          ) : null}
          {copyStatus === "failed" ? (
            <span className="tool-copy-status" role="status">
              Could not copy — select the summary by hand
            </span>
          ) : null}
        </div>

        {shareUrl === null ? null : (
          <div className="tool-field" style={{ marginTop: "1.5rem" }}>
            <label className="tool-field__label" htmlFor={field("share")}>
              Shareable link
            </label>
            <input
              id={field("share")}
              className="tool-input"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
            <p className="tool-field__note">
              This link carries the whole plan, so anyone who opens it sees these figures.
            </p>
          </div>
        )}
      </section>

      <div className="tool-result">
        {/*
          The result's announcement. Visually hidden and empty on first paint, so
          nothing is read twice; it fills after the reader stops editing.
        */}
        <p className="tool-announcer" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
        <section className="tool-total" aria-labelledby={field("total-label")}>
          <p className="tool-total__label" id={field("total-label")}>
            Total for {result.people} {result.people === 1 ? "person" : "people"}
          </p>
          <p className="tool-total__figure">{formatMoney(result.grandTotalMinor, currency)}</p>
          <p className="tool-total__aside">
            {formatMoney(result.perPersonMinor, currency)} per person
            {result.splitRemainderMinor === 0
              ? ""
              : `, with ${formatMoney(Math.abs(result.splitRemainderMinor), currency)} ${
                  result.splitRemainderMinor > 0 ? "left over" : "over"
                } when split evenly`}
          </p>
          {result.isEmpty ? (
            <p className="tool-total__aside">
              Nothing entered yet. Choose a ticket or type the amounts you expect to spend.
            </p>
          ) : null}
        </section>

        <div>
          {hint === null ? null : (
            <div className="tool-note">
              <span className="tool-note__label">Pay in two parts</span>
              <p>
                Winter packages can be paid in two parts. A budget of{" "}
                {formatMoney(result.grandTotalMinor, currency)} would need{" "}
                <strong>
                  {hint.upfrontMinor === null
                    ? `at least ${hint.upfrontPercent ?? 40}% at purchase`
                    : formatMoney(hint.upfrontMinor, currency)}
                </strong>
                {hint.balanceMinor === null ? null : (
                  <>
                    {" "}
                    at purchase, with <strong>{formatMoney(hint.balanceMinor, currency)}</strong> due
                    within 30 days
                  </>
                )}
                . {hint.detailText ?? hint.valueText}
              </p>
            </div>
          )}
        </div>
      </div>

      {result.categories.length > 0 ? (
        <section className="tool-panel" aria-labelledby={field("breakdown-heading")}>
          <div className="tool-panel__head">
            <h2 className="tool-panel__title" id={field("breakdown-heading")}>
              Where the money goes
            </h2>
            <p className="tool-panel__hint">
              Each category&rsquo;s share of the total. The table repeats every figure in text.
            </p>
          </div>

          <CategoryChart categories={result.categories} currency={currency} />

          <details className="tool-disclosure" open data-print-open="true">
            <summary>Show as a table</summary>
            <CategoryTable
              categories={result.categories}
              currency={currency}
              id={field("breakdown-table")}
              caption="Category breakdown, totalled and per person"
              people={result.people}
            />
          </details>
        </section>
      ) : null}

      <section className="tool-panel" aria-labelledby={field("lines-heading")}>
        <div className="tool-panel__head">
          <h2 className="tool-panel__title" id={field("lines-heading")}>
            Line by line
          </h2>
        </div>
        <LineTable state={state} currency={currency} />
      </section>
    </div>
  );
}

interface MoneyFieldProps {
  readonly id: string;
  readonly label: string;
  readonly currency: ToolCurrency;
  readonly text: string;
  readonly onChange: (text: string) => void;
  readonly note?: string;
  readonly suffix?: ReactNode;
}

/**
 * A money input with its currency symbol, a note and an inline error.
 *
 * A text field rather than a number field, because a number input silently
 * discards text it cannot parse: a reader typing "1,234" would watch the value
 * vanish. `inputMode="decimal"` still gives phones a numeric keypad.
 */
function MoneyField({ id, label, currency, text, onChange, note, suffix }: MoneyFieldProps) {
  const parsed = parseAmountInput(text);
  const invalid = parsed.kind === "invalid";
  const errorId = `${id}-error`;
  const noteId = `${id}-note`;

  return (
    <div className="tool-field">
      <label className="tool-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="tool-field__row">
        <span className="tool-field__prefix" aria-hidden="true">
          {currencySymbol(currency)}
        </span>
        <input
          id={id}
          className="tool-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={text}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : note === undefined ? undefined : noteId}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix === undefined ? null : <span className="tool-field__suffix">{suffix}</span>}
      </div>
      {invalid ? (
        <p className="tool-field__error" id={errorId}>
          {AMOUNT_PROBLEM_MESSAGE[parsed.problem]}
        </p>
      ) : null}
      {note === undefined ? null : (
        <p className="tool-field__note" id={noteId}>
          {note}
        </p>
      )}
    </div>
  );
}

interface LineTableProps {
  readonly state: BudgetState;
  readonly currency: ToolCurrency;
}

/** The entered lines with their own totals, plus the grand total. */
function LineTable({ state, currency }: LineTableProps) {
  const lines = budgetLinesFor(state);
  const total = lines.reduce((sum, line) => sum + line.amountEurCents * line.quantity, 0);

  if (lines.length === 0) {
    return (
      <p className="tool-panel__hint">
        No amounts entered yet. Every line you fill in appears here with its own total.
      </p>
    );
  }

  return (
    <TableScrollRegion label="Each entered line, and what it costs the whole group. The table scrolls sideways on a narrow screen.">
      <table className="tool-table">
        <caption>Each entered line, and what it costs the whole group</caption>
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col" className="tool-table__amount">
              Each
            </th>
            <th scope="col" className="tool-table__amount">
              People
            </th>
            <th scope="col" className="tool-table__amount">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <th scope="row">{line.label}</th>
              <td className="tool-table__amount">{formatMoney(line.amountEurCents, currency)}</td>
              <td className="tool-table__amount">{line.quantity}</td>
              <td className="tool-table__amount">
                {formatMoney(line.amountEurCents * line.quantity, currency)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="tool-table__amount" />
            <td className="tool-table__amount" />
            <td className="tool-table__amount">{formatMoney(total, currency)}</td>
          </tr>
        </tfoot>
      </table>
    </TableScrollRegion>
  );
}
