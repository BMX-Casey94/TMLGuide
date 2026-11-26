import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import AccessibilityPage, { metadata } from "@/app/accessibility/page";
import { CORRECTIONS_EMAIL } from "@/components/home/contact";
import { expectResolvableLinks, expectSoundHeadingOrder } from "@/components/home/page-assertions";
import {
  expectDividerCount,
  expectNoAdjacentRules,
} from "@/components/guides/divider-guard";

/**
 * Page-level tests for the accessibility statement.
 *
 * The claims this suite guards are the honest ones: the page names a target without claiming
 * conformance, states what was tested automatically and what was not, does not invent a contact
 * address, and carries a review date. A statement that overclaims is worse than none, so each of
 * those is asserted rather than left to review.
 */

function visibleText(container: HTMLElement): string {
  const copy = container.cloneNode(true) as HTMLElement;
  for (const script of Array.from(copy.querySelectorAll("script"))) script.remove();
  return copy.textContent ?? "";
}

afterEach(cleanup);

describe("structure", () => {
  it("renders a main landmark the skip link can target, one h1, and no skipped level", () => {
    const { container } = render(<AccessibilityPage />);

    expect(container.querySelector("main")).toHaveAttribute("id", "main");
    expectSoundHeadingOrder(container);
  });

  it("names the page in its h1", () => {
    render(<AccessibilityPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /What works, what has been checked, and what has not/i,
    );
  });

  it("links only to known routes and outbound links safely", () => {
    const { container } = render(<AccessibilityPage />);
    expectResolvableLinks(container);
  });

  it("has a labelled section for each claim the brief asks for", () => {
    render(<AccessibilityPage />);

    for (const name of [
      /^The target$/,
      /^What has been tested automatically$/,
      /^What has not yet been tested by hand$/,
      /^Changing how the site looks$/,
      /^What has been checked in the tools$/,
      /^Known limitations$/,
      /^Reporting a problem$/,
    ]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });
});

describe("the target", () => {
  it("names WCAG 2.2 AA as the target", () => {
    const { container } = render(<AccessibilityPage />);
    expect(visibleText(container)).toContain("WCAG 2.2 Level AA");
  });

  it("never claims conformance or compliance", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container).toLowerCase();

    expect(text).not.toMatch(/\b(fully|wcag[\w\s.]*)\s*compliant\b/);
    expect(text).not.toMatch(/\bconforms\b/);
    expect(text).not.toMatch(/\bconformant\b/);
    expect(text).not.toMatch(/\bfully accessible\b/);
    expect(text).not.toMatch(/\b100% accessible\b/);
  });

  it("says an automated pass is a floor rather than a certificate", () => {
    const { container } = render(<AccessibilityPage />);
    expect(visibleText(container)).toMatch(/floor, not a certificate/i);
  });
});

describe("what was tested", () => {
  it("describes the axe-core scan of every route at desktop and phone viewports", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toContain("axe-core");
    expect(text).toMatch(/every route/i);
    expect(text).toMatch(/desktop viewport/i);
    expect(text).toMatch(/phone\s+viewport/i);
    expect(text).toMatch(/no violations/i);
  });

  it("lists only what axe can actually catch", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toMatch(/alternative text/i);
    expect(text).toMatch(/form fields with no\s+label/i);
    expect(text).toMatch(/heading levels that skip/i);
    expect(text).toMatch(/contrast/i);
  });
});

describe("what has not been tested", () => {
  it("names screen readers, the keyboard audit, 200 percent zoom, contrast over imagery and touch targets", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toMatch(/NVDA/);
    expect(text).toMatch(/JAWS/);
    expect(text).toMatch(/VoiceOver/);
    expect(text).toMatch(/keyboard/i);
    expect(text).toMatch(/200 percent zoom/i);
    expect(text).toMatch(/Contrast over imagery/i);
    expect(text).toMatch(/Touch target sizes/i);
  });

  it("does not present the outstanding checks as done", () => {
    const { container } = render(<AccessibilityPage />);
    // The list sits under a heading that says these are outstanding, and each item says so.
    const section = screen.getByRole("region", { name: /not yet been tested by hand/i });
    expect(within(section).getByText(/outstanding/i)).toBeInTheDocument();
    expect(visibleText(container)).toMatch(/has not been|have not|not been tested/i);
  });
});

