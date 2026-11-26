/**
 * Tests for the prerendered-shell hash extraction, the generated manifest and the
 * precedence between them.
 *
 * The hash module is what lets a strict nonce policy coexist with
 * `cacheComponents`. If it silently returns the wrong digests, every prerendered
 * page stops hydrating, and the failure is invisible server-side — the page is
 * served, the policy is sent, the browser just refuses the scripts. So both
 * sources, and the rule that decides between them, are pinned here rather than
 * being discovered in production.
 */

// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearHashCache,
  commonInlineScriptHashes,
  describeHashCoverage,
  describeHashSource,
  extractInlineScriptHashes,
  getInlineScriptHashes,
  isPrerenderOutputAvailable,
  isTemplateShell,
  NOT_FOUND_SHELL,
  PRERENDER_DIR,
  PRERENDER_DIR_ENV,
  prerenderRoot,
  shellFileForPathname,
} from "./csp-hashes";

function sha256(text: string): string {
  return `sha256-${createHash("sha256").update(text, "utf8").digest("base64")}`;
}

/** A shell with one script, for the cases where the digest value is what matters. */
function shell(body: string): string {
  return `<html><body><script>${body}</script></body></html>`;
}

/**
 * The empty manifest, used by default so these tests describe the runtime path.
 *
 * The committed `csp-hash-manifest.generated.ts` is a real generated file in the
 * working tree, so without this the suite would pass or fail depending on whether
 * someone had run a build — and the "no manifest" cases could never be reached.
 * Tests that are *about* the manifest mock their own.
 *
 * The factory is inlined because `vi.mock` is hoisted above the file's own
 * declarations, so it cannot close over a constant.
 */
vi.mock("./csp-hash-manifest.generated", () => ({
  CSP_HASH_MANIFEST: {},
  CSP_SHARED_HASHES: [],
  CSP_NOT_FOUND_HASHES: [],
  CSP_MANIFEST_GENERATED: false,
  CSP_MANIFEST_SHELL_COUNT: 0,
  CSP_MANIFEST_SITE_URL: "",
  CSP_MANIFEST_GENERATED_AT: "",
}));

afterEach(() => {
  clearHashCache();
});

