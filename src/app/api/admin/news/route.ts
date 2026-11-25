/**
 * /api/admin/news — the only endpoint that changes published news.
 *
 * ## Guards, in order
 *
 * 1. **Session.** `requireAdminSession` verifies the bearer token against Supabase
 *    Auth, requires `app_metadata.role === "admin"` and `aal === "aal2"`, and
 *    answers `401` / `403` / `503` itself. Nothing below runs for a caller it
 *    refused, so an unauthenticated request cannot reach the database, the audit
 *    log or the cache.
 * 2. **Origin**, for `POST` and `DELETE`. An administrator's browser is the only
 *    legitimate caller, so a mutating request carrying no `Origin` and no
 *    `Referer` is refused even with a valid token. That stops a stolen token
 *    being replayed from a script that does not forge the header, and it keeps a
 *    cross-site form from writing content.
 * 3. **Body size and JSON**, before parsing.
 * 4. **Schema**, against `newsItemSchema` — the same schema the data layer uses,
 *    so content the site could not build with cannot be stored either.
 * 5. **Audit.** Every mutation writes an entry before the response is built. If
 *    the audit write fails the mutation is still reported as done, with
 *    `audited: false`, because it *did* happen; claiming otherwise would be false.
 * 6. **Revalidation.** The `community-news` tag is invalidated so the public page
 *    rebuilds behind the next request.
 *
 * ## Methods
 *
 * | Method | Body | Effect |
 * | --- | --- | --- |
 * | `GET` | — | Lists every row, drafts included |
 * | `POST` | `{ status, item }` | Creates or replaces one row |
 * | `DELETE` | `?id=<slug>` | Removes one row |
 *
 * `POST` is an upsert rather than separate create and update verbs because the
 * news record's `id` is chosen by the author and is part of the content: an
 * editor fixing a typo uses the same form as one publishing for the first time,
 * and the audit action is decided by whether the row existed, not by which verb
 * the client chose.
 */

import { newsItemSchema } from "@/data/schemas";
import { requireAdminSession, adminAuthFailureResponse } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/audit";
import { revalidateCommunityNews } from "@/lib/community/revalidate";
import {
  NEWS_TABLE,
  fetchAdminNews,
  type AdminNewsListing,
} from "@/lib/community/news";
import { newsStatusSchema } from "@/lib/community/news-schema";
import { fieldErrors } from "@/lib/community/link-report-schema";
import { isJsonContentType, jsonResponse, methodNotAllowed, readBoundedBody, readLimitedBody } from "@/lib/http/json";
import { isAllowedOrigin } from "@/lib/security/origin";
import { getAllowedOrigins } from "@/lib/security/allowed-origins";
import { getTrustedClientIp, hashClientIp } from "@/lib/security/client-ip";
import { readSupabaseServerConfig } from "@/lib/supabase/config";
import { z } from "zod";

/**
 * Maximum accepted body.
 *
 * The schema caps a body at 20,000 characters and every other field is small, so
 * a valid record is well under 64 kB even with escaping. The cap is generous
 * because an administrator pasting a long article should not be refused by a
 * limit that was chosen for a contact form.
 */
export const MAX_BODY_BYTES = 64 * 1024;

/** The `POST` contract. The record is validated by its own schema, not re-declared here. */
export const newsUpsertSchema = z.strictObject({
  status: newsStatusSchema,
  item: newsItemSchema,
});

const NOT_CONFIGURED_MESSAGE = "The news database is not configured on this deployment.";

/** Logs and answers a database fault without leaking the database's own words. */
function databaseFailure(operation: string, status?: number): Response {
  console.error(
    `[admin/news] ${operation} failed${status === undefined ? "" : ` with HTTP ${status}`}`,
  );
  return jsonResponse({ error: "The news database could not be updated. Nothing was changed." }, 502);
}

/**
 * The salted digest of the caller's address, or null when none could be found.
 *
 * An audit entry records where a change came from. `unknown` is not an address, so
 * a request that withheld every header stores null rather than a shared digest
 * that would look like a real source.
 */
