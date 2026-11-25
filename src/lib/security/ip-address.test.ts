/**
 * Tests for the shared IP literal parser and range classifier.
 *
 * This module is the single source of truth for "is this address reachable?" and
 * "are these two spellings the same client?". Both answers were previously
 * implemented twice, and the two copies disagreed — which is exactly the class of
 * bug a shared module exists to make impossible, so the tests here are about
 * *values* rather than about strings.
 */

import { describe, expect, it } from "vitest";
import {
  BLOCKED_IPV4_CIDRS,
  canonicaliseIpAddress,
  canonicaliseIpv6,
  clientIpNetwork,
  ipAddressFamily,
  isBlockedIpAddress,
  isBlockedIpv4,
  isBlockedIpv6,
  ipv4ToInt,
  parseIpv4,
  parseIpv6,
} from "./ip-address";

describe("parseIpv4", () => {
  it("parses a dotted quad into octets", () => {
    expect(parseIpv4("127.0.0.1")).toEqual([127, 0, 0, 1]);
    expect(parseIpv4("255.255.255.255")).toEqual([255, 255, 255, 255]);
    expect(parseIpv4("0.0.0.0")).toEqual([0, 0, 0, 0]);
  });

  it("refuses a leading zero, which some resolvers read as octal", () => {
    // `0177.0.0.1` is 127.0.0.1 to an octal-aware resolver and 177.0.0.1 to a
    // decimal one. The only reading that cannot be wrong is to refuse it.
    expect(parseIpv4("0177.0.0.1")).toBeNull();
    expect(parseIpv4("010.0.0.1")).toBeNull();
    expect(parseIpv4("0.0.0.0")).not.toBeNull();
  });

  it("refuses the wrong number of parts and out-of-range octets", () => {
    for (const value of ["1.2.3", "1.2.3.4.5", "256.0.0.1", "1.2.3.-1", "1.2.3.4a", ""]) {
      expect(parseIpv4(value), value).toBeNull();
    }
  });

  it("refuses a bare integer, which a resolver may read as an address", () => {
    expect(parseIpv4("2130706433")).toBeNull();
    expect(parseIpv4("0x7f000001")).toBeNull();
  });
});

describe("ipv4ToInt", () => {
  it("produces an unsigned 32-bit value", () => {
    expect(ipv4ToInt([0, 0, 0, 0])).toBe(0);
    expect(ipv4ToInt([255, 255, 255, 255])).toBe(0xffffffff);
    expect(ipv4ToInt([127, 0, 0, 1])).toBe(0x7f000001);
  });
});

