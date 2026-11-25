"use client";

import { useId, useState } from "react";
import { REPORT_KINDS, REPORT_KIND_LABELS, type ReportKind } from "@/lib/community/link-report-schema";
import "./report-link.css";

type SubmitState =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "accepted" }
  | { readonly kind: "refused"; readonly message: string }
  | { readonly kind: "invalid"; readonly fields: Readonly<Record<string, string>> };

/** Turns the API's field map into the first message worth showing. */
function firstMessage(fields: Readonly<Record<string, string>>): string {
  for (const key of ["url", "kind", "details", "page", "_form"]) {
    const message = fields[key];
    if (message !== undefined) return message;
  }
  return "Please check the details and try again.";
}

export interface ReportLinkFormProps {
  /** The page the report is filed from, sent so the operator knows where it was seen. */
  readonly page: string;
  /** The URL the visitor arrived to check, if the page knows one. */
  readonly defaultUrl?: string;
}

/**
 * The report-a-broken-link form.
 *
 * One link field, one reason, optional detail. The honeypot is a text input named
 * `website`, hidden from people in a way a screen reader also skips: it is
 * `aria-hidden` and `tabIndex={-1}` inside a visually-removed wrapper, so it costs
 * a keyboard user no stops. A bot that fills it gets the same success answer a
 * person gets.
 *
 * ## What the visitor is told
 *
 * The response is reported as it happened. `202` means the report was recorded;
 * `503` means it was **not**, and the form says so in those words rather than
 * thanking them for a report nobody will read. A refusal by validation shows the
 * first field message and keeps everything the visitor typed.
 */
export function ReportLinkForm({ page, defaultUrl = "" }: ReportLinkFormProps) {
  const id = useId();
  const [url, setUrl] = useState(defaultUrl);
  const [kind, setKind] = useState<ReportKind>("invite");
  const [details, setDetails] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const busy = state.kind === "sending";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setState({ kind: "sending" });

    const body: Record<string, string> = { url: url.trim(), kind, page };
    if (details.trim() !== "") body.details = details.trim();
    // Always sent, even when empty: the route treats a non-empty value as the bot
    // signal, and omitting it entirely would be a distinguishable shape.
    body.website = website;

    try {
      const response = await fetch("/api/community/report-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
        body: JSON.stringify(body),
      });

      if (response.status === 202) {
        setState({ kind: "accepted" });
        return;
      }

      if (response.status === 422) {
        const payload: unknown = await response.json();
        const fields =
          typeof payload === "object" && payload !== null
            ? (payload as { fields?: unknown }).fields
            : undefined;
        setState({
          kind: "invalid",
          fields:
            typeof fields === "object" && fields !== null
              ? (fields as Record<string, string>)
              : { _form: "Please check the details and try again." },
        });
        return;
      }

      if (response.status === 429) {
        setState({
          kind: "refused",
          message: "Too many reports sent from this connection. Please try again later.",
        });
        return;
      }

      if (response.status === 503) {
        setState({
          kind: "refused",
          message: "Reports are not being saved at the moment. Nothing has been recorded.",
        });
        return;
      }

      if (response.status === 403) {
        setState({
          kind: "refused",
          message: "The request was refused. Reload the page and try once more.",
        });
        return;
      }

      setState({
        kind: "refused",
        message: "The report could not be saved. Nothing has been recorded — please try again later.",
      });
    } catch {
      setState({
        kind: "refused",
        message: "The connection dropped before the report was saved. Nothing has been recorded.",
      });
    }
  };

  if (state.kind === "accepted") {
    return (
      <div className="tml-report tml-report--done">
        <h2 className="tml-report__title">Thank you — that is recorded</h2>
        <p className="tml-report__note">
          The link will be checked and fixed or removed. Nothing else is needed from you, and no
          contact details were requested or stored.
        </p>
      </div>
    );
  }

  const fieldMessage = state.kind === "invalid" ? firstMessage(state.fields) : null;

  return (
    <form className="tml-report" onSubmit={(event) => void submit(event)} noValidate>
      <h2 className="tml-report__title" id={`${id}-title`}>
        Report a broken link
      </h2>
      <p className="tml-report__note">
        If an invite has closed or a resource link is dead, say so here. The report is checked
        before anything is changed, so a link is never removed on one person&rsquo;s word alone.
      </p>

      <div className="tml-report__field">
        <label className="tml-report__label" htmlFor={`${id}-url`}>
          The link
        </label>
        <input
          className="tml-report__input"
          id={`${id}-url`}
          name="url"
          type="url"
          inputMode="url"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="https://"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={state.kind === "invalid" && state.fields.url !== undefined}
          aria-describedby={`${id}-url-hint`}
        />
        <p className="tml-report__hint" id={`${id}-url-hint`}>
          Copy it from the address bar. It must start with https://.
        </p>
      </div>

      <fieldset className="tml-report__field tml-report__fieldset">
        <legend className="tml-report__label">What is wrong</legend>
        <div className="tml-report__options">
          {REPORT_KINDS.map((option) => (
            <label key={option} className="tml-report__option">
              <input
                type="radio"
                name="kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
              />
              <span>{REPORT_KIND_LABELS[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="tml-report__field">
        <label className="tml-report__label" htmlFor={`${id}-details`}>
          Anything else <span className="tml-report__optional">(optional)</span>
        </label>
        <textarea
          className="tml-report__input tml-report__textarea"
          id={`${id}-details`}
          name="details"
          rows={3}
          maxLength={1000}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </div>

      {/*
        The honeypot. Hidden with `display: none` via the class rather than the
        `hidden` attribute, so a naive bot that strips `hidden` still sees it in the
        DOM. `aria-hidden` and `tabIndex={-1}` keep it out of the accessibility tree
        and out of the tab order, so it costs a keyboard user nothing.
      */}
      <div className="tml-report__trap" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input
          id={`${id}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <div className="tml-report__actions">
        <button type="submit" className="tml-report__submit" disabled={busy} aria-busy={busy}>
          {busy ? "Sending…" : "Send the report"}
        </button>
      </div>

      {/*
        One polite region, present from the first paint: a refusal is announced
        when it arrives, and the same sentence is visible for everyone else.
      */}
      <p className="tml-report__status" role="status" aria-live="polite">
        {state.kind === "refused" ? state.message : null}
        {fieldMessage}
      </p>
    </form>
  );
}
