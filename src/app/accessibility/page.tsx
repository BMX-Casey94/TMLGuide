import type { Metadata } from "next";
import Link from "next/link";
import { CORRECTIONS_EMAIL } from "@/components/home/contact";
import "./a11y-page.css";

const TITLE = "Accessibility";
const DESCRIPTION =
  "How TMLGuide is built for accessibility, what has been tested automatically, what has not yet been checked by hand, and how to report a problem.";
const PATH = "/accessibility";

/** The date this statement was last reviewed. Update it whenever any claim below changes. */
const LAST_REVIEWED = "19 November 2026";
const LAST_REVIEWED_ISO = "2026-11-19";

/** The WCAG version this site is aiming at. Not a conformance claim: see the page's own wording. */
const TARGET = "WCAG 2.2 Level AA";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    siteName: "TMLGuide",
    title: `${TITLE} | TMLGuide`,
    description: DESCRIPTION,
    url: PATH,
    locale: "en_GB",
  },
  twitter: {
    card: "summary",
    title: `${TITLE} | TMLGuide`,
    description: DESCRIPTION,
  },
};

/**
 * The accessibility statement.
 *
 * A Server Component: static prose, no state and no data beyond the review date and the contact
 * constant. The point of the page is that it does not overclaim. It names the target, the single
 * automated check that has actually been run, the manual checks that have not been run, the known
 * limitations, and the fact that there is no published contact address yet rather than inventing
 * one. Nothing here says "conforms" or "compliant".
 */
