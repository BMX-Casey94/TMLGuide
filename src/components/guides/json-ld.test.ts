// @vitest-environment node
import { describe, expect, it } from "vitest";
import { breadcrumbListJsonLd, serialiseJsonLd } from "./json-ld";

describe("breadcrumb structured data", () => {
  it("numbers positions from 1 in the order given", () => {
    const payload = breadcrumbListJsonLd([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Belgium", path: "/guides/belgium" },
    ]);

    expect(payload["@context"]).toBe("https://schema.org");
    expect(payload["@type"]).toBe("BreadcrumbList");
    expect(payload.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: "/guides" },
      { "@type": "ListItem", position: 3, name: "Belgium", item: "/guides/belgium" },
    ]);
  });

  it("produces nothing but the breadcrumb, so no offer or article can creep in", () => {
    const serialised = serialiseJsonLd(
      breadcrumbListJsonLd([{ name: "Home", path: "/" }]),
    );

    expect(serialised).not.toContain("Product");
    expect(serialised).not.toContain("Offer");
    expect(serialised).not.toContain("Article");
    expect(serialised).not.toContain("price");
  });
});

describe("serialisation", () => {
  it("escapes < so a string cannot close the script element", () => {
    const serialised = serialiseJsonLd({ name: "</script><script>alert(1)</script>" });

    expect(serialised).not.toContain("</script");
    expect(serialised).toContain("\\u003c");
    // The escaping is lossless: parsing it back gives the original string.
    expect(JSON.parse(serialised)).toEqual({ name: "</script><script>alert(1)</script>" });
  });

  it("escapes & as well", () => {
    expect(serialiseJsonLd({ name: "rock & roll" })).toContain("\\u0026");
  });

  it("round-trips an ordinary object unchanged", () => {
    const value = { "@type": "BreadcrumbList", itemListElement: [{ position: 1, name: "Home" }] };
    expect(JSON.parse(serialiseJsonLd(value))).toEqual(value);
  });
});
