// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  EDITION_LABEL,
  TOOL_EDITIONS,
  currencyForEdition,
  isToolEdition,
  toolCurrencySchema,
  toolEditionSchema,
} from "./editions";

describe("tool editions", () => {
  it("covers Belgium, Winter and Brasil, in that order", () => {
    expect(TOOL_EDITIONS).toEqual(["belgium", "winter", "brasil"]);
  });

  it("prices Brasil in reais and the euro editions in euros", () => {
    expect(currencyForEdition("belgium")).toBe("EUR");
    expect(currencyForEdition("winter")).toBe("EUR");
    expect(currencyForEdition("brasil")).toBe("BRL");
  });

  it("labels every edition", () => {
    for (const edition of TOOL_EDITIONS) {
      expect(EDITION_LABEL[edition].length).toBeGreaterThan(0);
    }
  });

  it("recognises only the three editions", () => {
    expect(isToolEdition("belgium")).toBe(true);
    expect(isToolEdition("thailand")).toBe(false);
    expect(isToolEdition("")).toBe(false);
    expect(isToolEdition(null)).toBe(false);
    expect(isToolEdition(1)).toBe(false);
  });

  it("refuses a currency other than EUR or BRL", () => {
    expect(toolCurrencySchema.safeParse("EUR").success).toBe(true);
    expect(toolCurrencySchema.safeParse("BRL").success).toBe(true);
    expect(toolCurrencySchema.safeParse("GBP").success).toBe(false);
    expect(toolCurrencySchema.safeParse("usd").success).toBe(false);
  });

  it("derives the edition list from the schema, so the two cannot drift", () => {
    expect(toolEditionSchema.options).toEqual([...TOOL_EDITIONS]);
  });
});
