/**
 * Tests for the shared rate limiter.
 *
 * Both backends are tested against the same contract, because a route must
 * behave identically whether Redis is configured or not. The Redis adapter is
 * exercised through an injected `fetch` that emulates the exact response shapes
 * Upstash returns, so the script, the key layout and every failure path are
 * pinned without a network.
 */

import { describe, expect, it, vi } from "vitest";
import {
  createRateLimiter,
  describeRateLimiter,
  hasSharedRateLimiter,
  IN_MEMORY_MAX_ENTRIES,
  InMemoryRateLimiter,
  RateLimiterUnavailableError,
  RedisRateLimiter,
  sanitiseKeySegment,
  SLIDING_WINDOW_SCRIPT,
  type RateLimitOptions,
} from "./rate-limit";

const WINDOW = 60_000;

function options(overrides: Partial<RateLimitOptions> = {}): RateLimitOptions {
  return {
    name: "contact",
    identifier: "ip:abc",
    limit: 3,
    windowMs: WINDOW,
    now: 1_000_000,
    ...overrides,
  };
}

describe("sanitiseKeySegment", () => {
  it("keeps characters that are safe in a Redis key", () => {
    expect(sanitiseKeySegment("ip:AbC-123_x.y")).toBe("ip:AbC-123_x.y");
  });

  it("replaces anything that could break a key or a log line", () => {
    expect(sanitiseKeySegment("a b/c\nd")).toBe("a_b_c_d");
    // A colon is kept: it is the separator inside the key the limiter builds, and
    // it is safe in a Redis key and a log line.
    expect(sanitiseKeySegment("a:b;c")).toBe("a:b_c");
  });

  it("bounds the length", () => {
    expect(sanitiseKeySegment("a".repeat(500)).length).toBe(128);
  });

  it("never returns an empty segment", () => {
    expect(sanitiseKeySegment("")).toBe("unknown");
    expect(sanitiseKeySegment("///")).toBe("___");
  });
});

describe("InMemoryRateLimiter", () => {
  it("reports itself as unshared", () => {
    const limiter = new InMemoryRateLimiter();
    expect(limiter.shared).toBe(false);
    expect(limiter.backend).toBe("memory");
  });

  it("allows exactly the configured number of requests", async () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 3; i += 1) {
      const result = await limiter.check(options({ now: 1_000_000 + i }));
      expect(result.allowed).toBe(true);
    }
    const blocked = await limiter.check(options({ now: 1_000_003 }));
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("reports remaining capacity that decreases by one each time", async () => {
    const limiter = new InMemoryRateLimiter();
    const first = await limiter.check(options({ now: 1_000_000 }));
    const second = await limiter.check(options({ now: 1_000_001 }));
    const third = await limiter.check(options({ now: 1_000_002 }));
    expect([first.remaining, second.remaining, third.remaining]).toEqual([2, 1, 0]);
  });

  it("frees capacity once the window has passed", async () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 3; i += 1) await limiter.check(options({ now: 1_000_000 + i }));
    expect((await limiter.check(options({ now: 1_000_050 }))).allowed).toBe(false);
    // Exactly one window after the first request, that request has left the
    // window, so one slot is free.
    expect((await limiter.check(options({ now: 1_060_000 }))).allowed).toBe(true);
  });

  it("slides rather than resetting the whole window", async () => {
    const limiter = new InMemoryRateLimiter();
    const start = 1_000_000;
    // Three at the very start of the window.
    for (let i = 0; i < 3; i += 1) await limiter.check(options({ now: start + i }));

    // Halfway through: still blocked, because all three are still inside.
    expect((await limiter.check(options({ now: start + 30_000 }))).allowed).toBe(false);

    // Just after the first three expire, exactly three more are available; a
    // fixed window would have allowed a fresh full allowance at the boundary.
    expect((await limiter.check(options({ now: start + 60_001 }))).allowed).toBe(true);
  });

  it("keeps separate buckets per name and identifier", async () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 3; i += 1) await limiter.check(options({ now: 1_000_000 + i }));

    expect((await limiter.check(options({ name: "other", now: 1_000_004 }))).allowed).toBe(true);
    expect((await limiter.check(options({ identifier: "ip:other", now: 1_000_004 }))).allowed).toBe(
      true,
    );
  });

  it("reports a retry delay in whole seconds", async () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 3; i += 1) await limiter.check(options({ now: 1_000_000 }));
    const blocked = await limiter.check(options({ now: 1_000_000 }));
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSec).toBe(60);
    expect(blocked.resetAt).toBe(1_060_000);
  });

  it("reports no retry delay when allowed", async () => {
    const limiter = new InMemoryRateLimiter();
    expect((await limiter.check(options())).retryAfterSec).toBe(0);
  });

  it("never reports negative remaining", async () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 10; i += 1) {
      const result = await limiter.check(options({ now: 1_000_000 }));
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it("tracks identities up to the configured cap", async () => {
    const limiter = new InMemoryRateLimiter({ maxEntries: 5 });
    for (let i = 0; i < 20; i += 1) {
      await limiter.check(options({ identifier: `ip:${i}`, now: 1_000_000 }));
    }
    expect(limiter.size).toBeLessThanOrEqual(5);
  });

  it("keeps a busy identity when an idle flood arrives", async () => {
    // The eviction order must follow recent activity, not first-seen order, or a
    // one-shot flood would push out the legitimate client being limited.
    const limiter = new InMemoryRateLimiter({ maxEntries: 3 });
    await limiter.check(options({ identifier: "ip:busy", now: 1_000_000 }));
    for (let i = 0; i < 10; i += 1) {
      await limiter.check(options({ identifier: `ip:flood-${i}`, now: 1_000_000 }));
      // Keep touching the busy identity, as a real client would.
      await limiter.check(options({ identifier: "ip:busy", now: 1_000_000 + i }));
    }
    expect(limiter.size).toBeLessThanOrEqual(3);
    // The busy identity must still be known, so its count continues rather than
    // silently restarting at zero.
    const result = await limiter.check(options({ identifier: "ip:busy", now: 1_000_020 }));
    expect(result.remaining).toBeLessThan(3);
  });

  it("clears every bucket on reset", async () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 3; i += 1) await limiter.check(options({ now: 1_000_000 }));
    limiter.reset();
    expect(limiter.size).toBe(0);
    expect((await limiter.check(options({ now: 1_000_001 }))).allowed).toBe(true);
  });

  it("has a documented default cap", () => {
    expect(IN_MEMORY_MAX_ENTRIES).toBe(10_000);
  });

  it("treats a limit of one as one request", async () => {
    const limiter = new InMemoryRateLimiter();
    expect((await limiter.check(options({ limit: 1 }))).allowed).toBe(true);
    expect((await limiter.check(options({ limit: 1 }))).allowed).toBe(false);
  });
});

