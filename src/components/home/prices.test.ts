// @vitest-environment node
import { describe, expect, it } from "vitest";

import { belgiumData } from "@/data/belgium";
import { brasilData, type BrasilTicket } from "@/data/brasil";
import { winterData } from "@/data/winter";
import type { TicketPackage } from "@/data/schemas";
import {
  belgiumFromPrice,
  brasilFromPrice,
  pickBelgiumFrom,
  pickBrasilFrom,
  pickWinterFrom,
  splitTicketName,
  winterFromPrice,
} from "./prices";
import { formatEuroFrom, formatReaisFrom } from "./format";

const SOURCE = {
  url: "https://belgium.tomorrowland.com/en/",
  title: "Official",
  retrievedOn: "2026-11-18",
} as const;

/** Builds a ticket record in the shape the Belgium data uses. */
function ticket(id: string, name: string, priceEur: number): TicketPackage {
  return {
    id,
    edition: "belgium",
    name,
    tier: "regular",
    nights: 0,
    priceEur,
    includes: ["Festival access"],
    source: SOURCE,
    lastVerified: "2026-11-18",
    confidence: "official",
  };
}

describe("splitTicketName", () => {
  it("splits the written shape into product, edition and sale", () => {
    expect(splitTicketName("Day Pass — 2027 edition, WorldWide Ticket Sale")).toEqual({
      product: "Day Pass",
      editionPart: "2027 edition",
      salePart: "WorldWide Ticket Sale",
    });
  });

  it("keeps a name in another shape whole, with no invented parts", () => {
    expect(splitTicketName("7-Day Festival Ticket")).toEqual({
      product: "7-Day Festival Ticket",
      editionPart: null,
      salePart: null,
    });
  });

  it("reports a missing sale part rather than treating the edition as the sale", () => {
    expect(splitTicketName("Day Pass — 2027 edition")).toEqual({
      product: "Day Pass",
      editionPart: "2027 edition",
      salePart: null,
    });
  });
});

describe("pickBelgiumFrom", () => {
  it("takes the cheapest regular pass in the WorldWide Ticket Sale", () => {
    const result = pickBelgiumFrom([
      ticket("a", "Day Pass — 2027 edition, WorldWide Ticket Sale", 159),
      ticket("b", "Full Madness Pass — 2027 edition, WorldWide Ticket Sale", 410),
    ]);

    expect(result?.amountLabel).toBe("€159");
    expect(result?.productLabel).toBe("Day Pass");
    expect(result?.saleLabel).toBe("WorldWide Ticket Sale");
  });

  it("chooses the Full Madness Pass when it is the cheaper of the two", () => {
    const result = pickBelgiumFrom([
      ticket("a", "Day Pass — 2027 edition, WorldWide Ticket Sale", 410),
      ticket("b", "Full Madness Pass — 2027 edition, WorldWide Ticket Sale", 159),
    ]);
    expect(result?.productLabel).toBe("Full Madness Pass");
  });

  it("ignores pre-sale prices, upgrades and packages", () => {
    const result = pickBelgiumFrom([
      ticket("presale", "Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale", 144),
      ticket("comfort", "Comfort Day Pass — 2027 edition, WorldWide Ticket Sale", 99),
      ticket("pleasure", "Pleasure Day Pass — 2027 edition, WorldWide Ticket Sale", 98),
      ticket("package", "Easy Tent 2P — 2027 edition, WorldWide Ticket Sale", 50),
      ticket("real", "Day Pass — 2027 edition, WorldWide Ticket Sale", 159),
    ]);

    expect(result?.amountLabel).toBe("€159");
    expect(result?.productLabel).toBe("Day Pass");
  });

  it("breaks a price tie by id, so the answer is stable", () => {
    const result = pickBelgiumFrom([
      ticket("zebra", "Full Madness Pass — 2027 edition, WorldWide Ticket Sale", 159),
      ticket("alpha", "Day Pass — 2027 edition, WorldWide Ticket Sale", 159),
    ]);

    expect(result?.productLabel).toBe("Day Pass");
    expect(result?.amountLabel).toBe("€159");
  });

  it("returns null when nothing qualifies", () => {
    expect(pickBelgiumFrom([])).toBeNull();
    expect(
      pickBelgiumFrom([ticket("x", "Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale", 144)]),
    ).toBeNull();
  });
});