describe("extractInlineScriptHashes", () => {
  it("hashes an inline script over its exact text", () => {
    expect(extractInlineScriptHashes("<script>var a = 1;</script>")).toEqual([sha256("var a = 1;")]);
  });

  it("ignores scripts with a src attribute", () => {
    const html = '<script src="/_next/static/chunk.js"></script><script>var a = 1;</script>';
    expect(extractInlineScriptHashes(html)).toEqual([sha256("var a = 1;")]);
  });

  it("ignores scripts with src even when other attributes are present", () => {
    const html = '<script async src="/x.js"></script><script nonce="n">var a = 1;</script>';
    // The nonced script is still inline, so it is hashed. The src script is not.
    expect(extractInlineScriptHashes(html)).toEqual([sha256("var a = 1;")]);
  });

  it("ignores JSON-LD blocks, which are data rather than executable script", () => {
    const html =
      '<script type="application/ld+json">{"@type":"WebSite"}</script><script>var a = 1;</script>';
    expect(extractInlineScriptHashes(html)).toEqual([sha256("var a = 1;")]);
  });

  it("recognises JSON-LD regardless of attribute casing and spacing", () => {
    expect(extractInlineScriptHashes('<script  TYPE = "Application/LD+JSON" >{"a":1}</script>')).toEqual(
      [],
    );
  });

  it("ignores an empty script element, whose hash would match nothing useful", () => {
    expect(extractInlineScriptHashes("<script></script>")).toEqual([]);
  });

  it("deduplicates identical scripts", () => {
    expect(extractInlineScriptHashes("<script>var a = 1;</script><script>var a = 1;</script>")).toHaveLength(
      1,
    );
  });

  it("returns each distinct script once", () => {
    const hashes = extractInlineScriptHashes("<script>var a = 1;</script><script>var b = 2;</script>");
    expect(hashes).toHaveLength(2);
    expect(hashes).toContain(sha256("var a = 1;"));
    expect(hashes).toContain(sha256("var b = 2;"));
  });

  it("hashes the text verbatim, preserving whitespace and newlines", () => {
    // The browser hashes the element's text content as-is, so trimming would
    // produce a digest that never matches and the page would not hydrate.
    const body = '\n  self.__next_f.push([1,"a"]);\n';
    const html = `<script>${body}</script>`;
    expect(extractInlineScriptHashes(html)).toEqual([sha256(body)]);
    expect(extractInlineScriptHashes(html)).not.toEqual([sha256(body.trim())]);
  });

  it("handles a realistic Next shell fragment", () => {
    const html = [
      '<script async src="/_next/static/chunks/a.js"></script>',
      "<script>(self.__next_f=self.__next_f||[]).push([0])</script>",
      '<script>$RC("B:2","S:2")</script>',
      '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
    ].join("");
    const hashes = extractInlineScriptHashes(html);
    expect(hashes).toHaveLength(2);
    expect(hashes).toContain(sha256("(self.__next_f=self.__next_f||[]).push([0])"));
    expect(hashes).toContain(sha256('$RC("B:2","S:2")'));
  });

  it("handles a script containing a `</script` inside a string without truncating the set", () => {
    const html = '<script>var a = "</script>";</script><script>var b = 2;</script>';
    const hashes = extractInlineScriptHashes(html);
    expect(hashes.length).toBeGreaterThanOrEqual(1);
    expect(hashes).toContain(sha256("var b = 2;"));
  });

  it("returns an empty array for HTML with no scripts", () => {
    expect(extractInlineScriptHashes("<html><body><p>Hi</p></body></html>")).toEqual([]);
  });

  it("is stateless across calls, even after a failed match", () => {
    // A module-level regex with the `g` flag carries `lastIndex` between calls.
    const first = extractInlineScriptHashes("<script>var a = 1;</script>");
    const second = extractInlineScriptHashes("<script>var a = 1;</script>");
    expect(first).toEqual(second);
  });

  it("emits digests in the base64 form a CSP hash source needs", () => {
    for (const hash of extractInlineScriptHashes("<script>var a = 1;</script>")) {
      expect(hash).toMatch(/^sha256-[A-Za-z0-9+/]{43}=$/);
    }
  });
});

describe("commonInlineScriptHashes", () => {
  it("returns the digests every document shares", () => {
    const shared = "<script>$RV();</script>";
    const documents = [
      `${shared}<script>var a = 1;</script>`,
      `${shared}<script>var b = 2;</script>`,
    ];
    expect(commonInlineScriptHashes(documents)).toEqual([sha256("$RV();")]);
  });

  it("returns nothing for no documents, rather than acting as a wildcard", () => {
    expect(commonInlineScriptHashes([])).toEqual([]);
  });

  it("returns nothing when the documents share no script", () => {
    expect(
      commonInlineScriptHashes(["<script>var a = 1;</script>", "<script>var b = 2;</script>"]),
    ).toEqual([]);
  });

  it("returns the whole set for a single document", () => {
    const html = "<script>var a = 1;</script><script>var b = 2;</script>";
    expect(commonInlineScriptHashes([html]).sort()).toEqual(
      [sha256("var a = 1;"), sha256("var b = 2;")].sort(),
    );
  });
});

