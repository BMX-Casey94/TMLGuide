// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  ATTENTION_STATUSES,
  COMMUNITY_CHECKER_USER_AGENT,
  DEFAULT_MAX_REDIRECTS,
  FAILING_STATUSES,
  LINK_STATUSES,
  MAX_BODY_BYTES,
  checkLinkHealth,
  classifyLinkStatus,
  describeHealthSummary,
  parseTarget,
  summariseHealthReport,
  type CheckLinkOptions,
  type LinkHealthResult,
} from "./link-health";

/*
  These tests never open a socket. `resolveHost` and `fetchImpl` are injected, so
  every branch — a clean 200, a redirect chain, a redirect into the private
  network, a timeout, a TLS failure — is a deterministic unit test rather than a
  flaky integration one.
*/

/** A resolver that reports one public address, which is what the real one does for a live host. */
const publicResolver = async () => ["93.184.216.34"];

/** Builds a response the checker will see. */
function response(status: number, headers: Record<string, string> = {}, body = ""): Response {
  return new Response(body === "" ? null : body, { status, headers });
}

/** Collects the options a test needs, with the network replaced. */
function options(overrides: Partial<CheckLinkOptions> = {}): CheckLinkOptions {
  return {
    resolveHost: publicResolver,
    fetchImpl: async () => response(200),
    retries: 0,
    now: () => Date.parse("2026-11-25T10:00:00.000Z"),
    ...overrides,
  };
}

describe("LINK_STATUSES", () => {
  it("covers exactly the five statuses the task defines", () => {
    expect([...LINK_STATUSES]).toEqual(["ok", "redirect", "broken", "timeout", "blocked"]);
  });

  it("counts only a dead or timed-out link as a failure", () => {
    // A blocked link is not evidence that the page is dead, so a nightly run must
    // not fail on it alone.
    expect([...FAILING_STATUSES]).toEqual(["broken", "timeout"]);
    expect([...ATTENTION_STATUSES]).toEqual(["blocked"]);
  });
});

describe("parseTarget", () => {
  it("accepts a plain https URL on a public host", () => {
    const result = parseTarget("https://chat.whatsapp.com/abc123");
    expect(result.url?.hostname).toBe("chat.whatsapp.com");
  });

  it("accepts an explicit :443, which is the same as no port", () => {
    expect(parseTarget("https://example.com:443/path").url).not.toBeNull();
  });

  it.each([
    ["", "the URL is missing"],
    ["   ", "the URL is missing"],
    ["not a url", "the URL is not absolute"],
    ["/relative/path", "the URL is not absolute"],
    ["http://example.com/", "the scheme is http:"],
    ["ftp://example.com/", "the scheme is ftp:"],
    ["javascript:alert(1)", "the scheme is javascript:"],
    ["data:text/html,hi", "the scheme is data:"],
    ["file:///etc/passwd", "the scheme is file:"],
    ["https://user:pass@example.com/", "the URL embeds credentials"],
    ["https://example.com:8443/", "port 8443 is not allowed"],
    ["https://example.com:22/", "port 22 is not allowed"],
  ])("refuses %j", (value, reasonFragment) => {
    const result = parseTarget(value);
    expect(result.url).toBeNull();
    expect(result.reason).toContain(reasonFragment);
  });

  it("refuses an IP literal in a private range", () => {
    expect(parseTarget("https://127.0.0.1/").reason).toContain("private or reserved");
    expect(parseTarget("https://169.254.169.254/latest/meta-data/").reason).toContain(
      "private or reserved",
    );
    expect(parseTarget("https://10.0.0.5/").reason).toContain("private or reserved");
  });

  it("refuses localhost and a reserved local name", () => {
    expect(parseTarget("https://localhost:443/").url).toBeNull();
    expect(parseTarget("https://printer.local/").url).toBeNull();
  });

  it("refuses every spelling of a loopback address, including the IPv6 ones", () => {
    /*
      Regression: the IPv4-compatible (`::7f00:1`) and 6to4 (`2002:7f00:1::`)
      shapes reached `isPrivateHost` and were reported as public. They are
      `127.0.0.1` written differently, and a resolver returns whichever form the
      stack prefers.
    */
    for (const url of [
      "https://127.0.0.1/",
      "https://::ffff:127.0.0.1/",
      "https://[::ffff:127.0.0.1]/",
      "https://[::ffff:7f00:1]/",
      "https://[::127.0.0.1]/",
      "https://[::7f00:1]/",
      "https://[64:ff9b::7f00:1]/",
      "https://[2002:7f00:1::]/",
      "https://[0:0:0:0:0:ffff:7f00:1]/",
    ]) {
      const result = parseTarget(url);
      // Either the parser rejects the literal outright or the range check does;
      // both are refusals, and both mean the URL never reaches the network.
      expect(result.url, url).toBeNull();
    }
  });

  it("refuses the metadata service by every route", () => {
    for (const url of [
      "https://169.254.169.254/latest/meta-data/",
      "https://[::ffff:169.254.169.254]/",
      "https://[::ffff:a9fe:a9fe]/",
      "https://[64:ff9b::a9fe:a9fe]/",
      "https://[2002:a9fe:a9fe::]/",
    ]) {
      expect(parseTarget(url).url, url).toBeNull();
    }
  });

  it("refuses carrier-grade NAT and IPv6 site-local addresses", () => {
    expect(parseTarget("https://100.64.0.1/").url).toBeNull();
    expect(parseTarget("https://[fec0::1]/").url).toBeNull();
  });

  it("still accepts an ordinary public IPv6 host", () => {
    expect(parseTarget("https://[2606:4700:4700::1111]/").url).not.toBeNull();
  });

  it("refuses a non-string", () => {
    expect(parseTarget(undefined).url).toBeNull();
    expect(parseTarget(42).url).toBeNull();
    expect(parseTarget(null).url).toBeNull();
  });
});

