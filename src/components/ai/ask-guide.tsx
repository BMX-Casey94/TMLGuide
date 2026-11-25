"use client";

/**
 * The "Ask the guide" client.
 *
 * A form, a cited answer panel, and honest failure states. Everything the reader
 * sees is either their own input, a refusal string the server chose, or a
 * citation the server assembled from its own records — never model output
 * rendered as HTML. The answer is set as text content with `white-space:
 * pre-wrap`, so a model that emits markup renders it as characters rather than
 * as structure.
 *
 * Accessibility decisions, each of which has a reason:
 *
 * - One `<h2>`-labelled form region and one `role="status"` region. A screen
 *   reader hears "Thinking" once when the request starts and the answer once
 *   when it lands, rather than a stream of intermediate states.
 * - The submit button is disabled while a request is in flight, and the input
 *   stays editable, so a reader can rewrite the question while waiting instead of
 *   losing it.
 * - A field error is bound with `aria-describedby` and `aria-invalid`, and the
 *   error summary carries `role="alert"` so it is announced immediately.
 * - Focus moves to the answer heading after a successful response. Without it, a
 *   keyboard user is left at the bottom of the form with no signal that anything
 *   arrived.
 * - The character counter is `aria-live="off"`: announcing a count on every
 *   keystroke is noise. It is still readable on demand.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { Edition } from "@/lib/ai/knowledge";
import { TurnstileWidget } from "./turnstile-widget";
import "./ai.css";

/** The response contract from `POST /api/ask`. */
interface AskCitation {
  readonly index: number;
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  readonly lastVerified: string;
  readonly live: boolean;
}

interface AskAnswer {
  readonly answer: string;
  readonly citations: readonly AskCitation[];
  readonly lastVerified: string | null;
  readonly refusal: { readonly reason: string; readonly message: string } | null;
  readonly model: string;
}

export const MAX_QUESTION_LENGTH = 500;

interface EditionOption {
  readonly value: Edition;
  readonly label: string;
}

export const EDITION_OPTIONS: readonly EditionOption[] = [
  { value: "all", label: "All editions" },
  { value: "belgium", label: "Belgium" },
  { value: "winter", label: "Winter" },
  { value: "brasil", label: "Brasil" },
];

/** The prompt chips, so a reader with no question in mind has somewhere to start. */
export const STARTER_QUESTIONS: readonly string[] = [
  "How much is a Belgium 2027 day pass?",
  "What is the ticket limit per Tomorrowland Account?",
  "How much is the Winter 7-Day Festival Ticket?",
  "Is one Pearl worth the same in 2027?",
];

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "18 Nov 2026", or null when the value is not a parseable date. */
export function formatCheckedDate(iso: string | null): string | null {
  if (iso === null) return null;
  const normalised = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso;
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return null;
  return DATE_FORMATTER.format(date);
}

/** True when the response body has the shape this component renders. */
function isAskAnswer(value: unknown): value is AskAnswer {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AskAnswer>;
  if (typeof candidate.answer !== "string") return false;
  if (!Array.isArray(candidate.citations)) return false;
  if (candidate.refusal !== null && typeof candidate.refusal !== "object") return false;
  return typeof candidate.model === "string";
}

type Status = "idle" | "loading" | "answered" | "refused" | "error";

interface AskGuideProps {
  /**
   * The Cloudflare Turnstile site key, when the deployment has one.
   *
   * Passed as a prop rather than read from `process.env` here so the value is
   * inlined at build time on the server and this component stays free of
   * environment access, which a client bundle must not have.
   */
  readonly turnstileSiteKey?: string;
}

