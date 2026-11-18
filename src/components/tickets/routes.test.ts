import { describe, expect, it } from "vitest";
import {
  DEFAULT_TICKET_EDITION,
  buildTicketHref,
  isTicketEdition,
  parseEdition,
  parseSlug,
  parseTicketView,
} from "./routes";

describe("isTicketEdition", () => {
  it("accepts the three covered editions", () => {
    expect(isTicketEdition("belgium")).toBe(true);
    expect(isTicketEdition("winter")).toBe(true);
    expect(isTicketEdition("brasil")).toBe(true);
  });

  it("rejects anything else, including a case variant", () => {
    expect(isTicketEdition("Belgium")).toBe(false);
    expect(isTicketEdition("thailand")).toBe(false);
    expect(isTicketEdition("")).toBe(false);
    expect(isTicketEdition(undefined)).toBe(false);
    expect(isTicketEdition(3)).toBe(false);
  });
});

describe("parseEdition", () => {
  it("reads a known edition", () => {
    expect(parseEdition("winter")).toBe("winter");
  });

  it("falls back to Belgium when the parameter is absent", () => {
    expect(parseEdition(undefined)).toBe(DEFAULT_TICKET_EDITION);
  });

  it("falls back rather than 404ing on a mistyped edition", () => {
    // A link with a typo should still land on a useful page.
    expect(parseEdition("belgum")).toBe(DEFAULT_TICKET_EDITION);
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseEdition(["brasil", "winter"])).toBe("brasil");
  });

  it("ignores an empty value", () => {
    expect(parseEdition("")).toBe(DEFAULT_TICKET_EDITION);
  });
});

describe("parseSlug", () => {
  it("returns a trimmed slug", () => {
    expect(parseSlug("  dreamville  ")).toBe("dreamville");
  });

  it("treats an empty or whitespace value as absent", () => {
    expect(parseSlug("")).toBeUndefined();
    expect(parseSlug("   ")).toBeUndefined();
    expect(parseSlug(undefined)).toBeUndefined();
  });

  it("uses the first value of a repeated parameter", () => {
    expect(parseSlug(["a", "b"])).toBe("a");
  });
});

describe("parseTicketView", () => {
  it("defaults to the Belgium landing view", () => {
    expect(parseTicketView({})).toEqual({ edition: "belgium" });
  });

  it("reads a category without a package", () => {
    expect(parseTicketView({ edition: "belgium", category: "dreamville" })).toEqual({
      edition: "belgium",
      category: "dreamville",
    });
  });

  it("reads a package inside its category", () => {
    expect(
      parseTicketView({ edition: "belgium", category: "dreamville", package: "easy-tent-2p" }),
    ).toEqual({ edition: "belgium", category: "dreamville", package: "easy-tent-2p" });
  });

  it("drops a package that arrives without a category", () => {
    // The drill-down has no meaning without its parent, so the orphan is ignored
    // rather than rendering a detail view with no breadcrumb above it.
    expect(parseTicketView({ package: "easy-tent-2p" })).toEqual({ edition: "belgium" });
  });

  it("treats an empty category as absent, so an empty package goes too", () => {
    expect(parseTicketView({ category: "", package: "easy-tent-2p" })).toEqual({
      edition: "belgium",
    });
  });
});

describe("buildTicketHref", () => {
  it("omits the default edition so the landing page is bare", () => {
    expect(buildTicketHref({})).toBe("/guides/tickets");
    expect(buildTicketHref({ edition: "belgium" })).toBe("/guides/tickets");
  });

  it("includes a non-default edition", () => {
    expect(buildTicketHref({ edition: "winter" })).toBe("/guides/tickets?edition=winter");
  });

  it("includes a category", () => {
    expect(buildTicketHref({ edition: "belgium", category: "montagoe" })).toBe(
      "/guides/tickets?category=montagoe",
    );
  });

  it("includes a package with its category", () => {
    expect(
      buildTicketHref({ edition: "belgium", category: "montagoe", package: "belgium-2027-luna-2p" }),
    ).toBe("/guides/tickets?category=montagoe&package=belgium-2027-luna-2p");
  });

  it("never emits a package without a category", () => {
    expect(buildTicketHref({ package: "orphan" })).toBe("/guides/tickets");
  });

  it("keeps the edition in a package link", () => {
    expect(buildTicketHref({ edition: "brasil", category: "dreamville", package: "easy-tent-2p" })).toBe(
      "/guides/tickets?edition=brasil&category=dreamville&package=easy-tent-2p",
    );
  });

  it("encodes a value so it cannot escape the query string", () => {
    const href = buildTicketHref({ category: "a&b=c#d" });
    expect(href).toBe("/guides/tickets?category=a%26b%3Dc%23d");
    // Round-tripping proves it is still a single readable parameter.
    expect(new URL(href, "https://example.com").searchParams.get("category")).toBe("a&b=c#d");
  });
});

describe("round trip", () => {
  it("parses a URL that buildTicketHref produced", () => {
    const href = buildTicketHref({
      edition: "brasil",
      category: "festival-tickets",
      package: "full-madness",
    });
    const search = new URL(href, "https://example.com").searchParams;
    const params: Record<string, string> = {};
    search.forEach((value, key) => {
      params[key] = value;
    });

    expect(parseTicketView(params)).toEqual({
      edition: "brasil",
      category: "festival-tickets",
      package: "full-madness",
    });
  });
});
