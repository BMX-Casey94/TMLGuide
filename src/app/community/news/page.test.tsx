import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import CommunityNewsPage, { CommunityNewsView } from "./page";
import { getPublishedNews } from "@/lib/community/news";

/*
  `getPublishedNews` is a `use cache` function, so the page awaits it directly
  rather than putting it behind a Suspense boundary. That makes the page a plain
  async Server Component, and it means the tests can render the real markup with
  an injected feed instead of mocking a boundary that jsdom never resolves.
*/

vi.mock("@/lib/community/news", () => ({
  getPublishedNews: vi.fn(),
}));

const RECORD = {
  id: "belgium-sale-date-confirmed",
  edition: "belgium" as const,
  title: "Belgium sale date confirmed",
  slug: "belgium-sale-date-confirmed",
  publishedOn: "2026-11-24",
  summary: "The official page now lists the sale date.",
  body: "The date is confirmed.",
  tags: ["tickets"],
  source: {
    url: "https://www.tomorrowland.com/home/",
    title: "Tomorrowland",
    retrievedOn: "2026-11-24",
  },
  lastVerified: "2026-11-24",
  confidence: "official" as const,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the news page", () => {
  it("has one h1 and says what the page is for", async () => {
    vi.mocked(getPublishedNews).mockResolvedValue({ items: [], state: "ok" });
    render(await CommunityNewsPage());

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("News");
  });

  it("is one main landmark carrying the skip-link target", async () => {
    vi.mocked(getPublishedNews).mockResolvedValue({ items: [], state: "ok" });
    const { container } = render(await CommunityNewsPage());

    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main")?.id).toBe("main");
  });

  it("renders the feed from the loader", async () => {
    vi.mocked(getPublishedNews).mockResolvedValue({
      items: [{ item: RECORD, likeCount: 2, publishedAt: "2026-11-24T12:00:00.000Z" }],
      state: "ok",
    });
    render(await CommunityNewsPage());

    expect(screen.getByRole("heading", { name: RECORD.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tomorrowland/ })).toBeInTheDocument();
    expect(getPublishedNews).toHaveBeenCalledTimes(1);
  });
});

describe("CommunityNewsView — the three feed states", () => {
  it("shows the honest empty state when nothing is published", () => {
    render(<CommunityNewsView feed={{ items: [], state: "ok" }} />);

    expect(
      screen.getByRole("heading", { name: "No news updates published yet" }),
    ).toBeInTheDocument();
  });

  it("shows the could-not-load state when the read failed", () => {
    render(<CommunityNewsView feed={{ items: [], state: "unavailable" }} />);

    expect(screen.getByRole("heading", { name: "News could not be loaded" })).toBeInTheDocument();
  });

  it("shows the not-configured state when there is no backend, in different words", () => {
    render(<CommunityNewsView feed={{ items: [], state: "unconfigured" }} />);

    expect(
      screen.getByRole("heading", { name: "News is not switched on yet" }),
    ).toBeInTheDocument();
    // The three empty states must read differently, or the page is telling a
    // reader something it does not know.
    expect(screen.queryByText("No news updates published yet")).not.toBeInTheDocument();
    expect(screen.queryByText("News could not be loaded")).not.toBeInTheDocument();
  });

  it("renders a published item with its citation", () => {
    render(
      <CommunityNewsView
        feed={{
          items: [{ item: RECORD, likeCount: 2, publishedAt: "2026-11-24T12:00:00.000Z" }],
          state: "ok",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: RECORD.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tomorrowland/ })).toHaveAttribute("target", "_blank");
  });

  it("never renders a placeholder article in an empty state", () => {
    const { container } = render(<CommunityNewsView feed={{ items: [], state: "ok" }} />);
    expect(container.querySelectorAll("article")).toHaveLength(0);
  });
});

describe("CommunityNewsView — the rest of the page", () => {
  it("offers the report form with a labelled reason for each option", () => {
    render(<CommunityNewsView feed={{ items: [], state: "ok" }} />);

    expect(screen.getByRole("heading", { name: "Found something wrong?" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "What is wrong" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("links back to the community hub", () => {
    render(<CommunityNewsView feed={{ items: [], state: "ok" }} />);
    expect(screen.getByRole("link", { name: /Back to the community hub/ })).toHaveAttribute(
      "href",
      "/community",
    );
  });

  it("states the independence position", () => {
    render(<CommunityNewsView feed={{ items: [], state: "ok" }} />);
    expect(screen.getByText(/not affiliated with Tomorrowland/i)).toBeInTheDocument();
  });

  it("uses exactly one GoldDivider, so there is one break before the form", () => {
    const { container } = render(<CommunityNewsView feed={{ items: [], state: "ok" }} />);
    expect(container.querySelectorAll(".tml-divider")).toHaveLength(1);
  });

  it("puts the divider between the feed and the report form", () => {
    const { container } = render(<CommunityNewsView feed={{ items: [], state: "ok" }} />);
    const sections = Array.from(container.querySelectorAll("main > *"));

    const dividerIndex = sections.findIndex((section) => section.classList.contains("tml-divider"));
    expect(dividerIndex).toBeGreaterThan(0);
    expect(sections[dividerIndex + 1]?.textContent).toContain("Found something wrong?");
  });
});
