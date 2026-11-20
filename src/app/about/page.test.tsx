import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import AboutPage, { metadata } from "@/app/about/page";
import { CORRECTIONS_EMAIL } from "@/components/home/contact";
import { OFFICIAL_HOST_ROLES } from "@/components/home/source-hosts";
import { expectResolvableLinks, expectSoundHeadingOrder } from "@/components/home/page-assertions";
import {
  expectDividerCount,
  expectNoAdjacentRules,
  topLevelBlocks,
} from "@/components/guides/divider-guard";

/**
 * Page-level tests for the About page.
 *
 * The claims this suite guards are the ones the brief calls out: the
 * independence statement names both entities, the method is described as it
 * actually works, no email address is invented, no organisation is claimed, and
 * the data-sources table lists official hosts only.
 *
 * Text assertions read the page's visible text with the JSON-LD script removed:
 * a claim about what a reader is told must not be satisfied or broken by the
 * structured data in the head.
 */
function visibleText(container: HTMLElement): string {
  const copy = container.cloneNode(true) as HTMLElement;
  for (const script of Array.from(copy.querySelectorAll("script"))) script.remove();
  return copy.textContent ?? "";
}

/* Testing Library cannot register its automatic cleanup here because the shared
   setup does not enable globals. Without this, each render accumulates in the
   same document and every query finds two matches. */
afterEach(cleanup);
describe("AboutPage structure", () => {
  it("renders a main landmark with one h1 and no skipped heading level", () => {
    const { container } = render(<AboutPage />);

    expect(container.querySelector("main")).toHaveAttribute("id", "main");
    expectSoundHeadingOrder(container);
  });

  it("names the page in its h1", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/independent guide/i);
  });

  it("links only to known routes and outbound links safely", () => {
    const { container } = render(<AboutPage />);
    expectResolvableLinks(container);
  });
});

describe("the independence statement", () => {
  it("says plainly that the site is not affiliated, naming both entities", () => {
    const { container } = render(<AboutPage />);
    // The callout's paragraph carries the whole statement across one text node.
    const statement = Array.from(container.querySelectorAll(".about-callout p")).map(
      (element) => element.textContent ?? "",
    )[0];

    expect(statement).toContain("Not affiliated.");
    expect(statement).toContain("not affiliated with, endorsed by or sponsored by");
    expect(statement).toContain("Tomorrowland");
    expect(statement).toContain("WeAreOne.World B.V.");
  });

  it("does not claim an organisation or a company number anywhere", () => {
    const { container } = render(<AboutPage />);
    const text = visibleText(container);

    expect(text).not.toMatch(/registered (company|in England)/i);
    expect(text).not.toMatch(/company (number|no\.)/i);
    expect(text).not.toMatch(/\bLtd\b|\bLimited\b|GmbH|B\.V\.B\.A\./);
    expect(text).not.toMatch(/our (team of|office|headquarters)/i);
  });

  it("does not claim official status", () => {
    const { container } = render(<AboutPage />);
    const text = visibleText(container).toLowerCase();

    // Mentioning official pages is the point of the site; claiming to be one is
    // the thing being excluded, so these patterns look for a self-description.
    expect(text).not.toMatch(/official (partner|ticketing|reseller|source of truth)/);
    expect(text).not.toMatch(/(is|are) an? official/);
    expect(text).not.toMatch(/we are (the )?official/);
    expect(text).not.toContain("authorised reseller");
    expect(text).not.toContain("official guide");
  });
});

describe("the method section", () => {
  it("describes official sources first", () => {
    render(<AboutPage />);
    expect(screen.getByText("Official sources only.")).toBeInTheDocument();
  });

  it("lists the verdict labels the ledgers use", () => {
    const { container } = render(<AboutPage />);
    const text = visibleText(container);

    for (const verdict of ["confirmed", "changed", "outdated", "unverifiable", "contradicted"]) {
      expect(text).toContain(verdict);
    }
  });

  it("says a figure carries the year it applies to", () => {
    render(<AboutPage />);
    expect(screen.getByText(/Figures carry their year/)).toBeInTheDocument();
  });

  it("describes link checking rather than assuming links work", () => {
    render(<AboutPage />);
    expect(screen.getByText(/Links are checked, not assumed/)).toBeInTheDocument();
  });

  it("says currencies are never converted", () => {
    render(<AboutPage />);
    expect(screen.getByText(/Currencies are never converted/)).toBeInTheDocument();
  });

  it("states the last verified date", () => {
    const { container } = render(<AboutPage />);
    expect(visibleText(container)).toMatch(/last checked on 18 November 2026/i);
  });
});

