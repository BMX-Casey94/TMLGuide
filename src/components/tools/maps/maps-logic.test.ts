import { describe, expect, it } from "vitest";
import { formatMiles } from "./maps-logic";

/**
 * The formatter is shared with the winter transit timer, so it is tested here
 * rather than only through whichever tool happens to render it.
 */
describe("formatMiles", () => {
  it("formats singular and plural miles cleanly", () => {
    expect(formatMiles(0)).toBe("0 miles");
    expect(formatMiles(1)).toBe("1 mile");
    expect(formatMiles(1.0)).toBe("1 mile");
    expect(formatMiles(0.45)).toBe("0.45 miles");
    expect(formatMiles(0.5)).toBe("0.5 miles");
    expect(formatMiles(1.234)).toBe("1.23 miles");
    expect(formatMiles(2)).toBe("2 miles");
  });

  it("never says kilometres, in any spelling", () => {
    for (const miles of [0, 0.1, 0.62, 1, 3.1, 26.2]) {
      expect(formatMiles(miles)).not.toMatch(/km|kilometre|kilometer/i);
    }
  });

  it("rounds to two decimal places and drops trailing zeros", () => {
    expect(formatMiles(0.6000001)).toBe("0.6 miles");
    // 1.005 times 100 is 100.49999… in binary floating point, so it rounds down;
    // the assertion records the real behaviour rather than an imagined one.
    expect(formatMiles(1.005)).toBe("1 mile");
    expect(formatMiles(1.006)).toBe("1.01 miles");
    expect(formatMiles(0.004)).toBe("0 miles");
  });

  it("survives the edge values a route could throw at it", () => {
    // A zero-length walk is the same-node case in the routing layer.
    expect(formatMiles(-0)).toBe("0 miles");
    expect(formatMiles(Number.MIN_VALUE)).toBe("0 miles");
  });
});