export default function AccessibilityPage() {
  return (
    <main id="main" className="a11y-page-main">
      <header className="a11y-page-header">
        <p className="label text-accent">Accessibility</p>
        <h1 className="a11y-page-header__title">
          What works, what has been checked, and what has not
        </h1>
        <p className="a11y-page-header__lede">
          TMLGuide aims to meet {TARGET}. This page sets out what that means in practice, what has
          been tested so far, and where the site still falls short. It does not claim conformance: an
          automated scan is a floor, not a certificate.
        </p>
      </header>

      <section className="a11y-page-section" aria-labelledby="target-heading">
        <h2 id="target-heading" className="a11y-page-section__title">
          The target
        </h2>
        <div className="a11y-page-prose">
          <p>
            The site is built to {TARGET}, the standard the design direction records as its minimum.
            That covers the usual ground: semantic landmarks and headings, a visible focus ring,
            controls that work from a keyboard, labels on every input, no meaning carried by colour
            alone, motion that respects the reader&apos;s system setting, and text contrast at 4.5:1
            or better.
          </p>
          <p>
            Aiming at a standard is not the same as meeting it. The sections below separate what has
            been measured from what has not.
          </p>
        </div>
      </section>

      <section className="a11y-page-section" aria-labelledby="tested-heading">
        <h2 id="tested-heading" className="a11y-page-section__title">
          What has been tested automatically
        </h2>
        <div className="a11y-page-prose">
          <p>
            Every route on the site is scanned with axe-core, at a desktop viewport and at a phone
            viewport, against the WCAG 2.0, 2.1 and 2.2 Level A and AA rule sets. The scan runs as
            part of the build and currently reports no violations on any route.
          </p>
          <ul className="a11y-page-list">
            <li>
              <strong>What that catches:</strong> missing alternative text, form fields with no
              label, heading levels that skip, insufficient colour contrast on solid backgrounds,
              duplicate ids, and landmarks that are missing or misused.
            </li>
            <li>
              <strong>What that does not catch:</strong> whether the reading order makes sense,
              whether an announcement is useful, whether a control is reachable in practice, or
              whether a screen reader reads something in a way a sighted reader would recognise.
              Automated tools find roughly a third of real accessibility problems.
            </li>
          </ul>
          <p className="a11y-page-note">
            A clean scan means the floor is met. It is not evidence that the site is usable with
            assistive technology, and it is not a conformance claim.
          </p>
        </div>
      </section>

      <section className="a11y-page-section" aria-labelledby="manual-heading">
        <h2 id="manual-heading" className="a11y-page-section__title">
          What has not yet been tested by hand
        </h2>
        <div className="a11y-page-prose">
          <p>
            The following checks are known to be outstanding. They are listed here so that nobody
            reads a passing scan as a complete audit.
          </p>
          <ul className="a11y-page-list">
            <li>
              <strong>Screen reader testing.</strong> No page has yet been read through with NVDA,
              JAWS, VoiceOver or TalkBack. How the landmarks, the live regions and the accessibility
              panel are announced is therefore unverified.
            </li>
            <li>
              <strong>A full keyboard audit.</strong> The panel, the search dialog and the radio
              player are built for keyboard use and have unit tests for focus order, but the whole
              site has not been walked end to end with the keyboard alone.
            </li>
            <li>
              <strong>A review at 200 percent zoom and at 400 percent reflow.</strong> Layouts are
              written to reflow rather than scroll sideways, but that has not been checked page by
              page at those zoom levels.
            </li>
            <li>
              <strong>Contrast over imagery and gradients.</strong> The measured contrast figures
              cover solid surfaces. Text that sits over the ambient glow or over a gradient has not
              been measured at every scroll position.
            </li>
            <li>
              <strong>Touch target sizes on a real device.</strong> Controls are built at 44 by 44
              CSS pixels or larger, but that has not been verified on physical hardware, where
              spacing and reach matter as much as the box.
            </li>
          </ul>
        </div>
      </section>

      <section className="a11y-page-section" aria-labelledby="toolbar-heading">
        <h2 id="toolbar-heading" className="a11y-page-section__title">
          Changing how the site looks
        </h2>
        <div className="a11y-page-prose">
          <p>
            A display toolbar lets you adjust the site without changing anything in your browser or
            your operating system. Its button is labelled{" "}
            <strong>Accessibility settings</strong>: in the header on a wide screen, and as the last
            cell of the bottom bar on a phone.
          </p>
          <ol className="a11y-page-steps">
            <li>Open the panel. Focus moves into it, and the first Tab reaches the first control.</li>
            <li>
              Choose a setting with the arrow keys inside its group, or with the pointer. Every
              change applies immediately and is announced.
            </li>
            <li>
              Press Escape or the close button to shut the panel. Focus returns to the button you
              opened it with.
            </li>
            <li>
              <strong>Reset to defaults</strong> puts everything back, including the settings you
              have not changed this visit.
            </li>
          </ol>
          <p>The settings are:</p>
          <ul className="a11y-page-list">
            <li>
              <strong>Text size</strong> at 100, 115, 130 or 150 percent of your browser&apos;s own
              base size.
            </li>
            <li>
              <strong>Line and letter spacing</strong> at normal or relaxed.
            </li>
            <li>
              <strong>Contrast</strong> at standard, or high, which lifts body text and hairlines to
              at least 7:1 against the background.
            </li>
            <li>
              <strong>Motion</strong> to follow your system setting, or to reduce it whatever your
              system asks for. Reducing it stops transitions and animations across the site,
              including the radio player&apos;s slide-out.
            </li>
            <li>
              <strong>Underline links</strong>, which underlines links in running text so they are
              not distinguished by colour alone.
            </li>
            <li>
              <strong>Readable font</strong>, which replaces the display serif in headings with the
              plain sans-serif the body text already uses.
            </li>
          </ul>
          <p className="a11y-page-note">
            Your choices are saved in this browser only, under the key{" "}
            <code>tml-a11y-prefs</code>. Nothing is sent anywhere, no cookie is set, and there is no
            analytics on this site. Clearing site data clears the settings, and the panel&apos;s
            Reset button does the same without touching anything else.
          </p>
        </div>
      </section>

      <section className="a11y-page-section" aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="a11y-page-section__title">
          Known limitations
        </h2>
        <div className="a11y-page-prose">
          <ul className="a11y-page-list">
            <li>
              <strong>The site is dark only.</strong> There is no light theme. Raising contrast and
              changing text size are offered, but a reader who needs light-on-dark inverted cannot
              get it here. Browser-level forced-colours modes have not been tested.
            </li>
            <li>
              <strong>Some data lives in tables and charts.</strong> The ticket comparison tables are
              marked up with row and column headers and a caption, but the sale timeline and the
              calculators have not been tested with a screen reader.
            </li>
            <li>
              <strong>Headings are sometimes set tight.</strong> Display type is set with tight
              tracking by design. The readable-font setting removes the serif; it does not loosen
              headline tracking.
            </li>
            <li>
              <strong>The radio player plays audio.</strong> It never autoplays, and it only loads the
              stream when you press play, but it offers no captions or transcripts because it carries
              music rather than speech.
            </li>
            <li>
              <strong>Third-party destinations are not ours.</strong> Links to Tomorrowland&apos;s own
              pages and to community group chats leave this site, and their accessibility is outside
              our control.
            </li>
          </ul>
        </div>
      </section>

      <section className="a11y-page-section" aria-labelledby="report-heading">
        <h2 id="report-heading" className="a11y-page-section__title">
          Reporting a problem
        </h2>
        <div className="a11y-page-prose">
          <p>
            If something here does not work for you, that is worth knowing, and it will be looked at.
            Say which page you were on, what you were trying to do, and what happened; if you use
            assistive technology, naming it and its version helps.
          </p>
          <div className="a11y-page-callout">
            <p>
              <strong>There is no published contact address yet.</strong> Rather than print a mailbox
              nobody reads, or one that does not exist, this page says plainly that the route is not
              open. When an address exists it will appear here.
            </p>
            <p>
              In the meantime, the{" "}
              <Link href="/community">community groups</Link> are the route to the people who
              maintain this site, and the{" "}
              <Link href="/about">About page</Link> describes how corrections are handled.
            </p>
          </div>
          {CORRECTIONS_EMAIL === null ? null : (
            <p>
              Write to{" "}
              <a href={`mailto:${CORRECTIONS_EMAIL}`}>{CORRECTIONS_EMAIL}</a>.
            </p>
          )}
        </div>
      </section>

      <p className="a11y-page-footnote">
        Last reviewed <time dateTime={LAST_REVIEWED_ISO}>{LAST_REVIEWED}</time>. This statement
        describes the site as it is today. It will be updated when a manual audit is completed, when
        the outstanding checks above are done, or when a contact route is published.
      </p>
    </main>
  );
}
