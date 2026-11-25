/**
 * The hard monthly spend cap.
 *
 * A cap that is checked *after* the provider call is an alert, not a cap: by the
 * time it fires, the money has gone. The flow here is therefore reservation
 * first:
 *
 * 1. Before the call, `reserve(pence)` adds the worst-case cost of the answer to
 *    a per-calendar-month counter, atomically.
 * 2. If that would take the month over the cap, the reservation is released and
 *    the call does not happen. The reader gets the `spend-cap` refusal.
 * 3. After the call, `reconcile(reserved, actual)` releases the difference, or
 *    adds the shortfall when the answer cost more than reserved.
 *
 * Two backends, for the same reason the rate limiter has two:
 *
 * - **Upstash Redis** when `UPSTASH_REDIS_REST_URL` and
 *   `UPSTASH_REDIS_REST_TOKEN` are set. Shared across instances, so a restart or
 *   an extra lambda cannot reset the month. This is the only correct option in
 *   production.
 * - **A bounded in-process counter** otherwise, marked unshared. It exists so
 *   local development and tests work without credentials, and it reports itself
 *   as degraded rather than pretending to be a cap.
 *
 * The counter is keyed on the calendar month in **Europe/London**, because the cap
 * is a sterling budget agreed with a UK operator and a month boundary should fall
 * at their midnight, not UTC's.
 */

/** Default cap in pounds, from the feature brief. */
export const DEFAULT_CAP_GBP = 25;

/** Warn at this fraction of the cap. The cap itself is the stop, not the warning. */
export const WARN_FRACTION = 0.8;

/** A cap high enough to be meaningless is worth a startup warning. */
export const IMPLAUSIBLE_CAP_GBP = 500;

/** Key prefix, so the ledger cannot collide with a rate-limit bucket. */
const KEY_PREFIX = "tml:ai:spend";

/** The result of a reservation attempt. */
export type ReserveResult =
  | { readonly ok: true; readonly reservedPence: number; readonly spentPence: number; readonly capPence: number; readonly month: string }
  | {
      readonly ok: false;
      readonly code: "spend-cap";
      readonly spentPence: number;
      readonly capPence: number;
      readonly month: string;
    }
  | {
      readonly ok: false;
      readonly code: "ledger-unavailable";
      readonly detail: string;
    };

export interface SpendLedger {
  readonly backend: "redis" | "memory";
  readonly shared: boolean;
  readonly capPence: number;
  /**
   * Reserves `pence` against this month.
   *
   * `ledger-unavailable` is distinct from `spend-cap` on purpose: a caller that
   * cannot reach the ledger must decide whether to fail closed (a public
   * endpoint with a real bill) or proceed (a test). The route fails closed.
   */
  reserve(pence: number): Promise<ReserveResult>;
  /** Releases `reserved - actual`, or adds the shortfall. Never throws. */
  reconcile(reservedPence: number, actualPence: number): Promise<void>;
  /** Pence already committed this month, for a health endpoint. */
  spent(): Promise<number>;
}

export interface SpendEnv {
  readonly AI_MONTHLY_SPEND_CAP_GBP?: string | undefined;
  readonly UPSTASH_REDIS_REST_URL?: string | undefined;
  readonly UPSTASH_REDIS_REST_TOKEN?: string | undefined;
  readonly [key: string]: string | undefined;
}

/**
 * Reads the configured cap in pence.
 *
 * An unset or non-numeric cap falls back to the documented default rather than
 * becoming unlimited, and a negative value is treated as the default: a typo must
 * not switch the cap off. A zero is honoured, because an operator may legitimately
 * want the feature off without removing the route.
 */
export function readCapPence(env: SpendEnv = process.env): number {
  const raw = env.AI_MONTHLY_SPEND_CAP_GBP?.trim();
  if (!raw) return DEFAULT_CAP_GBP * 100;
  const pounds = Number.parseFloat(raw.replace(/[£,\s]/g, ""));
  if (!Number.isFinite(pounds) || pounds < 0) return DEFAULT_CAP_GBP * 100;
  return Math.round(pounds * 100);
}

/** True when the cap is configured so high that it bounds nothing in practice. */
export function isCapImplausible(capPence: number): boolean {
  return capPence > IMPLAUSIBLE_CAP_GBP * 100;
}

