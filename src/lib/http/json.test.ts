/**
 * Tests for the JSON response helpers and the bounded body reader.
 *
 * `readBoundedBody` is the guard that makes a body-size limit real. The failure it
 * exists to prevent is a route that calls `request.text()` and measures the
 * result: by then the whole body is in memory, so the limit is an assertion
 * rather than a control, and a chunked request with no `Content-Length` is
 * unbounded.
 */

import { describe, expect, it } from "vitest";
import {
  isJsonContentType,
  jsonResponse,
  methodNotAllowed,
  readBoundedBody,
  readLimitedBody,
} from "./json";

/** A request whose body is the given bytes, with no `Content-Length`. */
function request(body: string | Uint8Array): Request {
  // `Uint8Array` is a valid body at runtime; the DOM `BodyInit` type omits it
  // because `fetch` would read it as a typed array on some engines.
  return new Request("https://tmlguide.com/api/test", {
    method: "POST",
    body: body as BodyInit,
    ...({ duplex: "half" } as Record<string, unknown>),
  });
}

describe("jsonResponse", () => {
  it("sets no-store and nosniff on every response", async () => {
    const response = jsonResponse({ ok: true }, 200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("carries the status it is given", () => {
    expect(jsonResponse({ error: "no" }, 422).status).toBe(422);
  });

  it("lets an extra header be added without dropping the base ones", () => {
    const response = jsonResponse({}, 429, { "Retry-After": "30" });
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("builds a 405 with the allowed methods named", async () => {
    const response = methodNotAllowed("POST");
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(await response.json()).toEqual({ error: "Method not allowed" });
  });
});

describe("isJsonContentType", () => {
  it("accepts JSON with and without parameters, in any casing", () => {
    for (const value of [
      "application/json",
      "application/json; charset=utf-8",
      "Application/JSON",
      " application/json ",
    ]) {
      expect(isJsonContentType(value), value).toBe(true);
    }
  });

  it("refuses every type a cross-site form can send", () => {
    // A simple form post cannot set a JSON content type, so this is also the
    // cheapest CSRF defence available.
    for (const value of [
      null,
      "",
      "text/plain",
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
      "application/jsonx",
      "application/ld+json",
    ]) {
      expect(isJsonContentType(value), String(value)).toBe(false);
    }
  });
});

describe("readBoundedBody", () => {
  it("reads a body under the limit", async () => {
    const result = await readBoundedBody(request('{"a":1}'), 1024);
    expect(result).toEqual({ ok: true, text: '{"a":1}' });
  });

  it("returns an empty string for a request with no body", async () => {
    const result = await readBoundedBody(new Request("https://tmlguide.com/x", { method: "POST" }), 128);
    expect(result).toEqual({ ok: true, text: "" });
  });

  it("reports too-large rather than buffering a body over the limit", async () => {
    // The point of the function: the read stops at the cap, so a caller cannot
    // make the server hold an unbounded body before the limit is applied.
    const result = await readBoundedBody(request("x".repeat(2048)), 1024);
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("measures bytes, not characters", async () => {
    // A 400-character Japanese body is 1,200 bytes; a character-counting limit
    // would accept it under a 1 kB cap.
    const multibyte = "あ".repeat(400);
    expect(new TextEncoder().encode(multibyte).length).toBeGreaterThan(1024);
    expect(await readBoundedBody(request(multibyte), 1024)).toEqual({
      ok: false,
      reason: "too-large",
    });
  });

  it("accepts a multi-byte body that does fit", async () => {
    const multibyte = "あ".repeat(100);
    const result = await readBoundedBody(request(multibyte), 1024);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe(multibyte);
  });

  it("reports unreadable for bytes that are not valid UTF-8", async () => {
    // A fatal decode, so a malformed body is a rejection rather than a string of
    // replacement characters that then fails validation for the wrong reason.
    const invalid = new Uint8Array([0xff, 0xfe, 0xfd]);
    expect(await readBoundedBody(request(invalid), 1024)).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("distinguishes too-large from unreadable, which answer different statuses", async () => {
    const tooLarge = await readBoundedBody(request("x".repeat(64)), 8);
    const unreadable = await readBoundedBody(request(new Uint8Array([0xff])), 1024);
    expect(tooLarge.ok).toBe(false);
    expect(unreadable.ok).toBe(false);
    if (tooLarge.ok || unreadable.ok) return;
    expect(tooLarge.reason).not.toBe(unreadable.reason);
  });
});

describe("readLimitedBody", () => {
  it("returns the text when the body fits", async () => {
    expect(await readLimitedBody(request("hello"), 128)).toBe("hello");
  });

  it("returns null for either failure, for callers that do not need the reason", async () => {
    expect(await readLimitedBody(request("x".repeat(256)), 8)).toBeNull();
    expect(await readLimitedBody(request(new Uint8Array([0xff])), 1024)).toBeNull();
  });

  it("returns an empty string, not null, for an absent body", async () => {
    // An absent body is not a failure, and a caller checking `=== null` must not
    // treat an empty POST as unreadable.
    expect(await readLimitedBody(new Request("https://tmlguide.com/x", { method: "POST" }), 8)).toBe("");
  });
});
