/**
 * Community link-health checking.
 *
 * Community invite links rot faster than anything else on the site: a WhatsApp
 * group fills up, an admin revokes the invite, a Drive file is deleted. This
 * module answers one question about one URL — is it still usable? — and answers
 * it in a way that is safe to point at arbitrary third-party hosts.
 *
 * ## Why this is not a plain `fetch`
 *
 * The URLs come from data files, but a checker that follows whatever a remote
 * server tells it to is an SSRF proxy waiting to happen. The rules here are
 * therefore deliberately strict:
 *
 * 1. **HTTPS only.** The data schema already refuses anything else; refusing it
 *    again means a hand-run check cannot be pointed at `file:` or `http:`.
 * 2. **No credentials in the URL**, and no port other than 443.
 * 3. **The hostname is resolved before it is contacted**, and every returned
 *    address must be public. `169.254.169.254` — the cloud metadata service — is
 *    reached by *resolving a name*, so checking the literal in the URL is not
 *    enough.
 * 4. **Redirects are followed by hand**, one hop at a time, so every hop passes
 *    the same checks. `redirect: "follow"` would let a public page bounce the
 *    checker into the private network after the first check had passed.
 * 5. **Strict timeouts and a hop limit**, so one dead host cannot stall a run.
 *
 * There is a residual window between the DNS check and the connection: a hostile
 * resolver could answer public and then resolve private. Closing it completely
 * requires pinning the connection to the verified address, which needs a custom
 * agent rather than `fetch`. The window is documented rather than hidden, and
 * this checker is a maintenance tool run by the operator, not a user-facing
 * service, so it is the right trade.
 *
 * ## Statuses
 *
 * | Status | Means |
 * | --- | --- |
 * | `ok` | Answered 2xx, no redirect, and any content check passed |
 * | `redirect` | Usable, but only after one or more redirects — the stored URL should be updated |
 * | `broken` | Gone, refused, unreachable, or serving a page that says the link is dead |
 * | `timeout` | No answer within the budget; retried once before it is reported |
 * | `blocked` | The target refused automated clients, or the URL itself was refused before contact |
 *
 * `blocked` is not a failure of the link. A 403 from a bot filter says nothing
 * about whether a person can open it, so it is reported separately and a run does
 * not fail on it alone.
 */

import { isPrivateHost } from "../../../scripts/lib/link-check.mjs";

/** Every classification this module can produce. */
export const LINK_STATUSES = ["ok", "redirect", "broken", "timeout", "blocked"] as const;

export type LinkStatus = (typeof LINK_STATUSES)[number];

/** Statuses that mean a reader would fail to reach the link. */
export const FAILING_STATUSES: readonly LinkStatus[] = ["broken", "timeout"];

/** Statuses that need attention but may not be the link's own fault. */
export const ATTENTION_STATUSES: readonly LinkStatus[] = ["blocked"];

/** Sent on every request so an operator can identify the traffic. */
export const COMMUNITY_CHECKER_USER_AGENT =
  "TMLGuideCommunityLinkCheck/1.0 (+independent fan guide; contact via site)";

/** Per-request budget. Eight seconds is long enough for a slow host, short enough to fail fast. */
export const DEFAULT_TIMEOUT_MS = 8_000;

/** Hops followed before the chain is called broken. Five covers a shortener and a locale redirect. */
export const DEFAULT_MAX_REDIRECTS = 5;

/** Nothing on a page matters beyond this; the checks read the head and the invite sentence. */
export const MAX_BODY_BYTES = 128 * 1024;

/** Ports a checked URL may use. An explicit 443 is the same as none. */
const ALLOWED_PORTS: ReadonlySet<string> = new Set(["", "443"]);

/**
 * A transport-level failure, as the checker sees it.
 *
 * Kept separate from the HTTP status because the two are answered differently: a
 * DNS failure means the link is dead, whereas a 500 means the server is having a
 * bad day.
 */
export type LinkFailure = "invalid-url" | "blocked-target" | "dns" | "refused" | "tls" | "network" | "timeout";

/** One probe's raw outcome, before it is turned into a status. */
export interface LinkProbeOutcome {
  /** Final HTTP status, or null when no response arrived. */
  readonly httpStatus?: number | null;
  /** Transport failure, when one happened. */
  readonly failure?: LinkFailure | null;
  /** Hops followed. */
  readonly redirects?: number;
  /** URL that was asked for. */
  readonly requestedUrl?: string | null;
  /** URL that answered, after any redirects. */
  readonly finalUrl?: string | null;
  /** Verdict from a content check on a 2xx body, when one ran. */
  readonly content?: { readonly ok: boolean; readonly detail: string } | null;
}

