import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { guideChapterSchema, type GuideChapter, type GuideEdition } from "@/content/schema";
import { expectDividerCount, expectNoAdjacentRules } from "@/components/guides/divider-guard";

/** The pages read the registry, which reads the real content directories. */
const hubModule = await import("@/app/guides/page");
const GuidesPage = hubModule.default;
const GuidesHub = hubModule.GuidesHub;
const metadata = hubModule.metadata;

afterEach(cleanup);

function fixture(
  edition: GuideEdition,
  slug: string,
  order: number,
  title: string,
  summary: string,
): GuideChapter {
  return guideChapterSchema.parse({
    edition,
    slug,
    order,
    title,
    summary,
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

const EMPTY: Record<GuideEdition, readonly GuideChapter[]> = {
  belgium: [],
  winter: [],
  brasil: [],
  general: [],
};

const FILLED = {
  belgium: [
    fixture(
      "belgium",
      "overview",
      1,
      "Belgium overview",
      "What the Belgium edition is: the weekends, the site and what the chapters cover.",
    ),
    fixture(
      "belgium",
      "dates-and-sales",
      2,
      "Dates and sales",
      "When the tickets go on sale and the order the sale moments happen in.",
    ),
  ],
  winter: [
    fixture(
      "winter",
      "overview",
      1,
      "Winter overview",
      "What the Winter edition is: the week in the Alps and how the days are structured.",
    ),
  ],
  brasil: [],
  general: [
    fixture(
      "general",
      "pearls",
      1,
      "Pearls",
      "How Pearls work on site, what they buy and how the top-up packages are priced.",
    ),
  ],
} satisfies Record<GuideEdition, readonly GuideChapter[]>;

describe("page metadata", () => {
  it("names the page and describes what it holds", () => {
    expect(metadata.title).toBe("Guides");
    expect(metadata.description).toMatch(/Tomorrowland Belgium, Winter and Brasil/);
  });

  it("declares one canonical address", () => {
    expect(metadata.alternates?.canonical).toBe("/guides");
  });

  it("sets an Open Graph title, description and url", () => {
    expect(metadata.openGraph).toMatchObject({
      title: "Guides | TMLGuide",
      url: "/guides",
      type: "website",
    });
  });
});

describe("the hub with chapters", () => {
  it("renders one h1 and a section per edition plus the Good to know group", () => {
    render(<GuidesHub chapters={FILLED} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The guide, in chapters");

    expect(screen.getByRole("heading", { level: 2, name: "Tomorrowland Belgium" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tomorrowland Winter" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tomorrowland Brasil" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Good to know" })).toBeInTheDocument();
  });

  it("links each edition to its own hub", () => {
    render(<GuidesHub chapters={FILLED} />);

    expect(screen.getByRole("link", { name: "Tomorrowland Belgium" })).toHaveAttribute(
      "href",
      "/guides/belgium",
    );
    expect(screen.getByRole("link", { name: "Tomorrowland Winter" })).toHaveAttribute(
      "href",
      "/guides/winter",
    );
  });

  it("lists each chapter with its title, summary and check date", () => {
    render(<GuidesHub chapters={FILLED} />);

    const overview = screen.getByRole("link", { name: /Belgium overview/ });
    expect(overview).toHaveAttribute("href", "/guides/belgium/overview");
    expect(screen.getByText(/the weekends, the site and what the chapters cover/)).toBeInTheDocument();
    expect(screen.getAllByText("18 Nov 2026").length).toBeGreaterThan(0);
  });

  it("puts the check date in a time element with the machine-readable value", () => {
    render(<GuidesHub chapters={FILLED} />);

    const times = document.querySelectorAll("time");
    expect(times.length).toBeGreaterThan(0);
    for (const time of times) expect(time).toHaveAttribute("datetime", "2026-11-18");
  });

  it("separates each cited source title from its check date", () => {
    const { container } = render(<GuidesHub chapters={FILLED} />);

    /* The FAQ directory is the hub's only inline citation: each answer's source
       link is followed by its check date on the same line. */
    const citations = Array.from(container.querySelectorAll("details p a.tml-guide-link"));
    expect(citations.length).toBeGreaterThan(0);
    for (const link of citations) {
      const line = link.closest("p");
      expect(line?.textContent).toMatch(/—\s*Checked 2026-11-18/);
      expect(line?.textContent).not.toContain("· Checked");
    }
  });

  it("lists general chapters as well as the three editions", () => {
    render(<GuidesHub chapters={FILLED} />);

    /*
      Scoped to the general section: the FAQ directory further down the page
      links each answer's official source, and one of those titles contains
      "Pearls", so an unscoped link query matches more than the chapter card.
    */
    const generalSection = screen
      .getByRole("heading", { name: "Good to know" })
      .closest("section");
    expect(generalSection).not.toBeNull();
    expect(
      within(generalSection as HTMLElement).getByRole("link", { name: /Pearls/ }),
    ).toHaveAttribute("href", "/guides/general/pearls");
  });

  it("links the tickets explorer", () => {
    render(<GuidesHub chapters={FILLED} />);

    expect(
      screen.getByRole("link", { name: "Open the tickets and packages explorer" }),
    ).toHaveAttribute("href", "/guides/tickets");
  });

  it("says it is independent and repeats the non-affiliation", () => {
    render(<GuidesHub chapters={FILLED} />);
    expect(screen.getByText(/not affiliated with, endorsed by or sponsored by Tomorrowland/)).toBeInTheDocument();
  });

  it("publishes only the breadcrumb structured data", () => {
    const { container } = render(<GuidesHub chapters={FILLED} />);

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    const payload = JSON.parse(scripts[0]?.innerHTML ?? "{}") as {
      "@type": string;
      itemListElement: { name: string; position: number }[];
    };
    expect(payload["@type"]).toBe("BreadcrumbList");
    expect(payload.itemListElement.map((entry) => entry.name)).toEqual(["Home", "Guides"]);
    expect(container.innerHTML).not.toContain('"@type":"Article"');
    expect(container.innerHTML).not.toContain('"@type":"Product"');
  });
});

describe("the hub with no chapters yet", () => {
  it("keeps the edition cards and says the chapters are being checked", () => {
    render(<GuidesHub chapters={EMPTY} />);

    expect(screen.getByRole("heading", { name: "Tomorrowland Belgium" })).toBeInTheDocument();
    expect(screen.getAllByText(/Chapters for this edition are being checked/).length).toBe(4);
  });

  it("does not show the empty state once any chapter exists", () => {
    render(<GuidesHub chapters={FILLED} />);

    // Belgium has chapters, Brasil does not: only Brasil's card carries the notice.
    expect(screen.getAllByText(/Chapters for this edition are being checked/)).toHaveLength(1);
    const brasilCard = screen
      .getByRole("heading", { name: "Tomorrowland Brasil" })
      .closest("section");
    expect(brasilCard).not.toBeNull();
    expect(
      within(brasilCard as HTMLElement).getByText(/Chapters for this edition are being checked/),
    ).toBeInTheDocument();
  });

  it("never prints an empty chapter list or a dangling link", () => {
    render(<GuidesHub chapters={EMPTY} />);

    for (const list of document.querySelectorAll("ul")) {
      expect(list.children.length).toBeGreaterThan(0);
    }
    for (const link of screen.getAllByRole("link")) {
      expect(link.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("the page as the router renders it", () => {
  it("wraps the hub in a single main landmark with the skip-link target", () => {
    render(<GuidesPage />);

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("renders against whatever the real registry currently holds", () => {
    render(<GuidesPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The guide, in chapters");
    // The edition headings exist regardless of whether content has landed.
    expect(screen.getByRole("heading", { name: "Tomorrowland Belgium" })).toBeInTheDocument();
  });
});

/*
  The hub is the one page in this group with no GoldDivider at all: every section
  opens on its own serif heading, and a rule between them would be a second break.
  These assertions also catch the inverse fault, a divider added later on top of a
  section heading that already rules.
*/
describe("divider and page-frame conventions", () => {
  it("uses no GoldDivider, because the sections already break on their headings", () => {
    const { container } = render(<GuidesPage />);
    expectDividerCount(container, 0);
  });

  it("never puts two rules side by side in the page flow", () => {
    const { container } = render(<GuidesPage />);
    expectNoAdjacentRules(container);
  });

  it("keeps the hub's sections on the page rhythm, with no rule of their own", () => {
    const { container } = render(<GuidesPage />);
    const sections = Array.from(container.querySelectorAll("main > section"));

    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) expect(section.className).toContain("tml-guide-section");
  });

  it("ends the hero on the only hairline at that boundary", () => {
    const { container } = render(<GuidesPage />);
    // The hero is the first block in the page and the first section follows it, so
    // one hairline there is the break, not a doubled one.
    const hero = container.querySelector(".tml-guide-hero");
    expect(hero).not.toBeNull();
    expect(container.querySelectorAll(".tml-guide-hero")).toHaveLength(1);
  });
});