describe("shellFileForPathname", () => {
  it("maps the root to index.html", () => {
    expect(shellFileForPathname("/")).toContain("index.html");
  });

  it("maps a nested route to its .html file", () => {
    expect(shellFileForPathname("/guides/tickets")).toContain(join("guides", "tickets.html"));
  });

  it("strips a trailing slash", () => {
    expect(shellFileForPathname("/guides/")).toBe(shellFileForPathname("/guides"));
  });

  it("strips repeated trailing slashes, which must not produce an empty segment", () => {
    expect(shellFileForPathname("/guides///")).toBe(shellFileForPathname("/guides"));
  });

  it("rejects a path that is not rooted", () => {
    expect(shellFileForPathname("guides")).toBeNull();
  });

  it("rejects an encoded traversal", () => {
    // `%2e%2e` is not in the allowed alphabet, so it never reaches `join`.
    expect(shellFileForPathname("/%2e%2e/%2e%2e/etc/passwd")).toBeNull();
  });

  it("rejects a traversal with real dots", () => {
    expect(shellFileForPathname("/../../etc/passwd")).toBeNull();
    expect(shellFileForPathname("/guides/../../secret")).toBeNull();
  });

  it("rejects a backslash, which Windows would read as a separator", () => {
    expect(shellFileForPathname("/..\\..\\windows\\win.ini")).toBeNull();
  });

  it("rejects a null byte", () => {
    expect(shellFileForPathname("/index.html\u0000.txt")).toBeNull();
  });

  it("rejects an absolute Windows path", () => {
    expect(shellFileForPathname("/C:/windows/win.ini")).toBeNull();
  });

  it("resolves inside the prerender directory", () => {
    const file = shellFileForPathname("/about");
    expect(file).not.toBeNull();
    expect(file?.replace(/\\/g, "/")).toContain(".next/server/app/about.html");
  });

  it("accepts an explicit root and keeps the result inside it", () => {
    const file = shellFileForPathname("/guides/tickets", "/srv/output");
    expect(file).toBe(resolve("/srv/output/guides/tickets.html"));
    expect(file?.endsWith(`guides${sep}tickets.html`)).toBe(true);
  });

  it("uses the documented environment variable name", () => {
    expect(PRERENDER_DIR_ENV).toBe("PRERENDER_OUTPUT_DIR");
  });
});

describe("isTemplateShell", () => {
  it("recognises a dynamic route template", () => {
    expect(isTemplateShell("guides/[edition].html")).toBe(true);
    expect(isTemplateShell("guides/[edition]/[chapter].html")).toBe(true);
  });

  it("does not mistake a concrete shell for a template", () => {
    expect(isTemplateShell("guides/belgium.html")).toBe(false);
    expect(isTemplateShell("index.html")).toBe(false);
  });
});

