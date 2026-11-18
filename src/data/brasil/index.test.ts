// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brasilData, validateBrasilData } from "./index";
import {
  brasilDreamvillePackageSchema,
  brasilFactSchema,
  brasilSaleWindowSchema,
  brasilShuttleSchema,
  brasilTicketSchema,
} from "./facts";

const VERIFIED_ON = "2026-11-18";

/** The fact-check documents a Brasil source URL must appear in. */
function readLedger(): string {
  const root = process.cwd();
  return ["docs/factcheck/brasil-general.md", "docs/factcheck/conflicts.md"]
    .map((file) => readFileSync(path.join(root, file), "utf8"))
    .join("\n");
}

const ledger = readLedger();

/** Every Brasil record, flattened for cross-cutting assertions. */
const everyRecord = [
  ...brasilData.facts,
  ...brasilData.tickets,
  ...brasilData.dreamvillePackages,
  ...brasilData.shuttles,
  ...brasilData.saleWindows,
];

/** Every string a record publishes, so a banned term cannot hide in a note. */
function recordText(record: object): string {
  return JSON.stringify(record);
}

describe("Brasil data — schema parsing", () => {
  it("parses every fact record", () => {
    for (const record of brasilData.facts) {
      expect(brasilFactSchema.parse(record)).toEqual(record);
    }
  });

  it("parses every ticket record", () => {
    for (const record of brasilData.tickets) {
      expect(brasilTicketSchema.parse(record)).toEqual(record);
    }
  });

  it("parses every DreamVille package record", () => {
    for (const record of brasilData.dreamvillePackages) {
      expect(brasilDreamvillePackageSchema.parse(record)).toEqual(record);
    }
  });

  it("parses every shuttle record", () => {
    for (const record of brasilData.shuttles) {
      expect(brasilShuttleSchema.parse(record)).toEqual(record);
    }
  });

  it("parses every sale window record", () => {
    for (const record of brasilData.saleWindows) {
      expect(brasilSaleWindowSchema.parse(record)).toEqual(record);
    }
  });

  it("produces the same result when validated again", () => {
    expect(validateBrasilData()).toEqual(brasilData);
  });

  it("publishes at least one record of each kind", () => {
    expect(brasilData.facts.length).toBeGreaterThan(0);
    expect(brasilData.tickets.length).toBeGreaterThan(0);
    expect(brasilData.dreamvillePackages.length).toBeGreaterThan(0);
    expect(brasilData.shuttles.length).toBeGreaterThan(0);
    expect(brasilData.saleWindows.length).toBeGreaterThan(0);
  });

  it("rejects an unknown key on a fact", () => {
    const first = brasilData.facts[0];
    expect(brasilFactSchema.safeParse({ ...first, extra: true }).success).toBe(false);
  });

  it("rejects a non-BRL currency on a price", () => {
    const first = brasilData.tickets[0];
    expect(
      brasilTicketSchema.safeParse({ ...first, price: { currency: "EUR", amount: 100 } }).success,
    ).toBe(false);
  });

  it("rejects a fractional real amount", () => {
    const first = brasilData.tickets[0];
    expect(
      brasilTicketSchema.safeParse({ ...first, price: { currency: "BRL", amount: 99.5 } }).success,
    ).toBe(false);
  });

  it("rejects a negative real amount", () => {
    const first = brasilData.tickets[0];
    expect(
      brasilTicketSchema.safeParse({ ...first, price: { currency: "BRL", amount: -1 } }).success,
    ).toBe(false);
  });
});

