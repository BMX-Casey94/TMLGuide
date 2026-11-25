import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SwRegister } from "./sw-register";

describe("SwRegister", () => {
  const originalServiceWorker = navigator.serviceWorker;
  const originalOnLineDescriptor = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "onLine",
  );

  function setOnline(value: boolean) {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => value,
    });
  }

  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (originalServiceWorker === undefined) {
      Reflect.deleteProperty(navigator, "serviceWorker");
    } else {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: originalServiceWorker,
      });
    }
    if (originalOnLineDescriptor) {
      Object.defineProperty(Navigator.prototype, "onLine", originalOnLineDescriptor);
    }
  });

  it("registers /sw.js when serviceWorker is supported and renders no banner while online", () => {
    const register = vi.fn().mockResolvedValue({ scope: "/" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    const { container } = render(<SwRegister />);

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(container.firstChild).toBeNull();
  });

  it("handles registration failure silently without throwing", async () => {
    const register = vi.fn().mockRejectedValue(new Error("blocked"));
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    expect(() => render(<SwRegister />)).not.toThrow();
    await Promise.resolve();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("shows an accessible offline banner when offline and clears it when back online", () => {
    const register = vi.fn().mockResolvedValue({ scope: "/" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<SwRegister />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/You are offline/i);
    expect(screen.getByRole("link", { name: "Offline guides" })).toHaveAttribute(
      "href",
      "/offline",
    );

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
