import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { NewsFeed } from "./news-feed";
import { NewsLikeButton } from "./news-like-button";
import { parseNewsBody, parseNewsInline } from "./news-body";
import type { PublishedNewsItem } from "@/lib/community/news-schema";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const RECORD = {
  id: "belgium-sale-date-confirmed",
  edition: "belgium" as const,
  title: "Belgium sale date confirmed",
  slug: "belgium-sale-date-confirmed",
  publishedOn: "2026-11-24",
  summary: "The official page now lists the sale date.",
  body: "The date is confirmed.\n\n## What changed\n\n- The date moved\n- The page was updated",
  tags: ["tickets", "sale-dates"],
  source: {
    url: "https://www.tomorrowland.com/home/",
    title: "Tomorrowland",
    retrievedOn: "2026-11-24",
  },
  lastVerified: "2026-11-24",
  confidence: "official" as const,
};

function item(overrides: Partial<PublishedNewsItem> = {}): PublishedNewsItem {
  return {
    item: RECORD,
    likeCount: 4,
    publishedAt: "2026-11-24T12:00:00.000Z",
    ...overrides,
  };
}

describe("parseNewsBody", () => {
  it("splits paragraphs, headings and lists", () => {
    const blocks = parseNewsBody("One.\n\n## Head\n\n- a\n- b\n\nTwo.");
    expect(blocks).toEqual([
      { kind: "paragraph", text: "One." },
      { kind: "heading", text: "Head" },
      { kind: "list", items: ["a", "b"] },
      { kind: "paragraph", text: "Two." },
    ]);
  });

  it("joins the lines of one paragraph into a sentence", () => {
    expect(parseNewsBody("first line\nsecond line")).toEqual([
      { kind: "paragraph", text: "first line second line" },
    ]);
  });

  it("ends a list at a heading", () => {
    expect(parseNewsBody("- a\n## Head")).toEqual([
      { kind: "list", items: ["a"] },
      { kind: "heading", text: "Head" },
    ]);
  });

  it("drops an empty heading and an empty list item", () => {
    expect(parseNewsBody("##   \n-   \n\nText.")).toEqual([{ kind: "paragraph", text: "Text." }]);
  });

  it("returns nothing for an empty body", () => {
    expect(parseNewsBody("")).toEqual([]);
    expect(parseNewsBody("   \n\n  ")).toEqual([]);
  });
});

describe("parseNewsInline", () => {
  it("splits bold runs from plain text", () => {
    expect(parseNewsInline("a **b** c")).toEqual([
      { text: "a ", strong: false },
      { text: "b", strong: true },
      { text: " c", strong: false },
    ]);
  });

  it("leaves an unpaired marker as literal text", () => {
    expect(parseNewsInline("a **b")).toEqual([{ text: "a **b", strong: false }]);
  });

  it("returns the whole line when there is no markup", () => {
    expect(parseNewsInline("plain")).toEqual([{ text: "plain", strong: false }]);
  });
});