/** A classification plus the sentence an operator reads. */
export interface LinkVerdict {
  readonly status: LinkStatus;
  readonly detail: string;
}

function sameOrigin(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return true;
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return true;
  }
}

/**
 * Turns one probe outcome into a status and a sentence.
 *
 * Pure, and the single place the precedence is decided. Transport failures come
 * first because there was no answer to classify; a refused URL comes before every
 * network state because nothing was contacted; the content check comes last
 * because it can only ever downgrade an otherwise-good response.
 */
export function classifyLinkStatus(outcome: LinkProbeOutcome = {}): LinkVerdict {
  const { failure = null, httpStatus = null } = outcome;
  const redirects = Math.max(0, Math.trunc(Number(outcome.redirects ?? 0)));

  switch (failure) {
    case "invalid-url":
      return { status: "blocked", detail: "Not a valid absolute https URL, so it was not checked" };
    case "blocked-target":
      return {
        status: "blocked",
        detail: "Refused before contact: the address is private, reserved or not permitted",
      };
    case "dns":
      return { status: "broken", detail: "The hostname does not resolve" };
    case "refused":
      return { status: "broken", detail: "The server refused the connection" };
    case "tls":
      return { status: "broken", detail: "The TLS certificate could not be validated" };
    case "timeout":
      return { status: "timeout", detail: "No answer within the time budget" };
    case "network":
      return { status: "broken", detail: "The request failed before an answer arrived" };
    case null:
    case undefined:
      break;
  }

  if (typeof httpStatus !== "number" || !Number.isFinite(httpStatus)) {
    return { status: "broken", detail: "No response was received" };
  }

  if (httpStatus >= 200 && httpStatus < 300) {
    if (outcome.content && !outcome.content.ok) {
      return { status: "broken", detail: outcome.content.detail };
    }
    if (redirects > 0) {
      const movedOrigin = !sameOrigin(outcome.requestedUrl ?? null, outcome.finalUrl ?? null);
      const hops = redirects === 1 ? "one redirect" : `${redirects} redirects`;
      return {
        status: "redirect",
        detail: movedOrigin
          ? `Reachable after ${hops}, but the final address is on a different site — check it is still the intended page`
          : `Reachable after ${hops}; update the stored URL to the final address`,
      };
    }
    return { status: "ok", detail: outcome.content?.detail ?? `${httpStatus} — OK` };
  }

  if (httpStatus >= 300 && httpStatus < 400) {
    return {
      status: "broken",
      detail: `${httpStatus} — redirect chain did not end at a page (loop, missing location, or too many hops)`,
    };
  }

  if (httpStatus === 401) return { status: "blocked", detail: "401 — the page now requires a sign-in" };
  if (httpStatus === 403) {
    return { status: "blocked", detail: "403 — access refused to automated clients; open it yourself" };
  }
  if (httpStatus === 429) return { status: "blocked", detail: "429 — rate limited; retry the run later" };
  if (httpStatus === 451) return { status: "blocked", detail: "451 — unavailable for legal reasons" };

  if (httpStatus === 404) return { status: "broken", detail: "404 — the page no longer exists" };
  if (httpStatus === 410) return { status: "broken", detail: "410 — the page was deliberately removed" };

  if (httpStatus >= 500) return { status: "broken", detail: `${httpStatus} — server error at the far end` };
  if (httpStatus >= 400) return { status: "broken", detail: `${httpStatus} — the request was rejected` };
  if (httpStatus < 200) return { status: "broken", detail: `${httpStatus} — interim response, no final page` };

  return { status: "broken", detail: `Unrecognised HTTP status ${httpStatus}` };
}

/** Result for one URL. */
export interface LinkHealthResult {
  /** The URL exactly as it was supplied, so a report points back at the data row. */
  readonly url: string;
  readonly status: LinkStatus;
  /** Final HTTP status, or null when no response arrived. */
  readonly httpStatus: number | null;
  /** URL that answered, after any redirects. */
  readonly finalUrl: string | null;
  readonly redirects: number;
  readonly elapsedMs: number;
  /** An honest sentence: what happened, in words an operator can act on. */
  readonly detail: string;
  /** ISO instant the check finished. */
  readonly checkedAt: string;
}

/** A URL refused by the policy checks, before any network call. */
function refusedResult(url: string, verdict: LinkVerdict, now: number): LinkHealthResult {
  return {
    url,
    status: verdict.status,
    httpStatus: null,
    finalUrl: null,
    redirects: 0,
    elapsedMs: 0,
    detail: verdict.detail,
    checkedAt: new Date(now).toISOString(),
  };
}