async function auditIpHash(request: Request): Promise<string | null> {
  const ip = getTrustedClientIp(request.headers);
  if (ip === "unknown") return null;
  return hashClientIp(ip);
}

/** The `Prefer` header that makes a PostgREST write an upsert on the primary key. */
const UPSERT_PREFER = "resolution=merge-duplicates,return=representation";

/**
 * `GET /api/admin/news`
 *
 * A read, so the origin check is not applied: `GET` cannot change state, and
 * requiring an `Origin` header would break a legitimate `curl` from an operator's
 * own machine. The session check still applies in full.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await requireAdminSession(request);
  if (!session.ok) return adminAuthFailureResponse(session);

  const listing: AdminNewsListing = await fetchAdminNews();
  if (!listing.configured) {
    return jsonResponse({ error: NOT_CONFIGURED_MESSAGE }, 503);
  }

  return jsonResponse({ entries: listing.entries }, 200);
}

/**
 * `POST /api/admin/news`
 *
 * Creates a row, or replaces the one with the same id. The audit action is chosen
 * from what the database already held, so the log says "created" only when nothing
 * was overwritten.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await requireAdminSession(request);
  if (!session.ok) return adminAuthFailureResponse(session);

  if (request.method !== "POST") return methodNotAllowed("GET, POST, DELETE");

  if (!isAllowedOrigin(request, getAllowedOrigins())) {
    return jsonResponse({ error: "Cross-origin request rejected" }, 403);
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonResponse({ error: "Content-Type must be application/json" }, 415);
  }

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0) {
      return jsonResponse({ error: "Invalid Content-Length header" }, 400);
    }
    if (length > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Request body is too large" }, 413);
    }
  }

  const body = await readBoundedBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    if (body.reason === "too-large") {
      return jsonResponse({ error: "Request body is too large" }, 413);
    }
    return jsonResponse({ error: "Request body could not be read" }, 400);
  }
  const raw = body.text;
  if (raw.trim() === "") {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  /*
    An array or a primitive is a well-formed JSON body of the wrong kind. It is
    answered as a `400` rather than a `422` because the fault is in the envelope,
    not in a field: there is no field to name in a correction. The report route
    and the contact route answer the same way, so a client that sends one shape to
    the wrong endpoint gets one consistent answer.
  */
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return jsonResponse({ error: "Request body must be a JSON object" }, 400);
  }

  const parsed = newsUpsertSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(
      { error: "Please check the highlighted fields", fields: fieldErrors(parsed.error) },
      422,
    );
  }

  const config = readSupabaseServerConfig();
  if (config === null) {
    return jsonResponse({ error: NOT_CONFIGURED_MESSAGE }, 503);
  }

  const { status, item } = parsed.data;
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  /*
    One read to learn whether this is a create or an update. It is a second round
    trip, and it buys an honest audit action: an entry that says "created" for a
    row that already existed is worse than a slower write, because it is the exact
    question an investigation asks.
  */
  let existed = false;
  try {
    const existing = await fetch(
      `${config.url}/rest/v1/${NEWS_TABLE}?id=eq.${encodeURIComponent(item.id)}&select=id&limit=1`,
      { method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(8_000) },
    );
    if (existing.ok) {
      const rows: unknown = await existing.json();
      existed = Array.isArray(rows) && rows.length > 0;
    } else {
      return databaseFailure("The existence check", existing.status);
    }
  } catch (error) {
    console.error("[admin/news] The existence check threw", error);
    return jsonResponse({ error: "The news database could not be reached. Nothing was changed." }, 502);
  }

  /*
    `published_at` is set from the record's own date when the item is published,
    and left alone on a draft so ordering does not jump around while it is edited.
    A timestamp rather than the bare date keeps two same-day items in a stable
    order; noon UTC avoids a midnight boundary moving an item between days for
    readers in other time zones.
  */
  const publishedAt =
    status === "published" ? `${item.publishedOn}T12:00:00.000Z` : new Date().toISOString();

  const row = {
    id: item.id,
    status,
    data: item,
    published_at: publishedAt,
    updated_at: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${config.url}/rest/v1/${NEWS_TABLE}?on_conflict=id`, {
      method: "POST",
      headers: { ...headers, Prefer: UPSERT_PREFER },
      body: JSON.stringify(row),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return databaseFailure("The upsert", response.status);
    await response.body?.cancel().catch(() => undefined);
  } catch (error) {
    console.error("[admin/news] The upsert threw", error);
    return jsonResponse({ error: "The news database could not be updated. Nothing was changed." }, 502);
  }

  const audit = await writeAuditLog({
    actorId: session.identity.userId,
    action: existed ? "news.update" : "news.create",
    resourceType: "news_item",
    resourceId: item.id,
    ipHash: await auditIpHash(request),
    metadata: {
      status,
      slug: item.slug,
      title: item.title,
      publishedOn: item.publishedOn,
    },
  });

  const revalidated = revalidateCommunityNews();

  return jsonResponse(
    {
      status: existed ? "updated" : "created",
      id: item.id,
      itemStatus: status,
      audited: audit.recorded,
      revalidated,
    },
    200,
  );
}

/** Reads the id to delete from the query string, or from a JSON body as a fallback. */
async function readDeleteId(request: Request): Promise<string | null> {
  const fromQuery = new URL(request.url).searchParams.get("id");
  if (fromQuery !== null && fromQuery !== "") return fromQuery;

  // Some clients strip a DELETE body, so the body is a fallback rather than the
  // primary route. A content type that is not JSON is not an error here: it just
  // means there is nothing to read.
  if (!isJsonContentType(request.headers.get("content-type"))) return null;
  const raw = await readLimitedBody(request, MAX_BODY_BYTES);
  if (raw === null || raw.trim() === "") return null;
  try {
    const payload: unknown = JSON.parse(raw);
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
    const id = (payload as { id?: unknown }).id;
    return typeof id === "string" && id !== "" ? id : null;
  } catch {
    return null;
  }
}

/**
 * `DELETE /api/admin/news?id=<slug>`
 *
 * Deletes by id. The id is validated as a slug so a crafted value cannot become
 * part of the PostgREST filter expression.
 */
export async function DELETE(request: Request): Promise<Response> {
  const session = await requireAdminSession(request);
  if (!session.ok) return adminAuthFailureResponse(session);

  if (request.method !== "DELETE") return methodNotAllowed("GET, POST, DELETE");

  if (!isAllowedOrigin(request, getAllowedOrigins())) {
    return jsonResponse({ error: "Cross-origin request rejected" }, 403);
  }

  const rawId = await readDeleteId(request);
  const parsedId = newsItemSchema.shape.id.safeParse(rawId);
  if (!parsedId.success) {
    return jsonResponse({ error: "A valid news id is required" }, 422);
  }

  const config = readSupabaseServerConfig();
  if (config === null) {
    return jsonResponse({ error: NOT_CONFIGURED_MESSAGE }, 503);
  }

  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: "application/json",
  };

  let deleted = 0;
  try {
    const response = await fetch(
      `${config.url}/rest/v1/${NEWS_TABLE}?id=eq.${encodeURIComponent(parsedId.data)}`,
      {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=representation" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) return databaseFailure("The delete", response.status);

    const rows: unknown = await response.json();
    deleted = Array.isArray(rows) ? rows.length : 0;
  } catch (error) {
    console.error("[admin/news] The delete threw", error);
    return jsonResponse({ error: "The news database could not be updated. Nothing was changed." }, 502);
  }

  if (deleted === 0) {
    // Nothing was removed, so nothing is audited and the tag is not invalidated:
    // a 404 must not look like a change in the log.
    return jsonResponse({ error: "No news item with that id exists" }, 404);
  }

  const audit = await writeAuditLog({
    actorId: session.identity.userId,
    action: "news.delete",
    resourceType: "news_item",
    resourceId: parsedId.data,
    ipHash: await auditIpHash(request),
  });

  const revalidated = revalidateCommunityNews();

  return jsonResponse(
    { status: "deleted", id: parsedId.data, audited: audit.recorded, revalidated },
    200,
  );
}
