import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import AdminPage, { metadata } from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("the admin page", () => {
  it("is not indexed and not followed", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("has one h1 and one main landmark", () => {
    const { container } = render(<AdminPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Admin console");
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main")?.id).toBe("main");
  });

  it("shows the honest not-configured state when there is no project", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    render(<AdminPage />);

    // Nothing sensitive is claimed, and the operator is told what to set.
    expect(screen.getByRole("heading", { name: "Sign-in is not configured" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("renders the sign-in form when the project is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    render(<AdminPage />);

    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("says what the console is guarded by, so the position is visible", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    render(<AdminPage />);

    expect(screen.getByText(/authorised on the server/i)).toBeInTheDocument();
    expect(screen.getByText(/audit log/i)).toBeInTheDocument();
  });
});
