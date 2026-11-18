/**
 * Link-health check for the TMLGUIDE resource, WhatsApp and partner links.
 *
 * Reads  docs/factcheck/links-input.json
 * Writes docs/factcheck/links-result.json and docs/factcheck/links.md
 *
 * Run: node scripts/check-links.mjs
 *      node scripts/check-links.mjs --only=whatsapp      (subset by kind)
 *
 * House rules the script follows:
 *   - at most 4 requests in flight overall and at most 2 per host, so a host
 *     that appears 26 times is never hammered;
 *   - 12 s per request, 2 redirects followed by hand so each hop is validated
 *     and recorded;
 *   - HEAD first, GET only when the method is refused (403/405/501), and at
 *     most 64 KB of that body is read;
 *   - one retry, with backoff, and only for transport errors;
 *   - no credentials, no cookies, no login, no joining anything.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import dns from "node:dns/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  CLASSIFICATIONS,
  PROBLEM_CLASSIFICATIONS,
  USER_AGENT,
  classifyStatus,
  inspectUrl,
  isPrivateHost,
  parseWhatsappInvite,
} from "./lib/link-check.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = path.join(REPO_ROOT, "docs/factcheck/links-input.json");
const DEFAULT_JSON_OUT = path.join(REPO_ROOT, "docs/factcheck/links-result.json");
const DEFAULT_MD_OUT = path.join(REPO_ROOT, "docs/factcheck/links.md");

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 2;
const MAX_BODY_BYTES = 64 * 1024;
const GLOBAL_CONCURRENCY = 4;
const PER_HOST_CONCURRENCY = 2;
const RETRY_BACKOFF_MS = 1_500;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
/** Statuses where HEAD told us nothing usable and a GET is worth one try. */
const NEEDS_GET = new Set([403, 405, 501, 204]);

/** Page markers that mean "a bot wall answered", not "the page is fine". */
const CHALLENGE_MARKERS = [
  "cf-browser-verification",
  "just a moment...",
  "attention required! | cloudflare",
  "enable javascript and cookies to continue",
  "captcha-delivery.com",
  "please verify you are a human",
];

const ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

/* ------------------------------------------------------------------ helpers */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const options = { input: DEFAULT_INPUT, jsonOut: DEFAULT_JSON_OUT, mdOut: DEFAULT_MD_OUT, only: null };
  for (const arg of argv) {
    const [flag, value] = arg.split("=");
    if (flag === "--input" && value) options.input = path.resolve(value);
    else if (flag === "--json-out" && value) options.jsonOut = path.resolve(value);
    else if (flag === "--md-out" && value) options.mdOut = path.resolve(value);
    else if (flag === "--only" && value) options.only = new Set(value.split(",").map((kind) => kind.trim()));
  }
  return options;
}

