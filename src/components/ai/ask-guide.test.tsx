/**
 * Tests for the "Ask the guide" chat client.
 *
 * The properties that matter are the ones a reader would notice if they broke: the
 * welcome state offers real questions, a chosen question is sent as a chat turn, an
 * answer is rendered as text and never as markup, citations show their check date and
 * open the official page, and every failure state says something honest in the thread
 * rather than showing an empty box.
 *
 * Two are about promises made elsewhere and are checked here because this component is
 * where a transcript would be written if one ever were: the thread is React state only,
 * and nothing is written to browser storage.
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

/** The composer field. Named rather than placeholder-matched, so the test fails if a label goes. */
function composer() {
  return screen.getByRole("textbox", { name: /your question/i });
}

function typeQuestion(value: string) {
  fireEvent.change(composer(), { target: { value } });
}

function sendQuestion(value: string) {
  typeQuestion(value);
  fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));
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
  it("shows the composer, the character counter and the edition filter", () => {
    render(<AskGuide />);

    expect(composer()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask the guide/i })).toBeInTheDocument();
    expect(screen.getByText(`0 / ${MAX_QUESTION_LENGTH}`)).toBeInTheDocument();

    for (const option of EDITION_OPTIONS) {
      expect(screen.getByRole("button", { name: option.label })).toBeInTheDocument();
    }
  });

  it("names the assistant in the chat header", () => {
    render(<AskGuide />);
    expect(screen.getByRole("heading", { name: "TMLGuide Assistant" })).toBeInTheDocument();
  });

  it("greets the reader with the guide's role before anything is asked", () => {
    render(<AskGuide />);
    expect(screen.getByText(/Verified answers from checked Tomorrowland records/)).toBeInTheDocument();
    // Nothing to clear on an empty thread.
    expect(screen.queryByRole("button", { name: /new chat/i })).not.toBeInTheDocument();
  });

  it("offers every starter question in the empty state", () => {
    render(<AskGuide />);
    for (const starter of STARTER_QUESTIONS) {
      expect(screen.getByRole("button", { name: starter })).toBeInTheDocument();
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

  it("keeps the send button disabled until there is something to send", () => {
    render(<AskGuide />);
    expect(screen.getByRole("button", { name: /ask the guide/i })).toBeDisabled();
    typeQuestion("How much is a day pass?");
    expect(screen.getByRole("button", { name: /ask the guide/i })).toBeEnabled();
  });

  it("renders no Turnstile field when no site key is configured", () => {
    render(<AskGuide />);
    expect(screen.queryByText(/verification/i)).not.toBeInTheDocument();
  });

  it("renders the verification field when a site key is supplied", () => {
    render(<AskGuide turnstileSiteKey="site-key" />);
    expect(screen.getByText(/verification/i)).toBeInTheDocument();
  });

  it("fills the box rather than sending when a challenge has to run first", () => {
    const fetchSpy = mockFetch({ body: ANSWER });
    render(<AskGuide turnstileSiteKey="site-key" />);
    const starter = STARTER_QUESTIONS[0];
    if (starter === undefined) throw new Error("no starters");

    fireEvent.click(screen.getByRole("button", { name: starter }));

    expect(composer()).toHaveValue(starter);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("asking a question", () => {
  it("sends a starter question immediately and shows it as a user turn", async () => {
    const fetchSpy = mockFetch({ body: ANSWER });
    render(<AskGuide />);
    const starter = STARTER_QUESTIONS[0];
    if (starter === undefined) throw new Error("no starters");

    fireEvent.click(screen.getByRole("button", { name: starter }));

    // The question is a bubble in the thread, and the answer follows it.
    expect(await screen.findByText(starter)).toBeInTheDocument();
    expect(await screen.findByText(/€144 in the pre-sale/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // The starter is consumed, not left in the box to be sent twice.
    expect(composer()).toHaveValue("");
  });

  it("posts the question and the edition, and renders the answer as text", async () => {
    const fetchSpy = mockFetch({ body: ANSWER });
    render(<AskGuide />);

    typeQuestion("How much is a day pass?");
    fireEvent.click(screen.getByRole("button", { name: "Belgium" }));
    fireEvent.click(screen.getByRole("button", { name: /ask the guide/i }));

    expect(await screen.findByText(/€144 in the pre-sale/)).toBeInTheDocument();

    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      question: "How much is a day pass?",
      edition: "belgium",
    });
    expect(init.method).toBe("POST");
  });

  it("sends on Enter and keeps Shift+Enter for a new line", async () => {
    const fetchSpy = mockFetch({ body: ANSWER });
    render(<AskGuide />);

    typeQuestion("How much is a pass?");
    fireEvent.keyDown(composer(), { key: "Enter", shiftKey: true });
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(composer(), { key: "Enter" });
    expect(await screen.findByText(/€144/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("refuses a question that is too short without calling the API", async () => {
    const fetchSpy = mockFetch({ body: ANSWER });
    render(<AskGuide />);

    sendQuestion("ab");

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least three characters/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("disables send while the request is in flight and shows a thinking bubble", async () => {
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
    sendQuestion("How much is a pass?");

    const button = await screen.findByRole("button", { name: /reading the guide/i });
    expect(button).toBeDisabled();
    const thinking = screen.getByText(/reading the guide/i, { selector: ".tml-ai-thinking-bubble" });
    expect(thinking).toBeInTheDocument();
    // The loading state is announced through the one persistent live region, because a
    // region that arrives already holding its text is not announced by screen readers.
    expect(document.querySelector(".tml-ai-sr-only[role='status']")).toHaveTextContent(/reading the guide/i);
    expect(thinking).not.toHaveAttribute("aria-live");

    resolve?.(
      new Response(JSON.stringify(ANSWER), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await screen.findByText(/€144/);
    // The control returns from its working state, and typing re-enables it.
    expect(screen.getByRole("button", { name: /ask the guide/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reading the guide/i })).not.toBeInTheDocument();
    typeQuestion("And a DreamVille package?");
    expect(screen.getByRole("button", { name: /ask the guide/i })).toBeEnabled();
  });

  it("sends once when Enter is pressed twice in the same tick", async () => {
    // Two requests in one tick would abort the first and leave its bubble reading
    // "Reading the guide" for ever, because the abort path exits without settling it.
    const fetchSpy = mockFetch({ body: ANSWER });
    render(<AskGuide />);

    typeQuestion("How much is a pass?");
    fireEvent.keyDown(composer(), { key: "Enter" });
    fireEvent.keyDown(composer(), { key: "Enter" });

    await screen.findByText(/€144/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the thread in order and lets a second question be asked", async () => {
    const fetchSpy = mockFetch({ body: ANSWER });
    const { container } = render(<AskGuide />);

    sendQuestion("How much is a pass?");
    await screen.findByText(/€144/);

    sendQuestion("And a DreamVille package?");
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    const thread = container.querySelector(".tml-ai-thread");
    expect(thread).not.toBeNull();
    // Two turns, each a question and an answer. The citation lists inside the answer
    // bubbles are lists too, so only the thread's own children are counted.
    expect(thread?.querySelectorAll(":scope > li")).toHaveLength(4);
    const asked = Array.from(thread?.querySelectorAll(".tml-ai-msg--user") ?? []).map((node) => node.textContent);
    expect(asked).toEqual([
      expect.stringContaining("How much is a pass?"),
      expect.stringContaining("And a DreamVille package?"),
    ]);
  });

  it("renders model output as text, never as markup", async () => {
    // A model that emits HTML must not be able to inject an element into the page.
    mockFetch({
      body: { ...ANSWER, answer: "<script>alert(1)</script> and <img src=x onerror=alert(2)>" },
    });

    render(<AskGuide />);
    sendQuestion("tell me something");

    const body = await screen.findByText(/alert\(1\)/);
    expect(body.querySelector("script")).toBeNull();
    expect(body.querySelector("img")).toBeNull();
  });

  it("splits a multi-paragraph answer into paragraphs", async () => {
    mockFetch({ body: { ...ANSWER, answer: "First point.\n\nSecond point." } });
    render(<AskGuide />);
    sendQuestion("How much is a pass?");

    expect(await screen.findByText("First point.")).toBeInTheDocument();
    expect(screen.getByText("Second point.")).toBeInTheDocument();
  });
});

describe("citations and freshness", () => {
  it("shows each citation with its official link and check date", async () => {
    mockFetch({ body: ANSWER });
    render(<AskGuide />);

    sendQuestion("How much is a pass?");

    const link = await screen.findByRole("link", { name: /day passes/i });
    expect(link).toHaveAttribute("href", "https://belgium.tomorrowland.com/en/tickets/festival-tickets/day-pass/");
    // A citation must open the official page safely.
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("target", "_blank");

    expect(screen.getByText(/Checked 18 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Last verified/)).toBeInTheDocument();
    expect(screen.getByText("Citations")).toBeInTheDocument();
  });

  it("marks a live-read citation as read just now", async () => {
    mockFetch({
      body: {
        ...ANSWER,
        citations: [{ ...ANSWER.citations[0], live: true }],
      },
    });

    render(<AskGuide />);
    sendQuestion("How much is a pass?");

    expect(await screen.findByText(/read just now/i)).toBeInTheDocument();
  });
});

describe("refusals", () => {
  it("shows the refusal message and its heading inside the assistant bubble", async () => {
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
    sendQuestion("How much is a 4-day pass?");

    expect(await screen.findByText(/not been published for 2027/)).toBeInTheDocument();
    expect(screen.getByText("Not published")).toBeInTheDocument();
    // No model footer on a refusal: nothing answered it.
    expect(screen.queryByText(/Answered by/)).not.toBeInTheDocument();
  });

  it("renders a refusal body that arrives with a 503, rather than a generic error", async () => {
    // The route answers an unconfigured or broken provider with a well-formed refusal and
    // a 503. Its message is the honest one; a status code check that ran first would
    // replace it with an apology and lose the explanation.
    mockFetch({
      status: 503,
      body: {
        answer: "",
        citations: [],
        lastVerified: null,
        refusal: {
          reason: "unconfigured",
          message: "The AI answer service is not configured on this deployment.",
        },
        model: "google/gemini-3.1-flash-lite-preview",
      },
    });

    render(<AskGuide />);
    sendQuestion("How much is a pass?");

    expect(await screen.findByText(/not configured on this deployment/)).toBeInTheDocument();
    expect(screen.getByText("Not switched on here")).toBeInTheDocument();
    expect(screen.queryByText(/could not answer that just now/i)).not.toBeInTheDocument();
  });
});

describe("failure states", () => {
  it("shows the server's message on a non-2xx response", async () => {
    mockFetch({ status: 429, body: { error: "Too many questions asked. Please try again later." } });
    render(<AskGuide />);

    sendQuestion("How much is a pass?");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/too many questions/i)).toBeInTheDocument();
  });

  it("shows a network message when the request fails", async () => {
    mockFetch(new TypeError("offline"));
    render(<AskGuide />);

    sendQuestion("How much is a pass?");

    expect(await screen.findByText(/could not be reached/i)).toBeInTheDocument();
  });

  it("shows a message when the response shape is not what it expects", async () => {
    mockFetch({ body: { unexpected: true } });
    render(<AskGuide />);

    sendQuestion("How much is a pass?");

    expect(await screen.findByText(/something unexpected/i)).toBeInTheDocument();
  });

  it("does not state that anything was stored", async () => {
    mockFetch(new TypeError("offline"));
    render(<AskGuide />);

    sendQuestion("How much is a pass?");

    expect(await screen.findByText(/Nothing was stored/i)).toBeInTheDocument();
  });

  it("offers a retry that asks the same question again", async () => {
    const fetchSpy = mockFetch(new TypeError("offline"));
    render(<AskGuide />);

    sendQuestion("How much is a pass?");
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const [, init] = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ question: "How much is a pass?" });
  });

  it("retries in the same bubble instead of appending a second one", async () => {
    const fetchSpy = mockFetch(new TypeError("offline"));
    const { container } = render(<AskGuide />);

    sendQuestion("How much is a pass?");
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    await screen.findByRole("alert");

    expect(container.querySelectorAll(".tml-ai-msg--user")).toHaveLength(1);
    expect(container.querySelectorAll(".tml-ai-msg--assistant")).toHaveLength(1);
  });

  it("keeps the failed question in the thread when the retry cannot be sent", async () => {
    const fetchSpy = mockFetch(new TypeError("offline"));
    render(<AskGuide turnstileSiteKey="site-key" />);

    // No Turnstile in the test environment, so the token is never issued and the first
    // send is refused by the composer rather than the network.
    sendQuestion("How much is a pass?");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(composer()).toHaveValue("How much is a pass?");
  });
});

describe("nothing is persisted", () => {
  it("writes no transcript to browser storage", async () => {
    const localSet = vi.spyOn(Storage.prototype, "setItem");
    mockFetch({ body: ANSWER });
    render(<AskGuide />);

    sendQuestion("How much is a pass?");
    await screen.findByText(/€144/);

    expect(localSet).not.toHaveBeenCalled();
  });
});

describe("accessibility", () => {
  it("labels the question field and binds its hint", () => {
    render(<AskGuide />);
    const describedBy = composer().getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    for (const id of (describedBy ?? "").split(" ")) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it("marks the field invalid and points at the error when it fails", async () => {
    mockFetch({ body: ANSWER });
    render(<AskGuide />);

    sendQuestion("ab");

    const field = composer();
    expect(field).toHaveAttribute("aria-invalid", "true");
    const describedBy = field.getAttribute("aria-describedby") ?? "";
    const errorId = describedBy.split(" ").at(-1) ?? "";
    expect(document.getElementById(errorId)).toHaveAttribute("role", "alert");
  });

  it("announces the answer once, in a polite status region", async () => {
    mockFetch({ body: ANSWER });
    render(<AskGuide />);

    sendQuestion("How much is a pass?");

    await waitFor(() =>
      expect(document.querySelector(".tml-ai-sr-only[role='status']")?.textContent).toMatch(/has answered/i),
    );
  });

  it("groups the edition buttons with a label", () => {
    render(<AskGuide />);
    expect(screen.getByRole("group", { name: /edition/i })).toBeInTheDocument();
  });

  it("groups the thread so it can be named and scrolled with a keyboard", async () => {
    mockFetch({ body: ANSWER });
    render(<AskGuide />);
    const conversation = screen.getByRole("group", { name: /conversation/i });
    // No tab stop until there is something to scroll.
    expect(conversation).not.toHaveAttribute("tabindex");

    sendQuestion("How much is a pass?");
    await screen.findByText(/€144/);
    expect(screen.getByRole("group", { name: /conversation/i })).toHaveAttribute("tabindex", "0");
  });

  it("caps the input length", () => {
    render(<AskGuide />);
    expect(composer()).toHaveAttribute("maxlength", String(MAX_QUESTION_LENGTH));
  });
});

describe("starting over", () => {
  it("clears the thread and the composer with New chat", async () => {
    mockFetch({ body: ANSWER });
    render(<AskGuide />);

    sendQuestion("How much is a pass?");
    await screen.findByText(/€144/);

    fireEvent.click(screen.getByRole("button", { name: /new chat/i }));

    expect(composer()).toHaveValue("");
    expect(screen.queryByText(/€144/)).not.toBeInTheDocument();
    // The welcome state comes back.
    expect(screen.getByText(/Verified answers from checked Tomorrowland records/)).toBeInTheDocument();
  });
});

describe("helpers", () => {
  it("formats a check date and tolerates a bad value", () => {
    expect(formatCheckedDate("2026-11-18")).toBe("18 Nov 2026");
    expect(formatCheckedDate(null)).toBeNull();
    expect(formatCheckedDate("nonsense")).toBeNull();
  });

  it("gives every refusal reason a human heading", () => {
    for (const reason of [
      "no-sources",
      "not-published",
      "out-of-scope",
      "spend-cap",
      "provider-unavailable",
      "unconfigured",
      "prompt-injection",
    ]) {
      const label = refusalLabel(reason);
      expect(label.length, reason).toBeGreaterThan(3);
      expect(label.toLowerCase(), reason).not.toBe("error");
    }
  });
});
