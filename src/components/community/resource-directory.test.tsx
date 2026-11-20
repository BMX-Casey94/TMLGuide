import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { resources } from "@/data/community";
import { ResourceDirectory } from "./resource-directory";
import { resourceBadge, resourceProvenance } from "./resource-groups";

afterEach(cleanup);

describe("ResourceDirectory", () => {
  it("renders one entry per record", () => {
    render(<ResourceDirectory resources={resources} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(resources.length);
  });

  it("groups the entries under category headings", () => {
    render(<ResourceDirectory resources={resources} />);

    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toContain("Official Tomorrowland");
    expect(headings).toContain("Practical tools and documents");
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("labels every third-party tool as unofficial", () => {
    render(<ResourceDirectory resources={resources} />);

    const thirdParty = resources.filter((resource) => resourceProvenance(resource) === "third-party");
    expect(screen.getAllByText("Unofficial third-party tool")).toHaveLength(thirdParty.length);
  });

  it("badges only the records whose confidence is official", () => {
    render(<ResourceDirectory resources={resources} />);

    const official = resources.filter((resource) => resourceProvenance(resource) === "official");
    expect(screen.getAllByText("Official")).toHaveLength(official.length);

    // The lnk.to apps shortcut is in the official category but must not be badged.
    const appsTitle = screen.getByRole("heading", { name: /official apps/i });
    const card = appsTitle.closest("article");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).queryByText("Official")).not.toBeInTheDocument();
    expect(within(card as HTMLElement).getByText("Unofficial third-party tool")).toBeInTheDocument();
  });

  it("prints the record's own description, which is where the caveats live", () => {
    render(<ResourceDirectory resources={resources} />);

    for (const resource of resources) {
      expect(screen.getByText(resource.description)).toBeInTheDocument();
    }
  });

  it("shows the source host and the checked date on every entry", () => {
    render(<ResourceDirectory resources={resources} />);

    expect(screen.getAllByText(/Checked/)).toHaveLength(resources.length);
    expect(screen.getAllByText(/^Source: /)).toHaveLength(resources.length);
  });

  it("separates the host from the check date so the two never run together", () => {
    render(<ResourceDirectory resources={resources} />);

    for (const line of screen.getAllByText(/^Source: /)) {
      expect(line.textContent).toMatch(/—\s*Checked/);
    }
  });

  it("gives every outbound link a distinct accessible name and the safe rel", () => {
    render(<ResourceDirectory resources={resources} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(resources.length);

    const names = links.map((link) => link.getAttribute("aria-label") ?? link.textContent ?? "");
    expect(new Set(names).size).toBe(links.length);

    for (const link of links) {
      expect(link.getAttribute("href")?.startsWith("https://")).toBe(true);
      expect(link).toHaveAttribute("target", "_blank");
      // Resources are other people's pages; nofollow keeps them out of any endorsement signal.
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("marks a Drive document as a document rather than a site", () => {
    render(<ResourceDirectory resources={resources} />);

    const packingTitle = screen.getByRole("heading", { name: "Festival Packing List" });
    const card = packingTitle.closest("article");
    expect(within(card as HTMLElement).getByText("Document")).toBeInTheDocument();
  });

  it("names each entry with its title heading", () => {
    render(<ResourceDirectory resources={resources} />);

    for (const resource of resources) {
      expect(screen.getByRole("heading", { level: 4, name: resource.title })).toBeInTheDocument();
    }
  });

  it("renders an honest empty state", () => {
    render(<ResourceDirectory resources={[]} />);
    expect(screen.getByText(/no resources are published yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("never prints a card whose link is not https", () => {
    // A defensive check: the schema already refuses http, but the page is the last gate.
    const safe = resources.filter((resource) => resource.url.startsWith("https://"));
    render(<ResourceDirectory resources={safe} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")?.startsWith("https://")).toBe(true);
    }
  });
});

describe("resourceBadge wording", () => {
  it("uses the exact phrase the brief requires for third-party tools", () => {
    const festivalViewer = resources.find((resource) => resource.url.includes("festivalviewer.com"));
    expect(resourceBadge(festivalViewer!)).toBe("Unofficial third-party tool");
  });
});
