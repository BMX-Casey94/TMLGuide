import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { A11Y_BOOT_SCRIPT } from "@/components/a11y/boot-script";
import { DEFAULT_A11Y_PREFS } from "@/components/a11y/a11y-prefs";
import { RadioPlayer, RadioProvider } from "@/components/radio";
import { SearchDialog } from "@/components/search";
import { SiteShell } from "@/components/shell";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "TMLGuide — Independent Tomorrowland guide",
    template: "%s | TMLGuide",
  },
  description:
    "An independent, fan-made guide to Tomorrowland: tickets, sale dates, DreamVille, travel, add-ons and Pearls, with every fact sourced and dated.",
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /*
      The `data-a11y-*` attributes below are the defaults, written into the server HTML so the
      document describes itself without JavaScript. The inline script in <head> replaces them with
      the visitor's saved preferences before the first paint, so the DOM React hydrates does not
      match these values — which is exactly the case `suppressHydrationWarning` exists for (see
      node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md). It is set
      on <html> only: nowhere else in the tree has attributes rewritten before hydration, so no
      other element needs it and none has it.
    */
    <html
      lang="en-GB"
      className={`${fraunces.variable} ${instrument.variable} ${jetbrains.variable}`}
      data-a11y-text={DEFAULT_A11Y_PREFS.textSize}
      data-a11y-spacing={DEFAULT_A11Y_PREFS.spacing}
      data-a11y-contrast={DEFAULT_A11Y_PREFS.contrast}
      data-a11y-motion={DEFAULT_A11Y_PREFS.motion}
      data-a11y-links={DEFAULT_A11Y_PREFS.links}
      data-a11y-font={DEFAULT_A11Y_PREFS.font}
      suppressHydrationWarning
    >
      <head>
        {/*
          Reads the saved preferences and publishes them as attributes before the browser paints.
          A plain inline script, not next/script: `beforeInteractive` is injected after the
          document is parsed, which is too late to prevent the flash.

          It is a constant string from ./boot-script with no interpolation, so there is nothing
          here that could be attacker-controlled. When a Content Security Policy with nonces
          arrives, the nonce goes on this element (`<script nonce={nonce}>`); the script's source
          never needs to change, which is why it is kept as a single exported constant.
        */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT_SCRIPT }} />
      </head>
      <body data-ed="belgium" className="min-h-dvh">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="ambient-glow" aria-hidden="true" />
        <RadioProvider>
          <SiteShell>{children}</SiteShell>
          <RadioPlayer />
          <Suspense fallback={null}>
            <SearchDialog />
          </Suspense>
        </RadioProvider>
      </body>
    </html>
  );
}
