// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  FOOD_ESTIMATE_DISCLAIMER,
  foodEstimateSchema,
  foodEstimates,
  foodEstimatesSchema,
} from "./food-estimates";

const EDITIONS = ["belgium", "winter", "brasil"] as const;

describe("Food estimates", () => {
  it("states that the figures are community estimates", () => {
    expect(FOOD_ESTIMATE_DISCLAIMER).toMatch(/community estimates/i);
    expect(FOOD_ESTIMATE_DISCLAIMER).toMatch(/not official Tomorrowland prices/i);
    expect(FOOD_ESTIMATE_DISCLAIMER).toMatch(/stall/i);
    expect(FOOD_ESTIMATE_DISCLAIMER).toMatch(/year/i);
    expect(FOOD_ESTIMATE_DISCLAIMER).toMatch(/check the price on site/i);
    expect(FOOD_ESTIMATE_DISCLAIMER).toMatch(/hundredths of a Pearl/);
  });

  it("cites an https source for every record", () => {
    for (const record of foodEstimates) {
      expect(record.source.url.startsWith("https://")).toBe(true);
      expect(record.source.checkedOn).toBe("2026-11-27");
    }
  });

  it("keeps euros to Belgium and Winter, and reais to Brasil", () => {
    for (const record of foodEstimates) {
      if (record.currency === "EUR") {
        expect(record.edition === "belgium" || record.edition === "winter").toBe(true);
      }
      if (record.currency === "BRL") {
        expect(record.edition).toBe("brasil");
      }
    }
  });

  it("keeps every stored range ordered, and empty when no range was sourced", () => {
    for (const record of foodEstimates) {
      if (record.currency === null) {
        expect(record.low).toBeNull();
        expect(record.high).toBeNull();
        continue;
      }
      expect(record.low).not.toBeNull();
      expect(record.high).not.toBeNull();
      expect(record.low).toBeLessThanOrEqual(record.high!);
    }
  });

  it("does not let any record claim to be an official price", () => {
    for (const record of foodEstimates) {
      expect(record.confidence).toBe("community-estimate");
      const text = `${record.name} ${record.summary}`.toLowerCase();
      expect(text).not.toMatch(/\bofficial\b/);
    }
  });

  it("has at least one stall type for each sourced edition", () => {
    for (const edition of EDITIONS) {
      const stallTypes = foodEstimates.filter(
        (record) => record.edition === edition && record.kind === "stall-type",
      );
      expect(stallTypes.length).toBeGreaterThan(0);
    }
  });

  it("allows an edition to have no price-range rows", () => {
    const stallTypesOnly = foodEstimates.filter((record) => record.kind === "stall-type");
    expect(stallTypesOnly.length).toBeGreaterThan(0);
    expect(foodEstimatesSchema.parse(stallTypesOnly).every((record) => record.kind === "stall-type")).toBe(
      true,
    );

    for (const edition of EDITIONS) {
      const priceRanges = foodEstimates.filter(
        (record) => record.edition === edition && record.kind === "price-range",
      );
      expect(priceRanges.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("rejects a reversed range, a real price on Belgium, and a plain-http source", () => {
    const priced = foodEstimates.find((record) => record.low !== null && record.high !== null);
    expect(priced).toBeDefined();
    expect(
      foodEstimateSchema.safeParse({ ...priced, low: priced!.high, high: priced!.low }).success,
    ).toBe(false);

    const belgium = foodEstimates.find((record) => record.edition === "belgium");
    expect(
      foodEstimateSchema.safeParse({ ...belgium, currency: "BRL", low: 100, high: 200 }).success,
    ).toBe(false);

    expect(
      foodEstimateSchema.safeParse({
        ...priced,
        source: { ...priced!.source, url: "http://example.com/prices" },
      }).success,
    ).toBe(false);
  });
});
