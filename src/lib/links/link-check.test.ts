// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CLASSIFICATIONS,
  PROBLEM_CLASSIFICATIONS,
  USER_AGENT,
  classifyStatus,
  decodeHtmlEntities,
  inspectUrl,
  isPrivateHost,
  parseWhatsappInvite,
} from "../../../scripts/lib/link-check.mjs";

describe("USER_AGENT", () => {
  it("identifies the checker and offers a contact route", () => {
    expect(USER_AGENT).toContain("TMLGuideLinkCheck/1.0");
    expect(USER_AGENT).toContain("independent fan guide");
  });

  it("only reports classifications the report knows how to render", () => {
    for (const classification of PROBLEM_CLASSIFICATIONS) {
      expect(CLASSIFICATIONS).toContain(classification);
    }
    expect(CLASSIFICATIONS).not.toContain("unknown");
  });
});

describe("isPrivateHost", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "app.localhost",
    "printer.local",
    "metadata.google.internal",
    "127.0.0.1",
    "127.1.2.3",
    "10.0.0.1",
    "10.255.255.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "192.0.2.10",
    "198.51.100.7",
    "203.0.113.9",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "fc00::abcd",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:192.168.0.5",
    "64:ff9b::10.0.0.1",
    "2001:db8::1",
    "2130706433",
    "127.000.000.001",
  ])("treats %j as private or reserved", (host) => {
    expect(isPrivateHost(host)).toBe(true);
  });

  it.each([
    "example.com",
    "chat.whatsapp.com",
    "www.tomorrowland.com",
    "8.8.8.8",
    "1.1.1.1",
    "172.15.0.1",
    "172.32.0.1",
    "192.169.0.1",
    "11.0.0.1",
    "2001:4860:4860::8888",
    "2a00:1450:4009:81f::200e",
  ])("treats %j as public", (host) => {
    expect(isPrivateHost(host)).toBe(false);
  });

  it("refuses an empty host and strips IPv6 brackets and a trailing dot", () => {
    expect(isPrivateHost("")).toBe(true);
    expect(isPrivateHost(null)).toBe(true);
    expect(isPrivateHost("[::1]")).toBe(true);
    expect(isPrivateHost("example.com.")).toBe(false);
  });

  it("refuses a malformed IPv6 literal rather than guessing it is public", () => {
    expect(isPrivateHost("::gggg")).toBe(true);
    expect(isPrivateHost("1:2:3:4:5:6:7:8:9")).toBe(true);
  });
});

describe("inspectUrl", () => {
  it("accepts a normal https URL", () => {
    const result = inspectUrl("https://chat.whatsapp.com/abc123");
    expect(result.safe).toBe(true);
    expect(result.url?.hostname).toBe("chat.whatsapp.com");
  });

  it("accepts a plain http URL, so the checker can report it as insecure", () => {
    expect(inspectUrl("http://festivalviewer.com/tomorrowland/tickets").safe).toBe(true);
  });

  it.each([
    ["javascript:alert(1)", "unsupported scheme"],
    ["data:text/plain,https://example.com", "unsupported scheme"],
    ["ftp://example.com/file", "unsupported scheme"],
    ["file:///C:/Windows/win.ini", "unsupported scheme"],
    ["not a url", "not a valid absolute URL"],
    ["/relative/path", "not a valid absolute URL"],
    ["", "missing url"],
    [null, "missing url"],
    ["https://user:secret@example.com/", "URL embeds credentials"],
    ["http://127.0.0.1/admin", "private or reserved"],
    ["http://169.254.169.254/latest/meta-data/", "private or reserved"],
    ["https://localhost:8443/", "private or reserved"],
    ["https://example.com:22/", "port 22 is not allowed"],
  ])("refuses %j", (rawUrl, reasonFragment) => {
    const result = inspectUrl(rawUrl);
    expect(result.safe).toBe(false);
    expect(result.reason).toContain(reasonFragment);
  });
});

describe("classifyStatus", () => {
  it("marks a clean 200 as ok", () => {
    expect(classifyStatus({ httpStatus: 200 })).toEqual({ classification: "ok", note: "200 — OK" });
  });

  it("marks a followed redirect as redirected and counts the hops", () => {
    expect(classifyStatus({ httpStatus: 200, redirects: 1 }).classification).toBe("redirected");
    expect(classifyStatus({ httpStatus: 200, redirects: 2 }).note).toContain("2 redirects");
  });

  it.each([404, 410])("marks %i as dead", (status) => {
    expect(classifyStatus({ httpStatus: status }).classification).toBe("dead");
  });

  it.each([401, 403, 429, 451])("marks %i as blocked", (status) => {
    expect(classifyStatus({ httpStatus: status }).classification).toBe("blocked");
  });

  it.each([400, 418, 422])("marks %i as dead", (status) => {
    expect(classifyStatus({ httpStatus: status }).classification).toBe("dead");
  });

  it.each([500, 502, 503])("marks %i as unreachable", (status) => {
    expect(classifyStatus({ httpStatus: status }).classification).toBe("unreachable");
  });

  it("treats a 3xx with no usable location as unreachable", () => {
    expect(classifyStatus({ httpStatus: 302 }).classification).toBe("unreachable");
  });

  it("marks a bot challenge on a 200 page as blocked", () => {
    expect(classifyStatus({ httpStatus: 200, challenge: true }).classification).toBe("blocked");
  });

  it("lets a transport error outrank the http scheme, so a dead host is dead", () => {
    expect(classifyStatus({ error: { code: "ENOTFOUND" }, insecure: true })).toEqual({
      classification: "dead",
      note: "DNS lookup failed (ENOTFOUND) — the host no longer resolves",
    });
    expect(classifyStatus({ error: { code: "ETIMEDOUT" }, insecure: true }).classification).toBe("unreachable");
    expect(classifyStatus({ error: { code: "ECONNREFUSED" } }).classification).toBe("unreachable");
    expect(classifyStatus({ error: { code: "CERT_HAS_EXPIRED" } }).note).toContain("TLS failure");
    expect(classifyStatus({ error: { code: "ECONNRESET" } }).note).toContain("network error");
  });

  it("marks any http URL insecure even when the server answered", () => {
    const verdict = classifyStatus({ httpStatus: 200, insecure: true });
    expect(verdict.classification).toBe("insecure");
    expect(verdict.note).toContain("plain http://");
  });

  it("records the https destination a http URL settles on", () => {
    const verdict = classifyStatus({
      httpStatus: 200,
      insecure: true,
      redirects: 1,
      requestedUrl: "http://example.com/",
      finalUrl: "https://example.com/",
    });
    expect(verdict.classification).toBe("insecure");
    expect(verdict.note).toContain("https://example.com/");
  });

  it("reports a missing response as unreachable", () => {
    expect(classifyStatus({}).classification).toBe("unreachable");
    expect(classifyStatus().classification).toBe("unreachable");
  });

  it("never invents an ok verdict for an unknown status", () => {
    for (const httpStatus of [0, 199, 600]) {
      expect(classifyStatus({ httpStatus }).classification).not.toBe("ok");
    }
  });
});

