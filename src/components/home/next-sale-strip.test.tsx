import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";

import { NextSaleStrip } from "./next-sale-strip";import { nextSaleFrom } from "./next-sale";
import { isInternalLink, renderAsRouter } from "./test-support";

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) => (
    // eslint-disable-next-line @next/next/no-img-element -- test double for next/image
    <img src={typeof src === "string" ? src : ""} alt={alt} width={width} height={height} />
  ),
}));

const CHECKED_ON = "2026-11-18";
const CHECKED_LABEL = "18 November 2026";
const SERVER_NOW = "2026-11-18T12:00:00Z";

afterEach(cleanup);

/** The real next sale as of the day the data was checked. */
function realNext() {
  const next = nextSaleFrom(
    [
      {
        edition: "winter",
        id: "add-on-sale-2027",
        name: "Winter 2027 Add-On Sale",
        opensAtIso: "2026-11-26T15:00:00+01:00",
        timeZone: "Europe/Brussels",
        audience: "General sale",
        source: {
          url: "https://winter.tomorrowland.com/en/add-ons/",
          title: "Tomorrowland Winter 2027 add-ons",
          retrievedOn: CHECKED_ON,
        },
        lastVerified: CHECKED_ON,
      },
    ],
    new Date(SERVER_NOW),
  );
  if (next === null) throw new Error("expected a sale");
  return next;
}

function renderStrip(next = realNext()) {
  return renderAsRouter(
    <NextSaleStrip
      next={next}
      checkedOn={CHECKED_ON}
      checkedOnLabel={CHECKED_LABEL}
      serverNowIso={SERVER_NOW}
    />,
  );
}

describe("NextSaleStrip", () => {
  it("names the sale and the edition it belongs to", () => {
    renderStrip();

    expect(screen.getByRole("heading", { level: 2, name: "Winter 2027 Add-On Sale" })).toBeInTheDocument();
    expect(screen.getByText(/Next sale · Winter/)).toBeInTheDocument();
  });

  it("shows the published local time and the London time", () => {
    renderStrip();

    expect(screen.getByText("Thu 26 Nov 2026, 15:00 CET")).toBeInTheDocument();
    expect(screen.getByText("Thu 26 Nov 2026, 14:00 GMT")).toBeInTheDocument();
  });

  it("gives the opening moment a machine-readable datetime", () => {
    renderStrip();
    const time = screen.getByText("Thu 26 Nov 2026, 15:00 CET");
    expect(time).toHaveAttribute("datetime", "2026-11-26T15:00:00+01:00");
  });

  it("states who the sale is for", () => {
    renderStrip();
    expect(screen.getByText("General sale")).toBeInTheDocument();
  });

  it("cites the official source and the check date", () => {
    renderStrip();

    const source = screen.getByRole("link", { name: /Tomorrowland Winter 2027 add-ons/ });
    expect(source).toHaveAttribute("href", "https://winter.tomorrowland.com/en/add-ons/");
    expect(source.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText(/Checked/)).toHaveTextContent(CHECKED_LABEL);
  });

  it("links to the full sale timeline", () => {
    renderStrip();
    const link = screen.getByRole("link", { name: /Full sale timeline/ });
    expect(link).toHaveAttribute("href", "/tools/sale-timeline");
  });

  it("hands the countdown the server's clock", () => {
    // The countdown adopts the browser's clock after mount, so pin it to the
    // moment the strip was rendered for; otherwise this asserts about today.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(SERVER_NOW));

    const { container } = renderStrip();
    const values = Array.from(container.querySelectorAll(".home-count__value")).map(
      (element) => element.textContent,
    );

    // 26 Nov 15:00 CET from 18 Nov 12:00Z is 8 days and 2 hours.
    expect(values[0]).toBe("8");
    expect(values[1]).toBe("02");

    vi.useRealTimers();
  });

  it("says so honestly when no sale is ahead, instead of inventing a date", () => {
    renderAsRouter(
      <NextSaleStrip
        next={null}
        checkedOn={CHECKED_ON}
        checkedOnLabel={CHECKED_LABEL}
        serverNowIso={SERVER_NOW}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "No further sale is published" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Every sale moment verified so far has opened/)).toBeInTheDocument();
    expect(screen.queryByText(/Opens in/)).not.toBeInTheDocument();
  });

  it("keeps every internal link on a known route", () => {
    renderStrip();

    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("/")) expect(isInternalLink(href)).toBe(true);
    }
  });
});
