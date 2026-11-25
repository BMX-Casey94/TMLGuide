/**
 * Shared rate limiting.
 *
 * The interface is the contract. Two implementations exist because the
 * deployment and the test suite need different things:
 *
 * - `RedisRateLimiter` counts in Redis through Upstash's REST API, so every
 *   server instance shares one counter. This is the only correct option when the
 *   app runs behind more than one process, which is the norm on serverless
 *   hosts.
 * - `InMemoryRateLimiter` counts in this process. It is **not shared**: two
 *   instances, or two lambda invocations on different machines, each get their
 *   own window, so the effective limit multiplies. It exists for local
 *   development and unit tests, and reports itself as unshared so callers can
 *   say so rather than silently losing the protection.
 *
 * Both implement a true sliding window. A fixed window would let a caller send
 * `limit` requests at the end of one window and `limit` more at the start of the
 * next, doubling the effective rate.
 */

/** The outcome of one rate-limit check. */
export interface RateLimitResult {
  /** False when this request exceeded the limit. */
  readonly allowed: boolean;
  /** Requests still available in the current window. Never negative. */
  readonly remaining: number;
  /** Epoch milliseconds at which capacity frees up. */
  readonly resetAt: number;
  /** Seconds to wait before retrying. `0` when the request was allowed. */
  readonly retryAfterSec: number;
}

export interface RateLimitOptions {
  /** Bucket name, so different endpoints do not share a counter. */
  readonly name: string;
  /** The identity being limited. Callers pass a salted hash, never an address. */
  readonly identifier: string;
  /** Requests permitted per window. */
  readonly limit: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
  /** Clock override, for tests. Defaults to `Date.now`. */
  readonly now?: number;
}

export interface RateLimiter {
  /** Whether this limiter is shared across instances. Reported, not enforced. */
  readonly shared: boolean;
  /** Human-readable backend name, for logs and health output. */
  readonly backend: "redis" | "memory";
  /** Counts one request against the bucket and reports the result. */
  check(options: RateLimitOptions): Promise<RateLimitResult>;
}

/**
 * Raised when the backing store cannot be reached or returns something
 * unexpected.
 *
 * Kept distinct from "not allowed" so a route can answer `503` rather than
 * `429`: telling a caller to retry later when the limiter itself is down would
 * be misleading, and silently allowing the request would remove the protection
 * exactly when the service is under stress.
 */
export class RateLimiterUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RateLimiterUnavailableError";
  }
}

/** Reduces an attacker-influenced identifier to a safe Redis key segment. */
export function sanitiseKeySegment(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 128);
  return cleaned === "" ? "unknown" : cleaned;
}

/** Builds the sliding-window result from a live count and a remaining TTL. */
function resultFrom(count: number, limit: number, ttlMs: number, now: number): RateLimitResult {
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);
  const effectiveTtl = ttlMs > 0 ? ttlMs : 0;
  const retryAfterSec = allowed ? 0 : Math.max(1, Math.ceil(effectiveTtl / 1000));
  return { allowed, remaining, resetAt: now + effectiveTtl, retryAfterSec };
}

/**
 * The Lua script that performs one atomic sliding-window check.
 *
 * It has to be a script rather than a pipeline. Reading the count and then
 * writing the new member in two round trips leaves a window in which two
 * concurrent requests both read `limit - 1` and both are admitted, which is
 * exactly the burst a limiter exists to stop. Redis runs a script atomically, so
 * the check and the increment cannot interleave.
 *
 * Sorted-set members are the request times, so the window is the real one rather
 * than an approximation. Each member carries a random suffix: two requests in
 * the same millisecond must not collide, or `ZADD` would overwrite one and
 * undercount.
 *
 * Returns `{count, ttl_ms, added}`. `added` is 1 when this request was admitted
 * and 0 when the window was already full. The flag is essential: a blocked
 * request leaves the count unchanged, so `count` alone cannot distinguish "the
 * third of three" from "a fourth that was refused", and reading it as the latter
 * would turn the limiter into a fail-open.
 */
export const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
local added = 0

if count < limit then
  redis.call('ZADD', key, now, member)
  count = count + 1
  added = 1
end

