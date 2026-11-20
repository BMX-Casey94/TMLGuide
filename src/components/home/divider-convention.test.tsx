import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import HomePage from "@/app/page";

/**
 * Guards for the divider convention on the home page (see
 * `docs/briefs/wave6-common.md`).
 *
 * The owner's report was that a section break on the home page carried three
 * rules at once: a hairline from the section above, a gold divider, and a
 * hairline on the heading row below it. Fixing that by hand is easy to undo by
 * hand, so the rules are asserted against the rendered page rather than against
 * any one component:
 *
 * 1. the page carries exactly the intended number of gold dividers;
 * 2. two dividers are never adjacent;
 * 3. a divider never sits beside an element that draws a rule of its own;
 * 4. a banded section (its own background and edge rules) never carries a
 *    divider beside it.
 *
 * These are DOM and class assertions. Vitest runs without CSS, so the test
 * asserts the contract the classes encode: a `SectionHeading` with the default
 * hairline draws a top border, and one marked `--bare` does not.
 */

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

afterEach(cleanup);

/** The number of gold dividers the home page is designed to carry. */
const INTENDED_DIVIDERS = 2;

/** Page-level children of `<main>`, excluding the JSON-LD script. */
function pageSections(container: HTMLElement): Element[] {
  return Array.from(container.querySelector("main")?.children ?? []).filter(
    (child) => child.tagName.toLowerCase() !== "script",
  );
}

/** True when this element draws a horizontal rule on its own top edge. */
function drawsOwnTopRule(element: Element): boolean {
  // A section heading is the only page-level element in this design that draws
  // its own top rule, and the `--bare` modifier is how it opts out.
  if (element.classList.contains("tml-section-head")) {
    return !element.classList.contains("tml-section-head--bare");
  }
  return false;
}

describe("home page divider convention", () => {
  it("carries exactly the intended number of gold dividers", () => {
    const { container } = render(<HomePage />);

    expect(container.querySelectorAll(".tml-divider")).toHaveLength(INTENDED_DIVIDERS);
  });

  it("never places two dividers next to each other", () => {
    const { container } = render(<HomePage />);
    const sections = pageSections(container);

    sections.forEach((section, index) => {
      if (!section.classList.contains("tml-divider")) return;

      expect(
        sections[index + 1]?.classList.contains("tml-divider") ?? false,
        "two gold dividers are adjacent",
      ).toBe(false);
      expect(
        sections[index - 1]?.classList.contains("tml-divider") ?? false,
        "two gold dividers are adjacent",
      ).toBe(false);
    });
  });

  it("never sits a divider beside an element that draws its own top rule", () => {
    const { container } = render(<HomePage />);
    const sections = pageSections(container);

    sections.forEach((section, index) => {
      if (!section.classList.contains("tml-divider")) return;

      for (const neighbour of [sections[index - 1], sections[index + 1]]) {
        if (neighbour === undefined) continue;

        // The heading may be the section itself or sit directly inside it.
        const heading = neighbour.matches(".tml-section-head")
          ? neighbour
          : neighbour.querySelector(".tml-section-head");

        if (heading === null) continue;

        expect(
          drawsOwnTopRule(heading),
          "a divider sits beside a heading that draws its own top rule",
        ).toBe(false);
      }
    });
  });

  it("never sits a divider beside a section that already acts as a band", () => {
    const { container } = render(<HomePage />);
    const sections = pageSections(container);

    sections.forEach((section, index) => {
      if (!section.classList.contains("tml-divider")) return;

      for (const neighbour of [sections[index - 1], sections[index + 1]]) {
        if (neighbour === undefined) continue;

        // The trust strip is a full-width band with its own top and bottom
        // rules and a different background; the convention names that as a
        // break in its own right.
        expect(
          neighbour.classList.contains("home-trust"),
          "a divider sits beside a banded section that is already a break",
        ).toBe(false);
      }
    });
  });

  it("keeps no hairline between the hero and the first divider", () => {
    const { container } = render(<HomePage />);
    const sections = pageSections(container);

    const firstDivider = sections.findIndex((section) =>
      section.classList.contains("tml-divider"),
    );

    expect(firstDivider).toBeGreaterThan(0);
    expect(sections[firstDivider - 1]?.classList.contains("home-hero")).toBe(true);
  });
});
