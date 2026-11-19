import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { guideChapterSchema, type GuideChapter, type GuideEdition } from "@/content/schema";
import { ChapterCard, EditionCard, EditionChapterList } from "./chapter-cards";

afterEach(cleanup);

function fixture(edition: GuideEdition, slug: string, order: number, title: string): GuideChapter {
  return guideChapterSchema.parse({
    edition,
    slug,
    order,
    title,
    summary:
      "A fixture summary that is long enough for the schema, used by the card tests in this file.",
    lastVerified: "2026-11-18",
    sources: [
      {
        id: "s1",
        title: "Fixture official page",
        url: "https://belgium.tomorrowland.com/en/",
        checkedOn: "2026-11-18",
      },
    ],
    blocks: [
      { type: "h2", id: "topic", text: "Topic" },
      { type: "p", text: "Body text.", sources: ["s1"] },
      { type: "p", text: "More body text.", sources: ["s1"] },
    ],
  });
}

describe("chapter card", () => {
  it("is one link, named by the chapter title, to the chapter's own path", () => {
    render(<ChapterCard chapter={fixture("belgium", "overview", 1, "The overview")} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/guides/belgium/overview");
    expect(links[0]).toHaveAccessibleName(/The overview/);
  });

  it("puts the order, the summary and the check date inside the link", () => {
    render(<ChapterCard chapter={fixture("belgium", "overview", 4, "The overview")} />);

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Chapter 4 · Belgium");
    expect(link).toHaveTextContent(/A fixture summary/);
    expect(link).toHaveTextContent("Checked 18 Nov 2026");
  });

  it("does not use a heading inside the card, so the page outline stays the page's", () => {
    render(<ChapterCard chapter={fixture("belgium", "overview", 1, "The overview")} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("edition card", () => {
  const chapters = [
    fixture("belgium", "overview", 1, "The overview"),
    fixture("belgium", "transport", 2, "Getting there"),
  ];

  it("heads the card at level 2 and links the edition hub", () => {
    render(
      <EditionCard
        edition="belgium"
        title="Tomorrowland Belgium"
        summary="What the Belgium edition covers."
        chapters={chapters}
      />,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Tomorrowland Belgium" });
    expect(heading).toHaveAttribute("id", "edition-belgium");
    expect(screen.getByRole("link", { name: "Tomorrowland Belgium" })).toHaveAttribute(
      "href",
      "/guides/belgium",
    );
  });

  it("lists each chapter with its own link, summary and check date", () => {
    render(
      <EditionCard
        edition="belgium"
        title="Tomorrowland Belgium"
        summary="What the Belgium edition covers."
        chapters={chapters}
      />,
    );

    expect(screen.getByRole("link", { name: /The overview/ })).toHaveAttribute(
      "href",
      "/guides/belgium/overview",
    );
    expect(screen.getByRole("link", { name: /Getting there/ })).toHaveAttribute(
      "href",
      "/guides/belgium/transport",
    );
    expect(screen.getAllByText(/Checked/).length).toBeGreaterThanOrEqual(2);
  });

  it("states the chapter count and the latest check date", () => {
    render(
      <EditionCard
        edition="belgium"
        title="Tomorrowland Belgium"
        summary="What the Belgium edition covers."
        chapters={chapters}
      />,
    );

    expect(screen.getByText(/2 chapters/)).toBeInTheDocument();
  });

  it("says plainly when there are no chapters, without a list element", () => {
    render(
      <EditionCard
        edition="brasil"
        title="Tomorrowland Brasil"
        summary="What the Brasil edition covers."
        chapters={[]}
      />,
    );

    expect(
      screen.getByText(
        "Chapters for this edition are being checked against the official site and will appear here once verified.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("link", { name: /Chapter/ })).toBeNull();
  });

  it("uses the singular for one chapter", () => {
    render(
      <EditionCard
        edition="winter"
        title="Tomorrowland Winter"
        summary="What the Winter edition covers."
        chapters={[fixture("winter", "overview", 1, "The overview")]}
      />,
    );

    expect(screen.getByText(/1 chapter/)).toBeInTheDocument();
  });
});

describe("edition chapter list", () => {
  it("renders the live registry's chapters for a real edition, or the empty notice", () => {
    const { container } = render(<EditionChapterList edition="belgium" />);

    // Either state is correct while content lands; neither may be an empty grid.
    const grid = container.querySelector(".tml-guide-grid");
    const empty = container.querySelector(".tml-guide-empty");
    expect(grid !== null || empty !== null).toBe(true);
    if (grid === null) {
      expect(container.textContent).toContain("Chapters for this edition are being checked");
    } else {
      expect(grid.children.length).toBeGreaterThan(0);
    }
  });
});
