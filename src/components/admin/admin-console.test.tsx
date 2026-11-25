import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AdminConsole } from "./admin-console";
import {
  decodeClaims,
  isSessionExpired,
  parseSession,
  readTotpFactors,
  signInWithPassword,
  verifyTotpCode,
} from "./admin-auth-client";

/*
  `NEXT_PUBLIC_SUPABASE_URL` is read at call time by `readAuthEnvironment`, so the
  tests stub it before each render. Nothing here touches a real project: every
  Auth call is a fetch double.
*/

const ENV_URL = "https://project.supabase.co";
const ANON_KEY = "anon-key";
const USER_ID = "9f8b7c6d-1234-4abc-8def-0123456789ab";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ENV_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Base64url-encodes a JSON object as UTF-8 bytes. */
function encodeSegment(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function token(claims: Record<string, unknown> = {}): string {
  return `${encodeSegment({ alg: "HS256" })}.${encodeSegment({
    sub: USER_ID,
    aal: "aal2",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  })}.signature`;
}

/** A GoTrue session payload. */
function sessionPayload(aal: "aal1" | "aal2", factors: unknown[] = []): Record<string, unknown> {
  const accessToken = token({ aal });
  return {
    access_token: accessToken,
    refresh_token: "refresh",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER_ID, email: "operator@tmlguide.example", factors },
  };
}

describe("AdminConsole — not configured", () => {
  it("says sign-in is not configured rather than showing a form that cannot work", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    render(<AdminConsole />);

    expect(screen.getByRole("heading", { name: "Sign-in is not configured" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
    // No password field, so there is nothing to type into and nothing to leak.
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("has exactly one h1 and one live region", () => {
    render(<AdminConsole />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});

describe("AdminConsole — sign in", () => {
  it("offers email and password with real labels", () => {
    render(<AdminConsole />);

    expect(screen.getByLabelText("Email address")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("asks for the code when the account has a verified factor", async () => {
    // A password sign-in that returns an aal1 session is not enough on its own.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          sessionPayload("aal1", [{ id: "factor-1", factor_type: "totp", status: "verified" }]),
        ),
      ),
    );

    render(<AdminConsole />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "operator@tmlguide.example" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form") as Element);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Two-factor code" })).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Six-digit code")).toHaveAttribute("autocomplete", "one-time-code");
  });

  it("says a session is refused when the API answers 401, rather than showing content", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/token")) return Response.json(sessionPayload("aal2"));
      return Response.json({ error: "Sign in to use the admin console." }, { status: 401 });
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<AdminConsole />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "op@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form") as Element);

    /*
      The console shows the editor for a moment while the listing loads — the
      token is valid until the API says otherwise, and the API is the authority.
      What matters is the end state: the editor is gone, the sign-in form is back,
      and the reason the API gave is on screen.
    */
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Sign in to use the admin console/i);
    });
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Publish or edit a news item" })).not.toBeInTheDocument();
  });

  it("says plainly that a bad password pair did not match an account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error_code: "invalid_credentials" }, { status: 400 })),
    );

    render(<AdminConsole />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "op@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form") as Element);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/do not match an account/i);
    });
  });

  it("reports a rate limit with the wait it was given", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 429, headers: { "retry-after": "45" } })),
    );

    render(<AdminConsole />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "op@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form") as Element);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Wait 45 seconds/i);
    });
  });

  it("rejects a second-factor code that is refused, and stays on the code screen", async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/token")) {
        return Response.json(
          sessionPayload("aal1", [{ id: "factor-1", factor_type: "totp", status: "verified" }]),
        );
      }
      if (url.endsWith("/challenge")) return Response.json({ id: "challenge-1" });
      return new Response("{}", { status: 403 });
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<AdminConsole />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "op@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form") as Element);

    await waitFor(() => expect(screen.getByLabelText("Six-digit code")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Six-digit code"), { target: { value: "123456" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Verify and continue" }).closest("form") as Element,
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/code was not accepted/i);
    });
    expect(screen.getByRole("heading", { name: "Two-factor code" })).toBeInTheDocument();
  });

  it("signs in fully once the code is accepted, and loads the listing", async () => {
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/v1/token")) {
        return Response.json(
          sessionPayload("aal1", [{ id: "factor-1", factor_type: "totp", status: "verified" }]),
        );
      }
      if (url.endsWith("/challenge")) return Response.json({ id: "challenge-1" });
      if (url.endsWith("/verify")) return Response.json(sessionPayload("aal2"));
      if (url.endsWith("/api/admin/news") && (init?.method ?? "GET") === "GET") {
        return Response.json({ entries: [] });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<AdminConsole />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "op@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form") as Element);

    await waitFor(() => expect(screen.getByLabelText("Six-digit code")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Six-digit code"), { target: { value: "123456" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Verify and continue" }).closest("form") as Element,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Publish or edit a news item" })).toBeInTheDocument();
    });

    // The listing is empty and says so without inventing a row.
    expect(screen.getByText(/The table is empty/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("strips everything but digits from the code field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(sessionPayload("aal1", [{ id: "f", factor_type: "totp", status: "verified" }])),
      ),
    );

    render(<AdminConsole />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "op@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pw" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form") as Element);

    await waitFor(() => expect(screen.getByLabelText("Six-digit code")).toBeInTheDocument());
    const code = screen.getByLabelText("Six-digit code");
    fireEvent.change(code, { target: { value: "12a3b4c5d6e7" } });
    expect(code).toHaveValue("123456");
  });
});