describe("pickWinterFrom", () => {
  it("takes the cheapest published price", () => {
    const result = pickWinterFrom([
      ticket("a", "7-Day Festival Ticket", 735),
      ticket("b", "4-Day Festival Ticket", 500),
    ]);
    expect(result?.amountLabel).toBe("€500");
    expect(result?.productLabel).toBe("4-Day Festival Ticket");
  });

  it("returns null when the data holds no price, rather than inventing one", () => {
    expect(pickWinterFrom([])).toBeNull();
  });
});

/** Builds a Brasil ticket in the local reais shape. */
function brasilTicket(
  id: string,
  name: string,
  amount: number,
  overrides: Partial<BrasilTicket> = {},
): BrasilTicket {
  return {
    id,
    edition: "brasil",
    name,
    product: "day-pass",
    variant: "standard",
    validDays: 1,
    price: { currency: "BRL", amount },
    availability: "sold-out",
    notes: "Example",
    source: {
      url: "https://brasil.tomorrowland.com/en/tickets/festival-tickets/",
      title: "Official",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
    ...overrides,
  };
}

describe("pickBrasilFrom", () => {
  it("quotes reais with a thousands separator and no euro figure", () => {
    const result = pickBrasilFrom([brasilTicket("day-pass", "Day Pass", 1270)]);
    expect(result?.amountLabel).toBe("R$1,270");
    expect(result?.amountLabel).not.toContain("€");
  });

  it("excludes half-price, Social and Bybit rows that need a condition", () => {
    const result = pickBrasilFrom([
      brasilTicket("half", "Day Pass — Half-Price", 635, { variant: "half-price" }),
      brasilTicket("social", "Day Pass — Social", 900, { variant: "social" }),
      brasilTicket("bybit", "Day Pass — Bybit Early Bird", 1000, {
        variant: "bybit-early-bird",
      }),
      brasilTicket("standard", "Day Pass", 1270),
    ]);

    expect(result?.amountLabel).toBe("R$1,270");
    expect(result?.productLabel).toBe("Day Pass");
  });

  it("flags a sold-out product, so the figure is not read as a live price", () => {
    const result = pickBrasilFrom([brasilTicket("day-pass", "Day Pass", 1270)]);
    expect(result?.soldOut).toBe(true);
  });

  it("does not flag an on-sale product", () => {
    const result = pickBrasilFrom([
      brasilTicket("day-pass", "Day Pass", 1270, { availability: "on-sale" }),
    ]);
    expect(result?.soldOut).toBe(false);
  });

  it("returns null when every row is a conditional variant", () => {
    expect(
      pickBrasilFrom([brasilTicket("half", "Day Pass — Half-Price", 635, { variant: "half-price" })]),
    ).toBeNull();
  });
});

describe("the real data", () => {
  it("gives Belgium the cheapest WorldWide day pass, €159", () => {
    const result = belgiumFromPrice();
    expect(result?.amountLabel).toBe("€159");
    expect(result?.productLabel).toBe("Day Pass");
    expect(result?.saleLabel).toBe("WorldWide Ticket Sale");
    expect(result?.source.url).toBe(
      "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
    );
  });

  it("gives Winter its one published price, €735 for seven days", () => {
    const result = winterFromPrice();
    expect(result?.amountLabel).toBe("€735");
    expect(result?.productLabel).toBe("7-Day Festival Ticket");
  });

  it("gives Brasil the cheapest standard pass, in reais", () => {
    const result = brasilFromPrice();
    expect(result?.amountLabel).toBe("R$1,270");
    expect(result?.productLabel).toBe("Day Pass");
    expect(result?.soldOut).toBe(true);
  });

  it("never quotes a figure whose record is not official", () => {
    for (const result of [belgiumFromPrice(), winterFromPrice(), brasilFromPrice()]) {
      expect(result).not.toBeNull();
      expect(result?.lastVerified).toBe("2026-11-18");
      expect(result?.source.url).toMatch(/^https:\/\//);
    }
  });

  it("reads only from the validated collections", () => {
    expect(belgiumData.tickets.length).toBeGreaterThan(0);
    expect(winterData.tickets.length).toBeGreaterThan(0);
    expect(brasilData.tickets.length).toBeGreaterThan(0);
  });
});

describe("currency formatting", () => {
  it("drops the decimals from a whole euro amount", () => {
    expect(formatEuroFrom(159)).toBe("€159");
    expect(formatEuroFrom(1240)).toBe("€1,240");
  });

  it("keeps cents when a price genuinely has them", () => {
    expect(formatEuroFrom(19.5)).toBe("€19.50");
  });

  it("writes reais without centavos", () => {
    expect(formatReaisFrom(3160)).toBe("R$3,160");
    expect(formatReaisFrom(635)).toBe("R$635");
  });
});
