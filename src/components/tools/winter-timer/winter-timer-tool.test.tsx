import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WinterTimerTool } from "./winter-timer-tool";

afterEach(() => {
  cleanup();
});

function chooseStage(label: string, value: string): void {
  fireEvent.click(screen.getByLabelText(label));
  const option = screen.getAllByRole("option").find((item) => item.getAttribute("data-value") === value);
  if (option === undefined) throw new Error(`No stage option ${value} for ${label}`);
  fireEvent.click(option);
}

describe("WinterTimerTool", () => {
  it("renders the planning estimate notice, default transfer, and official links", () => {
    render(<WinterTimerTool />);

    expect(
      screen.getByText(/Planning estimates only — not an official Tomorrowland Winter/i),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Frozen Lotus to MainStage" })).toBeTruthy();

    const liveSection = screen
      .getByRole("heading", { name: "Frozen Lotus to MainStage" })
      .closest("section");
    expect(liveSection?.getAttribute("aria-live")).toBe("polite");
    expect(liveSection?.textContent).toMatch(/miles/);
    expect(liveSection?.textContent).not.toMatch(/\bkm\b/i);

    expect(
      screen.getByRole("link", { name: /Alpe d'Huez official ski area & lift status/i }),
    ).toBeTruthy();
  });

  it("recalculates when switching between ski and pedestrian modes", () => {
    render(<WinterTimerTool />);

    const resultHeading = screen.getByRole("heading", { name: "Frozen Lotus to MainStage" });
    const liveSection = resultHeading.closest("section")!;
    const skiText = liveSection.textContent ?? "";

    fireEvent.click(screen.getByRole("button", { name: /Pedestrian \/ Gondola/i }));

    const pedText = liveSection.textContent ?? "";
    expect(pedText).not.toEqual(skiText);
    expect(pedText).toContain("Pedestrian / Gondola");
  });

  it("updates route when changing stages and clicking swap", () => {
    render(<WinterTimerTool />);

    chooseStage("Starting stage or hub", "oz-3300");
    chooseStage("Target stage or hub", "cage-2027");

    expect(
      screen.getByRole("heading", { name: "Oz 3300 (Base Village) to Cage" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Swap starting stage and target stage/i }));

    expect(
      screen.getByRole("heading", { name: "Cage to Oz 3300 (Base Village)" }),
    ).toBeTruthy();
  });

  it("hides leave-by clock when target set time is cleared", () => {
    render(<WinterTimerTool />);

    const timeInput = screen.getByLabelText("Target set time (optional, 24h)");
    fireEvent.change(timeInput, { target: { value: "" } });

    expect(screen.getByText("Total transit estimate")).toBeTruthy();
  });
});