export function AskGuide({ turnstileSiteKey }: AskGuideProps) {
  const [question, setQuestion] = useState("");
  const [edition, setEdition] = useState<Edition>("all");
  const [status, setStatus] = useState<Status>("idle");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const answerHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();
  const counterId = useId();

  const remaining = MAX_QUESTION_LENGTH - question.length;
  const loading = status === "loading";

  // A request in flight is cancelled if the reader navigates away, so a closed tab
  // does not leave a provider call running against the monthly budget.
  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  const submit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmed = question.trim();
      if (trimmed.length < 3) {
        setFieldError("Please type a question of at least three characters.");
        setErrorMessage(null);
        setStatus("error");
        inputRef.current?.focus();
        return;
      }

      setFieldError(null);
      setErrorMessage(null);
      setAnswer(null);
      setStatus("loading");

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            edition,
            ...(turnstileToken === null ? {} : { turnstileToken }),
          }),
          signal: controller.signal,
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          // The route's own message is used when it has one, because it is written
          // for a reader. A bare status code is not.
          const message =
            typeof payload === "object" && payload !== null && typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "The guide could not answer that just now. Please try again.";
          setErrorMessage(message);
          setStatus("error");
          return;
        }

        if (!isAskAnswer(payload)) {
          setErrorMessage("The guide returned something unexpected. Please try again.");
          setStatus("error");
          return;
        }

        setAnswer(payload);
        setStatus(payload.refusal === null ? "answered" : "refused");

        // The Turnstile token is single-use; a second question needs a fresh one.
        setTurnstileToken(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErrorMessage("The guide could not be reached. Check your connection and try again.");
        setStatus("error");
      }
    },
    [question, edition, turnstileToken],
  );

  // Focus the answer heading once it exists, so a keyboard user is taken to the
  // result rather than left at the submit button.
  useEffect(() => {
    if (status === "answered" || status === "refused") answerHeadingRef.current?.focus();
  }, [status]);

  const reset = useCallback(() => {
    requestRef.current?.abort();
    setQuestion("");
    setAnswer(null);
    setErrorMessage(null);
    setFieldError(null);
    setStatus("idle");
    inputRef.current?.focus();
  }, []);

  const checkedDate = formatCheckedDate(answer?.lastVerified ?? null);

  return (
    <div className="tml-ai-panel">
      <form className="tml-ai-form" onSubmit={submit} noValidate aria-labelledby={`${fieldId}-form-heading`}>
        <h2 id={`${fieldId}-form-heading`} className="tml-ai-label">
          Ask a question
        </h2>

        <div className="tml-ai-field">
          <label className="tml-ai-label" htmlFor={fieldId}>
            Your question
          </label>
          <textarea
            ref={inputRef}
            id={fieldId}
            className="tml-ai-input"
            name="question"
            rows={3}
            maxLength={MAX_QUESTION_LENGTH}
            value={question}
            disabled={loading}
            placeholder="How much is a Belgium 2027 Full Madness Pass?"
            aria-describedby={`${hintId} ${counterId}${fieldError === null ? "" : ` ${errorId}`}`}
            aria-invalid={fieldError === null ? undefined : true}
            onChange={(event) => {
              setQuestion(event.target.value);
              if (fieldError !== null) setFieldError(null);
            }}
          />
          <p id={hintId} className="tml-ai-hint">
            One question at a time, and a specific one gets a better answer. The guide only covers
            what its checked records contain.
          </p>
          <p id={counterId} className="tml-ai-hint" aria-live="off">
            {question.length} of {MAX_QUESTION_LENGTH} characters
            {remaining <= 50 && remaining >= 0 ? ` — ${remaining} left` : ""}
          </p>
          {fieldError === null ? null : (
            <p id={errorId} className="tml-ai-error" role="alert">
              {fieldError}
            </p>
          )}
        </div>

        <div className="tml-ai-field">
          <span className="tml-ai-label" id={`${fieldId}-edition-label`}>
            Edition
          </span>
          <div className="tml-ai-chips" role="group" aria-labelledby={`${fieldId}-edition-label`}>
            {EDITION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="tml-ai-chip"
                aria-pressed={edition === option.value}
                disabled={loading}
                onClick={() => setEdition(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {turnstileSiteKey === undefined ? null : (
          <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
        )}

        <div className="tml-ai-actions">
          <button type="submit" className="tml-ai-submit" disabled={loading}>
            {loading ? "Reading the guide…" : "Ask the guide"}
          </button>
          {question.length > 0 || answer !== null || errorMessage !== null ? (
            <button type="button" className="tml-ai-clear" onClick={reset} disabled={loading}>
              Clear
            </button>
          ) : null}
        </div>

        <p className="tml-ai-hint">
          Not sure what to ask?{" "}
          {STARTER_QUESTIONS.map((starter, index) => (
            <span key={starter}>
              {index === 0 ? null : " · "}
              <button
                type="button"
                className="tml-ai-chip"
                style={{ minHeight: "auto", padding: "0.2rem 0.6rem" }}
                disabled={loading}
                onClick={() => {
                  setQuestion(starter);
                  inputRef.current?.focus();
                }}
              >
                {starter}
              </button>
            </span>
          ))}
        </p>
      </form>

      {/*
        One status region for the whole request lifecycle. A polite live region is
        right here: the reader asked a question and is waiting, so an announcement
        when the state changes is helpful rather than intrusive.
      */}
      <div role="status" aria-live="polite" className="tml-ai-sr-only">
        {loading ? "Reading the guide." : status === "answered" ? "The guide has answered." : ""}
      </div>

      {errorMessage === null ? null : (
        <div className="tml-ai-answer" role="alert">
          <div className="tml-ai-answer__head">
            <span className="tml-ai-answer__kicker">Could not answer</span>
          </div>
          <p className="tml-ai-refusal">{errorMessage}</p>
          <p className="tml-ai-hint">
            Nothing was stored. You can try again, or read the same facts in the{" "}
            <Link href="/guides">guides</Link>.
          </p>
        </div>
      )}

      {answer === null ? null : (
        <section className="tml-ai-answer" aria-labelledby={`${fieldId}-answer-heading`}>
          <div className="tml-ai-answer__head">
            <h2
              id={`${fieldId}-answer-heading`}
              ref={answerHeadingRef}
              tabIndex={-1}
              className="tml-ai-answer__kicker"
            >
              {answer.refusal === null ? "From the guide's checked records" : "This one is not answerable"}
            </h2>
            {answer.refusal === null ? (
              <span className="tml-ai-answer__model">Answered by {answer.model}</span>
            ) : null}
          </div>

          {answer.refusal === null ? (
            <p className="tml-ai-answer__body">{answer.answer}</p>
          ) : (
            <p className="tml-ai-refusal">
              <strong className="tml-ai-refusal__title">{refusalLabel(answer.refusal.reason)}</strong>
              {answer.refusal.message}
            </p>
          )}

          {answer.citations.length === 0 ? null : (
            <ul className="tml-ai-citations">
              {answer.citations.map((citation) => {
                const date = formatCheckedDate(citation.lastVerified);
                return (
                  <li key={`${citation.index}-${citation.sourceUrl}`} className="tml-ai-citation">
                    <span className="tml-ai-citation__index" aria-hidden="true">
                      {citation.index}
                    </span>
                    <span>
                      <a
                        className="tml-ai-citation__link"
                        href={citation.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {citation.sourceTitle}
                      </a>
                      <span className="tml-ai-citation__meta">
                        {date === null ? "Check date unavailable" : `Checked ${date}`}
                        {citation.live ? <span className="tml-ai-citation__live">Read just now</span> : null}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {checkedDate === null ? null : (
            <p className="tml-ai-freshness">
              As fresh as <time dateTime={answer.lastVerified ?? undefined}>{checkedDate}</time>. Every
              fact above is on the linked page, which is the source worth checking before you spend.
            </p>
          )}

          {answer.refusal === null ? (
            <p className="tml-ai-hint">
              Answers come from this guide&rsquo;s verified records, not from Tomorrowland. Prices and dates
              can change; confirm anything you are about to pay for on the official page.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}

/** A short heading for each refusal reason, so the panel never says "Error". */
export function refusalLabel(reason: string): string {
  switch (reason) {
    case "no-sources":
      return "No verified answer";
    case "not-published":
      return "Not published";
    case "out-of-scope":
      return "Outside what this guide covers";
    case "spend-cap":
      return "Monthly limit reached";
    case "provider-unavailable":
      return "Service unavailable";
    case "unconfigured":
      return "Not switched on here";
    case "prompt-injection":
      return "Instruction refused";
    default:
      return "Not answered";
  }
}
