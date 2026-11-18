import { describe, expect, it } from "vitest";
import { faqs as belgiumFaqs } from "@/data/belgium";
import { winterFaqs } from "@/data/winter";
import { sharedData } from "@/data/shared";
import { communityData } from "@/data/community";
import { brasilData } from "@/data/brasil";
import { accommodationEntries } from "./accommodation";
import { partnerEntries, resourceEntries, whatsappEntries } from "./community";
import { editionEntries } from "./editions";
import { faqEntries, plainMarkdown } from "./faqs";
import { pageEntries } from "./pages";
import { saleEntries } from "./sales";
import { ticketEntries } from "./tickets";
import { editionYear, joinSnippet, stripEmoji } from "./types";

/**
 * The source modules are where the data files are turned into rows. These tests
 * are about coverage and fidelity: every record in, one row out, with no figure
 * invented and no currency converted.
 */

describe("editionYear", () => {
  it("reads the year of the next edition from the overview", () => {
    expect(editionYear("belgium")).toBe(2027);
    expect(editionYear("winter")).toBe(2027);
    expect(editionYear("brasil")).toBe(2027);
  });
});

describe("joinSnippet", () => {
  it("joins the non-empty parts with a middot", () => {
    expect(joinSnippet(["a", undefined, "", "  ", "b"])).toBe("a · b");
  });

  it("returns an empty string when there is nothing to join", () => {
    expect(joinSnippet([undefined, ""])).toBe("");
  });

  it("trims each part", () => {
    expect(joinSnippet([" a ", " b "])).toBe("a · b");
  });
});

describe("stripEmoji", () => {
  it("removes pictographs and variation selectors", () => {
    expect(stripEmoji("Solo & Group Travellers ✨✈️")).toBe("Solo & Group Travellers");
    expect(stripEmoji("DreamVille (MG) - W1 Group Camp ⛺️")).toBe("DreamVille (MG) - W1 Group Camp");
  });

  it("keeps the flag-free text and does not double a space", () => {
    expect(stripEmoji("Tickets (Exchange/Swap/Advice) 🎟️📷")).toBe(
      "Tickets (Exchange/Swap/Advice)",
    );
  });
});

