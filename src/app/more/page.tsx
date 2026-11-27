import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { socialMetadata } from "@/lib/seo/social";
import "./more.css";

const TITLE = "More";
const DESCRIPTION =
  "The pages that sit outside the main tabs: Ask the guide, One World Radio, About this guide and the accessibility statement.";
const PATH = "/more";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  ...socialMetadata({ path: PATH, title: TITLE, description: DESCRIPTION }),
};

interface MoreEntry {
  readonly href: string;
  readonly kicker: string;
  readonly title: string;
  readonly description: string;
  readonly icon: Icon3DName;
}

/**
 * What the More tab holds.
 *
 * Every entry is a page that exists. Contact, Privacy, Terms and Cookies are
 * deliberately absent: none of them is published, and a link to a page that does
 * not exist is worse than a short list that is honest about its size.
 *
 * Each description restates that page's own metadata rather than describing a
 * plan, so nothing here promises more than the page it points at.
 */
const ENTRIES: readonly MoreEntry[] = [
  {
    href: "/ask",
    kicker: "Questions",
    title: "Ask the guide",
    description:
      "Ask about tickets, DreamVille, sale dates, Winter or Brasil. Answers come only from this guide's verified, dated records, and each one shows the official page behind it.",
    icon: "puzzle",
  },
  {
    href: "/radio",
    kicker: "Listen",
    title: "One World Radio",
    description:
      "How to listen to Tomorrowland's own station: the official stream, the apps and services that carry it, and which countries have DAB+, FM or syndicated coverage.",
    icon: "headphone",
  },
  {
    href: "/about",
    kicker: "About",
    title: "About this guide",
    description:
      "Who runs TMLGuide, how each fact is checked against Tomorrowland's own pages, how errors are corrected, and the official sites every figure comes from.",
    icon: "file-text",
  },
  {
    href: "/accessibility",
    kicker: "Access",
    title: "Accessibility",
    description:
      "Display settings for text size, contrast and reduced motion, keyboard navigation, and what has been checked so far.",
    icon: "shield",
  },
];

/**
 * The More page.
 *
 * A Server Component: the page is a static list of links, so it prerenders and
 * costs the browser no JavaScript. It is the phone's fifth tab, which is why the
 * list is short and every destination is a live page.
 */
export default function MorePage() {
  return (
    <main id="main" className="more-page">
      <div className="more-page__inner">
        <header className="more-head">
          <p className="label text-accent">More</p>
          <h1 className="more-head__title">Everything else</h1>
          <div className="more-head__intro">
            <p>
              These are the pages that do not need a tab of their own: the question page, the radio,
              and the two statements that explain how the guide is put together.
            </p>
          </div>
        </header>

        <section aria-labelledby="more-pages" className="more-section">
          <h2 id="more-pages" className="more-section__title">
            Pages
          </h2>
          <ul className="more-grid" role="list">
            {ENTRIES.map((entry) => (
              <li key={entry.href} className="more-grid__item">
                <Card
                  href={entry.href}
                  kicker={entry.kicker}
                  title={entry.title}
                  icon={entry.icon}
                  headingLevel={3}
                >
                  {entry.description}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
