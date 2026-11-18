import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GoldDivider } from "./gold-divider";

/* The shared vitest setup does not enable globals, so Testing Library cannot
   register its automatic cleanup. Each UI test file cleans up explicitly. */
afterEach(cleanup);

describe("GoldDivider", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<GoldDivider />);
    const divider = container.firstElementChild;

    expect(divider).toHaveAttribute("aria-hidden", "true");
    expect(divider).toHaveAttribute("role", "presentation");
  });

  it("draws the hairline and the sparkle even without a butterfly", () => {
    const { container } = render(<GoldDivider />);

    expect(container.querySelectorAll("svg")).toHaveLength(2);
    /* one path: the sparkle star */
    expect(container.querySelectorAll("path")).toHaveLength(1);
  });

  it("uses unique gradient ids so several dividers can share a page", () => {
    const { container } = render(
      <>
        <GoldDivider />
        <GoldDivider butterfly="left" />
      </>,
    );

    const ids = Array.from(container.querySelectorAll("linearGradient")).map(
      (gradient) => gradient.id,
    );

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) {
      expect(id).not.toBe("");
    }
  });

  it.each(["left", "right"] as const)("adds the butterfly artwork on the %s", (butterfly) => {
    const { container } = render(<GoldDivider butterfly={butterfly} />);
    const butterflyGroup = container.querySelector("g[transform]");

    expect(butterflyGroup).not.toBeNull();
    expect(butterflyGroup?.getAttribute("transform")).toBe(
      butterfly === "left" ? "translate(-46 0)" : "translate(46 0)",
    );
    /* four wings, a body and two antennae */
    expect(butterflyGroup?.querySelectorAll("path")).toHaveLength(7);
  });

  it("exposes no text content", () => {
    const { container } = render(<GoldDivider />);
    expect(screen.queryByText(/./)).not.toBeInTheDocument();
    expect(container.textContent).toBe("");
  });
});
