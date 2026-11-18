import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CommunityHub } from "./community-hub";

beforeEach(() => window.history.replaceState(null, "", "/community"));
afterEach(cleanup);

function renderHub() {
  return render(
    <CommunityHub
      whatsappPanel={<p>Panel one content</p>}
      resourcesPanel={<p>Panel two content</p>}
      partnersPanel={<p>Panel three content</p>}
    />,
  );
}

function tab(name: string): HTMLElement {
  return screen.getByRole("tab", { name });
}

describe("CommunityHub", () => {
  it("renders a named tab list with the three sections", () => {
    renderHub();

    const tablist = screen.getByRole("tablist", { name: "Community sections" });
    expect(within(tablist).getAllByRole("tab")).toHaveLength(3);
    expect(within(tablist).getByRole("tab", { name: "WhatsApp groups" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Resources" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Partners" })).toBeInTheDocument();
  });

  it("opens on the first tab and shows only its panel to assistive technology", () => {
    renderHub();

    expect(tab("WhatsApp groups")).toHaveAttribute("aria-selected", "true");
    expect(tab("Resources")).toHaveAttribute("aria-selected", "false");

    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(panels).toHaveLength(3);
    expect(screen.getByRole("tabpanel", { name: "WhatsApp groups" })).toBeVisible();
    expect(screen.getByText("Panel one content")).toBeInTheDocument();
  });

  it("keeps every panel in the document, so no section is missing without JavaScript", () => {
    renderHub();
    expect(screen.getByText("Panel one content")).toBeInTheDocument();
    expect(screen.getByText("Panel two content")).toBeInTheDocument();
    expect(screen.getByText("Panel three content")).toBeInTheDocument();
  });

  it("associates each tab with its panel", () => {
    renderHub();

    for (const name of ["WhatsApp groups", "Resources", "Partners"]) {
      const element = tab(name);
      const panelId = element.getAttribute("aria-controls");
      expect(panelId).not.toBeNull();
      expect(document.getElementById(panelId!)).not.toBeNull();
      expect(document.getElementById(panelId!)).toHaveAttribute("aria-labelledby", element.id);
    }
  });

  it("puts only the selected tab in the tab sequence", () => {
    renderHub();

    expect(tab("WhatsApp groups")).toHaveAttribute("tabindex", "0");
    expect(tab("Resources")).toHaveAttribute("tabindex", "-1");
    expect(tab("Partners")).toHaveAttribute("tabindex", "-1");
  });

  it("switches panels on click", () => {
    renderHub();

    fireEvent.click(tab("Partners"));

    expect(tab("Partners")).toHaveAttribute("aria-selected", "true");
    expect(tab("WhatsApp groups")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel", { name: "Partners" })).toBeVisible();
  });

  it("moves with the arrow keys and follows focus", () => {
    renderHub();

    fireEvent.keyDown(tab("WhatsApp groups"), { key: "ArrowRight" });
    expect(tab("Resources")).toHaveAttribute("aria-selected", "true");
    expect(tab("Resources")).toHaveFocus();

    fireEvent.keyDown(tab("Resources"), { key: "ArrowLeft" });
    expect(tab("WhatsApp groups")).toHaveAttribute("aria-selected", "true");
    expect(tab("WhatsApp groups")).toHaveFocus();
  });

  it("wraps at both ends and supports Home and End", () => {
    renderHub();

    fireEvent.keyDown(tab("WhatsApp groups"), { key: "ArrowLeft" });
    expect(tab("Partners")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("Partners"), { key: "Home" });
    expect(tab("WhatsApp groups")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("WhatsApp groups"), { key: "End" });
    expect(tab("Partners")).toHaveAttribute("aria-selected", "true");
  });

  it("ignores keys it does not own", () => {
    renderHub();

    fireEvent.keyDown(tab("WhatsApp groups"), { key: "a" });
    expect(tab("WhatsApp groups")).toHaveAttribute("aria-selected", "true");
  });

  it("writes the tab hash without adding a history entry", () => {
    renderHub();
    const before = window.history.length;

    fireEvent.click(tab("Partners"));

    expect(window.location.hash).toBe("#partners");
    // Switching tabs is not a navigation; the back button should leave the page.
    expect(window.history.length).toBe(before);
  });

  it("opens the tab named in the URL hash", () => {
    window.history.replaceState(null, "", "/community#partners");
    renderHub();

    act(() => {
      // The hash is read in an effect, which has already run by now.
    });
    expect(tab("Partners")).toHaveAttribute("aria-selected", "true");
  });

  it("stays on the default tab for an unknown hash", () => {
    window.history.replaceState(null, "", "/community#nonsense");
    renderHub();
    expect(tab("WhatsApp groups")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the rest of the query string when the tab changes", () => {
    window.history.replaceState(null, "", "/community?q=tent");
    renderHub();

    fireEvent.click(tab("Resources"));

    expect(window.location.pathname).toBe("/community");
    expect(window.location.search).toBe("?q=tent");
    expect(window.location.hash).toBe("#resources");
  });
});