/** A fetch stub emulating Upstash's `EVAL` reply envelope. */
function redisStub(replies: Array<{ result?: unknown; error?: string } | Error>): {
  fetchImpl: typeof fetch;
  calls: { url: string; init: RequestInit }[];
} {
  const calls: { url: string; init: RequestInit }[] = [];
  let index = 0;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const reply = replies[index];
    index += 1;
    if (reply === undefined) throw new Error("redis stub exhausted");
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe("RedisRateLimiter", () => {
  it("reports itself as shared", () => {
    const { fetchImpl } = redisStub([{ result: [1, 60_000, 1] }]);
    const limiter = new RedisRateLimiter({ url: "https://redis.example", token: "t", fetchImpl });
    expect(limiter.shared).toBe(true);
    expect(limiter.backend).toBe("redis");
  });

  it("posts an EVAL of the sliding-window script with a namespaced key", async () => {
    const { fetchImpl, calls } = redisStub([{ result: [1, 60_000, 1] }]);
    const limiter = new RedisRateLimiter({ url: "https://redis.example", token: "tok", fetchImpl });
    await limiter.check(options());

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://redis.example/");
    const body = JSON.parse(String(calls[0]?.init.body)) as string[];
    expect(body[0]).toBe("EVAL");
    expect(body[1]).toBe(SLIDING_WINDOW_SCRIPT);
    expect(body[2]).toBe("1");
    expect(body[3]).toBe("tml:rl:contact:ip:abc");
    // now, window, limit, member
    expect(body[4]).toBe("1000000");
    expect(body[5]).toBe("60000");
    expect(body[6]).toBe("3");
    expect(body[7]).toMatch(/^1000000-[0-9a-f]{8}$/);
  });

  it("sends the bearer token and no credentials in the URL", async () => {
    const { fetchImpl, calls } = redisStub([{ result: [1, 60_000, 1] }]);
    const limiter = new RedisRateLimiter({ url: "https://redis.example", token: "secret", fetchImpl });
    await limiter.check(options());
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret");
    expect(calls[0]?.url).not.toContain("secret");
  });

  it("strips a trailing slash from the configured URL so the path is not doubled", async () => {
    const { fetchImpl, calls } = redisStub([{ result: [1, 60_000, 1] }]);
    const limiter = new RedisRateLimiter({ url: "https://redis.example///", token: "t", fetchImpl });
    await limiter.check(options());
    expect(calls[0]?.url).toBe("https://redis.example/");
  });

  it("gives each request a unique sorted-set member, so same-millisecond requests do not collide", async () => {
    const { fetchImpl, calls } = redisStub([
      { result: [1, 60_000, 1] },
      { result: [2, 60_000, 1] },
    ]);
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    await limiter.check(options({ now: 1_000_000 }));
    await limiter.check(options({ now: 1_000_000 }));
    const first = (JSON.parse(String(calls[0]?.init.body)) as string[])[7];
    const second = (JSON.parse(String(calls[1]?.init.body)) as string[])[7];
    expect(first).not.toBe(second);
  });

  it("allows while the count is within the limit", async () => {
    const { fetchImpl } = redisStub([{ result: [3, 60_000, 1] }]);
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    const result = await limiter.check(options());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSec).toBe(0);
  });

  it("blocks when the count exceeds the limit", async () => {
    const { fetchImpl } = redisStub([{ result: [4, 30_000, 1] }]);
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    const result = await limiter.check(options());
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSec).toBe(30);
    expect(result.resetAt).toBe(1_030_000);
  });

  it("uses the real TTL the server reports rather than assuming a full window", async () => {
    const { fetchImpl } = redisStub([{ result: [4, 1_500, 1] }]);
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    const result = await limiter.check(options());
    expect(result.resetAt).toBe(1_001_500);
    expect(result.retryAfterSec).toBe(2);
  });

  it("falls back to the window length when the TTL is missing", async () => {
    const { fetchImpl } = redisStub([{ result: [1, -1, 1] }]);
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    expect((await limiter.check(options())).resetAt).toBe(1_060_000);
  });

  it("raises on a non-2xx response so the route can answer 503 rather than 429", async () => {
    const fetchImpl = (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    await expect(limiter.check(options())).rejects.toBeInstanceOf(RateLimiterUnavailableError);
  });

  it("raises on a network error", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    await expect(limiter.check(options())).rejects.toBeInstanceOf(RateLimiterUnavailableError);
  });

  it("raises when Upstash reports an error field", async () => {
    const { fetchImpl } = redisStub([{ error: "WRONGTYPE Operation against a key" }]);
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    await expect(limiter.check(options())).rejects.toThrow(/WRONGTYPE/);
  });

  it("blocks when the script reports the request was not counted", async () => {
    /*
      Regression test for a fail-open. When the window is full the script leaves
      the count at the limit and adds nothing. Inferring allowance from the count
      alone therefore reports "allowed" for every refused request, which is the
      opposite of a limiter. The third tuple element is the authority.
    */
    const { fetchImpl } = redisStub([{ result: [3, 60_000, 0] }]);
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    const result = await limiter.check(options({ limit: 3 }));
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSec).toBe(60);
    expect(result.resetAt).toBe(1_060_000);
  });

  it("distinguishes the last permitted request from a refused one at the same count", async () => {
    const lastAllowed = redisStub([{ result: [3, 60_000, 1] }]);
    const refused = redisStub([{ result: [3, 60_000, 0] }]);
    const allowed = await new RedisRateLimiter({
      url: "https://r.example",
      token: "t",
      fetchImpl: lastAllowed.fetchImpl,
    }).check(options({ limit: 3 }));
    const blocked = await new RedisRateLimiter({
      url: "https://r.example",
      token: "t",
      fetchImpl: refused.fetchImpl,
    }).check(options({ limit: 3 }));

    expect(allowed.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
  });

  it("raises when the counted flag is missing or not a boolean flag", async () => {
    for (const reply of [{ result: [1, 60_000] }, { result: [1, 60_000, 7] }, { result: [1, 60_000, "x"] }]) {
      const { fetchImpl } = redisStub([reply]);
      const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
      await expect(limiter.check(options())).rejects.toBeInstanceOf(RateLimiterUnavailableError);
    }
  });

  it("raises on a malformed envelope rather than counting it as zero", async () => {
    for (const reply of [{}, { result: null }, { result: "nonsense" }, { result: [1] }, { result: ["x", 1] }]) {
      const { fetchImpl } = redisStub([reply]);
      const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
      await expect(limiter.check(options())).rejects.toBeInstanceOf(RateLimiterUnavailableError);
    }
  });

  it("raises on a non-object JSON body", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify([1, 2]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    await expect(limiter.check(options())).rejects.toBeInstanceOf(RateLimiterUnavailableError);
  });

  it("has a bounded timeout so a hung Redis cannot hold a request open", async () => {
    const { fetchImpl, calls } = redisStub([{ result: [1, 60_000, 1] }]);
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    await limiter.check(options());
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("never caches a limiter response", async () => {
    const { fetchImpl, calls } = redisStub([{ result: [1, 60_000, 1] }]);
    const limiter = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
    await limiter.check(options());
    expect(calls[0]?.init.cache).toBe("no-store");
  });

  it("script uses an atomic ZSET window with a unique member", () => {
    // A pipeline of separate commands would let two concurrent requests both see
    // the count just under the limit, so the whole check has to be one script.
    expect(SLIDING_WINDOW_SCRIPT).toContain("ZREMRANGEBYSCORE");
    expect(SLIDING_WINDOW_SCRIPT).toContain("ZADD");
    expect(SLIDING_WINDOW_SCRIPT).toContain("ZCARD");
    expect(SLIDING_WINDOW_SCRIPT).toContain("PEXPIRE");
    // The increment must be conditional on the count, not unconditional.
    expect(SLIDING_WINDOW_SCRIPT).toMatch(/if count < limit then/);
    // The member is passed in, not derived from the clock alone.
    expect(SLIDING_WINDOW_SCRIPT).toContain("local member = ARGV[4]");
  });
});

describe("createRateLimiter", () => {
  it("uses Redis when both credentials are present", () => {
    const limiter = createRateLimiter({
      UPSTASH_REDIS_REST_URL: "https://r.example",
      UPSTASH_REDIS_REST_TOKEN: "t",
    });
    expect(limiter.backend).toBe("redis");
  });

  it("falls back to memory when either credential is missing", () => {
    expect(createRateLimiter({ UPSTASH_REDIS_REST_URL: "https://r.example" }).backend).toBe("memory");
    expect(createRateLimiter({ UPSTASH_REDIS_REST_TOKEN: "t" }).backend).toBe("memory");
    expect(createRateLimiter({}).backend).toBe("memory");
  });

  it("ignores whitespace-only credentials", () => {
    expect(
      createRateLimiter({ UPSTASH_REDIS_REST_URL: "  ", UPSTASH_REDIS_REST_TOKEN: "  " }).backend,
    ).toBe("memory");
  });
});

describe("hasSharedRateLimiter", () => {
  it("is true only with both credentials", () => {
    expect(hasSharedRateLimiter({ UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" })).toBe(
      true,
    );
    expect(hasSharedRateLimiter({ UPSTASH_REDIS_REST_URL: "u" })).toBe(false);
    expect(hasSharedRateLimiter({})).toBe(false);
  });
});

describe("describeRateLimiter", () => {
  it("flags a memory limiter as degraded in production", () => {
    const original = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      expect(describeRateLimiter(new InMemoryRateLimiter()).degraded).toBe(true);
      const { fetchImpl } = redisStub([]);
      const redis = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });
      expect(describeRateLimiter(redis).degraded).toBe(false);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = original;
    }
  });

  it("is not degraded in development", () => {
    const original = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      expect(describeRateLimiter(new InMemoryRateLimiter()).degraded).toBe(false);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = original;
    }
  });
});

