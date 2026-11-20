"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useSyncExternalStore } from "react";
import { formatMoney } from "../format";
import {
  ARRIVAL_OPTIONS,
  EDITION_OPTIONS,
  SLEEP_OPTIONS,
  defaultJourneyState,
  type JourneyArrival,
  type JourneyEdition,
  type JourneyOption,
  type JourneySleep,
} from "./journey-state";
import { CheckSeparator } from "@/components/ui/source-check";
import { commitJourneyState, journeyStore, resetJourneyState } from "./journey-store";
import type { JourneyPlan, JourneyStep } from "./journey-logic";
import "./journey.css";

/**
 * The Journey planner.
 *
 * Three single-choice groups decide one plan, and the plan is looked up from the
 * set the page built on the server. Nothing is fetched, and nothing is derived at
 * render time that is not in the plan, which is why a step can only ever quote a
 * record that exists in `src/data` or `src/content`.
 *
 * The plan lives in `journey-store`, which reads localStorage through zod. That
 * keeps the server render and the first client render identical, and makes a
 * tampered or stale record resolve to the default plan rather than to a broken
 * screen. There is no URL state: the plan is the reader's own trip.
 */

export interface JourneyPlannerProps {
  /** Every plan, computed once on the server from the published data. */
  readonly plans: readonly JourneyPlan[];
}

const sourceDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  /* Pinned, so the server and the browser cannot disagree about the day. */
  timeZone: "UTC",
});

function formatCheckedOn(iso: string): string | null {
  const normalised = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso;
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return null;
  return sourceDateFormatter.format(date);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The departures line.
 *
 * Written as a sentence rather than a pair of cells, and it says outright when no
 * time exists, so a step can never look as though a timetable is merely missing
 * from the page.
 */
function departuresText(step: JourneyStep): string {
  const departures = step.departures;
  if (departures === undefined) return "";

  const parts: string[] = [departures.label];
  if (departures.first !== null && departures.last !== null) {
    parts.push(`first departure ${departures.first}, last ${departures.last}`);
  } else if (departures.first !== null) {
    parts.push(`first departure ${departures.first}`);
  } else if (departures.last !== null) {
    parts.push(`last departure ${departures.last}`);
  } else {
    parts.push("no departure time published for 2027");
  }
  if (departures.note !== undefined) parts.push(departures.note);

  /* The note is a sentence of its own and may already end with a stop, so the
     closing punctuation is added only once. */
  const sentence = parts.join(". ");
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/**
 * A single-choice group: a fieldset with real radios, so the legend is the
 * group's name, arrow keys move the selection and the browser gives the group one
 * tab stop.
 */
function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  note,
}: {
  readonly legend: string;
  readonly name: string;
  readonly options: readonly JourneyOption<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly note?: string;
}) {
  const noteId = `${name}-note`;

  return (
    <fieldset
      className="tool-field journey-fieldset"
      aria-describedby={note === undefined ? undefined : noteId}
    >
      <legend className="tool-field__label">{legend}</legend>
      <div className="journey-choices">
        {options.map((option) => (
          <label key={option.id} className="journey-choice">
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <span className="journey-choice__body">
              <span className="journey-choice__label">
                <span className="journey-choice__tick" aria-hidden="true">
                  ✓
                </span>
                {option.label}
              </span>
              <span className="journey-choice__note">{option.note}</span>
            </span>
          </label>
        ))}
      </div>
      {note === undefined ? null : (
        <p className="tool-field__note" id={noteId}>
          {note}
        </p>
      )}
    </fieldset>
  );
}

