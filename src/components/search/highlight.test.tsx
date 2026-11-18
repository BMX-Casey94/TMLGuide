import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Highlight } from "./highlight";
import { queryTokens } from "@/lib/search/text";

describe("Highlight", () => {
  it("renders the text unchanged when nothing matches", () => {
    const { container } = render(<Highlight text="DreamVille lockers" tokens={queryTokens("zzz")} />);
    expect(container.textContent).toBe("DreamVille lockers");
    expect(container.querySelector("mark")).toBeNull();
  });

  it("wraps a matched word in a mark element", () => {
    const { container } = render(<Highlight text="DreamVille lockers" tokens={queryTokens("lockers")} />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("lockers");
    // The whole string survives, so a screen reader reads a sentence, not words.
    expect(container.textContent).toBe("DreamVille lockers");
  });

  it("marks a prefix, matching the ranker's rule", () => {
    const { container } = render(<Highlight text="DreamVille lockers" tokens={queryTokens("dreamv")} />);
    expect(container.querySelector("mark")?.textContent).toBe("DreamVille");
  });

  it("is accent-insensitive while showing the original characters", () => {
    const { container } = render(<Highlight text="São Paulo" tokens={queryTokens("sao")} />);
    expect(container.querySelector("mark")?.textContent).toBe("São");
  });

  it("marks every token in a multi-word query", () => {
    const { container } = render(
      <Highlight text="Full Madness Pass" tokens={queryTokens("madness pass")} />,
    );
    const marked = Array.from(container.querySelectorAll("mark")).map((node) => node.textContent);
    expect(marked).toEqual(["Madness", "Pass"]);
  });

  it("does not carry meaning in colour alone", () => {
    // The matched run is bold as well as tinted, so the emphasis survives a
    // monochrome rendering and a colour-blind reader loses nothing.
    const { container } = render(<Highlight text="Easy Tent" tokens={queryTokens("tent")} />);
    expect(container.querySelector("mark")?.className).toContain("font-semibold");
  });

  it("renders markup in the source text as characters", () => {
    const { container } = render(
      <Highlight text="<b>bold</b>" tokens={queryTokens("bold")} />,
    );
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toBe("<b>bold</b>");
    expect(screen.getByText(/<b>/)).toBeTruthy();
  });

  it("renders nothing for empty text", () => {
    const { container } = render(<Highlight text="" tokens={["a"]} />);
    expect(container.textContent).toBe("");
  });
});
