import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { partners, resources, whatsappGroups } from "@/data/community";
import { resourceProvenance } from "@/components/community/resource-groups";
import CommunityPage from "./page";

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

beforeEach(() => window.history.replaceState(null, "", "/community"));
afterEach(cleanup);

/*
  The hub keeps all three panels in the DOM (the inactive two are `hidden`), so
  these tests query the page rather than one panel. Each panel's content is
  distinct, which makes a whole-page query unambiguous, and it also asserts the
  property the markup is chosen for: every section is served with the HTML.
*/
function renderPage() {
  return render(<CommunityPage />);
}

describe("community page", () => {
  it("has one h1", () => {
    renderPage();
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Community");
  });

  it("states the independence position in the page introduction", () => {
    renderPage();
    expect(screen.getByText(/none of it is run by tomorrowland/i)).toBeInTheDocument();
  });

  it("shows a count of each collection", () => {
    renderPage();
    expect(
      screen.getByText(
        `${whatsappGroups.length} groups · ${resources.length} resources · ${partners.length} partners`,
      ),
    ).toBeInTheDocument();
  });

  it("offers the three sections as tabs with all three panels served", () => {
    renderPage();

    expect(screen.getByRole("tablist", { name: "Community sections" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "WhatsApp groups" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resources" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Partners" })).toBeInTheDocument();

    // Three panels in the document, one visible: no section is missing without JavaScript.
    expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(3);
  });

  it("renders every WhatsApp group, each with a safety note and an https invite", () => {
    renderPage();

    const joins = screen.getAllByRole("link", { name: /join on whatsapp/i });
    expect(joins).toHaveLength(whatsappGroups.length);

    for (const link of joins) {
      expect(link.getAttribute("href")?.startsWith("https://")).toBe(true);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    }

    // The page-level safety note plus one on every card.
    expect(screen.getAllByText(/admins will never ask you for payment/i)).toHaveLength(
      whatsappGroups.length + 1,
    );
    expect(screen.getAllByText(/never share ticket details/i)).toHaveLength(whatsappGroups.length + 1);
  });

  it("prints every group title verbatim", () => {
    renderPage();
    for (const group of whatsappGroups) {
      expect(screen.getByRole("heading", { name: group.title, hidden: true })).toBeInTheDocument();
    }
  });

  it("renders the resources with their provenance badges", () => {
    renderPage();

    const thirdParty = resources.filter((resource) => resourceProvenance(resource) === "third-party");
    const official = resources.filter((resource) => resourceProvenance(resource) === "official");

    expect(screen.getAllByText("Unofficial third-party tool")).toHaveLength(thirdParty.length);
    expect(screen.getAllByText("Official")).toHaveLength(official.length);

    // Every resource title is a heading on the page.
    for (const resource of resources) {
      expect(screen.getByRole("heading", { name: resource.title, hidden: true })).toBeInTheDocument();
    }
  });

  it("renders the partner disclosure explainer and every card disclosure", () => {
    renderPage();

    // The page-level explainer is a heading in its own right, not a footnote.
    expect(screen.getByRole("heading", { name: "Partner disclosure", hidden: true })).toBeInTheDocument();

    // Several commercial partners share one neutral disclosure, so this counts
    // appearances rather than assuming each string is unique.
    const disclosures = new Set(partners.map((partner) => partner.disclosure));
    for (const disclosure of disclosures) {
      const expected = partners.filter((partner) => partner.disclosure === disclosure).length;
      expect(screen.getAllByText(disclosure)).toHaveLength(expected);
    }

    for (const partner of partners) {
      expect(screen.getByRole("heading", { name: partner.name, hidden: true })).toBeInTheDocument();
    }

    // The independent-guide line is on every card, plus once in the explainer.
    expect(screen.getAllByText("Independent guide, check the partner's own terms")).toHaveLength(
      partners.length + 1,
    );
  });

  it("prints the Rent-a-Tent code exactly as the data stores it", () => {
    renderPage();

    const rentATent = screen.getByRole("heading", { name: "Rent-a-Tent", hidden: true }).closest("article");
    expect(rentATent).not.toBeNull();
    expect(rentATent).toHaveTextContent("DCATRAVEL");
    expect(rentATent).toHaveTextContent("5% discount");
    // Printed as stored, not silently corrected to the partner's own name.
    expect(rentATent?.textContent).toMatch(/Rent-a-Tent/);
  });

  it("points readers at the guides for official answers", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /read the guides/i })).toHaveAttribute("href", "/guides");
  });

  it("never renders an http link anywhere on the page", () => {
    renderPage();

    const links = screen.getAllByRole("link", { hidden: true });
    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("/") || href.startsWith("#")) continue;
      expect(href.startsWith("https://")).toBe(true);
    }
  });

  it("keeps every external link free of window.opener access", () => {
    renderPage();

    for (const link of screen.getAllByRole("link", { hidden: true })) {
      if (link.getAttribute("target") !== "_blank") continue;
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});
