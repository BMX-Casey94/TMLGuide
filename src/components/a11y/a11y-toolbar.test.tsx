import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { A11Y_STORAGE_KEY, DEFAULT_A11Y_PREFS, serialisePrefs, type A11yPrefs } from "./a11y-prefs";
import { closeA11yPanel } from "./a11y-panel-store";
import { A11yPanel, A11yTrigger } from "./a11y-toolbar";

/**
 * Behaviour tests for the panel and its two triggers.
 *
 * Two jsdom gaps are filled rather than mocked away:
 *
 * 1. This repository's vitest environment installs an inert `localStorage` over jsdom's own (see
 *    `src/components/shell/test-storage.ts`), so a working in-memory `Storage` is installed here.
 * 2. jsdom's `HTMLDialogElement` has `open` but no `showModal()` or `close()`. The shim below
 *    reproduces the observable behaviour the panel relies on — `open` reflection, the focus move on
 *    show, and the `close` event — without pretending to emulate the top layer, which jsdom has no
 *    concept of.
 */

class MemoryStorage implements Storage {
  private entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }
}

function installDialog(): void {
  const proto = window.HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: () => void;
  };

  if (typeof proto.showModal !== "function") {
    Object.defineProperty(proto, "showModal", {
      configurable: true,
      writable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    });
  }

  if (typeof proto.close !== "function") {
    Object.defineProperty(proto, "close", {
      configurable: true,
      writable: true,
      value(this: HTMLDialogElement) {
        if (!this.hasAttribute("open")) return;
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      },
    });
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(window, "localStorage", { configurable: true, writable: true, value: storage });
  installDialog();
  for (const attribute of Array.from(document.documentElement.attributes)) {
    if (attribute.name.startsWith("data-a11y-")) document.documentElement.removeAttribute(attribute.name);
  }
  closeA11yPanel();
});

afterEach(() => {
  cleanup();
  closeA11yPanel();
});

function dialog(): HTMLDialogElement {
  const element = document.querySelector("dialog");
  if (element === null) throw new Error("Expected the panel's <dialog>");
  return element as HTMLDialogElement;
}

function renderToolbar() {
  return render(
    <>
      <A11yTrigger variant="header" />
      <A11yPanel />
      <A11yTrigger variant="dock" />
    </>,
  );
}

function openPanel() {
  fireEvent.click(screen.getAllByRole("button", { name: "Accessibility settings" })[0]);
}

function group(name: string): HTMLElement {
  const fieldset = screen
    .getByRole("group", { name })
    .closest("fieldset") as HTMLElement | null;
  if (fieldset === null) throw new Error(`No fieldset for ${name}`);
  return fieldset;
}

function radio(name: string, label: string): HTMLInputElement {
  return within(group(name)).getByRole("radio", { name: label }) as HTMLInputElement;
}

describe("the trigger", () => {
  it("is named 'Accessibility settings' at both widths", () => {
    renderToolbar();
    const triggers = screen.getAllByRole("button", { name: "Accessibility settings" });
    expect(triggers).toHaveLength(2);
  });

  it("starts collapsed, pointing at the panel it will open", () => {
    renderToolbar();
    for (const trigger of screen.getAllByRole("button", { name: "Accessibility settings" })) {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveAttribute("aria-controls", dialog().id);
    }
  });

  it("reports expanded while the panel is open, from either trigger", async () => {
    renderToolbar();
    openPanel();

    await waitFor(() => expect(dialog().open).toBe(true));
    for (const trigger of screen.getAllByRole("button", { name: "Accessibility settings" })) {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    }
  });

  it("opens the same single panel from the dock trigger", async () => {
    renderToolbar();
    fireEvent.click(screen.getAllByRole("button", { name: "Accessibility settings" })[1]);
    await waitFor(() => expect(dialog().open).toBe(true));
    expect(document.querySelectorAll("dialog")).toHaveLength(1);
  });

  it("is a real button, so Enter and Space work without a handler", () => {
    renderToolbar();
    for (const trigger of screen.getAllByRole("button", { name: "Accessibility settings" })) {
      expect(trigger.tagName).toBe("BUTTON");
      expect(trigger).toHaveAttribute("type", "button");
    }
  });
});