describe("getInlineScriptHashes: prerender output", () => {
  let workDir: string;
  let root: string;

  beforeEach(() => {
    // A temporary directory stands in for the build output. Changing the process
    // working directory is not an option: Vitest runs tests in worker threads,
    // where `process.chdir` throws.
    workDir = mkdtempSync(join(tmpdir(), "csp-hashes-"));
    root = join(workDir, PRERENDER_DIR);
    mkdirSync(root, { recursive: true });
    clearHashCache();
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    clearHashCache();
  });

  it("reads the shell for the path and returns its inline hashes", () => {
    writeFileSync(join(root, "about.html"), '<script src="/x.js"></script><script>var a = 1;</script>', "utf8");
    expect(getInlineScriptHashes("/about", root)).toEqual([sha256("var a = 1;")]);
  });

  it("returns an empty array rather than throwing when the directory is absent", () => {
    rmSync(root, { recursive: true, force: true });
    expect(() => getInlineScriptHashes("/about", root)).not.toThrow();
    expect(getInlineScriptHashes("/about", root)).toEqual([]);
    expect(isPrerenderOutputAvailable(root)).toBe(false);
  });

  it("caches per path, so the file is read once", () => {
    writeFileSync(join(root, "about.html"), shell("var a = 1;"), "utf8");
    const first = getInlineScriptHashes("/about", root);

    // Change the file: a cached answer must not notice, which is correct because
    // the build output is immutable while a server runs.
    writeFileSync(join(root, "about.html"), shell("var b = 2;"), "utf8");
    const second = getInlineScriptHashes("/about", root);

    expect(second).toEqual(first);
    expect(second).not.toContain(sha256("var b = 2;"));
  });

  it("clears its cache on request, for tests", () => {
    writeFileSync(join(root, "about.html"), shell("var a = 1;"), "utf8");
    getInlineScriptHashes("/about", root);
    writeFileSync(join(root, "about.html"), shell("var b = 2;"), "utf8");
    clearHashCache();
    expect(getInlineScriptHashes("/about", root)).toEqual([sha256("var b = 2;")]);
  });

  it("does not confuse two routes", () => {
    mkdirSync(join(root, "guides"), { recursive: true });
    writeFileSync(join(root, "index.html"), shell("var home = 1;"), "utf8");
    writeFileSync(join(root, "guides", "tickets.html"), shell("var tickets = 1;"), "utf8");

    expect(getInlineScriptHashes("/", root)).toEqual([sha256("var home = 1;")]);
    expect(getInlineScriptHashes("/guides/tickets", root)).toEqual([sha256("var tickets = 1;")]);
  });

  it("returns an empty array for an unsafe path without touching the filesystem", () => {
    expect(getInlineScriptHashes("/../../etc/passwd", root)).toEqual([]);
  });

  it("is tolerant of an unreadable file", () => {
    mkdirSync(join(root, "broken.html"), { recursive: true });
    // A directory where a file is expected: the read throws.
    expect(() => getInlineScriptHashes("/broken", root)).not.toThrow();
    expect(getInlineScriptHashes("/broken", root)).toEqual([]);
  });

  it("honours PRERENDER_OUTPUT_DIR as the root", () => {
    writeFileSync(join(root, "about.html"), shell("var a = 1;"), "utf8");
    expect(prerenderRoot({ PRERENDER_OUTPUT_DIR: root })).toBe(resolve(root));
    expect(getInlineScriptHashes("/about", prerenderRoot({ PRERENDER_OUTPUT_DIR: root }))).toEqual([
      sha256("var a = 1;"),
    ]);
  });

  it("gives a shell-less path the bootstrap set, which is what a notFound() page needs", () => {
    /*
      The measured production case: `/guides/belgium/nope` answers 200 with 14
      inline scripts, of which the three bootstrap scripts carry no nonce. The
      templates under `guides/` hold exactly those three.
    */
    const bootstrap = "<script>$RT();</script><script>$RV();</script>";
    mkdirSync(join(root, "guides"), { recursive: true });
    mkdirSync(join(root, "guides", "[edition]"), { recursive: true });
    writeFileSync(join(root, "guides", "[edition].html"), bootstrap, "utf8");
    writeFileSync(join(root, "guides", "[edition]", "[chapter].html"), bootstrap, "utf8");

    const hashes = getInlineScriptHashes("/guides/belgium/nope", root);
    expect(hashes).toContain(sha256("$RT();"));
    expect(hashes).toContain(sha256("$RV();"));
  });

  it("includes the not-found document's digests in that set", () => {
    mkdirSync(join(root, "guides"), { recursive: true });
    writeFileSync(join(root, "guides", "[edition].html"), shell("$RT();"), "utf8");
    writeFileSync(join(root, NOT_FOUND_SHELL), shell("notFoundBootstrap();"), "utf8");

    expect(getInlineScriptHashes("/no-such-page", root)).toContain(sha256("notFoundBootstrap();"));
  });

  it("falls back to index.html when the build has no dynamic templates", () => {
    writeFileSync(join(root, "index.html"), shell("var home = 1;"), "utf8");
    // No templates exist, so the bootstrap set comes from the root shell instead
    // of collapsing to nothing.
    expect(getInlineScriptHashes("/no-such-page", root)).toContain(sha256("var home = 1;"));
  });
});

describe("prerenderRoot", () => {
  it("defaults to .next/server/app relative to the working directory", () => {
    expect(prerenderRoot({})).toBe(resolve(PRERENDER_DIR));
  });

  it("uses the configured override", () => {
    expect(prerenderRoot({ PRERENDER_OUTPUT_DIR: "/tmp/out" })).toBe(resolve("/tmp/out"));
  });

  it("ignores a blank override rather than resolving to the working directory", () => {
    expect(prerenderRoot({ PRERENDER_OUTPUT_DIR: "   " })).toBe(resolve(PRERENDER_DIR));
  });
});

