#!/usr/bin/env node
/**
 * Community link-health run.
 *
 * Checks every WhatsApp invite and every resource URL the community pages
 * publish, and reports the ones a reader would not reach. Intended for a
 * scheduled job and for a person before shipping a data change:
 *
 *   node scripts/check-community-links.mjs
 *   node scripts/check-community-links.mjs --json
 *   node scripts/check-community-links.mjs --out reports/community-links.json
 *   node scripts/check-community-links.mjs --only=groups --concurrency=2
 *
 * ## Exit codes
 *
 * | Code | Meaning |
 * | --- | --- |
 * | 0 | Every link answered. Redirects and bot-blocked links do not fail the run. |
 * | 1 | At least one link is broken or timed out. |
 * | 2 | The run could not start: bad argument, or the data files could not be read. |
 *
 * A bot-blocked link (a 403 from Cloudflare, say) is reported but does not fail
 * the run. A filter refusing an automated client says nothing about whether a
 * person can open the page, and a nightly job that fails on it every night is a
 * job everyone learns to ignore.
 *
 * ## Node versions
 *
 * The data files are TypeScript and this script reads them directly, so Node
 * must be able to strip types: 22.18 or newer does it by default. On an older
 * 22.x the script re-executes itself with `--experimental-strip-types`; on Node
 * 20 it exits with a clear message rather than a stack trace.
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const REEXEC_FLAG = "TML_COMMUNITY_LINKS_REEXEC";

/** Parses `--name=value` and `--flag` arguments, rejecting anything unknown. */
export function parseArgs(argv) {
  const options = {
    json: false,
    out: null,
    only: "all",
    concurrency: 4,
    timeoutMs: 8000,
    help: false,
  };

  for (const raw of argv) {
    if (raw === "--json") {
      options.json = true;
      continue;
    }
    if (raw === "--help" || raw === "-h") {
      options.help = true;
      continue;
    }

    const match = /^--([a-z-]+)=(.*)$/.exec(raw);
    if (!match) throw new Error(`Unrecognised argument "${raw}". Use --help for the list.`);

    const [, name, value] = match;
    switch (name) {
      case "out":
        if (value.trim() === "") throw new Error("--out needs a file path");
        options.out = value;
        break;
      case "only":
        if (!["all", "groups", "resources"].includes(value)) {
          throw new Error('--only must be "all", "groups" or "resources"');
        }
        options.only = value;
        break;
      case "concurrency": {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 16) {
          throw new Error("--concurrency must be a whole number from 1 to 16");
        }
        options.concurrency = parsed;
        break;
      }
      case "timeout": {
        // `Number` rather than `parseInt`, because `parseInt("2.5")` yields 2 and
        // would silently accept a value the operator did not ask for.
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1000 || parsed > 60000) {
          throw new Error("--timeout must be milliseconds from 1000 to 60000");
        }
        options.timeoutMs = parsed;
        break;
      }
      default:
        throw new Error(`Unrecognised option "--${name}". Use --help for the list.`);
    }
  }

  return options;
}

const HELP = `Community link-health check

Usage
  node scripts/check-community-links.mjs [options]

Options
  --json                 Print the machine-readable report instead of the summary
  --out=<path>           Also write the JSON report to this file
  --only=all|groups|resources
                         Restrict the run (default: all)
  --concurrency=<1-16>   Requests in flight at once (default: 4)
  --timeout=<ms>         Per-request budget, 1000-60000 (default: 8000)
  -h, --help             This text

Exit codes: 0 healthy, 1 a link is broken or timed out, 2 the run could not start.
`;

/** True when the failure is "this Node cannot read TypeScript yet". */
function isTypeStrippingFailure(error) {
  if (typeof error !== "object" || error === null) return false;
  const code = error.code;
  return (
    code === "ERR_UNKNOWN_FILE_EXTENSION" ||
    code === "ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX" ||
    code === "ERR_NO_TYPESCRIPT" ||
    /Unknown file extension "\.ts"/.test(String(error.message ?? ""))
  );
}

/**
 * Imports the TypeScript data modules.
 *
 * Only `import type` statements appear in those two files, so Node's type
 * stripping has nothing to resolve at run time; the values come out as plain
 * objects. If this Node cannot strip types, the script re-executes itself once
 * with the flag rather than failing.
 */
