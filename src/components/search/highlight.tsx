"use client";

import { highlightSegments } from "@/lib/search/text";

export interface HighlightProps {
  text: string;
  /** Query tokens, already folded by `queryTokens`. */
  tokens: readonly string[];
}

/**
 * Renders `text` with the matched words emphasised.
 *
 * The text is split into plain and matched runs and each run is rendered as a
 * React text node, so nothing in a title or snippet can ever be interpreted as
 * HTML. `<mark>` is used rather than a span because marking a search match is
 * what the element means, and the highlight is a colour shift on text that is
 * already the strongest contrast in the row, so no information is carried by
 * colour alone.
 */
export function Highlight({ text, tokens }: HighlightProps) {
  const segments = highlightSegments(text, tokens);
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index} className="bg-transparent font-semibold text-accent">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