function Step({ step, index }: { readonly step: JourneyStep; readonly index: number }) {
  const departures = departuresText(step);

  return (
    <li className="journey-step">
      <h3 className="journey-step__title">
        <span className="journey-step__number" aria-hidden="true">
          {index + 1}
        </span>
        {step.title}
      </h3>
      <p className="journey-step__fact">{step.fact}</p>

      {step.dayPattern === undefined ? null : (
        <p className="journey-step__pattern">
          <span className="label journey-step__key">Day pattern</span> {step.dayPattern}
        </p>
      )}

      {departures === "" ? null : (
        <p className="journey-step__times">
          <span className="label journey-step__key">Departures</span> {departures}
        </p>
      )}

      {step.price === undefined ? null : (
        <p className="journey-step__price">
          <span className="label journey-step__key">Price</span>{" "}
          <strong>{formatMoney(step.price.amountMinor, "EUR")}</strong> — {step.price.label},{" "}
          {step.price.period}
          {step.price.note === undefined ? null : (
            <span className="journey-step__price-note"> {step.price.note}</span>
          )}
        </p>
      )}

      {step.gap === undefined ? null : (
        <p className="journey-step__gap">
          <span className="journey-step__gap-label">{step.gap.label}</span> {step.gap.detail}
        </p>
      )}
    </li>
  );
}

