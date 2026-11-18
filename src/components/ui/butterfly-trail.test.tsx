import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ButterflyTrail } from "./butterfly-trail";

/* The shared vitest setup does not enable globals, so Testing Library cannot
   register its automatic cleanup. Each UI test file cleans up explicitly. */
afterEach(cleanup);

describe("ButterflyTrail", () => {
  it("is decorative and cannot capture pointer events", () => {
    const { container } = render(<ButterflyTrail />);
    const root = container.firstElementChild;

    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("points at the trail artwork", () => {
    const { container } = render(<ButterflyTrail />);
    const image = container.querySelector("img");

    expect(image?.getAttribute("src")).toContain("butterfly-trail-1280.webp");
  });

  it("sets the requested opacity and width as custom properties", () => {
    const { container } = render(<ButterflyTrail opacity={0.4} width="min(300px, 60vw)" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue("--bt-opacity")).toBe("0.4");
    expect(root.style.getPropertyValue("--bt-width")).toBe("min(300px, 60vw)");
  });

  it("clamps opacity into the 0 to 1 range", () => {
    const { container: over } = render(<ButterflyTrail opacity={4} />);
    expect((over.firstElementChild as HTMLElement).style.getPropertyValue("--bt-opacity")).toBe("1");

    cleanup();

    const { container: under } = render(<ButterflyTrail opacity={-2} />);
    expect((under.firstElementChild as HTMLElement).style.getPropertyValue("--bt-opacity")).toBe(
      "0",
    );
  });

  it("mirrors the artwork through a class for the left side, not an inline transform", () => {
    const { container: right } = render(<ButterflyTrail side="right" />);
    const { container: left } = render(<ButterflyTrail side="left" />);

    const rightClass = right.firstElementChild?.className ?? "";
    const leftClass = left.firstElementChild?.className ?? "";

    expect(rightClass).not.toBe(leftClass);
  });
});
