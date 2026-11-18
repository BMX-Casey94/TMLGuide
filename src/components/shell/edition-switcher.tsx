"use client";

import { useRef, type KeyboardEvent } from "react";
import { EDITIONS, useEdition } from "./edition-context";

export type EditionSwitcherVariant = "inline" | "stacked";

export interface EditionSwitcherProps {
  /**
   * "inline" is the compact desktop pill; "stacked" is the full-width mobile control with three
   * equal 48px segments.
   */
  variant?: EditionSwitcherVariant;
  className?: string;
}

/** Arrow keys move the selection in these directions: 1 is forward, -1 is backward. */
const STEP_BY_KEY: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

const BASE_OPTION =
  "cursor-pointer rounded-full font-mono uppercase text-cream-mute transition-colors hover:text-cream aria-checked:bg-accent aria-checked:font-bold aria-checked:text-on-accent aria-checked:hover:text-on-accent";

/**
 * Edition selector. Implements the WAI-ARIA radio group pattern: one tab stop for the group,
 * arrow keys move focus and selection together, Home and End jump to the ends, and selection wraps
 * so every option stays reachable in both directions.
 */
export function EditionSwitcher({ variant = "inline", className }: EditionSwitcherProps) {
  const { edition, setEdition } = useEdition();
  const options = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    const target = (index + EDITIONS.length) % EDITIONS.length;
    const option = EDITIONS[target];
    setEdition(option.id);
    options.current[target]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = STEP_BY_KEY[event.key];
    if (step !== undefined) {
      event.preventDefault();
      select(index + step);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      select(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      select(EDITIONS.length - 1);
    }
  };

  const layout =
    variant === "stacked"
      ? "grid w-full grid-cols-3 rounded-full border border-hair-strong bg-surface/60 p-[3px]"
      : "inline-flex items-center rounded-full border border-hair-strong bg-surface/60 p-[3px]";

  // The inline pill tightens from 900px, where the header row also carries five tabs and a search
  // button; the stacked one keeps 48px segments so phones get comfortable targets.
  const optionSize =
    variant === "stacked"
      ? "h-12 w-full text-center text-[11px] tracking-[0.14em]"
      : "min-h-[44px] px-2 text-[10px] tracking-[0.08em] min-[1100px]:px-3.5 min-[1100px]:text-[11px] min-[1100px]:tracking-[0.12em]";

  return (
    <div
      role="radiogroup"
      aria-label="Choose edition"
      className={className === undefined ? layout : `${layout} ${className}`}
      data-variant={variant}
    >
      {EDITIONS.map((option, index) => {
        const isSelected = option.id === edition;
        return (
          <button
            key={option.id}
            ref={(element) => {
              options.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            data-edition={option.id}
            onClick={() => select(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`${BASE_OPTION} ${optionSize}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
