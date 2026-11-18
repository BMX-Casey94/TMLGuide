"use client";

/**
 * Comparison state for the package explorer.
 *
 * The selection is React state, not the URL: which packages a visitor is weighing
 * up is a private, transient choice, and putting it in the query string would
 * lengthen every shared link and let a doctored URL render a table nobody asked
 * for. The three-item limit lives in one pure function, so the toggle and the
 * table cannot disagree about how many are selected and the rule is testable
 * without a component.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** How many packages a visitor can compare at once. */
export const COMPARISON_LIMIT = 3;

/**
 * Adds an id, removes it when already present, and refuses to grow past `limit`.
 *
 * Selection order is preserved, so the table's columns follow the order the
 * visitor ticked rather than the order the catalogue lists.
 */
export function toggleSelection(
  selected: readonly string[],
  id: string,
  limit: number = COMPARISON_LIMIT,
): string[] {
  if (selected.includes(id)) {
    return selected.filter((entry) => entry !== id);
  }
  if (selected.length >= limit) {
    return [...selected];
  }
  return [...selected, id];
}

export function isComparisonFull(
  selected: readonly string[],
  limit: number = COMPARISON_LIMIT,
): boolean {
  return selected.length >= limit;
}

export interface ComparisonValue {
  selectedIds: string[];
  /** True when no further package can be added. */
  isFull: boolean;
  toggle: (id: string) => void;
  clear: () => void;
  remove: (id: string) => void;
}

const ComparisonContext = createContext<ComparisonValue | null>(null);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => toggleSelection(current, id));
  }, []);

  const remove = useCallback((id: string) => {
    setSelectedIds((current) => current.filter((entry) => entry !== id));
  }, []);

  const clear = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const value = useMemo<ComparisonValue>(
    () => ({
      selectedIds,
      isFull: isComparisonFull(selectedIds),
      toggle,
      remove,
      clear,
    }),
    [selectedIds, toggle, remove, clear],
  );

  return <ComparisonContext.Provider value={value}>{children}</ComparisonContext.Provider>;
}

export function useComparison(): ComparisonValue {
  const context = useContext(ComparisonContext);
  if (context === null) {
    throw new Error("useComparison must be used inside ComparisonProvider");
  }
  return context;
}