describe("classifyLinkStatus", () => {
  it("marks a clean 200 as ok", () => {
    expect(classifyLinkStatus({ httpStatus: 200 })).toEqual({ status: "ok", detail: "200 — OK" });
  });

  it("marks a 204 as ok", () => {
    expect(classifyLinkStatus({ httpStatus: 204 }).status).toBe("ok");
  });

  it("marks a followed redirect as redirect and says to update the URL", () => {
    const verdict = classifyLinkStatus({
      httpStatus: 200,
      redirects: 1,
      requestedUrl: "https://example.com/a",
      finalUrl: "https://example.com/b",
    });
    expect(verdict.status).toBe("redirect");
    expect(verdict.detail).toContain("one redirect");
  });

  it("counts hops and warns when the redirect leaves the original site", () => {
    const verdict = classifyLinkStatus({
      httpStatus: 200,
      redirects: 2,
      requestedUrl: "https://example.com/a",
      finalUrl: "https://elsewhere.example/b",
    });
    expect(verdict.status).toBe("redirect");
    expect(verdict.detail).toContain("2 redirects");
    expect(verdict.detail).toContain("different site");
  });

  it.each([404, 410])("marks %i as broken", (status) => {
    expect(classifyLinkStatus({ httpStatus: status }).status).toBe("broken");
  });

  it.each([400, 418, 422])("marks %i as broken", (status) => {
    expect(classifyLinkStatus({ httpStatus: status }).status).toBe("broken");
  });

  it.each([401, 403, 429, 451])("marks %i as blocked rather than broken", (status) => {
    const verdict = classifyLinkStatus({ httpStatus: status });
    expect(verdict.status).toBe("blocked");
  });

  it.each([500, 502, 503])("marks %i as broken", (status) => {
    expect(classifyLinkStatus({ httpStatus: status }).status).toBe("broken");
  });

  it("marks a 3xx that never resolved as broken", () => {
    expect(classifyLinkStatus({ httpStatus: 302 }).status).toBe("broken");
  });

  it("marks a 1xx as broken, because no final page arrived", () => {
    expect(classifyLinkStatus({ httpStatus: 103 }).status).toBe("broken");
    expect(classifyLinkStatus({ httpStatus: 199 }).status).toBe("broken");
  });

  it.each([
    ["dns", "broken"],
    ["refused", "broken"],
    ["tls", "broken"],
    ["network", "broken"],
    ["timeout", "timeout"],
    ["invalid-url", "blocked"],
    ["blocked-target", "blocked"],
  ] as const)("maps the %s transport failure to %s", (failure, expected) => {
    expect(classifyLinkStatus({ failure }).status).toBe(expected);
  });

  it("lets a transport failure outrank an HTTP status", () => {
    // There was no answer, so the status cannot be the deciding evidence.
    expect(classifyLinkStatus({ failure: "timeout", httpStatus: 200 }).status).toBe("timeout");
  });

  it("lets a failed content check downgrade an otherwise-good 200", () => {
    const verdict = classifyLinkStatus({
      httpStatus: 200,
      content: { ok: false, detail: "The invite no longer works" },
    });
    expect(verdict.status).toBe("broken");
    expect(verdict.detail).toBe("The invite no longer works");
  });

  it("keeps a passing content check's detail on an ok result", () => {
    const verdict = classifyLinkStatus({
      httpStatus: 200,
      content: { ok: true, detail: 'Invite live, group now named "TML - W1"' },
    });
    expect(verdict.status).toBe("ok");
    expect(verdict.detail).toContain("TML - W1");
  });

  it("treats a missing status and no failure as broken rather than ok", () => {
    expect(classifyLinkStatus().status).toBe("broken");
    expect(classifyLinkStatus({}).status).toBe("broken");
    expect(classifyLinkStatus({ httpStatus: null }).status).toBe("broken");
  });

  it("never invents an ok verdict for an unrecognised status", () => {
    for (const httpStatus of [0, 600, 999]) {
      expect(classifyLinkStatus({ httpStatus }).status).not.toBe("ok");
    }
  });

  it("clamps a negative or fractional redirect count instead of misreporting it", () => {
    expect(classifyLinkStatus({ httpStatus: 200, redirects: -3 }).status).toBe("ok");
    expect(classifyLinkStatus({ httpStatus: 200, redirects: 1.7 }).status).toBe("redirect");
  });
});

