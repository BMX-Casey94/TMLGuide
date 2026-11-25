"use client";

import { useCallback, useState } from "react";

export interface NewsLikeButtonProps {
  /** The news record's id, used as the API path segment. */
  readonly id: string;
  /** The count the server rendered with. */
  readonly initialCount: number;
  /** The record's title, so the accessible name says which item is being marked. */
  readonly itemTitle: string;
}

type LikeState =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "done"; readonly count: number }
  | { readonly kind: "refused"; readonly message: string };

/**
 * The like control on one news card.
 *
 * ## Why there is no un-like
 *
 * A like here counts interest, not votes. It is not deduplicated per person and
 * no record of who tapped is stored, so there is nothing to take back, and a
 * button that appeared to remove one would misrepresent what the number means.
 *
 * ## What it says when it fails
 *
 * The count is left exactly as the server last reported it, and the reason is
 * shown rather than collapsed into "something went wrong":
 *
 * - `503` — the backend is not configured, so nothing was counted.
 * - `429` — this connection has tapped too often; the count did not move.
 * - anything else — the count may or may not have moved, so it is not adjusted.
 *
 * ## Accessibility
 *
 * The count is inside the button, so the accessible name contains the visible
 * text (WCAG 2.5.3) and a screen reader announces the new number as part of the
 * control. The note below is a polite live region rendered from the first paint,
 * so the announcement has somewhere to land.
 */
export function NewsLikeButton({ id, initialCount, itemTitle }: NewsLikeButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [state, setState] = useState<LikeState>({ kind: "idle" });
  const busy = state.kind === "sending";
  const done = state.kind === "done";

  const send = useCallback(async () => {
    if (busy || done) return;
    setState({ kind: "sending" });

    try {
      const response = await fetch(`/api/community/news/${encodeURIComponent(id)}/like`, {
        method: "POST",
        // No body and no credentials: there is nothing to send and no cookie to
        // send with. The Origin header is added by the browser and checked by the
        // route.
        credentials: "omit",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (response.status === 503) {
        setState({
          kind: "refused",
          message: "Likes are not being recorded at the moment. Your tap was not counted.",
        });
        return;
      }

      if (response.status === 429) {
        setState({
          kind: "refused",
          message: "You have tapped this a lot. Try again later — the count did not change.",
        });
        return;
      }

      if (!response.ok) {
        setState({
          kind: "refused",
          message: "That did not go through. The count has not been changed.",
        });
        return;
      }

      const payload: unknown = await response.json();
      const reported =
        typeof payload === "object" && payload !== null
          ? (payload as { likeCount?: unknown }).likeCount
          : undefined;

      if (typeof reported !== "number" || !Number.isFinite(reported) || reported < 0) {
        setState({
          kind: "refused",
          message: "The count came back in a form this page did not understand, so it was left alone.",
        });
        return;
      }

      const next = Math.trunc(reported);
      setCount(next);
      setState({ kind: "done", count: next });
    } catch {
      setState({
        kind: "refused",
        message: "The connection dropped before an answer arrived. The count has not been changed.",
      });
    }
  }, [busy, done, id]);

  const message = state.kind === "refused" ? state.message : "";

  return (
    <div className="tml-news-like">
      <button
        type="button"
        className="tml-news-like__button"
        onClick={() => {
          void send();
        }}
        disabled={busy || done}
        aria-describedby={`news-like-note-${id}`}
      >
        <span aria-hidden="true" className="tml-news-like__glyph">
          {done ? "♥" : "♡"}
        </span>
        <span>{done ? "Marked useful" : "Mark useful"}</span>
        <span className="tml-news-like__count" aria-hidden="true">
          {count}
        </span>
        <span className="sr-only">
          {` — ${itemTitle}. Currently ${count} ${count === 1 ? "mark" : "marks"}.`}
        </span>
      </button>

      {/*
        One polite region, present from the first paint. It carries the refusal
        reason, and the visible count updates at the same moment, so a sighted
        reader and a screen reader are told the same thing.
      */}
      <p
        id={`news-like-note-${id}`}
        role="status"
        aria-live="polite"
        className="tml-news-like__note"
      >
        {message}
      </p>
    </div>
  );
}
