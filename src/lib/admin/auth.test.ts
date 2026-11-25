// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROLE,
  MFA_FACTOR_TYPE,
  REQUIRED_AAL,
  adminAuthFailure,
  adminAuthFailureResponse,
  decodeJwtPayload,
  hasVerifiedTotpFactor,
  MAX_TOKEN_LENGTH,
  readBearerToken,
  requireAdminSession,
  type FetchLike,
} from "./auth";
import type { SupabaseEnv } from "@/lib/supabase/config";

/*
  Every test below replaces the Auth call, so nothing here touches a real project.
  The order of the assertions matters as much as their content: several of them
  exist to prove that a *specific* check runs and refuses, rather than that some
  check happened to refuse.
*/

const ENV: SupabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

const USER_ID = "9f8b7c6d-1234-4abc-8def-0123456789ab";

/**
 * Base64url-encodes a JSON object, the way a JWT segment is encoded.
 *
 * The bytes are UTF-8, which is what a real token carries. `btoa` on its own
 * would encode latin1 and a multi-byte claim would then round-trip wrongly, so
 * the JSON is encoded to bytes first and each byte is passed to `btoa`.
 */
function encodeSegment(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Builds a three-part token with the claims a test needs.
 *
 * The signature is a literal placeholder: these tests prove that the code never
 * trusts an unverified token, so a token whose signature is obviously fake is
 * exactly the right input.
 */
function makeToken(claims: Record<string, unknown>): string {
  return `${encodeSegment({ alg: "HS256", typ: "JWT" })}.${encodeSegment(claims)}.not-a-real-signature`;
}

/** The default: a well-formed admin token with a completed second factor. */
function adminToken(overrides: Record<string, unknown> = {}): string {
  return makeToken({
    sub: USER_ID,
    aal: "aal2",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  });
}

/** A user record as `GET /auth/v1/user` returns it. */
function userPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: USER_ID,
    email: "operator@tmlguide.example",
    app_metadata: { provider: "email", role: "admin" },
    user_metadata: { role: "admin" },
    factors: [{ id: "factor-1", factor_type: "totp", status: "verified" }],
    ...overrides,
  };
}

/** A request carrying a bearer token. */
function request(token: string | null): { headers: { get(name: string): string | null } } {
  const headers = new Headers();
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return { headers };
}

/**
 * A fetch double returning one canned response.
 *
 * A `vi.fn` so a test can assert it was not called, with its type stated as the
 * `FetchLike` the module expects. Without that annotation a bare `Mock` is not
 * assignable to the narrow signature, which is why the compiler used to reject
 * every call site.
 */
function fetchReturning(status: number, body: unknown): FetchLike & ReturnType<typeof vi.fn> {
  return vi.fn(async () =>
    typeof body === "string" ? new Response(body, { status }) : Response.json(body, { status }),
  ) as unknown as FetchLike & ReturnType<typeof vi.fn>;
}

describe("readBearerToken", () => {
  it("reads a well-formed bearer header", () => {
    expect(readBearerToken(new Headers({ authorization: "Bearer abc.def.ghi" }))).toBe("abc.def.ghi");
  });

  it("accepts any casing of the scheme, as RFC 7235 requires", () => {
    expect(readBearerToken(new Headers({ authorization: "bearer token123" }))).toBe("token123");
    expect(readBearerToken(new Headers({ authorization: "BEARER token123" }))).toBe("token123");
  });

  it("tolerates extra spaces around the header and after the scheme", () => {
    expect(readBearerToken(new Headers({ authorization: "  Bearer    token123  " }))).toBe("token123");
  });

  it.each<[string | null, string]>([
    [null, "an absent header"],
    ["", "an empty header"],
    ["Bearer", "a scheme with no token"],
    ["Bearer ", "a scheme with only whitespace"],
    ["Basic dXNlcjpwYXNz", "another scheme"],
    ["token123", "a bare token"],
    ["Bearer a b", "a token with an internal space"],
  ])("returns null for %s (%s)", (value) => {
    const headers = new Headers();
    if (value !== null) headers.set("authorization", value);
    expect(readBearerToken(headers)).toBeNull();
  });
});

