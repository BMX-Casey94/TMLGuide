import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InlineText, classifyHref, inlinePlainText, parseInline } from "./inline-text";

afterEach(cleanup);

/** The tree's plain text, for assertions about what survived a parse. */
function textOf(source: string): string {
  return inlinePlainText(parseInline(source));
}

describe("the supported subset", () => {
  it("parses bold", () => {
    const nodes = parseInline("This is **bold** text.");
    expect(nodes).toEqual([
      { kind: "text", value: "This is " },
      { kind: "strong", children: [{ kind: "text", value: "bold" }] },
      { kind: "text", value: " text." },
    ]);
  });

  it("parses italic", () => {
    const nodes = parseInline("An *italic* word.");
    expect(nodes).toEqual([
      { kind: "text", value: "An " },
      { kind: "em", children: [{ kind: "text", value: "italic" }] },
      { kind: "text", value: " word." },
    ]);
  });

  it("parses an internal link", () => {
    const nodes = parseInline("See [the guide](/guides/belgium) for more.");
    expect(nodes[1]).toEqual({
      kind: "link",
      href: "/guides/belgium",
      external: false,
      children: [{ kind: "text", value: "the guide" }],
    });
  });

  it("parses an external https link", () => {
    const nodes = parseInline("[Official](https://belgium.tomorrowland.com/en/)");
    expect(nodes).toEqual([
      {
        kind: "link",
        href: "https://belgium.tomorrowland.com/en/",
        external: true,
        children: [{ kind: "text", value: "Official" }],
      },
    ]);
  });

  it("nests emphasis inside a link label", () => {
    const nodes = parseInline("[**bold label**](/about)");
    expect(nodes[0]).toMatchObject({
      kind: "link",
      href: "/about",
      children: [{ kind: "strong", children: [{ kind: "text", value: "bold label" }] }],
    });
  });

  it("nests a link inside bold", () => {
    const nodes = parseInline("**see [here](/about)**");
    expect(nodes[0]).toMatchObject({
      kind: "strong",
      children: [
        { kind: "text", value: "see " },
        { kind: "link", href: "/about" },
      ],
    });
  });

  it("returns an empty tree for empty input", () => {
    expect(parseInline("")).toEqual([]);
  });
});

