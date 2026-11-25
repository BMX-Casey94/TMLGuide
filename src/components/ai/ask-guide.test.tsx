/**
 * Tests for the "Ask the guide" client.
 *
 * The properties that matter are the ones a reader would notice if they broke: the
 * notices are present before any interaction, an answer is rendered as text and never
 * as markup, citations show their check date and open the official page, and every
 * failure state says something honest rather than showing an empty box.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AskGuide, EDITION_OPTIONS, MAX_QUESTION_LENGTH, STARTER_QUESTIONS, formatCheckedDate, refusalLabel } from "./ask-guide";

const ANSWER = {
  answer: "A day pass is €144 in the pre-sale and €159 in the WorldWide Ticket Sale [1].",
  citations: [
    {
      index: 1,
      sourceUrl: "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/",
      sourceTitle: "Tomorrowland Belgium — day passes",
      lastVerified: "2026-11-18",
      live: false,
    },
  ],
  lastVerified: "2026-11-18",
  refusal: null,
  model: "google/gemini-3.1-flash-lite-preview",
};

function mockFetch(response: { status?: number; body: unknown } | Error) {
  const fetchSpy = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("initial render", () => {
  it("shows the form, the character counter and the edition filter", () => {
    render(<AskGuide />);

    expect(screen.getByRole("textbox", { name: /your question/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask the guide/i })).toBeInTheDocument();
    expect(screen.getByText(/0 of 500 characters/)).toBeInTheDocument();

    for (const option of EDITION_OPTIONS) {
      expect(screen.getByRole("button", { name: option.label })).toBeInTheDocument();
    }
  });

  it("marks the default edition as pressed and moves the pressed state on click", () => {
    render(<AskGuide />);
    const all = screen.getByRole("button", { name: "All editions" });
    expect(all).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Winter" }));
    expect(screen.getByRole("button", { name: "Winter" })).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
  });

  it("offers starter questions and fills the box when one is chosen", () => {
    render(<AskGuide />);
    const starter = STARTER_QUESTIONS[0];
    if (starter === undefined) throw new Error("no starters");

    fireEvent.click(screen.getByRole("button", { name: starter }));
    expect(screen.getByRole("textbox", { name: /your question/i })).toHaveValue(starter);
  });

  it("renders no Turnstile field when no site key is configured", () => {
    render(<AskGuide />);
    expect(screen.queryByText(/verification/i)).not.toBeInTheDocument();
  });

  it("renders the verification field when a site key is supplied", () => {
    render(<AskGuide turnstileSiteKey="site-key" />);
    expect(screen.getByText(/verification/i)).toBeInTheDocument();
  });
});

describe("submitting", () => {
  it("refuses a question that is too short without calling the API", async () => {
    const fetchSpy = mockFetch({ body: ANSWER });
    render(<AskGuide />);

    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least three characters/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the question and the edition, and renders the answer as text", async () => {
    const fetchSpy = mockFetch({ body: ANSWER });
    render(<AskGuide />);

    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), {
      target: { value: "How much is a day pass?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Belgium" }));
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    expect(await screen.findByText(/€144 in the pre-sale/)).toBeInTheDocument();

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ question: "How much is a day pass?", edition: "belgium" });
    expect(init.method).toBe("POST");
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolve: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );

    render(<AskGuide />);
    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "How much is a pass?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    const button = await screen.findByRole("button", { name: /reading the guide/i });
    expect(button).toBeDisabled();

    resolve?.(
      new Response(JSON.stringify(ANSWER), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await screen.findByText(/€144/);
    expect(screen.getByRole("button", { name: /ask the guide/i })).toBeEnabled();
  });

  it("renders model output as text, never as markup", async () => {
    // A model that emits HTML must not be able to inject an element into the page.
    mockFetch({
      body: { ...ANSWER, answer: "<script>alert(1)</script> and <img src=x onerror=alert(2)>" },
    });

    render(<AskGuide />);
    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "tell me something" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    const body = await screen.findByText(/alert\(1\)/);
    expect(body.querySelector("script")).toBeNull();
    expect(body.querySelector("img")).toBeNull();
  });
});

describe("citations and freshness", () => {
  it("shows each citation with its official link and check date", async () => {
    mockFetch({ body: ANSWER });
    render(<AskGuide />);

    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "How much is a pass?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    const link = await screen.findByRole("link", { name: /day passes/i });
    expect(link).toHaveAttribute("href", "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/");
    // A citation must open the official page safely.
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("target", "_blank");

    expect(screen.getByText(/Checked 18 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText(/As fresh as/)).toBeInTheDocument();
  });

  it("marks a live-read citation as read just now", async () => {
    mockFetch({
      body: {
        ...ANSWER,
        citations: [{ ...ANSWER.citations[0], live: true }],
      },
    });

    render(<AskGuide />);
    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "How much is a pass?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    expect(await screen.findByText(/read just now/i)).toBeInTheDocument();
  });
});

describe("refusals", () => {
  it("shows the refusal message and a clear heading rather than an error", async () => {
    mockFetch({
      body: {
        ...ANSWER,
        answer: "",
        citations: [],
        lastVerified: null,
        refusal: { reason: "not-published", message: "That figure has not been published for 2027." },
      },
    });

    render(<AskGuide />);
    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "How much is a 4-day pass?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    expect(await screen.findByText(/not been published for 2027/)).toBeInTheDocument();
    expect(screen.getByText("Not published")).toBeInTheDocument();
    // No model footer on a refusal: nothing answered it.
    expect(screen.queryByText(/Answered by/)).not.toBeInTheDocument();
  });
});

describe("failure states", () => {
  it("shows the server's message on a non-2xx response", async () => {
    mockFetch({ status: 429, body: { error: "Too many questions asked. Please try again later." } });
    render(<AskGuide />);

    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "How much is a pass?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/too many questions/i)).toBeInTheDocument();
  });

  it("shows a network message when the request fails", async () => {
    mockFetch(new TypeError("offline"));
    render(<AskGuide />);

    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "How much is a pass?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument();
  });

  it("shows a message when the response shape is not what it expects", async () => {
    mockFetch({ body: { unexpected: true } });
    render(<AskGuide />);

    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "How much is a pass?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    expect(await screen.findByText(/something unexpected/i)).toBeInTheDocument();
  });

  it("does not state that anything was stored", async () => {
    mockFetch(new TypeError("offline"));
    render(<AskGuide />);

    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "How much is a pass?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    const text = await screen.findByText(/Nothing was stored/i);
    expect(text).toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("labels the question field and binds its hint", () => {
    render(<AskGuide />);
    const field = screen.getByRole("textbox", { name: /your question/i });
    const describedBy = field.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    for (const id of (describedBy ?? "").split(" ")) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it("marks the field invalid and points at the error when it fails", async () => {
    mockFetch({ body: ANSWER });
    render(<AskGuide />);

    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    const field = screen.getByRole("textbox", { name: /your question/i });
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("announces the working state in a polite status region", async () => {
    mockFetch({ body: ANSWER });
    render(<AskGuide />);

    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "How much is a pass?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    const status = document.querySelector('[role="status"]');
    expect(status).toHaveAttribute("aria-live", "polite");
    await waitFor(() => expect(status?.textContent).toMatch(/answered/i));
  });

  it("groups the edition buttons with a label", () => {
    render(<AskGuide />);
    const group = screen.getByRole("group", { name: /edition/i });
    expect(group).toBeInTheDocument();
  });

  it("caps the input length", () => {
    render(<AskGuide />);
    expect(screen.getByRole("textbox", { name: /your question/i })).toHaveAttribute("maxlength", String(MAX_QUESTION_LENGTH));
  });
});

describe("clearing", () => {
  it("resets the form and the answer", async () => {
    mockFetch({ body: ANSWER });
    render(<AskGuide />);

    fireEvent.change(screen.getByRole("textbox", { name: /your question/i }), { target: { value: "How much is a pass?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));
    await screen.findByText(/€144/);

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    expect(screen.getByRole("textbox", { name: /your question/i })).toHaveValue("");
    expect(screen.queryByText(/€144/)).not.toBeInTheDocument();
  });
});

describe("helpers", () => {
  it("formats a check date and tolerates a bad value", () => {
    expect(formatCheckedDate("2026-11-18")).toBe("18 Nov 2026");
    expect(formatCheckedDate(null)).toBeNull();
    expect(formatCheckedDate("nonsense")).toBeNull();
  });

  it("gives every refusal reason a human heading", () => {
    for (const reason of ["no-sources", "not-published", "out-of-scope", "spend-cap", "provider-unavailable", "unconfigured"]) {
      const label = refusalLabel(reason);
      expect(label.length, reason).toBeGreaterThan(3);
      expect(label.toLowerCase(), reason).not.toBe("error");
    }
  });
});
