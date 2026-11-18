import Image from "next/image";
import Link from "next/link";
import { FOOTER_COLUMNS, FOOTER_LEGAL } from "./nav";
import { TABBAR_TOTAL_HEIGHT_PX } from "./layout-metrics";

/** The independence statement. Rendered verbatim wherever the footer appears. */
export const INDEPENDENCE_DISCLAIMER =
  "TMLGuide is an independent fan guide. It is not affiliated with, endorsed by or sponsored by Tomorrowland or WeAreOne.World B.V. Tomorrowland is a trademark of its respective owner.";

/** The accuracy caveat shown beneath the link columns. */
export const SOURCE_CAVEAT =
  "Information is checked against official sources but can change. Always confirm with the official Tomorrowland website before you book.";

/**
 * Site footer. A Server Component: static markup, links and one image.
 *
 * On phones the fixed tab bar would cover the legal row, so the footer ends with a spacer the exact
 * size of the bar: TABBAR_TOTAL_HEIGHT_PX (content plus hairline border) plus the device inset. The
 * spacer disappears at 900px, where the bar is not rendered at all.
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-hair bg-surface/40">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 pb-10 pt-12 min-[900px]:px-7">
        <div className="flex flex-col gap-10 min-[900px]:flex-row min-[900px]:justify-between">
          <div className="max-w-[46ch]">
            <Link href="/" aria-label="TMLGuide home" className="inline-flex min-h-11 items-center">
              {/* Decorative here: the link already carries the name. */}
              <Image
                src="/brand/logo-640.webp"
                alt=""
                width={1682}
                height={488}
                sizes="160px"
                className="h-auto w-[160px]"
              />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-cream-mute">{INDEPENDENCE_DISCLAIMER}</p>
          </div>

          <nav aria-label="Footer" className="min-[900px]:w-[560px]">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-8 min-[560px]:grid-cols-4">
              {FOOTER_COLUMNS.map((column) => (
                <li key={column.title}>
                  <h2 className="label text-cream-mute">{column.title}</h2>
                  <ul className="mt-2">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="inline-flex min-h-11 items-center text-sm text-cream transition-colors hover:text-accent"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="max-w-[62ch] text-sm text-cream-mute">{SOURCE_CAVEAT}</p>

        <div className="flex flex-col gap-3 border-t border-hair pt-6 min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cream-mute">
            © TMLGuide · Independent fan guide
          </p>
          <ul className="flex flex-wrap items-center gap-x-5">
            {FOOTER_LEGAL.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.14em] text-cream-mute transition-colors hover:text-cream"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/*
        Clears the fixed mobile tab bar; hidden from 900px up. TABBAR_TOTAL_HEIGHT_PX is the bar's
        content plus its hairline border, and the device inset is added because the bar occupies
        that too. Anything less hides the last line of the legal row behind the bar.
      */}
      <div
        aria-hidden="true"
        className="min-[900px]:hidden"
        style={{ height: `calc(${TABBAR_TOTAL_HEIGHT_PX}px + env(safe-area-inset-bottom))` }}
      />
    </footer>
  );
}
