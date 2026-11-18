// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ACCOUNTED_HOSTS,
  OFFICIAL_HOST_ROLES,
  citedSourceUrls,
  hostOf,
  isOfficialHost,
  officialHostsCited,
  unlistedOfficialHosts,
} from "./source-hosts";

describe("hostOf", () => {
  it("reads a bare hostname", () => {
    expect(hostOf("https://belgium.tomorrowland.com/en/tickets/")).toBe("belgium.tomorrowland.com");
  });

  it("lowercases the host, so two spellings compare equal", () => {
    expect(hostOf("https://FAQ.Tomorrowland.com/hc")).toBe("faq.tomorrowland.com");
  });

  it("drops the port and the query", () => {
    expect(hostOf("https://example.com:8443/path?q=1#x")).toBe("example.com");
  });

  it("returns null for a value that is not a URL", () => {
    expect(hostOf("not a url")).toBeNull();
    expect(hostOf("")).toBeNull();
  });
});

describe("isOfficialHost", () => {
  it("accepts Tomorrowland's own domains and their subdomains", () => {
    expect(isOfficialHost("tomorrowland.com")).toBe(true);
    expect(isOfficialHost("belgium.tomorrowland.com")).toBe(true);
    expect(isOfficialHost("press.brasil.tomorrowland.com")).toBe(true);
    expect(isOfficialHost("faq.tomorrowlandwinter.com")).toBe(true);
    expect(isOfficialHost("tomorrowlandbrasil.zendesk.com")).toBe(true);
  });

  it("rejects an operator or community host", () => {
    expect(isOfficialHost("parquemaeda.com.br")).toBe(false);
    expect(isOfficialHost("chat.whatsapp.com")).toBe(false);
    expect(isOfficialHost("skipass.alpedhuez.com")).toBe(false);
  });

  it("rejects a host that merely contains the name", () => {
    expect(isOfficialHost("tomorrowland.com.evil.example")).toBe(false);
    expect(isOfficialHost("nottomorrowland.com")).toBe(false);
    expect(isOfficialHost("tomorrowland-fans.example")).toBe(false);
    expect(isOfficialHost("faketomorrowlandbrasil.com")).toBe(false);
  });
});

describe("officialHostsCited", () => {
  it("returns each host once, sorted, and ignores non-official ones", () => {
    const hosts = officialHostsCited([
      "https://belgium.tomorrowland.com/en/",
      "https://belgium.tomorrowland.com/en/tickets/",
      "https://faq.tomorrowland.com/hc/en-us",
      "https://parquemaeda.com.br/contato/",
      "https://chat.whatsapp.com/abc",
    ]);

    expect(hosts).toEqual(["belgium.tomorrowland.com", "faq.tomorrowland.com"]);
  });

  it("returns nothing for an empty list", () => {
    expect(officialHostsCited([])).toEqual([]);
  });
});

describe("the About page's host table", () => {
  it("lists every host exactly once", () => {
    const hosts = OFFICIAL_HOST_ROLES.map((entry) => entry.host);
    expect(new Set(hosts).size).toBe(hosts.length);
  });

  it("gives every host a role", () => {
    for (const entry of OFFICIAL_HOST_ROLES) {
      expect(entry.role.trim().length).toBeGreaterThan(0);
      expect(isOfficialHost(entry.host)).toBe(true);
    }
  });

  it("covers every official host the data actually cites", () => {
    // A citation to a Tomorrowland host that is not in the table fails here, so
    // the page cannot fall behind the data it describes.
    expect(unlistedOfficialHosts(citedSourceUrls())).toEqual([]);
  });

  it("does not list a host the data never cites", () => {
    const cited = new Set(officialHostsCited(citedSourceUrls()));
    const unused = ACCOUNTED_HOSTS.filter((host) => !cited.has(host));
    expect(unused).toEqual([]);
  });

  it("has at least one citation per listed host, so no row is decorative", () => {
    const urls = citedSourceUrls();
    expect(urls.length).toBeGreaterThan(50);
    for (const entry of OFFICIAL_HOST_ROLES) {
      expect(urls.some((url) => hostOf(url) === entry.host)).toBe(true);
    }
  });
});