describe("both backends agree on the contract", () => {
  it("allows then blocks at the same point", async () => {
    const memory = new InMemoryRateLimiter();

    // Simulate Redis counting the same three requests.
    const { fetchImpl } = redisStub([
      { result: [1, 60_000, 1] },
      { result: [2, 60_000, 1] },
      { result: [3, 60_000, 1] },
      // Fourth request: the window is full, so the script adds nothing and
      // reports `added = 0`.
      { result: [3, 60_000, 0] },
    ]);
    const redis = new RedisRateLimiter({ url: "https://r.example", token: "t", fetchImpl });

    const memoryResults = [];
    for (let i = 0; i < 4; i += 1) {
      memoryResults.push((await memory.check(options({ now: 1_000_000 + i }))).allowed);
    }
    const redisResults = [];
    for (let i = 0; i < 4; i += 1) {
      redisResults.push((await redis.check(options({ now: 1_000_000 + i }))).allowed);
    }

    expect(memoryResults).toEqual([true, true, true, false]);
    expect(redisResults).toEqual([true, true, true, false]);
  });
});

describe("RateLimiterUnavailableError", () => {
  it("is identifiable and keeps its cause", () => {
    const cause = new Error("socket hang up");
    const error = new RateLimiterUnavailableError("failed", { cause });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("RateLimiterUnavailableError");
    expect(error.cause).toBe(cause);
  });

  it("can be told apart from a normal rejection", () => {
    const error = new RateLimiterUnavailableError("x");
    expect(error).toBeInstanceOf(RateLimiterUnavailableError);
    expect(vi.isMockFunction(error)).toBe(false);
  });
});