export interface ParsedTarget {
  readonly url: URL;
  readonly reason: null;
}

export interface RefusedTarget {
  readonly url: null;
  readonly reason: string;
}

/**
 * Applies the URL policy.
 *
 * Returns the parsed URL or the reason it was refused. Pure, so the policy is
 * testable without a network, and used for the first URL and for every redirect
 * target alike.
 */
export function parseTarget(rawUrl: unknown): ParsedTarget | RefusedTarget {
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    return { url: null, reason: "the URL is missing" };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { url: null, reason: "the URL is not absolute" };
  }

  if (parsed.protocol !== "https:") {
    return { url: null, reason: `the scheme is ${parsed.protocol}, not https:` };
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return { url: null, reason: "the URL embeds credentials" };
  }
  if (parsed.hostname === "") {
    return { url: null, reason: "the URL has no host" };
  }
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return { url: null, reason: `port ${parsed.port} is not allowed` };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { url: null, reason: `"${parsed.hostname}" is a private or reserved address` };
  }

  return { url: parsed, reason: null };
}

/** Maps a caught fetch error to one of the transport failures. */
function failureFromError(error: unknown): LinkFailure {
  if (typeof error === "object" && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (name === "TimeoutError" || name === "AbortError") return "timeout";

    const code = (error as { code?: unknown }).code;
    const text = typeof code === "string" ? code : "";
    if (/ENOTFOUND|EAI_AGAIN|EAI_FAIL|EAI_NONAME|EAI_NODATA/.test(text)) return "dns";
    if (/ECONNREFUSED/.test(text)) return "refused";
    if (/CERT|TLS|SSL|ERR_TLS/.test(text)) return "tls";

    // Undici reports the DNS/TLS failure through `cause`, so the code is often
    // one level down rather than on the error itself.
    const cause = (error as { cause?: unknown }).cause;
    if (cause !== undefined && cause !== error) return failureFromError(cause);
  }
  return "network";
}

/** Resolves a hostname to every address it currently answers with. */
export type HostResolver = (hostname: string) => Promise<readonly string[]>;

/**
 * The default resolver, using the operating system's own lookup.
 *
 * Imported lazily so this module can be loaded in a context that has no `node:`
 * modules (a test double, or a bundler that only reads its exports) without
 * failing at import time.
 */
