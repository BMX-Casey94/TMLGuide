// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  SITE_JSONLD_DESCRIPTION,
  SITE_NAME,
  serialiseJsonLd,
  webPageJsonLd,
  websiteJsonLd,
} from "./json-ld";
import { SITE_URL_FALLBACK } from "./routes";
import { oldestVerifiedOn, verifiedDates } from "./verified-on";

describe("websiteJsonLd", () => {
  const markup = websiteJsonLd();

  it("names the site TMLGuide", () => {
    expect(markup.name).toBe("TMLGuide");
    expect(SITE_NAME).toBe("TMLGuide");
  });

  it("describes a WebSite at the site root", () => {
    expect(markup["@context"]).toBe("https://schema.org");
    expect(markup["@type"]).toBe("WebSite");
    expect(markup.url).toBe(`${SITE_URL_FALLBACK}/`);
  });

  it("declares the page language", () => {
    expect(markup.inLanguage).toBe("en-GB");
  });

  it("carries a description", () => {
    expect(markup.description).toBe(SITE_JSONLD_DESCRIPTION);
    expect(markup.description.length).toBeGreaterThan(40);
  });

  it("claims no organisation, because there is not one", () => {
    const json = JSON.stringify(markup);
    expect(json).not.toContain("Organization");
    expect(json).not.toContain("publisher");
    expect(json).not.toContain("founder");
  });

  it("advertises no search action until search is wired", () => {
    const json = JSON.stringify(markup);
    expect(json).not.toContain("SearchAction");
    expect(json).not.toContain("potentialAction");
  });

  it("does not claim a logo, because the JSON-LD is not where brand assets are asserted", () => {
    expect(JSON.stringify(markup)).not.toContain("logo");
  });
});

describe("webPageJsonLd", () => {
  const markup = webPageJsonLd("/about", "About this guide", "Description.");

  it("describes the page at its own path", () => {
    expect(markup["@type"]).toBe("WebPage");
    expect(markup.url).toBe(`${SITE_URL_FALLBACK}/about`);
    expect(markup.name).toBe("About this guide");
  });

  it("ties the page back to the site node by name and URL", () => {
    expect(markup.isPartOf["@type"]).toBe("WebSite");
    expect(markup.isPartOf.name).toBe("TMLGuide");
    expect(markup.isPartOf.url).toBe(`${SITE_URL_FALLBACK}/`);
  });

  it("claims no organisation", () => {
    expect(JSON.stringify(markup)).not.toContain("Organization");
  });
});

describe("serialiseJsonLd", () => {
  it("produces JSON a script element can hold", () => {
    expect(JSON.parse(serialiseJsonLd({ a: 1 }))).toEqual({ a: 1 });
  });

  it("escapes a closing script tag so the element cannot end early", () => {
    const serialised = serialiseJsonLd({ name: "</script><img src=x onerror=alert(1)>" });
    expect(serialised).not.toContain("</script>");
    expect(serialised).toContain("\\u003c");
  });

  it("escapes an ampersand", () => {
    expect(serialiseJsonLd({ name: "A & B" })).toContain("\\u0026");
  });

  it("round-trips the escaped text back to the original value", () => {
    const value = { name: "</script> & more" };
    expect(JSON.parse(serialiseJsonLd(value))).toEqual(value);
  });
});

describe("oldestVerifiedOn", () => {
  it("returns the oldest date in the list", () => {
    expect(oldestVerifiedOn(["2026-11-18", "2026-11-17", "2026-11-18"])).toBe("2026-11-17");
  });

  it("returns the only date when there is one", () => {
    expect(oldestVerifiedOn(["2026-11-18"])).toBe("2026-11-18");
  });

  it("refuses an empty list rather than inventing a date", () => {
    expect(() => oldestVerifiedOn([])).toThrow(/no verification dates/);
  });

  it("reads a real date out of the site's data", () => {
    const dates = verifiedDates();
    expect(dates.length).toBeGreaterThan(10);
    expect(oldestVerifiedOn(dates)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("gives the page a date the site can stand behind", () => {
    // Every record the home and About pages render was verified on or before this
    // date, so the "checked on" line can never be newer than the facts behind it.
    const oldest = oldestVerifiedOn(verifiedDates());
    for (const date of verifiedDates()) {
      expect(date >= oldest).toBe(true);
    }
  });
});
