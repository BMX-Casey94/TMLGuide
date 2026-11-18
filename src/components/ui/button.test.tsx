import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, ButtonLink } from "./button";

/* The shared vitest setup does not enable globals, so Testing Library cannot
   register its automatic cleanup. Each UI test file cleans up explicitly. */
afterEach(cleanup);

describe("Button", () => {
  it("renders a button with the label as its accessible name", () => {
    render(<Button>Example action</Button>);
    expect(screen.getByRole("button", { name: "Example action" })).toBeInTheDocument();
  });

  it("is not clickable while loading and announces aria-busy", () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Example working" onClick={onClick}>
        Example action
      </Button>,
    );

    /* the accessible name stays the action; the visible text reports progress */
    const button = screen.getByRole("button", { name: "Example action" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Example working");

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("omits aria-busy when not loading", () => {
    render(<Button>Example action</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Example action
      </Button>,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onClick when enabled", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Example action</Button>);

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("ButtonLink", () => {
  it("renders a single anchor with the label as its accessible name", () => {
    render(<ButtonLink href="/example">Example link</ButtonLink>);

    const link = screen.getByRole("link", { name: "Example link" });
    expect(link).toHaveAttribute("href", "/example");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