describe("isPrerenderOutputAvailable", () => {
  it("is true for a directory that exists and false for one that does not", () => {
    const dir = mkdtempSync(join(tmpdir(), "csp-avail-"));
    try {
      expect(isPrerenderOutputAvailable(dir)).toBe(true);
      expect(isPrerenderOutputAvailable(join(dir, "missing"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * The manifest fallback.
 *
 * These tests load `csp-hashes.ts` afresh with a generated manifest mocked in, so
 * the fallback can be exercised without building the application. That is the only
 * way to test it: the committed manifest is empty, and a test that depended on a
 * real build would pass or fail according to whether someone had run one.
 *
 * The mocked module must supply every export `csp-hashes.ts` imports, or the fresh
 * load throws at import time.
 */
describe("getInlineScriptHashes: manifest fallback", () => {
  let workDir: string;
  let emptyRoot: string;

  const SHARED = [sha256("$RT();"), sha256("$RV();")];
  const NOT_FOUND = [sha256("notFoundBootstrap();")];

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "csp-manifest-"));
    // A root that exists but holds no shells: the state Vercel is in, where the
    // proxy function has no build output beside it.
    emptyRoot = join(workDir, PRERENDER_DIR);
    mkdirSync(emptyRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    vi.doUnmock("./csp-hash-manifest.generated");
    vi.resetModules();
  });

  /** Loads a fresh `csp-hashes` module with the given manifest in place. */
  async function withManifest(
    manifest: Record<string, readonly string[]>,
  ): Promise<typeof import("./csp-hashes")> {
    vi.resetModules();
    vi.doMock("./csp-hash-manifest.generated", () => ({
      CSP_HASH_MANIFEST: manifest,
      CSP_SHARED_HASHES: SHARED,
      CSP_NOT_FOUND_HASHES: NOT_FOUND,
      CSP_MANIFEST_GENERATED: true,
      CSP_MANIFEST_SHELL_COUNT: Object.keys(manifest).length,
      CSP_MANIFEST_SITE_URL: "",
      CSP_MANIFEST_GENERATED_AT: "2026-06-01T00:00:00.000Z",
    }));
    return import("./csp-hashes");
  }

  it("uses the manifest entry when the route has no shell on disk", async () => {
    const perRoute = [sha256("routeSpecific();")];
    const module = await withManifest({ "/about": perRoute });
    expect(module.getInlineScriptHashes("/about", emptyRoot)).toEqual(perRoute);
  });

  it("uses the manifest on a host where the output directory does not exist at all", async () => {
    // The Vercel case, stated plainly: no `.next/server/app` beside the function.
    rmSync(emptyRoot, { recursive: true, force: true });
    const perRoute = [sha256("routeSpecific();")];
    const module = await withManifest({ "/": perRoute });
    expect(module.getInlineScriptHashes("/", emptyRoot)).toEqual(perRoute);
  });

  it("returns the shared bootstrap set for a path the manifest does not list", async () => {
    const module = await withManifest({ "/about": [sha256("about();")] });
    const hashes = module.getInlineScriptHashes("/guides/belgium/nope", emptyRoot);
    expect(hashes).toContain(sha256("$RT();"));
    expect(hashes).toContain(sha256("$RV();"));
    expect(hashes).toContain(sha256("notFoundBootstrap();"));
    expect(hashes).not.toContain(sha256("about();"));
  });

  it("normalises a trailing slash before looking the path up", async () => {
    const perRoute = [sha256("about();")];
    const module = await withManifest({ "/about": perRoute });
    expect(module.getInlineScriptHashes("/about/", emptyRoot)).toEqual(perRoute);
  });

  it("maps the root to its own entry rather than to the shared set", async () => {
    const home = [sha256("home();")];
    const module = await withManifest({ "/": home });
    expect(module.getInlineScriptHashes("/", emptyRoot)).toEqual(home);
  });

  it("counts a generated manifest as available even with no output directory", async () => {
    rmSync(emptyRoot, { recursive: true, force: true });
    const module = await withManifest({ "/": [sha256("home();")] });
    expect(module.isPrerenderOutputAvailable(emptyRoot)).toBe(true);
  });

  it("reports the manifest as the source for a route with no shell", async () => {
    const module = await withManifest({ "/": [sha256("home();")] });
    expect(module.describeHashSource("/about", emptyRoot)).toBe("manifest");
  });

  it("describes its coverage, naming the shell count", async () => {
    const module = await withManifest({ "/": [sha256("home();")] });
    expect(module.describeHashCoverage()).toContain("manifest");
    expect(module.describeHashCoverage()).toContain("1 shells");
  });
});

describe("precedence between the two sources", () => {
  let workDir: string;
  let root: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "csp-precedence-"));
    root = join(workDir, PRERENDER_DIR);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    vi.doUnmock("./csp-hash-manifest.generated");
    vi.resetModules();
  });

  it("prefers the shell on disk over a manifest entry for the same route", async () => {
    /*
      The file on disk is what the browser will actually be served, so it must
      win. This is the assertion that documents the precedence: if someone
      reverses it to make Vercel the primary source, this test fails.
    */
    writeFileSync(join(root, "about.html"), shell("fromDisk();"), "utf8");

    vi.resetModules();
    vi.doMock("./csp-hash-manifest.generated", () => ({
      CSP_HASH_MANIFEST: { "/about": [sha256("fromManifest();")] },
      CSP_SHARED_HASHES: [],
      CSP_NOT_FOUND_HASHES: [],
      CSP_MANIFEST_GENERATED: true,
      CSP_MANIFEST_SHELL_COUNT: 1,
      CSP_MANIFEST_SITE_URL: "",
      CSP_MANIFEST_GENERATED_AT: "2026-06-01T00:00:00.000Z",
    }));
    const module = await import("./csp-hashes");

    const hashes = module.getInlineScriptHashes("/about", root);
    expect(hashes).toEqual([sha256("fromDisk();")]);
    expect(hashes).not.toContain(sha256("fromManifest();"));
    expect(module.describeHashSource("/about", root)).toBe("prerender-output");
  });

  it("falls back per pathname, not per process", async () => {
    // A partial output directory must still get the manifest's answer for the
    // route it is missing, which is why the decision is made per path.
    writeFileSync(join(root, "about.html"), shell("fromDisk();"), "utf8");

    vi.resetModules();
    vi.doMock("./csp-hash-manifest.generated", () => ({
      CSP_HASH_MANIFEST: { "/tools/budget": [sha256("fromManifest();")] },
      CSP_SHARED_HASHES: [],
      CSP_NOT_FOUND_HASHES: [],
      CSP_MANIFEST_GENERATED: true,
      CSP_MANIFEST_SHELL_COUNT: 1,
      CSP_MANIFEST_SITE_URL: "",
      CSP_MANIFEST_GENERATED_AT: "2026-06-01T00:00:00.000Z",
    }));
    const module = await import("./csp-hashes");

    expect(module.getInlineScriptHashes("/about", root)).toEqual([sha256("fromDisk();")]);
    expect(module.getInlineScriptHashes("/tools/budget", root)).toEqual([sha256("fromManifest();")]);
  });

  it("reports 'none' only when neither source has anything", async () => {
    vi.resetModules();
    vi.doMock("./csp-hash-manifest.generated", () => ({
      CSP_HASH_MANIFEST: {},
      CSP_SHARED_HASHES: [],
      CSP_NOT_FOUND_HASHES: [],
      CSP_MANIFEST_GENERATED: false,
      CSP_MANIFEST_SHELL_COUNT: 0,
      CSP_MANIFEST_SITE_URL: "",
      CSP_MANIFEST_GENERATED_AT: "",
    }));
    const module = await import("./csp-hashes");
    expect(module.describeHashSource("/about", root)).toBe("none");
  });
});

/**
 * The origin guard.
 *
 * The prerendered flight payloads embed absolute URLs built from
 * `NEXT_PUBLIC_SITE_URL`, so the inline scripts — and their digests — depend on it.
 * Measured on this project, changing the origin altered 47 of 60 shells. A manifest
 * generated for one origin would therefore match nothing on another, and the failure
 * is silent: the page is served, the policy is sent, and the browser refuses every
 * script without reporting anything to the server. These tests exist so that case
 * degrades to "no manifest" rather than to a dead page.
 */
describe("manifest origin guard", () => {
  let workDir: string;
  let emptyRoot: string;

  const MANIFEST_FOR_PRODUCTION = {
    CSP_HASH_MANIFEST: { "/": [] as readonly string[] },
    CSP_SHARED_HASHES: [] as readonly string[],
    CSP_NOT_FOUND_HASHES: [] as readonly string[],
    CSP_MANIFEST_GENERATED: true,
    CSP_MANIFEST_SHELL_COUNT: 1,
    CSP_MANIFEST_SITE_URL: "https://www.tmlguide.com",
    CSP_MANIFEST_GENERATED_AT: "2026-06-01T00:00:00.000Z",
  };

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "csp-origin-"));
    emptyRoot = join(workDir, PRERENDER_DIR);
    mkdirSync(emptyRoot, { recursive: true });
    vi.resetModules();
    vi.doMock("./csp-hash-manifest.generated", () => MANIFEST_FOR_PRODUCTION);
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.doUnmock("./csp-hash-manifest.generated");
    vi.resetModules();
  });

  it("uses the manifest when the deployment serves the origin it was built for", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.tmlguide.com");
    const module = await import("./csp-hashes");
    expect(module.describeHashSource("/anything", emptyRoot)).toBe("manifest");
    expect(module.isPrerenderOutputAvailable(emptyRoot)).toBe(true);
  });

  it("refuses the manifest when the deployment serves a different origin", async () => {
    // The dangerous case: a manifest built for production deployed to a preview,
    // or the reverse. Its digests cannot match, so using it would only mislead.
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.example");
    const module = await import("./csp-hashes");
    expect(module.describeHashSource("/anything", emptyRoot)).toBe("none");
    // The empty output directory counts for nothing; only the refused manifest did.
    expect(module.isPrerenderOutputAvailable(join(emptyRoot, "absent"))).toBe(false);
  });

  it("says why the manifest was refused, naming both origins", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.example");
    const module = await import("./csp-hashes");
    const coverage = module.describeHashCoverage();
    expect(coverage).toContain("https://www.tmlguide.com");
    expect(coverage).toContain("https://preview.example");
  });

  it("still prefers the build output when the origin differs, because it is exact", async () => {
    writeFileSync(join(emptyRoot, "about.html"), shell("fromDisk();"), "utf8");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.example");
    const module = await import("./csp-hashes");
    expect(module.getInlineScriptHashes("/about", emptyRoot)).toEqual([sha256("fromDisk();")]);
    expect(module.describeHashSource("/about", emptyRoot)).toBe("prerender-output");
  });

  it("treats an unset deployment origin as a mismatch unless the manifest had none", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const module = await import("./csp-hashes");
    // The manifest was built for production, so it is not usable with no origin set.
    expect(module.describeHashSource("/anything", emptyRoot)).toBe("none");
  });
});

