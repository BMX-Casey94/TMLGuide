import type { Metadata } from "next";
import { Suspense } from "react";
import { sharedData } from "@/data/shared";
import { GoldDivider } from "@/components/ui/gold-divider";
import { CommunityCta } from "@/components/home/community-cta";
import { EditionCards } from "@/components/home/edition-cards";
import { FaqHighlights } from "@/components/home/faq-highlights";
import { HomeHero } from "@/components/home/home-hero";
import { NextSalePanel, NextSalePanelFallback } from "@/components/home/next-sale-panel";
import { StartHere } from "@/components/home/start-here";
import { TrustStrip } from "@/components/home/trust-strip";
import { formatLongDate } from "@/components/home/format";
import { serialiseJsonLd, websiteJsonLd } from "@/components/home/json-ld";
import { oldestVerifiedOn } from "@/components/home/verified-on";
import "@/components/home/home.css";

const TITLE = "The independent guide to Tomorrowland";
const DESCRIPTION =
  "Tickets, sale dates, DreamVille, travel and budgeting for Tomorrowland Belgium, Winter and Brasil. Every price and date is sourced from an official page and carries the day it was checked.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "TMLGuide",
    title: `${TITLE} | TMLGuide`,
    description: DESCRIPTION,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary",
    title: `${TITLE} | TMLGuide`,
    description: DESCRIPTION,
  },
};

/**
 * The home page.
 *
 * A Server Component, so the whole page is HTML before any JavaScript runs and
 * there is nothing to hydrate except the countdown. The one piece that needs the
 * request's clock is isolated in its own Suspense boundary, which is what lets
 * everything else sit in the static shell.
 *
 * Heading order is deliberate: one `h1` in the hero, then one `h2` per section
 * and `h3` per card or question. No level is skipped, and no section relies on a
 * heading inside an image.
 */
export default function HomePage() {
  const checkedOn = oldestVerifiedOn();
  const checkedOnLabel = formatLongDate(checkedOn);

  return (
    <main id="main" className="home-main">
      <script
        type="application/ld+json"
        // Serialised from an object literal in this file, with `<` escaped, so
        // no external string can close the element early.
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(websiteJsonLd()) }}
      />

      <HomeHero
        editions={sharedData.editions}
        checkedOnLabel={checkedOnLabel}
        saleSlot={
          <Suspense fallback={<NextSalePanelFallback />}>
            <NextSalePanel checkedOn={checkedOn} checkedOnLabel={checkedOnLabel} />
          </Suspense>
        }
      />

      <GoldDivider butterfly="right" />

      <EditionCards editions={sharedData.editions} />

      <GoldDivider butterfly="left" />

      <StartHere />

      <TrustStrip checkedOn={checkedOn} checkedOnLabel={checkedOnLabel} />

      <FaqHighlights />

      <CommunityCta />
    </main>
  );
}
