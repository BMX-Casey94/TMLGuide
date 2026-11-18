import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { TOOL_DISCLAIMER, ToolShell } from "./tool-shell";

afterEach(cleanup);

function renderShell() {
  return render(
    <ToolShell
      kicker="Money"
      title="Festival budget calculator"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Tools", href: "/tools" },
        { label: "Budget calculator" },
      ]}
      intro={<p>An introduction to the tool.</p>}
      sources={[
        {
          label: "Tomorrowland Belgium — 2027 ticket prices",
          url: "https://belgium.tomorrowland.com/en/tickets/",
          retrievedOn: "2026-11-18",
        },
        {
          label: "Tomorrowland Winter — payment conditions",
          url: "https://winter.tomorrowland.com/en/sales-info/payment-methods-and-conditions/",
          retrievedOn: "2026-11-18",
        },
      ]}
    >
      <p>Tool content</p>
    </ToolShell>,
  );
}

describe("ToolShell", () => {
  it("renders a single main landmark with the tool title as its h1", () => {
    renderShell();

    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByRole("heading", { level: 1, name: "Festival budget calculator" })).toBeInTheDocument();
    expect(screen.getByText("Money")).toBeInTheDocument();
  });

  it("renders a breadcrumb trail with the current page marked, not linked", () => {
    renderShell();

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const current = within(nav).getByText("Budget calculator");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.closest("a")).toBeNull();

    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Tools" })).toHaveAttribute("href", "/tools");
  });

  it("shows the independence disclaimer in full", () => {
    renderShell();
    expect(screen.getByText(TOOL_DISCLAIMER)).toBeInTheDocument();
    expect(TOOL_DISCLAIMER).toContain("not an official calculator");
    expect(TOOL_DISCLAIMER).toContain("not endorsed by Tomorrowland");
  });

  it("lists every source with a link and a checked date", () => {
    renderShell();

    const section = screen.getByRole("region", { name: "Sources" });
    const links = within(section).getAllByRole("link");
    expect(links).toHaveLength(2);

    const first = links[0];
    expect(first).toHaveAttribute("href", "https://belgium.tomorrowland.com/en/tickets/");
    expect(first).toHaveAttribute("rel", "noopener noreferrer");
    expect(first).toHaveAttribute("target", "_blank");

    const time = within(section).getAllByText("18 Nov 2026")[0];
    expect(time).toHaveAttribute("datetime", "2026-11-18");
  });

  it("omits an unparseable source date rather than printing an invalid one", () => {
    render(
      <ToolShell
        kicker="Money"
        title="A tool"
        crumbs={[{ label: "Home", href: "/" }, { label: "A tool" }]}
        intro={<p>Intro.</p>}
        sources={[{ label: "Source", url: "https://example.test", retrievedOn: "not-a-date" }]}
      >
        <p>Content</p>
      </ToolShell>,
    );

    expect(screen.getByRole("link", { name: "Source" })).toBeInTheDocument();
    expect(screen.queryByText(/Checked/)).not.toBeInTheDocument();
  });

  it("includes a noscript notice so a reader without JavaScript is not stranded", () => {
    const { container } = renderShell();

    /*
      jsdom parses <noscript> as raw text and exposes it with empty children, so
      asserting on its contents would test jsdom rather than the page. The
      element's presence is what matters here; its wording is covered by the
      server-rendered page in the build.
    */
    const noscript = container.querySelector("noscript");
    expect(noscript).not.toBeNull();
  });

  it("places the noscript notice before the interactive tool", () => {
    const { container } = renderShell();

    const noscript = container.querySelector("noscript");
    // The notice is in the server-rendered frame, not inside the calculator.
    expect(noscript).not.toBeNull();
    expect(noscript?.parentElement?.className).toBe("tool-page__inner");
  });

  it("writes the noscript notice and any extra note into the server HTML", async () => {
    /*
      jsdom empties <noscript> children, so the wording is checked against the
      server's own output, which is the HTML a reader without JavaScript gets.
    */
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(
      <ToolShell
        kicker="Money"
        title="A tool"
        crumbs={[{ label: "Home", href: "/" }, { label: "A tool" }]}
        intro={<p>Intro.</p>}
        sources={[]}
        noscriptNote={<p>The prices below are still readable.</p>}
      >
        <p>Content</p>
      </ToolShell>,
    );

    expect(html).toContain("<noscript>");
    expect(html).toMatch(/JavaScript is off/i);
    expect(html).toMatch(/prices below are still readable/i);
    expect(html).toMatch(/rendered on the server/i);
  });

  it("renders the tool itself", () => {
    renderShell();
    expect(screen.getByText("Tool content")).toBeInTheDocument();
  });

  it("names the sources section so it can be found by landmark", () => {
    renderShell();
    expect(screen.getByRole("heading", { level: 2, name: "Sources" })).toBeInTheDocument();
  });
});