describe("checkLinkHealth — the happy path", () => {
  it("returns ok for a 200 and records what it asked for", async () => {
    const fetchImpl = vi.fn(async () => response(200));
    const result = await checkLinkHealth("https://chat.whatsapp.com/abc123", options({ fetchImpl }));

    expect(result.status).toBe("ok");
    expect(result.url).toBe("https://chat.whatsapp.com/abc123");
    expect(result.httpStatus).toBe(200);
    expect(result.redirects).toBe(0);
    expect(result.finalUrl).toBe("https://chat.whatsapp.com/abc123");
    expect(result.checkedAt).toBe("2026-11-25T10:00:00.000Z");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("identifies itself in the user agent rather than impersonating a browser", async () => {
    const fetchImpl = vi.fn(async () => response(200));
    await checkLinkHealth("https://example.com/", options({ fetchImpl }));

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["user-agent"]).toBe(COMMUNITY_CHECKER_USER_AGENT);
    expect(headers["user-agent"]).toContain("TMLGuide");
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
  });

  it("requests redirects manually so every hop can be checked", async () => {
    const fetchImpl = vi.fn(async () => response(200));
    await checkLinkHealth("https://example.com/", options({ fetchImpl }));

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.redirect).toBe("manual");
  });

  it("bounds every request with a timeout signal", async () => {
    const fetchImpl = vi.fn(async () => response(200));
    await checkLinkHealth("https://example.com/", options({ fetchImpl }));

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("checkLinkHealth — SSRF refusal", () => {
  it("refuses a plain http URL before any network call, and says why", async () => {
    const fetchImpl = vi.fn(async () => response(200));
    const result = await checkLinkHealth("http://example.com/", options({ fetchImpl }));

    expect(result.status).toBe("blocked");
    // The reason is carried through: "the scheme is http:" says what to fix,
    // where "it was not checked" would not.
    expect(result.detail).toContain("the scheme is http:");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses an IP literal in a private range before any network call", async () => {
    const fetchImpl = vi.fn(async () => response(200));
    const result = await checkLinkHealth("https://169.254.169.254/latest/meta-data/", options({ fetchImpl }));

    expect(result.status).toBe("blocked");
    expect(result.detail).toContain("private or reserved");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a public name that resolves to a private address", async () => {
    // The classic SSRF route: a name the checker has never seen, pointing at the
    // metadata service. Checking the literal in the URL would miss it.
    const fetchImpl = vi.fn(async () => response(200));
    const result = await checkLinkHealth(
      "https://looks-public.example/",
      options({ fetchImpl, resolveHost: async () => ["169.254.169.254"] }),
    );

    expect(result.status).toBe("blocked");
    expect(result.detail).toContain("169.254.169.254");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a name when any of its addresses is private", async () => {
    const fetchImpl = vi.fn(async () => response(200));
    const result = await checkLinkHealth(
      "https://mixed.example/",
      options({ fetchImpl, resolveHost: async () => ["93.184.216.34", "10.0.0.7"] }),
    );

    expect(result.status).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a redirect into the private network instead of following it", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://public.example/")) {
        return response(302, { location: "https://internal.example/admin" });
      }
      return response(200);
    });

    const result = await checkLinkHealth(
      "https://public.example/start",
      options({
        fetchImpl: fetchImpl as unknown as typeof fetch,
        resolveHost: async (hostname) =>
          hostname === "internal.example" ? ["10.0.0.12"] : ["93.184.216.34"],
      }),
    );

    expect(result.status).toBe("blocked");
    expect(result.detail.toLowerCase()).toContain("private");
    // Only the first hop was requested: the second was refused before contact.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect to a plain http URL", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) =>
      String(input).startsWith("https://public.example/")
        ? response(301, { location: "http://public.example/next" })
        : response(200),
    );

    const result = await checkLinkHealth(
      "https://public.example/start",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    );

    expect(result.status).toBe("blocked");
    expect(result.detail).toContain("http:");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports a host that does not resolve as broken, not blocked", async () => {
    const fetchImpl = vi.fn(async () => response(200));
    const result = await checkLinkHealth(
      "https://gone.example/",
      options({
        fetchImpl,
        resolveHost: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
    );

    expect(result.status).toBe("broken");
    expect(result.detail).toContain("does not resolve");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a name that resolves to nothing as broken", async () => {
    const result = await checkLinkHealth(
      "https://empty.example/",
      options({ resolveHost: async () => [] }),
    );
    expect(result.status).toBe("broken");
    expect(result.detail).toContain("resolves to no address");
  });

  it("skips the DNS check only when the caller explicitly opts out", async () => {
    const resolver = vi.fn(publicResolver);
    await checkLinkHealth("https://example.com/", options({ resolveHost: resolver }));
    expect(resolver).toHaveBeenCalledWith("example.com");

    const second = vi.fn(publicResolver);
    await checkLinkHealth("https://example.com/", options({ resolveHost: null }));
    expect(second).not.toHaveBeenCalled();
  });
});

describe("checkLinkHealth — redirects", () => {
  it("follows one redirect and records the final address", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) =>
      String(input).endsWith("/old") ? response(301, { location: "/new" }) : response(200),
    );

    const result = await checkLinkHealth(
      "https://example.com/old",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    );

    expect(result.status).toBe("redirect");
    expect(result.redirects).toBe(1);
    expect(result.finalUrl).toBe("https://example.com/new");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("resolves a relative location against the hop that issued it", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL) => {
      seen.push(String(input));
      return seen.length === 1 ? response(302, { location: "../final" }) : response(200);
    });

    await checkLinkHealth(
      "https://example.com/a/b/start",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    );

    expect(seen[1]).toBe("https://example.com/a/final");
  });

  it("stops at the redirect limit and calls the chain broken", async () => {
    const fetchImpl = vi.fn(async () => response(302, { location: "/loop" }));
    const result = await checkLinkHealth(
      "https://example.com/loop",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch, maxRedirects: 3 }),
    );

    expect(result.status).toBe("broken");
    expect(result.redirects).toBe(3);
    expect(result.detail).toContain("3 redirects");
    // Four requests: the original plus three followed hops.
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("uses the documented default hop limit", () => {
    expect(DEFAULT_MAX_REDIRECTS).toBe(5);
  });

  it("calls a 3xx with no location broken rather than ok", async () => {
    const fetchImpl = vi.fn(async () => response(302));
    const result = await checkLinkHealth(
      "https://example.com/",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    );

    expect(result.status).toBe("broken");
    expect(result.detail).toContain("302");
  });

  it("calls a 3xx with an unparseable location broken", async () => {
    const fetchImpl = vi.fn(async () => response(302, { location: "http://[not a host" }));
    const result = await checkLinkHealth(
      "https://example.com/",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    );

    expect(result.status).toBe("broken");
    expect(result.detail).toContain("not a usable URL");
  });
});

