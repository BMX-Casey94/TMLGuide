import type { Metadata } from "next";
import Link from "next/link";
import { RetryButton } from "@/components/pwa/retry-button";
import { GoldDivider } from "@/components/ui/gold-divider";
import "./offline.css";

export const metadata: Metadata = {
  title: "Offline",
  description:
    "You are currently offline. Browse cached TMLGuide pages and planning tools until your connection returns.",
  robots: { index: false, follow: false },
};

const OFFLINE_DESTINATIONS = [
  {
    href: "/",
    name: "Home",
    description: "Festival overview, editions and quick-start planning links.",
  },
  {
    href: "/guides",
    name: "Festival guides",
    description: "Core guides to Tomorrowland Belgium, Winter and Brasil.",
  },
  {
    href: "/guides/tickets",
    name: "Tickets and packages",
    description: "Published ticket prices, sale dates and package inclusions.",
  },
  {
    href: "/tools",
    name: "Planning tools",
    description: "Budget calculator, Pearl converter and sale timeline.",
  },
] as const;

export default function OfflinePage() {
  return (
    <main id="main" className="tml-offline-page">
      <section className="tml-offline-card" aria-labelledby="offline-title">
        <p className="label text-accent">Offline mode</p>
        <h1 id="offline-title" className="tml-offline-title">
          You are currently offline
        </h1>
        <p className="tml-offline-lede">
          Your device has lost its internet connection, so this page could not be loaded from the
          network. Core guides and any pages you have already visited remain available from your
          offline guide bundle.
        </p>

        <div className="tml-offline-actions">
          <RetryButton className="tml-offline-retry" />
        </div>

        <GoldDivider butterfly="right" />

        <div className="tml-offline-section">
          <h2 className="tml-offline-section__title">Available offline</h2>
          <p className="tml-offline-section__note">
            Live radio streams and uncached pages require a connection, but these cached sections
            can be opened while offline:
          </p>
          <ul className="tml-offline-list">
            {OFFLINE_DESTINATIONS.map((destination) => (
              <li key={destination.href}>
                <Link href={destination.href} className="tml-offline-link">
                  <span className="tml-offline-link__name">{destination.name}</span>
                  <span className="tml-offline-link__desc">{destination.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
