/**
 * JSON responses for the community and admin routes.
 *
 * Every endpoint here answers with JSON and none of it may be cached: a like
 * count, a report acknowledgement and an admin listing are all per-request
 * results, and an intermediary that stored one would answer the next caller with
 * someone else's data. `Cache-Control: no-store` is therefore set in one place
 * rather than repeated in each route, so a new route cannot forget it.
 *
 * The body is a plain object on purpose. A route must never pass a fetched row
 * or an error object straight through: that is the one place where an internal
 * field reaches the client by accident.
 */

/** Headers every route response carries. */
const BASE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
});

/**
 * Builds a JSON response with `no-store` already applied.
 *
 * @param body - JSON-serialisable body. Keep it to fields the caller needs.
 * @param status - HTTP status code.
 * @param extraHeaders - Additional headers, for example `Allow` or `Retry-After`.
 */
export function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Readonly<Record<string, string>>,
): Response {
  return Response.json(body, {
    status,
    headers: { ...BASE_HEADERS, ...extraHeaders },
  });
}

/** The `405` answer for a route that exports one method. */
export function methodNotAllowed(allow: string): Response {
  return jsonResponse({ error: "Method not allowed" }, 405, { Allow: allow });
}

/**
 * True when the declared Content-Type is JSON, ignoring parameters such as
 * `charset`.
 *
 * A cross-site HTML form cannot set this header, so requiring it closes the
 * cheapest CSRF route before the body is read. Duplicated from the contact route
 * rather than imported from it: a security helper should not depend on a route
 * module, whose import graph pulls in the whole email path.
 */
export function isJsonContentType(value: string | null): boolean {
  if (value === null) return false;
  const mediaType = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json";
}

/**
 * Reads a request body while enforcing a byte limit.
 *
 * `Content-Length` is checked by the caller first, but a chunked request carries
 * none, so the real size is measured here. Reading stops at the limit instead of
 * buffering the whole body and rejecting it afterwards: a caller who sends a
 * hundred megabytes should not be given the memory to do it.
 *
 * The decode is fatal, so a malformed UTF-8 body is a rejection rather than a
 * string with replacement characters that then fails validation for the wrong
 * reason.
 *
 * @returns the body text, or `null` when it could not be read or exceeded `maxBytes`.
 */
export async function readLimitedBody(request: Request, maxBytes: number): Promise<string | null> {
  const body = request.body;
  if (body === null) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return null;
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(joined);
  } catch {
    return null;
  }
}