redis.call('PEXPIRE', key, window)
return {count, redis.call('PTTL', key), added}
`.trim();

/** Eight random hex characters, for member uniqueness only. */
function uniqueSuffix(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface UpstashEnvelope {
  readonly result?: unknown;
  readonly error?: string;
}

/**
 * Redis-backed limiter using the Upstash REST API.
 *
 * One command is posted per check: `EVAL` with the script above. Doing it in a
 * single round trip also keeps the check inside a request's latency budget; a
 * multi-step pipeline would multiply the network cost by three and still not be
 * atomic.
 */
export class RedisRateLimiter implements RateLimiter {
  readonly shared = true;
  readonly backend = "redis" as const;

  private readonly url: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { url: string; token: string; fetchImpl?: typeof fetch }) {
    this.url = options.url.replace(/\/+$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async check({
    name,
    identifier,
    limit,
    windowMs,
    now = Date.now(),
  }: RateLimitOptions): Promise<RateLimitResult> {
    const key = `tml:rl:${sanitiseKeySegment(name)}:${sanitiseKeySegment(identifier)}`;
    const member = `${now}-${uniqueSuffix()}`;
    const command = [
      "EVAL",
      SLIDING_WINDOW_SCRIPT,
      "1",
      key,
      String(now),
      String(Math.max(1, windowMs)),
      String(Math.max(1, limit)),
      member,
    ];

    let envelope: UpstashEnvelope;
    try {
      const response = await this.fetchImpl(`${this.url}/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
        // A hung Redis must not hold a request open: the contact form has a
        // budget and a stuck limiter is an outage either way.
        signal: AbortSignal.timeout(2000),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new RateLimiterUnavailableError(`Upstash responded with HTTP ${response.status}`);
      }

      const parsed: unknown = await response.json();
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new RateLimiterUnavailableError("Upstash returned an unexpected response shape");
      }
      envelope = parsed as UpstashEnvelope;
    } catch (error) {
      if (error instanceof RateLimiterUnavailableError) throw error;
      throw new RateLimiterUnavailableError("Upstash request failed", { cause: error });
    }

    if (typeof envelope.error === "string" && envelope.error !== "") {
      throw new RateLimiterUnavailableError(`Upstash command failed: ${envelope.error}`);
    }

    const tuple = envelope.result;
    if (!Array.isArray(tuple) || tuple.length < 3) {
      throw new RateLimiterUnavailableError("Upstash returned no usable count");
    }

    const count = Number(tuple[0]);
    if (!Number.isFinite(count) || count < 0) {
      throw new RateLimiterUnavailableError("Upstash returned a non-numeric count");
    }

    const added = Number(tuple[2]);
    if (added !== 0 && added !== 1) {
      throw new RateLimiterUnavailableError("Upstash did not report whether the request was counted");
    }

    const rawTtl = Number(tuple[1]);
    // `-1` means the key exists without a TTL, which the script's `PEXPIRE`
    // should prevent; treating it as a full window is the safe reading.
    const ttlMs = Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : windowMs;

    if (added === 0) {
      /*
        The window was already full. The count therefore equals the limit, and
        `resultFrom` would read that as "the last permitted request" and call it
        allowed. The refusal is built explicitly instead, with a retry delay
        derived from the key's remaining lifetime rather than from the count.
      */
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + ttlMs,
        retryAfterSec: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    }

    return resultFrom(count, limit, ttlMs, now);
  }
}

interface WindowEntry {
  /** Timestamps of the requests inside the window, oldest first. */
  timestamps: number[];
}

/** Hard cap on tracked identities, so a spoofed-identifier flood cannot exhaust memory. */
export const IN_MEMORY_MAX_ENTRIES = 10_000;

/**
 * Process-local sliding-window limiter.
 *
 * The map is a least-recently-used cache, not a plain map. A `Map` keeps
 * insertion order, so evicting its first key would drop whichever identity was
 * *first seen*, which is likely to be a busy legitimate client while a flood of
 * one-shot identifiers survives. Re-inserting on each touch makes eviction order
 * match recent activity, and an expired-entry sweep runs before anything live is
 * dropped.
 *
 * **Not shared.** Each process keeps its own map, so with N instances the real
 * limit is N × `limit`. Use it for local development and tests; use the Redis
 * adapter anywhere that matters.
 */
export class InMemoryRateLimiter implements RateLimiter {
  readonly shared = false;
  readonly backend = "memory" as const;

  private readonly buckets = new Map<string, WindowEntry>();
  private readonly maxEntries: number;

