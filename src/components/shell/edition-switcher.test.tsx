import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EditionProvider, EDITION_STORAGE_KEY } from "./edition-context";
import { EditionSwitcher } from "./edition-switcher";
import { resetEditionState } from "./test-storage";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function renderSwitcher() {
  return render(
    <EditionProvider>
      <EditionSwitcher variant="inline" />
    </EditionProvider>,
  );
}

function radios(): HTMLElement[] {
  return screen.getAllByRole("radio");
}

function checkedRadio(): HTMLElement {
  const checked = radios().find((radio) => radio.getAttribute("aria-checked") === "true");
  if (checked === undefined) throw new Error("No radio is checked");
  return checked;
}

let storage: Storage;

beforeEach(() => {
  storage = resetEditionState();
});

afterEach(() => {
  cleanup();
  resetEditionState();
});

describe("EditionSwitcher", () => {
  it("exposes a labelled radiogroup with exactly one checked option", async () => {
    renderSwitcher();

    const group = screen.getByRole("radiogroup", { name: "Choose edition" });
    expect(group).toBeInTheDocument();
    expect(radios()).toHaveLength(3);
    expect(radios().filter((radio) => radio.getAttribute("aria-checked") === "true")).toHaveLength(1);

    await waitFor(() => expect(checkedRadio()).toHaveAccessibleName("Belgium"));
  });

  it("applies the default edition to the body and gives the group one tab stop", async () => {
    renderSwitcher();

    await waitFor(() => expect(document.body.dataset.ed).toBe("belgium"));
    const tabbable = radios().filter((radio) => radio.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBe(checkedRadio());
  });

  it("changes the edition on click, updates body data-ed and persists the choice", async () => {
    renderSwitcher();
    await waitFor(() => expect(document.body.dataset.ed).toBe("belgium"));

    fireEvent.click(screen.getByRole("radio", { name: "Winter" }));

    await waitFor(() => expect(document.body.dataset.ed).toBe("winter"));
    expect(screen.getByRole("radio", { name: "Winter" })).toHaveAttribute("aria-checked", "true");
    expect(storage.getItem(EDITION_STORAGE_KEY)).toBe("winter");
  });

  it("restores a stored edition on mount", async () => {
    storage.setItem(EDITION_STORAGE_KEY, "brasil");
    renderSwitcher();

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Brasil" })).toHaveAttribute("aria-checked", "true"),
    );
    expect(document.body.dataset.ed).toBe("brasil");
  });

  it("ignores a stored value that is not a known edition", async () => {
    storage.setItem(EDITION_STORAGE_KEY, "mars");
    renderSwitcher();

    await waitFor(() => expect(document.body.dataset.ed).toBe("belgium"));
    expect(screen.getByRole("radio", { name: "Belgium" })).toHaveAttribute("aria-checked", "true");
    expect(storage.getItem(EDITION_STORAGE_KEY)).toBe("mars");
  });

  it("ignores a stored value that is not a known edition and does not overwrite it", async () => {
    storage.setItem(EDITION_STORAGE_KEY, "   ");
    renderSwitcher();

    await waitFor(() => expect(document.body.dataset.ed).toBe("belgium"));
    expect(storage.getItem(EDITION_STORAGE_KEY)).toBe("   ");
  });

  it("works when storage throws, as in private mode", async () => {
    const throwing: Storage = {
      length: 0,
      clear: () => {
        throw new Error("blocked");
      },
      getItem: () => {
        throw new Error("blocked");
      },
      key: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    Object.defineProperty(window, "localStorage", { configurable: true, value: throwing });

    renderSwitcher();
    await waitFor(() => expect(document.body.dataset.ed).toBe("belgium"));

    fireEvent.click(screen.getByRole("radio", { name: "Winter" }));

    await waitFor(() => expect(document.body.dataset.ed).toBe("winter"));
    expect(screen.getByRole("radio", { name: "Winter" })).toHaveAttribute("aria-checked", "true");
  });

  it("moves selection with the arrow keys and wraps at both ends", async () => {
    renderSwitcher();
    await waitFor(() => expect(document.body.dataset.ed).toBe("belgium"));

    const belgium = screen.getByRole("radio", { name: "Belgium" });
    fireEvent.focus(belgium);

    fireEvent.keyDown(belgium, { key: "ArrowRight" });
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Winter" })).toHaveAttribute("aria-checked", "true"),
    );
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Winter" }));
    expect(storage.getItem(EDITION_STORAGE_KEY)).toBe("winter");

    fireEvent.keyDown(screen.getByRole("radio", { name: "Winter" }), { key: "ArrowRight" });
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Brasil" })).toHaveAttribute("aria-checked", "true"),
    );

    fireEvent.keyDown(screen.getByRole("radio", { name: "Brasil" }), { key: "ArrowRight" });
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Belgium" })).toHaveAttribute("aria-checked", "true"),
    );

    fireEvent.keyDown(screen.getByRole("radio", { name: "Belgium" }), { key: "ArrowLeft" });
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Brasil" })).toHaveAttribute("aria-checked", "true"),
    );
    expect(document.body.dataset.ed).toBe("brasil");
  });

  it("supports Home and End", async () => {
    renderSwitcher();
    await waitFor(() => expect(document.body.dataset.ed).toBe("belgium"));
    fireEvent.focus(screen.getByRole("radio", { name: "Belgium" }));

    fireEvent.keyDown(screen.getByRole("radio", { name: "Belgium" }), { key: "End" });
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Brasil" })).toHaveAttribute("aria-checked", "true"),
    );

    fireEvent.keyDown(screen.getByRole("radio", { name: "Brasil" }), { key: "Home" });
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Belgium" })).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("follows a change made in another tab", async () => {
    renderSwitcher();
    await waitFor(() => expect(document.body.dataset.ed).toBe("belgium"));

    storage.setItem(EDITION_STORAGE_KEY, "winter");
    window.dispatchEvent(
      new StorageEvent("storage", { key: EDITION_STORAGE_KEY, newValue: "winter" }),
    );

    await waitFor(() => expect(document.body.dataset.ed).toBe("winter"));
    expect(screen.getByRole("radio", { name: "Winter" })).toHaveAttribute("aria-checked", "true");
  });

  it("falls back to the default when another tab removes the key", async () => {
    storage.setItem(EDITION_STORAGE_KEY, "brasil");
    renderSwitcher();
    await waitFor(() => expect(document.body.dataset.ed).toBe("brasil"));

    storage.removeItem(EDITION_STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: EDITION_STORAGE_KEY, newValue: null }));

    await waitFor(() => expect(document.body.dataset.ed).toBe("belgium"));
  });

  it("renders the stacked variant with full-width segments", async () => {
    render(
      <EditionProvider>
        <EditionSwitcher variant="stacked" />
      </EditionProvider>,
    );

    const group = screen.getByRole("radiogroup", { name: "Choose edition" });
    expect(group).toHaveAttribute("data-variant", "stacked");
    await waitFor(() => expect(checkedRadio()).toHaveAccessibleName("Belgium"));
  });
});
