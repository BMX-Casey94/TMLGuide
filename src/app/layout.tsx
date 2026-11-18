import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
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
    default: "TMLGUIDE: independent Tomorrowland guide",
    template: "%s | TMLGUIDE",
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
    <html
      lang="en-GB"
      className={`${fraunces.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <body data-ed="belgium" className="min-h-dvh">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="ambient-glow" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