  constructor(options: { maxEntries?: number } = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? IN_MEMORY_MAX_ENTRIES);
  }

  /** Number of tracked identities. Exposed for tests and diagnostics. */
  get size(): number {
    return this.buckets.size;
  }

  async check({
    name,
    identifier,
    limit,
    windowMs,
    now = Date.now(),
  }: RateLimitOptions): Promise<RateLimitResult> {
    const key = `${name}:${identifier}`;
    const windowStart = now - windowMs;

    const existing = this.buckets.get(key);
    // Anything at or before the window start has left it. `>` rather than `>=`
    // means a request exactly `windowMs` old no longer counts, so the window
    // closes cleanly instead of lasting a millisecond longer than advertised.
    const live = existing === undefined ? [] : existing.timestamps.filter((at) => at > windowStart);

    if (live.length >= limit) {
      // Re-insert so this identity is treated as recently active; its block is
      // exactly what the caller just experienced.
      this.buckets.delete(key);
      this.buckets.set(key, { timestamps: live });
      const oldest = live[0] ?? now;
      const ttlMs = Math.max(0, oldest + windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + ttlMs,
        retryAfterSec: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    }

    live.push(now);
    this.buckets.delete(key);
    this.buckets.set(key, { timestamps: live });
    this.evictIfNeeded(now, windowMs);

    // Capacity returns when the oldest live request leaves the window.
    const oldest = live[0] ?? now;
    const ttlMs = Math.max(0, oldest + windowMs - now);

    return {
      allowed: true,
      remaining: Math.max(0, limit - live.length),
      resetAt: now + ttlMs,
      retryAfterSec: 0,
    };
  }

  /** Forgets every bucket. For tests only; never call this in a request path. */
  reset(): void {
    this.buckets.clear();
  }

  private evictIfNeeded(now: number, windowMs: number): void {
    if (this.buckets.size <= this.maxEntries) return;

    // First pass: drop identities whose whole window has passed. These are free
    // to lose and are the majority of a one-shot flood.
    const cutoff = now - windowMs;
    for (const [key, entry] of this.buckets) {
      if (this.buckets.size <= this.maxEntries) return;
      const last = entry.timestamps[entry.timestamps.length - 1];
      if (last === undefined || last <= cutoff) this.buckets.delete(key);
    }

    // Second pass: still over the cap, so the least recently active go.
    for (const key of this.buckets.keys()) {
      if (this.buckets.size <= this.maxEntries) return;
      this.buckets.delete(key);
    }
  }
}

export interface RateLimiterEnv {
  readonly UPSTASH_REDIS_REST_URL?: string;
  readonly UPSTASH_REDIS_REST_TOKEN?: string;
}

/** True when a shared limiter is configured. */
export function hasSharedRateLimiter(env: RateLimiterEnv = process.env as RateLimiterEnv): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim());
}

/**
 * Chooses the limiter for this environment.
 *
 * Redis is used whenever both variables are set. Otherwise the in-memory
 * limiter is returned, which is correct for a single development process and
 * inadequate in production; `describeRateLimiter` makes that visible.
 */
export function createRateLimiter(
  env: RateLimiterEnv = process.env as RateLimiterEnv,
  fetchImpl?: typeof fetch,
): RateLimiter {
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url && token) return new RedisRateLimiter({ url, token, fetchImpl });

  return new InMemoryRateLimiter();
}

let defaultLimiter: RateLimiter | null = null;

/** The process-wide limiter, created on first use. */
export function getRateLimiter(): RateLimiter {
  if (defaultLimiter === null) defaultLimiter = createRateLimiter();
  return defaultLimiter;
}

/** Replaces the process-wide limiter. For tests only. */
export function setRateLimiterForTesting(limiter: RateLimiter | null): void {
  defaultLimiter = limiter;
}

/**
 * Describes the active limiter, for a startup log or a health endpoint.
 *
 * `degraded` is the field that matters: in production, running on the in-memory
 * backend means the limit is per-instance and therefore weaker than configured.
 */
export function describeRateLimiter(limiter: RateLimiter = getRateLimiter()): {
  backend: "redis" | "memory";
  shared: boolean;
  degraded: boolean;
} {
  return {
    backend: limiter.backend,
    shared: limiter.shared,
    degraded: !limiter.shared && process.env.NODE_ENV === "production",
  };
}

/** Warned once per process so a missing Redis does not flood the log. */
let warnedAboutMemoryLimiter = false;

/**
 * Logs once when production is running without a shared limiter.
 *
 * Called from the route rather than at import time, because a module-level side
 * effect would also fire during `next build`.
 */
export function warnIfLimiterIsNotShared(): void {
  if (warnedAboutMemoryLimiter) return;
  const description = describeRateLimiter();
  if (!description.degraded) return;
  warnedAboutMemoryLimiter = true;
  console.warn(
    "[security] No Upstash credentials are configured, so rate limiting runs " +
      "in memory. The limit applies per server instance and is therefore weaker " +
      "than configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
  );
}
