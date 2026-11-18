import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { COMPARISON_LIMIT, isComparisonFull, toggleSelection } from "./comparison";

/* The shared setup does not enable Testing Library's automatic cleanup. */
afterEach(cleanup);

describe("toggleSelection", () => {
  it("adds an id in selection order", () => {
    expect(toggleSelection([], "a")).toEqual(["a"]);
    expect(toggleSelection(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes an id that is already selected", () => {
    expect(toggleSelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("keeps the remaining order after a removal", () => {
    expect(toggleSelection(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("refuses a fourth selection at the default limit", () => {
    expect(toggleSelection(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
  });

  it("still removes a selection once the limit is reached", () => {
    // A full comparison must stay escapable, otherwise the page is a dead end.
    expect(toggleSelection(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("allows a fourth once the limit has a spare slot again", () => {
    const afterRemoval = toggleSelection(["a", "b", "c"], "c");
    expect(toggleSelection(afterRemoval, "d")).toEqual(["a", "b", "d"]);
  });

  it("respects an explicit limit", () => {
    expect(toggleSelection(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    expect(toggleSelection([], "a", 0)).toEqual([]);
  });

  it("does not mutate the array it was given", () => {
    const selected = ["a"];
    toggleSelection(selected, "b");
    expect(selected).toEqual(["a"]);
  });

  it("returns a fresh array for a refused addition", () => {
    const selected = ["a", "b", "c"];
    const result = toggleSelection(selected, "d");
    expect(result).not.toBe(selected);
    expect(result).toEqual(selected);
  });
});

describe("isComparisonFull", () => {
  it("reports full at the limit", () => {
    expect(isComparisonFull(["a", "b", "c"])).toBe(true);
  });

  it("reports not full below the limit", () => {
    expect(isComparisonFull(["a", "b"])).toBe(false);
    expect(isComparisonFull([])).toBe(false);
  });

  it("uses the shared limit of three", () => {
    expect(COMPARISON_LIMIT).toBe(3);
  });
});

describe("ComparisonProvider state through the pure helpers", () => {
  /**
   * A tiny harness rather than a component test: it proves the reducer the provider
   * uses behaves as the helpers say, without depending on the provider's internals.
   */
  function Harness() {
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <div>
        <output data-testid="selection">{selected.join(",")}</output>
        <output data-testid="full">{String(isComparisonFull(selected))}</output>
        <button type="button" onClick={() => setSelected((current) => toggleSelection(current, "a"))}>
          Toggle A
        </button>
        <button type="button" onClick={() => setSelected((current) => toggleSelection(current, "b"))}>
          Toggle B
        </button>
        <button type="button" onClick={() => setSelected((current) => toggleSelection(current, "c"))}>
          Toggle C
        </button>
        <button type="button" onClick={() => setSelected((current) => toggleSelection(current, "d"))}>
          Toggle D
        </button>
      </div>
    );
  }

  it("stops at three selections when driven through state", () => {
    const { getByRole, getByTestId } = render(<Harness />);

    for (const label of ["Toggle A", "Toggle B", "Toggle C", "Toggle D"]) {
      fireEvent.click(getByRole("button", { name: label }));
    }

    expect(getByTestId("selection").textContent).toBe("a,b,c");
    expect(getByTestId("full").textContent).toBe("true");
  });

  it("unticks a selection when the same control is used again", () => {
    const { getByRole, getByTestId } = render(<Harness />);

    fireEvent.click(getByRole("button", { name: "Toggle A" }));
    fireEvent.click(getByRole("button", { name: "Toggle A" }));

    expect(getByTestId("selection").textContent).toBe("");
  });
});
