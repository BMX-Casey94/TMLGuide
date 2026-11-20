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

/**
 * The shared skin for one option.
 *
 * The hover colour is gated behind `@media (hover: hover)`, so a tap on a touch device cannot leave
 * an unselected option stuck in the bright cream that only a pointer's hover should produce. The
 * checked state is deliberately independent of hover, so a selected option keeps its accent
 * background and dark label whichever way it was chosen.
 */
const BASE_OPTION =
  "cursor-pointer rounded-full font-mono uppercase text-cream-mute transition-colors [@media(hover:hover)]:hover:text-cream aria-checked:bg-accent aria-checked:font-bold aria-checked:text-on-accent [@media(hover:hover)]:aria-checked:hover:text-on-accent";

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
      : "inline-flex items-center rounded-full bg-ground/70 p-[2px] ring-1 ring-inset ring-hair";

  /*
    The inline pill sits inside the header's 44px search pill, so each option is a 36px-tall target
    whose 34px minimum width keeps BE / WI / BR comfortably tappable. The horizontal padding only
    grows from 1100px, where the header row has slack. The stacked variant keeps 48px segments so the
    panel's own control gets full-width targets.
  */
  const optionSize =
    variant === "stacked"
      ? "h-12 w-full text-center text-[11px] tracking-[0.14em]"
      : "inline-flex h-9 min-w-[34px] items-center justify-center touch-manipulation select-none px-2.5 text-[10px] tracking-[0.08em] min-[1100px]:px-3";

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
            aria-label={option.label}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            data-edition={option.id}
            onClick={() => select(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`${BASE_OPTION} ${optionSize}`}
          >
            {variant === "inline" ? (
              <>
                {/*
                  Short codes below 1100px, full words from it.

                  Measured for this breakpoint, with JetBrains Mono's 0.6em advance at 10px. Three
                  short codes take about 105px of the pill; three full words take about 193px, and
                  the label beside them (icon, gap, padding) needs another 42px. The pill is 208px
                  on a phone, 280px at 900px and 340px at 1100px, so the words leave the search
                  field about 37px at 900px — below the 40px the layout spec requires, and clipped
                  outright by the wrapper's 140px cap below 900px. From 1100px they leave about
                  85px and both fit. The accessible name is always the full word, so neither a
                  screen reader nor a speech user ever hears "BE".
                */}
                <span aria-hidden="true" className="min-[1100px]:hidden">
                  {option.shortLabel}
                </span>
                <span aria-hidden="true" className="hidden min-[1100px]:inline">
                  {option.label}
                </span>
              </>
            ) : (
              option.label
            )}
          </button>
        );
      })}
    </div>
  );
}