describe("checkLinkHealth — failures", () => {
  it("classifies a timeout as timeout and retries it once by default", async () => {
    let attempts = 0;
    const fetchImpl = vi.fn(async () => {
      attempts += 1;
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      throw error;
    });

    const result = await checkLinkHealth(
      "https://slow.example/",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch, retries: 1 }),
    );

    expect(result.status).toBe("timeout");
    expect(attempts).toBe(2);
  });

  it("does not retry a refused connection, because it would answer the same way", async () => {
    let attempts = 0;
    const fetchImpl = vi.fn(async () => {
      attempts += 1;
      const error = new Error("connect ECONNREFUSED") as Error & { code?: string };
      error.code = "ECONNREFUSED";
      throw error;
    });

    const result = await checkLinkHealth(
      "https://closed.example/",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch, retries: 2 }),
    );

    expect(result.status).toBe("broken");
    expect(result.detail).toContain("refused");
    expect(attempts).toBe(1);
  });

  it("finds the DNS code when undici buries it in cause", async () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
    const fetchImpl = vi.fn(async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause });
    });

    const result = await checkLinkHealth(
      "https://gone.example/",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    );

    expect(result.status).toBe("broken");
    expect(result.detail).toContain("does not resolve");
  });

  it("classifies a certificate failure as broken", async () => {
    const fetchImpl = vi.fn(async () => {
      const error = new Error("certificate has expired") as Error & { code?: string };
      error.code = "CERT_HAS_EXPIRED";
      throw error;
    });

    const result = await checkLinkHealth(
      "https://expired.example/",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    );

    expect(result.status).toBe("broken");
    expect(result.detail).toContain("certificate");
  });

  it("classifies an unrecognised error as a broken network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("socket hang up");
    });

    const result = await checkLinkHealth(
      "https://flaky.example/",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    );

    expect(result.status).toBe("broken");
    expect(result.detail).toContain("failed before an answer");
  });

  it("never throws for a bad link", async () => {
    await expect(
      checkLinkHealth("not-a-url", options({ fetchImpl: async () => response(200) })),
    ).resolves.toMatchObject({ status: "blocked" });
  });
});

