import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guideChapterSchema, type GuideChapter, type GuideEdition } from "@/content/schema";

/*
  `notFound()` throws a framework control-flow error that needs a request scope, so
  it is replaced with a plain throw the tests can catch. The decision that leads to
  it is a pure function with its own suite in `src/components/guides/routes.test.ts`.
*/
const NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

const editionModule = await import("@/app/guides/[edition]/page");
const EditionHub = editionModule.EditionHub;
const generateMetadata = editionModule.generateMetadata;
const generateStaticParams = editionModule.generateStaticParams;
const EditionPage = editionModule.default;

function fixture(edition: GuideEdition, slug: string, order: number, title: string): GuideChapter {
  return guideChapterSchema.parse({
    edition,
    slug,
    order,
    title,
    summary:
      "A fixture summary long enough for the schema, used by the edition hub tests only here.",
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

const CHAPTERS = [
  fixture("belgium", "overview", 1, "Belgium overview"),
  fixture("belgium", "dates-and-sales", 2, "Dates and sales"),
];

afterEach(cleanup);

describe("static params and metadata", () => {
  it("prerenders all four editions", () => {
    expect(generateStaticParams().map((param) => param.edition)).toEqual([
      "belgium",
      "winter",
      "brasil",
      "general",
    ]);
  });

  it("uses the edition title and summary for the metadata", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ edition: "winter" }) });

    expect(meta.title).toBe("Tomorrowland Winter");
    expect(meta.description).toMatch(/Alpe d'Huez/);
    expect(meta.alternates?.canonical).toBe("/guides/winter");
    expect(meta.openGraph).toMatchObject({ url: "/guides/winter", type: "website" });
  });

  it("gives the general edition its own title", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ edition: "general" }) });
    expect(meta.title).toBe("Good to know");
    expect(meta.alternates?.canonical).toBe("/guides/general");
  });

  it("returns a not-found title for an unknown edition", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ edition: "thailand" }) });
    expect(meta.title).toBe("Edition not found");
    expect(meta.alternates).toBeUndefined();
  });
});

describe("the edition hub", () => {
  it("renders the edition title, summary and breadcrumb", () => {
    render(<EditionHub edition="belgium" chapters={CHAPTERS} />);

    expect(screen.getByRole("heading", { level: 1, name: "Tomorrowland Belgium" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Guides" })).toHaveAttribute("href", "/guides");
    expect(within(crumbs).getByText("Belgium")).toHaveAttribute("aria-current", "page");
  });

  it("lists each chapter as a card linking to its own page", () => {
    render(<EditionHub edition="belgium" chapters={CHAPTERS} />);

    expect(screen.getByRole("link", { name: /Belgium overview/ })).toHaveAttribute(
      "href",
      "/guides/belgium/overview",
    );
    expect(screen.getByRole("link", { name: /Dates and sales/ })).toHaveAttribute(
      "href",
      "/guides/belgium/dates-and-sales",
    );
  });

  it("shows the chapter order, the summary and the check date", () => {
    const { container } = render(<EditionHub edition="belgium" chapters={CHAPTERS} />);

    expect(screen.getByText("Chapter 1 · Belgium")).toBeInTheDocument();
    expect(screen.getByText("Chapter 2 · Belgium")).toBeInTheDocument();
    expect(container.textContent).toMatch(/18 Nov 2026/);
  });

  it("states how many chapters there are and the latest check date", () => {
    render(<EditionHub edition="belgium" chapters={CHAPTERS} />);

    expect(screen.getByText("2 chapters")).toBeInTheDocument();
    expect(screen.getByText(/Latest check/)).toBeInTheDocument();
  });

  it("says plainly when an edition has no chapters yet", () => {
    render(<EditionHub edition="brasil" chapters={[]} />);

    expect(
      screen.getByText(
        "Chapters for this edition are being checked against the official site and will appear here once verified.",
      ),
    ).toBeInTheDocument();
    // No empty list, and no chapter link to nowhere.
    expect(screen.queryByRole("link", { name: /Chapter/ })).toBeNull();
    expect(document.querySelector("ul.tml-guide-list")).toBeNull();
  });

  it("drops the empty state as soon as one chapter exists", () => {
    render(<EditionHub edition="belgium" chapters={CHAPTERS} />);

    expect(
      screen.queryByText(/Chapters for this edition are being checked/),
    ).not.toBeInTheDocument();
  });

  it("publishes only the breadcrumb structured data", () => {
    const { container } = render(<EditionHub edition="winter" chapters={[]} />);

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    const payload = JSON.parse(scripts[0]?.innerHTML ?? "{}") as {
      "@type": string;
      itemListElement: { name: string; item: string; position: number }[];
    };
    expect(payload["@type"]).toBe("BreadcrumbList");
    expect(payload.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: "/guides" },
      { "@type": "ListItem", position: 3, name: "Winter", item: "/guides/winter" },
    ]);
    expect(container.innerHTML).not.toContain('"@type":"Article"');
  });
});

describe("the page", () => {
  it("wraps the hub in one main landmark with the skip-link target", async () => {
    const element = await EditionPage({ params: Promise.resolve({ edition: "belgium" }) });
    render(element);

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("answers an unknown edition with notFound()", async () => {
    await expect(
      EditionPage({ params: Promise.resolve({ edition: "thailand" }) }),
    ).rejects.toThrow(NOT_FOUND);
  });
});
