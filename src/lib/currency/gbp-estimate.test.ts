import { describe, expect, it } from "vitest";
import {
  formatIndicativeGbp,
  INDICATIVE_GBP_PER_EUR,
  INDICATIVE_GBP_RATE_DATE,
} from "./gbp-estimate";

describe("gbp-estimate", () => {
  it("exports a positive indicative rate and ISO review date", () => {
    expect(INDICATIVE_GBP_PER_EUR).toBeGreaterThan(0);
    expect(INDICATIVE_GBP_PER_EUR).toBe(0.85);
    expect(INDICATIVE_GBP_RATE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats EUR amounts as indicative GBP with a leading approximation symbol", () => {
    expect(formatIndicativeGbp(2827, "EUR")).toBe("≈ £2,402.95");
    expect(formatIndicativeGbp(144, "EUR")).toBe("≈ £122.40");
    expect(formatIndicativeGbp(0, "EUR")).toBe("≈ £0.00");
  });

  it("rounds half up cleanly using integer minor-unit arithmetic", () => {
    // €1.01 * 0.85 = £0.8585 -> £0.86
    expect(formatIndicativeGbp(1.01, "EUR")).toBe("≈ £0.86");
    // €0.10 * 0.85 = £0.085 -> £0.09 (half up)
    expect(formatIndicativeGbp(0.1, "EUR")).toBe("≈ £0.09");
  });

  it("never converts BRL prices (Tomorrowland Brasil stays in reais)", () => {
    expect(formatIndicativeGbp(3160, "BRL")).toBeNull();
    expect(formatIndicativeGbp(0, "BRL")).toBeNull();
  });

  it("returns null for invalid or negative EUR amounts", () => {
    expect(formatIndicativeGbp(-10, "EUR")).toBeNull();
    expect(formatIndicativeGbp(Number.NaN, "EUR")).toBeNull();
    expect(formatIndicativeGbp(Number.POSITIVE_INFINITY, "EUR")).toBeNull();
  });
});
