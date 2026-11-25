/**
 * The canonical origin every absolute URL on the site is built from.
 *
 * Canonical tags, Open Graph URLs, JSON-LD and the sitemap must all agree on
 * one origin, or a crawler sees the same page published under several
 * addresses. They therefore read it from here rather than each repeating the
 * `process.env` lookup.
 *
 * `NEXT_PUBLIC_SITE_URL` is the configured value. It is validated rather than
 * trusted: a malformed value would otherwise put a broken canonical on every
 * page, which is worse than failing the build. In production an unusable value
 * throws; anywhere else it falls back to the development origin and warns, so a
 * missing `.env.local` does not stop local work.
 */

/** The origin used when `NEXT_PUBLIC_SITE_URL` is absent outside production. */
export const SITE_URL_FALLBACK = "http://localhost:3000";

export interface SiteEnv {
  readonly NEXT_PUBLIC_SITE_URL?: string | undefined;
  readonly NODE_ENV?: string | undefined;
}

/** Hosts for which plain http is legitimate: loopback, for local development. */
const LOOPBACK_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Reduces a configured value to an origin.
 *
 * Returns null when the value is not an absolute http(s) URL, when it is https
 * with a path (an origin is what is wanted, not a page), or when it is plain
 * http on a host that is not loopback: a public site served over http would
 * publish insecure canonicals.
 */
function toOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.protocol === "http:" && !LOOPBACK_HOSTS.includes(url.hostname.toLowerCase())) return null;

  // Credentials, query and fragment are already impossible on an origin; a
  // path is dropped deliberately rather than producing `https://x/path/about`.
  return url.origin;
}

/**
 * The site's canonical origin, with no trailing slash.
 *
 * A missing or unusable `NEXT_PUBLIC_SITE_URL` is reported with
 * `console.error`, which lands in the build log, and the development origin is
 * used so the build still completes. It is deliberately not fatal: a build that
 * refuses to run would also stop an unrelated change from being verified, and
 * the failure it guards against — the wrong origin in a canonical tag — is
 * caught by the pre-launch check in `docs/hardening/seo-and-perf-audit.md`
 * rather than by a stack trace at the wrong moment.
 *
 * @param env - the environment to read; defaults to `process.env`.
 */
export function siteOrigin(env: SiteEnv = process.env as SiteEnv): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  const isProduction = env.NODE_ENV === "production";

  if (configured === "") {
    if (isProduction) {
      reportMisconfiguration("NEXT_PUBLIC_SITE_URL is not set");
    }
    return SITE_URL_FALLBACK;
  }

  const origin = toOrigin(configured);
  if (origin === null) {
    if (isProduction) {
      reportMisconfiguration(
        `NEXT_PUBLIC_SITE_URL ${JSON.stringify(configured)} is not an absolute https:// origin`,
      );
    }
    return SITE_URL_FALLBACK;
  }

  return origin;
}

/**
 * Records a misconfigured origin once per process.
 *
 * The sitemap, robots and every metadata route read this module, so an
 * unguarded message would appear a dozen times in one build log and be skimmed
 * as noise. One line, naming the variable, is what an operator acts on.
 */
let reported = false;

function reportMisconfiguration(reason: string): void {
  if (reported) return;
  reported = true;
  console.error(
    `[seo] ${reason}. Canonical URLs, Open Graph URLs, the sitemap and robots.txt will use ${SITE_URL_FALLBACK}, which must not ship. Set it before deploying.`,
  );
}

/**
 * Resolves a site path to an absolute URL.
 *
 * The path is always treated as rooted: `"about"` and `"/about"` both produce
 * `<origin>/about`, so a caller cannot accidentally publish
 * `<origin>/guides/about` by omitting the leading slash.
 */
export function absoluteUrl(path: string, origin: string = siteOrigin()): string {
  const base = origin.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
