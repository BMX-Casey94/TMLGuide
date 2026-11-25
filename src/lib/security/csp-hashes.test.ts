/**
 * Tests for the prerendered-shell hash extraction and the proxy.
 *
 * The hash module is what lets a strict nonce policy coexist with
 * `cacheComponents`. If it silently returns the wrong digests, every prerendered
 * page stops hydrating, so its path handling and its hashing rules are pinned
 * here rather than being discovered in production.
 */

// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearHashCache,
  extractInlineScriptHashes,
  getInlineScriptHashes,
  isPrerenderOutputAvailable,
  PRERENDER_DIR,
  PRERENDER_DIR_ENV,
  prerenderRoot,
  shellFileForPathname,
} from "./csp-hashes";

function sha256(text: string): string {
  return `sha256-${createHash("sha256").update(text, "utf8").digest("base64")}`;
}

afterEach(() => {
  clearHashCache();
});

describe("extractInlineScriptHashes", () => {
  it("hashes an inline script over its exact text", () => {
    const html = "<script>var a = 1;</script>";
    expect(extractInlineScriptHashes(html)).toEqual([sha256("var a = 1;")]);
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
    const html = '<script  TYPE = "Application/LD+JSON" >{"a":1}</script>';
    expect(extractInlineScriptHashes(html)).toEqual([]);
  });

  it("ignores an empty script element, whose hash would match nothing useful", () => {
    expect(extractInlineScriptHashes("<script></script>")).toEqual([]);
  });

  it("deduplicates identical scripts", () => {
    const html = "<script>var a = 1;</script><script>var a = 1;</script>";
    expect(extractInlineScriptHashes(html)).toHaveLength(1);
  });

  it("returns each distinct script once", () => {
    const html = "<script>var a = 1;</script><script>var b = 2;</script>";
    const hashes = extractInlineScriptHashes(html);
    expect(hashes).toHaveLength(2);
    expect(hashes).toContain(sha256("var a = 1;"));
    expect(hashes).toContain(sha256("var b = 2;"));
  });

  it("hashes the text verbatim, preserving whitespace and newlines", () => {
    // The browser hashes the element's text content as-is, so trimming would
    // produce a digest that never matches and the page would not hydrate.
    const body = "\n  self.__next_f.push([1,\"a\"]);\n";
    const html = `<script>${body}</script>`;
    expect(extractInlineScriptHashes(html)).toEqual([sha256(body)]);
    expect(extractInlineScriptHashes(html)).not.toEqual([sha256(body.trim())]);
  });

  it("handles a realistic Next shell fragment", () => {
    const html = [
      '<script async src="/_next/static/chunks/a.js"></script>',
      '<script>(self.__next_f=self.__next_f||[]).push([0])</script>',
      '<script>$RC("B:2","S:2")</script>',
      '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
    ].join("");
    const hashes = extractInlineScriptHashes(html);
    expect(hashes).toHaveLength(2);
    expect(hashes).toContain(sha256("(self.__next_f=self.__next_f||[]).push([0])"));
    expect(hashes).toContain(sha256('$RC("B:2","S:2")'));
  });

  it("handles a script containing a `</script` inside a string without truncating the set", () => {
    // Not a supported HTML construct, but the extraction must not crash or hang.
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
    // Compared through `resolve` so the assertion is about containment rather
    // than the platform's path prefix.
    expect(file).toBe(resolve("/srv/output/guides/tickets.html"));
    expect(file?.endsWith(`guides${sep}tickets.html`)).toBe(true);
  });

  it("uses the documented environment variable name", () => {
    expect(PRERENDER_DIR_ENV).toBe("PRERENDER_OUTPUT_DIR");
  });
});

describe("getInlineScriptHashes", () => {
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
    writeFileSync(
      join(root, "about.html"),
      '<script src="/x.js"></script><script>var a = 1;</script>',
      "utf8",
    );
    expect(getInlineScriptHashes("/about", root)).toEqual([sha256("var a = 1;")]);
  });

  it("returns an empty array for a route with no prerendered shell", () => {
    // A dynamically rendered route has no shell: every script gets the nonce.
    expect(getInlineScriptHashes("/api/contact", root)).toEqual([]);
    expect(getInlineScriptHashes("/not-prerendered", root)).toEqual([]);
  });

  it("returns an empty array rather than throwing when the directory is absent", () => {
    rmSync(root, { recursive: true, force: true });
    expect(() => getInlineScriptHashes("/about", root)).not.toThrow();
    expect(getInlineScriptHashes("/about", root)).toEqual([]);
    expect(isPrerenderOutputAvailable(root)).toBe(false);
  });

  it("caches per path, so the file is read once", () => {
    writeFileSync(join(root, "about.html"), "<script>var a = 1;</script>", "utf8");
    const first = getInlineScriptHashes("/about", root);

    // Change the file: a cached answer must not notice, which is correct because
    // the build output is immutable while a server runs.
    writeFileSync(join(root, "about.html"), "<script>var b = 2;</script>", "utf8");
    const second = getInlineScriptHashes("/about", root);

    expect(second).toEqual(first);
    expect(second).not.toContain(sha256("var b = 2;"));
  });

  it("clears its cache on request, for tests", () => {
    writeFileSync(join(root, "about.html"), "<script>var a = 1;</script>", "utf8");
    getInlineScriptHashes("/about", root);
    writeFileSync(join(root, "about.html"), "<script>var b = 2;</script>", "utf8");
    clearHashCache();
    expect(getInlineScriptHashes("/about", root)).toEqual([sha256("var b = 2;")]);
  });

  it("does not confuse two routes", () => {
    mkdirSync(join(root, "guides"), { recursive: true });
    writeFileSync(join(root, "index.html"), "<script>var home = 1;</script>", "utf8");
    writeFileSync(join(root, "guides", "tickets.html"), "<script>var tickets = 1;</script>", "utf8");

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
    writeFileSync(join(root, "about.html"), "<script>var a = 1;</script>", "utf8");
    expect(prerenderRoot({ PRERENDER_OUTPUT_DIR: root })).toBe(resolve(root));
    expect(getInlineScriptHashes("/about", prerenderRoot({ PRERENDER_OUTPUT_DIR: root }))).toEqual([
      sha256("var a = 1;"),
    ]);
  });
});

describe("prerenderRoot", () => {
  it("defaults to .next/server/app relative to the working directory", () => {
    expect(prerenderRoot({})).toBe(resolve(PRERENDER_DIR));
  });

  it("uses the configured override", () => {
    expect(prerenderRoot({ PRERENDER_OUTPUT_DIR: "/tmp/out" })).toBe(
      resolve("/tmp/out"),
    );
  });

  it("ignores a blank override rather than resolving to the working directory", () => {
    expect(prerenderRoot({ PRERENDER_OUTPUT_DIR: "   " })).toBe(
      resolve(PRERENDER_DIR),
    );
  });
});

describe("isPrerenderOutputAvailable", () => {
  it("reports whether the output directory exists", () => {
    expect(typeof isPrerenderOutputAvailable()).toBe("boolean");
  });

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