describe("the panel", () => {
  it("starts shut, so nothing is in the accessibility tree before it is opened", () => {
    renderToolbar();
    expect(dialog().open).toBe(false);
    expect(screen.queryByRole("group", { name: "Text size" })).toBeNull();
  });

  it("is named by its own heading", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    const labelledBy = dialog().getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe("Accessibility settings");
  });

  it("groups every control under a legend", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    const expected = [
      ["Text size", 4],
      ["Line and letter spacing", 2],
      ["Contrast", 2],
      ["Motion", 2],
      ["Underline links", 2],
      ["Readable font", 2],
    ] as const;

    for (const [name, count] of expected) {
      expect(within(group(name)).getAllByRole("radio")).toHaveLength(count);
    }
  });

  it("offers exactly the documented text sizes", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    const labels = within(group("Text size"))
      .getAllByRole("radio")
      .map((radioInput) => (radioInput as HTMLInputElement).value);
    expect(labels).toEqual(["100", "115", "130", "150"]);
  });

  it("reflects the stored choices rather than the defaults", async () => {
    const stored: A11yPrefs = {
      textSize: 130,
      spacing: "relaxed",
      contrast: "high",
      motion: "reduce",
      links: "on",
      font: "readable",
    };
    storage.setItem(A11Y_STORAGE_KEY, serialisePrefs(stored));

    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    expect(radio("Text size", "130%").checked).toBe(true);
    expect(radio("Line and letter spacing", "Relaxed").checked).toBe(true);
    expect(radio("Contrast", "High").checked).toBe(true);
    expect(radio("Motion", "Reduce").checked).toBe(true);
    expect(radio("Underline links", "On").checked).toBe(true);
    expect(radio("Readable font", "On").checked).toBe(true);
  });

  it("has one tab stop per group, which is what a native radio group gives", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    for (const name of ["Text size", "Contrast", "Motion"]) {
      const radios = within(group(name)).getAllByRole("radio") as HTMLInputElement[];
      // Native radios in a group: only the checked one is focusable, and jsdom defaults tabIndex to
      // 0 for all of them, so assert on the checked state instead of the attribute.
      expect(radios.filter((input) => input.checked)).toHaveLength(1);
      expect(radios.every((input) => input.type === "radio")).toBe(true);
      expect(new Set(radios.map((input) => input.name)).size).toBe(1);
    }
  });
});

describe("changing a preference", () => {
  it("applies it to <html> immediately and persists it", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.click(radio("Text size", "130%"));

    expect(document.documentElement.getAttribute("data-a11y-text")).toBe("130");
    expect(JSON.parse(storage.getItem(A11Y_STORAGE_KEY)!)).toEqual({
      ...DEFAULT_A11Y_PREFS,
      textSize: 130,
    });
  });

  it("announces the change politely, in the wording the brief specifies", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.click(radio("Text size", "130%"));

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status.textContent).toBe("Text size set to 130 percent");
  });

  it("announces every group in its own words", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.click(radio("Contrast", "High"));
    expect(screen.getByRole("status").textContent).toBe("Contrast set to high");

    fireEvent.click(radio("Underline links", "On"));
    expect(screen.getByRole("status").textContent).toBe("Link underlines turned on");

    fireEvent.click(radio("Readable font", "On"));
    expect(screen.getByRole("status").textContent).toBe("Readable font turned on");
  });

  it("keeps the live region in the DOM from the first render", async () => {
    renderToolbar();
    // Present but empty before anything is opened, which is what makes the first announcement land.
    // Queried through the DOM, not by role: a closed dialog is out of the accessibility tree.
    const status = document.querySelector('[role="status"]');
    expect(status?.textContent).toBe("");

    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("applies a setting per group and leaves the others alone", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.click(radio("Text size", "150%"));
    fireEvent.click(radio("Line and letter spacing", "Relaxed"));

    const root = document.documentElement;
    expect(root.getAttribute("data-a11y-text")).toBe("150");
    expect(root.getAttribute("data-a11y-spacing")).toBe("relaxed");
    expect(root.getAttribute("data-a11y-contrast")).toBe("standard");
    expect(root.getAttribute("data-a11y-font")).toBe("default");
  });

  it("writes the six documented fields and nothing else", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.click(radio("Motion", "Reduce"));
    const stored = JSON.parse(storage.getItem(A11Y_STORAGE_KEY)!);
    expect(Object.keys(stored).sort()).toEqual(
      ["contrast", "font", "links", "motion", "spacing", "textSize"].sort(),
    );
  });
});

