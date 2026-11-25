/**
 * The community news feed, read on the server.
 *
 * One rule governs this module: **no invented articles.** A guide that publishes
 * a sale date it made up is worse than a guide with an empty news page, because a
 * reader cannot tell the difference until they have booked travel. When no news
 * backend is configured, or when the backend holds nothing published, this module
 * returns an empty feed and the page says so in plain words.
 *
 * ## Caching
 *
 * The read is cached with the tag `community-news`, so the admin endpoint can
 * call `revalidateTag("community-news", "max")` after a mutation and have the next
 * page request rebuild it in the background. `cacheLife("minutes")` bounds how
 * long a change made outside the admin endpoint (in the Supabase dashboard, say)
 * can go unnoticed.
 *
 * The cached wrapper is a one-line `use cache` function around an ordinary async
 * loader. That split matters: `cacheTag` only works inside a cache scope, so the
 * logic lives in `fetchPublishedNews`, which unit tests can call directly and
 * which does not depend on the Next.js runtime at all.
 */

import { cacheLife, cacheTag } from "next/cache";
import {
  newsRowSchema,
  toPublishedNewsItem,
  type NewsRecord,
  type NewsStatus,
  type PublishedNewsItem,
} from "./news-schema";
import { readSupabaseServerConfig, type SupabaseServerConfig } from "@/lib/supabase/config";

/** The cache tag the admin endpoint invalidates. Exported so both ends use one string. */
export const COMMUNITY_NEWS_TAG = "community-news";

/** The table news rows live in. */
export const NEWS_TABLE = "news_items";

/** Nothing older than this is worth carrying in memory while rendering a page. */
const MAX_ITEMS = 50;

/**
 * Why a feed has no items.
 *
 * Three states, not one, because they mean different things to a reader and lead
 * to different actions from an operator:
 *
 * - `ok` — the backend answered. An empty list here means nothing is published,
 *   which is a fact the page can state.
 * - `unconfigured` — there is no news database at all. Nothing is broken, and the
 *   page must not imply that news exists or that a read failed.
 * - `unavailable` — the backend is configured and the read did not work. That is
 *   a fault, and saying "nothing is published" would be a claim this code cannot
 *   make.
 */
export type NewsFeedState = "ok" | "unconfigured" | "unavailable";

/** A feed is either real records or a stated reason there are none. */
export interface NewsFeed {
  readonly items: readonly PublishedNewsItem[];
  readonly state: NewsFeedState;
}

/**
 * Reads published news rows.
 *
 * Ordering is newest first by the row's publication instant, then by id, so two
 * items published on the same day have a stable order between requests rather
 * than swapping places with whatever the database returns first.
 *
 * A row that does not match the schema is dropped rather than rendered. That is
 * the safe direction: a half-valid record would put an unvalidated date or URL on
 * the page, and a missing item is a smaller fault than a wrong one.
 */
export async function fetchPublishedNews(
  config: SupabaseServerConfig | null = readSupabaseServerConfig(),
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<NewsFeed> {
  if (config === null) return { items: [], state: "unconfigured" };

  const params = new URLSearchParams({
    select: "id,status,data,like_count,published_at,updated_at",
    status: "eq.published",
    order: "published_at.desc,id.asc",
    limit: String(MAX_ITEMS),
  });

  let response: Response;
  try {
    response = await fetchImpl(`${config.url}/rest/v1/${NEWS_TABLE}?${params.toString()}`, {
      method: "GET",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Accept: "application/json",
        // The page is the cache; asking the database to cache as well would make
        // `revalidateTag` a promise it cannot keep.
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    // Logged for the operator, never rendered. The page's empty state is the same
    // either way, and a reader gains nothing from the difference.
    console.error("[community/news] The Supabase read failed", error);
    return { items: [], state: "unavailable" };
  }

  if (!response.ok) {
    console.error(`[community/news] Supabase answered HTTP ${response.status}`);
    return { items: [], state: "unavailable" };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error("[community/news] Supabase returned a body that is not JSON");
    return { items: [], state: "unavailable" };
  }

  if (!Array.isArray(payload)) {
    console.error("[community/news] Supabase returned an unexpected response shape");
    return { items: [], state: "unavailable" };
  }

  const items: PublishedNewsItem[] = [];
  for (const row of payload) {
    const parsed = newsRowSchema.safeParse(row);
    if (!parsed.success) {
      console.error("[community/news] Dropped a row that does not match the news schema");
      continue;
    }
    if (parsed.data.status !== "published") continue;
    items.push(toPublishedNewsItem(parsed.data));
  }

  return { items, state: "ok" };
}

/**
 * The cached read the pages use.
 *
 * Tagged so the admin endpoint can invalidate it, and given a short lifetime so a
 * change made directly in the database still appears without a deploy.
 */
export async function getPublishedNews(): Promise<NewsFeed> {
  "use cache";
  cacheLife("minutes");
  cacheTag(COMMUNITY_NEWS_TAG);
  return fetchPublishedNews();
}

/** One row as the admin console sees it, including its publishing state. */
export interface AdminNewsEntry {
  readonly id: string;
  readonly status: NewsStatus;
  readonly item: NewsRecord;
  readonly likeCount: number;
  readonly publishedAt: string;
}

/** What the admin listing returns. */
export interface AdminNewsListing {
  readonly entries: readonly AdminNewsEntry[];
  /** True when the request reached the database. */
  readonly configured: boolean;
}

/**
 * Reads every news row, drafts included.
 *
 * Separate from `fetchPublishedNews` rather than a flag on it, because the two
 * have different security postures: the public loader must never return a draft,
 * and a boolean parameter is one mistake away from doing exactly that. This one is
 * only ever called behind `requireAdminSession`.
 *
 * Not cached: an administrator editing content must see what they just saved.
 */
export async function fetchAdminNews(
  config: SupabaseServerConfig | null = readSupabaseServerConfig(),
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<AdminNewsListing> {
  if (config === null) return { entries: [], configured: false };

  const params = new URLSearchParams({
    select: "id,status,data,like_count,published_at,updated_at",
    order: "published_at.desc,id.asc",
    limit: String(MAX_ITEMS),
  });

  let response: Response;
  try {
    response = await fetchImpl(`${config.url}/rest/v1/${NEWS_TABLE}?${params.toString()}`, {
      method: "GET",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Accept: "application/json",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    console.error("[community/news] The admin read failed", error);
    return { entries: [], configured: false };
  }

  if (!response.ok) {
    console.error(`[community/news] Admin read answered HTTP ${response.status}`);
    return { entries: [], configured: false };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { entries: [], configured: false };
  }

  if (!Array.isArray(payload)) return { entries: [], configured: false };

  const entries: AdminNewsEntry[] = [];
  for (const row of payload) {
    const parsed = newsRowSchema.safeParse(row);
    if (!parsed.success) {
      console.error("[community/news] Dropped an admin row that does not match the schema");
      continue;
    }
    entries.push({
      id: parsed.data.id,
      status: parsed.data.status,
      item: parsed.data.data,
      likeCount: parsed.data.like_count,
      publishedAt: parsed.data.published_at,
    });
  }

  return { entries, configured: true };
}
