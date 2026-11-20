import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { RadioProvider } from "@/components/radio/radio-context";
import { RADIO_CREDIT, RADIO_STREAM_URL } from "@/components/radio/stream";
import { radioBroadcasts, radioStation } from "@/data/shared";
import {
  expectDividerCount,
  expectNoAdjacentRules,
  topLevelBlocks,
} from "@/components/guides/divider-guard";
import RadioPage from "./page";

/*
  The page mounts the real panel, which reads the radio context and registers a
  Media Session. jsdom provides neither, so the provider is wrapped here as the
  root layout would, and the media session is stubbed once for the file.
*/
function installMediaSession(): void {
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    value: {
      metadata: null,
      playbackState: "none",
      setActionHandler: vi.fn(),
    },
  });
}

function renderPage() {
  return render(
    <RadioProvider>
      <RadioPage />
    </RadioProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "mediaSession", { configurable: true, value: undefined });
  document.querySelectorAll("audio").forEach((node) => node.remove());
});

describe("radio page", () => {
  it("has one h1 naming the station", () => {
    installMediaSession();
    renderPage();

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(radioStation.name);
  });

  it("mounts the RadioPanel with its controls and credit", () => {
    installMediaSession();
    renderPage();

    expect(screen.getByRole("button", { name: /play one world radio/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /radio volume/i })).toBeInTheDocument();
    // The credit appears twice on purpose: in the panel and in the sources block.
    expect(screen.getAllByText(RADIO_CREDIT)).toHaveLength(2);
  });

  it("does not start the stream on load", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    installMediaSession();
    renderPage();

    expect(document.querySelector("audio")).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it("shows the station's own description and audience figure", () => {
    installMediaSession();
    renderPage();

    expect(screen.getByText(radioStation.description)).toBeInTheDocument();
    expect(screen.getByText(radioStation.audience)).toBeInTheDocument();
  });

  it("lists every published country with its method and detail", () => {
    installMediaSession();
    renderPage();

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    // One header row plus one per country.
    expect(rows).toHaveLength(radioBroadcasts.length + 1);

    for (const broadcast of radioBroadcasts) {
      const row = within(table).getByRole("rowheader", { name: broadcast.country }).closest("tr");
      expect(row).not.toBeNull();
      // Scoped to the row: several countries share the method "Online only".
      expect(within(row as HTMLElement).getByText(broadcast.method)).toBeInTheDocument();
      expect(within(row as HTMLElement).getByText(broadcast.detail)).toBeInTheDocument();
    }
  });

  it("names the table for assistive technology", () => {
    installMediaSession();
    renderPage();
    expect(screen.getByRole("table")).toHaveAccessibleName(/countries with published/i);
  });

  it("shows every documented way to listen, with a link where one exists", () => {
    installMediaSession();
    renderPage();

    for (const name of ["Tomorrowland App", "Radioplayer and TuneIn", "SiriusXM"]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("link", { name: /tomorrowland website player/i }),
    ).toBeInTheDocument();
  });

  it("links the official source and states the attribution", () => {
    installMediaSession();
    renderPage();

    const source = screen.getByRole("link", { name: new RegExp(radioStation.source.title, "i") });
    expect(source).toHaveAttribute("href", radioStation.source.url);
    expect(source).toHaveAttribute("target", "_blank");
    expect(source.getAttribute("rel")).toBe("noopener noreferrer");

    // The panel makes the same statement, so the page-level copy is one of two.
    expect(
      screen.getAllByText(/not affiliated with tomorrowland or weareone\.world b\.v\./i).length,
    ).toBeGreaterThan(0);
  });

  it("prints the stream URL so a reader can check what is playing", () => {
    installMediaSession();
    renderPage();
    expect(screen.getByText(RADIO_STREAM_URL)).toBeInTheDocument();
  });

  it("gives every outbound link an https href", () => {
    installMediaSession();
    renderPage();

    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href");
      if (href === null || href.startsWith("#")) continue;
      expect(href.startsWith("https://")).toBe(true);
    }
  });

  it("labels each major section by its heading", () => {
    installMediaSession();
    renderPage();

    for (const name of [
      /tomorrowland's own station/i,
      /every published way in/i,
      /dab\+, fm and syndication/i,
      /from anniversary project to a permanent station/i,
      /sources and attribution/i,
    ]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });

  it("keeps a single polite live region, owned by the player", () => {
    installMediaSession();
    renderPage();

    // The page must not add a second live region: every status change is announced once.
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});

/*
  The owner reported two dividers above three headings: "How to listen / Every
  published way in", "Where to listen", and "History". Each boundary carries one
  break now, and these are the assertions that keep it that way.
*/
describe("divider convention", () => {
  it("uses exactly three GoldDividers, one per section boundary", () => {
    installMediaSession();
    const { container } = renderPage();
    expectDividerCount(container, 3);
  });

  it("never puts two rules side by side in the page flow", () => {
    installMediaSession();
    const { container } = renderPage();
    expectNoAdjacentRules(container);
  });

  it("marks each divider boundary with one section heading, not two", () => {
    installMediaSession();
    const { container } = renderPage();
    const blocks = topLevelBlocks(container);

    // Every divider is followed by a section, and no section follows another section
    // without a divider or a heading between them.
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (!block?.classList.contains("tml-divider")) continue;
      const next = blocks[index + 1];
      expect(next?.tagName).toBe("SECTION");
      expect(next?.querySelector(".tml-section-head")).not.toBeNull();
    }
  });

  it("switches off the section heading's own hairline, so the divider is the only rule", () => {
    installMediaSession();
    const { container } = renderPage();

    // Every heading that follows a divider or a banded block is bare. The kit renders
    // `.tml-section-head--bare` for `hairline="none"`, which removes the border
    // entirely rather than making it transparent, so there is genuinely one rule.
    const heads = Array.from(container.querySelectorAll(".tml-section-head"));
    expect(heads.length).toBeGreaterThan(0);
    for (const head of heads) {
      const section = head.closest("section");
      const precededByDivider =
        section?.previousElementSibling?.classList.contains("tml-divider") ?? false;
      if (precededByDivider) expect(head.classList.contains("tml-section-head--bare")).toBe(true);
    }
  });
});
