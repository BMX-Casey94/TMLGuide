import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import AccessibilityPage, { metadata } from "@/app/accessibility/page";
import { CORRECTIONS_EMAIL } from "@/components/home/contact";
import { expectResolvableLinks, expectSoundHeadingOrder } from "@/components/home/page-assertions";
import { expectDividerCount, expectNoAdjacentRules } from "@/components/guides/divider-guard";

/**
 * Page-level tests for the accessibility page.
 *
 * TMLGuide is an independent fan guide, not a public body, so this page is written for readers
 * rather than as a compliance statement. The claims it guards are the useful ones: it describes the
 * display settings the site actually ships, says the pages work from a keyboard and on a phone,
 * admits the gaps that remain, and does not invent a contact address. It also must not slip back
 * into the regulatory vocabulary the owner objected to.
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

  it("names the page in its h1 without the language of a compliance statement", () => {
    render(<AccessibilityPage />);
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading).toHaveTextContent(/Making the guide easy to read and use/i);
    expect(heading).not.toHaveTextContent(/statement/i);
  });

  it("links only to known routes and outbound links safely", () => {
    const { container } = render(<AccessibilityPage />);
    expectResolvableLinks(container);
  });

  it("has a labelled section for each part of the brief", () => {
    render(<AccessibilityPage />);

    for (const name of [
      /^Change how the site looks$/,
      /^Built for keyboards and small screens$/,
      /^What we have checked$/,
      /^Known limitations$/,
      /^Telling us about a problem$/,
    ]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });
});

describe("the language", () => {
  it("drops the standards and regulatory vocabulary a public-sector statement would carry", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);
    const lower = text.toLowerCase();

    expect(text).not.toMatch(/WCAG/i);
    expect(lower).not.toMatch(/conformance|conformant|conforms/);
    expect(lower).not.toMatch(/compliant|compliance/);
    expect(lower).not.toMatch(/equality and human rights commission/);
    expect(lower).not.toMatch(/enforcement|enforce/);
    expect(lower).not.toMatch(/public sector/);
    expect(lower).not.toMatch(/NHS/);
    expect(lower).not.toMatch(/legal requirement|legal obligation/);
    expect(lower).not.toMatch(/accessibility statement/);
    expect(lower).not.toMatch(/level aa|level a\b/);
    expect(lower).not.toMatch(/audit/);
  });

  it("says what the site is, so the reader knows who is putting the page up", () => {
    const { container } = render(<AccessibilityPage />);
    expect(visibleText(container)).toMatch(/independent fan guide/i);
  });

  it("never claims the site is fully accessible", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container).toLowerCase();

    expect(text).not.toMatch(/\bfully accessible\b/);
    expect(text).not.toMatch(/\b100% accessible\b/);
  });

  it("keeps the honest caveat in its own callout", () => {
    const { container } = render(<AccessibilityPage />);
    const caveat = container.querySelector(".a11y-page-callout--caveat");

    expect(caveat).not.toBeNull();
    expect(caveat?.textContent).toMatch(/not proof that the site works with a screen reader/i);
  });
});

describe("changing how the site looks", () => {
  it("explains how to open the panel and what each setting does", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toContain("Accessibility settings");
    expect(text).toMatch(/Text size/i);
    expect(text).toMatch(/High contrast/i);
    expect(text).toMatch(/Reduced motion/i);
    expect(text).toMatch(/Readable font/i);
    expect(text).toMatch(/Underlined links/i);
    expect(text).toMatch(/Line and letter spacing/i);
    expect(text).toMatch(/Reset to defaults/i);
  });

  it("describes the settings in the terms the panel itself uses", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    // The panel's motion control offers "Follow system"; the page says the same.
    expect(text).toMatch(/Follow system/i);
    // High contrast is described by what it does, not by a bare ratio.
    expect(text).toMatch(/high contrast[^.]*stand out/i);
    expect(text).not.toMatch(/\d(\.\d+)?:1/);
    // Text sizes are the four the panel offers.
    for (const size of ["100", "115", "130", "150"]) expect(text).toContain(size);
  });

  it("says Escape closes the panel and focus returns to the trigger", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toMatch(/Escape/i);
    expect(text).toMatch(/Focus returns to the button/i);
  });

  it("places the button in the header from 900 pixels, not in the phone's bottom bar", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toMatch(/top right of the\s+header/i);
    expect(text).toMatch(/900 pixels/);
    // The dock is navigation only, and the page must not send a reader looking for a copy there.
    expect(text).toMatch(/bar at the bottom of a phone carries navigation only/i);
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

describe("keyboards and small screens", () => {
  it("says the pages work without a mouse, with a visible focus ring", () => {
    render(<AccessibilityPage />);
    const section = screen.getByRole("region", { name: /keyboards and small screens/i });
    const text = visibleText(section as HTMLElement);

    expect(text).toMatch(/without a mouse/i);
    expect(text).toMatch(/focus ring is drawn on every stop/i);
    expect(text).toMatch(/Escape/i);
  });

  it("gives the phone width and the zoom level the layout was built against", () => {
    render(<AccessibilityPage />);
    const section = screen.getByRole("region", { name: /keyboards and small screens/i });
    const text = visibleText(section as HTMLElement);

    expect(text).toMatch(/320 pixels wide/i);
    expect(text).toMatch(/200 percent browser zoom/i);
    expect(text).toMatch(/44 by 44 pixels/i);
    // Wide content scrolls inside its own box rather than the page scrolling sideways.
    expect(text).toMatch(/scroll inside their own box/i);
  });
});

describe("what we have checked", () => {
  it("describes the automatic scan and what it can catch", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toMatch(/every page is scanned automatically/i);
    expect(text).toMatch(/desktop width/i);
    expect(text).toMatch(/phone\s+width/i);
    expect(text).toMatch(/alternative text/i);
    expect(text).toMatch(/no label/i);
    expect(text).toMatch(/heading levels that skip/i);
    expect(text).toMatch(/contrast/i);
  });

  it("says the scan cannot see everything", () => {
    const { container } = render(<AccessibilityPage />);
    expect(visibleText(container)).toMatch(/Automated checks cannot see everything/i);
  });

  it("names the tools that were walked with the keyboard and measured at a phone width", () => {
    const { container } = render(<AccessibilityPage />);
    const text = visibleText(container);

    expect(text).toMatch(/sale timeline/i);
    expect(text).toMatch(/calculators/i);
    expect(text).toMatch(/packing list/i);
    expect(text).toMatch(/venue map/i);
    expect(text).toMatch(/only the keyboard/i);
    expect(text).toMatch(/assistive technology/i);
  });
});

describe("known limitations", () => {
  it("says the maps and calculators need a current browser", () => {
    render(<AccessibilityPage />);
    const section = screen.getByRole("region", { name: /known limitations/i });
    const text = visibleText(section as HTMLElement);

    expect(text).toMatch(/Maps and calculators need a current browser/i);
    expect(text).toMatch(/Chrome, Safari, Firefox or\s+Edge/i);
    expect(text).toMatch(/in-app browsers/i);
  });

  it("admits no page has been read with a screen reader, and names the ones a reader might try", () => {
    render(<AccessibilityPage />);
    const section = screen.getByRole("region", { name: /known limitations/i });
    const text = visibleText(section as HTMLElement);

    expect(text).toMatch(/NVDA/);
    expect(text).toMatch(/JAWS/);
    expect(text).toMatch(/VoiceOver/);
    expect(text).toMatch(/TalkBack/);
    expect(text).toMatch(/not been tried by hand/i);
    // And it never presents the checks as done.
    expect(text).not.toMatch(/tested with (a |the )?screen reader/i);
    expect(text).not.toMatch(/verified with (a |the )?screen reader/i);
  });

  it("admits the site is dark only and that third-party pages are outside its control", () => {
    render(<AccessibilityPage />);
    const section = screen.getByRole("region", { name: /known limitations/i });
    const text = visibleText(section as HTMLElement);

    expect(text).toMatch(/dark only/i);
    expect(text).toMatch(/no light theme/i);
    expect(text).toMatch(/forced-colours/i);
    expect(text).toMatch(/outside our control/i);
  });
});

describe("telling us about a problem", () => {
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
  it("states 27 November 2026, in a machine-readable time element", () => {
    const { container } = render(<AccessibilityPage />);

    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-11-27");
    expect(time).toHaveTextContent("27 November 2026");
    expect(visibleText(container)).toMatch(/Last reviewed\s+27 November 2026/);
  });
});

/*
  Presentation conventions this page has to hold, alongside the wording the sections above guard.
  The page carries the same reading grammar as /about and the guides: one break per boundary, one
  review line at the close, and no stacked rules.
*/
describe("presentation conventions", () => {
  it("uses one GoldDivider per boundary that wants an ornament, and no more", () => {
    const { container } = render(<AccessibilityPage />);
    // Three boundaries: after the display settings, after the checks, and before the report.
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

  it("keeps every section on the page's own class, so none draws a rule of its own", () => {
    const { container } = render(<AccessibilityPage />);
    const sections = Array.from(container.querySelectorAll("main > section"));

    expect(sections).toHaveLength(5);
    for (const section of sections) expect(section.className).toContain("a11y-page-section");
    // Every section is named by its own heading rather than by a loose aria-label.
    for (const section of sections) {
      const labelledBy = section.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      expect(within(section as HTMLElement).getByRole("heading", { level: 2 })).toHaveAttribute(
        "id",
        labelledBy,
      );
    }
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

  it("describes the page without the vocabulary of a compliance statement", () => {
    const description = String(metadata.description);

    expect(description.length).toBeGreaterThan(50);
    expect(description.length).toBeLessThanOrEqual(320);
    expect(description).not.toMatch(/WCAG|compliant|conforms|conformance/i);
    expect(description).toMatch(/text size|contrast/i);
  });
});
