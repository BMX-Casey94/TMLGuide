/**
 * Tests for trusted client IP resolution and the hashed identity.
 *
 * The interesting cases are all adversarial: a caller who sets their own
 * `x-forwarded-for`, one who sends a chain of fake addresses, one who sends
 * nothing at all. A resolver that is merely "reasonable" is a free rate-limit
 * bypass, so each of those is pinned down here.
 */

import { describe, expect, it, afterEach } from "vitest";
import {
  FORWARDED_FOR_HEADER,
  getTrustedClientIp,
  hashClientIp,
  IGNORED_PROXY_COUNT_HEADER,
  isIpHashSaltConfigured,
  isPlausibleIp,
  normaliseIp,
  pickFromChain,
  UNKNOWN_CLIENT_IP,
} from "./client-ip";

/** Builds the header reader the module expects. */
function headers(entries: Record<string, string>): { get(name: string): string | null } {
  const lower = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

afterEach(() => {
  delete process.env.TRUSTED_PROXY_COUNT;
});

describe("isPlausibleIp", () => {
  it("accepts IPv4 addresses across the range", () => {
    for (const ip of ["0.0.0.0", "1.2.3.4", "255.255.255.255", "192.168.0.1", "8.8.8.8"]) {
      expect(isPlausibleIp(ip)).toBe(true);
    }
  });

  it("rejects out-of-range and malformed IPv4", () => {
    for (const ip of ["256.1.1.1", "1.2.3", "1.2.3.4.5", "01.2.3.4", "1.2.3.-1", "1.2.3.4a"]) {
      expect(isPlausibleIp(ip)).toBe(false);
    }
  });

  it("accepts compressed and full IPv6", () => {
    for (const ip of ["::1", "2001:db8::1", "fe80::1", "2001:0db8:0000:0000:0000:0000:0000:0001"]) {
      expect(isPlausibleIp(ip), ip).toBe(true);
    }
  });

  it("rejects an IPv6 literal that does not expand to eight groups", () => {
    // The old structural check accepted these: it only looked at the characters.
    for (const ip of ["1:2:3", "1:2:3:4:5:6:7", ":::", "1::2::3", "12345::1", "::gg"]) {
      expect(isPlausibleIp(ip), ip).toBe(false);
    }
  });

  it("rejects IPv6 with a zone index, which is machine-local and not an identity", () => {
    expect(isPlausibleIp("fe80::1%eth0")).toBe(false);
  });

  it("rejects injection attempts", () => {
    for (const value of ["1.2.3.4; DROP TABLE", "'; --", "../etc/passwd", "<script>", "1.2.3.4 5.6.7.8"]) {
      expect(isPlausibleIp(value)).toBe(false);
    }
  });

  it("rejects an empty string", () => {
    expect(isPlausibleIp("")).toBe(false);
  });
});

describe("normaliseIp", () => {
  it("returns a bare IPv4 unchanged", () => {
    expect(normaliseIp("203.0.113.9")).toBe("203.0.113.9");
  });

  it("strips a port from IPv4", () => {
    expect(normaliseIp("203.0.113.9:5678")).toBe("203.0.113.9");
  });

  it("strips brackets and a port from IPv6", () => {
    expect(normaliseIp("[2001:db8::1]:443")).toBe("2001:db8::1");
    expect(normaliseIp("[2001:db8::1]")).toBe("2001:db8::1");
  });

  it("lower-cases and compresses IPv6 so two spellings of one address agree", () => {
    expect(normaliseIp("2001:DB8::1")).toBe("2001:db8::1");
    expect(normaliseIp("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8::1");
    expect(normaliseIp("2001:db8:0:0:1:0:0:1")).toBe("2001:db8::1:0:0:1");
  });

  it("collapses the mapped forms of one IPv4 address to one key", () => {
    // A dual-stack resolver can report either spelling. Both are one client.
    const forms = ["::ffff:127.0.0.1", "::ffff:7f00:1", "0:0:0:0:0:ffff:7f00:1"];
    const normalised = forms.map((form) => normaliseIp(form));
    expect(new Set(normalised).size).toBe(1);
    expect(normalised[0]).toBe("::ffff:7f00:1");
  });

  it("does not split a bare IPv6 address on its own colons", () => {
    expect(normaliseIp("2001:db8::1")).toBe("2001:db8::1");
    expect(normaliseIp("::1")).toBe("::1");
  });

  it("returns null for unusable values", () => {
    for (const value of ["", "   ", "not-an-ip", "[unclosed", "1.2.3.4:port", "localhost"]) {
      expect(normaliseIp(value)).toBeNull();
    }
  });
});

describe("pickFromChain", () => {
  it("takes the right-most entry with one trusted proxy", () => {
    // The right-most entry is the one the nearest proxy appended, so it is the
    // only part of the chain a client cannot fabricate.
    expect(pickFromChain("1.1.1.1, 2.2.2.2, 3.3.3.3", 1)).toBe("3.3.3.3");
  });

  it("walks back one place per additional trusted proxy", () => {
    expect(pickFromChain("1.1.1.1, 2.2.2.2, 3.3.3.3", 2)).toBe("2.2.2.2");
    expect(pickFromChain("1.1.1.1, 2.2.2.2, 3.3.3.3", 3)).toBe("1.1.1.1");
  });

  it("clamps a proxy count larger than the chain", () => {
    expect(pickFromChain("1.1.1.1, 2.2.2.2", 9)).toBe("1.1.1.1");
  });

  it("clamps a nonsensical proxy count of zero or less", () => {
    expect(pickFromChain("1.1.1.1, 2.2.2.2", 0)).toBe("2.2.2.2");
    expect(pickFromChain("1.1.1.1, 2.2.2.2", -5)).toBe("2.2.2.2");
  });

  it("skips unusable entries rather than failing the whole chain", () => {
    expect(pickFromChain("garbage, 2.2.2.2, nonsense", 1)).toBe("2.2.2.2");
  });

  it("returns null when no entry is usable", () => {
    expect(pickFromChain("garbage, nonsense", 1)).toBeNull();
    expect(pickFromChain("", 1)).toBeNull();
  });
});

describe("getTrustedClientIp", () => {
  it("prefers x-vercel-forwarded-for over everything else", () => {
    const ip = getTrustedClientIp(
      headers({
        "x-vercel-forwarded-for": "203.0.113.5",
        "cf-connecting-ip": "198.51.100.7",
        "x-real-ip": "192.0.2.9",
        "x-forwarded-for": "10.0.0.1",
      }),
    );
    expect(ip).toBe("203.0.113.5");
  });

  it("prefers cf-connecting-ip next", () => {
    const ip = getTrustedClientIp(
      headers({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "10.0.0.1" }),
    );
    expect(ip).toBe("198.51.100.7");
  });

  it("prefers x-real-ip over x-forwarded-for", () => {
    const ip = getTrustedClientIp(headers({ "x-real-ip": "192.0.2.9", "x-forwarded-for": "10.0.0.1" }));
    expect(ip).toBe("192.0.2.9");
  });

  it("does not let a forged x-forwarded-for override a platform header", () => {
    // The whole point of the ordering: a spoofed forwarded chain must not win.
    const ip = getTrustedClientIp(
      headers({
        "x-vercel-forwarded-for": "203.0.113.5",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      }),
    );
    expect(ip).toBe("203.0.113.5");
  });

  it("ignores an empty platform header and falls through", () => {
    const ip = getTrustedClientIp(
      headers({ "x-vercel-forwarded-for": "   ", "cf-connecting-ip": "198.51.100.7" }),
    );
    expect(ip).toBe("198.51.100.7");
  });

  it("falls back to the right-most x-forwarded-for entry", () => {
    // A client that prepends a fake address must not be counted under it.
    const ip = getTrustedClientIp(headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }));
    expect(ip).toBe("203.0.113.9");
  });

  it("honours TRUSTED_PROXY_COUNT from the environment", () => {
    process.env.TRUSTED_PROXY_COUNT = "2";
    const ip = getTrustedClientIp(headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.2" }));
    expect(ip).toBe("203.0.113.9");
  });

  it("ignores a client-supplied proxy count header, which would be a rate-limit bypass", () => {
    /*
      Regression: the count used to be readable from `x-trusted-proxy-count`. A
      caller could send `: 2` with a fabricated `x-forwarded-for` chain and be
      counted under an address of their choosing, resetting the limit whenever
      they liked. Only the operator's environment decides the count.
    */
    const spoofed = getTrustedClientIp(
      headers({
        "x-forwarded-for": "1.1.1.1, 2.2.2.2",
        [IGNORED_PROXY_COUNT_HEADER]: "2",
      }),
    );
    // One trusted proxy means the right-most entry, which is the one the proxy added.
    expect(spoofed).toBe("2.2.2.2");

    for (const value of ["1", "3", "10", "999", "-1", "abc"]) {
      expect(
        getTrustedClientIp(
          headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2", [IGNORED_PROXY_COUNT_HEADER]: value }),
        ),
        value,
      ).toBe("2.2.2.2");
    }
  });

  it("cannot be steered onto a spoofed address even with a header and a long chain", () => {
    // The attack in full: rotate the apparent address by prepending a new one and
    // claiming more trusted proxies each time.
    const seen = new Set<string>();
    for (let hop = 0; hop < 5; hop += 1) {
      const chain = Array.from({ length: hop + 1 }, (_unused, index) => `9.9.9.${index}`).join(", ");
      seen.add(
        getTrustedClientIp(
          headers({
            "x-forwarded-for": `${chain}, 203.0.113.9`,
            [IGNORED_PROXY_COUNT_HEADER]: String(hop + 2),
          }),
        ),
      );
    }
    // Every attempt lands on the same address, so every attempt shares one bucket.
    expect([...seen]).toEqual(["203.0.113.9"]);
  });

  it("returns the sentinel when no header is present, never an empty string", () => {
    // An empty string would make `if (!ip) return` a trivial bypass in a caller.
    expect(getTrustedClientIp(headers({}))).toBe(UNKNOWN_CLIENT_IP);
    expect(UNKNOWN_CLIENT_IP.length).toBeGreaterThan(0);
  });

  it("returns the sentinel when every header is unusable", () => {
    expect(
      getTrustedClientIp(headers({ "x-forwarded-for": "garbage", "cf-connecting-ip": "nonsense" })),
    ).toBe(UNKNOWN_CLIENT_IP);
  });

  it("never returns an injected value", () => {
    const ip = getTrustedClientIp(headers({ "x-forwarded-for": "'; DROP TABLE users; --" }));
    expect(ip).toBe(UNKNOWN_CLIENT_IP);
  });

  it("strips a port so one client cannot appear as many", () => {
    expect(getTrustedClientIp(headers({ "x-real-ip": "203.0.113.9:443" }))).toBe("203.0.113.9");
  });

  it("reads header names case-insensitively", () => {
    const upper = { get: (name: string) => (name.toLowerCase() === "cf-connecting-ip" ? "198.51.100.7" : null) };
    expect(getTrustedClientIp(upper)).toBe("198.51.100.7");
  });

  it("is stable across repeated calls for the same headers", () => {
    const value = headers({ "x-forwarded-for": "203.0.113.9" });
    expect(getTrustedClientIp(value)).toBe(getTrustedClientIp(value));
  });

  it("uses the documented fallback header name", () => {
    expect(FORWARDED_FOR_HEADER).toBe("x-forwarded-for");
  });
});

describe("hashClientIp", () => {
  it("produces a base64url digest with a readable prefix", async () => {
    const digest = await hashClientIp("203.0.113.9", "test-salt");
    expect(digest).toMatch(/^ip:[A-Za-z0-9_-]{43}$/);
  });

  it("is stable for the same address and salt", async () => {
    const a = await hashClientIp("203.0.113.9", "salt-one");
    const b = await hashClientIp("203.0.113.9", "salt-one");
    expect(a).toBe(b);
  });

  it("differs for different addresses", async () => {
    const a = await hashClientIp("203.0.113.9", "salt-one");
    const b = await hashClientIp("203.0.113.10", "salt-one");
    expect(a).not.toBe(b);
  });

  it("differs for different salts, so a leaked digest cannot be reversed with a public table", async () => {
    const a = await hashClientIp("203.0.113.9", "salt-one");
    const b = await hashClientIp("203.0.113.9", "salt-two");
    expect(a).not.toBe(b);
  });

  it("never contains the address it hashed", async () => {
    const digest = await hashClientIp("203.0.113.9", "salt");
    expect(digest).not.toContain("203.0.113.9");
    expect(digest).not.toContain("203");
  });

  it("is 43 characters, matching an unpadded base64 SHA-256", async () => {
    const digest = await hashClientIp("::1", "salt");
    expect(digest.slice(3).length).toBe(43);
  });

  it("works without a salt but still hashes", async () => {
    const digest = await hashClientIp("203.0.113.9", "");
    expect(digest).toMatch(/^ip:[A-Za-z0-9_-]{43}$/);
  });

  it("maps the unknown sentinel to one shared bucket", async () => {
    const a = await hashClientIp(UNKNOWN_CLIENT_IP, "salt");
    const b = await hashClientIp(UNKNOWN_CLIENT_IP, "salt");
    expect(a).toBe(b);
  });

  it("groups a rotating IPv6 client by its /64, so re-spelling cannot escape a limit", async () => {
    /*
      Regression: the hash was taken over the full address. A residential IPv6
      customer is delegated a /64 and can present a new address on every request,
      which gave them an unlimited supply of rate-limit buckets.
    */
    const first = await hashClientIp("2001:db8:1234:5678:aaaa:bbbb:cccc:dddd", "salt");
    const second = await hashClientIp("2001:db8:1234:5678:1111:2222:3333:4444", "salt");
    expect(first).toBe(second);
  });

  it("keeps different IPv6 /64s apart", async () => {
    const first = await hashClientIp("2001:db8:1234:5678::1", "salt");
    const second = await hashClientIp("2001:db8:1234:9999::1", "salt");
    expect(first).not.toBe(second);
  });

  it("treats the mapped forms of one IPv4 client as one bucket", async () => {
    const plain = await hashClientIp("127.0.0.1", "salt");
    const mapped = await hashClientIp("::ffff:127.0.0.1", "salt");
    const mappedHex = await hashClientIp("::ffff:7f00:1", "salt");
    expect(mapped).toBe(plain);
    expect(mappedHex).toBe(plain);
  });

  it("still separates two different IPv4 clients", async () => {
    const first = await hashClientIp("203.0.113.9", "salt");
    const second = await hashClientIp("203.0.113.10", "salt");
    expect(first).not.toBe(second);
  });
});

describe("isIpHashSaltConfigured", () => {
  it("is false when unset or too short to be a secret", () => {
    expect(isIpHashSaltConfigured({})).toBe(false);
    expect(isIpHashSaltConfigured({ RATE_LIMIT_IP_SALT: "short" })).toBe(false);
    expect(isIpHashSaltConfigured({ RATE_LIMIT_IP_SALT: "" })).toBe(false);
  });

  it("is true for a long salt", () => {
    expect(
      isIpHashSaltConfigured({ RATE_LIMIT_IP_SALT: "a".repeat(32) }),
    ).toBe(true);
  });
});
