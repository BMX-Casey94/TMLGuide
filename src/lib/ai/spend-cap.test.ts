/**
 * Tests for the monthly spend cap.
 *
 * The properties that matter are ordering ones: a reservation happens before the
 * call, a refused reservation costs nothing, and a reconciliation never inflates the
 * counter. A cap tested only on the happy path is a cap that is discovered to be an
 * alert when the invoice arrives.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CAP_GBP,
  IMPLAUSIBLE_CAP_GBP,
  InMemorySpendLedger,
  RedisSpendLedger,
  createSpendLedger,
  currentMonth,
  describeSpendLedger,
  hasSharedLedger,
  isCapImplausible,
  normaliseReservationPence,
  readCapPence,
  setSpendLedgerForTesting,
  type SpendLedger,
} from "./spend-cap";

afterEach(() => {
  setSpendLedgerForTesting(null);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("readCapPence", () => {
  it("defaults to £25", () => {
    expect(readCapPence({})).toBe(DEFAULT_CAP_GBP * 100);
    expect(DEFAULT_CAP_GBP).toBe(25);
  });

  it("reads a configured cap", () => {
    expect(readCapPence({ AI_MONTHLY_SPEND_CAP_GBP: "40" })).toBe(4000);
    expect(readCapPence({ AI_MONTHLY_SPEND_CAP_GBP: "£12.50" })).toBe(1250);
  });

  it("honours zero, so the feature can be switched off without a deploy", () => {
    expect(readCapPence({ AI_MONTHLY_SPEND_CAP_GBP: "0" })).toBe(0);
  });

  it("falls back rather than becoming unlimited on a typo", () => {
    // A negative or non-numeric value must not disable the cap.
    for (const value of ["-5", "lots", "", "  "]) {
      expect(readCapPence({ AI_MONTHLY_SPEND_CAP_GBP: value }), value).toBe(DEFAULT_CAP_GBP * 100);
    }
  });

  it("flags a cap so high it bounds nothing", () => {
    expect(isCapImplausible(IMPLAUSIBLE_CAP_GBP * 100)).toBe(false);
    expect(isCapImplausible(IMPLAUSIBLE_CAP_GBP * 100 + 1)).toBe(true);
  });
});

describe("currentMonth", () => {
  it("formats as YYYY-MM", () => {
    expect(currentMonth(new Date("2026-11-25T12:00:00Z"))).toMatch(/^\d{4}-\d{2}$/);
  });

  it("uses the London calendar month, so the boundary is the operator's midnight", () => {
    // 23:30 UTC on 30 November is 23:30 in London (GMT), so still November.
    expect(currentMonth(new Date("2026-11-30T23:30:00Z"))).toBe("2026-11");
    // 00:30 UTC on 1 December is December in London too.
    expect(currentMonth(new Date("2026-12-01T00:30:00Z"))).toBe("2026-12");
  });

  it("rolls over correctly in summer time, when London is an hour ahead", () => {
    // 23:30 UTC on 31 July is 00:30 BST on 1 August, so the London month is August.
    expect(currentMonth(new Date("2026-07-31T23:30:00Z"))).toBe("2026-08");
  });
});

describe("InMemorySpendLedger", () => {
  let ledger: InMemorySpendLedger;

  beforeEach(() => {
    ledger = new InMemorySpendLedger({ capPence: 1000 });
  });

  it("reports itself as unshared, because that is the truth", () => {
    expect(ledger.shared).toBe(false);
    expect(ledger.backend).toBe("memory");
  });

  it("reserves within the cap", async () => {
    const result = await ledger.reserve(200);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reservedPence).toBe(200);
    expect(result.spentPence).toBe(200);
    expect(await ledger.spent()).toBe(200);
  });

  it("refuses a reservation that would exceed the cap, and does not consume it", async () => {
    await ledger.reserve(900);
    const refused = await ledger.reserve(200);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.code).toBe("spend-cap");
    // The refused request must not have been charged: a cap that counts refusals is a
    // cap that shrinks every time it is hit.
    expect(await ledger.spent()).toBe(900);
  });

  it("permits a reservation that lands exactly on the cap", async () => {
    await ledger.reserve(900);
    const result = await ledger.reserve(100);
    expect(result.ok).toBe(true);
  });

  it("refuses everything once the cap is reached", async () => {
    await ledger.reserve(1000);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await ledger.reserve(1);
      expect(result.ok).toBe(false);
    }
  });

  it("releases the difference on reconciliation", async () => {
    await ledger.reserve(500);
    await ledger.reconcile(500, 120);
    expect(await ledger.spent()).toBe(120);
  });

  it("adds the shortfall when the answer cost more than reserved", async () => {
    // A systematic underestimate must be corrected upwards, or the cap drifts.
    await ledger.reserve(100);
    await ledger.reconcile(100, 180);
    expect(await ledger.spent()).toBe(180);
  });

  it("releases a full reservation when the call produced nothing", async () => {
    await ledger.reserve(400);
    await ledger.reconcile(400, 0);
    expect(await ledger.spent()).toBe(0);
  });

  it("never goes negative", async () => {
    await ledger.reserve(100);
    await ledger.reconcile(100, 500);
    await ledger.reconcile(500, 0);
    expect(await ledger.spent()).toBeGreaterThanOrEqual(0);
  });

  it("treats a cap of zero as a hard stop", async () => {
    const closed = new InMemorySpendLedger({ capPence: 0 });
    const result = await closed.reserve(1);
    expect(result.ok).toBe(false);
  });

  it("treats a non-finite request as zero rather than breaking the counter", async () => {
    const result = await ledger.reserve(Number.NaN);
    expect(result.ok).toBe(true);
    expect(await ledger.spent()).toBe(0);
  });

  it("refuses an infinite reservation rather than treating it as free", async () => {
    /*
      Regression: a non-finite amount used to be floored to 0, so an estimate that
      overflowed to Infinity — or a provider reporting an absurd token count —
      reserved nothing and the call it described cost nothing against the cap. An
      infinite reservation must exceed the cap, not vanish.
    */
    for (const pence of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const result = await ledger.reserve(pence);
      if (pence === Number.POSITIVE_INFINITY) {
        expect(result.ok, String(pence)).toBe(false);
        if (result.ok) continue;
        expect(result.code).toBe("spend-cap");
      } else {
        // Negative infinity is not a cost; it is treated as zero.
        expect(result.ok, String(pence)).toBe(true);
      }
    }
    expect(await ledger.spent()).toBe(0);
  });

  it("refuses an infinite reservation even against an enormous cap", async () => {
    const huge = new InMemorySpendLedger({ capPence: Number.MAX_SAFE_INTEGER });
    const result = await huge.reserve(Number.POSITIVE_INFINITY);
    expect(result.ok).toBe(false);
  });

  it("normalises a reservation without ever turning a large cost into a free one", () => {
    expect(normaliseReservationPence(0)).toBe(0);
    expect(normaliseReservationPence(0.4)).toBe(1);
    expect(normaliseReservationPence(Number.NaN)).toBe(0);
    expect(normaliseReservationPence(-5)).toBe(0);
    expect(normaliseReservationPence(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });

  it("does not let a non-finite reconciliation invent budget", async () => {
    await ledger.reserve(500);
    await ledger.reconcile(Number.POSITIVE_INFINITY, 0);
    // The reservation is unchanged: an infinite release would hand back an
    // unbounded amount of budget.
    expect(await ledger.spent()).toBe(500);
    await ledger.reconcile(500, Number.NaN);
    expect(await ledger.spent()).toBe(500);
  });

  it("rounds a fractional reservation up, never down", async () => {
    await ledger.reserve(0.4);
    expect(await ledger.spent()).toBe(1);
  });
});