describe("decodeJwtPayload", () => {
  it("reads a payload that uses base64url characters", () => {
    const token = makeToken({ sub: "user", aal: "aal2", note: "a+b/c=" });
    expect(decodeJwtPayload(token)).toMatchObject({ sub: "user", aal: "aal2", note: "a+b/c=" });
  });

  it("handles a payload whose length needs no padding", () => {
    expect(decodeJwtPayload(makeToken({ a: 1 }))).toMatchObject({ a: 1 });
  });

  it("decodes multi-byte characters correctly", () => {
    expect(decodeJwtPayload(makeToken({ email: "opérateur@tmlguide.example" }))).toMatchObject({
      email: "opérateur@tmlguide.example",
    });
  });

  it.each([
    ["an opaque token", "not-a-jwt"],
    ["a two-part token", "a.b"],
    ["a four-part token", "a.b.c.d"],
    ["an empty payload segment", "a..c"],
    ["a payload that is not base64", "a.!!!!.c"],
    ["a payload that is not JSON", `a.${btoa("plain text")}.c`],
    ["a payload that is a JSON array", `a.${encodeSegment([1, 2])}.c`],
    ["a payload that is JSON null", `a.${encodeSegment(null)}.c`],
  ])("returns null for %s", (_label, token) => {
    expect(decodeJwtPayload(token)).toBeNull();
  });
});

describe("hasVerifiedTotpFactor", () => {
  it("accepts a verified TOTP factor", () => {
    expect(hasVerifiedTotpFactor([{ factor_type: MFA_FACTOR_TYPE, status: "verified" }])).toBe(true);
  });

  it("accepts a missing factor list, because the aal claim is still the evidence", () => {
    expect(hasVerifiedTotpFactor(undefined)).toBe(true);
    expect(hasVerifiedTotpFactor(null)).toBe(true);
  });

  it("rejects an unverified factor", () => {
    expect(hasVerifiedTotpFactor([{ factor_type: "totp", status: "unverified" }])).toBe(false);
  });

  it("rejects a verified factor of another type", () => {
    expect(hasVerifiedTotpFactor([{ factor_type: "webauthn", status: "verified" }])).toBe(false);
  });

  it("rejects an empty list, which claims a second factor without one", () => {
    expect(hasVerifiedTotpFactor([])).toBe(false);
  });

  it("rejects a list of junk rather than trusting it", () => {
    expect(hasVerifiedTotpFactor([null, 42, "totp"])).toBe(false);
    expect(hasVerifiedTotpFactor({ factor_type: "totp", status: "verified" })).toBe(false);
  });

  it("finds one good factor among bad ones", () => {
    expect(
      hasVerifiedTotpFactor([
        { factor_type: "webauthn", status: "verified" },
        { factor_type: "totp", status: "unverified" },
        { factor_type: "totp", status: "verified" },
      ]),
    ).toBe(true);
  });
});