describe("Brasil data — collection invariants", () => {
  it("keeps ids unique inside every collection", () => {
    for (const collection of [
      brasilData.facts,
      brasilData.tickets,
      brasilData.dreamvillePackages,
      brasilData.shuttles,
      brasilData.saleWindows,
    ]) {
      const ids = collection.map((record) => record.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("gives every record the Brasil edition", () => {
    for (const record of everyRecord) {
      expect(record.edition).toBe("brasil");
    }
  });

  it("marks every record official", () => {
    for (const record of everyRecord) {
      expect(record.confidence).toBe("official");
    }
  });

  it("verifies every record on 2026-11-18", () => {
    for (const record of everyRecord) {
      expect(record.lastVerified).toBe(VERIFIED_ON);
      expect(record.source.retrievedOn).toBe(VERIFIED_ON);
    }
  });

  it("uses an https source url for every record", () => {
    for (const record of everyRecord) {
      expect(record.source.url.startsWith("https://")).toBe(true);
      expect(record.source.url).not.toMatch(/\s/);
    }
  });

  it("cites only source urls that appear in the fact-check ledger", () => {
    const missing = everyRecord
      .map((record) => record.source.url)
      .filter((url) => !ledger.includes(url));
    expect(missing).toEqual([]);
  });

  it("never stores a negative amount", () => {
    const amounts = [
      ...brasilData.tickets.map((record) => record.price.amount),
      ...brasilData.dreamvillePackages.map((record) => record.price.amount),
    ];
    for (const amount of amounts) {
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(amount)).toBe(true);
    }
  });

  it("labels every price as BRL", () => {
    for (const record of [...brasilData.tickets, ...brasilData.dreamvillePackages]) {
      expect(record.price.currency).toBe("BRL");
    }
  });

  it("marks passed 2026 sale moments as past", () => {
    for (const window of brasilData.saleWindows) {
      expect(window.status).toBe("past");
      expect(window.timeZone).toBe("America/Sao_Paulo");
    }
  });
});

describe("Brasil data — verified content", () => {
  it("records the 2027 dates and venue", () => {
    const dates = brasilData.facts.find((record) => record.id === "edition-dates-2027");
    expect(dates).toBeDefined();
    expect(dates?.statement).toContain("30 April");
    expect(dates?.statement).toContain("2 May 2027");
    expect(dates?.statement).toContain("Parque Maeda");
    expect(dates?.statement).toContain("Itu");
  });

  it("puts Global Journey on 15 September 2026, not 17 September", () => {
    const journey = brasilData.saleWindows.find((record) => record.id === "global-journey-2026");
    expect(journey?.opensAt).toBe("2026-09-15T10:00:00-03:00");
    expect(journey?.notes).toContain("17 September was the originally announced date");
  });

  it("records the Bybit Pre-Sale and the worldwide sale", () => {
    const presale = brasilData.saleWindows.find((record) => record.id === "bybit-pre-sale-2026");
    const worldwide = brasilData.saleWindows.find(
      (record) => record.id === "worldwide-ticket-sale-2026",
    );
    expect(presale?.opensAt).toBe("2026-09-21T10:00:00-03:00");
    expect(presale?.closesAt).toBe("2026-09-23T23:59:00-03:00");
    expect(worldwide?.opensAt).toBe("2026-09-24T10:00:00-03:00");
  });

  it("records the corrected ticket prices from the ledger", () => {
    const price = (id: string) =>
      brasilData.tickets.find((record) => record.id === id)?.price.amount;
    expect(price("full-madness")).toBe(3160);
    expect(price("full-madness-half-price")).toBe(1580);
    expect(price("full-madness-comfort")).toBe(5535);
    expect(price("full-madness-comfort-half-price")).toBe(3955);
    expect(price("full-madness-comfort-social")).toBe(4300);
    expect(price("full-madness-social")).toBe(1925);
    expect(price("bybit-full-madness")).toBe(2960);
    expect(price("bybit-full-madness-half-price")).toBe(1380);
    expect(price("bybit-full-madness-social")).toBe(1725);
    expect(price("bybit-full-madness-comfort")).toBe(5335);
    expect(price("bybit-full-madness-comfort-half-price")).toBe(3755);
    expect(price("bybit-full-madness-comfort-social")).toBe(4100);
  });

  it("records the day-pass prices as sold out", () => {
    const dayPasses = brasilData.tickets.filter((record) => record.product.startsWith("day-pass"));
    expect(dayPasses.map((record) => record.price.amount).sort((a, b) => a - b)).toEqual([
      635, 1270, 2220, 3455,
    ]);
    for (const record of dayPasses) {
      expect(record.availability).toBe("sold-out");
    }
  });

  it("records the corrected DreamVille 2027 package prices", () => {
    const price = (id: string) =>
      brasilData.dreamvillePackages.find((record) => record.id === id)?.price.amount;
    expect(price("magnificent-greens-1p")).toBe(2565);
    expect(price("magnificent-greens-1p-comfort")).toBe(4940);
    expect(price("magnificent-greens-1p-bybit")).toBe(2365);
    expect(price("magnificent-greens-1p-bybit-comfort")).toBe(4740);
    expect(price("easy-tent-2p")).toBe(7609);
    expect(price("easy-tent-2p-comfort")).toBe(12359);
    expect(price("easy-tent-2p-no1")).toBe(20719);
    expect(price("solaris-2p")).toBe(14205);
    expect(price("solaris-2p-comfort")).toBe(18955);
    expect(price("solaris-2p-no1")).toBe(27315);
    expect(price("grande-4p")).toBe(25599);
    expect(price("grande-4p-comfort")).toBe(35099);
    expect(price("grande-4p-no1")).toBe(51819);
  });

  it("states the 2027 Mística line-up without Astera", () => {
    const lineUp = brasilData.facts.find((record) => record.id === "dreamville-mistica-lineup");
    const statement = lineUp?.statement ?? "";
    for (const tier of [
      "Solaris",
      "Luna",
      "Luna 2P Supreme",
      "Dreamlodge",
      "Nomade",
      "Orion",
      "Argo",
      "Grande",
    ]) {
      expect(statement).toContain(tier);
    }
    expect(statement).not.toContain("Astera");
  });

  it("never publishes Astera as a current offering", () => {
    const offenders = everyRecord.filter((record) => recordText(record).includes("Astera"));
    expect(offenders.map((record) => record.id)).toEqual([]);
  });

  it("never publishes Romanian carriage", () => {
    const offenders = everyRecord.filter((record) => recordText(record).toLowerCase().includes("romania"));
    expect(offenders.map((record) => record.id)).toEqual([]);
  });

  it("states the half-price rule with the Brazilian-citizen restriction", () => {
    const rule = brasilData.facts.find((record) => record.id === "half-price-rule");
    expect(rule).toBeDefined();
    expect(rule?.statement).toContain("Brazilian citizens");
    expect(rule?.statement).toContain("R$1,580");
    expect(rule?.statement).toContain("not a percentage");
  });

  it("does not claim the half-price discount is always 50%", () => {
    const rule = brasilData.facts.find((record) => record.id === "half-price-rule");
    const statement = rule?.statement ?? "";
    expect(statement).not.toMatch(/always (?:a )?50%/i);
    expect(statement).not.toMatch(/always half/i);
    expect(statement).toContain("about 71%");
  });

  it("treats a shuttle voucher as one festival day", () => {
    const voucher = brasilData.facts.find((record) => record.id === "shuttle-voucher-per-day");
    expect(voucher?.statement).toContain("single festival day");
    expect(voucher?.statement).toContain("three vouchers");
  });

  it("lists Rio de Janeiro as a shuttle city and never Curitiba", () => {
    const festival = brasilData.shuttles.find((record) => record.id === "festival-shuttle");
    expect(festival?.departureCities).toContain("Rio de Janeiro");
    expect(JSON.stringify(everyRecord)).not.toContain("Curitiba");
  });

  it("puts the shuttle stop 300 metres from the main entrance", () => {
    const meeting = brasilData.facts.find((record) => record.id === "shuttle-meeting-point");
    expect(meeting?.statement).toContain("300 metres");
    expect(JSON.stringify(everyRecord)).not.toContain("400 metres");
  });
});
