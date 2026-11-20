/**
 * The brand sparkle, as one path.
 *
 * The same four-point star the `GoldDivider` draws, at the same coordinates, so
 * the loading indicator belongs to the ornament language rather than looking
 * like a generic throbber. It lives here as a string so the divider, the
 * spinner and any future use can share one geometry; the divider still draws
 * its own copy because it composes the star with a hairline, dots and a
 * butterfly in a single SVG.
 */
export const SPARKLE_PATH =
  "M0 -10C1.6 -3.6 3.6 -1.6 10 0C3.6 1.6 1.6 3.6 0 10C-1.6 3.6 -3.6 1.6 -10 0C-3.6 -1.6 -1.6 -3.6 0 -10Z";