describe("Resetting", () => {
  it("puts every preference back and says so", async () => {
    const stored: A11yPrefs = {
      textSize: 150,
      spacing: "relaxed",
      contrast: "high",
      motion: "reduce",
      links: "on",
      font: "readable",
    };
    storage.setItem(A11Y_STORAGE_KEY, serialisePrefs(stored));

    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    const root = document.documentElement;
    expect(root.getAttribute("data-a11y-text")).toBe("100");
    expect(root.getAttribute("data-a11y-spacing")).toBe("normal");
    expect(root.getAttribute("data-a11y-contrast")).toBe("standard");
    expect(root.getAttribute("data-a11y-motion")).toBe("system");
    expect(root.getAttribute("data-a11y-links")).toBe("off");
    expect(root.getAttribute("data-a11y-font")).toBe("default");
    expect(screen.getByRole("status").textContent).toBe(
      "Accessibility settings reset to defaults",
    );
  });

  it("moves the selection back to the first option in each group", async () => {
    storage.setItem(
      A11Y_STORAGE_KEY,
      serialisePrefs({ ...DEFAULT_A11Y_PREFS, textSize: 150, contrast: "high" }),
    );

    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));

    expect(radio("Text size", "100%").checked).toBe(true);
    expect(radio("Contrast", "Standard").checked).toBe(true);
  });
});

describe("closing", () => {
  it("closes on Escape", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(dialog().open).toBe(false));
  });

  it("returns focus to the trigger that opened it", async () => {
    renderToolbar();
    const [headerTrigger] = screen.getAllByRole("button", { name: "Accessibility settings" });
    act(() => headerTrigger.focus());

    fireEvent.click(headerTrigger);
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(document.activeElement).toBe(headerTrigger));
  });

  it("returns focus to the dock trigger when that was the one used", async () => {
    renderToolbar();
    const dockTrigger = screen.getAllByRole("button", { name: "Accessibility settings" })[1];
    act(() => dockTrigger.focus());

    fireEvent.click(dockTrigger);
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Close accessibility settings" }));

    await waitFor(() => expect(document.activeElement).toBe(dockTrigger));
  });

  it("closes on the close button", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Close accessibility settings" }));
    await waitFor(() => expect(dialog().open).toBe(false));
  });

  it("closes when the backdrop is clicked, but not when the panel is", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    fireEvent.click(screen.getByRole("group", { name: "Contrast" }));
    expect(dialog().open).toBe(true);

    fireEvent.click(dialog());
    await waitFor(() => expect(dialog().open).toBe(false));
  });

  it("mirrors a native close back into state, so the trigger is not left expanded", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    // A platform dismiss gesture closes the element without going through the component.
    act(() => {
      dialog().removeAttribute("open");
      dialog().dispatchEvent(new Event("close"));
    });

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Accessibility settings" })[0],
      ).toHaveAttribute("aria-expanded", "false"),
    );
  });

  it("moves focus into the panel on open", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));
    await waitFor(() => expect(dialog().contains(document.activeElement)).toBe(true));
  });

  it("traps Tab inside the panel", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));

    const focusable = Array.from(
      dialog().querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    expect(focusable.length).toBeGreaterThan(2);

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    act(() => last.focus());
    fireEvent.keyDown(dialog(), { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(dialog(), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("locks the page behind it while open and restores it after", async () => {
    renderToolbar();
    openPanel();
    await waitFor(() => expect(dialog().open).toBe(true));
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));
  });
});

describe("server rendering", () => {
  it("renders the shut panel and both triggers with the default state", () => {
    // No storage read during render: the server snapshot is always the defaults, so the markup the
    // browser hydrates cannot disagree with what was sent.
    storage.setItem(A11Y_STORAGE_KEY, serialisePrefs({ ...DEFAULT_A11Y_PREFS, textSize: 150 }));

    const { container } = renderToolbar();
    const triggers = container.querySelectorAll('[aria-expanded="false"]');
    expect(triggers).toHaveLength(2);
    expect(container.querySelector("dialog[open]")).toBeNull();
    // A closed dialog is out of the accessibility tree, so its live region is queried through the DOM.
    expect(container.querySelector('[role="status"]')?.textContent).toBe("");
  });
});
