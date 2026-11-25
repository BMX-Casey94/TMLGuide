/**
 * Server-side Supabase settings.
 *
 * Two keys exist and they are not interchangeable:
 *
 * - `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It is only ever read
 *   by server code and never returned in a response.
 * - `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design. It identifies the
 *   project to Supabase Auth; it grants nothing on its own, because row-level
 *   security is what protects the data.
 *
 * `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must both be present before any
 * write is attempted. When they are not, callers answer `503` and say the feature
 * is not configured. That is deliberate: pretending a write succeeded to a
 * visitor who then waits for a reply is worse than telling the truth.
 *
 * A plain-HTTP URL is refused in production, because it would send the service
 * role key across the network in clear text. In development `http:` is allowed
 * for a local Supabase stack.
 */

export interface SupabaseServerConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

export interface SupabasePublicConfig {
  readonly url: string;
  readonly anonKey: string;
}

/**
 * The part of the environment this module reads.
 *
 * A narrow structural type with an index signature, so the real `process.env`
 * satisfies it without a cast. Next declares `NODE_ENV` as required on
 * `ProcessEnv` and drops the index signature.
 */
export interface SupabaseEnv {
  readonly SUPABASE_URL?: string | undefined;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string | undefined;
  readonly NODE_ENV?: string | undefined;
  readonly [key: string]: string | undefined;
}

/** True for the loopback hosts a local Supabase stack uses. */
function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * Normalises a project URL, or returns null when it is not usable.
 *
 * A trailing slash is stripped so a caller cannot build `//rest/v1` and have the
 * PostgREST path double up.
 */
export function normaliseSupabaseUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol === "https:") return trimmed.replace(/\/+$/, "");
  if (parsed.protocol === "http:" && isLoopback(parsed.hostname)) {
    return trimmed.replace(/\/+$/, "");
  }
  return null;
}

/**
 * Reads the server-only settings.
 *
 * Both values are required: a URL with no key cannot write, and a key with no URL
 * has nowhere to go. Either alone is a misconfiguration, and answering `503` is
 * the honest response to it.
 */
export function readSupabaseServerConfig(env: SupabaseEnv = process.env): SupabaseServerConfig | null {
  const url = normaliseSupabaseUrl(env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url === null || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

/**
 * Reads the settings Supabase Auth needs.
 *
 * The anon key is the one Auth expects; the service role key is *not* used here,
 * because a token exchange is scoped to one user and the service role would
 * bypass exactly the checks the exchange exists to perform.
 */
export function readSupabasePublicConfig(env: SupabaseEnv = process.env): SupabasePublicConfig | null {
  const url = normaliseSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL);
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url === null || !anonKey) return null;
  return { url, anonKey };
}
