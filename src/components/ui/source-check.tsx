/**
 * The mark between a citation and the date it was checked.
 *
 * Every citation on the site prints its check date on the same line as the page
 * it names, and the two used to be joined by whatever the call site happened to
 * write: a bare space, a middot borrowed from another convention, or nothing at
 * all inside a flex row, where a whitespace-only text node collapses and the date
 * ran straight into the underlined title. One component keeps the mark, its
 * spacing and its wrapping identical everywhere, so a new citation cannot bring
 * the fault back by inventing its own separator.
 *
 * Three details are deliberate:
 *
 * - The gap before the mark is a margin on this element, not a space text node,
 *   so it survives in a flex container, where a whitespace-only child is dropped.
 * - The gap after it is non-breaking, so a narrow column breaks *before* the
 *   mark rather than stranding an em dash at the end of one line with its date on
 *   the next.
 * - Only the glyph is `aria-hidden`. The trailing space stays in the
 *   accessibility tree, so the host and "Checked" remain separate words and a
 *   screen reader still hears the date as "Checked 18 Nov 2026".
 */
import { cx } from "./cx";

/** The visible glyph. Exported so tests assert the mark rather than copy it. */
export const SOURCE_CHECK_SEPARATOR = "—";

/** Non-breaking space: keeps the mark with the date that follows it. */
const NO_BREAK_SPACE = "\u00A0";

export interface CheckSeparatorProps {
  /** Extra classes, for a row that needs its own colours. */
  readonly className?: string;
}

/** A muted em dash, spaced on both sides and bound to the date after it. */
export function CheckSeparator({ className }: CheckSeparatorProps) {
  return (
    <span className={cx("tml-check-sep", className)}>
      <span aria-hidden="true">{SOURCE_CHECK_SEPARATOR}</span>
      {NO_BREAK_SPACE}
    </span>
  );
}
