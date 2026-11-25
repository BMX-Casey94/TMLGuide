"use client";

import { useCallback, useId, useMemo, useState } from "react";
import type { NewsRecord, NewsStatus } from "@/lib/community/news-schema";
import { NEWS_STATUS_LABELS } from "./admin-labels";
import {
  isSessionExpired,
  readAuthEnvironment,
  signInWithPassword,
  verifyTotpCode,
  type AuthSession,
} from "./admin-auth-client";
import { AdminNewsEditor } from "./admin-news-editor";
import "./admin.css";

/** An entry as the admin API returns it. */
export interface AdminEntry {
  readonly id: string;
  readonly status: NewsStatus;
  readonly item: NewsRecord;
  readonly likeCount: number;
  readonly publishedAt: string;
}

type SessionState =
  | { readonly kind: "signed-out" }
  | { readonly kind: "signed-in"; readonly session: AuthSession }
  | {
      readonly kind: "mfa";
      readonly challengeToken: string;
      readonly factorId: string;
      readonly email: string;
    };

type ListState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly entries: readonly AdminEntry[] }
  | { readonly kind: "refused"; readonly message: string };

/** One message at a time, shown in a polite live region. */
type Notice = { readonly tone: "ok" | "error"; readonly message: string } | null;

/**
 * The admin console.
 *
 * ## States, in the order an administrator meets them
 *
 * 1. **Not configured** — the public Supabase settings are absent, so sign-in
 *    cannot be attempted. Says so and offers nothing that would fail.
 * 2. **Signed out** — email and password.
 * 3. **MFA** — the six-digit code. Reached only when the account has a verified
 *    factor; an account without one is signed straight in on step 2, and the API
 *    will refuse its requests on the server with the reason shown here.
 * 4. **Signed in** — the listing and the editor.
 *
 * ## What the console does not decide
 *
 * Every request carries the token and the API re-checks it. The screens here are
 * convenience; `src/lib/admin/auth.ts` is the control. A console that hid the
 * editor without the API refusing the request would be decoration.
 *
 * ## The token
 *
 * Held in React state, which means memory, which means a reload signs the
 * administrator out. See `admin-auth-client.ts` for why that is the trade.
 */
