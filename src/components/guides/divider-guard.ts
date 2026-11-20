import { expect } from "vitest";

/**
 * Divider-convention assertions for the pages in this workstream.
 *
 * The rule these guard comes from `docs/briefs/wave6-common.md`: a `GoldDivider` is
 * the only ornamental break, it marks at most one boundary between two sibling
 * top-level sections, and it never sits in a row with another rule or next to a
 * bordered element that already acts as a break.
 *
 * jsdom has no layout, so these run against the rendered DOM rather than measured
 * geometry. That is deliberate: the faults being guarded are duplicated *markup*.
 * The measurable half, the space either side of a divider, is checked in the browser
 * against the rules the stylesheet encodes, because jsdom would report zero for
 * every box and pass a broken page.
 */

/** Elements that act as a visual rule: a `GoldDivider`, or anything with a top or bottom border. */
const BORDERED = "[class*='border-t'], [class*='border-b'], [class*='border-y']";

function isDivider(element: Element): boolean {
  return element.classList.contains("tml-divider");
}

function childBlocks(container: HTMLElement): Element[] {
  // Some suites render a view rather than a page, so the container itself is the
  // block scope when there is no `<main>`.
  const scope = container.querySelector("main") ?? container;
  // Scripts and styles render nothing, so they do not count as a break between blocks.
  return Array.from(scope.children).filter(
    (child) => child.tagName !== "SCRIPT" && child.tagName !== "STYLE",
  );
}

/** The top-level block children of a page's `<main>`, in document order. */
export function topLevelBlocks(container: HTMLElement): Element[] {
  return childBlocks(container);
}

/**
 * Asserts that no two rules are adjacent in the top-level flow, and that a
 * `GoldDivider` never sits directly against a bordered block.
 */
export function expectNoAdjacentRules(container: HTMLElement): void {
  const blocks = childBlocks(container);
  for (let index = 1; index < blocks.length; index += 1) {
    const current = blocks[index] as Element;
    const previous = blocks[index - 1] as Element;
    const currentIsDivider = isDivider(current);
    const previousIsDivider = isDivider(previous);

    expect(
      { fault: currentIsDivider && previousIsDivider, index },
      `two GoldDividers in a row at block ${index}`,
    ).toEqual({ fault: false, index });

    // A divider next to a bordered block: the border is already the break.
    expect(
      { fault: currentIsDivider && previous.matches(BORDERED), index },
      `a GoldDivider at block ${index} follows a bordered ${previous.tagName}`,
    ).toEqual({ fault: false, index });

    expect(
      { fault: previousIsDivider && current.matches(BORDERED), index },
      `a bordered ${current.tagName} at block ${index} follows a GoldDivider`,
    ).toEqual({ fault: false, index });
  }
}

/** Every `GoldDivider` on the page. */
export function dividers(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll(".tml-divider"));
}

/**
 * The expected number of dividers on a page.
 *
 * An exact count rather than "at least one": the fault this guards is a duplicated
 * break, and a loose assertion would pass on the bug.
 */
export function expectDividerCount(container: HTMLElement, expected: number): void {
  expect(dividers(container)).toHaveLength(expected);
}

/**
 * No `SectionHeading` on the page may draw its own hairline where a divider is the
 * break. `SectionHeading` renders `.tml-section-head` with a `border-top` in the kit
 * stylesheet; a page that puts a divider above one has to switch that off, and this
 * checks the marker class it uses to do so is present.
 */
export function expectHeadingsDoNotRuleUnderDivider(
  container: HTMLElement,
  scopeClass: string,
): void {
  const scopes = Array.from(container.querySelectorAll(`.${scopeClass}`));
  expect(scopes.length).toBeGreaterThan(0);
  for (const scope of scopes) {
    expect(scope.querySelector(".tml-section-head")).not.toBeNull();
  }
}