describe("using the toolbar", () => {
  it("explains how to open the panel and what each setting does", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toContain("Accessibility settings");
    expect(text).toMatch(/Text size/i);
    expect(text).toMatch(/Line and letter spacing/i);
    expect(text).toMatch(/Contrast/i);
    expect(text).toMatch(/Motion/i);
    expect(text).toMatch(/Underline links/i);
    expect(text).toMatch(/Readable font/i);
    expect(text).toMatch(/Reset to defaults/i);
  });

  it("says Escape closes the panel and focus returns to the trigger", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toMatch(/Escape/i);
    expect(text).toMatch(/Focus returns to the button/i);
  });

  it("places the button in the header from 900px, not in the phone's bottom bar", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    // The button lives in the header only, and appears from 900px wide.
    expect(text).toMatch(/right-hand end of the site\s+header/i);
    expect(text).toMatch(/900px/);
    // The dock is navigation only, and the page must not send a reader looking for a copy there.
    expect(text).toMatch(/bottom bar on a phone carries navigation only/i);
    expect(text).not.toMatch(/last\s+cell of the bottom bar/i);
  });

  it("names the storage key and says nothing leaves the browser", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toContain("tml-a11y-prefs");
    expect(text).toMatch(/no cookie is set/i);
    expect(text).toMatch(/no\s+analytics/i);
  });

  it("puts the storage key in a code element, so it is not read as prose", () => {
    const { container } = render(<AccessibilityPage />);
    const code = container.querySelector("code");
    expect(code?.textContent).toBe("tml-a11y-prefs");
  });
});

describe("known limitations", () => {
  it("admits the site is dark only and lists further gaps", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toMatch(/dark only/i);
    expect(text).toMatch(/no light theme/i);
    expect(text).toMatch(/third-party/i);
  });
});

