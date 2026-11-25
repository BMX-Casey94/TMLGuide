// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  COMMUNITY_NEWS_TAG,
  NEWS_TABLE,
  fetchAdminNews,
  fetchPublishedNews,
} from "./news";
import { newsRowSchema, toPublishedNewsItem } from "./news-schema";
import type { SupabaseServerConfig } from "@/lib/supabase/config";

/*
  `getPublishedNews` is the cached wrapper and is exercised by the build, not
  here: `cacheTag` and `cacheLife` require the Next.js cache scope, which a unit
  test does not have. Everything below calls the ordinary async loader that the
  wrapper delegates to, so the fetch, the filtering and the failure handling are
  all covered without a runtime.
*/

const CONFIG: SupabaseServerConfig = {
  url: "https://project.supabase.co",
  serviceRoleKey: "service-role-key",
};

const RECORD = {
  id: "belgium-sale-date-confirmed",
  edition: "belgium",
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
  confidence: "official",
};

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: RECORD.id,
    status: "published",
    data: RECORD,
    like_count: 4,
    published_at: "2026-11-24T12:00:00.000Z",
    ...overrides,
  };
}

function fetchReturning(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  return vi.fn(async () => Response.json(body, { status }));
}

describe("the tag", () => {
  it("is the string the admin route invalidates", () => {
    expect(COMMUNITY_NEWS_TAG).toBe("community-news");
  });

  it("names the table the loader reads", () => {
    expect(NEWS_TABLE).toBe("news_items");
  });
});

