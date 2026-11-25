"use client";

import { useId, useState } from "react";
import type { NewsStatus } from "@/lib/community/news-schema";
import { NEWS_STATUS_LABELS, NEWS_STATUS_ORDER } from "./admin-labels";
import type { AdminEntry } from "./admin-console";

/** The editable form fields, all strings because that is what inputs hold. */
interface Draft {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly publishedOn: string;
  readonly edition: string;
  readonly summary: string;
  readonly body: string;
  readonly tags: string; // comma-separated
  readonly sourceUrl: string;
  readonly sourceTitle: string;
  readonly sourceRetrievedOn: string;
  readonly lastVerified: string;
  readonly confidence: string;
  readonly status: NewsStatus;
}

const EMPTY: Draft = {
  id: "",
  slug: "",
  title: "",
  publishedOn: "",
  edition: "all",
  summary: "",
  body: "",
  tags: "",
  sourceUrl: "",
  sourceTitle: "",
  sourceRetrievedOn: "",
  lastVerified: "",
  confidence: "community",
  status: "draft",
};

const EDITIONS = ["belgium", "winter", "brasil", "all"] as const;
const CONFIDENCES = ["official", "community", "unverified"] as const;

/** Turns a free-text label into a kebab-case slug, for the suggestions. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Turns the comma-separated tag field into the array the schema expects. */
export function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

/** Builds the schema record from the draft. The API validates it; this only shapes it. */
export function draftToRecord(draft: Draft): unknown {
  return {
    id: draft.id.trim(),
    slug: draft.slug.trim(),
    title: draft.title.trim(),
    publishedOn: draft.publishedOn.trim(),
    edition: draft.edition,
    summary: draft.summary.trim(),
    body: draft.body.trim(),
    tags: parseTags(draft.tags),
    source: {
      url: draft.sourceUrl.trim(),
      title: draft.sourceTitle.trim(),
      retrievedOn: draft.sourceRetrievedOn.trim(),
    },
    lastVerified: draft.lastVerified.trim(),
    confidence: draft.confidence,
  };
}

/** Fills the form from an existing entry, so an edit starts from what is stored. */
export function entryToDraft(entry: AdminEntry): Draft {
  const { item } = entry;
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    publishedOn: item.publishedOn,
    edition: item.edition,
    summary: item.summary,
    body: item.body,
    tags: item.tags.join(", "),
    sourceUrl: item.source.url,
    sourceTitle: item.source.title,
    sourceRetrievedOn: item.source.retrievedOn,
    lastVerified: item.lastVerified,
    confidence: item.confidence,
    status: entry.status,
  };
}

type SubmitState =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "invalid"; readonly fields: Readonly<Record<string, string>> }
  | { readonly kind: "failed"; readonly message: string };

export interface AdminNewsEditorProps {
  readonly token: string;
  readonly entries: readonly AdminEntry[];
  /** Called after a successful write, with a sentence for the console's live region. */
  readonly onMutated: (message: string) => void | Promise<void>;
}

/** The first message worth showing, in the order the form reads. */
function firstMessage(fields: Readonly<Record<string, string>>): string {
  for (const key of Object.keys(fields)) return fields[key] ?? "";
  return "Please check the fields and try again.";
}

/**
 * The news form: create, update and delete one record.
 *
 * ## Why it edits the schema record directly
 *
 * The fields are exactly `newsItemSchema`'s, in the order the record reads, so an
 * author fills in what the site will render and nothing else. The `id` and `slug`
 * are separate because both are real: the id keys the row and the slug is the
 * URL. A button copies one from the title and offers the other, rather than
 * guessing, because a slug changes an address readers may have bookmarked.
 *
 * ## Errors
 *
 * A `422` carries a field map from the API, and the first message is shown beside
 * the form with every field's message kept so a second attempt fixes all of them
 * at once. Nothing the form sent is discarded on a failure, so an administrator
 * does not lose a long article to one bad date.
 */
