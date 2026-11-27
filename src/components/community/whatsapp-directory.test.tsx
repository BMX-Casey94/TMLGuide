import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { whatsappGroups } from "@/data/community";
import { WhatsappDirectory } from "./whatsapp-directory";

/**
 * jsdom gives every test the same URL, so each test resets it. The component
 * reads `window.location.search` on mount and writes it with `history`, which is
 * the whole point of the URL-state tests below.
 */
function setUrl(search: string): void {
  window.history.replaceState(null, "", `/community${search}`);
}

beforeEach(() => setUrl(""));
afterEach(cleanup);

function searchField(): HTMLElement {
  return screen.getByLabelText(/search groups/i);
}

function editionField(): HTMLElement {
  return screen.getByLabelText(/^edition$/i);
}

function regionField(): HTMLElement {
  return screen.getByLabelText(/^region$/i);
}

function chooseField(field: HTMLElement, value: string): void {
  fireEvent.click(field);
  const option = screen.getAllByRole("option").find((item) => item.getAttribute("data-value") === value);
  if (option === undefined) throw new Error(`No filter option with value ${value}`);
  fireEvent.click(option);
}

describe("WhatsappDirectory", () => {
  it("renders every group before any filter is applied", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);
    // One link per group, plus nothing else that is an anchor.
    expect(screen.getAllByRole("link")).toHaveLength(whatsappGroups.length);
  });

  it("groups the cards under region headings with counts", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);

    // Region sections are the ones that hold cards; the safety note also has an h3.
    const regionSections = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.closest("section"))
      .filter((section): section is HTMLElement => section !== null)
      .filter((section) => within(section).queryAllByRole("link").length > 0);

    expect(regionSections.length).toBe(new Set(whatsappGroups.map((group) => group.region)).size);
    expect(regionSections.map((section) => within(section).getAllByRole("heading")[0].textContent)).toContain(
      "Worldwide",
    );

    // Every region section states how many groups it holds.
    for (const section of regionSections) {
      expect(within(section).getByText(/^\d+ groups?$/)).toBeInTheDocument();
    }
  });

  it("shows the safety note above the directory", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);
    expect(
      screen.getByRole("heading", { name: "Read this before you join a group" }),
    ).toBeInTheDocument();
  });

  it("announces the result count through a polite live region", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(`Showing all ${whatsappGroups.length} groups.`);
  });

  it("narrows the list and updates the announcement when the text filter changes", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);

    fireEvent.change(searchField(), { target: { value: "easy tent" } });

    const shown = screen.getAllByRole("link");
    expect(shown.length).toBe(2);
    expect(screen.getByRole("status")).toHaveTextContent(`Showing 2 of ${whatsappGroups.length} groups.`);
  });

  it("writes the text filter into the query string without adding history entries", () => {
    const before = window.history.length;
    render(<WhatsappDirectory groups={whatsappGroups} />);

    fireEvent.change(searchField(), { target: { value: "taxi" } });

    expect(window.location.search).toBe("?q=taxi");
    // Typing must not fill the back button, so this replaces the current entry.
    expect(window.history.length).toBe(before);
  });

  it("applies a filter that is already in the URL on load", () => {
    setUrl("?edition=winter");
    render(<WhatsappDirectory groups={whatsappGroups} />);

    expect(editionField()).toHaveAttribute("data-value", "winter");
    expect(screen.getAllByRole("link")).toHaveLength(
      whatsappGroups.filter((group) => group.edition === "winter").length,
    );
  });

  it("ignores a hand-edited URL with an unknown region", () => {
    setUrl("?region=Atlantis");
    render(<WhatsappDirectory groups={whatsappGroups} />);

    expect(regionField()).toHaveAttribute("data-value", "");
    expect(screen.getAllByRole("link")).toHaveLength(whatsappGroups.length);
  });

  it("pushes a history entry for a filter choice so back undoes it", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);
    const before = window.history.length;

    chooseField(editionField(), "brasil");

    expect(window.location.search).toBe("?edition=brasil");
    expect(window.history.length).toBe(before + 1);
  });

  it("re-reads the URL on a popstate, which is how the back button restores a filter", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);
    chooseField(editionField(), "brasil");
    expect(screen.getAllByRole("link")).toHaveLength(1);

    // The browser has gone back: the URL is bare and the event reports it.
    window.history.replaceState(null, "", "/community");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(editionField()).toHaveAttribute("data-value", "any");
    expect(screen.getAllByRole("link")).toHaveLength(whatsappGroups.length);
  });

  it("filters by region and keeps the count honest", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);

    chooseField(regionField(), "Worldwide");

    const expected = whatsappGroups.filter((group) => group.region === "Worldwide").length;
    expect(screen.getAllByRole("link")).toHaveLength(expected);
    expect(window.location.search).toBe("?region=Worldwide");
  });

  it("offers a clear button only once a filter is active, and it resets everything", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);
    expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();

    fireEvent.change(searchField(), { target: { value: "zzzz" } });
    expect(screen.getByRole("heading", { name: /no groups match/i })).toBeInTheDocument();
    // Exactly one clear control, in the filter bar, so there is no ambiguity about which to press.
    expect(screen.getAllByRole("button", { name: /clear filters/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    expect(searchField()).toHaveValue("");
    expect(window.location.search).toBe("");
    expect(screen.getAllByRole("link")).toHaveLength(whatsappGroups.length);
  });

  it("leaves a clear path out of an empty result, with the count announced", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);

    fireEvent.change(searchField(), { target: { value: "zzzz" } });

    expect(screen.getByRole("status")).toHaveTextContent(`Showing 0 of ${whatsappGroups.length} groups.`);
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  it("handles an empty publication without a filter prompt", () => {
    render(<WhatsappDirectory groups={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("No groups are published yet.");
    expect(screen.getByRole("heading", { name: /no groups are published yet/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it("labels every control, so nothing is announced as an unnamed field", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);

    // getByLabelText throws when the label is missing or unassociated.
    expect(searchField()).toHaveAccessibleName(/search groups/i);
    expect(editionField()).toHaveAccessibleName(/edition/i);
    expect(regionField()).toHaveAccessibleName(/region/i);
  });

  it("shows every region in the filter, in display order", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);

    fireEvent.click(regionField());
    const options = screen.getAllByRole("option").map((option) => option.textContent?.trim());
    expect(options[0]).toBe("All regions");
    expect(options.slice(1)).toContain("Worldwide");
    expect(options).toHaveLength(new Set(whatsappGroups.map((group) => group.region)).size + 1);
  });

  it("keeps the reader's region choice when a search empties the result", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);

    chooseField(regionField(), "Worldwide");
    fireEvent.change(searchField(), { target: { value: "alpe" } });

    // An empty result the reader can undo, not a silent reset of their region choice.
    expect(screen.getByRole("heading", { name: /no groups match/i })).toBeInTheDocument();
    expect(regionField()).toHaveAttribute("data-value", "Worldwide");
    expect(window.location.search).toBe("?q=alpe&region=Worldwide");
  });

  it("offers no broken-link report link, because the repo publishes no contact address", () => {
    render(<WhatsappDirectory groups={whatsappGroups} />);

    /*
      A "Report a broken link" mailto would need an address owned by the site. No
      contact address exists in the data, config or docs, and inventing one would
      send reports to a mailbox nobody reads, so the link is deliberately absent.
      If a real address is added later, this test is where the decision is revisited.
    */
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.queryByText(/report a broken link/i)).not.toBeInTheDocument();
  });
});
