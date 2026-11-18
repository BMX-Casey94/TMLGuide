import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card } from "./card";

/* The shared vitest setup does not enable globals, so Testing Library cannot
   register its automatic cleanup. Each UI test file cleans up explicitly. */
afterEach(cleanup);

describe("Card", () => {
  it("renders the title at the requested heading level", () => {
    render(<Card kicker="Example kicker" title="Example card" headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: "Example card" })).toBeInTheDocument();
  });

  it("defaults to a level 3 heading", () => {
    render(<Card kicker="Example kicker" title="Example card" />);
    expect(screen.getByRole("heading", { level: 3, name: "Example card" })).toBeInTheDocument();
  });

  it("renders a link variant as one anchor named by its content", () => {
    render(
      <Card kicker="Example kicker" title="Example linked card" href="/example">
        Example body copy.
      </Card>,
    );

    const link = screen.getByRole("link");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(link).toHaveAttribute("href", "/example");
    expect(link).toHaveAccessibleName(/Example linked card/);
  });

  it("renders no link when href is absent", () => {
    render(<Card kicker="Example kicker" title="Example card" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the value and unit in a stat card", () => {
    render(
      <Card
        variant="stat"
        kicker="Example statistic"
        value={400000}
        unit="people"
        label="Example label"
      />,
    );

    expect(screen.getByText("400000")).toBeInTheDocument();
    expect(screen.getByText("people")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Example label" })).toBeInTheDocument();
  });

  it("shows the status label as text on an alert card", () => {
    render(
      <Card variant="alert" kicker="Example alert" title="Example warning" statusLabel="Scam alert">
        Example guidance.
      </Card>,
    );

    expect(screen.getByText("Scam alert")).toBeVisible();
  });

  it("formats the verification date in en-GB", () => {
    render(<Card kicker="Example kicker" title="Example card" verifiedOn="2027-03-12" />);
    expect(screen.getByText("Checked")).toHaveTextContent("Checked 12 Mar 2027");
    expect(screen.getByText("12 Mar 2027")).toHaveAttribute("datetime", "2027-03-12");
  });

  it("formats a full timestamp without shifting the day", () => {
    render(
      <Card kicker="Example kicker" title="Example card" verifiedOn="2027-03-12T23:30:00Z" />,
    );
    expect(screen.getByText("12 Mar 2027")).toBeInTheDocument();
  });

  it("omits the verification line for an unparseable date", () => {
    render(<Card kicker="Example kicker" title="Example card" verifiedOn="not-a-date" />);
    expect(screen.queryByText(/Checked/)).not.toBeInTheDocument();
  });

  it("renders the badge when given", () => {
    render(<Card kicker="Example kicker" title="Example card" badge="Verified" />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });
});