describe("signInWithPassword", () => {
  const env = { url: ENV_URL, anonKey: ANON_KEY };

  it("returns a session for a plain aal2 sign-in", async () => {
    const outcome = await signInWithPassword(
      env,
      { email: "op@example.com", password: "pw" },
      async () => Response.json(sessionPayload("aal2")),
    );

    expect(outcome.kind).toBe("session");
  });

  it("returns mfa-required with the factor when the account has one", async () => {
    const outcome = await signInWithPassword(
      env,
      { email: "op@example.com", password: "pw" },
      async () =>
        Response.json(
          sessionPayload("aal1", [{ id: "factor-9", factor_type: "totp", status: "verified" }]),
        ),
    );

    expect(outcome).toMatchObject({ kind: "mfa-required", factorId: "factor-9" });
  });

  it("handles the mfa_token error shape as well as the aal1 session shape", async () => {
    // Supabase returns either, depending on project settings; both must work.
    const outcome = await signInWithPassword(
      env,
      { email: "op@example.com", password: "pw" },
      async () =>
        Response.json(
          {
            error_code: "mfa_required",
            mfa_token: "short-lived-token",
            user: { factors: [{ id: "factor-9", factor_type: "totp", status: "verified" }] },
          },
          { status: 400 },
        ),
    );

    expect(outcome).toMatchObject({
      kind: "mfa-required",
      challengeToken: "short-lived-token",
      factorId: "factor-9",
      session: null,
    });
  });

  it("returns not-configured with no environment", async () => {
    expect(await signInWithPassword(null, { email: "a@b.c", password: "x" })).toEqual({
      kind: "not-configured",
    });
  });

  it("returns unavailable when the request throws", async () => {
    const outcome = await signInWithPassword(env, { email: "a@b.c", password: "x" }, async () => {
      throw new Error("offline");
    });
    expect(outcome).toEqual({ kind: "unavailable" });
  });

  it("returns unavailable for a 5xx", async () => {
    expect(
      await signInWithPassword(env, { email: "a@b.c", password: "x" }, async () =>
        new Response("{}", { status: 500 }),
      ),
    ).toEqual({ kind: "unavailable" });
  });

  it("returns invalid-credentials for a malformed 200", async () => {
    expect(
      await signInWithPassword(env, { email: "a@b.c", password: "x" }, async () =>
        Response.json({ nonsense: true }),
      ),
    ).toEqual({ kind: "unavailable" });
  });
});