async function loadData() {
  const load = async (relativePath) => {
    const url = pathToFileURL(path.join(ROOT, relativePath)).href;
    return import(url);
  };

  try {
    const [{ whatsappGroups }, { resources }] = await Promise.all([
      load("src/data/community/whatsapp-groups.ts"),
      load("src/data/community/resources.ts"),
    ]);
    return { whatsappGroups, resources };
  } catch (error) {
    if (!isTypeStrippingFailure(error) || process.env[REEXEC_FLAG] === "1") throw error;

    const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
    if (nodeMajor < 22) {
      throw new Error(
        `Node ${process.versions.node} cannot read the TypeScript data files. Use Node 22.18 or newer.`,
      );
    }

    const exitCode = await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        ["--experimental-strip-types", ...process.argv.slice(1)],
        { stdio: "inherit", env: { ...process.env, [REEXEC_FLAG]: "1" } },
      );
      child.once("exit", (code) => resolve(code ?? 1));
      child.once("error", () => resolve(1));
    });
    process.exit(exitCode);
  }
}

/** Runs `tasks` with at most `limit` in flight, preserving the input order. */
export async function runWithLimit(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[community-links] ${error.message}`);
    return 2;
  }

  if (options.help) {
    console.log(HELP);
    return 0;
  }

  let data;
  try {
    data = await loadData();
  } catch (error) {
    console.error(`[community-links] Could not read the community data: ${error.message}`);
    return 2;
  }

  const { checkLinkHealth, summariseHealthReport, describeHealthSummary } = await import(
    pathToFileURL(path.join(ROOT, "src/lib/community/link-health.ts")).href
  );
  // The invite parser is the one the older checker already uses, so both tools
  // agree on what a revoked invite looks like.
  const { parseWhatsappInvite } = await import(
    pathToFileURL(path.join(ROOT, "scripts/lib/link-check.mjs")).href
  );

  /** Every URL in scope, tagged with where it came from so the report is actionable. */
  const targets = [];
  if (options.only !== "resources") {
    for (const group of data.whatsappGroups) {
      targets.push({
        kind: "whatsapp-group",
        id: group.id,
        label: group.title,
        url: group.inviteUrl,
        storedStatus: group.linkStatus ?? "unchecked",
        lastChecked: group.lastLinkCheck ?? group.lastVerified ?? null,
      });
    }
  }
  if (options.only !== "groups") {
    for (const resource of data.resources) {
      targets.push({
        kind: "resource",
        id: resource.id,
        label: resource.title,
        url: resource.url,
        storedStatus: null,
        lastChecked: resource.lastVerified ?? null,
      });
    }
  }

  if (targets.length === 0) {
    console.error("[community-links] Nothing to check: the selected collection is empty.");
    return 2;
  }

  const startedAt = Date.now();
  console.error(`[community-links] Checking ${targets.length} links…`);

  const results = await runWithLimit(targets, options.concurrency, async (target) => {
    // Only WhatsApp invite pages need their body read: the status alone cannot
    // tell a revoked invite from a live one.
    const isInvite = hostOf(target.url) === "chat.whatsapp.com";
    const health = await checkLinkHealth(target.url, {
      timeoutMs: options.timeoutMs,
      inspectBody: isInvite
        ? (body) => {
            const verdict = parseWhatsappInvite(body);
            if (verdict.state === "invalid") {
              return { ok: false, detail: `The invite no longer works: ${verdict.evidence}` };
            }
            if (verdict.state === "active") {
              return {
                ok: true,
                detail: verdict.groupName
                  ? `Invite live, group now named "${verdict.groupName}"`
                  : "Invite live",
              };
            }
            return null;
          }
        : undefined,
    });

    return { ...target, ...health };
  });

  const report = summariseHealthReport(results, Date.now());
  const payload = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    options: {
      only: options.only,
      concurrency: options.concurrency,
      timeoutMs: options.timeoutMs,
    },
    report,
    links: results,
  };

  if (options.out !== null) {
    const destination = path.isAbsolute(options.out) ? options.out : path.join(ROOT, options.out);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.error(`[community-links] Report written to ${destination}`);
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    console.log(describeHealthSummary(report));
  }

  return report.healthy ? 0 : 1;
}

/**
 * Runs only when this file is the entry point.
 *
 * The guard exists so the argument parser and the concurrency helper can be
 * imported by the unit tests without launching a network run as a side effect of
 * the import.
 */
const isEntryPoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (isEntryPoint) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`[community-links] Unexpected failure: ${error?.stack ?? error}`);
      process.exitCode = 2;
    });
}