export function AdminNewsEditor({ token, entries, onMutated }: AdminNewsEditorProps) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const busy = state.kind === "sending" || deleting;
  const fields = state.kind === "invalid" ? state.fields : {};

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const loadEntry = (entryId: string) => {
    const entry = entries.find((candidate) => candidate.id === entryId);
    if (entry === undefined) return;
    setDraft(entryToDraft(entry));
    setState({ kind: "idle" });
    setConfirmDelete(false);
  };

  const reset = () => {
    setDraft(EMPTY);
    setState({ kind: "idle" });
    setConfirmDelete(false);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setState({ kind: "sending" });

    let response: Response;
    try {
      response = await fetch("/api/admin/news", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "omit",
        cache: "no-store",
        body: JSON.stringify({ status: draft.status, item: draftToRecord(draft) }),
      });
    } catch {
      setState({ kind: "failed", message: "The connection dropped before the change was saved." });
      return;
    }

    if (response.status === 422) {
      const payload: unknown = await response.json().catch(() => null);
      const map =
        typeof payload === "object" && payload !== null
          ? (payload as { fields?: unknown }).fields
          : undefined;
      setState({
        kind: "invalid",
        fields:
          typeof map === "object" && map !== null
            ? (map as Record<string, string>)
            : { _form: "The record was refused. Check every field." },
      });
      return;
    }

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const message =
        typeof payload === "object" && payload !== null
          ? (payload as { error?: unknown }).error
          : undefined;
      setState({
        kind: "failed",
        message:
          typeof message === "string" ? message : "The change was not saved. Nothing was altered.",
      });
      return;
    }

    const payload: unknown = await response.json().catch(() => null);
    const audited =
      typeof payload === "object" && payload !== null
        ? (payload as { audited?: unknown }).audited
        : undefined;
    const status =
      typeof payload === "object" && payload !== null
        ? (payload as { status?: unknown }).status
        : undefined;

    setState({ kind: "idle" });
    await onMutated(
      `Saved (${typeof status === "string" ? status : "ok"}).` +
        (audited === false
          ? " The audit entry could not be written — tell the site operator."
          : ""),
    );
  };

  const remove = async () => {
    if (busy || draft.id.trim() === "") return;
    setDeleting(true);

    try {
      const response = await fetch(
        `/api/admin/news?id=${encodeURIComponent(draft.id.trim())}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          credentials: "omit",
          cache: "no-store",
        },
      );

      if (response.status === 404) {
        setState({ kind: "failed", message: "No row with that id exists, so nothing was deleted." });
        return;
      }
      if (!response.ok) {
        setState({ kind: "failed", message: "The row was not deleted." });
        return;
      }

      setConfirmDelete(false);
      reset();
      await onMutated("Deleted.");
    } catch {
      setState({ kind: "failed", message: "The connection dropped before the row was deleted." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="tml-admin__editor">
      {entries.length > 0 ? (
        <div className="tml-admin__field">
          <label className="tml-admin__label" htmlFor={`${id}-load`}>
            Edit an existing row
          </label>
          <select
            className="tml-admin__input"
            id={`${id}-load`}
            defaultValue=""
            onChange={(event) => {
              if (event.target.value !== "") loadEntry(event.target.value);
            }}
          >
            <option value="">New item</option>
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {`${entry.item.title} (${NEWS_STATUS_LABELS[entry.status]})`}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <form className="tml-admin__form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="tml-admin__grid">
          <div className="tml-admin__field">
            <label className="tml-admin__label" htmlFor={`${id}-title`}>
              Title
            </label>
            <input
              className="tml-admin__input"
              id={`${id}-title`}
              value={draft.title}
              maxLength={160}
              onChange={(event) => {
                const title = event.target.value;
                setDraft((current) => ({
                  ...current,
                  title,
                  // Only fill the two identifiers while they are untouched, so a
                  // deliberate choice is never overwritten by a later edit.
                  id: current.id === "" ? slugify(title) : current.id,
                  slug: current.slug === "" ? slugify(title) : current.slug,
                }));
              }}
              aria-invalid={fields.title !== undefined}
              aria-describedby={fields.title === undefined ? undefined : `${id}-title-error`}
            />
            {fields.title === undefined ? null : (
              <p className="tml-admin__error" id={`${id}-title-error`}>
                {fields.title}
              </p>
            )}
          </div>

          <div className="tml-admin__field">
            <label className="tml-admin__label" htmlFor={`${id}-status`}>
              Status
            </label>
            <select
              className="tml-admin__input"
              id={`${id}-status`}
              value={draft.status}
              onChange={(event) => set("status", event.target.value as NewsStatus)}
            >
              {NEWS_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {NEWS_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <p className="tml-admin__hint">
              Only a published row appears on the public page. A draft is saved and not shown.
            </p>
          </div>

          <div className="tml-admin__field">
            <label className="tml-admin__label" htmlFor={`${id}-id`}>
              Id
            </label>
            <input
              className="tml-admin__input"
              id={`${id}-id`}
              value={draft.id}
              maxLength={80}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => set("id", event.target.value)}
              aria-invalid={fields.id !== undefined}
              aria-describedby={fields.id === undefined ? undefined : `${id}-id-error`}
            />
            {fields.id === undefined ? (
              <p className="tml-admin__hint">Lowercase letters, digits and single hyphens.</p>
            ) : (
              <p className="tml-admin__error" id={`${id}-id-error`}>
                {fields.id}
              </p>
            )}
          </div>

          <div className="tml-admin__field">
            <label className="tml-admin__label" htmlFor={`${id}-slug`}>
              Slug (the page address)
            </label>
            <input
              className="tml-admin__input"
              id={`${id}-slug`}
              value={draft.slug}
              maxLength={80}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => set("slug", event.target.value)}
              aria-invalid={fields.slug !== undefined}
              aria-describedby={fields.slug === undefined ? undefined : `${id}-slug-error`}
            />
            {fields.slug === undefined ? (
              <p className="tml-admin__hint">
                Keep this stable once published: changing it breaks inbound links.
              </p>
            ) : (
              <p className="tml-admin__error" id={`${id}-slug-error`}>
                {fields.slug}
              </p>
            )}
          </div>

          <div className="tml-admin__field">
            <label className="tml-admin__label" htmlFor={`${id}-published`}>
              Published on
            </label>
            <input
              className="tml-admin__input"
              id={`${id}-published`}
              type="date"
              value={draft.publishedOn}
              onChange={(event) => set("publishedOn", event.target.value)}
              aria-invalid={fields.publishedOn !== undefined}
              aria-describedby={fields.publishedOn === undefined ? undefined : `${id}-published-error`}
            />
            {fields.publishedOn === undefined ? null : (
              <p className="tml-admin__error" id={`${id}-published-error`}>
                {fields.publishedOn}
              </p>
            )}
          </div>

          <div className="tml-admin__field">
            <label className="tml-admin__label" htmlFor={`${id}-verified`}>
              Last checked
            </label>
            <input
              className="tml-admin__input"
              id={`${id}-verified`}
              type="date"
              value={draft.lastVerified}
              onChange={(event) => set("lastVerified", event.target.value)}
              aria-invalid={fields.lastVerified !== undefined}
              aria-describedby={fields.lastVerified === undefined ? undefined : `${id}-verified-error`}
            />
            {fields.lastVerified === undefined ? null : (
              <p className="tml-admin__error" id={`${id}-verified-error`}>
                {fields.lastVerified}
              </p>
            )}
          </div>

          <div className="tml-admin__field">
            <label className="tml-admin__label" htmlFor={`${id}-edition`}>
              Edition
            </label>
            <select
              className="tml-admin__input"
              id={`${id}-edition`}
              value={draft.edition}
              onChange={(event) => set("edition", event.target.value)}
            >
              {EDITIONS.map((edition) => (
                <option key={edition} value={edition}>
                  {edition}
                </option>
              ))}
            </select>
          </div>

          <div className="tml-admin__field">
            <label className="tml-admin__label" htmlFor={`${id}-confidence`}>
              Confidence
            </label>
            <select
              className="tml-admin__input"
              id={`${id}-confidence`}
              value={draft.confidence}
              onChange={(event) => set("confidence", event.target.value)}
            >
              {CONFIDENCES.map((confidence) => (
                <option key={confidence} value={confidence}>
                  {confidence}
                </option>
              ))}
            </select>
            <p className="tml-admin__hint">
              &ldquo;official&rdquo; is only for a tomorrowland.com source; the data layer refuses
              anything else.
            </p>
          </div>
        </div>

        <div className="tml-admin__field">
          <label className="tml-admin__label" htmlFor={`${id}-summary`}>
            Summary
          </label>
          <textarea
            className="tml-admin__input tml-admin__textarea"
            id={`${id}-summary`}
            rows={2}
            maxLength={300}
            value={draft.summary}
            onChange={(event) => set("summary", event.target.value)}
            aria-invalid={fields.summary !== undefined}
          />
          {fields.summary === undefined ? null : <p className="tml-admin__error">{fields.summary}</p>}
        </div>

        <div className="tml-admin__field">
          <label className="tml-admin__label" htmlFor={`${id}-body`}>
            Body (Markdown: paragraphs, ## headings, - lists, **bold**)
          </label>
          <textarea
            className="tml-admin__input tml-admin__textarea tml-admin__textarea--tall"
            id={`${id}-body`}
            rows={12}
            maxLength={20_000}
            value={draft.body}
            onChange={(event) => set("body", event.target.value)}
            aria-invalid={fields.body !== undefined}
          />
          {fields.body === undefined ? null : <p className="tml-admin__error">{fields.body}</p>}
        </div>

        <div className="tml-admin__field">
          <label className="tml-admin__label" htmlFor={`${id}-tags`}>
            Tags (comma-separated, up to 12)
          </label>
          <input
            className="tml-admin__input"
            id={`${id}-tags`}
            value={draft.tags}
            onChange={(event) => set("tags", event.target.value)}
            aria-invalid={fields.tags !== undefined}
          />
          {fields.tags === undefined ? null : <p className="tml-admin__error">{fields.tags}</p>}
        </div>

        <fieldset className="tml-admin__fieldset">
          <legend className="tml-admin__label">Source (the page this came from)</legend>

          <div className="tml-admin__field">
            <label className="tml-admin__label" htmlFor={`${id}-source-url`}>
              Source URL
            </label>
            <input
              className="tml-admin__input"
              id={`${id}-source-url`}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://"
              value={draft.sourceUrl}
              onChange={(event) => set("sourceUrl", event.target.value)}
              aria-invalid={fields["source.url"] !== undefined}
            />
            {fields["source.url"] === undefined ? null : (
              <p className="tml-admin__error">{fields["source.url"]}</p>
            )}
          </div>

          <div className="tml-admin__grid">
            <div className="tml-admin__field">
              <label className="tml-admin__label" htmlFor={`${id}-source-title`}>
                Source title
              </label>
              <input
                className="tml-admin__input"
                id={`${id}-source-title`}
                maxLength={200}
                value={draft.sourceTitle}
                onChange={(event) => set("sourceTitle", event.target.value)}
                aria-invalid={fields["source.title"] !== undefined}
              />
              {fields["source.title"] === undefined ? null : (
                <p className="tml-admin__error">{fields["source.title"]}</p>
              )}
            </div>

            <div className="tml-admin__field">
              <label className="tml-admin__label" htmlFor={`${id}-source-date`}>
                Source read on
              </label>
              <input
                className="tml-admin__input"
                id={`${id}-source-date`}
                type="date"
                value={draft.sourceRetrievedOn}
                onChange={(event) => set("sourceRetrievedOn", event.target.value)}
                aria-invalid={fields["source.retrievedOn"] !== undefined}
              />
              {fields["source.retrievedOn"] === undefined ? null : (
                <p className="tml-admin__error">{fields["source.retrievedOn"]}</p>
              )}
            </div>
          </div>
        </fieldset>

        {state.kind === "invalid" ? (
          <p className="tml-admin__error tml-admin__error--form" role="alert">
            {firstMessage(state.fields)}
          </p>
        ) : null}
        {state.kind === "failed" ? (
          <p className="tml-admin__error tml-admin__error--form" role="alert">
            {state.message}
          </p>
        ) : null}

        <div className="tml-admin__actions">
          <button type="submit" className="tml-admin__button" disabled={busy} aria-busy={busy}>
            {state.kind === "sending" ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="tml-admin__button tml-admin__button--ghost"
            onClick={reset}
            disabled={busy}
          >
            Clear the form
          </button>
        </div>
      </form>

      <div className="tml-admin__danger">
        <h3 className="tml-admin__subtitle">Delete this row</h3>
        <p className="tml-admin__hint">
          Deleting removes the record and its like count. The audit log keeps the fact that it was
          deleted, by whom and when, but not the article itself.
        </p>
        {confirmDelete ? (
          <div className="tml-admin__actions">
            <button
              type="button"
              className="tml-admin__button tml-admin__button--danger"
              onClick={() => void remove()}
              disabled={busy}
              aria-busy={deleting}
            >
              {deleting ? "Deleting…" : `Delete "${draft.title === "" ? draft.id : draft.title}"`}
            </button>
            <button
              type="button"
              className="tml-admin__button tml-admin__button--ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              Keep it
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="tml-admin__button tml-admin__button--ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={busy || draft.id.trim() === ""}
          >
            Delete…
          </button>
        )}
      </div>
    </div>
  );
}

/** Re-exported so a test can assert the shape the form sends without duplicating it. */
export type { Draft as AdminNewsDraft };