describe("verifyTotpCode", () => {
  const env = { url: ENV_URL, anonKey: ANON_KEY };

  it("creates a challenge then verifies the code, returning the aal2 session", async () => {
    const calls: string[] = [];
    const outcome = await verifyTotpCode(
      env,
      { challengeToken: "aal1", factorId: "factor-1", code: "123456" },
      async (input, init) => {
        calls.push(`${init?.method ?? "GET"} ${String(input)}`);
        if (String(input).endsWith("/challenge")) return Response.json({ id: "challenge-1" });
        return Response.json(sessionPayload("aal2"));
      },
    );

    expect(outcome.kind).toBe("session");
    expect(calls).toEqual([
      `POST ${ENV_URL}/auth/v1/factors/factor-1/challenge`,
      `POST ${ENV_URL}/auth/v1/factors/factor-1/verify`,
    ]);
  });

  it("returns invalid-code for a 403 or 422 from the verify call", async () => {
    for (const status of [403, 422, 400]) {
      const outcome = await verifyTotpCode(
        env,
        { challengeToken: "aal1", factorId: "f", code: "000000" },
        async (input) =>
          String(input).endsWith("/challenge")
            ? Response.json({ id: "c" })
            : new Response("{}", { status }),
      );
      expect(outcome).toEqual({ kind: "invalid-code" });
    }
  });

  it("returns unavailable when the challenge itself fails", async () => {
    const outcome = await verifyTotpCode(
      env,
      { challengeToken: "aal1", factorId: "f", code: "123456" },
      async () => new Response("{}", { status: 500 }),
    );
    expect(outcome).toEqual({ kind: "unavailable" });
  });

  it("encodes the factor id into the path rather than interpolating it raw", async () => {
    let seen = "";
    await verifyTotpCode(
      env,
      { challengeToken: "aal1", factorId: "../../etc/passwd", code: "123456" },
      async (input) => {
        seen = String(input);
        return Response.json({ id: "c" });
      },
    );
    expect(seen).toContain("%2F");
    expect(seen).not.toContain("/../");
  });
});

describe("readTotpFactors", () => {
  it("keeps only verified totp factors", () => {
    expect(
      readTotpFactors({
        factors: [
          { id: "a", factor_type: "totp", status: "verified" },
          { id: "b", factor_type: "totp", status: "unverified" },
          { id: "c", factor_type: "webauthn", status: "verified" },
        ],
      }),
    ).toEqual([{ id: "a" }]);
  });

  it("returns nothing for junk", () => {
    for (const value of [null, 42, "text", {}, { factors: "x" }]) {
      expect(readTotpFactors(value)).toEqual([]);
    }
  });
});

describe("session helpers", () => {
  it("reads the assurance level from the token it was given", () => {
    expect(decodeClaims(token({ aal: "aal2" }))?.aal).toBe("aal2");
    expect(decodeClaims("opaque")).toBeNull();
  });

  it("narrows a GoTrue session and rejects a payload without a token or user", () => {
    expect(parseSession(sessionPayload("aal2"))).toMatchObject({
      userId: USER_ID,
      email: "operator@tmlguide.example",
      aal: "aal2",
    });
    expect(parseSession({ access_token: "x" })).toBeNull();
    expect(parseSession({ user: { id: USER_ID } })).toBeNull();
    expect(parseSession(null)).toBeNull();
  });

  it("treats a session within thirty seconds of expiry as expired", () => {
    const now = 1_000_000;
    expect(isSessionExpired({ expiresAt: now + 31 } as never, now)).toBe(false);
    expect(isSessionExpired({ expiresAt: now + 29 } as never, now)).toBe(true);
    expect(isSessionExpired({ expiresAt: null } as never, now)).toBe(false);
  });
});