describe("fetchPublishedNews — no backend", () => {
  it("reports an unconfigured feed and fetches nothing", async () => {
    const fetchImpl = fetchReturning([]);
    const feed = await fetchPublishedNews(null, fetchImpl as unknown as typeof fetch);

    expect(feed).toEqual({ items: [], state: "unconfigured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never invents an article when there is no backend", async () => {
    // The empty state is the honest answer, and the page renders it as such. This
    // test exists to fail if someone ever seeds a placeholder here.
    const feed = await fetchPublishedNews(null, fetchReturning([]) as unknown as typeof fetch);
    expect(feed.items).toHaveLength(0);
  });
});

describe("fetchPublishedNews — the query", () => {
  it("asks only for published rows, newest first, with a limit", async () => {
    const fetchImpl = fetchReturning([]);
    await fetchPublishedNews(CONFIG, fetchImpl as unknown as typeof fetch);

    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    const params = new URL(url).searchParams;

    expect(url.startsWith(`https://project.supabase.co/rest/v1/${NEWS_TABLE}?`)).toBe(true);
    expect(params.get("status")).toBe("eq.published");
    expect(params.get("order")).toBe("published_at.desc,id.asc");
    expect(Number(params.get("limit"))).toBeGreaterThan(0);
    expect(params.get("select")).toContain("like_count");
  });

  it("authenticates with the service role key and never caches the read", async () => {
    const fetchImpl = fetchReturning([]);
    await fetchPublishedNews(CONFIG, fetchImpl as unknown as typeof fetch);

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe("service-role-key");
    expect(headers.Authorization).toBe("Bearer service-role-key");
    // `revalidateTag` is the invalidation; a second layer of HTTP caching would
    // make it a promise the database does not keep.
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends the key only to the configured origin", async () => {
    const fetchImpl = fetchReturning([]);
    await fetchPublishedNews(CONFIG, fetchImpl as unknown as typeof fetch);

    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(new URL(url).origin).toBe("https://project.supabase.co");
  });
});

describe("fetchPublishedNews — mapping", () => {
  it("returns the record, its like count and its publication instant", async () => {
    const feed = await fetchPublishedNews(
      CONFIG,
      fetchReturning([row()]) as unknown as typeof fetch,
    );

    expect(feed.state).toBe("ok");
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]).toEqual({
      item: RECORD,
      likeCount: 4,
      publishedAt: "2026-11-24T12:00:00.000Z",
    });
  });

  it("drops a draft even when the database returns one", async () => {
    // The query already filters, and this second check means a change to the
    // query cannot leak a draft onto the page on its own.
    const feed = await fetchPublishedNews(
      CONFIG,
      fetchReturning([row({ status: "draft" })]) as unknown as typeof fetch,
    );

    expect(feed.items).toHaveLength(0);
    expect(feed.state).toBe("ok");
  });

  it("drops an archived row", async () => {
    const feed = await fetchPublishedNews(
      CONFIG,
      fetchReturning([row({ status: "archived" })]) as unknown as typeof fetch,
    );
    expect(feed.items).toHaveLength(0);
  });

  it("drops a malformed row rather than rendering it", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const feed = await fetchPublishedNews(
      CONFIG,
      fetchReturning([
        row(),
        row({ id: "bad", data: { title: "missing every other field" } }),
        { nonsense: true },
      ]) as unknown as typeof fetch,
    );

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]?.item.id).toBe(RECORD.id);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("drops a row whose record has a non-https source", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const feed = await fetchPublishedNews(
      CONFIG,
      fetchReturning([
        row({ data: { ...RECORD, source: { ...RECORD.source, url: "http://example.com/" } } }),
      ]) as unknown as typeof fetch,
    );

    expect(feed.items).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it("handles an empty table as configured but empty", async () => {
    const feed = await fetchPublishedNews(CONFIG, fetchReturning([]) as unknown as typeof fetch);

    // `ok` with no items is the only state that means "nothing has been
    // published". `unconfigured` and `unavailable` are different statements the
    // page makes in different words, so the distinction has to survive the loader.
    expect(feed).toEqual({ items: [], state: "ok" });
  });

  it("keeps the order the database returned", async () => {
    const second = { ...RECORD, id: "older-item", slug: "older-item" };
    const feed = await fetchPublishedNews(
      CONFIG,
      fetchReturning([
        row(),
        row({ id: "older-item", data: second, published_at: "2026-11-20T12:00:00.000Z" }),
      ]) as unknown as typeof fetch,
    );

    expect(feed.items.map((entry) => entry.item.id)).toEqual([RECORD.id, "older-item"]);
  });
});

describe("fetchPublishedNews — failures", () => {
  it("reports unavailable when the request throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });

    const feed = await fetchPublishedNews(CONFIG, fetchImpl as unknown as typeof fetch);
    // The backend is configured, so this is a fault and not an unconfigured
    // deployment: the page must say so rather than "nothing has been published".
    expect(feed).toEqual({ items: [], state: "unavailable" });
    errorSpy.mockRestore();
  });

  it("reports unavailable for a non-2xx answer", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const feed = await fetchPublishedNews(
      CONFIG,
      fetchReturning({ message: "nope" }, 500) as unknown as typeof fetch,
    );
    expect(feed).toEqual({ items: [], state: "unavailable" });
    errorSpy.mockRestore();
  });

  it("reports unavailable when the body is not JSON", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("<html>oops</html>", { status: 200 }));

    const feed = await fetchPublishedNews(CONFIG, fetchImpl as unknown as typeof fetch);
    expect(feed.state).toBe("unavailable");
    errorSpy.mockRestore();
  });

  it("reports unavailable when the body is not an array", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const feed = await fetchPublishedNews(
      CONFIG,
      fetchReturning({ data: [] }) as unknown as typeof fetch,
    );
    expect(feed.state).toBe("unavailable");
    errorSpy.mockRestore();
  });

  it("never throws, whatever the database does", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const value of [null, 42, "text"]) {
      const feed = await fetchPublishedNews(CONFIG, fetchReturning(value) as unknown as typeof fetch);
      expect(feed.items).toEqual([]);
      // A body that is not a list of rows is a fault, not an empty publication.
      expect(feed.state).toBe("unavailable");
    }
    errorSpy.mockRestore();
  });

  it("treats an array of unreadable rows as a successful but empty feed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // The read worked and the database returned a list; every row in it is junk.
    // That is `ok` with the rows dropped, not a failed read, and the difference
    // matters: one tells the operator to check the schema, the other to check the
    // deployment.
    const feed = await fetchPublishedNews(CONFIG, fetchReturning([[]]) as unknown as typeof fetch);
    expect(feed.items).toEqual([]);
    expect(feed.state).toBe("ok");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("fetchAdminNews", () => {
  it("returns drafts as well as published rows", async () => {
    const feed = await fetchAdminNews(
      CONFIG,
      fetchReturning([row({ status: "draft" }), row()]) as unknown as typeof fetch,
    );

    expect(feed.configured).toBe(true);
    expect(feed.entries.map((entry) => entry.status)).toEqual(["draft", "published"]);
  });

  it("does not filter by status, unlike the public loader", async () => {
    const fetchImpl = fetchReturning([]);
    await fetchAdminNews(CONFIG, fetchImpl as unknown as typeof fetch);

    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(new URL(url).searchParams.get("status")).toBeNull();
  });

  it("reports unconfigured with no backend", async () => {
    expect(await fetchAdminNews(null, fetchReturning([]) as unknown as typeof fetch)).toEqual({
      entries: [],
      configured: false,
    });
  });

  it("drops a malformed row", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const feed = await fetchAdminNews(
      CONFIG,
      fetchReturning([row(), { broken: true }]) as unknown as typeof fetch,
    );

    expect(feed.entries).toHaveLength(1);
    errorSpy.mockRestore();
  });
});

describe("the row schema", () => {
  it("accepts a complete row", () => {
    expect(newsRowSchema.safeParse(row()).success).toBe(true);
  });

  it("accepts a row without updated_at", () => {
    const withoutUpdated = row();
    delete withoutUpdated.updated_at;
    expect(newsRowSchema.safeParse(withoutUpdated).success).toBe(true);
  });

  it("rejects a negative like count", () => {
    expect(newsRowSchema.safeParse(row({ like_count: -1 })).success).toBe(false);
  });

  it("rejects a fractional like count", () => {
    expect(newsRowSchema.safeParse(row({ like_count: 1.5 })).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(newsRowSchema.safeParse(row({ status: "live" })).success).toBe(false);
  });

  it("rejects an unknown column, so a schema drift fails loudly", () => {
    expect(newsRowSchema.safeParse(row({ extra_column: 1 })).success).toBe(false);
  });

  it("rejects a record that is not a valid news item", () => {
    expect(newsRowSchema.safeParse(row({ data: { title: "incomplete" } })).success).toBe(false);
  });

  it("maps a parsed row to the published shape", () => {
    const parsed = newsRowSchema.parse(row());
    expect(toPublishedNewsItem(parsed)).toEqual({
      item: RECORD,
      likeCount: 4,
      publishedAt: "2026-11-24T12:00:00.000Z",
    });
  });
});
