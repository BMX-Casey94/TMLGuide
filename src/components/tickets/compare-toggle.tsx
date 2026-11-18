"use client";

/**
 * The comparison control on a package card.
 *
 * A native checkbox inside its own label, so it is operable by mouse, touch,
 * keyboard and screen reader without any custom key handling. The accessible name
 * is the visible sentence plus the product name, so a listener hears which
 * package a tick refers to rather than "checkbox 3 of 8".
 *
 * When three packages are already selected, the remaining controls are disabled
 * and each says why through `aria-describedby`: the limit is explained, not just
 * enforced.
 */
import { useId } from "react";
import { COMPARISON_LIMIT, useComparison } from "./comparison";
import "./tickets.css";

export interface CompareToggleProps {
  itemId: string;
  itemName: string;
}

export function CompareToggle({ itemId, itemName }: CompareToggleProps) {
  const { selectedIds, toggle, isFull } = useComparison();
  const hintId = useId();
  const checked = selectedIds.includes(itemId);
  const disabled = !checked && isFull;

  return (
    <div>
      <label
        className={
          disabled ? "tml-tix-compare tml-tix-compare--disabled" : "tml-tix-compare"
        }
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={() => toggle(itemId)}
          aria-label={`Compare ${itemName}`}
          aria-describedby={disabled || isFull ? hintId : undefined}
        />
        <span aria-hidden="true">{checked ? "In comparison" : "Compare"}</span>
      </label>
      <p id={hintId} className="tml-tix-sr">
        {isFull
          ? `Comparison holds up to ${COMPARISON_LIMIT} packages. Clear one to add another.`
          : `Compare up to ${COMPARISON_LIMIT} packages side by side.`}
      </p>
    </div>
  );
}