export function AdminConsole() {
  const id = useId();
  const [env] = useState( () => readAuthEnvironment());
  const [session, setSession] = useState<SessionState>({ kind: "signed-out" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [list, setList] = useState<ListState>({ kind: "idle" });

  const token = session.kind === "signed-in" ? session.session.accessToken : null;

  /**
   * Loads the listing for a session, and drops it if the API refuses the token.
   *
   * Called explicitly when a session is established rather than from an effect.
   * There is no session on mount — the token lives in memory, so a reload signs
   * the administrator out — which means an effect would only ever fire after a
   * sign-in that already knows it needs the listing. Loading it there removes a
   * cascading render and a window in which the editor is visible while the
   * listing is still on its way.
   */
  const loadEntries = useCallback(async (accessToken: string) => {
    setList({ kind: "loading" });
    try {
      const response = await fetch("/api/admin/news", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        /*
          The body is read before the session is cleared, so the refusal message
          and the sign-in form appear in the same render. Clearing first left the
          "Signed in." message beside the sign-in form until the body arrived.
        */
        const payload: unknown = await response.json().catch(() => null);
        const message =
          typeof payload === "object" && payload !== null
            ? (payload as { error?: unknown }).error
            : undefined;

        setSession({ kind: "signed-out" });
        setList({ kind: "idle" });
        setNotice({
          tone: "error",
          message:
            typeof message === "string"
              ? message
              : "The session was refused. Sign in again, including the code step.",
        });
        return;
      }

      if (!response.ok) {
        setList({ kind: "refused", message: "The news list could not be read." });
        return;
      }

      const payload: unknown = await response.json();
      const entries =
        typeof payload === "object" && payload !== null
          ? (payload as { entries?: unknown }).entries
          : undefined;
      setList({
        kind: "ready",
        entries: Array.isArray(entries) ? (entries as readonly AdminEntry[]) : [],
      });
    } catch {
      setList({ kind: "refused", message: "The news list could not be read." });
    }
  }, []);

  /**
   * The one way a session is established.
   *
   * Expiry is checked here rather than in an effect: a session that has already
   * lapsed is not a session, and refusing it at the point it arrives means nothing
   * downstream has to handle a token it cannot use.
   */
  const startSession = useCallback(
    (next: AuthSession, message: string) => {
      if (isSessionExpired(next)) {
        setSession({ kind: "signed-out" });
        setList({ kind: "idle" });
        setNotice({ tone: "error", message: "That session expired before it could be used. Sign in again." });
        return;
      }

      setSession({ kind: "signed-in", session: next });
      setNotice({ tone: "ok", message });
      void loadEntries(next.accessToken);
    },
    [loadEntries],
  );

  const submitCredentials = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice(null);

    const outcome = await signInWithPassword(env, {
      email: email.trim(),
      password,
    });

    setBusy(false);
    setPassword("");

    switch (outcome.kind) {
      case "session":
        startSession(outcome.session, "Signed in.");
        return;
      case "mfa-required":
        setSession({
          kind: "mfa",
          challengeToken: outcome.challengeToken,
          factorId: outcome.factorId,
          email: email.trim(),
        });
        setNotice({ tone: "ok", message: "Enter the six-digit code from your authenticator app." });
        return;
      case "invalid-credentials":
        setNotice({ tone: "error", message: "That email address and password do not match an account." });
        return;
      case "rate-limited":
        setNotice({
          tone: "error",
          message: `Too many attempts. Wait ${outcome.retryAfterSec} seconds and try again.`,
        });
        return;
      case "not-configured":
        setNotice({ tone: "error", message: "Administrator sign-in is not configured on this deployment." });
        return;
      case "unavailable":
        setNotice({ tone: "error", message: "The sign-in service is unavailable. Try again shortly." });
        return;
    }
  };

  const submitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || session.kind !== "mfa") return;
    setBusy(true);
    setNotice(null);

    const outcome = await verifyTotpCode(env, {
      challengeToken: session.challengeToken,
      factorId: session.factorId,
      code: code.trim(),
    });

    setBusy(false);
    setCode("");

    switch (outcome.kind) {
      case "session":
        startSession(outcome.session, "Signed in with two-factor authentication.");
        return;
      case "invalid-code":
        setNotice({ tone: "error", message: "That code was not accepted. Use the current code and try again." });
        return;
      case "rate-limited":
        setNotice({
          tone: "error",
          message: `Too many attempts. Wait ${outcome.retryAfterSec} seconds and try again.`,
        });
        return;
      case "unavailable":
        setNotice({ tone: "error", message: "The sign-in service is unavailable. Try again shortly." });
        return;
    }
  };

  const signOut = () => {
    setSession({ kind: "signed-out" });
    setList({ kind: "idle" });
    setEmail("");
    setPassword("");
    setCode("");
    setNotice({ tone: "ok", message: "Signed out. The token was discarded." });
  };

  /** Called by the editor after a successful write, so the listing reflects it. */
  const onMutated = useCallback(
    async (message: string) => {
      setNotice({ tone: "ok", message });
      if (token !== null) await loadEntries(token);
    },
    [token, loadEntries],
  );

  const entries = useMemo(
    () => (list.kind === "ready" ? list.entries : []),
    [list],
  );

  return (
    <div className="tml-admin">
      <header className="tml-admin__hero">
        <p className="label text-accent">Secured area</p>
        <h1 className="tml-admin__title">Admin console</h1>
        <p className="tml-admin__lede">
          Publishing for the community news feed. Every request is authorised on the server against
          Supabase Auth, with an administrator role and a completed second factor, and every change
          is written to an audit log.
        </p>
      </header>

      {/*
        One polite region for the whole console, rendered from the first paint so
        an announcement always has somewhere to land.
      */}
      <p className="tml-admin__notice" role="status" aria-live="polite" data-tone={notice?.tone ?? "none"}>
        {notice?.message ?? null}
      </p>

      {env === null ? (
        <section className="tml-admin__panel" aria-labelledby={`${id}-config`}>
          <h2 className="tml-admin__panel-title" id={`${id}-config`}>
            Sign-in is not configured
          </h2>
          <p className="tml-admin__panel-text">
            This deployment has no public Supabase project settings, so there is no identity provider
            to sign in against. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and the sign-in form appears here.
          </p>
        </section>
      ) : session.kind === "signed-out" ? (
        <section className="tml-admin__panel" aria-labelledby={`${id}-signin`}>
          <h2 className="tml-admin__panel-title" id={`${id}-signin`}>
            Sign in
          </h2>
          <p className="tml-admin__panel-text">
            Use the administrator account. If it has an authenticator app enrolled, the code step
            follows.
          </p>

          <form className="tml-admin__form" onSubmit={(event) => void submitCredentials(event)}>
            <div className="tml-admin__field">
              <label className="tml-admin__label" htmlFor={`${id}-email`}>
                Email address
              </label>
              <input
                className="tml-admin__input"
                id={`${id}-email`}
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="tml-admin__field">
              <label className="tml-admin__label" htmlFor={`${id}-password`}>
                Password
              </label>
              <input
                className="tml-admin__input"
                id={`${id}-password`}
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <button type="submit" className="tml-admin__button" disabled={busy} aria-busy={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </section>
      ) : session.kind === "mfa" ? (
        <section className="tml-admin__panel" aria-labelledby={`${id}-mfa`}>
          <h2 className="tml-admin__panel-title" id={`${id}-mfa`}>
            Two-factor code
          </h2>
          <p className="tml-admin__panel-text">
            {session.email === "" ? "Your account" : session.email} has an authenticator app enrolled.
            Enter the current six-digit code. Administrator access is refused until this step is
            completed.
          </p>

          <form className="tml-admin__form" onSubmit={(event) => void submitCode(event)}>
            <div className="tml-admin__field">
              <label className="tml-admin__label" htmlFor={`${id}-code`}>
                Six-digit code
              </label>
              <input
                className="tml-admin__input tml-admin__input--code"
                id={`${id}-code`}
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>

            <div className="tml-admin__actions">
              <button type="submit" className="tml-admin__button" disabled={busy} aria-busy={busy}>
                {busy ? "Checking…" : "Verify and continue"}
              </button>
              <button
                type="button"
                className="tml-admin__button tml-admin__button--ghost"
                onClick={signOut}
                disabled={busy}
              >
                Start again
              </button>
            </div>
          </form>
        </section>
      ) : (
        <>
          <div className="tml-admin__bar">
            <p className="tml-admin__who">
              Signed in{session.session.email === null ? "" : ` as ${session.session.email}`}
            </p>
            <button type="button" className="tml-admin__button tml-admin__button--ghost" onClick={signOut}>
              Sign out
            </button>
          </div>

          <section className="tml-admin__panel" aria-labelledby={`${id}-editor`}>
            <h2 className="tml-admin__panel-title" id={`${id}-editor`}>
              Publish or edit a news item
            </h2>
            <p className="tml-admin__panel-text">
              The record is validated against the same schema the site builds with, so content the
              public page could not render is refused here rather than stored.
            </p>
            <AdminNewsEditor
              token={session.session.accessToken}
              entries={entries}
              onMutated={onMutated}
            />
          </section>

          <section className="tml-admin__panel" aria-labelledby={`${id}-list`}>
            <h2 className="tml-admin__panel-title" id={`${id}-list`}>
              Every news row
            </h2>
            {list.kind === "loading" ? (
              <p className="tml-admin__panel-text">Loading…</p>
            ) : list.kind === "refused" ? (
              <p className="tml-admin__panel-text">{list.message}</p>
            ) : entries.length === 0 ? (
              <p className="tml-admin__panel-text">
                The table is empty. Nothing has been published or saved as a draft yet.
              </p>
            ) : (
              <div className="tml-admin__table-wrap">
                <table className="tml-admin__table">
                  <caption className="tml-admin__caption">
                    {entries.length} {entries.length === 1 ? "row" : "rows"}, newest publication
                    first
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">Id</th>
                      <th scope="col">Status</th>
                      <th scope="col">Published</th>
                      <th scope="col">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id}>
                        <th scope="row">{entry.item.title}</th>
                        <td>
                          <code>{entry.item.id}</code>
                        </td>
                        <td>{NEWS_STATUS_LABELS[entry.status]}</td>
                        <td>{entry.item.publishedOn}</td>
                        <td className="tml-admin__num">{entry.likeCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