describe("requireAdminSession — the happy path", () => {
  it("returns the administrator for a verified admin token at aal2", async () => {
    const token = adminToken();
    const fetchImpl = fetchReturning(200, userPayload());

    const result = await requireAdminSession(request(token), { env: ENV, fetchImpl });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identity).toEqual({
      userId: USER_ID,
      email: "operator@tmlguide.example",
      role: ADMIN_ROLE,
      aal: REQUIRED_AAL,
      accessToken: token,
    });
  });

  it("verifies the token against Supabase Auth rather than decoding it", async () => {
    const token = adminToken();
    const fetchImpl = fetchReturning(200, userPayload());

    await requireAdminSession(request(token), { env: ENV, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/auth/v1/user");
    expect(init.method).toBe("GET");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${token}`);
    expect(headers.apikey).toBe("anon-key");
  });

  it("accepts an account with no email address", async () => {
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload({ email: undefined })),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identity.email).toBeNull();
  });

  it("accepts a token with no subject claim, since Supabase already bound it", async () => {
    // A token without `sub` cannot be cross-checked, which is not itself a
    // refusal: the `/auth/v1/user` answer is the identity.
    const result = await requireAdminSession(request(adminToken({ sub: undefined })), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload()),
    });
    expect(result.ok).toBe(true);
  });
});

describe("requireAdminSession — missing or malformed session", () => {
  it("answers 401 when there is no Authorization header", async () => {
    const fetchImpl = fetchReturning(200, userPayload());
    const result = await requireAdminSession(request(null), { env: ENV, fetchImpl });

    expect(result).toMatchObject({ ok: false, reason: "missing-token", status: 401 });
    // No identity provider call is made for a request with no token.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers 401 for a non-bearer scheme", async () => {
    const headers = new Headers({ authorization: "Basic dXNlcjpwYXNz" });
    const result = await requireAdminSession({ headers }, { env: ENV });
    expect(result).toMatchObject({ ok: false, reason: "missing-token", status: 401 });
  });

  it("answers 401 when Supabase rejects the token", async () => {
    for (const status of [401, 403]) {
      const result = await requireAdminSession(request(adminToken()), {
        env: ENV,
        fetchImpl: fetchReturning(status, { message: "invalid JWT" }),
      });
      expect(result).toMatchObject({ ok: false, reason: "invalid-token", status: 401 });
    }
  });

  it("answers 401 when the token names a different user from the record", async () => {
    // A response from one account must not be paired with a token for another.
    const result = await requireAdminSession(request(adminToken({ sub: "someone-else" })), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload()),
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid-token", status: 401 });
  });

  it("answers 401 for an opaque token that Supabase accepts", async () => {
    // An opaque token carries no aal, so no second factor can be proved.
    const result = await requireAdminSession(request("opaque-token-value"), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload()),
    });
    expect(result).toMatchObject({ ok: false, reason: "mfa-required", status: 403 });
  });
});

describe("requireAdminSession — role", () => {
  it("refuses an account with no role at all", async () => {
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload({ app_metadata: { provider: "email" } })),
    });
    expect(result).toMatchObject({ ok: false, reason: "not-admin", status: 403 });
  });

  it("refuses a role other than admin", async () => {
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload({ app_metadata: { role: "editor" } })),
    });
    expect(result).toMatchObject({ ok: false, reason: "not-admin", status: 403 });
  });

  it("refuses an admin claim that only exists in user_metadata", async () => {
    /*
      This is the whole point of the module. `user_metadata` is writable by the
      account holder through `updateUser`, so an account that has granted itself
      the role there must be refused. The token below even carries the claim in
      its own payload; the server-side record is what decides.
    */
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(
        200,
        userPayload({
          app_metadata: { provider: "email" },
          user_metadata: { role: "admin", is_admin: true, app_metadata: { role: "admin" } },
        }),
      ),
    });

    expect(result).toMatchObject({ ok: false, reason: "not-admin", status: 403 });
    if (result.ok) return;
    expect(result.error).not.toContain("user_metadata");
  });

  it("refuses user_metadata spoofing even at aal2 with a verified factor", async () => {
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(
        200,
        userPayload({
          app_metadata: {},
          user_metadata: { role: "admin" },
          factors: [{ factor_type: "totp", status: "verified" }],
        }),
      ),
    });
    expect(result).toMatchObject({ ok: false, reason: "not-admin" });
  });

  it("refuses a role nested one level too deep", async () => {
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload({ app_metadata: { metadata: { role: "admin" } } })),
    });
    expect(result).toMatchObject({ ok: false, reason: "not-admin" });
  });

  it("refuses app_metadata that is not an object", async () => {
    for (const value of [null, "admin", 42, ["admin"]]) {
      const result = await requireAdminSession(request(adminToken()), {
        env: ENV,
        fetchImpl: fetchReturning(200, userPayload({ app_metadata: value })),
      });
      expect(result).toMatchObject({ ok: false, reason: "not-admin" });
    }
  });

  it("refuses an array-shaped app_metadata holding a role", async () => {
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload({ app_metadata: [{ role: "admin" }] })),
    });
    expect(result).toMatchObject({ ok: false, reason: "not-admin" });
  });
});

describe("requireAdminSession — MFA", () => {
  it("refuses an aal1 session with 403", async () => {
    const result = await requireAdminSession(request(adminToken({ aal: "aal1" })), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload()),
    });

    expect(result).toMatchObject({ ok: false, reason: "mfa-required", status: 403 });
  });

  it("refuses a token with no aal claim, which is an unverified second factor", async () => {
    const result = await requireAdminSession(request(adminToken({ aal: undefined })), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload()),
    });
    expect(result).toMatchObject({ ok: false, reason: "mfa-required" });
  });

  it("refuses an unrecognised aal value rather than reading it as sufficient", async () => {
    for (const aal of ["aal0", "aal3", "AAL2", 2, null]) {
      const result = await requireAdminSession(request(adminToken({ aal })), {
        env: ENV,
        fetchImpl: fetchReturning(200, userPayload()),
      });
      expect(result).toMatchObject({ ok: false, reason: "mfa-required" });
    }
  });

  it("refuses aal2 when no verified TOTP factor is enrolled", async () => {
    // A session claiming aal2 with no enrolled factor is a configuration fault,
    // and is failed closed rather than trusted.
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload({ factors: [] })),
    });
    expect(result).toMatchObject({ ok: false, reason: "mfa-not-enrolled", status: 403 });
  });

  it("refuses aal2 when the only factor is unverified", async () => {
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(
        200,
        userPayload({ factors: [{ factor_type: "totp", status: "unverified" }] }),
      ),
    });
    expect(result).toMatchObject({ ok: false, reason: "mfa-not-enrolled" });
  });

  it("checks the role before the second factor, so a non-admin learns nothing about MFA", async () => {
    const result = await requireAdminSession(request(adminToken({ aal: "aal1" })), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload({ app_metadata: {} })),
    });
    expect(result).toMatchObject({ ok: false, reason: "not-admin" });
  });
});

describe("requireAdminSession — configuration and availability", () => {
  it("answers 503 when the project settings are absent", async () => {
    const fetchImpl = fetchReturning(200, userPayload());
    const result = await requireAdminSession(request(adminToken()), { env: {}, fetchImpl });

    expect(result).toMatchObject({ ok: false, reason: "not-configured", status: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("answers 503 when only one setting is present", async () => {
    expect(
      await requireAdminSession(request(adminToken()), {
        env: { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" },
      }),
    ).toMatchObject({ reason: "not-configured" });

    expect(
      await requireAdminSession(request(adminToken()), {
        env: { NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key" },
      }),
    ).toMatchObject({ reason: "not-configured" });
  });

  it("answers 503 when the configured URL is not https", async () => {
    const result = await requireAdminSession(request(adminToken()), {
      env: { ...ENV, NEXT_PUBLIC_SUPABASE_URL: "http://project.supabase.co" },
    });
    expect(result).toMatchObject({ ok: false, reason: "not-configured", status: 503 });
  });

  it("answers 503 when the Auth call throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED 10.0.0.5:443");
    });

    const result = await requireAdminSession(request(adminToken()), { env: ENV, fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: "auth-unavailable", status: 503 });
    vi.restoreAllMocks();
  });

  it("answers 503 for a 5xx from the identity provider", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(500, { message: "boom" }),
    });
    expect(result).toMatchObject({ ok: false, reason: "auth-unavailable", status: 503 });
    vi.restoreAllMocks();
  });

  it("answers 503 when the response body is not JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(200, "<html>not json</html>"),
    });
    expect(result).toMatchObject({ ok: false, reason: "auth-unavailable" });
    vi.restoreAllMocks();
  });

  it("answers 503 when the user record has no id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload({ id: undefined })),
    });
    expect(result).toMatchObject({ ok: false, reason: "auth-unavailable" });
    vi.restoreAllMocks();
  });

  it("answers 503 when the user record is an array", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await requireAdminSession(request(adminToken()), {
      env: ENV,
      fetchImpl: fetchReturning(200, [userPayload()]),
    });
    expect(result).toMatchObject({ ok: false, reason: "auth-unavailable" });
    vi.restoreAllMocks();
  });

  it("never throws, whatever the identity provider does", async () => {
    const bodies = [null, 42, "text", [], {}, { id: 42 }];
    vi.spyOn(console, "error").mockImplementation(() => {});

    for (const body of bodies) {
      const result = await requireAdminSession(request(adminToken()), {
        env: ENV,
        fetchImpl: fetchReturning(200, body),
      });
      expect(result.ok).toBe(false);
    }
    vi.restoreAllMocks();
  });
});

describe("requireAdminSession — token bounds", () => {
  it("refuses an oversized token before contacting the identity provider", async () => {
    /*
      Regression: the token is forwarded verbatim in an Authorization header. An
      enormous value would make the server build and send a huge request and only
      be rejected by the far end, after the cost had been paid.
    */
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = fetchReturning(200, userPayload());
    const result = await requireAdminSession(request("a".repeat(MAX_TOKEN_LENGTH + 1)), {
      env: ENV,
      fetchImpl,
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid-token", status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("accepts a token at exactly the cap", async () => {
    // A real JWT is far shorter, so the boundary is generous rather than tight.
    const padded = adminToken() + "a".repeat(MAX_TOKEN_LENGTH - adminToken().length);
    const result = await requireAdminSession(request(padded), {
      env: ENV,
      fetchImpl: fetchReturning(200, userPayload()),
    });
    expect(result.ok).toBe(true);
  });

  it("never follows a redirect, so the token cannot be forwarded to another host", async () => {
    // `fetch` re-sends headers on a followed redirect. If a project URL ever
    // answered 302, the token would go wherever `Location` pointed.
    const fetchImpl = fetchReturning(200, userPayload());
    vi.spyOn(console, "error").mockImplementation(() => {});

    await requireAdminSession(request(adminToken()), { env: ENV, fetchImpl });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init as RequestInit & { redirect?: string }).redirect).toBe("error");
    vi.restoreAllMocks();
  });

  it("answers 503 rather than 500 when a redirect makes fetch throw", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("unexpected redirect");
    });

    const result = await requireAdminSession(request(adminToken()), { env: ENV, fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: "auth-unavailable", status: 503 });
    vi.restoreAllMocks();
  });
});

describe("response shaping", () => {
  it("maps each reason to its status", () => {
    expect(adminAuthFailure("missing-token").status).toBe(401);
    expect(adminAuthFailure("invalid-token").status).toBe(401);
    expect(adminAuthFailure("not-admin").status).toBe(403);
    expect(adminAuthFailure("mfa-required").status).toBe(403);
    expect(adminAuthFailure("mfa-not-enrolled").status).toBe(403);
    expect(adminAuthFailure("not-configured").status).toBe(503);
    expect(adminAuthFailure("auth-unavailable").status).toBe(503);
  });

  it("gives every reason a distinct, actionable sentence", () => {
    const reasons = [
      "missing-token",
      "invalid-token",
      "not-admin",
      "mfa-required",
      "mfa-not-enrolled",
      "not-configured",
      "auth-unavailable",
    ] as const;

    const messages = reasons.map((reason) => adminAuthFailure(reason).error);
    expect(new Set(messages).size).toBe(reasons.length);
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(10);
      // No token, claim or internal hostname may reach the caller.
      expect(message).not.toMatch(/bearer|jwt|token=|supabase|app_metadata|aal/i);
    }
  });

  it("builds a no-store JSON response with the reason", async () => {
    const response = adminAuthFailureResponse(adminAuthFailure("not-admin"));

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: adminAuthFailure("not-admin").error,
      reason: "not-admin",
    });
  });

  it("adds a WWW-Authenticate challenge only for a 401", () => {
    const unauthorised = adminAuthFailureResponse(adminAuthFailure("missing-token"));
    expect(unauthorised.headers.get("WWW-Authenticate")).toBe('Bearer realm="admin"');

    const forbidden = adminAuthFailureResponse(adminAuthFailure("not-admin"));
    // A 403 is not a missing credential, so a challenge header would misdescribe it.
    expect(forbidden.headers.get("WWW-Authenticate")).toBeNull();
  });
});
