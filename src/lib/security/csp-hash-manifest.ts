/**
 * The shape of the generated CSP hash manifest, and the empty default.
 *
 * `csp-hash-manifest.generated.ts` is written by
 * `scripts/generate-csp-hashes.mjs`. Keeping the type here means the committed
 * default and the generated file are described in one place, and a hand-edited
 * generated file cannot quietly change what the proxy reads.
 */

/** Pathname to the inline-script digests of the shell that serves it. */
export type CspHashManifest = Readonly<Record<string, readonly string[]>>;
