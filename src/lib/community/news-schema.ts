/**
 * The community news feed's storage contract.
 *
 * `src/data/schemas/news-item.ts` already defines what a news record *is*. This
 * module adds only what the database layer needs on top of it, and it does so
 * without redefining the schema: the record shape is imported, and the two extra
 * concerns — the database column that marks a draft, and the like counter that
 * lives on the row — are described separately.
 *
 * ## Why the record is not extended
 *
 * `newsItemSchema` is `.strict()`, and the admin endpoint validates against it
 * exactly. Adding `status` or `likeCount` to the record would mean either editing
 * that schema (another workstream owns it) or accepting keys it would reject.
 * Both are worse than keeping the publishing state in the table and mapping it at
 * the boundary, which is what happens here.
 */

import { z } from "zod";
import { newsItemSchema, type NewsItem } from "@/data/schemas";

/*
  The record's own schema is `newsItemSchema` from `src/data/schemas/news-item.ts`.
  The loader and the admin route import it from there directly rather than through
  a second export, so there is one schema object and no copy that could drift.
  Only the type is re-stated here, because several modules in this area read it and
  importing it from the database-row module keeps their imports to one line.
*/

/** The record contract, exactly as the data layer defines it. */
export type NewsRecord = NewsItem;

/**
 * The publishing state a row can carry.
 *
 * `published` is the only value the public loader will return. `draft` exists so
 * an item can be saved before it is announced, and `archived` so something that
 * has gone stale can be hidden without deleting the citation that backs it.
 */
export const newsStatusSchema = z.enum(["draft", "published", "archived"], {
  error: 'status must be "draft", "published" or "archived"',
});
export type NewsStatus = z.infer<typeof newsStatusSchema>;

/**
 * One row as Supabase stores it.
 *
 * The record lives in `data` rather than being flattened into columns, because
 * the record is validated as a whole by the schema above: a column-per-field
 * table would let a row be half-valid, and reading it back would then need
 * repair rather than rejection. `data` is a `jsonb` column.
 *
 * `status` and `like_count` are separate columns because the loader filters on
 * one and increments the other, and both operations must happen in the database
 * rather than after a full read.
 *
 * `published_at` is the ordering key. It duplicates `publishedOn` from the
 * record on purpose: it is a sortable timestamp the database can index, whereas
 * the record's field is a date with no time zone.
 */
export const newsRowSchema = z.strictObject({
  /** The record's own id, promoted to a column so a lookup by id is an index hit. */
  id: z.string().min(1).max(80),
  status: newsStatusSchema,
  data: newsItemSchema,
  like_count: z.number().int().nonnegative(),
  published_at: z.string().min(1),
  updated_at: z.string().min(1).optional(),
});
export type NewsRow = z.infer<typeof newsRowSchema>;

/** A news record plus the two pieces of state that live outside it. */
export interface PublishedNewsItem {
  readonly item: NewsRecord;
  readonly likeCount: number;
  /** ISO instant the row was published, used for ordering. */
  readonly publishedAt: string;
}

/**
 * Maps a database row to what the site renders.
 *
 * Separate from the loader so the mapping is unit-testable without a network, and
 * so a malformed row is rejected at one place rather than being half-read in
 * three.
 */
export function toPublishedNewsItem(row: NewsRow): PublishedNewsItem {
  return {
    item: row.data,
    likeCount: row.like_count,
    publishedAt: row.published_at,
  };
}