describe("NewsFeed — the empty states", () => {
  it("says nothing has been published when the backend answered", () => {
    render(<NewsFeed items={[]} state="ok" />);

    expect(
      screen.getByRole("heading", { name: "No news updates published yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been published yet/i)).toBeInTheDocument();
  });

  it("says publishing is not switched on when there is no backend", () => {
    render(<NewsFeed items={[]} state="unconfigured" />);

    // Not the same as "nothing published": there is no publication to be empty.
    expect(screen.getByRole("heading", { name: "News is not switched on yet" })).toBeInTheDocument();
    expect(screen.queryByText("No news updates published yet")).not.toBeInTheDocument();
  });

  it("says the list could not be loaded when it could not be read", () => {
    render(<NewsFeed items={[]} state="unavailable" />);

    expect(screen.getByRole("heading", { name: "News could not be loaded" })).toBeInTheDocument();
    expect(screen.queryByText("No news updates published yet")).not.toBeInTheDocument();
  });

  it("gives the empty state the heading level below the section heading", () => {
    // The page opens the section with an `h2`, so the empty state is an `h3`. Two
    // `h2`s would make it a sibling section rather than the list's content.
    render(<NewsFeed items={[]} state="ok" />);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("never renders a placeholder article", () => {
    const { container } = render(<NewsFeed items={[]} state="ok" />);
    expect(container.querySelectorAll("article")).toHaveLength(0);
  });
});

describe("NewsFeed — published items", () => {
  it("renders the title, summary and body", () => {
    render(<NewsFeed items={[item()]} state="ok" />);

    expect(screen.getByRole("heading", { level: 2, name: RECORD.title })).toBeInTheDocument();
    expect(screen.getByText(RECORD.summary)).toBeInTheDocument();
    expect(screen.getByText("The date is confirmed.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "What changed" })).toBeInTheDocument();
  });

  it("prints the publication date in a machine-readable form", () => {
    const { container } = render(<NewsFeed items={[item()]} state="ok" />);
    const time = container.querySelector("time");
    expect(time?.getAttribute("datetime")).toBe("2026-11-24T12:00:00.000Z");
    expect(time?.textContent).toBe("24 Nov 2026");
  });

  it("cites the source with its host and check date", () => {
    render(<NewsFeed items={[item()]} state="ok" />);

    const link = screen.getByRole("link", { name: /Tomorrowland/ });
    expect(link).toHaveAttribute("href", RECORD.source.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText(/tomorrowland\.com/)).toBeInTheDocument();

    // Two dates are printed: the publication date and the check date. The check
    // date is the one inside the source line, so the assertion targets that.
    const sourceLine = link.closest("p");
    expect(sourceLine?.textContent).toContain("Checked");
    expect(sourceLine?.querySelector("time")?.textContent).toBe("24 Nov 2026");
    expect(sourceLine?.querySelector("time")?.getAttribute("datetime")).toBe("2026-11-24");
  });

  it("prints the tags", () => {
    render(<NewsFeed items={[item()]} state="ok" />);
    expect(screen.getByText("tickets")).toBeInTheDocument();
    expect(screen.getByText("sale-dates")).toBeInTheDocument();
  });

  it("renders every item", () => {
    const second = {
      ...RECORD,
      id: "second-item",
      slug: "second-item",
      title: "A second item",
    };
    render(
      <NewsFeed items={[item(), item({ item: second, likeCount: 0 })]} state="ok" />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "A second item" })).toBeInTheDocument();
  });

  it("never interprets body markup as HTML", () => {
    const hostile = { ...RECORD, body: "<script>alert(1)</script> **bold**" };
    const { container } = render(<NewsFeed items={[item({ item: hostile })]} state="ok" />);

    // The tag is shown as characters, and only the bold run became an element.
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(container.querySelectorAll("strong")).toHaveLength(1);
  });

  it("gives the like button a name that includes the item title", () => {
    render(<NewsFeed items={[item()]} state="ok" />);
    const button = screen.getByRole("button", { name: /Mark useful/ });
    expect(button.textContent).toContain(RECORD.title);
  });
});

describe("NewsLikeButton", () => {
  it("posts to the item's endpoint and shows the new count", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ status: "recorded", likeCount: 9 }));
    vi.stubGlobal("fetch", fetchImpl);

    render(<NewsLikeButton id={RECORD.id} initialCount={4} itemTitle={RECORD.title} />);
    const button = screen.getByRole("button", { name: /Mark useful/ });
    expect(button.textContent).toContain("4");

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Marked useful/ }).textContent).toContain("9");
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/community/news/${RECORD.id}/like`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(init.body).toBeUndefined();
  });

  it("disables itself once counted, because there is no un-like", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ likeCount: 5 })));

    render(<NewsLikeButton id={RECORD.id} initialCount={4} itemTitle={RECORD.title} />);
    fireEvent.click(screen.getByRole("button", { name: /Mark useful/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Marked useful/ })).toBeDisabled();
    });
  });

  it("says plainly that a 503 counted nothing and leaves the count alone", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":"x"}', { status: 503 })));

    render(<NewsLikeButton id={RECORD.id} initialCount={4} itemTitle={RECORD.title} />);
    fireEvent.click(screen.getByRole("button", { name: /Mark useful/ }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/not being recorded/i);
    });
    expect(screen.getByRole("button", { name: /Mark useful/ }).textContent).toContain("4");
  });

  it("reports a 429 without changing the count", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));

    render(<NewsLikeButton id={RECORD.id} initialCount={4} itemTitle={RECORD.title} />);
    fireEvent.click(screen.getByRole("button", { name: /Mark useful/ }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/did not change/i);
    });
  });

  it("reports a dropped connection without changing the count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    render(<NewsLikeButton id={RECORD.id} initialCount={4} itemTitle={RECORD.title} />);
    fireEvent.click(screen.getByRole("button", { name: /Mark useful/ }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/connection dropped/i);
    });
  });

  it("refuses to show a count the API did not report", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "recorded" })));

    render(<NewsLikeButton id={RECORD.id} initialCount={4} itemTitle={RECORD.title} />);
    fireEvent.click(screen.getByRole("button", { name: /Mark useful/ }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/did not understand/i);
    });
    expect(screen.getByRole("button", { name: /Mark useful/ }).textContent).toContain("4");
  });

  it("has one polite live region that exists before anything happens", () => {
    render(<NewsLikeButton id={RECORD.id} initialCount={0} itemTitle={RECORD.title} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();
  });
});