describe("reporting a problem", () => {
  it("says plainly that there is no published contact address, rather than inventing one", () => {
    const { container } = render(<AccessibilityPage />);

    expect(CORRECTIONS_EMAIL).toBeNull();
    expect(visibleText(container)).toMatch(/no published contact address yet/i);
    expect(container.querySelectorAll('a[href^="mailto:"]')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it("points at the community groups and the About page as the route that exists", () => {
    render(<AccessibilityPage />);

    expect(screen.getByRole("link", { name: "community groups" })).toHaveAttribute(
      "href",
      "/community",
    );
    expect(screen.getByRole("link", { name: "About page" })).toHaveAttribute("href", "/about");
  });

  it("tells the reader what a useful report contains", () => {
    const { container } = render(<AccessibilityPage />);
    expect(visibleText(container)).toMatch(/which page you were on/i);
  });
});

describe("the review date", () => {
  it("states 26 November 2026, in a machine-readable time element", () => {
    const { container } = render(<AccessibilityPage />);

    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-11-26");
    expect(time).toHaveTextContent("26 November 2026");
    expect(visibleText(container)).toMatch(/Last reviewed\s+26 November 2026/);
  });
});

describe("what was checked in the tools", () => {
  it("reports the checks actually done, naming the method rather than claiming a screen reader", () => {
    const { container } = render(<AccessibilityPage />);
    const section = screen.getByRole("region", { name: /checked in the tools/i });
    const text = visibleText(section as HTMLElement);

    // The methods that were used are named.
    expect(text).toMatch(/accessibility tree/i);
    expect(text).toMatch(/keyboard/i);
    expect(text).toMatch(/320/i);
    expect(text).toMatch(/200 percent zoom/i);

    // The section is not presented as a screen-reader pass.
    expect(text).toMatch(/No screen reader was run/i);
    expect(text).not.toMatch(/tested with (a |the )?screen reader/i);
    expect(text).not.toMatch(/verified with (a |the )?screen reader/i);
    // And the page's own text keeps to the same limit.
    expect(visibleText(container)).not.toMatch(/tested with (a |the )?screen reader/i);
  });

  it("says the tools were measured for sideways scrolling rather than left unmentioned", () => {
    render(<AccessibilityPage />);
    const section = screen.getByRole("region", { name: /checked in the tools/i });
    expect(visibleText(section as HTMLElement)).toMatch(/does not scroll\s+sideways|scrolls\s+sideways/i);
  });

  it("admits what the accessibility-tree check cannot show", () => {
    render(<AccessibilityPage />);
    const section = screen.getByRole("region", { name: /checked in the tools/i });
    const text = visibleText(section as HTMLElement);
    // The distinction between "has a name" and "is announced usefully" is the point.
    expect(text).toMatch(/not the same thing|not by listening|unverified|not verified/i);
  });

  it("no longer lists the sale timeline and the calculators as untested here", () => {
    render(<AccessibilityPage />);
    const untested = screen.getByRole("region", { name: /not yet been tested by hand/i });
    const text = visibleText(untested as HTMLElement);

    // The screen-reader gap stays outstanding and is still stated.
    expect(text).toMatch(/Screen reader testing/i);
    expect(text).toMatch(/NVDA/);
    // But the keyboard and zoom checks now say what was done.
    expect(text).toMatch(/tools pages have been walked end to end with the keyboard alone/i);
    expect(text).toMatch(/320 CSS pixels/i);
  });
});

/*
  Presentation conventions this page has to hold, alongside the wording the sections
  above guard. The owner asked for a redesign that matches /about and the guides, so
  the checks are the ones those two pages carry: one break per boundary, one review
  line at the close, and no stacked rules.
*/
describe("presentation conventions", () => {
  it("uses one GoldDivider per boundary that wants an ornament, and no more", () => {
    const { container } = render(<AccessibilityPage />);
    // Three boundaries: after the target, after the untested list, and before the
    // tools section, which is a new block of claims rather than more of the toolbar copy.
    expectDividerCount(container, 3);
  });

  it("never puts two rules side by side in the page flow", () => {
    const { container } = render(<AccessibilityPage />);
    expectNoAdjacentRules(container);
  });

  it("marks the review line as one labelled block at the close of the page", () => {
    const { container } = render(<AccessibilityPage />);
    const reviewed = container.querySelector(".a11y-page-reviewed");

    expect(reviewed).not.toBeNull();
    expect(reviewed?.querySelector(".a11y-page-reviewed__label")).toHaveTextContent(
      /Last reviewed/,
    );
    // It is the last thing in the page column, after the last section.
    const main = container.querySelector("main");
    expect(main?.lastElementChild).toBe(reviewed);
  });

  it("puts the no-conformance-claim statement in its own callout", () => {
    const { container } = render(<AccessibilityPage />);
    const caveat = container.querySelector(".a11y-page-callout--caveat");

    expect(caveat).not.toBeNull();
    expect(caveat?.textContent).toMatch(/does not claim conformance/i);
    expect(caveat?.textContent).toMatch(/No conformance claim/);
  });

  it("keeps every section on the page's own class, so none draws a rule of its own", () => {
    const { container } = render(<AccessibilityPage />);
    const sections = Array.from(container.querySelectorAll("main > section"));

    expect(sections).toHaveLength(7);
    for (const section of sections) expect(section.className).toContain("a11y-page-section");
  });
});

describe("metadata", () => {
  it("declares a canonical URL for the page", () => {
    expect(metadata.alternates?.canonical).toBe("/accessibility");
  });

  it("has a title, a description and Open Graph text, with no image", () => {
    expect(metadata.title).toBe("Accessibility");
    expect(metadata.description).toBeTruthy();
    expect(metadata.openGraph?.title).toBeTruthy();
    const openGraph = metadata.openGraph as { images?: unknown } | undefined;
    expect(openGraph?.images).toBeUndefined();
  });

  it("describes the page without claiming conformance in the description", () => {
    expect(String(metadata.description).toLowerCase()).not.toMatch(/compliant|conforms/);
  });
});
