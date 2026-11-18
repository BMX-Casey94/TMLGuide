import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ToolCard } from "./tool-card";

afterEach(cleanup);

describe("ToolCard", () => {
  it("renders a live tool as one link named by its content", () => {
    render(
      <ToolCard
        href="/tools/budget"
        kicker="Money"
        title="Festival budget calculator"
        description="Add up what a trip costs."
        icon="wallet"
        status="live"
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/tools/budget");
    expect(link).toHaveAccessibleName(/Festival budget calculator/);
    expect(screen.getByRole("heading", { level: 2, name: "Festival budget calculator" })).toBeInTheDocument();
  });

  it("says a live tool is ready", () => {
    render(
      <ToolCard href="/tools/budget" kicker="Money" title="Budget" description="Text." icon="wallet" status="live" />,
    );
    expect(screen.getByText("Ready")).toBeVisible();
  });

  it("renders a planned tool without a link, and says so in words", () => {
    render(
      <ToolCard
        href="/tools/planned"
        kicker="Money"
        title="Not yet built"
        description="Coming later."
        icon="rocket"
        status="planned"
      />,
    );

    // A card that goes nowhere must not be a link.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Not yet built" })).toBeInTheDocument();
  });

  it("shows its kicker and description", () => {
    render(
      <ToolCard
        href="/tools/pearls"
        kicker="Cashless"
        title="Pearl calculator"
        description="Convert at a rate you supply."
        icon="money-bag"
        status="live"
      />,
    );

    expect(screen.getByText("Cashless")).toBeInTheDocument();
    expect(screen.getByText("Convert at a rate you supply.")).toBeInTheDocument();
  });

  it("renders a decorative icon with no accessible text", () => {
    render(
      <ToolCard href="/tools/pearls" kicker="Cashless" title="Pearl" description="Text." icon="money-bag" status="live" />,
    );
    // The icon is skipped by a screen reader; the heading carries the meaning.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
