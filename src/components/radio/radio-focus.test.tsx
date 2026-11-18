import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RadioProvider } from "./radio-context";
import { RadioPlayer } from "./radio-player";

/* Keyboard focus must follow the disclosure: into the panel on open, back to the tab on close. */
afterEach(cleanup);

function region(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

describe("radio disclosure focus", () => {
  it("moves focus into the desktop panel on open and back to the tab on Escape", () => {
    render(
      <RadioProvider>
        <RadioPlayer />
      </RadioProvider>,
    );
    const desktop = region("One World Radio player");
    fireEvent.click(within(desktop).getByRole("button", { name: "Open One World Radio player" }));
    expect(document.activeElement).toBe(within(desktop).getByRole("button", { name: "Play One World Radio" }));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(within(desktop).getByRole("button", { name: "Open One World Radio player" }));
  });

  it("returns focus to the desktop tab when the minimise button is used", () => {
    render(
      <RadioProvider>
        <RadioPlayer />
      </RadioProvider>,
    );
    const desktop = region("One World Radio player");
    fireEvent.click(within(desktop).getByRole("button", { name: "Open One World Radio player" }));
    fireEvent.click(within(desktop).getByRole("button", { name: "Minimise One World Radio player" }));
    expect(document.activeElement).toBe(within(desktop).getByRole("button", { name: "Open One World Radio player" }));
  });

  it("does the same on the phone dock", () => {
    render(
      <RadioProvider>
        <RadioPlayer />
      </RadioProvider>,
    );
    const mobile = region("One World Radio mini-player");
    fireEvent.click(within(mobile).getByRole("button", { name: "Open One World Radio player" }));
    expect(document.activeElement).toBe(within(mobile).getByRole("button", { name: "Play One World Radio" }));

    fireEvent.click(within(mobile).getByRole("button", { name: "Minimise One World Radio player" }));
    expect(document.activeElement).toBe(within(mobile).getByRole("button", { name: "Open One World Radio player" }));
  });

  it("does not steal focus on first render", () => {
    render(
      <RadioProvider>
        <RadioPlayer />
      </RadioProvider>,
    );
    expect(document.activeElement).toBe(document.body);
  });
});