/**
 * The committed manifest, as it will actually ship.
 *
 * These assertions are about the file rather than the module, so they hold whether
 * it is the empty default or a generated one.
 */
describe("the committed manifest", () => {
  const source = readFileSync(
    join(import.meta.dirname, "csp-hash-manifest.generated.ts"),
    "utf8",
  );

  it("only ever contains well-formed sha256 source values", () => {
    const values = [...source.matchAll(/"(sha256-[^"]*)"/g)].map((match) => match[1] ?? "");
    for (const value of values) {
      expect(value, value).toMatch(/^sha256-[A-Za-z0-9+/]{43}=$/);
    }
  });

  it("declares a manifest keyed by rooted pathnames", () => {
    for (const key of [...source.matchAll(/^\s{2}"(\/[^"]*)": \[/gm)].map((match) => match[1] ?? "")) {
      // Every key is rooted, and only the home page may end in a slash.
      expect(key, key).toMatch(/^\//);
      if (key !== "/") expect(key, key).not.toMatch(/\/$/);
    }
  });

  it("is empty or generated, never a half-written mixture", () => {
    /*
      A hand-edited file is the one state that would be dangerous: some pathnames
      covered, others not, and nothing recording which. The two flags are written
      together by the generator, so they must agree.
    */
    const generated = /CSP_MANIFEST_GENERATED = true/.test(source);
    const declaredEmpty = /CSP_HASH_MANIFEST: CspHashManifest = \{\};/.test(source);
    if (generated) {
      expect(source).toContain("CSP_MANIFEST_SHELL_COUNT = ");
      expect(declaredEmpty).toBe(false);
    } else {
      expect(declaredEmpty).toBe(true);
      expect(source).toContain("CSP_MANIFEST_SHELL_COUNT = 0");
    }
  });
});