/** Counts body bytes and stops reading the moment the cap is reached. */
async function readCappedText(response, limit = MAX_BODY_BYTES) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = limit - total;
      if (remaining <= 0) break;
      const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(slice);
      total += slice.byteLength;
      if (total >= limit) break;
    }
  } finally {
    // Releasing the lock lets the socket be discarded instead of downloaded.
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

function looksLikeChallenge(text) {
  if (!text) return false;
  const sample = text.slice(0, 8 * 1024).toLowerCase();
  return CHALLENGE_MARKERS.some((marker) => sample.includes(marker));
}

function errorCode(error) {
  if (!error) return "NETWORK_ERROR";
  // A timed-out fetch rejects with a DOMException named TimeoutError whose
  // numeric `code` is meaningless, so the name is checked first.
  if (error.name === "TimeoutError" || error.name === "AbortError") return "ETIMEDOUT";
  if (error.code) return String(error.code);
  const cause = error.cause;
  if (cause?.code) return String(cause.code);
  if (cause?.name === "TimeoutError") return "ETIMEDOUT";
  return "NETWORK_ERROR";
}

function errorMessage(error) {
  return error?.cause?.message ?? error?.message ?? "unknown error";
}

/* --------------------------------------------------------------- SSRF guard */

/**
 * Refuses a URL that is not a web URL, or whose host is (or resolves to) a
 * private address. Every DNS answer is checked, so a name that resolves to both
 * a public and a link-local address is rejected rather than raced.
 *
 * Residual risk: the address verified here is not the address fetch() then
 * connects to, so a hostile resolver could rebind in between. Closing that
 * needs a custom undici dispatcher, which would mean a new dependency. It is
 * acceptable here because the input list is a reviewed repository file, not
 * attacker-supplied request data.
 */
async function resolveGuard(rawUrl) {
  const inspected = inspectUrl(rawUrl);
  if (!inspected.safe) return { ok: false, reason: inspected.reason };

  const { url } = inspected;
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (isPrivateHost(hostname)) {
    return { ok: false, reason: `host "${hostname}" is a private or reserved address` };
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    return { ok: false, dnsError: errorCode(error), reason: `DNS lookup failed (${errorCode(error)})` };
  }
  if (addresses.length === 0) {
    return { ok: false, dnsError: "ENOTFOUND", reason: "DNS lookup returned no addresses" };
  }
  const offending = addresses.find((entry) => isPrivateHost(entry.address));
  if (offending) {
    return {
      ok: false,
      reason: `host "${hostname}" resolves to the private address ${offending.address}`,
    };
  }
  return { ok: true, url, addresses: addresses.map((entry) => entry.address) };
}

/* ------------------------------------------------------------ request layer */

/** Caps concurrent requests overall and per host. */
class Limiter {
  constructor(overall, perHost) {
    this.overall = overall;
    this.perHost = perHost;
    this.active = 0;
    this.activeByHost = new Map();
    this.queue = [];
  }

  async run(host, task) {
    await this.acquire(host);
    try {
      return await task();
    } finally {
      this.release(host);
    }
  }

  acquire(host) {
    return new Promise((resolve) => {
      this.queue.push({ host, resolve });
      this.drain();
    });
  }

  drain() {
    for (let index = 0; index < this.queue.length; index += 1) {
      if (this.active >= this.overall) return;
      const waiter = this.queue[index];
      const hostActive = this.activeByHost.get(waiter.host) ?? 0;
      if (hostActive >= this.perHost) continue;
      this.queue.splice(index, 1);
      index -= 1;
      this.active += 1;
      this.activeByHost.set(waiter.host, hostActive + 1);
      waiter.resolve();
    }
  }

  release(host) {
    this.active -= 1;
    const hostActive = (this.activeByHost.get(host) ?? 1) - 1;
    if (hostActive <= 0) this.activeByHost.delete(host);
    else this.activeByHost.set(host, hostActive);
    this.drain();
  }
}

const limiter = new Limiter(GLOBAL_CONCURRENCY, PER_HOST_CONCURRENCY);

/**
 * Hosts that have answered 429 or a bot challenge during this run. Once a host
 * says "slow down", every remaining link on it is recorded as blocked without
 * another request: carrying on would be the hammering this script exists to
 * avoid, and it would not produce a truer answer.
 */
const throttledHosts = new Map();

/** One HTTP exchange: no redirect following, no retry, no interpretation. */
async function requestOnce(url, method) {
  const host = url.hostname;

  const earlier = throttledHosts.get(host);
  if (earlier) {
    const error = new Error(`host throttled earlier in this run (${earlier})`);
    error.code = "EHOSTTHROTTLED";
    error.throttledHost = true;
    throw error;
  }

  return limiter.run(host, async () => {
    const response = await fetch(url.href, {
      method,
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
        accept: ACCEPT,
        "accept-language": "en-GB,en;q=0.9",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // No cookies, no credentials, ever.
      credentials: "omit",
      referrer: "",
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throttledHosts.set(host, retryAfter ? `429, Retry-After ${retryAfter}` : "429");
    }

    const wantsBody = method === "GET";
    const body = wantsBody && response.body ? await readCappedText(response) : "";
    // Draining a HEAD response costs nothing but keeps the socket reusable.
    if (!wantsBody && response.body) await response.body.cancel().catch(() => {});

    if (wantsBody && response.status < 400 && looksLikeChallenge(body)) {
      throttledHosts.set(host, "bot challenge page");
    }

    return {
      status: response.status,
      location: response.headers.get("location"),
      contentType: response.headers.get("content-type"),
      body,
      method,
    };
  });
}

/** Runs one request, retrying a transport failure exactly once. */
async function requestWithRetry(url, method) {
  try {
    return { response: await requestOnce(url, method), attempts: 1 };
  } catch (error) {
    if (error.throttledHost) return { error, attempts: 0 };
    // One retry after a backoff, for transport errors only. A status code,
    // however unwelcome, is an answer and is never retried.
    await sleep(RETRY_BACKOFF_MS);
    try {
      return { response: await requestOnce(url, method), attempts: 2 };
    } catch (secondError) {
      return { error: secondError, attempts: 2 };
    }
  }
}

/**
 * Probes one URL end to end: guard, redirect chain, HEAD-then-GET fallback.
 * The redirect chain is walked by hand so no hop escapes the guard and every
 * hop is recorded.
 */
async function probe(rawUrl, { forceGet = false } = {}) {
  const chain = [];
  let currentRaw = rawUrl;
  let currentGuard = await resolveGuard(currentRaw);

  if (!currentGuard.ok) {
    return {
      classification: currentGuard.dnsError ? "dead" : "rejected",
      note: currentGuard.reason,
      httpStatus: null,
      finalUrl: null,
      redirects: chain,
      attempts: 0,
      via: null,
      body: "",
      requestedUrl: currentRaw,
    };
  }

  let attempts = 0;
  const trail = [];
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const method = forceGet ? "GET" : "HEAD";
    let outcome = await requestWithRetry(currentGuard.url, method);
    attempts += outcome.attempts;
    if (outcome.response) {
      trail.push({ url: currentGuard.url.href, method: outcome.response.method, status: outcome.response.status });
    }

    if (outcome.response && !forceGet && NEEDS_GET.has(outcome.response.status)) {
      const retry = await requestWithRetry(currentGuard.url, "GET");
      attempts += retry.attempts;
      if (retry.response) {
        trail.push({ url: currentGuard.url.href, method: retry.response.method, status: retry.response.status });
      }
      outcome = retry;
    }

    if (outcome.error) {
      if (outcome.error.throttledHost) {
        // The host refused us earlier in this run. That is a blocked link, not
        // a network fault: the script is the problem, not the URL.
        return {
          classification: "blocked",
          note: `not requested again — ${errorMessage(outcome.error)}; the first refusal stands`,
          httpStatus: null,
          finalUrl: currentGuard.url.href,
          redirects: chain,
          attempts: 0,
          via: null,
          body: "",
          trail,
          throttled: true,
          requestedUrl: currentRaw,
        };
      }
      const verdict = classifyStatus({ error: { code: errorCode(outcome.error), message: errorMessage(outcome.error) } });
      return {
        classification: verdict.classification,
        note: `${verdict.note}: ${errorMessage(outcome.error)}`,
        httpStatus: null,
        finalUrl: currentGuard.url.href,
        redirects: chain,
        attempts,
        via: null,
        body: "",
        trail,
        requestedUrl: currentRaw,
      };
    }

    const { response } = outcome;
    const via = response.method;

    if (REDIRECT_STATUSES.has(response.status) && response.location) {
      let nextUrl;
      try {
        nextUrl = new URL(response.location, currentGuard.url);
      } catch {
        return {
          classification: "unreachable",
          note: `${response.status} redirect with an unparseable Location`,
          httpStatus: response.status,
          finalUrl: currentGuard.url.href,
          redirects: chain,
          attempts,
          via,
          body: "",
          trail,
          requestedUrl: currentRaw,
        };
      }
      chain.push({ from: currentGuard.url.href, to: nextUrl.href, status: response.status });

      if (hop === MAX_REDIRECTS) {
        // Every hop answered, so this is not unreachable — but the final
        // destination was never fetched, and saying "redirected" without that
        // caveat would imply the destination is fine.
        return {
          classification: "redirected",
          note: `chain longer than ${MAX_REDIRECTS} redirects; stopped after ${chain.length} hops at ${nextUrl.href} without resolving the final page`,
          httpStatus: response.status,
          finalUrl: nextUrl.href,
          redirects: chain,
          attempts,
          via,
          body: "",
          chainExceeded: true,
          trail,
          requestedUrl: currentRaw,
        };
      }

      // Every hop passes the guard: a public page may redirect anywhere.
      const nextGuard = await resolveGuard(nextUrl.href);
      if (!nextGuard.ok) {
        return {
          classification: nextGuard.dnsError ? "dead" : "rejected",
          note: `redirect target refused: ${nextGuard.reason}`,
          httpStatus: response.status,
          finalUrl: nextUrl.href,
          redirects: chain,
          attempts,
          via,
          body: "",
          trail,
          requestedUrl: currentRaw,
        };
      }
      currentGuard = nextGuard;
      currentRaw = nextUrl.href;
      continue;
    }

    return {
      classification: null,
      httpStatus: response.status,
      finalUrl: currentGuard.url.href,
      redirects: chain,
      attempts,
      via,
      body: response.body,
      contentType: response.contentType,
      trail,
      requestedUrl: currentRaw,
    };
  }

  return {
    classification: "unreachable",
    note: "redirect loop",
    httpStatus: null,
    finalUrl: currentRaw,
    redirects: chain,
    attempts,
    via: null,
    body: "",
    trail,
    requestedUrl: currentRaw,
  };
}

/* --------------------------------------------------------------- assessment */

const probeCache = new Map();

/** Probes a URL once per run; duplicate entries share the answer. */
async function probeCached(url, options) {
  const key = `${options.forceGet ? "GET" : "AUTO"} ${url}`;
  if (!probeCache.has(key)) probeCache.set(key, probe(url, options));
  return probeCache.get(key);
}

function httpsAlternative(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:") return null;
    url.protocol = "https:";
    return url.href;
  } catch {
    return null;
  }
}

