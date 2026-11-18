import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Card } from "@/components/ui/card";
import { FaqHighlights } from "./faq-highlights";
import { highlightedFaqs } from "./faq-selection";

/* The shared vitest setup does not enable globals, so Testing Library cannot
   register its automatic cleanup. Each UI test file cleans up explicitly. */
afterEach(cleanup);

describe("FaqHighlights", () => {
  it("renders the four highlighted questions", () => {
    render(<FaqHighlights />);

    for (const entry of highlightedFaqs()) {
      expect(screen.getByText(entry.question)).toBeInTheDocument();
    }
  });

  it("uses a native details element, closed by default", () => {
    const { container } = render(<FaqHighlights />);
    const disclosures = container.querySelectorAll("details");

    expect(disclosures).toHaveLength(4);
    for (const disclosure of disclosures) {
      expect(disclosure).not.toHaveAttribute("open");
    }
  });

  it("groups the disclosures so only one opens at a time", () => {
    const { container } = render(<FaqHighlights />);
    const names = Array.from(container.querySelectorAll("details")).map((element) =>
      element.getAttribute("name"),
    );

    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBe("faq-accordion");
  });

  it("gives each disclosure a unique id", () => {
    const { container } = render(<FaqHighlights />);
    const ids = Array.from(container.querySelectorAll("details")).map((element) => element.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("faq-re-entry");
  });

  it("puts each question in an h3 under the section's h2", () => {
    render(<FaqHighlights />);

    const questions = screen.getAllByRole("heading", { level: 3 });
    expect(questions).toHaveLength(4);
  });

  it("summarises each question with a summary element inside the details", () => {
    const { container } = render(<FaqHighlights />);

    for (const disclosure of container.querySelectorAll("details")) {
      const summary = disclosure.querySelector("summary");
      expect(summary).not.toBeNull();
      expect(summary?.textContent?.trim().length).toBeGreaterThan(10);
    }
  });

  it("renders the answer as text, with the emphasis from the Markdown", () => {
    render(<FaqHighlights />);

    // The re-entry answer states the rule in bold; it must be a <strong> element.
    const reEntry = document.getElementById("faq-re-entry");
    expect(reEntry?.querySelector("strong")).not.toBeNull();
    expect(reEntry?.textContent).toContain("OUT = OUT");
  });

  it("renders a bullet list where the answer has one", () => {
    render(<FaqHighlights />);
    const reEntry = document.getElementById("faq-re-entry");

    expect(reEntry?.querySelectorAll("ul li").length).toBeGreaterThanOrEqual(3);
  });

  it("shows the official source as an external link with rel protection", () => {
    render(<FaqHighlights />);

    // The section heading's own action link is internal, so only the citations
    // are checked here: they all leave the site.
    const citations = Array.from(document.querySelectorAll(".home-faq__source-link"));
    expect(citations.length).toBe(4);

    for (const link of citations) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    }
  });

  it("states the check date for every answer", () => {
    render(<FaqHighlights />);
    const checked = screen.getAllByText(/Checked 18 November 2026/);
    expect(checked).toHaveLength(4);
  });

  it("never renders a script tag from the answer text", () => {
    const { container } = render(
      <FaqHighlights
        entries={[
          {
            ...highlightedFaqs()[0],
            answer: "<script>alert(1)</script> and **bold**.",
          },
        ]}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("accepts an empty list and renders no disclosures", () => {
    const { container } = render(<FaqHighlights entries={[]} />);
    expect(container.querySelectorAll("details")).toHaveLength(0);
  });

  it("takes a custom id prefix so two accordions can share a page", () => {
    const { container } = render(<FaqHighlights entries={[highlightedFaqs()[0]]} idPrefix="home" />);
    expect(container.querySelector("details")?.id).toBe("home-re-entry");
  });
});

describe("the section's heading", () => {
  it("never skips a level beneath the section h2", () => {
    render(
      <>
        <FaqHighlights />
        <Card kicker="Kicker" title="Example card" />
      </>,
    );

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    // Four questions plus the kit card, all one level down from the h2.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(5);
    expect(screen.queryAllByRole("heading", { level: 4 })).toHaveLength(0);
  });
});
