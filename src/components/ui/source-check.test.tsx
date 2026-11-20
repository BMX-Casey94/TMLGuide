import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CheckSeparator, SOURCE_CHECK_SEPARATOR } from "./source-check";

/* The shared vitest setup does not enable globals, so Testing Library cannot
   register its automatic cleanup. Each UI test file cleans up explicitly. */
afterEach(cleanup);

describe("CheckSeparator", () => {
  it("draws an em dash", () => {
    const { container } = render(<CheckSeparator />);

    expect(container.textContent).toContain(SOURCE_CHECK_SEPARATOR);
    expect(SOURCE_CHECK_SEPARATOR).toBe("—");
  });

  it("keeps the dash on the same line as the date it introduces", () => {
    const { container } = render(<CheckSeparator />);

    /* The trailing space is non-breaking, so a narrow column breaks before the
       mark instead of leaving an em dash stranded at the end of a line. */
    expect(container.textContent).toBe("—\u00A0");
  });

  it("hides only the glyph from assistive technology, not the space", () => {
    const { container } = render(<CheckSeparator />);

    const glyph = container.querySelector('[aria-hidden="true"]');
    expect(glyph).toHaveTextContent(SOURCE_CHECK_SEPARATOR);
    // A screen reader still gets a space, so the host and "Checked" stay apart.
    expect(container.textContent).toContain("\u00A0");
  });

  it("sits between a host and its check date with a space after the dash", () => {
    const { container } = render(
      <p>
        Source: example.com
        <CheckSeparator />
        Checked 18 Nov 2026
      </p>,
    );

    expect(container.textContent).toBe("Source: example.com—\u00A0Checked 18 Nov 2026");
    // The visual gap before the dash is the element's margin, in the stylesheet.
    expect(container.querySelector(".tml-check-sep")).toHaveClass("tml-check-sep");
  });

  it("accepts extra classes without dropping its own", () => {
    const { container } = render(<CheckSeparator className="extra-class" />);

    expect(container.querySelector(".tml-check-sep")).toHaveClass("tml-check-sep", "extra-class");
  });
});
