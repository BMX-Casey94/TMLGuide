import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ReportLinkForm } from "./report-link-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Fills the form and submits it. */
function submitWith(url = "https://chat.whatsapp.com/closed") {
  const urlInput = screen.getByLabelText("The link");
  fireEvent.change(urlInput, { target: { value: url } });

  const form = screen.getByRole("button", { name: "Send the report" }).closest("form");
  if (form === null) throw new Error("the form was not rendered");
  fireEvent.submit(form);
}

describe("ReportLinkForm — structure", () => {
  it("labels every control", () => {
    render(<ReportLinkForm page="/community/news" />);

    expect(screen.getByLabelText("The link")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "What is wrong" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Anything else/)).toBeInTheDocument();
  });

  it("offers a closed set of reasons, each with a real label", () => {
    render(<ReportLinkForm page="/community/news" />);

    for (const label of [
      /A WhatsApp invite no longer works/,
      /A resource link is dead/,
      /The link opens something different/,
      /Something else is wrong/,
    ]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });

  it("points the link field at its hint", () => {
    render(<ReportLinkForm page="/community/news" />);
    const input = screen.getByLabelText("The link");
    const hint = screen.getByText(/must start with https/i);
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("has one polite live region, present before anything is sent", () => {
    render(<ReportLinkForm page="/community/news" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("keeps the honeypot out of the accessibility tree and the tab order", () => {
    const { container } = render(<ReportLinkForm page="/community/news" />);
    const trap = container.querySelector("input[name='website']");

    expect(trap).not.toBeNull();
    expect(trap?.getAttribute("tabindex")).toBe("-1");
    expect(trap?.closest("[aria-hidden='true']")).not.toBeNull();

    // `aria-hidden` on the wrapper removes it from the accessibility tree, so a
    // role query (which respects that) finds no textbox named "Website". The
    // label still points at the input for a bot that reads the markup, which is
    // what the trap is for.
    expect(screen.queryByRole("textbox", { name: "Website" })).toBeNull();
    expect(screen.getAllByRole("textbox").map((element) => element.getAttribute("name"))).toEqual([
      "url",
      "details",
    ]);
  });

  it("prefills the link when the page knows one", () => {
    render(<ReportLinkForm page="/community/news" defaultUrl="https://example.com/gone" />);
    expect(screen.getByLabelText("The link")).toHaveValue("https://example.com/gone");
  });
});

describe("ReportLinkForm — sending", () => {
  it("posts the report and confirms it was recorded", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ status: "accepted" }, { status: 202 }));
    vi.stubGlobal("fetch", fetchImpl);

    render(<ReportLinkForm page="/community/news" />);
    submitWith();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /that is recorded/i })).toBeInTheDocument();
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/community/report-link");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");

    const sent = JSON.parse(String(init.body)) as Record<string, string>;
    expect(sent.url).toBe("https://chat.whatsapp.com/closed");
    expect(sent.kind).toBe("invite");
    expect(sent.page).toBe("/community/news");
    // The honeypot is always sent, empty, so its absence is not a distinguishable
    // shape from a bot's request.
    expect(sent.website).toBe("");
  });

  it("sends the chosen reason", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ status: "accepted" }, { status: 202 }));
    vi.stubGlobal("fetch", fetchImpl);

    render(<ReportLinkForm page="/community/news" />);
    fireEvent.click(screen.getByRole("radio", { name: /A resource link is dead/ }));
    submitWith();

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ kind: "resource" });
  });

  it("omits empty details rather than sending an empty string", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ status: "accepted" }, { status: 202 }));
    vi.stubGlobal("fetch", fetchImpl);

    render(<ReportLinkForm page="/community/news" />);
    submitWith();

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty("details");
  });

  it("sends the filled honeypot, which is how a bot is caught", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ status: "accepted" }, { status: 202 }));
    vi.stubGlobal("fetch", fetchImpl);

    const { container } = render(<ReportLinkForm page="/community/news" />);
    const trap = container.querySelector("input[name='website']");
    fireEvent.change(trap as Element, { target: { value: "http://spam.example" } });
    submitWith();

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ website: "http://spam.example" });
  });
});

describe("ReportLinkForm — refusals are reported honestly", () => {
  it("says nothing was recorded on a 503", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));

    render(<ReportLinkForm page="/community/news" />);
    submitWith();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Nothing has been recorded/i);
    });
    // It must not thank them for a report nobody will read.
    expect(screen.queryByRole("heading", { name: /that is recorded/i })).not.toBeInTheDocument();
  });

  it("keeps the typed values when the report is refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));

    render(<ReportLinkForm page="/community/news" />);
    submitWith("https://example.com/gone");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Nothing has been/i));
    expect(screen.getByLabelText("The link")).toHaveValue("https://example.com/gone");
  });

  it("shows the first field message on a 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "Please check", fields: { url: "The link must be an https:// address" } },
          { status: 422 },
        ),
      ),
    );

    render(<ReportLinkForm page="/community/news" />);
    submitWith("http://example.com/gone");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/must be an https/i);
    });
  });

  it("marks the link field invalid on a 422 for that field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ fields: { url: "Bad link" } }, { status: 422 })),
    );

    render(<ReportLinkForm page="/community/news" />);
    submitWith("not a link");

    await waitFor(() => {
      expect(screen.getByLabelText("The link")).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("reports a 429 without claiming anything was saved", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));

    render(<ReportLinkForm page="/community/news" />);
    submitWith();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Too many reports/i);
    });
  });

  it("reports a forged-origin refusal without blaming the visitor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));

    render(<ReportLinkForm page="/community/news" />);
    submitWith();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Reload the page/i);
    });
  });

  it("reports a dropped connection without claiming anything was saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    render(<ReportLinkForm page="/community/news" />);
    submitWith();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Nothing has been recorded/i);
    });
  });
});