describe("pageEntries", () => {
  it("covers every route the brief names", () => {
    const hrefs = pageEntries.map((entry) => entry.href);
    expect(hrefs).toEqual([
      "/",
      "/guides",
      "/guides/tickets",
      "/tools",
      "/tools/budget",
      "/tools/pearls",
      "/tools/sale-timeline",
      "/community",
      "/radio",
      "/about",
    ]);
  });

  it("has a unique slug for every page", () => {
    const slugs = pageEntries.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("claims no verification date, because a page is not a fact", () => {
    for (const entry of pageEntries) {
      expect(entry.lastVerified).toBeUndefined();
      expect(entry.sourceUrl).toBeUndefined();
    }
  });
});

describe("ticketEntries", () => {
  it("covers every record in all three editions", () => {
    // Brasil has no tier pairing, so its rows equal its record count; Belgium
    // and Winter pair sale tiers, so their rows are fewer than their records.
    const belgiumRows = ticketEntries.filter((entry) => entry.edition === "belgium");
    const winterRows = ticketEntries.filter((entry) => entry.edition === "winter");
    const brasilRows = ticketEntries.filter((entry) => entry.edition === "brasil");

    expect(belgiumRows.length).toBeGreaterThan(0);
    expect(winterRows.length).toBeGreaterThan(0);
    expect(brasilRows.length).toBe(brasilData.tickets.length);
  });

  it("puts both Belgium sale tiers on one row", () => {
    const dayPass = ticketEntries.find(
      (entry) => entry.edition === "belgium" && entry.title === "Day Pass",
    );
    expect(dayPass?.snippet).toContain("€144.00 pre-sale");
    expect(dayPass?.snippet).toContain("€159.00 WorldWide sale");
  });

  it("prices Brasil in reais only", () => {
    for (const entry of ticketEntries.filter((candidate) => candidate.edition === "brasil")) {
      expect(entry.snippet).toContain("R$");
      expect(entry.snippet).not.toContain("€");
    }
  });

  it("prices Belgium and Winter in euros only", () => {
    for (const entry of ticketEntries.filter((candidate) => candidate.edition !== "brasil")) {
      expect(entry.snippet).toContain("€");
      expect(entry.snippet).not.toMatch(/R\$/);
    }
  });

  it("does not invent a tier label for a product with only one price", () => {
    const winter = ticketEntries.find((entry) => entry.edition === "winter");
    expect(winter?.snippet).toContain("€735.00");
    expect(winter?.snippet).not.toContain("single");
    expect(winter?.snippet).not.toContain("undefined");
  });

  it("gives every row a unique slug", () => {
    const slugs = ticketEntries.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("sends each edition to its own view of the tickets page", () => {
    for (const entry of ticketEntries) {
      if (entry.edition === "belgium") expect(entry.href).toBe("/guides/tickets");
      if (entry.edition === "winter") expect(entry.href).toBe("/guides/tickets?edition=winter");
      if (entry.edition === "brasil") expect(entry.href).toBe("/guides/tickets?edition=brasil");
    }
  });
});

describe("accommodationEntries", () => {
  it("covers Belgium's DreamVille packages and Brasil's campsite packages", () => {
    expect(
      accommodationEntries.filter((entry) => entry.edition === "belgium").length,
    ).toBeGreaterThan(0);
    expect(accommodationEntries.filter((entry) => entry.edition === "brasil").length).toBe(
      brasilData.dreamvillePackages.length,
    );
  });

  it("contributes no Winter row, because Winter publishes no accommodation price", () => {
    expect(accommodationEntries.filter((entry) => entry.edition === "winter")).toEqual([]);
  });

  it("says whether a price is for the stay or per night", () => {
    for (const entry of accommodationEntries.filter((candidate) => candidate.edition === "belgium")) {
      expect(entry.snippet).toContain("for the whole stay");
    }
  });

  it("gives every row a unique slug", () => {
    const slugs = accommodationEntries.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps each currency to its own edition", () => {
    for (const entry of accommodationEntries) {
      if (entry.edition === "brasil") {
        expect(entry.snippet).toContain("R$");
        expect(entry.snippet).not.toContain("€");
      } else {
        expect(entry.snippet).toContain("€");
        expect(entry.snippet).not.toMatch(/R\$/);
      }
    }
  });
});

describe("saleEntries", () => {
  it("covers every sale window in all three editions", () => {
    const belgium = saleEntries.filter((entry) => entry.edition === "belgium");
    const winter = saleEntries.filter((entry) => entry.edition === "winter");
    const brasil = saleEntries.filter((entry) => entry.edition === "brasil");

    expect(belgium.length).toBe(3);
    expect(winter.length).toBe(1);
    expect(brasil.length).toBe(5);
  });

  it("names the festival time zone rather than the visitor's", () => {
    for (const entry of saleEntries) {
      expect(entry.snippet).toMatch(/CET|CEST|GMT-3/);
    }
  });

  it("sends every sale to the timeline", () => {
    for (const entry of saleEntries) {
      expect(entry.href).toBe("/tools/sale-timeline");
    }
  });
});

describe("editionEntries", () => {
  it("covers every edition in the shared overview", () => {
    expect(editionEntries.length).toBe(sharedData.editions.length);
  });

  it("links a covered edition to its own tickets view", () => {
    const winter = editionEntries.find((entry) => entry.slug === "edition-winter-2027");
    expect(winter?.href).toBe("/guides/tickets?edition=winter");
    expect(winter?.edition).toBe("winter");
  });

  it("links an edition with no guide view to the bare tickets page", () => {
    const thailand = editionEntries.find((entry) => entry.slug === "edition-thailand-2026");
    expect(thailand?.href).toBe("/guides/tickets");
    expect(thailand?.edition).toBe("all");
  });

  it("states the dates as a range", () => {
    const winter = editionEntries.find((entry) => entry.slug === "edition-winter-2027");
    expect(winter?.snippet).toContain("20–27 March 2027");
  });
});

describe("faqEntries", () => {
  it("covers every FAQ in all three collections", () => {
    expect(faqEntries.length).toBe(belgiumFaqs.length + winterFaqs.length + sharedData.faqs.length);
  });

  it("uses the question as the title", () => {
    const first = belgiumFaqs[0];
    const entry = faqEntries.find((candidate) => candidate.slug === `be-${first.id}`);
    expect(entry?.title).toBe(first.question);
  });

  it("links every answer to the guides index", () => {
    for (const entry of faqEntries) {
      expect(entry.href).toBe("/guides");
    }
  });

  it("carries the record's own verification date and citation", () => {
    const first = winterFaqs[0];
    const entry = faqEntries.find((candidate) => candidate.slug === `wi-${first.id}`);
    expect(entry?.lastVerified).toBe(first.lastVerified);
    expect(entry?.sourceUrl).toBe(first.source.url);
  });

  it("gives every row a unique slug", () => {
    const slugs = faqEntries.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("plainMarkdown", () => {
  it("keeps the visible text of a link", () => {
    expect(plainMarkdown("See [the official page](https://example.com) for details.")).toBe(
      "See the official page for details.",
    );
  });

  it("removes emphasis markers", () => {
    expect(plainMarkdown("This is **very** important and _also_ true.")).toBe(
      "This is very important and also true.",
    );
  });

  it("removes list bullets and heading hashes", () => {
    expect(plainMarkdown("## Heading\n\n- one\n- two")).toBe("Heading one two");
  });

  it("collapses newlines into a single line", () => {
    expect(plainMarkdown("one\n\n\ntwo")).toBe("one two");
  });

  it("leaves a dollar sign and a currency symbol alone", () => {
    expect(plainMarkdown("R$1,580 off, and €10 too")).toBe("R$1,580 off, and €10 too");
  });
});

describe("community entries", () => {
  it("covers every record in each collection", () => {
    expect(resourceEntries.length).toBe(communityData.resources.length);
    expect(whatsappEntries.length).toBe(communityData.whatsappGroups.length);
    expect(partnerEntries.length).toBe(communityData.partners.length);
  });

  it("sends every card to the community hub, not to an invite", () => {
    for (const entry of [...resourceEntries, ...whatsappEntries, ...partnerEntries]) {
      expect(entry.href).toBe("/community");
    }
  });

  it("leaves no emoji in a group title", () => {
    for (const entry of whatsappEntries) {
      expect(entry.title).not.toMatch(/[\p{Extended_Pictographic}]/u);
      expect(entry.title.trim()).not.toBe("");
    }
  });

  it("names a partner's promo code when it has one", () => {
    const rent = partnerEntries.find((entry) => entry.slug === "partner-partner-rent-a-tent");
    expect(rent?.snippet).toContain("DCATRAVEL");
  });

  it("names the resource category", () => {
    expect(resourceEntries.some((entry) => entry.snippet.startsWith("Official"))).toBe(true);
  });
});
