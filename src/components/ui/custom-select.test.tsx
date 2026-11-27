import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CustomSelect, type CustomSelectOption } from "./custom-select";

/* The shared vitest setup does not enable globals, so Testing Library cannot
   register its automatic cleanup. Each UI test file cleans up explicitly. */
afterEach(cleanup);

const STAGES: readonly CustomSelectOption[] = [
  { value: "frozen-lotus", label: "Frozen Lotus" },
  { value: "mainstage", label: "MainStage" },
  { value: "cage", label: "Cage" },
];

/** A controllable parent, so a test can read what the select reported. */
function Harness({
  options = STAGES,
  initial = "",
  disabled = false,
  onChange,
}: {
  options?: readonly CustomSelectOption[];
  initial?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CustomSelect
      id="stage"
      value={value}
      disabled={disabled}
      placeholder="Choose a stage"
      options={options}
      ariaLabelledBy="stage-label"
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

function trigger(): HTMLElement {
  return screen.getByRole("combobox");
}

function optionNames(): string[] {
  return screen.getAllByRole("option").map((option) => option.textContent ?? "");
}

describe("CustomSelect", () => {
  it("announces itself as a collapsed combobox named by its label element", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness />
      </>,
    );

    const control = trigger();
    expect(control).toHaveAccessibleName("Stage");
    expect(control).toHaveAttribute("aria-expanded", "false");
    expect(control).toHaveAttribute("aria-haspopup", "listbox");
    // The listbox is not in the document until it is opened, so nothing points at
    // a missing id.
    expect(control).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the placeholder while no option matches the value", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness />
      </>,
    );

    expect(trigger()).toHaveTextContent("Choose a stage");
    expect(trigger()).toHaveAttribute("data-value", "");
  });

  it("opens a named listbox on click and marks the current option as selected", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness initial="mainstage" />
      </>,
    );

    fireEvent.click(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toHaveAccessibleName("Stage");
    expect(optionNames()).toEqual(["Frozen Lotus", "MainStage", "Cage"]);
    expect(screen.getByRole("option", { name: "MainStage" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: "Cage" })).toHaveAttribute("aria-selected", "false");
  });

  it("reports the chosen value, closes, and shows its label", () => {
    const onChange = vi.fn();
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness onChange={onChange} />
      </>,
    );

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: "Cage" }));

    expect(onChange).toHaveBeenCalledWith("cage");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent("Cage");
    expect(trigger()).toHaveAttribute("data-value", "cage");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    // Focus goes back to the trigger, so the reader is where they left off.
    expect(trigger()).toHaveFocus();
  });

  it("closes on Escape without choosing, and keeps the previous value", () => {
    const onChange = vi.fn();
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness initial="cage" onChange={onChange} />
      </>,
    );

    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent("Cage");
  });

  it("closes on a press outside the control", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness />
      </>,
    );

    fireEvent.click(trigger());
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("starts at the top on ArrowDown and moves the active option down", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness />
      </>,
    );

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveAttribute("aria-activedescendant");
    expect(screen.getByRole("option", { name: "Frozen Lotus" })).toHaveAttribute(
      "data-active",
      "true",
    );

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "MainStage" })).toHaveAttribute("data-active", "true");
  });

  it("opens on the last option with ArrowUp, then wraps upwards", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness />
      </>,
    );

    fireEvent.keyDown(trigger(), { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "Cage" })).toHaveAttribute("data-active", "true");

    fireEvent.keyDown(trigger(), { key: "ArrowUp" });
    fireEvent.keyDown(trigger(), { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "Frozen Lotus" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("opens on the chosen option, so the arrow keys move from where the reader is", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness initial="cage" />
      </>,
    );

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    // Only one option follows Cage, so the highlight wraps to the first.
    expect(screen.getByRole("option", { name: "Frozen Lotus" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("chooses the active option on Enter", () => {
    const onChange = vi.fn();
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness onChange={onChange} />
      </>,
    );

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("mainstage");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("chooses the active option on Space as well", () => {
    const onChange = vi.fn();
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness onChange={onChange} />
      </>,
    );

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: " " });

    expect(onChange).toHaveBeenCalledWith("frozen-lotus");
  });

  it("jumps to the ends with Home and End", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness initial="mainstage" />
      </>,
    );

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: "End" });
    expect(screen.getByRole("option", { name: "Cage" })).toHaveAttribute("data-active", "true");

    fireEvent.keyDown(trigger(), { key: "Home" });
    expect(screen.getByRole("option", { name: "Frozen Lotus" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("jumps to an option by its first letter", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness />
      </>,
    );

    fireEvent.keyDown(trigger(), { key: "c" });

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Cage" })).toHaveAttribute("data-active", "true");
  });

  it("skips an option the data marks as disabled, and refuses to choose it", () => {
    const onChange = vi.fn();
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness
          onChange={onChange}
          options={[
            { value: "a", label: "Available" },
            { value: "b", label: "Sold out pass", disabled: true },
            { value: "c", label: "Also available" },
          ]}
        />
      </>,
    );

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });

    expect(screen.getByRole("option", { name: "Also available" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("option", { name: "Sold out pass" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    fireEvent.click(screen.getByRole("option", { name: "Sold out pass" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names its groups and keeps the options in reading order inside them", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <CustomSelect
          id="stage"
          value=""
          ariaLabelledBy="stage-label"
          placeholder="Choose a stage"
          onChange={() => undefined}
          groups={[
            { label: "Mountain", options: [{ value: "frozen", label: "Frozen Lotus" }] },
            {
              label: "Village",
              options: [
                { value: "mainstage", label: "MainStage" },
                { value: "cage", label: "Cage" },
              ],
            },
          ]}
        />
      </>,
    );

    fireEvent.click(trigger());

    expect(screen.getByRole("group", { name: "Mountain" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Village" })).toBeInTheDocument();
    expect(optionNames()).toEqual(["Frozen Lotus", "MainStage", "Cage"]);
  });

  it("does nothing while disabled", () => {
    const onChange = vi.fn();
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness disabled onChange={onChange} />
      </>,
    );

    expect(trigger()).toBeDisabled();
    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is a single focus stop, not one per option", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness />
      </>,
    );

    fireEvent.click(trigger());

    for (const option of screen.getAllByRole("option")) {
      expect(option).not.toHaveAttribute("tabindex");
    }
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("names the listbox from the trigger when the caller labels it with a visible label only", () => {
    function LabelledByFor() {
      const [choice, setChoice] = useState("");
      return (
        <CustomSelect id="stage" value={choice} onChange={setChoice} options={STAGES} />
      );
    }
    render(
      <>
        <label htmlFor="stage">Stage</label>
        <LabelledByFor />
      </>,
    );

    fireEvent.click(trigger());

    // A control named solely by `<label for>` must not open a nameless list.
    expect(screen.getByRole("listbox")).toHaveAccessibleName("Stage");
  });

  it("hangs the list above the trigger when there is no room below it", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness />
      </>,
    );

    const control = trigger();
    control.getBoundingClientRect = () =>
      ({
        x: 16,
        y: 700,
        top: 700,
        bottom: 744,
        left: 16,
        right: 280,
        width: 264,
        height: 44,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(768);

    fireEvent.click(control);

    expect(screen.getByRole("listbox")).toHaveAttribute("data-placement", "up");
  });

  it("opens downward when there is room below the trigger", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <Harness />
      </>,
    );

    const control = trigger();
    control.getBoundingClientRect = () =>
      ({
        x: 16,
        y: 100,
        top: 100,
        bottom: 144,
        left: 16,
        right: 280,
        width: 264,
        height: 44,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(900);

    fireEvent.click(control);

    expect(screen.getByRole("listbox")).toHaveAttribute("data-placement", "down");
  });

  it("keeps the value it is given when the caller controls it from outside", () => {
    const { rerender } = render(
      <>
        <span id="stage-label">Stage</span>
        <CustomSelect
          id="stage"
          value="mainstage"
          ariaLabelledBy="stage-label"
          placeholder="Choose a stage"
          options={STAGES}
          onChange={() => undefined}
        />
      </>,
    );

    expect(trigger()).toHaveTextContent("MainStage");

    rerender(
      <>
        <span id="stage-label">Stage</span>
        <CustomSelect
          id="stage"
          value="cage"
          ariaLabelledBy="stage-label"
          placeholder="Choose a stage"
          options={STAGES}
          onChange={() => undefined}
        />
      </>,
    );

    expect(trigger()).toHaveTextContent("Cage");
  });

  it("falls back to the placeholder when the value is not in the list", () => {
    render(
      <>
        <span id="stage-label">Stage</span>
        <CustomSelect
          id="stage"
          value="withdrawn-stage"
          ariaLabelledBy="stage-label"
          placeholder="Choose a stage"
          options={STAGES}
          onChange={() => undefined}
        />
      </>,
    );

    expect(trigger()).toHaveTextContent("Choose a stage");
  });
});
