import { expect } from "vitest";
import { screen, within } from "@testing-library/react";

import { isInternalLink } from "./test-support";

/**
 * Page-level assertions shared by the home and About tests.
 *
 * Both pages must satisfy the same structural rules: one h1, no skipped heading
 * level, and no internal link to a page the site does not serve. Keeping those
 * rules here means a fix to the checker applies to both, and a page cannot pass
 * by testing a different rule from its sibling.
 */

/** Heading levels in document order, for the skip check. */
function headingLevels(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((heading) =>
    Number(heading.tagName.slice(1)),
  );
}

/**
 * Asserts the heading outline a page of this site must have: exactly one h1,
 * first in the document, and no level deeper than one more than the level above
 * it.
 */
export function expectSoundHeadingOrder(container: HTMLElement): void {
  const levels = headingLevels(container);

  expect(levels.filter((level) => level === 1)).toHaveLength(1);
  expect(levels[0]).toBe(1);

  for (let index = 1; index < levels.length; index += 1) {
    const previous = levels[index - 1];
    const current = levels[index];
    // A heading may stay level, go up, or go one deeper. Never skip a level.
    expect(current).toBeLessThanOrEqual(previous + 1);
  }
}

/** Every internal link on the page, as hrefs. */
function internalHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("a[href]"))
    .map((anchor) => anchor.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("/"));
}

/**
 * Asserts that every internal link resolves to a known route, and that every
 * outbound link is https with the rel protection a citation link needs.
 *
 * @returns the internal hrefs, so a caller can assert on specific destinations.
 */
export function expectResolvableLinks(container: HTMLElement): readonly string[] {
  const hrefs = internalHrefs(container);

  for (const href of hrefs) {
    expect({ href, known: isInternalLink(href) }).toEqual({ href, known: true });
  }

  for (const anchor of Array.from(container.querySelectorAll("a[href^='http']"))) {
    const href = anchor.getAttribute("href") ?? "";
    expect(href).toMatch(/^https:\/\//);
    expect(anchor.getAttribute("rel")).toContain("noopener");
    expect(anchor.getAttribute("rel")).toContain("noreferrer");
  }

  return hrefs;
}

/** A section found by its accessible name, or a clear failure. */
export function sectionByName(name: string | RegExp) {
  return screen.getByRole("region", { name });
}

/** Every link inside one region, for count assertions. */
export function linksWithin(region: HTMLElement) {
  return within(region).queryAllByRole("link");
}