describe("checkLinkHealth — content inspection", () => {
  it("reads the body of a 2xx only when an inspector is supplied", async () => {
    const body = "<html><body>This invite link is invalid or has been revoked.</body></html>";
    const fetchImpl = vi.fn(async () => response(200, {}, body));

    const result = await checkLinkHealth(
      "https://chat.whatsapp.com/revoked",
      options({
        fetchImpl: fetchImpl as unknown as typeof fetch,
        inspectBody: (text) =>
          text.includes("has been revoked")
            ? { ok: false, detail: "The invite no longer works" }
            : null,
      }),
    );

    expect(result.status).toBe("broken");
    expect(result.detail).toBe("The invite no longer works");
  });

  it("leaves the status alone when the inspector has no opinion", async () => {
    const fetchImpl = vi.fn(async () => response(200, {}, "<html>ambiguous</html>"));
    const result = await checkLinkHealth(
      "https://chat.whatsapp.com/unknown",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch, inspectBody: () => null }),
    );

    expect(result.status).toBe("ok");
  });

  it("does not read the body of a non-2xx response", async () => {
    const inspector = vi.fn(() => null);
    const fetchImpl = vi.fn(async () => response(404));

    const result = await checkLinkHealth(
      "https://example.com/missing",
      options({ fetchImpl: fetchImpl as unknown as typeof fetch, inspectBody: inspector }),
    );

    expect(result.status).toBe("broken");
    expect(inspector).not.toHaveBeenCalled();
  });

  it("caps how much of a body it reads", async () => {
    // A hostile page could stream gigabytes. The inspector must see a bounded
    // prefix, not the whole thing.
    const huge = "a".repeat(MAX_BODY_BYTES * 3);
    const fetchImpl = vi.fn(async () => response(200, {}, huge));

    let seen = 0;
    await checkLinkHealth(
      "https://huge.example/",
      options({
        fetchImpl: fetchImpl as unknown as typeof fetch,
        inspectBody: (text) => {
          seen = text.length;
          return null;
        },
      }),
    );

    expect(seen).toBe(MAX_BODY_BYTES);
  });

  it("passes the hop's own URL to the inspector, after any redirect", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL) =>
      String(input).endsWith("/old")
        ? response(302, { location: "https://moved.example/new" })
        : response(200, {}, "ok"),
    );

    await checkLinkHealth(
      "https://example.com/old",
      options({
        fetchImpl: fetchImpl as unknown as typeof fetch,
        resolveHost: async () => ["93.184.216.34"],
        inspectBody: (_body, url) => {
          seen.push(url.href);
          return null;
        },
      }),
    );

    expect(seen).toEqual(["https://moved.example/new"]);
  });
});

describe("checkLinkHealth — timing", () => {
  it("records elapsed time from the injected clock", async () => {
    let now = 1_000;
    const result = await checkLinkHealth(
      "https://example.com/",
      options({
        fetchImpl: async () => {
          now += 250;
          return response(200);
        },
        now: () => now,
      }),
    );

    expect(result.elapsedMs).toBe(250);
  });

  it("reports zero elapsed for a URL refused before contact", async () => {
    const result = await checkLinkHealth("http://example.com/", options());
    expect(result.elapsedMs).toBe(0);
    expect(result.checkedAt).toBe("2026-11-25T10:00:00.000Z");
  });
});

