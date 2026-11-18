import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TABBAR_HEIGHT_PX } from "./layout-metrics";
import { SiteShell } from "./site-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

afterEach(cleanup);

describe("SiteShell", () => {
  it("renders children inside the skip-link target without adding a main landmark", () => {
    render(
      <SiteShell>
        <main id="main">
          <h1>Page heading</h1>
        </main>
      </SiteShell>,
    );

    const target = document.getElementById("content-start");
    expect(target).not.toBeNull();
    expect(target).toContainElement(screen.getByRole("main"));
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Page heading");
  });

  it("composes the banner, content info and mobile navigation landmarks", () => {
    render(
      <SiteShell>
        <main id="main">Content</main>
      </SiteShell>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile" })).toBeInTheDocument();
  });

  it("provides edition state to every switcher", async () => {
    render(
      <SiteShell>
        <main id="main">Content</main>
      </SiteShell>,
    );

    const groups = await screen.findAllByRole("radiogroup", { name: "Choose edition" });
    expect(groups).toHaveLength(2);
    expect(document.body.dataset.ed).toBe("belgium");
  });

  it("exports the tab bar height the layout owner needs", () => {
    expect(TABBAR_HEIGHT_PX).toBe(64);
  });
});