export async function defaultResolveHost(hostname: string): Promise<readonly string[]> {
  const dns = await import("node:dns/promises");
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export interface CheckLinkOptions {
  /** Per-request budget in milliseconds. */
  readonly timeoutMs?: number;
  /** Redirects followed before the chain is called broken. */
  readonly maxRedirects?: number;
  /** Retries of a timeout or network failure. One by default, so a blip is not a false alarm. */
  readonly retries?: number;
  /** Clock injection, for repeatable timestamps. */
  readonly now?: () => number;
  /** Fetch injection, so tests need no socket. */
  readonly fetchImpl?: typeof fetch;
  /**
   * Resolver used for the SSRF check on every hop.
   *
   * Defaults to `defaultResolveHost`. Pass a stub in tests; pass `null` only when
   * the caller has already proved the host is safe by other means, which is why
   * it is explicit rather than a silent fallback.
   */
  readonly resolveHost?: HostResolver | null;
  /**
   * Ran against a 2xx response body, for hosts whose pages say whether the link
   * still works. WhatsApp is the case that matters: a revoked invite answers 200
   * with a page that has no group name, so the status alone would call it fine.
   */
  readonly inspectBody?: (body: string, url: URL) => { readonly ok: boolean; readonly detail: string } | null;
}

/** Reads at most `maxBytes` of a response body. */
async function readBodyUpTo(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (body === null) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;
      const remaining = maxBytes - total;
      if (value.byteLength >= remaining) {
        chunks.push(value.subarray(0, remaining));
        total = maxBytes;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch {
    await reader.cancel().catch(() => undefined);
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(joined);
}

/** Discards a response body so the connection can be reused or closed cleanly. */
async function discardBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

interface HopOutcome {
  readonly response: Response | null;
  readonly failure: LinkFailure | null;
}

/** Performs one request. Redirects are never followed here. */
async function requestOnce(
  url: URL,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  retries: number,
): Promise<HopOutcome> {
  let lastFailure: LinkFailure = "network";

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-GB,en;q=0.9",
          "user-agent": COMMUNITY_CHECKER_USER_AGENT,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { response, failure: null };
    } catch (error) {
      lastFailure = failureFromError(error);
      // Only a blip is worth retrying. A refused connection or a bad certificate
      // will answer the same way immediately.
      if (lastFailure !== "timeout" && lastFailure !== "network") break;
    }
  }

  return { response: null, failure: lastFailure };
}

/**
 * Checks one URL.
 *
 * Never throws for a bad link: every failure becomes a classified result, because
 * a checker that dies on the first dead host is useless for a list of forty.
 * The only way this rejects is a bug in the caller's own options.
 */
export async function checkLinkHealth(
  rawUrl: string,
  options: CheckLinkOptions = {},
): Promise<LinkHealthResult> {
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const maxRedirects = Math.max(0, options.maxRedirects ?? DEFAULT_MAX_REDIRECTS);
  const retries = Math.max(0, options.retries ?? 1);
  const now = options.now ?? (() => Date.now());
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const resolveHost = options.resolveHost === undefined ? defaultResolveHost : options.resolveHost;

  const startedAt = now();
  const first = parseTarget(rawUrl);
  if (first.url === null) {
    // The reason is worth keeping: "the scheme is http:" tells an operator
    // exactly what to fix, whereas "it was not checked" does not.
    return {
      ...refusedResult(rawUrl, classifyLinkStatus({ failure: "invalid-url" }), now()),
      detail: `Not checked: ${first.reason}`,
    };
  }

  let current = first.url;
  let redirects = 0;

  for (;;) {
    // Every hop is checked, including the first. The same function that validated
    // the input validates each `location`, so a redirect cannot widen the policy.
    const allowed = parseTarget(current.href);
    if (allowed.url === null) {
      const verdict = classifyLinkStatus({
        failure: redirects === 0 ? "invalid-url" : "blocked-target",
        redirects,
      });
      return {
        url: rawUrl,
        status: verdict.status,
        httpStatus: null,
        finalUrl: current.href,
        redirects,
        elapsedMs: Math.max(0, now() - startedAt),
        detail:
          redirects === 0
            ? verdict.detail
            : `Redirected to a target that was refused: ${allowed.reason}`,
        checkedAt: new Date(now()).toISOString(),
      };
    }

    if (resolveHost !== null) {
      let addresses: readonly string[];
      try {
        addresses = await resolveHost(allowed.url.hostname);
      } catch {
        return {
          url: rawUrl,
          status: "broken",
          httpStatus: null,
          finalUrl: current.href,
          redirects,
          elapsedMs: Math.max(0, now() - startedAt),
          detail: `The hostname "${allowed.url.hostname}" does not resolve`,
          checkedAt: new Date(now()).toISOString(),
        };
      }

      if (addresses.length === 0) {
        return {
          url: rawUrl,
          status: "broken",
          httpStatus: null,
          finalUrl: current.href,
          redirects,
          elapsedMs: Math.max(0, now() - startedAt),
          detail: `The hostname "${allowed.url.hostname}" resolves to no address`,
          checkedAt: new Date(now()).toISOString(),
        };
      }

      const privateAddress = addresses.find((address) => isPrivateHost(address));
      if (privateAddress !== undefined) {
        const verdict = classifyLinkStatus({ failure: "blocked-target", redirects });
        return {
          url: rawUrl,
          status: verdict.status,
          httpStatus: null,
          finalUrl: current.href,
          redirects,
          elapsedMs: Math.max(0, now() - startedAt),
          detail: `Refused: "${allowed.url.hostname}" resolves to ${privateAddress}, which is a private or reserved address`,
          checkedAt: new Date(now()).toISOString(),
        };
      }
    }

    const hop = await requestOnce(allowed.url, fetchImpl, timeoutMs, retries);
    if (hop.response === null) {
      const verdict = classifyLinkStatus({ failure: hop.failure, redirects });
      return {
        url: rawUrl,
        status: verdict.status,
        httpStatus: null,
        finalUrl: current.href,
        redirects,
        elapsedMs: Math.max(0, now() - startedAt),
        detail: verdict.detail,
        checkedAt: new Date(now()).toISOString(),
      };
    }

    const status = hop.response.status;
    const location = hop.response.headers.get("location");

    if (status >= 300 && status < 400 && location !== null) {
      await discardBody(hop.response);

      if (redirects >= maxRedirects) {
        return {
          url: rawUrl,
          status: "broken",
          httpStatus: status,
          finalUrl: current.href,
          redirects,
          elapsedMs: Math.max(0, now() - startedAt),
          detail: `Stopped after ${redirects} redirects without reaching a page`,
          checkedAt: new Date(now()).toISOString(),
        };
      }

      let next: URL;
      try {
        next = new URL(location, allowed.url);
      } catch {
        return {
          url: rawUrl,
          status: "broken",
          httpStatus: status,
          finalUrl: current.href,
          redirects,
          elapsedMs: Math.max(0, now() - startedAt),
          detail: `${status} — the redirect target is not a usable URL`,
          checkedAt: new Date(now()).toISOString(),
        };
      }

      redirects += 1;
      current = next;
      continue;
    }

    let content: { ok: boolean; detail: string } | null = null;
    if (status >= 200 && status < 300 && options.inspectBody !== undefined) {
      const body = await readBodyUpTo(hop.response, MAX_BODY_BYTES);
      content = options.inspectBody(body, allowed.url);
    } else {
      await discardBody(hop.response);
    }

    const verdict = classifyLinkStatus({
      httpStatus: status,
      redirects,
      requestedUrl: rawUrl,
      finalUrl: allowed.url.href,
      content,
    });

    return {
      url: rawUrl,
      status: verdict.status,
      httpStatus: status,
      finalUrl: allowed.url.href,
      redirects,
      elapsedMs: Math.max(0, now() - startedAt),
      detail: verdict.detail,
      checkedAt: new Date(now()).toISOString(),
    };
  }
}

/** Counts by status. Every key is present, so a reader never has to guess at a missing zero. */
export type HealthCounts = Readonly<Record<LinkStatus, number>>;

/** The aggregate a run reports. */
export interface HealthReport {
  readonly checkedAt: string;
  readonly total: number;
  readonly counts: HealthCounts;
  /** Links a reader could not reach: broken or timed out. These fail a run. */
  readonly failures: readonly LinkHealthResult[];
  /** Links that answered but refused automated clients. Reported, not fatal. */
  readonly blocked: readonly LinkHealthResult[];
  /** Links that work only after a redirect. */
  readonly moved: readonly LinkHealthResult[];
  /** True when nothing failed. A blocked link alone does not make a run unhealthy. */
  readonly healthy: boolean;
}

/**
 * Aggregates results into the report shape.
 *
 * A run is `healthy` when nothing is broken, timed out or refused. Blocked links
 * are excluded from that judgement on purpose: a bot filter answering 403 is not
 * evidence that the link is dead, and failing a nightly run on it would train the
 * operator to ignore the report.
 */
export function summariseHealthReport(
  results: readonly LinkHealthResult[],
  now: number = Date.now(),
): HealthReport {
  const counts: Record<LinkStatus, number> = {
    ok: 0,
    redirect: 0,
    broken: 0,
    timeout: 0,
    blocked: 0,
  };

  const failures: LinkHealthResult[] = [];
  const blocked: LinkHealthResult[] = [];
  const moved: LinkHealthResult[] = [];

  for (const result of results) {
    counts[result.status] += 1;
    if (result.status === "broken" || result.status === "timeout") failures.push(result);
    else if (result.status === "blocked") blocked.push(result);
    else if (result.status === "redirect") moved.push(result);
  }

  return {
    checkedAt: new Date(now).toISOString(),
    total: results.length,
    counts,
    failures,
    blocked,
    moved,
    healthy: failures.length === 0,
  };
}

/**
 * A plain-text summary, one line per link that needs a person to look at it.
 *
 * Lives here rather than in the CLI so the wording is covered by the same tests
 * as the classification, and so a second caller cannot invent a different
 * vocabulary for the same states.
 */
export function describeHealthSummary(report: HealthReport): string {
  const lines: string[] = [];
  const { counts } = report;

  lines.push(
    `${report.total} ${report.total === 1 ? "link" : "links"} checked: ` +
      `${counts.ok} ok, ${counts.redirect} redirected, ${counts.broken} broken, ` +
      `${counts.timeout} timed out, ${counts.blocked} refusing automated clients.`,
  );

  if (report.failures.length > 0) {
    lines.push("");
    lines.push("Needs fixing:");
    for (const failure of report.failures) {
      lines.push(`- [${failure.status}] ${failure.url}`);
      lines.push(`  ${failure.detail}`);
    }
  }

  if (report.moved.length > 0) {
    lines.push("");
    lines.push("Works, but the stored URL should be updated:");
    for (const moved of report.moved) {
      lines.push(`- ${moved.url}`);
      lines.push(`  ${moved.detail}`);
    }
  }

  if (report.blocked.length > 0) {
    lines.push("");
    lines.push("Could not be judged automatically. Open these by hand:");
    for (const entry of report.blocked) {
      lines.push(`- ${entry.url}`);
      lines.push(`  ${entry.detail}`);
    }
  }

  lines.push("");
  lines.push(
    report.healthy
      ? "No dead links were found."
      : `${report.failures.length} ${report.failures.length === 1 ? "link needs" : "links need"} attention.`,
  );

  return lines.join("\n");
}
