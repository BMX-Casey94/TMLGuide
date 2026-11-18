import { describe, expect, it } from "vitest";
import { whatsappGroups } from "@/data/community";
import { whatsappRegionOptions } from "./whatsapp-filter";
import {
  MAX_QUERY_LENGTH,
  parseEditionFilter,
  parseRegionFilter,
  parseWhatsappFilters,
  serialiseWhatsappFilters,
  whatsappFilterHref,
} from "./whatsapp-query";

const REGIONS = whatsappRegionOptions(whatsappGroups);
const DEFAULTS = { q: "", edition: "any" as const, region: null };

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parseEditionFilter", () => {
  it("defaults to any when the parameter is absent or empty", () => {
    expect(parseEditionFilter(null)).toBe("any");
    expect(parseEditionFilter("")).toBe("any");
  });

  it("accepts each published edition value", () => {
    for (const value of ["belgium", "winter", "brasil", "all"] as const) {
      expect(parseEditionFilter(value)).toBe(value);
    }
  });

  it("drops an unknown edition rather than filtering by it", () => {
    expect(parseEditionFilter("thailand")).toBe("any");
    expect(parseEditionFilter("ANY")).toBe("any");
  });
});

describe("parseRegionFilter", () => {
  it("defaults to null for absent or blank values", () => {
    expect(parseRegionFilter(null, REGIONS)).toBeNull();
    expect(parseRegionFilter("", REGIONS)).toBeNull();
  });

  it("accepts a region the data publishes", () => {
    expect(parseRegionFilter("Alpe d'Huez, France", REGIONS)).toBe("Alpe d'Huez, France");
  });

  it("drops a region the data does not publish, which could only ever be empty", () => {
    expect(parseRegionFilter("Atlantis", REGIONS)).toBeNull();
  });

  it("is case sensitive on purpose, because the value comes from our own select", () => {
    expect(parseRegionFilter("worldwide", REGIONS)).toBeNull();
  });
});

describe("parseWhatsappFilters", () => {
  it("reads every key", () => {
    const filters = parseWhatsappFilters(
      params("q=dream&edition=belgium&region=DreamVille%2C%20Boom%2C%20Belgium"),
      REGIONS,
    );
    expect(filters).toEqual({
      q: "dream",
      edition: "belgium",
      region: "DreamVille, Boom, Belgium",
    });
  });

  it("returns the defaults for an empty query string", () => {
    expect(parseWhatsappFilters(params(""), REGIONS)).toEqual(DEFAULTS);
  });

  it("ignores unrelated parameters", () => {
    expect(parseWhatsappFilters(params("utm_source=chat&q=tent"), REGIONS).q).toBe("tent");
  });

  it("truncates an over-long query instead of accepting it whole", () => {
    const long = "a".repeat(MAX_QUERY_LENGTH + 50);
    expect(parseWhatsappFilters(params(`q=${long}`), REGIONS).q).toHaveLength(MAX_QUERY_LENGTH);
  });

  it("falls back to the defaults for a hand-edited URL with bad values", () => {
    const filters = parseWhatsappFilters(params("edition=atlantis&region=Atlantis"), REGIONS);
    expect(filters).toEqual(DEFAULTS);
  });

  it("decodes percent-encoded values, emoji included", () => {
    const filters = parseWhatsappFilters(params(`q=${encodeURIComponent("⛺️ camp")}`), REGIONS);
    expect(filters.q).toBe("⛺️ camp");
  });
});

describe("serialiseWhatsappFilters", () => {
  it("writes nothing for the default state, so the URL stays clean", () => {
    expect(serialiseWhatsappFilters(DEFAULTS)).toBe("");
  });

  it("omits blank and default values while keeping the set ones", () => {
    expect(serialiseWhatsappFilters({ q: "  ", edition: "any", region: null })).toBe("");
    expect(serialiseWhatsappFilters({ q: "tent", edition: "any", region: null })).toBe("q=tent");
  });

  it("trims the query so trailing spaces do not produce a different URL", () => {
    expect(serialiseWhatsappFilters({ q: " tent ", edition: "any", region: null })).toBe("q=tent");
  });

  it("orders keys, so the same filters always give the same string", () => {
    const a = serialiseWhatsappFilters({ q: "x", edition: "winter", region: "Worldwide" });
    const b = serialiseWhatsappFilters({ region: "Worldwide", edition: "winter", q: "x" });
    expect(a).toBe(b);
    expect(a).toBe("edition=winter&q=x&region=Worldwide");
  });

  it("escapes characters that would break the query string", () => {
    const query = serialiseWhatsappFilters({ q: "a&b=c", edition: "any", region: null });
    expect(query).toBe("q=a%26b%3Dc");
    expect(new URLSearchParams(query).get("q")).toBe("a&b=c");
  });

  it("round-trips through the parser", () => {
    const filters = { q: "easy tent ⛺️", edition: "belgium" as const, region: "DreamVille, Boom, Belgium" };
    expect(parseWhatsappFilters(params(serialiseWhatsappFilters(filters)), REGIONS)).toEqual(filters);
  });
});

describe("whatsappFilterHref", () => {
  it("returns the bare path when nothing is filtered", () => {
    expect(whatsappFilterHref("/community", DEFAULTS)).toBe("/community");
  });

  it("appends the query when filters are set", () => {
    expect(whatsappFilterHref("/community", { q: "tent", edition: "any", region: null })).toBe(
      "/community?q=tent",
    );
  });
});
