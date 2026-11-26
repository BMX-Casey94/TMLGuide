/**
 * The one implementation of "which inline scripts does this HTML document carry".
 *
 * Two callers need exactly the same answer and cannot import each other:
 *
 * - `csp-hashes.ts` hashes the prerendered shells at runtime, when the build
 *   output is readable beside the running server;
 * - `scripts/generate-csp-hashes.mjs` hashes the same files after a build and
 *   writes the static manifest that covers hosts where the output is not.
 *
 * A digest computed differently in those two places would fail in one
 * environment only, and the symptom is a page that quietly never hydrates. So the
 * rules live here once.
 *
 * Keep this module dependency-free except for `node:crypto`: the generator loads
 * it directly through Node's TypeScript stripping, which resolves no path aliases
 * and no other project modules.
 */

import { createHash } from "node:crypto";

/** An inline `<script>` element: a script tag with no `src` attribute. */
const INLINE_SCRIPT_PATTERN = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;

/** JSON-LD blocks are data, not executable script, and are excluded. */
const JSON_LD_ATTRIBUTE = /application\/ld\+json/i;

/**
 * The CSP source expression for one script body.
 *
 * The digest is over the exact text, UTF-8 encoded, with no trimming: the browser
 * hashes the element's text content verbatim, so trimming would produce a digest
 * that never matches.
 */
export function inlineScriptSourceExpression(body: string): string {
  return `sha256-${createHash("sha256").update(body, "utf8").digest("base64")}`;
}

/**
 * Every distinct digest in one document, in document order.
 *
 * Three exclusions, each with a reason:
 *
 * - a script with a `src` attribute is external, and `'self'` already admits it;
 * - a JSON-LD block is data, so it never executes and needs no source;
 * - an empty element executes nothing, and a digest of `""` is noise in a header.
 */
export function extractInlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  // The pattern carries the `g` flag, so `lastIndex` survives between calls.
  INLINE_SCRIPT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_SCRIPT_PATTERN.exec(html)) !== null) {
    const attributes = match[1] ?? "";
    const body = match[2] ?? "";
    if (JSON_LD_ATTRIBUTE.test(attributes)) continue;
    if (body === "") continue;
    hashes.add(inlineScriptSourceExpression(body));
  }
  return [...hashes];
}

/**
 * The digests shared by every document in `htmlDocuments`, in first-seen order.
 *
 * This is how the *bootstrap* scripts are identified: the runtime bootstrap, the
 * accessibility preference reader and the streaming helpers are byte-identical in
 * every prerendered shell, while the flight payloads differ per route. Their
 * intersection is therefore the set a page needs when its own shell is not on
 * disk, which is the case for a `notFound()` raised inside a dynamic route.
 *
 * An empty input returns an empty list rather than a wildcard: "every document
 * shares nothing" and "there are no documents" must not be confused.
 */
export function commonInlineScriptHashes(htmlDocuments: readonly string[]): string[] {
  if (htmlDocuments.length === 0) return [];
  let shared: Set<string> | null = null;
  for (const html of htmlDocuments) {
    const hashes = extractInlineScriptHashes(html);
    if (shared === null) {
      shared = new Set(hashes);
    } else {
      const present = new Set(hashes);
      for (const hash of shared) {
        if (!present.has(hash)) shared.delete(hash);
      }
    }
    if (shared.size === 0) return [];
  }
  return [...(shared ?? [])];
}