const WHATSAPP_INVITE = /^https?:\/\/chat\.whatsapp\.com\//i;

/** Reduces a probe to the HTTP facts the report needs. */
function httpFacts(probe) {
  return {
    httpStatus: probe.httpStatus ?? null,
    redirects: probe.redirects ?? [],
    finalUrl: probe.finalUrl ?? null,
    requestedUrl: probe.requestedUrl ?? null,
  };
}

function describeAlternative(url, probe) {
  const facts = httpFacts(probe);
  const verdict =
    probe.classification ??
    classifyStatus({
      httpStatus: facts.httpStatus,
      redirects: facts.redirects.length,
      finalUrl: facts.finalUrl,
      requestedUrl: facts.requestedUrl,
    });
  return {
    url,
    works: ["ok", "redirected"].includes(verdict.classification) && !probe.chainExceeded,
    classification: verdict.classification,
    httpStatus: facts.httpStatus,
    finalUrl: facts.finalUrl,
    note: probe.note ?? verdict.note,
    trail: probe.trail ?? [],
    chainExceeded: Boolean(probe.chainExceeded),
  };
}

async function assess(entry) {
  const rawUrl = String(entry.url ?? "");
  const insecure = /^http:/i.test(rawUrl);
  const isWhatsapp = entry.kind === "whatsapp" || WHATSAPP_INVITE.test(rawUrl);

  // WhatsApp answers HEAD with metadata only, so its invite page is always
  // fetched with GET; that is also the only way to read the group name.
  const options = { forceGet: isWhatsapp };
  const result = await probeCached(rawUrl, options);

  const record = {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    url: entry.url,
    ...(entry.region ? { region: entry.region } : {}),
    ...(entry.category ? { category: entry.category } : {}),
    classification: null,
    httpStatus: result.httpStatus ?? null,
    via: result.via ?? null,
    finalUrl: result.finalUrl ?? null,
    redirects: result.redirects ?? [],
    attempts: result.attempts ?? 0,
    note: "",
    trail: result.trail ?? [],
  };

  if (result.classification === "rejected") {
    record.classification = "rejected";
    record.note = result.note;
    return record;
  }

  // Every plain-http link gets its https twin tested: it is the upgrade path we
  // will recommend, and for WhatsApp it is the only way to read the invite page,
  // because chat.whatsapp.com refuses a plain-http GET.
  let upgraded = null;
  const alternative = insecure ? httpsAlternative(rawUrl) : null;
  if (alternative) {
    upgraded = await probeCached(alternative, options);
    record.httpsAlternative = describeAlternative(alternative, upgraded);
  }

  if (result.classification !== null) {
    // The probe stopped before a usable page came back: DNS failure, a
    // transport error, an unresolved redirect chain, or a host that refused us
    // earlier in this run. A plain http:// link is still reported as insecure,
    // because the scheme is the defect the reader has to fix.
    record.classification = insecure && result.classification !== "blocked" ? "insecure" : result.classification;
    record.note = insecure ? `${result.note} (the link is plain http://)` : result.note;
    if (result.chainExceeded) {
      record.chainExceeded = true;
      // The http hop itself consumes one of the two redirects, so the https
      // twin is the fair measure of where this link actually leads.
      if (record.httpsAlternative?.works) {
        record.note += `; the https:// twin does resolve (see the http table), so switching to it also saves a hop`;
      }
    }
    if (result.throttled) record.throttled = true;
    return record;
  }

  if (isWhatsapp) {
    // Fall back to the https body when the plain-http request was refused.
    const source = result.body ? { probe: result, body: result.body } : null;
    const fallback = !source && upgraded?.body ? { probe: upgraded, body: upgraded.body } : null;
    const page = source ?? fallback;

    if (!page) {
      const verdict = classifyStatus({
        httpStatus: record.httpStatus,
        insecure,
        redirects: record.redirects.length,
        finalUrl: record.finalUrl,
        requestedUrl: result.requestedUrl,
      });
      record.classification = verdict.classification;
      record.note = `${verdict.note}; no invite page was returned, so group status is unknown`;
      return record;
    }

    const invite = parseWhatsappInvite(page.body);
    record.whatsapp = invite;
    const viaAlternative = page.probe === upgraded;
    const where = viaAlternative ? ` at ${alternative}` : "";

    if (invite.state === "active") {
      const facts = httpFacts(page.probe);
      const verdict = classifyStatus({
        httpStatus: facts.httpStatus,
        redirects: facts.redirects.length,
        finalUrl: facts.finalUrl,
        requestedUrl: facts.requestedUrl,
      });
      record.classification = insecure ? "insecure" : verdict.classification;
      if (insecure) {
        record.note = `plain http:// (${record.httpStatus ?? "no response"}) but the https twin answers ${facts.httpStatus}; invite live at ${alternative}, group name shown: "${invite.groupName}"`;
      } else {
        record.note = `${verdict.note}; invite live, group name shown: "${invite.groupName}"`;
      }
      return record;
    }

    if (invite.state === "invalid") {
      // An http WhatsApp invite that is also revoked is reported as dead only
      // when the page itself loaded over http; otherwise the scheme is the
      // problem worth fixing first.
      record.classification = insecure && !viaAlternative ? "insecure" : "dead";
      record.note = `invite link invalid or revoked${where} — ${invite.evidence}`;
      return record;
    }

    const facts = httpFacts(page.probe);
    const verdict = classifyStatus({
      httpStatus: facts.httpStatus,
      insecure,
      redirects: facts.redirects.length,
      finalUrl: facts.finalUrl,
      requestedUrl: facts.requestedUrl,
    });
    record.classification = verdict.classification;
    record.note = `${verdict.note}; invite state indeterminate (${invite.evidence})`;
    return record;
  }

  const verdict = classifyStatus({
    httpStatus: result.httpStatus,
    insecure,
    redirects: result.redirects?.length ?? 0,
    finalUrl: result.finalUrl,
    requestedUrl: result.requestedUrl,
    challenge: looksLikeChallenge(result.body),
  });
  record.classification = verdict.classification;
  record.note = result.note ?? verdict.note;

  return record;
}