describe("summariseHealthReport", () => {
  function result(status: LinkHealthResult["status"], url: string): LinkHealthResult {
    return {
      url,
      status,
      httpStatus: status === "ok" ? 200 : null,
      finalUrl: url,
      redirects: 0,
      elapsedMs: 5,
      detail: "detail",
      checkedAt: "2026-11-25T10:00:00.000Z",
    };
  }

  it("counts every status, including the zeros", () => {
    const report = summariseHealthReport([result("ok", "https://a.example/")], 0);

    expect(report.counts).toEqual({ ok: 1, redirect: 0, broken: 0, timeout: 0, blocked: 0 });
    expect(report.total).toBe(1);
  });

  it("separates failures, blocked links and moved links", () => {
    const report = summariseHealthReport(
      [
        result("ok", "https://a.example/"),
        result("redirect", "https://b.example/"),
        result("broken", "https://c.example/"),
        result("timeout", "https://d.example/"),
        result("blocked", "https://e.example/"),
      ],
      0,
    );

    expect(report.failures.map((entry) => entry.url)).toEqual([
      "https://c.example/",
      "https://d.example/",
    ]);
    expect(report.blocked.map((entry) => entry.url)).toEqual(["https://e.example/"]);
    expect(report.moved.map((entry) => entry.url)).toEqual(["https://b.example/"]);
  });

  it("is healthy with no failures, even when links moved or were blocked", () => {
    const report = summariseHealthReport(
      [result("redirect", "https://b.example/"), result("blocked", "https://e.example/")],
      0,
    );
    expect(report.healthy).toBe(true);
  });

  it("is unhealthy when anything is broken or timed out", () => {
    expect(summariseHealthReport([result("broken", "https://c.example/")], 0).healthy).toBe(false);
    expect(summariseHealthReport([result("timeout", "https://d.example/")], 0).healthy).toBe(false);
  });

  it("is healthy and empty for an empty run", () => {
    const report = summariseHealthReport([], 0);
    expect(report.total).toBe(0);
    expect(report.healthy).toBe(true);
  });

  it("stamps the report with the instant it was built", () => {
    expect(summariseHealthReport([], Date.parse("2026-11-25T12:00:00.000Z")).checkedAt).toBe(
      "2026-11-25T12:00:00.000Z",
    );
  });
});

describe("describeHealthSummary", () => {
  function result(status: LinkHealthResult["status"], url: string): LinkHealthResult {
    return {
      url,
      status,
      httpStatus: null,
      finalUrl: url,
      redirects: 0,
      elapsedMs: 5,
      detail: `${status} detail`,
      checkedAt: "2026-11-25T10:00:00.000Z",
    };
  }

  it("opens with the counts", () => {
    const text = describeHealthSummary(
      summariseHealthReport([result("ok", "https://a.example/")], 0),
    );
    expect(text).toContain("1 link checked");
    expect(text).toContain("1 ok");
  });

  it("says nothing was found when the run is healthy", () => {
    const text = describeHealthSummary(summariseHealthReport([result("ok", "https://a.example/")], 0));
    expect(text).toContain("No dead links were found.");
    expect(text).not.toContain("Needs fixing:");
  });

  it("lists each failing URL with its detail", () => {
    const text = describeHealthSummary(
      summariseHealthReport(
        [result("broken", "https://dead.example/invite"), result("ok", "https://a.example/")],
        0,
      ),
    );

    expect(text).toContain("Needs fixing:");
    expect(text).toContain("https://dead.example/invite");
    expect(text).toContain("broken detail");
    expect(text).toContain("1 link needs attention.");
  });

  it("distinguishes a moved link from a blocked one, and neither is a failure", () => {
    const text = describeHealthSummary(
      summariseHealthReport(
        [result("redirect", "https://moved.example/"), result("blocked", "https://filtered.example/")],
        0,
      ),
    );

    expect(text).toContain("the stored URL should be updated");
    expect(text).toContain("Open these by hand");
    expect(text).toContain("No dead links were found.");
  });

  it("pluralises the closing line", () => {
    const text = describeHealthSummary(
      summariseHealthReport(
        [result("broken", "https://a.example/"), result("timeout", "https://b.example/")],
        0,
      ),
    );
    expect(text).toContain("2 links need attention.");
  });
});
