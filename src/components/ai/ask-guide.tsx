"use client";

/**
 * The "Ask the guide" client, as a chat surface rather than a form.
 *
 * The API is unchanged: one `POST /api/ask` per question, the same request body and
 * the same `AskResponseBody`. What changed is the shape of the interface — a fixed
 * header, a scrolling thread and a composer pinned to the bottom of the card, which
 * is how a reader expects an assistant to behave and which keeps the question box in
 * one place instead of below a growing answer.
 *
 * Everything the reader sees is either their own input, a refusal string the server
 * chose, or a citation the server assembled from its own records — never model output
 * rendered as HTML. An answer is split into paragraphs and each is set as text content
 * with `white-space: pre-wrap`, so a model that emits markup renders it as characters
 * rather than as structure.
 *
 * ## What is deliberately *not* here
 *
 * No `localStorage`, no `sessionStorage`, no cookie, no request that writes the thread
 * anywhere. The conversation is React state and dies with the tab. The page promises
 * that questions are not kept as transcripts, and that promise is only true because
 * there is nowhere in this file that could keep one.
 *
 * ## Accessibility decisions, each of which has a reason
 *
 * - **One announcement channel.** A single visually hidden `role="status"` region,
 *   placed before the thread in the DOM, carries the outcome: "The guide has answered",
 *   or the refusal reason. While a request is in flight it stays empty, because the
 *   thinking bubble is itself a polite status and saying "Reading the guide" twice is
 *   noise. Putting it first also means the visible thread can grow without moving the
 *   live region, which some screen readers handle badly.
 * - **Focus stays in the composer.** After an answer the reader is still in the text
 *   field, so a follow-up is one keystroke away; the status region is what tells them
 *   the answer arrived. Moving focus into the thread, as a one-shot answer panel would,
 *   would fight the conversation.
 * - **Send is disabled until the question is usable.** The field error is a fallback
 *   for Enter on a question that is too short, not the primary way to find out.
 * - **The thread is a list.** Count and position come from real list semantics rather
 *   than from visual stacking.
 * - **The character counter is `aria-live="off"`.** Announcing a count on every
 *   keystroke is noise; it is still readable on demand and bound with
 *   `aria-describedby`.
 * - **A request in flight is cancelled** when the component unmounts or the reader
 *   starts a new chat, so a closed tab does not leave a provider call running against
 *   the monthly budget.
 */

import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
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

/** Matches `MIN_QUESTION_CHARS` in `src/lib/ai/prompt.ts`, which the route enforces. */
const MIN_QUESTION_LENGTH = 3;

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

/** The starter prompts, so a reader with no question in mind has somewhere to start. */
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

/**
 * Splits an answer on blank lines so each block is its own paragraph.
 *
 * A single newline is kept inside a paragraph (the stylesheet preserves it), because a
 * model that lists two figures on consecutive lines means two lines, not one.
 */
function answerParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

type TurnStatus = "loading" | "answered" | "refused" | "error";

interface Turn {
  readonly id: number;
  readonly question: string;
  readonly edition: Edition;
  readonly status: TurnStatus;
  readonly answer: AskAnswer | null;
  readonly errorMessage: string | null;
}

interface AskGuideProps {
  /**
   * The Cloudflare Turnstile site key, when the deployment has one.
   *
   * Passed as a prop rather than read from `process.env` here so the value is inlined
   * at build time on the server and this component stays free of environment access,
   * which a client bundle must not have.
   */
  readonly turnstileSiteKey?: string;
}

const DEFAULT_EDITION_LABEL = "All editions";

/** The two composer errors, named once so the keyboard path and the button path agree. */
const TOO_SHORT = "Please type a question of at least three characters.";
const CHECK_PENDING = "The verification check has not finished. Please try again in a moment.";

