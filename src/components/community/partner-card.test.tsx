import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { partners } from "@/data/community";
import { PartnerCard } from "./partner-card";
import {
  PARTNER_CHECK_TERMS_LINE,
  PARTNER_DISCLOSURE_PARAGRAPHS,
  PARTNER_DISCLOSURE_TITLE,
  PartnerDisclosure,
} from "./partner-disclosure";

afterEach(cleanup);

const rentATent = partners.find((partner) => partner.id === "partner-rent-a-tent");
const dcaTravel = partners.find((partner) => partner.id === "partner-dca-travel");

describe("PartnerDisclosure", () => {
  it("renders as a labelled section with the required title", () => {
    render(<PartnerDisclosure />);

    expect(screen.getByRole("heading", { name: PARTNER_DISCLOSURE_TITLE })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: PARTNER_DISCLOSURE_TITLE })).toBeInTheDocument();
  });

  it("prints every paragraph of the explainer", () => {
    render(<PartnerDisclosure />);
    for (const paragraph of PARTNER_DISCLOSURE_PARAGRAPHS) {
      expect(screen.getByText(paragraph)).toBeInTheDocument();
    }
  });

  it("states that listing is not a recommendation and that partners set their own terms", () => {
    render(<PartnerDisclosure />);
    const text = document.body.textContent ?? "";

    expect(text).toMatch(/not a recommendation/i);
    expect(text).toMatch(/check the partner's own terms/i);
    expect(text).toMatch(/confirm the terms, the total price and the cancellation policy/i);
  });

  it("states plainly that the partners are not Tomorrowland", () => {
    render(<PartnerDisclosure />);
    expect(screen.getByText(/none of these companies is tomorrowland/i)).toBeInTheDocument();
  });
});

describe("PartnerCard", () => {
  it("prints the record's disclosure verbatim and prominently", () => {
    render(<PartnerCard partner={dcaTravel!} />);

    expect(within(screen.getByRole("article")).getByText(dcaTravel!.disclosure)).toBeInTheDocument();
    // The label is what makes it prominent rather than small print.
    expect(screen.getByText("Disclosure")).toBeInTheDocument();
  });

  it("prints the offer and the promo code exactly as stored", () => {
    render(<PartnerCard partner={rentATent!} />);

    expect(screen.getByText(rentATent!.offer)).toBeInTheDocument();
    expect(screen.getByText("Promo code")).toBeInTheDocument();
    expect(screen.getByText("DCATRAVEL")).toBeInTheDocument();
    expect(rentATent!.offer).toContain("5% discount");
  });

  it("omits the promo block when the partner has no code", () => {
    render(<PartnerCard partner={dcaTravel!} />);
    expect(screen.queryByText("Promo code")).not.toBeInTheDocument();
  });

  it("always shows the independent-guide line", () => {
    for (const partner of partners) {
      const view = render(<PartnerCard partner={partner} />);
      expect(screen.getByText(PARTNER_CHECK_TERMS_LINE)).toBeInTheDocument();
      view.unmount();
    }
  });

  it("opens the partner in a new tab with the safe rel", () => {
    render(<PartnerCard partner={dcaTravel!} />);

    const link = screen.getByRole("link", { name: /visit dca travel/i });
    expect(link).toHaveAttribute("href", dcaTravel!.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("marks the edition only when it is not festival-wide", () => {
    const tomorrowcrazy = partners.find((partner) => partner.id === "partner-tomorrowcrazy");
    const view = render(<PartnerCard partner={tomorrowcrazy!} />);
    expect(screen.getByText("Brasil")).toBeInTheDocument();
    view.unmount();

    render(<PartnerCard partner={dcaTravel!} />);
    expect(screen.queryByText("Brasil")).not.toBeInTheDocument();
  });

  it("names the card by its partner", () => {
    render(<PartnerCard partner={dcaTravel!} />);
    expect(screen.getByRole("article", { name: "DCA Travel" })).toBeInTheDocument();
  });

  it("shows the checked date", () => {
    render(<PartnerCard partner={dcaTravel!} />);
    expect(screen.getByText(/Checked/)).toBeInTheDocument();
    expect(screen.getByText("18 Nov 2026")).toHaveAttribute("datetime", "2026-11-18");
  });

  it("separates the host from the check date so the two never run together", () => {
    render(<PartnerCard partner={dcaTravel!} />);

    const line = screen.getByText(/^(Source:|Partner link)/);
    expect(line.textContent).toMatch(/—\s*Checked/);
  });

  it("carries a disclosure of real length on every published partner", () => {
    for (const partner of partners) {
      expect(partner.disclosure.length).toBeGreaterThanOrEqual(20);
    }
  });

  it("gives the donation partner its own disclosure rather than the commercial one", () => {
    const donation = partners.find((partner) => partner.id === "partner-buy-me-a-coffee");
    render(<PartnerCard partner={donation!} />);

    const article = screen.getByRole("article", { name: donation!.name });
    expect(within(article).getByText(/not a commercial partner/i)).toBeInTheDocument();
  });
});