describe("RedisSpendLedger", () => {
  /** An Upstash-shaped fetch that keeps the counter in a variable. */
  function upstash(initial = 0) {
    const state = { value: initial, ttlSet: false, calls: [] as string[][] };
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as string[];
      state.calls.push(command);
      const [verb, , amount] = command;
      if (verb === "INCRBY") state.value += Number(amount);
      if (verb === "DECRBY") state.value -= Number(amount);
      if (verb === "PEXPIRE") state.ttlSet = true;
      return new Response(JSON.stringify({ result: state.value }), { status: 200 });
    });
    return { state, fetchImpl };
  }

  it("shares its counter, which is what makes it a cap", () => {
    const { fetchImpl } = upstash();
    const ledger = new RedisSpendLedger({ url: "https://redis.test", token: "t", capPence: 1000, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(ledger.shared).toBe(true);
    expect(ledger.backend).toBe("redis");
  });

  it("reserves atomically and reports the running total", async () => {
    const { state, fetchImpl } = upstash();
    const ledger = new RedisSpendLedger({ url: "https://redis.test", token: "t", capPence: 1000, fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await ledger.reserve(300);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spentPence).toBe(300);
    expect(state.value).toBe(300);
  });

  it("hands the reservation back when the cap would be exceeded", async () => {
    const { state, fetchImpl } = upstash(900);
    const ledger = new RedisSpendLedger({ url: "https://redis.test", token: "t", capPence: 1000, fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await ledger.reserve(200);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("spend-cap");
    // Refused work must not consume budget.
    expect(state.value).toBe(900);
  });

  it("sets an expiry only when the key is created", async () => {
    const { state, fetchImpl } = upstash();
    const ledger = new RedisSpendLedger({ url: "https://redis.test", token: "t", capPence: 1000, fetchImpl: fetchImpl as unknown as typeof fetch });
    await ledger.reserve(100);
    expect(state.ttlSet).toBe(true);
  });

  it("reports ledger-unavailable rather than allowing the call when Redis is down", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    const ledger = new RedisSpendLedger({ url: "https://redis.test", token: "t", capPence: 1000, fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await ledger.reserve(100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Distinct from spend-cap: the route fails closed on it, but the two must not be
    // confused in a log.
    expect(result.code).toBe("ledger-unavailable");
  });

  it("reports ledger-unavailable on a network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("offline");
    });
    const ledger = new RedisSpendLedger({ url: "https://redis.test", token: "t", capPence: 1000, fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await ledger.reserve(100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ledger-unavailable");
  });

  it("answers spend-cap, not ledger-unavailable, for an infinite reservation", async () => {
    /*
      Regression: an `INCRBY Infinity` is rejected by Redis, which this adapter
      reports as `ledger-unavailable`. The route turns that into a `503` inviting
      a retry, so the same unstoppable cost would keep producing retries. The cap
      is the honest reason and the reservation never leaves the process.
    */
    const { state, fetchImpl } = upstash(500);
    const ledger = new RedisSpendLedger({ url: "https://redis.test", token: "t", capPence: 1000, fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await ledger.reserve(Number.POSITIVE_INFINITY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("spend-cap");
    // No write was attempted: the counter is untouched.
    expect(state.calls.some((call) => call[0] === "INCRBY")).toBe(false);
  });

  it("treats an Upstash error envelope as unavailable", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "WRONGTYPE" }), { status: 200 }));
    const ledger = new RedisSpendLedger({ url: "https://redis.test", token: "t", capPence: 1000, fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await ledger.reserve(100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ledger-unavailable");
  });

  it("reconciles by releasing the difference", async () => {
    const { state, fetchImpl } = upstash();
    const ledger = new RedisSpendLedger({ url: "https://redis.test", token: "t", capPence: 1000, fetchImpl: fetchImpl as unknown as typeof fetch });
    await ledger.reserve(400);
    await ledger.reconcile(400, 150);
    expect(state.value).toBe(150);
  });
});

describe("createSpendLedger", () => {
  it("uses Redis when both Upstash variables are set", () => {
    const ledger = createSpendLedger({
      UPSTASH_REDIS_REST_URL: "https://redis.test",
      UPSTASH_REDIS_REST_TOKEN: "token",
      AI_MONTHLY_SPEND_CAP_GBP: "10",
    });
    expect(ledger.backend).toBe("redis");
    expect(ledger.capPence).toBe(1000);
  });

  it("falls back to memory when only one is set", () => {
    // Half-configured is worse than unconfigured: it looks like a shared cap and is not.
    expect(createSpendLedger({ UPSTASH_REDIS_REST_URL: "https://redis.test" }).backend).toBe("memory");
    expect(createSpendLedger({ UPSTASH_REDIS_REST_TOKEN: "token" }).backend).toBe("memory");
  });

  it("reports whether a shared ledger is configured", () => {
    expect(hasSharedLedger({ UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" })).toBe(true);
    expect(hasSharedLedger({})).toBe(false);
  });
});

describe("describeSpendLedger", () => {
  it("reports degraded in production when the counter is not shared", () => {
    vi.stubEnv("NODE_ENV", "production");
    const ledger: SpendLedger = new InMemorySpendLedger({ capPence: 100 });
    const description = describeSpendLedger(ledger);
    expect(description.backend).toBe("memory");
    expect(description.degraded).toBe(true);
  });

  it("does not report degraded outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    const description = describeSpendLedger(new InMemorySpendLedger({ capPence: 100 }));
    expect(description.degraded).toBe(false);
  });
});