describe("the corrections policy", () => {
  it("points to the community channels", () => {
    render(<AboutPage />);
    const link = screen.getByRole("link", { name: "community channels" });
    expect(link).toHaveAttribute("href", "/community");
  });

  it("invents no email address while none exists", () => {
    const { container } = render(<AboutPage />);

    expect(CORRECTIONS_EMAIL).toBeNull();
    expect(container.querySelectorAll('a[href^="mailto:"]')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it("marks the contact spot as not yet published, rather than leaving it blank", () => {
    render(<AboutPage />);
    expect(screen.getByText(/no general contact address published yet/)).toBeInTheDocument();
  });

  it("explains that an unconfirmable figure comes off the page", () => {
    render(<AboutPage />);
    expect(screen.getByText(/comes off the page/)).toBeInTheDocument();
  });
});

describe("the partners disclosure", () => {
  it("links to the partners section of the community page", () => {
    render(<AboutPage />);
    const link = screen.getByRole("link", { name: "community partners section" });
    expect(link).toHaveAttribute("href", "/community#partners");
  });

  it("says no partner pays for placement", () => {
    render(<AboutPage />);
    expect(screen.getByText(/No partner pays for placement/)).toBeInTheDocument();
  });
});

describe("the privacy summary", () => {
  it("says there is no tracking, without inventing a cookie policy", () => {
    render(<AboutPage />);
    const text = screen.getByText(/There is no analytics, no advertising/).textContent ?? "";

    expect(text).toContain("no analytics");
    expect(text).not.toMatch(/cookie (policy|consent|banner)/i);
  });

  it("names the two things stored in the browser and nothing more", () => {
    render(<AboutPage />);
    const text = screen.getByText(/Two things are stored in your browser/).textContent ?? "";

    expect(text).toContain("edition");
    expect(text).toContain("radio volume");
  });

  it("says analytics would require this text and a consent step to change", () => {
    render(<AboutPage />);
    expect(screen.getByText(/a consent step must change with it/)).toBeInTheDocument();
  });
});

describe("the data-sources table", () => {
  it("renders a table with a caption and two columns", () => {
    render(<AboutPage />);

    const table = screen.getByRole("table", { name: "Official sources, by host" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
  });

  it("lists every official host the data cites, with its role", () => {
    render(<AboutPage />);
    const table = screen.getByRole("table", { name: "Official sources, by host" });

    for (const entry of OFFICIAL_HOST_ROLES) {
      const row = within(table).getByRole("rowheader", { name: entry.host });
      expect(within(row.closest("tr") as HTMLElement).getByText(entry.role)).toBeInTheDocument();
    }
  });

  it("lists official hosts only, never a marketplace or an aggregator", () => {
    render(<AboutPage />);
    const text = screen.getByRole("table", { name: "Official sources, by host" }).textContent ?? "";

    expect(text).not.toContain("ticketswap");
    expect(text).not.toContain("viagogo");
    expect(text).not.toContain("chat.whatsapp.com");
    expect(text).not.toContain("festivalviewer");
  });

  it("shows each host as plain text, so a row is not a link to a moving page", () => {
    render(<AboutPage />);
    const table = screen.getByRole("table", { name: "Official sources, by host" });

    expect(within(table).queryAllByRole("link")).toHaveLength(0);
  });
});

describe("AboutPage metadata", () => {
  it("declares a canonical URL for the page", () => {
    expect(metadata.alternates?.canonical).toBe("/about");
  });

  it("has Open Graph text and no image", () => {
    expect(metadata.openGraph?.title).toBeTruthy();
    expect(metadata.openGraph?.description).toBeTruthy();
    const openGraph = metadata.openGraph as { images?: unknown } | undefined;
    expect(openGraph?.images).toBeUndefined();
  });

  it("emits WebPage JSON-LD tied to the site, claiming no organisation", () => {
    const { container } = render(<AboutPage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const json = script?.innerHTML ?? "";
    const parsed = JSON.parse(json);

    expect(parsed["@type"]).toBe("WebPage");
    expect(parsed.isPartOf["@type"]).toBe("WebSite");
    expect(parsed.isPartOf.name).toBe("TMLGuide");
    expect(json).not.toContain("Organization");
    expect(json).not.toContain("SearchAction");
  });
});

/*
  The owner reported two dividers below the paragraph that ends the independence
  callout, and a "Last checked" line sitting at the page's left edge. The first is
  duplicated markup; the second was a box that carried the reading measure and the
  page inset on the same element with no centring.
*/
describe("divider and page-frame conventions", () => {
  it("uses one GoldDivider and no section rule alongside it", () => {
    const { container } = render(<AboutPage />);
    expectDividerCount(container, 1);
  });

  it("never puts two rules side by side in the page flow", () => {
    const { container } = render(<AboutPage />);
    expectNoAdjacentRules(container);
  });

  it("puts the divider between the opening section and the method section", () => {
    const { container } = render(<AboutPage />);
    const blocks = topLevelBlocks(container);
    const index = blocks.findIndex((block) => block.classList.contains("tml-divider"));

    expect(index).toBeGreaterThan(0);
    expect(blocks[index - 1]?.querySelector("h2")?.textContent).toBe("Who runs this");
    expect(blocks[index + 1]?.querySelector("h2")?.textContent).toBe("How facts are checked");
  });

  it("hands sections no bottom rule, so the hero's hairline is the only one", () => {
    const { container } = render(<AboutPage />);
    // Every top-level section is on the page's own class, which the stylesheet
    // renders without a border.
    const sections = Array.from(container.querySelectorAll("main > section"));
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) expect(section.className).toContain("about-section");
  });

  it("wraps the closing line in the page column rather than leaving it at the edge", () => {
    const { container } = render(<AboutPage />);
    const footnote = container.querySelector(".about-footnote");
    const text = container.querySelector(".about-footnote__text");

    expect(footnote).not.toBeNull();
    // The column and the measure are separate elements: the column carries the
    // inset, the paragraph carries the 65-character cap.
    expect(footnote?.tagName).toBe("DIV");
    expect(text?.tagName).toBe("P");
    expect(text?.textContent).toMatch(/Last checked 18 November 2026/);
  });
});
