import { describe, expect, it } from "vitest";
import { pairTiers, productName, tierLabel } from "./tiers";

describe("productName", () => {
  it("strips the edition and sale-tier suffix", () => {
    expect(
      productName("Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale"),
    ).toBe("Day Pass");
  });

  it("leaves a name with no suffix untouched", () => {
    expect(productName("7-Day Festival Ticket")).toBe("7-Day Festival Ticket");
    expect(productName("Full Madness Pass — Half-Price (Meia-Entrada)")).toBe("Full Madness Pass");
  });

  it("never returns an empty name", () => {
    expect(productName(" — suffix only")).toBe(" — suffix only");
    expect(productName("")).toBe("");
  });
});

describe("tierLabel", () => {
  it("names the two known tiers in prose", () => {
    expect(tierLabel("presale")).toBe("pre-sale");
    expect(tierLabel("worldwide")).toBe("WorldWide sale");
  });

  it("passes an unfamiliar tier through rather than inventing a label", () => {
    expect(tierLabel("vip")).toBe("vip");
  });
});

describe("pairTiers", () => {
  const records = [
    { id: "day-pass-worldwide", name: "Day Pass — 2027 edition, WorldWide Ticket Sale" },
    { id: "day-pass-presale", name: "Day Pass — 2027 edition, WorldWide and Belgian Pre-Sale" },
    { id: "easy-tent-2p-worldwide", name: "Easy Tent 2P — 2027 edition, WorldWide Ticket Sale" },
    { id: "easy-tent-4p-presale", name: "Easy Tent 4P — 2027 edition, WorldWide and Belgian Pre-Sale" },
    { id: "seven-day-festival-ticket-2027", name: "7-Day Festival Ticket" },
  ];

  it("pairs two tiers of one product into a single group", () => {
    const groups = pairTiers(records);
    const dayPass = groups.find((group) => group.productId === "day-pass");
    expect(dayPass?.records.map(({ tierKey }) => tierKey)).toEqual(["presale", "worldwide"]);
  });

  it("orders pre-sale before the WorldWide sale regardless of input order", () => {
    const groups = pairTiers([...records].reverse());
    const dayPass = groups.find((group) => group.productId === "day-pass");
    expect(dayPass?.records[0].tierKey).toBe("presale");
  });

  it("keeps products apart even when their names are similar", () => {
    const ids = pairTiers(records).map((group) => group.productId);
    expect(ids).toContain("easy-tent-2p");
    expect(ids).toContain("easy-tent-4p");
  });

  it("gives an unsuffixed record its own group with a single tier", () => {
    const group = pairTiers(records).find(
      (candidate) => candidate.productId === "seven-day-festival-ticket-2027",
    );
    expect(group?.records).toHaveLength(1);
    expect(group?.records[0].tierKey).toBe("single");
  });

  it("never loses a record", () => {
    const total = pairTiers(records).reduce((sum, group) => sum + group.records.length, 0);
    expect(total).toBe(records.length);
  });

  it("keeps ids unique, so two products cannot share a row", () => {
    const ids = pairTiers(records).map((group) => group.productId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns nothing for no input", () => {
    expect(pairTiers([])).toEqual([]);
  });
});