describe("decodeHtmlEntities", () => {
  it("decodes named and numeric entities found in page metadata", () => {
    expect(decodeHtmlEntities("Solo &amp; Group")).toBe("Solo & Group");
    expect(decodeHtmlEntities("&#x2728;&#x1f308;")).toBe("✨🌈");
    expect(decodeHtmlEntities("&#39;")).toBe("'");
  });

  it("leaves unknown entities and bare ampersands alone", () => {
    expect(decodeHtmlEntities("A &amp; B &unknown; C & D")).toBe("A & B &unknown; C & D");
  });
});

describe("parseWhatsappInvite", () => {
  const activePage = `<!DOCTYPE html><html><head>
    <title>WhatsApp Group Invite</title>
    <meta property="og:title" content="TML - W2 - Solo &amp; Group Travellers &#x2728;" />
  </head><body>
    <div>You’ve been invited to join<br />“TML - W2 - Solo &amp; Group Travellers ✨”</div>
  </body></html>`;

  const revokedPage = `<!DOCTYPE html><html><head>
    <title>WhatsApp Group Invite</title>
    <meta property="og:title" content="" />
  </head><body>
    <div>You’ve been invited to join<br />“”</div>
  </body></html>`;

  const explicitRevokedPage = `<html><head><title>WhatsApp Group Invite</title></head>
    <body><p>This invite link is invalid or has been revoked.</p></body></html>`;

  it("reads the group name from the invite body of an active invite", () => {
    const result = parseWhatsappInvite(activePage);
    expect(result.state).toBe("active");
    expect(result.groupName).toBe("TML - W2 - Solo & Group Travellers ✨");
    expect(result.evidence).toBe("group name in invite page body");
  });

  it("falls back to og:title when the body carries no invite sentence", () => {
    const result = parseWhatsappInvite(
      `<html><head><meta property="og:title" content="TML - ADE - Netherlands" /></head><body></body></html>`,
    );
    expect(result.state).toBe("active");
    expect(result.groupName).toBe("TML - ADE - Netherlands");
    expect(result.evidence).toBe("group name in og:title");
  });

  it("reads og:title whichever order the attributes appear in", () => {
    const result = parseWhatsappInvite(
      `<html><head><meta content="TML - Winter" property="og:title" /></head></html>`,
    );
    expect(result.state).toBe("active");
    expect(result.groupName).toBe("TML - Winter");
  });

  it("calls a generic invite shell with no group name invalid", () => {
    const result = parseWhatsappInvite(revokedPage);
    expect(result.state).toBe("invalid");
    expect(result.groupName).toBeNull();
    expect(result.evidence).toContain("generic invite page with no group name");
  });

  it("believes an explicit revocation notice over any name on the page", () => {
    const result = parseWhatsappInvite(explicitRevokedPage);
    expect(result.state).toBe("invalid");
    expect(result.evidence).toContain("invite link is invalid or has been revoked");
  });

  it("treats a generic WhatsApp title as no group name, not as a group", () => {
    const result = parseWhatsappInvite(
      `<html><head><title>WhatsApp Group Invite</title><meta property="og:title" content="WhatsApp Group Invite" /></head></html>`,
    );
    expect(result.state).toBe("invalid");
  });

  it("declines to guess when the page is not an invite page at all", () => {
    const result = parseWhatsappInvite(`<html><head><title>Example Domain</title></head><body>hi</body></html>`);
    expect(result.state).toBe("unknown");
    expect(result.evidence).toBe("no invite metadata found on the page");
  });

  it("reports an empty body as unknown rather than active", () => {
    expect(parseWhatsappInvite("").state).toBe("unknown");
    expect(parseWhatsappInvite(undefined).state).toBe("unknown");
  });

  it("never returns a group name for an invalid invite", () => {
    for (const page of [revokedPage, explicitRevokedPage]) {
      const result = parseWhatsappInvite(page);
      expect(result.state).toBe("invalid");
      expect(result.groupName).toBeNull();
    }
  });
});
