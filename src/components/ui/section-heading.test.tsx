import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SectionAction, SectionHeading } from "./section-heading";

/* The shared vitest setup does not enable globals, so Testing Library cannot
   register its automatic cleanup. Each UI test file cleans up explicitly. */
afterEach(cleanup);

describe("SectionHeading", () => {
  it("renders a level 2 heading with the kicker and lede", () => {
    render(
      <SectionHeading
        id="example-section"
        kicker="Example kicker"
        title="Example section title"
        lede="Example lede copy."
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Example section title" })).toHaveAttribute(
      "id",
      "example-section",
    );
    expect(screen.getByText("Example kicker")).toBeInTheDocument();
    expect(screen.getByText("Example lede copy.")).toBeInTheDocument();
  });

  it("omits the aside when there is neither lede nor action", () => {
    const { container } = render(<SectionHeading kicker="Example kicker" title="Example title" />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renders the action slot as a single link", () => {
    render(
      <SectionHeading
        kicker="Example kicker"
        title="Example title"
        action={<SectionAction href="/example">Example action</SectionAction>}
      />,
    );

    const link = screen.getByRole("link", { name: "Example action" });
    expect(link).toHaveAttribute("href", "/example");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
