/**
 * The audit trail for administrative writes.
 *
 * Every change to published content goes through here. The record answers, for
 * one action: **who** did it, **what** they did, **which** record it touched,
 * **when**, from **where**, and any extra detail the action needs. Without that,
 * a wrong sale date on the site is a mystery; with it, the change that introduced
 * it is one query away.
 *
 * ## What is stored, and what is not
 *
 * `ipHash` is a salted SHA-256 digest, the same one the rate limiter uses. The
 * address itself is never written. The digest still distinguishes two sources
 * from one another, which is what an investigation needs, and a leaked audit
 * table is not a list of who administers the site. That matters more here than
 * elsewhere because an admin's address is a stronger identifier than a visitor's.
 *
 * `metadata` is for small, structured facts about the action — the fields that
 * changed, the previous status — never an access token, a password, an email
 * address of a third party, or a whole request body. The writer does not enforce
 * that, because only three call sites exist and a runtime filter would give a
 * false sense that raw bodies are safe to pass. The rule is stated here and the
 * type keeps the value to JSON primitives.
 *
 * ## Failure behaviour
 *
 * An audit write that fails does **not** silently swallow the failure, and it
 * does not roll back the change: the change has already happened, and refusing it
 * after the fact would be a lie. What it does is log loudly and report
 * `recorded: false`, so the route can answer honestly — the response says the
 * action succeeded and that its audit entry did not. A caller that ignores the
 * flag still cannot hide the failure, because the operator's log has it.
 */

import { readSupabaseServerConfig, type SupabaseServerConfig } from "@/lib/supabase/config";

/** The table audit rows are written to. */
export const AUDIT_TABLE = "admin_audit_logs";

/** Actions this application records. A closed set, so a typo cannot invent one. */
export const AUDIT_ACTIONS = [
  "news.create",
  "news.update",
  "news.delete",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** The kinds of record an action can touch. */
export const AUDIT_RESOURCE_TYPES = ["news_item"] as const;
export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

/** A value `metadata` may hold. Primitives only: no nested objects, no functions. */
export type AuditMetadataValue = string | number | boolean | null;

/** One entry, before it is written. */
export interface AuditEntryInput {
  /** Supabase Auth user id of the administrator. Never an email or a display name. */
  readonly actorId: string;
  readonly action: AuditAction;
  readonly resourceType: AuditResourceType;
  readonly resourceId: string;
  /** Salted digest of the caller's address. Null when no address could be determined. */
  readonly ipHash: string | null;
  readonly metadata?: Readonly<Record<string, AuditMetadataValue>>;
}

/** The row as stored. */
export interface AuditLogRow {
  readonly actor_id: string;
  readonly action: AuditAction;
  readonly resource_type: AuditResourceType;
  readonly resource_id: string;
  /** ISO-8601 instant, set by the server. */
  readonly occurred_at: string;
  readonly ip_hash: string | null;
  readonly metadata: Readonly<Record<string, AuditMetadataValue>>;
}

/** What happened to the write. */
export type AuditWriteResult =
  | { readonly recorded: true; readonly row: AuditLogRow }
  | {
      readonly recorded: false;
      /**
       * `not-configured` means there is no database to write to, so nothing was
       * attempted. `failed` means the write was attempted and did not land.
       */
      readonly reason: "not-configured" | "failed";
    };

export interface WriteAuditLogOptions {
  readonly fetchImpl?: typeof fetch;
  readonly config?: SupabaseServerConfig | null;
  /** Clock injection, so a test can assert the timestamp. */
  readonly now?: () => Date;
}

/**
 * Keeps `metadata` to the shape the table expects.
 *
 * A caller passing `undefined` gets an empty object rather than an absent key, so
 * the column is never null and a query does not need to handle two empty cases.
 * Keys are sorted so a stored row is stable and a diff of two rows is readable.
 */
function normaliseMetadata(
  metadata: Readonly<Record<string, AuditMetadataValue>> | undefined,
): Record<string, AuditMetadataValue> {
  if (metadata === undefined) return {};
  const sorted: Record<string, AuditMetadataValue> = {};
  for (const key of Object.keys(metadata).sort()) {
    const value = metadata[key];
    if (value === undefined) continue;
    sorted[key] = value;
  }
  return sorted;
}

/**
 * Writes one audit entry.
 *
 * Uses PostgREST directly rather than a Supabase client: the service role key
 * stays inside this module and no dependency is added to the bundle. `Prefer:
 * return=minimal` asks for no body back, so an audit row's contents never travel
 * in a response that might be logged.
 *
 * Never throws. A caller in a route has already performed the change it is
 * auditing, and an exception here would turn a successful write into a `500`
 * that misrepresents what happened.
 */
export async function writeAuditLog(
  input: AuditEntryInput,
  options: WriteAuditLogOptions = {},
): Promise<AuditWriteResult> {
  const config = options.config === undefined ? readSupabaseServerConfig() : options.config;
  if (config === null) {
    console.error(
      `[admin/audit] Supabase is not configured, so "${input.action}" on "${input.resourceId}" was not audited`,
    );
    return { recorded: false, reason: "not-configured" };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());

  const row: AuditLogRow = {
    actor_id: input.actorId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    occurred_at: now().toISOString(),
    ip_hash: input.ipHash,
    metadata: normaliseMetadata(input.metadata),
  };

  try {
    const response = await fetchImpl(`${config.url}/rest/v1/${AUDIT_TABLE}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error(`[admin/audit] Supabase rejected the audit row with HTTP ${response.status}`);
      return { recorded: false, reason: "failed" };
    }
  } catch (error) {
    console.error("[admin/audit] The audit write threw", error);
    return { recorded: false, reason: "failed" };
  }

  return { recorded: true, row };
}
