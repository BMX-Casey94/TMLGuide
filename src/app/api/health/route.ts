/**
 * GET /api/health
 *
 * A liveness answer for a load balancer, an uptime monitor or a deploy check. It
 * says one thing and only one thing: this process answered the request.
 *
 * ## What it deliberately does not do
 *
 * No dependency probes. A health route that calls Supabase, Redis or OpenRouter
 * cannot answer within a sensible timeout when the network is degraded, so the
 * probe itself becomes the outage: a slow upstream turns into a failing health
 * check and the balancer removes a process that was serving pages correctly.
 * Worse, the same probes turn the endpoint into a configuration oracle — a
 * stranger learns from the status code whether Supabase and OpenRouter hold keys
 * in this deployment. That is a fact about the deployment that nobody outside it
 * needs, and it is the kind of fact that shortens the list of things to try.
 *
 * The body is therefore exactly `{ "ok": true }`: no build id, no version, no
 * region, no uptime, no environment names. A monitor needs a `200` and nothing
 * more, and anything else in the body is a small unnecessary disclosure that a
 * public endpoint cannot take back.
 *
 * ## Why `connection()` and not a constant route
 *
 * This project runs with `cacheComponents`, so a `GET` handler that touches no
 * request-time data is prerendered at build time. A health answer frozen at build
 * time would be a lie with a long life: an edge cache could keep serving `200`
 * long after the origin stopped answering, and the deploy check that is supposed
 * to notice the failure would be the last thing to find out. `connection()` stops
 * prerendering at the first line, so every answer comes from the process that is
 * running now, and `Cache-Control: no-store` is the header that reaches the
 * client rather than being replaced by a static-asset policy.
 *
 * ## Methods
 *
 * `GET` is the only verb that answers. Next implements `HEAD` from `GET` and
 * strips the body itself. Every other verb is a `405` built here rather than left
 * to Next, because Next's built-in `405` carries no `Allow` header and RFC 9110
 * requires one on that status.
 */

import { connection } from "next/server";

import { jsonResponse } from "@/lib/http/json";

/**
 * What a caller may use.
 *
 * `HEAD` is included because Next answers it from `GET` without this file
 * declaring anything. The list is what the route actually serves, so a client
 * reading a refusal is told the truth.
 */
const ALLOW = "GET, HEAD";

/** The `GET` answer. Nothing else is added to the body. */
export async function GET(): Promise<Response> {
  // Marks the route as request-time, so no build-time copy of this answer exists.
  await connection();

  // `jsonResponse` supplies `Cache-Control: no-store` and `nosniff` from one
  // place, so this route cannot forget either of them.
  return jsonResponse({ ok: true }, 200);
}

/** A refusal that names the methods which would have worked. */
function methodNotAllowed(): Response {
  return jsonResponse({ error: "Method not allowed" }, 405, { Allow: ALLOW });
}

/*
  Declared one by one. Next would answer these with a bare `405` anyway, but a
  handler that exists in the source can be tested, and this version states the
  allowed methods where Next's automatic one does not.
*/

/** Not a health check. */
export function POST(): Response {
  return methodNotAllowed();
}

/** Not a health check. */
export function PUT(): Response {
  return methodNotAllowed();
}

/** Not a health check. */
export function PATCH(): Response {
  return methodNotAllowed();
}

/** Not a health check. */
export function DELETE(): Response {
  return methodNotAllowed();
}

/**
 * A preflight refusal.
 *
 * `OPTIONS` is not a health check, so it gets the same `405` as the rest. The
 * handler is declared rather than left to Next because Next's automatic `OPTIONS`
 * would answer `204` and advertise `POST`, `PUT`, `PATCH`, `DELETE` and `OPTIONS`
 * in `Allow`, none of which this route serves.
 */
export function OPTIONS(): Response {
  return methodNotAllowed();
}