/* --------------------------------------------------------------- reporting */

function countBy(records, key) {
  const counts = Object.create(null);
  for (const value of CLASSIFICATIONS) counts[value] = 0;
  for (const record of records) {
    const bucket = record[key] ?? "unknown";
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return counts;
}

function cell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

/** Renders a path relative to the repo with forward slashes, for markdown. */
function relative(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
}

function sortByClassification(records) {
  return [...records].sort((left, right) => {
    const order = PROBLEM_CLASSIFICATIONS.indexOf(left.classification);
    const otherOrder = PROBLEM_CLASSIFICATIONS.indexOf(right.classification);
    if (order !== otherOrder) return (order === -1 ? 99 : order) - (otherOrder === -1 ? 99 : otherOrder);
    return String(left.id).localeCompare(String(right.id));
  });
}

function renderMarkdown(payload) {
  const { generatedAt, results, summary } = payload;
  const problemRecords = sortByClassification(results.filter((record) => record.classification !== "ok"));
  const httpRecords = results.filter((record) => /^http:/i.test(String(record.url ?? "")));

  const lines = [];
  lines.push("# Link health report");
  lines.push("");
  lines.push(`Generated ${generatedAt} from \`${relative(payload.inputPath)}\`.`);
  lines.push("");
  lines.push(
    "Every verdict below comes from a real response. Each link was requested with HEAD and, where that method was refused or told us nothing, with GET; WhatsApp invites were always fetched with GET so the invite page could be read. No link is marked ok without a response, and nothing here was joined, signed into or paid for.",
  );
  lines.push("");

  lines.push("## Totals");
  lines.push("");
  lines.push(`- Checked: **${summary.total}** links (${summary.kinds})`);
  lines.push("");
  lines.push("| Classification | Count |");
  lines.push("| --- | ---: |");
  for (const classification of CLASSIFICATIONS) {
    lines.push(`| ${classification} | ${summary.byClassification[classification] ?? 0} |`);
  }
  lines.push("");

  lines.push("## Totals by kind");
  lines.push("");
  lines.push(`| Kind | ${CLASSIFICATIONS.join(" | ")} |`);
  lines.push(`| --- | ${CLASSIFICATIONS.map(() => "---:").join(" | ")} |`);
  for (const [kind, counts] of Object.entries(summary.byKind)) {
    lines.push(`| ${kind} | ${CLASSIFICATIONS.map((classification) => counts[classification] ?? 0).join(" | ")} |`);
  }
  lines.push("");

  lines.push(`## Every link that is not ok (${problemRecords.length})`);
  lines.push("");
  if (problemRecords.length === 0) {
    lines.push("None. Every link answered with a success status.");
  } else {
    lines.push("| id | title | url | status | note |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const record of problemRecords) {
      const evidence = record.trail.map((step) => `${step.method} ${step.status}`).join(", ");
      const note = evidence ? `${record.note} [${evidence}]` : record.note;
      lines.push(
        `| ${cell(record.id)} | ${cell(record.title)} | ${cell(record.url)} | ${cell(record.classification)} | ${cell(note)} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Redirected links");
  lines.push("");
  const redirected = results.filter((record) => record.redirects.length > 0);
  if (redirected.length === 0) {
    lines.push("None followed a redirect.");
  } else {
    lines.push("| id | title | from | to | hops |");
    lines.push("| --- | --- | --- | --- | ---: |");
    for (const record of redirected) {
      const hops = record.redirects.map((hop) => `${hop.from} → ${hop.to} (${hop.status})`).join("<br>");
      lines.push(`| ${cell(record.id)} | ${cell(record.title)} | ${cell(record.url)} | ${hops} | ${record.redirects.length} |`);
    }
  }
  lines.push("");

  lines.push(`## http:// URLs and their https:// alternatives (${httpRecords.length})`);
  lines.push("");
  if (httpRecords.length === 0) {
    lines.push("None.");
  } else {
    lines.push("| id | title | http url | https alternative | https result |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const record of httpRecords) {
      const alternative = record.httpsAlternative;
      let verdict;
      if (!alternative) {
        verdict = "not tested";
      } else if (alternative.chainExceeded) {
        verdict = "answers, but the chain exceeds 2 redirects (unconfirmed destination)";
      } else if (alternative.works) {
        verdict = `works (${alternative.classification}${alternative.httpStatus ? `, ${alternative.httpStatus}` : ""})`;
      } else {
        verdict = `does not work (${alternative.classification}${alternative.httpStatus ? `, ${alternative.httpStatus}` : ""})`;
      }
      lines.push(
        `| ${cell(record.id)} | ${cell(record.title)} | ${cell(record.url)} | ${cell(alternative?.url ?? "—")} | ${cell(verdict)} |`,
      );
    }
  }
  lines.push("");

  const whatsappRecords = results.filter((record) => record.kind === "whatsapp");
  if (whatsappRecords.length > 0) {
    const active = whatsappRecords.filter((record) => record.whatsapp?.state === "active");
    const invalid = whatsappRecords.filter((record) => record.whatsapp?.state === "invalid");
    const unknown = whatsappRecords.filter(
      (record) => record.whatsapp && record.whatsapp.state === "unknown",
    );
    lines.push("## WhatsApp invite groups");
    lines.push("");
    lines.push(
      `${whatsappRecords.length} invites checked by reading the public invite page only (no login, no join request): ${active.length} active, ${invalid.length} invalid or revoked, ${unknown.length} indeterminate.`,
    );
    lines.push("");
    lines.push("| id | group title | invite | state | group name on invite page |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const record of whatsappRecords) {
      lines.push(
        `| ${cell(record.id)} | ${cell(record.title)} | ${cell(record.url)} | ${cell(record.whatsapp?.state ?? "not read")} | ${cell(record.whatsapp?.groupName ?? "—")} |`,
      );
    }
    lines.push("");
  }

  const rejected = results.filter((record) => record.classification === "rejected");
  if (rejected.length > 0) {
    lines.push("## Refused by the safety guard");
    lines.push("");
    for (const record of rejected) {
      lines.push(`- \`${record.id}\` ${record.url} — ${record.note}`);
    }
    lines.push("");
  }

  const insecure = results.filter((record) => record.classification === "insecure");
  const unresolvedChains = results.filter((record) => record.chainExceeded);
  const blocked = results.filter((record) => record.classification === "blocked");
  const throttled = results.filter((record) => record.throttled);
  lines.push("## Notes and assumptions");
  lines.push("");
  lines.push(
    "- A link is only marked `ok` when a response arrived with a success status and, for WhatsApp, the invite page still printed a group name.",
  );
  lines.push(
    "- `blocked` means the host answered but refused automated clients (403/429/451 or a bot challenge). It is recorded as blocked, never upgraded to ok. A blocked link may well work in a browser; that is not something this script can prove, so it is not claimed.",
  );
  lines.push(
    "- Once a host answers 429 or a bot challenge, the remaining links on that host are recorded as blocked without another request, so a rate limit is not made worse. Any row whose note says \"not requested again\" was not measured in this run.",
  );
  lines.push(
    "- Requests are capped at 4 in flight overall and 2 per host, 12 s each, with one retry only for transport errors (a status code is an answer and is never retried). Redirects are followed by hand, at most 2, and every hop is recorded.",
  );
  lines.push(
    "- A plain `http:` URL is classified `insecure` whatever the server answered, because the scheme itself is the defect. The https alternative is tested separately and reported above.",
  );
  lines.push(
    "- Duplicate URLs in the input (the same invite listed as both a resource and a group, or one Drive file used twice) are probed once and reported per entry, so the per-entry counts sum to more requests than the host actually received.",
  );
  if (unresolvedChains.length > 0) {
    lines.push(
      `- ${unresolvedChains.length} link(s) redirect more than twice over http; the chain was followed as far as the cap allows against the raw link, so that entry's destination is unconfirmed. The https twin for ${unresolvedChains.map((record) => `\`${record.id}\``).join(", ")} was tested separately and does resolve: ${unresolvedChains.map((record) => record.httpsAlternative?.finalUrl ?? "—").join(", ")}.`,
    );
  }
  if (insecure.length > 0) {
    lines.push(`- ${insecure.length} link(s) still use plain http and need rewriting to https.`);
  }
  if (blocked.length > 0) {
    lines.push(
      `- ${blocked.length} link(s) could not be verified from a script and need one manual check in a browser: ${blocked.map((record) => `\`${record.id}\``).join(", ")}.`,
    );
  }
  if (throttled.length > 0) {
    lines.push(
      `- ${throttled.length} of those were skipped after their host began refusing requests, so this run does not measure them. Re-run after the host's rate limit clears (WhatsApp's usually clears within minutes to an hour).`,
    );
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

/* -------------------------------------------------------------------- main */

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = JSON.parse(await readFile(options.input, "utf8"));
  if (!Array.isArray(raw)) throw new Error("links-input.json must be a JSON array");

  const entries = raw.filter((entry) => !options.only || options.only.has(entry.kind));
  const seenIds = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || entry.id === "") {
      throw new Error(`every entry needs an id, found ${JSON.stringify(entry)}`);
    }
    if (seenIds.has(entry.id)) throw new Error(`duplicate id "${entry.id}"`);
    seenIds.add(entry.id);
    if (typeof entry.title !== "string" || typeof entry.url !== "string") {
      throw new Error(`entry "${entry.id}" needs a title and a url`);
    }
    if (!["whatsapp", "resource", "partner"].includes(entry.kind)) {
      throw new Error(`entry "${entry.id}" has an unknown kind "${entry.kind}"`);
    }
  }

  const startedAt = new Date();
  const results = new Array(entries.length);
  const queue = entries.map((entry, index) => ({ entry, index }));

  // A small worker pool keeps the limiter honest without spawning a task per link.
  const workers = Array.from({ length: Math.min(GLOBAL_CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      results[next.index] = await assess(next.entry);
      process.stdout.write(
        `${next.entry.kind.padEnd(8)} ${String(results[next.index].classification).padEnd(11)} ${next.entry.id}\n`,
      );
    }
  });
  await Promise.all(workers);

  const finishedAt = new Date();
  const byKind = Object.create(null);
  for (const kind of [...new Set(results.map((record) => record.kind))].sort()) {
    byKind[kind] = countBy(
      results.filter((record) => record.kind === kind),
      "classification",
    );
  }

  const kindCounts = Object.create(null);
  for (const record of results) kindCounts[record.kind] = (kindCounts[record.kind] ?? 0) + 1;

  const payload = {
    repoRoot: REPO_ROOT,
    inputPath: options.input,
    generatedAt: finishedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    userAgent: USER_AGENT,
    settings: {
      globalConcurrency: GLOBAL_CONCURRENCY,
      perHostConcurrency: PER_HOST_CONCURRENCY,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      maxBodyBytes: MAX_BODY_BYTES,
    },
    summary: {
      total: results.length,
      kinds: Object.entries(kindCounts)
        .map(([kind, count]) => `${count} ${kind}`)
        .join(", "),
      byKind,
      byClassification: countBy(results, "classification"),
    },
    results,
  };

  await mkdir(path.dirname(options.jsonOut), { recursive: true });
  await writeFile(options.jsonOut, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(options.mdOut, renderMarkdown(payload), "utf8");

  const counts = payload.summary.byClassification;
  process.stdout.write(
    `\n${results.length} links checked: ${CLASSIFICATIONS.map((classification) => `${classification} ${counts[classification] ?? 0}`).join(", ")}\n`,
  );
  process.stdout.write(`Wrote ${relative(options.jsonOut)} and ${relative(options.mdOut)}\n`);

  // A run that hit a rate limit is not a clean result. Say so loudly and fail,
  // so a throttled report can never be mistaken for a finished one in CI or in
  // a shell that only checks the exit code.
  const throttledCount = results.filter((record) => record.throttled).length;
  if (throttledCount > 0) {
    process.stderr.write(
      `\n${throttledCount} link(s) were skipped because a host began refusing requests. This run is INCOMPLETE: wait for the host's rate limit to clear and run again before trusting the counts above.\n`,
    );
    process.exitCode = 2;
  }
}

await main();