export function AskGuide({ turnstileSiteKey }: AskGuideProps) {
  const [question, setQuestion] = useState("");
  const [edition, setEdition] = useState<Edition>("all");
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  /*
    Bumped after every request. A Turnstile token is single use, and the widget only
    issues one per mount, so remounting it is what gives the next question a fresh
    token. Without this the second question in a conversation would always be refused.
  */
  const [turnstileRound, setTurnstileRound] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const nextTurnId = useRef(0);
  /*
    A synchronous in-flight guard. `pending` is derived from state, so it is only correct
    after React has re-rendered; two Enter presses in the same tick would both pass a
    `pending` check, and the second request would abort the first and leave its turn
    stuck on "Reading the guide" for ever. This ref is written before any await.
  */
  const busyRef = useRef(false);

  const fieldId = useId();
  const headingId = useId();
  const hintId = useId();
  const errorId = useId();
  const counterId = useId();
  const editionLabelId = useId();

  const pending = turns.some((turn) => turn.status === "loading");
  const lastTurn = turns.length === 0 ? undefined : turns[turns.length - 1];
  const verificationReady = turnstileSiteKey === undefined || turnstileToken !== null;
  const trimmed = question.trim();
  /*
    Send is disabled only when there is nothing to send. A too-short question keeps the
    button live so that pressing it produces the sentence that explains the problem,
    rather than a control that refuses without saying why.
  */
  const canSend = !pending && trimmed.length > 0;
  const nearLimit = MAX_QUESTION_LENGTH - question.length <= 50;
  const editionLabel =
    EDITION_OPTIONS.find((option) => option.value === edition)?.label ?? DEFAULT_EDITION_LABEL;

  // A request in flight is cancelled if the reader navigates away.
  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  /*
    Grow the field with the question, up to a cap. A two-row box with an inner scrollbar
    hides the start of a long question while the reader is still typing it, which is the
    one moment they need to see all of it. Past the cap the box scrolls, so the composer
    cannot swallow the thread.
  */
  useEffect(() => {
    const node = inputRef.current;
    if (node === null) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 180)}px`;
  }, [question]);

  /*
    Follow the newest message. `turns` is a new array on every append and every settle,
    so this runs when a question is asked and again when its answer lands — which is the
    moment the thread actually grew. Reduced motion turns the glide into a jump.
  */
  useEffect(() => {
    const node = viewportRef.current;
    if (node === null) return;
    const reduceMotion =
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
      document.documentElement.dataset.a11yMotion === "reduce";
    const top = node.scrollHeight;
    if (typeof node.scrollTo === "function") {
      try {
        node.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
        return;
      } catch {
        // Fall through to the property assignment below.
      }
    }
    node.scrollTop = top;
  }, [turns]);

  /**
   * Sends one question and settles the turn it belongs to.
   *
   * `existingId` is how a retry works: the same bubble is put back into its working
   * state and updated in place, rather than being deleted and appended again. That
   * matters because the guards below can refuse before a request is made, and a reader
   * whose retry bounced would otherwise have watched their question disappear.
   */
  const ask = useCallback(
    async (rawQuestion: string, scope: Edition, existingId?: number) => {
      const asked = rawQuestion.trim();
      const id = existingId ?? nextTurnId.current;

      const refuse = (message: string) => {
        if (existingId === undefined) {
          setFieldError(message);
          inputRef.current?.focus();
          return;
        }
        setTurns((current) =>
          current.map((turn) =>
            turn.id === id ? { ...turn, status: "error", answer: null, errorMessage: message } : turn,
          ),
        );
      };

      if (asked.length < MIN_QUESTION_LENGTH) {
        refuse(TOO_SHORT);
        return;
      }
      if (turnstileSiteKey !== undefined && turnstileToken === null) {
        refuse(CHECK_PENDING);
        return;
      }

      if (existingId === undefined) nextTurnId.current += 1;
      const token = turnstileToken;
      busyRef.current = true;
      setFieldError(null);
      setTurns((current) =>
        existingId === undefined
          ? [
              ...current,
              { id, question: asked, edition: scope, status: "loading", answer: null, errorMessage: null },
            ]
          : current.map((turn) =>
              turn.id === id ? { ...turn, status: "loading", answer: null, errorMessage: null } : turn,
            ),
      );
      // A token is spent whether or not the request succeeds, so it is dropped now
      // rather than being reused by the next attempt.
      setTurnstileToken(null);

      const settle = (patch: Partial<Pick<Turn, "status" | "answer" | "errorMessage">>) => {
        setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));
      };

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: asked,
            edition: scope,
            ...(token === null ? {} : { turnstileToken: token }),
          }),
          signal: controller.signal,
        });

        const payload: unknown = await response.json().catch(() => null);

        /*
          A well-formed body wins over the status code. The route answers a refusal with a
          200, but it also uses `503` for the two cases where the service itself is missing
          or broken — and those bodies are refusals too, with a reason and a message
          written for a reader. Treating `!response.ok` first would throw that away and
          replace "not configured on this deployment" with a generic apology.
        */
        if (isAskAnswer(payload)) {
          settle({
            status: payload.refusal === null ? "answered" : "refused",
            answer: payload,
            errorMessage: null,
          });
          return;
        }

        if (!response.ok) {
          // No usable body, so the route's own message is the next best thing: it is
          // still written for a reader. A bare status code is not.
          const message =
            typeof payload === "object" && payload !== null && typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "The guide could not answer that just now. Please try again.";
          settle({ status: "error", answer: null, errorMessage: message });
          return;
        }

        settle({
          status: "error",
          answer: null,
          errorMessage: "The guide returned something unexpected. Please try again.",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        settle({
          status: "error",
          answer: null,
          errorMessage: "The guide could not be reached. Check your connection and try again.",
        });
      } finally {
        /*
          The guard is released only by the request that still owns the slot. A request
          superseded by New chat or by a newer question must not clear a guard that the
          newer one has set, and must not reset the Turnstile widget the reader is now
          looking at.
        */
        const isCurrent = requestRef.current === controller;
        if (isCurrent) {
          busyRef.current = false;
          requestRef.current = null;
          // The token was spent by the request that carried it, so a fresh widget is what
          // gives the next question a token at all.
          if (token !== null && turnstileSiteKey !== undefined) {
            setTurnstileRound((round) => round + 1);
          }
        }
      }
    },
    [turnstileSiteKey, turnstileToken],
  );

  const send = useCallback(() => {
    const asked = question.trim();
    // The ref, not `pending`: see its declaration. Two fast Enter presses would otherwise
    // both pass a state-derived check in the same tick.
    if (busyRef.current || pending) return;
    // Enter on an empty box does nothing. Telling a reader off for pressing Enter in an
    // empty field is noise; the button is disabled in that state for the same reason.
    if (asked.length === 0) return;
    // The box is only cleared once the question is on its way, so a guard message below
    // leaves the text where the reader can act on it.
    if (asked.length < MIN_QUESTION_LENGTH) {
      setFieldError(TOO_SHORT);
      inputRef.current?.focus();
      return;
    }
    if (turnstileSiteKey !== undefined && turnstileToken === null) {
      setFieldError(CHECK_PENDING);
      inputRef.current?.focus();
      return;
    }
    setFieldError(null);
    setQuestion("");
    void ask(asked, edition);
    inputRef.current?.focus();
  }, [ask, edition, pending, question, turnstileSiteKey, turnstileToken]);

  /*
    A starter is the reader saying "ask that". Where the deployment needs no challenge,
    or has already produced a token, it is sent immediately — that is what a real chat
    does. Otherwise it fills the box and takes focus, so the reader can finish the
    thought or press Ask once the check completes.
  */
  const chooseStarter = useCallback(
    (starter: string) => {
      if (busyRef.current || pending) return;
      if (verificationReady) {
        setQuestion("");
        void ask(starter, edition);
        return;
      }
      setQuestion(starter);
      setFieldError(null);
      inputRef.current?.focus();
    },
    [ask, edition, pending, verificationReady],
  );

  const retry = useCallback(
    (turn: Turn) => {
      if (busyRef.current || pending) return;
      void ask(turn.question, turn.edition, turn.id);
    },
    [ask, pending],
  );

  const startNewChat = useCallback(() => {
    requestRef.current?.abort();
    // Cleared so the aborted request's `finally` can see it is no longer current and
    // leaves the fresh Turnstile widget and the in-flight guard alone. The guard is
    // released here, because that `finally` will not release it.
    requestRef.current = null;
    busyRef.current = false;
    setTurns([]);
    setQuestion("");
    setFieldError(null);
    setTurnstileToken(null);
    if (turnstileSiteKey !== undefined) setTurnstileRound((round) => round + 1);
    inputRef.current?.focus();
  }, [turnstileSiteKey]);

  /*
    The single announcement channel, and it covers the working state as well as the
    outcome. It is a persistent node rather than something rendered with the bubble,
    because a live region that arrives already containing text is not announced.
  */
  const announcement =
    lastTurn === undefined
      ? ""
      : lastTurn.status === "loading"
        ? "Reading the guide."
        : lastTurn.status === "error" || lastTurn.answer === null
          ? ""
          : lastTurn.answer.refusal === null
            ? "The guide has answered."
            : `The guide could not answer this one: ${refusalLabel(lastTurn.answer.refusal.reason)}.`;

  return (
    <section className="tml-ai-chat" aria-labelledby={headingId}>
      <header className="tml-ai-chat__head">
        <div className="tml-ai-chat__identity">
          <span className="tml-ai-chat__mark" aria-hidden="true" />
          <h2 id={headingId} className="tml-ai-chat__name">
            TMLGuide Assistant
          </h2>
          <span className="tml-ai-chat__badge">{editionLabel}</span>
        </div>
        {turns.length === 0 ? null : (
          <button type="button" className="tml-ai-chat__new" onClick={startNewChat}>
            New chat
          </button>
        )}
      </header>

      {/*
        The one live region. It is empty until something is worth saying, so the first
        change is what a screen reader hears.
      */}
      <p role="status" aria-live="polite" className="tml-ai-sr-only">
        {announcement}
      </p>

      <div
        className="tml-ai-chat__viewport"
        ref={viewportRef}
        role="group"
        aria-label="Conversation"
        /*
          Focusable only once there is a thread. On an empty state the region holds four
          buttons, all reachable on their own, so a tab stop on the container would be a
          stop with nothing to do. With messages it is a scroll container, and a keyboard
          user needs to be able to reach it to scroll.
        */
        tabIndex={turns.length === 0 ? undefined : 0}
        data-empty={turns.length === 0 ? "true" : "false"}
      >
        {turns.length === 0 ? (
          <ChatWelcome onChoose={chooseStarter} disabled={pending} />
        ) : (
          <ol className="tml-ai-thread" role="list">
            {turns.map((turn) => (
              <Fragment key={turn.id}>
                <li className="tml-ai-msg tml-ai-msg--user">
                  <p className="tml-ai-msg__bubble">
                    <span className="tml-ai-sr-only">You asked: </span>
                    {turn.question}
                  </p>
                </li>
                <li className="tml-ai-msg tml-ai-msg--assistant">
                  <AssistantMessage turn={turn} onRetry={retry} />
                </li>
              </Fragment>
            ))}
          </ol>
        )}
      </div>

      <form
        className="tml-ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        noValidate
      >
        <div className="tml-ai-composer__shell">
          <label className="tml-ai-sr-only" htmlFor={fieldId}>
            Your question
          </label>
          <textarea
            ref={inputRef}
            id={fieldId}
            className="tml-ai-composer__input"
            name="question"
            rows={2}
            maxLength={MAX_QUESTION_LENGTH}
            value={question}
            placeholder="Ask about Belgium, Winter or Brasil tickets, DreamVille, dates..."
            aria-describedby={`${hintId} ${counterId}${fieldError === null ? "" : ` ${errorId}`}`}
            aria-invalid={fieldError === null ? undefined : true}
            onChange={(event) => {
              setQuestion(event.target.value);
              if (fieldError !== null) setFieldError(null);
            }}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter is a new line. `isComposing` keeps Enter from
              // submitting while an input method is still building a character.
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              send();
            }}
          />
          <div className="tml-ai-composer__actions">
            <label className="tml-ai-sr-only" htmlFor={editionLabelId}>
              Edition
            </label>
            <select
              id={editionLabelId}
              className="tml-ai-edition-select"
              aria-label="Edition"
              value={edition}
              onChange={(event) => setEdition(event.target.value as Edition)}
            >
              {EDITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="tml-ai-send"
              disabled={!canSend}
              aria-label={pending ? "Reading the guide" : "Ask the guide"}
            >
              <span>{pending ? "Reading" : "Ask"}</span>
              <svg
                className="tml-ai-send__arrow"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M12 19V5M12 5l-6 6M12 5l6 6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="tml-ai-composer__foot">
          <p id={hintId} className="tml-ai-composer__hint">
            Enter to send · Shift+Enter for new line
          </p>
          <p
            id={counterId}
            className="tml-ai-composer__count"
            data-near={nearLimit ? "true" : "false"}
            aria-live="off"
          >
            {question.length} / {MAX_QUESTION_LENGTH}
          </p>
        </div>

        {fieldError === null ? null : (
          <p id={errorId} className="tml-ai-error" role="alert">
            {fieldError}
          </p>
        )}

        {turnstileSiteKey === undefined ? null : (
          <div className="tml-ai-composer__verify">
            <TurnstileWidget
              key={turnstileRound}
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
            />
          </div>
        )}
      </form>
    </section>
  );
}

/** The empty state: who the guide is, and four questions that are worth asking. */
function ChatWelcome({
  onChoose,
  disabled,
}: {
  readonly onChoose: (starter: string) => void;
  readonly disabled: boolean;
}) {
  return (
    <div className="tml-ai-empty">
      <p className="tml-ai-empty__greeting">Ask about tickets, dates or DreamVille</p>
      <p className="tml-ai-empty__lede">
        Verified answers from checked Tomorrowland records — with official sources beside every claim.
      </p>
      <ul className="tml-ai-starters" role="list">
        {STARTER_QUESTIONS.map((starter) => (
          <li key={starter}>
            <button
              type="button"
              className="tml-ai-starter"
              disabled={disabled}
              onClick={() => onChoose(starter)}
            >
              <span className="tml-ai-starter__text">{starter}</span>
              <svg
                className="tml-ai-starter__arrow"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One assistant bubble: thinking, answer, refusal or error. */
function AssistantMessage({ turn, onRetry }: { readonly turn: Turn; readonly onRetry: (turn: Turn) => void }) {
  // Per-instance, so two of these can never produce the same citation-label id.
  const citesLabelId = useId();

  if (turn.status === "loading") {
    /*
      Not a live region: the hidden status region above already says "Reading the guide",
      and a polite region that appears with its text already inside is not announced.
      The dots are decorative, so they are hidden and only the word is read.
    */
    return (
      <div className="tml-ai-msg__bubble tml-ai-thinking-bubble">
        <span className="tml-ai-thinking" aria-hidden="true">
          <span className="tml-ai-thinking__dot" />
          <span className="tml-ai-thinking__dot" />
          <span className="tml-ai-thinking__dot" />
        </span>
        Reading the guide
      </div>
    );
  }

  if (turn.status === "error") {
    return (
      <div className="tml-ai-msg__bubble tml-ai-msg__bubble--error" role="alert">
        <p className="tml-ai-errorcard__title">That question was not answered</p>
        <p className="tml-ai-errorcard__body">{turn.errorMessage}</p>
        <p className="tml-ai-errorcard__note">
          Nothing was stored. You can try again, or read the same facts in the{" "}
          <Link href="/guides">guides</Link>.
        </p>
        <button type="button" className="tml-ai-retry" onClick={() => onRetry(turn)}>
          Try again
        </button>
      </div>
    );
  }

  const answer = turn.answer;
  if (answer === null) return null;

  const refusal = answer.refusal;
  const checkedDate = formatCheckedDate(answer.lastVerified);

  return (
    <div className="tml-ai-msg__bubble">
      <span className="tml-ai-sr-only">The guide replied: </span>

      {refusal === null ? (
        answerParagraphs(answer.answer).map((paragraph, index) => (
          <p key={index} className="tml-ai-msg__para">
            {paragraph}
          </p>
        ))
      ) : (
        <div className="tml-ai-refusal">
          <p className="tml-ai-refusal__title">{refusalLabel(refusal.reason)}</p>
          <p className="tml-ai-refusal__message">{refusal.message}</p>
        </div>
      )}

      {answer.citations.length === 0 ? null : (
        <div className="tml-ai-cites">
          <p className="tml-ai-cites__label" id={citesLabelId}>
            Citations
          </p>
          <ul className="tml-ai-cites__list" role="list" aria-labelledby={citesLabelId}>
            {answer.citations.map((citation) => {
              const date = formatCheckedDate(citation.lastVerified);
              return (
                <li key={`${citation.index}-${citation.sourceUrl}`} className="tml-ai-cite">
                  <span className="tml-ai-cite__index" aria-hidden="true">
                    {citation.index}
                  </span>
                  <span className="tml-ai-cite__text">
                    <a
                      className="tml-ai-cite__link"
                      href={citation.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {citation.sourceTitle}
                    </a>
                    <span className="tml-ai-cite__meta">
                      {date === null ? "Check date unavailable" : `Checked ${date}`}
                      {citation.live ? <span className="tml-ai-cite__live">Read just now</span> : null}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {checkedDate === null ? null : (
        <p className="tml-ai-msg__verified">
          Last verified <time dateTime={answer.lastVerified ?? undefined}>{checkedDate}</time>
        </p>
      )}

      {refusal === null ? (
        <p className="tml-ai-msg__model">Answered by {answer.model}</p>
      ) : null}
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
