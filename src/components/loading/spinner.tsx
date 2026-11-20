import { SPARKLE_PATH } from "./sparkle";

/**
 * The branded loading indicator: the gold four-point sparkle from `GoldDivider`,
 * turning slowly.
 *
 * Two sizes, because it is used at two distances: `inline` beside a line of text
 * ("Opening…") and `page` as the centred fallback for a whole route. The box is a
 * fixed square at every size, so a spinner appearing or disappearing cannot move
 * the text around it.
 *
 * Deliberately not a Client Component. It holds no state and reads nothing from
 * the browser, so it renders on the server as static HTML and becomes part of
 * the client bundle only where it is imported by one (the palette). That keeps
 * `src/app/loading.tsx` free of JavaScript.
 *
 * Motion is a CSS animation that the site's own rules switch off — the
 * `prefers-reduced-motion` block in `loading.css`, and the universal
 * `html[data-a11y-motion="reduce"]` rule in `a11y.css`, which is `!important` and
 * so wins over either. When it is off, the sparkle holds a static gold glow
 * instead: still visibly busy, not moving. The state never rests on the
 * animation alone, because every caller prints a word beside it.
 */

export type SpinnerSize = "inline" | "page";

export interface SpinnerProps {
  size?: SpinnerSize;
  /**
   * Text for assistive technology. When given, the spinner is a polite live
   * region carrying that text; when omitted it is decorative and hidden, for a
   * caller that already has a live region of its own beside it.
   */
  label?: string;
  className?: string;
}

export function Spinner({ size = "inline", label, className }: SpinnerProps) {
  const box = (
    <span
      className={`tml-spinner tml-spinner--${size}${className === undefined ? "" : ` ${className}`}`}
    >
      <svg viewBox="-10 -10 20 20" className="tml-spinner__art" focusable="false" aria-hidden="true">
        <path d={SPARKLE_PATH} />
      </svg>
    </span>
  );

  if (label === undefined) return box;

  return (
    <span role="status" aria-live="polite" className="tml-spinner-status">
      {box}
      <span className="sr-only">{label}</span>
    </span>
  );
}