export function JourneyPlanner({ plans }: JourneyPlannerProps) {
  const snapshot = useSyncExternalStore(
    journeyStore.subscribe,
    journeyStore.getSnapshot,
    journeyStore.getServerSnapshot,
  );
  const state = snapshot.state;
  const baseId = useId();

  /**
   * The plan for the chosen combination.
   *
   * The lookup is guarded rather than trusting the snapshot: a stored plan can
   * name a bed from the other edition, and the store normalises that, but if one
   * ever reached here the plan falls back to the edition's default bed instead of
   * throwing at a reader.
   */
  const plan = useMemo<JourneyPlan>(() => {
    const exact = plans.find(
      (candidate) =>
        candidate.edition === state.edition &&
        candidate.sleep === state.sleep &&
        candidate.arrival === state.arrival,
    );
    if (exact !== undefined) return exact;

    const fallbackSleep = defaultJourneyState(state.edition).sleep;
    const repaired = plans.find(
      (candidate) =>
        candidate.edition === state.edition &&
        candidate.sleep === fallbackSleep &&
        candidate.arrival === state.arrival,
    );
    if (repaired === undefined) {
      throw new Error(`Journey planner: no plan for ${state.edition}/${state.sleep}/${state.arrival}`);
    }
    return repaired;
  }, [plans, state]);

  const onEdition = useCallback(
    (edition: JourneyEdition) => {
      if (edition === state.edition) return;
      /* The two editions share no vocabulary of beds, so the bed resets with the edition. */
      commitJourneyState({ ...state, edition, sleep: defaultJourneyState(edition).sleep });
    },
    [state],
  );

  const onSleep = useCallback(
    (sleep: JourneySleep) => commitJourneyState({ ...state, sleep }),
    [state],
  );

  const onArrival = useCallback(
    (arrival: JourneyArrival) => commitJourneyState({ ...state, arrival }),
    [state],
  );

  const onReset = useCallback(() => resetJourneyState(state.edition), [state.edition]);

  const headingId = `${baseId}-result-heading`;
  const sources = Object.values(plan.sources);
  const stepCount = `${plan.steps.length} ${plan.steps.length === 1 ? "step" : "steps"}`;

  return (
    <div>
      {snapshot.discarded ? (
        <p className="tool-note tool-note--info" role="status">
          <span className="tool-note__label">Starting fresh</span>
          <span>
            A saved plan could not be read, so the page started from the default choices. Nothing
            you did not choose has been kept.
          </span>
        </p>
      ) : null}

      {snapshot.repaired ? (
        <p className="tool-note tool-note--info" role="status">
          <span className="tool-note__label">Bed reset</span>
          <span>
            The saved plan named a place to sleep that this edition does not have, so that one
            choice was reset. Your edition and arrival method were kept.
          </span>
        </p>
      ) : null}

      <section className="tool-panel" aria-labelledby={`${baseId}-form-heading`}>
        <div className="tool-panel__head">
          <h2 className="tool-panel__title" id={`${baseId}-form-heading`}>
            Your trip
          </h2>
          <p className="tool-panel__hint">
            Three answers decide the route. Each one changes which published facts apply, and the
            steps below are rebuilt from those facts rather than adjusted by hand.
          </p>
        </div>

        <div className="tool-fields">
          <ChoiceGroup
            legend="Edition"
            name={`${baseId}-edition`}
            options={EDITION_OPTIONS}
            value={state.edition}
            onChange={onEdition}
            note="Brasil is not offered here: no verified timetable or fares are published for Parque Maeda, so a Brasil route would be guesswork."
          />

          <ChoiceGroup
            legend="Where you are sleeping"
            name={`${baseId}-sleep`}
            options={SLEEP_OPTIONS[state.edition]}
            value={state.sleep}
            onChange={onSleep}
            note="Only the arrangements the published data describes are offered, so every option leads to facts rather than assumptions."
          />

          <ChoiceGroup
            legend="How you arrive"
            name={`${baseId}-arrival`}
            options={ARRIVAL_OPTIONS}
            value={state.arrival}
            onChange={onArrival}
          />
        </div>

        <div className="tool-actions">
          <button type="button" className="tool-btn" onClick={onReset}>
            Reset choices
          </button>
        </div>
      </section>

      {/*
        The live part is the summary only. Announcing the whole step list on every
        control change would bury the one sentence a reader needs, and the steps
        below are already in reading order for anyone who navigates to them.
      */}
      <section className="tool-panel journey-result" aria-labelledby={headingId}>
        <div className="journey-result__summary" aria-live="polite" aria-atomic="true">
          <h2 className="journey-section__title journey-result__title" id={headingId}>
            Your route
          </h2>
          <p className="journey-result__headline">{plan.headline}</p>
          <p className="tool-panel__hint">
            {plan.intro} {stepCount}.
          </p>
        </div>

        <ol className="journey-steps">
          {plan.steps.map((item, index) => (
            <Step key={item.id} step={item} index={index} />
          ))}
        </ol>

        <div className="journey-sources">
          <h3 className="journey-sources__title">Sources for these steps</h3>
          <ul className="journey-sources__list" role="list">
            {sources.map((source) => {
              const checked = formatCheckedOn(source.checkedOn);
              return (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  {checked === null ? null : (
                    <span className="journey-sources__date">
                      <CheckSeparator />
                      Checked <time dateTime={source.checkedOn}>{checked}</time>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="journey-decisions" aria-labelledby={`${baseId}-decisions`}>
        <h2 className="journey-section__title" id={`${baseId}-decisions`}>
          Order of decisions
        </h2>
        <p className="journey-section__lede">{plan.decisions.intro}</p>
        <ol className="journey-decisions__list">
          {plan.decisions.items.map((item) => (
            <li key={item.text}>
              {item.text}
              <span className="journey-decisions__source">
                {item.sourceUrls.map((url) => {
                  const source = plan.sources[url];
                  if (source === undefined) return null;
                  return (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      {hostOf(url)}
                      <span className="sr-only">{` — source for this decision, ${source.title} (opens in a new tab)`}</span>
                    </a>
                  );
                })}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="journey-limits" aria-labelledby={`${baseId}-limits`}>
        <h2 className="journey-section__title" id={`${baseId}-limits`}>
          What this planner leaves out
        </h2>
        <ul className="journey-limits__list">
          <li>
            <strong>Brasil.</strong> No verified timetable or fares are published for Parque Maeda, so
            no Brasil route is offered.{" "}
            <Link href="/guides/brasil/transport">
              Brasil transport chapter: what the official pages state
            </Link>
            .
          </li>
          <li>
            <strong>Journey times.</strong> No step estimates one. The only times on the page are
            departures an operator publishes, and a road time an operator states.
          </li>
          <li>
            <strong>Prices.</strong> A price appears only where an operator publishes one, in euros,
            with the season it belongs to. Where a fare is missing, the step says so instead of
            showing a figure from an earlier year.
          </li>
          <li>
            <strong>Walking and waiting times.</strong> Left out except where an official page states
            one, such as the 20-minute walk from Boom station.
          </li>
        </ul>
      </section>
    </div>
  );
}
