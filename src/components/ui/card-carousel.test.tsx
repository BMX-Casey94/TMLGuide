import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card } from "./card";
import { CardCarousel } from "./card-carousel";

/* The shared vitest setup does not enable globals, so Testing Library cannot
   register its automatic cleanup. Each UI test file cleans up explicitly. */
afterEach(cleanup);

describe("CardCarousel", () => {
  it("is a labelled region", () => {
    render(
      <CardCarousel label="Example card group">
        <Card kicker="Example kicker" title="Example card" />
      </CardCarousel>,
    );

    expect(screen.getByRole("region", { name: "Example card group" })).toBeInTheDocument();
  });

  it("is focusable so it can be scrolled from the keyboard", () => {
    render(
      <CardCarousel label="Example card group">
        <Card kicker="Example kicker" title="Example card" />
      </CardCarousel>,
    );

    expect(screen.getByRole("region")).toHaveAttribute("tabindex", "0");
  });

  it("renders every child card", () => {
    render(
      <CardCarousel label="Example card group">
        <Card kicker="Example one" title="First example card" />
        <Card kicker="Example two" title="Second example card" />
        <Card kicker="Example three" title="Third example card" />
      </CardCarousel>,
    );

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});