/**
 * The current month in Europe/London, as `YYYY-MM`.
 *
 * `Intl` rather than arithmetic on `Date`, so the boundary is the operator's local
 * month and not a fixed UTC offset that changes with the clocks.
 */
export function currentMonth(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Europe/London",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

/** Milliseconds until the next month starts in Europe/London, for a key TTL. */
export function millisecondsUntilNextMonth(now: Date = new Date()): number {
  // 40 days: past any month boundary regardless of clock changes, so the key
  // always survives its own month and expires inside the next one.
  void currentMonth(now);
  return 40 * 24 * 60 * 60 * 1000;
}

/* -------------------------------------------------------------------------- */
/* In-memory backend                                                           */
/* -------------------------------------------------------------------------- */

/** A hard ceiling on distinct months kept in memory. Only ever one in practice. */
export const IN_MEMORY_MAX_MONTHS = 12;

/**
 * A process-local counter.
 *
 * **Not a cap in production.** Each instance keeps its own total, so N instances
 * allow N × the cap. It reports `shared: false` and the route logs that once.
 */
export class InMemorySpendLedger implements SpendLedger {
  readonly backend = "memory" as const;
  readonly shared = false;
  readonly capPence: number;

  private readonly totals = new Map<string, number>();
  private readonly maxMonths: number;

  constructor(options: { capPence?: number; maxMonths?: number } = {}) {
    this.capPence = Math.max(0, options.capPence ?? readCapPence());
    this.maxMonths = Math.max(1, options.maxMonths ?? IN_MEMORY_MAX_MONTHS);
  }

  async reserve(pence: number): Promise<ReserveResult> {
    const month = currentMonth();
    const requested = Number.isFinite(pence) ? Math.max(0, Math.ceil(pence)) : 0;

    this.prune(month);

    const spent = this.totals.get(month) ?? 0;
    const next = spent + requested;

    if (next > this.capPence) {
      return { ok: false, code: "spend-cap", spentPence: spent, capPence: this.capPence, month };
    }

    this.totals.set(month, next);
    return { ok: true, reservedPence: requested, spentPence: next, capPence: this.capPence, month };
  }

  async reconcile(reservedPence: number, actualPence: number): Promise<void> {
    const month = currentMonth();
    const spent = this.totals.get(month);
    if (spent === undefined) return;
    const delta = Math.max(0, Math.ceil(reservedPence)) - Math.max(0, Math.ceil(actualPence));
    // A negative delta means the answer cost more than reserved; the counter must
    // go up, not down, or a systematic underestimate would never be corrected.
    this.totals.set(month, Math.max(0, spent - delta));
  }

  async spent(): Promise<number> {
    return this.totals.get(currentMonth()) ?? 0;
  }

  /** Clears every month. For tests only. */
  reset(): void {
    this.totals.clear();
  }

  private prune(month: string): void {
    if (this.totals.size <= this.maxMonths) return;
    for (const key of this.totals.keys()) {
      if (key === month) continue;
      this.totals.delete(key);
      if (this.totals.size <= this.maxMonths) return;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Redis backend                                                               */
/* -------------------------------------------------------------------------- */

interface UpstashEnvelope {
  readonly result?: unknown;
  readonly error?: string;
}

/**
 * Redis-backed ledger using the Upstash REST API.
 *
 * Reservation is `INCRBY` followed by a comparison, which is atomic per command
 * but not across the pair. The failure mode is benign and bounded: two concurrent
 * requests can both push the counter past the cap by one answer each, after which
 * every request is refused. That is strictly better than a read-then-write, where
 * the same race lets an unbounded number through.
 */
export class RedisSpendLedger implements SpendLedger {
  readonly backend = "redis" as const;
  readonly shared = true;
  readonly capPence: number;

  private readonly url: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: {
    url: string;
    token: string;
    capPence?: number;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  }) {
    this.url = options.url.replace(/\/+$/, "");
    this.token = options.token;
    this.capPence = Math.max(0, options.capPence ?? readCapPence());
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 2000;
  }

  private key(month: string): string {
    return `${KEY_PREFIX}:${month}`;
  }

  /** One command against Upstash. Returns the numeric result, or null on failure. */
  private async command(command: readonly string[]): Promise<number | null> {
    try {
      const response = await this.fetchImpl(`${this.url}/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
      if (!response.ok) return null;
      const parsed: unknown = await response.json();
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
      const envelope = parsed as UpstashEnvelope;
      if (typeof envelope.error === "string" && envelope.error !== "") return null;
      const value = Number(envelope.result);
      return Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  }

  async reserve(pence: number): Promise<ReserveResult> {
    const month = currentMonth();
    const key = this.key(month);
    const requested = Number.isFinite(pence) ? Math.max(0, Math.ceil(pence)) : 0;

    const after = await this.command(["INCRBY", key, String(requested)]);
    if (after === null) {
      return { ok: false, code: "ledger-unavailable", detail: "Upstash did not answer the reservation" };
    }

    if (after > this.capPence) {
      // Hand the reservation straight back so a refused request does not consume
      // budget it never used.
      await this.command(["DECRBY", key, String(requested)]);
      const spent = Math.max(0, after - requested);
      return { ok: false, code: "spend-cap", spentPence: spent, capPence: this.capPence, month };
    }

    // Set an expiry only when the key was just created, so the TTL is not pushed
    // forward on every request.
    if (after === requested) {
      await this.command(["PEXPIRE", key, String(millisecondsUntilNextMonth())]);
    }

    return { ok: true, reservedPence: requested, spentPence: after, capPence: this.capPence, month };
  }

  async reconcile(reservedPence: number, actualPence: number): Promise<void> {
    const delta = Math.max(0, Math.ceil(reservedPence)) - Math.max(0, Math.ceil(actualPence));
    if (delta === 0) return;
    const key = this.key(currentMonth());
    if (delta > 0) {
      await this.command(["DECRBY", key, String(delta)]);
    } else {
      await this.command(["INCRBY", key, String(-delta)]);
    }
  }

  async spent(): Promise<number> {
    const value = await this.command(["GET", this.key(currentMonth())]);
    return value === null ? 0 : Math.max(0, value);
  }
}

/* -------------------------------------------------------------------------- */
/* Selection                                                                   */
/* -------------------------------------------------------------------------- */

/** True when a shared ledger is configured. */
export function hasSharedLedger(env: SpendEnv = process.env): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim());
}

/** Chooses the ledger for this environment. */
export function createSpendLedger(
  env: SpendEnv = process.env,
  deps: { readonly fetchImpl?: typeof fetch } = {},
): SpendLedger {
  const capPence = readCapPence(env);
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (url && token) {
    return new RedisSpendLedger({ url, token, capPence, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) });
  }

  return new InMemorySpendLedger({ capPence });
}

let defaultLedger: SpendLedger | null = null;

/** The process-wide ledger, created on first use. */
export function getSpendLedger(): SpendLedger {
  if (defaultLedger === null) defaultLedger = createSpendLedger();
  return defaultLedger;
}

/** Replaces the process-wide ledger. For tests only. */
export function setSpendLedgerForTesting(ledger: SpendLedger | null): void {
  defaultLedger = ledger;
}

/** A one-line description for a health endpoint or a startup log. */
export function describeSpendLedger(ledger: SpendLedger = getSpendLedger()): {
  backend: "redis" | "memory";
  shared: boolean;
  degraded: boolean;
  capPence: number;
} {
  return {
    backend: ledger.backend,
    shared: ledger.shared,
    // The cap is only a cap when the counter is shared and the deployment is real.
    degraded: !ledger.shared && process.env.NODE_ENV === "production",
    capPence: ledger.capPence,
  };
}

/** Warned once per process so a missing ledger does not flood the log. */
let warnedAboutMemoryLedger = false;

/**
 * Logs once when production is running without a shared ledger.
 *
 * Called from the route rather than at import time: a module-level side effect
 * would also fire during `next build`.
 */
export function warnIfLedgerIsNotShared(): void {
  if (warnedAboutMemoryLedger) return;
  const description = describeSpendLedger();
  if (!description.degraded) return;
  warnedAboutMemoryLedger = true;
  console.warn(
    "[ai] No Upstash credentials are configured, so the monthly AI spend cap " +
      "runs in memory. The cap applies per server instance, which means the real " +
      "ceiling is a multiple of the configured one. Set UPSTASH_REDIS_REST_URL and " +
      "UPSTASH_REDIS_REST_TOKEN.",
  );
}
