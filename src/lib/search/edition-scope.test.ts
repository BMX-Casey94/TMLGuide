import { describe, expect, it } from "vitest";
import { editionFromPath, parseEdition, resolveSearchEdition } from "./edition-scope";

describe("editionFromPath", () => {
  it("reads the edition from the tickets page query", () => {
    expect(editionFromPath("/guides/tickets", "?edition=winter")).toBe("winter");
    expect(editionFromPath("/guides/tickets", "?edition=brasil")).toBe("brasil");
    expect(editionFromPath("/guides/tickets", "?edition=belgium")).toBe("belgium");
  });

  it("treats the bare tickets page as Belgium, its default view", () => {
    expect(editionFromPath("/guides/tickets", "")).toBe("belgium");
    expect(editionFromPath("/guides/tickets", "?")).toBe("belgium");
  });

  it("ignores an unrecognised edition rather than trusting the query string", () => {
    expect(editionFromPath("/guides/tickets", "?edition=thailand")).toBeNull();
    expect(editionFromPath("/guides/tickets", "?edition=")).toBeNull();
  });

  it("returns null on every other route", () => {
    for (const pathname of ["/", "/guides", "/tools", "/community", "/radio", "/about"]) {
      expect(editionFromPath(pathname, "?edition=winter"), pathname).toBeNull();
    }
  });

  it("does not match a route that merely starts with the tickets path", () => {
    expect(editionFromPath("/guides/tickets-old", "?edition=winter")).toBeNull();
  });

  it("ignores unrelated query parameters", () => {
    expect(editionFromPath("/guides/tickets", "?category=dreamville&edition=winter")).toBe("winter");
  });
});

describe("resolveSearchEdition", () => {
  it("prefers the address over the visitor's stored choice", () => {
    expect(
      resolveSearchEdition({
        pathname: "/guides/tickets",
        search: "?edition=winter",
        bodyEdition: "brasil",
      }),
    ).toBe("winter");
  });

  it("falls back to the edition selected in the shell", () => {
    expect(
      resolveSearchEdition({ pathname: "/tools", search: "", bodyEdition: "brasil" }),
    ).toBe("brasil");
  });

  it("returns null when neither is known, which means no boost at all", () => {
    expect(resolveSearchEdition({ pathname: "/tools", search: "" })).toBeNull();
    expect(
      resolveSearchEdition({ pathname: "/tools", search: "", bodyEdition: "atlantis" }),
    ).toBeNull();
    expect(
      resolveSearchEdition({ pathname: "/tools", search: "", bodyEdition: null }),
    ).toBeNull();
  });
});

describe("parseEdition", () => {
  it("accepts the three editions", () => {
    expect(parseEdition("belgium")).toBe("belgium");
    expect(parseEdition("winter")).toBe("winter");
    expect(parseEdition("brasil")).toBe("brasil");
  });

  it("refuses anything else, including casing variants", () => {
    expect(parseEdition("Belgium")).toBeNull();
    expect(parseEdition("all")).toBeNull();
    expect(parseEdition("")).toBeNull();
    expect(parseEdition(null)).toBeNull();
    expect(parseEdition(undefined)).toBeNull();
  });
});