describe("hostile and malformed input", () => {
  it("refuses a javascript: URL and shows the literal text", () => {
    const source = "[click](javascript:alert(1))";
    expect(parseInline(source)).toEqual([{ kind: "text", value: source }]);
    expect(textOf(source)).toBe(source);
  });

  it("refuses a javascript: URL with mixed case and whitespace", () => {
    for (const href of ["JavaScript:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)"]) {
      expect(classifyHref(href)).toBeNull();
    }
  });

  it("refuses a data: URL", () => {
    expect(classifyHref("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
  });

  it("refuses a protocol-relative URL", () => {
    expect(classifyHref("//evil.example/path")).toBeNull();
  });

  it("refuses a backslash path that browsers read as protocol-relative", () => {
    expect(classifyHref("/\\evil.example")).toBeNull();
  });

  it("refuses an http link, which the content model does not allow", () => {
    expect(classifyHref("http://belgium.tomorrowland.com/")).toBeNull();
  });

  it("refuses an https URL that embeds credentials", () => {
    expect(classifyHref("https://user:secret@evil.example/")).toBeNull();
  });

  it("refuses a mailto link", () => {
    expect(classifyHref("mailto:someone@example.com")).toBeNull();
  });

  it("accepts an internal path and a query string on one", () => {
    expect(classifyHref("/guides")).toBe("internal");
    expect(classifyHref("/guides/tickets?edition=winter")).toBe("internal");
    expect(classifyHref("/guides#sources")).toBe("internal");
  });

  it("refuses a link target longer than 2048 characters", () => {
    expect(classifyHref(`https://example.com/${"a".repeat(2100)}`)).toBeNull();
  });

  it("keeps a nested bracket pair inside the link label", () => {
    const source = "[a [b] c](/about)";
    const nodes = parseInline(source);
    const link = nodes.find((node) => node.kind === "link");
    // The inner pair belongs to the label, so the outer pair is still a link.
    expect(link).toMatchObject({ kind: "link", href: "/about" });
    expect(inlinePlainText(nodes)).toBe("a [b] c");
  });

  it("renders a complete link with a nested bracket pair in the label", () => {
    const nodes = parseInline("[[bracketed] label](/about)");
    const link = nodes.find((node) => node.kind === "link");
    expect(link).toMatchObject({ kind: "link", href: "/about" });
  });

  it("keeps an unmatched opening bracket as text", () => {
    expect(textOf("A [stray bracket.")).toBe("A [stray bracket.");
  });

  it("keeps an unmatched link parenthesis as text", () => {
    const source = "[label](/guides";
    expect(textOf(source)).toBe(source);
    expect(parseInline(source).some((node) => node.kind === "link")).toBe(false);
  });

  it("keeps unmatched emphasis markers as text", () => {
    expect(textOf("A **stray bold marker.")).toBe("A **stray bold marker.");
    expect(textOf("An *unpaired italic.")).toBe("An *unpaired italic.");
  });

  it("does not hang on a long run of unmatched markers", () => {
    const source = `${"[".repeat(4000)}${"*".repeat(4000)}`;
    const started = Date.now();
    const nodes = parseInline(source);
    expect(textOf(source)).toBe(source);
    expect(nodes).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("does not hang on a very long well-formed string", () => {
    const source = `${"word ".repeat(20000)}**bold**`;
    const started = Date.now();
    const nodes = parseInline(source);
    expect(textOf(source)).toBe(`${"word ".repeat(20000)}bold`);
    expect(nodes.some((node) => node.kind === "strong")).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("treats an empty emphasis pair as literal characters", () => {
    expect(textOf("a **** b")).toBe("a **** b");
    expect(textOf("a ** b")).toBe("a ** b");
  });

  it("treats an empty link label as literal text", () => {
    expect(textOf("[](/about)")).toBe("[](/about)");
  });

  it("caps deep nesting rather than recursing without limit", () => {
    const deep = `${"**".repeat(20)}deep${"**".repeat(20)}`;
    expect(() => parseInline(deep)).not.toThrow();
  });
});

describe("rendering", () => {
  it("renders HTML tags in the data as visible text, not as elements", () => {
    render(<InlineText text={'A <script>alert("x")</script> tag and <b>bold</b>.'} />);

    const wrapper = screen.getByText(/A <script>/);
    expect(wrapper).toBeInTheDocument();
    // No element was created from the content.
    expect(wrapper.querySelector("script")).toBeNull();
    expect(wrapper.querySelector("b")).toBeNull();
    expect(wrapper.textContent).toBe('A <script>alert("x")</script> tag and <b>bold</b>.');
  });

  it("renders emphasis with real elements", () => {
    const { container } = render(<InlineText text="A **strong** and an *emphasised* word." />);

    expect(container.querySelector("strong")?.textContent).toBe("strong");
    expect(container.querySelector("em")?.textContent).toBe("emphasised");
  });

  it("uses one link element per link and keeps an unused label out of it", () => {
    const { container } = render(<InlineText text="Read [the guide](/guides) now." />);

    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/guides");
    expect(links[0]).toHaveAttribute("class", "tml-guide-link");
  });

  it("gives an external link rel=noopener noreferrer and no target", () => {
    const { container } = render(<InlineText text="[Source](https://example.com/page)" />);

    const link = container.querySelector("a");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).not.toHaveAttribute("target");
  });

  it("renders a refused link as the literal source text", () => {
    const source = "[bad](javascript:alert(1))";
    const { container } = render(<InlineText text={source} />);

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe(source);
  });
});
