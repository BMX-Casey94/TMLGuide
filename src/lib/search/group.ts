import { KIND_ORDER } from "./kinds";
import type { RankedEntry, SearchKind } from "./types";

export interface ResultGroup {
  kind: SearchKind;
  /** Mono label shown above the group, e.g. "FAQ". */
  label: string;
  entries: RankedEntry[];
  /** Best score in the group; used to order the headings. */
  score: number;
}

const KIND_RANK = new Map<SearchKind, number>(KIND_ORDER.map((kind, position) => [kind, position]));

/**
 * Group ranked results by kind.
 *
 * Groups are ordered by their best score, so the most relevant kind is listed
 * first and the palette does not bury a strong FAQ hit under a weak page hit.
 * Within a group the incoming score order is preserved. Ties between groups fall
 * back to {@link KIND_ORDER}, which keeps the headings stable between keystrokes
 * that produce equal scores.
 */
export function groupResults(results: readonly RankedEntry[]): ResultGroup[] {
  const groups = new Map<SearchKind, ResultGroup>();

  for (const result of results) {
    const existing = groups.get(result.kind);
    if (existing) {
      existing.entries.push(result);
      existing.score = Math.max(existing.score, result.score);
      continue;
    }
    groups.set(result.kind, {
      kind: result.kind,
      label: result.kindLabel,
      entries: [result],
      score: result.score,
    });
  }

  return [...groups.values()].sort(
    (a, b) => b.score - a.score || (KIND_RANK.get(a.kind) ?? 99) - (KIND_RANK.get(b.kind) ?? 99),
  );
}

/**
 * Flatten groups back into the order the arrow keys step through, which is the
 * order the rows appear on screen.
 */
export function flattenGroups(groups: readonly ResultGroup[]): RankedEntry[] {
  return groups.flatMap((group) => group.entries);
}