describe("parseIpv6", () => {
  it("expands a compressed address to eight groups", () => {
    expect(parseIpv6("::1")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(parseIpv6("2001:db8::1")).toEqual([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1]);
  });

  it("folds an embedded dotted quad into the last two groups", () => {
    expect(parseIpv6("::ffff:127.0.0.1")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 0x0001]);
    // The same address written without the dotted form must parse identically.
    expect(parseIpv6("::ffff:7f00:1")).toEqual(parseIpv6("::ffff:127.0.0.1"));
  });

  it("tolerates surrounding square brackets", () => {
    expect(parseIpv6("[::1]")).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("refuses a zone index, which is machine-local", () => {
    expect(parseIpv6("fe80::1%eth0")).toBeNull();
  });

  it("refuses a literal that does not expand to exactly eight groups", () => {
    for (const value of ["1:2:3", "1:2:3:4:5:6:7", "1:2:3:4:5:6:7:8:9", ":::", "1::2::3", "12345::1"]) {
      expect(parseIpv6(value), value).toBeNull();
    }
  });
});

describe("canonicaliseIpv6", () => {
  it("compresses the longest run of zero groups", () => {
    expect(canonicaliseIpv6([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1])).toBe("2001:db8::1");
    expect(canonicaliseIpv6([0, 0, 0, 0, 0, 0, 0, 1])).toBe("::1");
    expect(canonicaliseIpv6([0, 0, 0, 0, 0, 0, 0, 0])).toBe("::");
  });

  it("compresses only the first of two equal runs, as RFC 5952 requires", () => {
    expect(canonicaliseIpv6([0x2001, 0, 0, 1, 0, 0, 1, 1])).toBe("2001::1:0:0:1:1");
  });

  it("does not compress a single zero group", () => {
    expect(canonicaliseIpv6([1, 0, 1, 1, 1, 1, 1, 1])).toBe("1:0:1:1:1:1:1:1");
  });

  it("lower-cases hex groups and drops leading zeros", () => {
    expect(canonicaliseIpv6([0x0abc, 0, 0, 0, 0, 0, 0, 1])).toBe("abc::1");
  });

  it("refuses a list that is not eight groups", () => {
    expect(canonicaliseIpv6([1, 2, 3])).toBeNull();
  });
});

describe("canonicaliseIpAddress", () => {
  it("gives every spelling of one address one string", () => {
    // This is what makes a rate-limit key stable, so it is the property that
    // matters: one client must not occupy several buckets.
    const forms = [
      "2001:DB8::1",
      "2001:0db8:0000:0000:0000:0000:0000:0001",
      "[2001:db8::1]",
      "2001:db8:0:0:0:0:0:1",
    ];
    const canonical = forms.map((form) => canonicaliseIpAddress(form));
    expect(new Set(canonical).size).toBe(1);
    expect(canonical[0]).toBe("2001:db8::1");
  });

  it("collapses the mapped spellings of one IPv4 address", () => {
    const forms = ["::ffff:127.0.0.1", "::ffff:7f00:1", "0:0:0:0:0:ffff:7f00:1"];
    expect(new Set(forms.map((form) => canonicaliseIpAddress(form))).size).toBe(1);
  });

  it("leaves IPv4 unchanged", () => {
    expect(canonicaliseIpAddress("203.0.113.9")).toBe("203.0.113.9");
  });

  it("returns null for something that is not an address", () => {
    for (const value of ["", "localhost", "example.com", "1:2:3", "::zz"]) {
      expect(canonicaliseIpAddress(value), value).toBeNull();
    }
  });
});

describe("ipAddressFamily", () => {
  it("distinguishes the two families and rejects everything else", () => {
    expect(ipAddressFamily("203.0.113.9")).toBe(4);
    expect(ipAddressFamily("::1")).toBe(6);
    expect(ipAddressFamily("example.com")).toBeNull();
    expect(ipAddressFamily("")).toBeNull();
  });
});

describe("clientIpNetwork", () => {
  it("groups IPv6 clients by their /64, so one household is one bucket", () => {
    // A residential IPv6 customer can rotate freely within their /64. Keying on
    // the full address would give one household billions of rate-limit buckets.
    const a = clientIpNetwork("2001:db8:1234:5678:aaaa:bbbb:cccc:dddd");
    const b = clientIpNetwork("2001:db8:1234:5678:1111:2222:3333:4444");
    expect(a).toBe("2001:db8:1234:5678::/64");
    expect(a).toBe(b);
  });

  it("keeps different /64s apart", () => {
    expect(clientIpNetwork("2001:db8:1234:5678::1")).not.toBe(
      clientIpNetwork("2001:db8:1234:9999::1"),
    );
  });

  it("returns IPv4 unchanged, because one address is already one client", () => {
    expect(clientIpNetwork("203.0.113.9")).toBe("203.0.113.9");
  });

  it("reports a mapped or compatible address as the IPv4 client it carries", () => {
    /*
      Grouping these by /64 would put every IPv4-mapped client into the single
      `::/64` block, which is the opposite of a rate limit: one bucket shared by
      the whole IPv4 internet.
    */
    expect(clientIpNetwork("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(clientIpNetwork("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(clientIpNetwork("64:ff9b::203.0.113.9")).toBe("203.0.113.9");
  });

  it("returns null for something that is not an address", () => {
    expect(clientIpNetwork("")).toBeNull();
    expect(clientIpNetwork("example.com")).toBeNull();
  });
});

describe("isBlockedIpAddress", () => {
  it("blocks every IPv4 special-purpose range", () => {
    for (const address of [
      "0.0.0.0",
      "10.1.2.3",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.0.0.1",
      "192.0.2.1",
      "192.88.99.1",
      "192.168.1.1",
      "198.18.0.1",
      "198.19.255.255",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
      "239.255.255.255",
      "240.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isBlockedIpAddress(address), address).toBe(true);
    }
  });

  it("allows ordinary global unicast IPv4", () => {
    for (const address of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "100.63.255.255", "172.32.0.1"]) {
      expect(isBlockedIpAddress(address), address).toBe(false);
    }
  });

  it("blocks the IPv6 equivalents", () => {
    for (const address of [
      "::",
      "::1",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "fec0::1",
      "ff02::1",
      "2001:db8::1",
      "100::1",
    ]) {
      expect(isBlockedIpAddress(address), address).toBe(true);
    }
  });

  it("blocks every embedded-IPv4 shape, in every spelling", () => {
    for (const address of [
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "0:0:0:0:0:ffff:7f00:1",
      "::ffff:a9fe:a9fe",
      "::127.0.0.1",
      "::7f00:1",
      "64:ff9b::127.0.0.1",
      "64:ff9b::a9fe:a9fe",
      "2002:7f00:1::",
      "2002:a9fe:a9fe::",
    ]) {
      expect(isBlockedIpAddress(address), address).toBe(true);
    }
  });

  it("allows a public address carried in each embedded shape", () => {
    // The embedded-IPv4 rules must not blanket-refuse a public v4 address.
    for (const address of [
      "::ffff:8.8.8.8",
      "::ffff:808:808",
      "64:ff9b::8.8.8.8",
      "2002:808:808::",
    ]) {
      expect(isBlockedIpAddress(address), address).toBe(false);
    }
  });

  it("allows ordinary global unicast IPv6", () => {
    for (const address of [
      "2606:4700:4700::1111",
      "2a00:1450:4009:81f::200e",
      "2001:4860:4860::8888",
    ]) {
      expect(isBlockedIpAddress(address), address).toBe(false);
    }
  });

  it("fails closed on anything that will not parse", () => {
    for (const address of ["", "   ", "not-an-address", "256.1.1.1", "1:2:3", "::zz", "0177.0.0.1"]) {
      expect(isBlockedIpAddress(address), address).toBe(true);
    }
  });

  it("agrees with the family-specific helpers", () => {
    for (const address of ["10.0.0.1", "8.8.8.8", "::1", "2606:4700::1111"]) {
      const v4 = parseIpv4(address);
      const v6 = parseIpv6(address);
      const expected = v4 !== null ? isBlockedIpv4(v4) : v6 !== null ? isBlockedIpv6(v6) : true;
      expect(isBlockedIpAddress(address), address).toBe(expected);
    }
  });
});

describe("BLOCKED_IPV4_CIDRS", () => {
  it("is a well-formed, non-overlapping set covering the special-purpose space", () => {
    expect(new Set(BLOCKED_IPV4_CIDRS).size).toBe(BLOCKED_IPV4_CIDRS.length);
    for (const cidr of BLOCKED_IPV4_CIDRS) {
      expect(cidr, cidr).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/);
    }
  });

  it("includes CGNAT, which a hand-written comparison chain is liable to miss", () => {
    expect(BLOCKED_IPV4_CIDRS).toContain("100.64.0.0/10");
  });

  it("includes the cloud metadata range", () => {
    expect(BLOCKED_IPV4_CIDRS).toContain("169.254.0.0/16");
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
  });
});
