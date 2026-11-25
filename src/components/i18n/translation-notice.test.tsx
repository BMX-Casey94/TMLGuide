import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TranslationNotice } from "./translation-notice";

afterEach(cleanup);

describe("TranslationNotice", () => {
  it("renders nothing for a live, fully translated locale", () => {
    const { container } = render(<TranslationNotice locale="en-GB" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an accessible note for a planned locale with a link to English", () => {
    render(<TranslationNotice locale="nl" englishHref="/guides/tickets" />);

    const note = screen.getByRole("note", { name: "Translation notice" });
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(/currently in English/i);
    expect(note).toHaveTextContent(/Nederlands \(Dutch\)/);

    const link = screen.getByRole("link", { name: "View English version" });
    expect(link).toHaveAttribute("href", "/guides/tickets");
  });

  it("supports partially translated live locales", () => {
    render(<TranslationNotice locale="en-GB" partial englishHref="/guides" />);

    const note = screen.getByRole("note", { name: "Translation notice" });
    expect(note).toHaveTextContent(/not yet translated/i);
    expect(screen.getByRole("link", { name: "View English version" })).toHaveAttribute(
      "href",
      "/guides",
    );
  });

  it("falls back gracefully for an unregistered locale code", () => {
    render(<TranslationNotice locale="it" />);

    const note = screen.getByRole("note", { name: "Translation notice" });
    expect(note).toHaveTextContent(/currently in English/i);
    expect(note).toHaveTextContent(/A it translation is planned/i);
    expect(screen.getByRole("link", { name: "View English version" })).toHaveAttribute("href", "/");
  });
});
