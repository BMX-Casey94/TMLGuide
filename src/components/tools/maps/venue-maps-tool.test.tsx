import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { VenueMapsTool } from "./venue-maps-tool";

afterEach(() => {
  cleanup();
});

describe("VenueMapsTool", () => {
  it("renders the schematic disclaimer and defaults to De Schorre", () => {
    render(<VenueMapsTool />);

    expect(
      screen.getByText(/Schematic planning estimate — not an official Tomorrowland map/i),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "De Schorre (Festival Grounds)" })).toBeTruthy();

    const estimateHeading = screen.getByRole("heading", {
      name: "Main Entrance to Mainstage",
    });
    const section = estimateHeading.closest("section");
    expect(section?.getAttribute("aria-live")).toBe("polite");
    expect(section?.textContent).toMatch(/miles/);
    expect(section?.textContent).not.toMatch(/\bkm\b/i);
  });

  it("switches to DreamVille and updates zones", () => {
    render(<VenueMapsTool />);

    fireEvent.click(screen.getByRole("button", { name: /DreamVille \(Camping\)/i }));

    expect(screen.getByRole("heading", { name: "DreamVille (Camping & Accommodation)" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Magnificent Greens to Festival Entrance" }),
    ).toBeTruthy();
  });

  it("updates the estimate via accessible select dropdowns and swap button", () => {
    render(<VenueMapsTool />);

    const fromSelect = screen.getByLabelText("Starting zone (A)");
    const toSelect = screen.getByLabelText("Destination zone (B)");

    fireEvent.change(fromSelect, { target: { value: "freedom" } });
    fireEvent.change(toSelect, { target: { value: "core" } });

    expect(screen.getByRole("heading", { name: "Freedom to Core" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Swap starting zone and destination zone/i }));

    expect(screen.getByRole("heading", { name: "Core to Freedom" })).toBeTruthy();
  });

  it("supports keyboard activation on SVG map nodes", () => {
    render(<VenueMapsTool />);

    const svg = screen.getByRole("img", { name: /Schematic diagram of De Schorre/i });
    const atmosphereNode = within(svg).getByRole("button", { name: /^Atmosphere /i });

    fireEvent.keyDown(atmosphereNode, { key: "Enter" });

    expect(screen.getByRole("heading", { name: "Main Entrance to Atmosphere" })).toBeTruthy();
  });
});
