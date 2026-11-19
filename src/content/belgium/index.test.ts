// @vitest-environment node
import { describe, expect, it } from "vitest";
import { belgiumChapters } from "./index";

describe("belgium chapter list", () => {
  it("contains all ten chapters, so dropping either half fails loudly", () => {
    expect(belgiumChapters.map((chapter) => chapter.slug)).toEqual([
      "overview",
      "dates-and-sales",
      "tickets",
      "accommodation",
      "dreamville",
      "transport",
      "global-journey",
      "add-ons",
      "food-drinks",
      "faq",
    ]);
  });

  it("is ordered 1 to 10 without gaps", () => {
    expect(belgiumChapters.map((chapter) => chapter.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
