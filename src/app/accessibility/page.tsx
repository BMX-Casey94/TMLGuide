import type { Metadata } from "next";
import Link from "next/link";
import { GoldDivider } from "@/components/ui/gold-divider";
import { CORRECTIONS_EMAIL } from "@/components/home/contact";
import { socialMetadata } from "@/lib/seo/social";
import "./a11y-page.css";

const TITLE = "Accessibility";
const DESCRIPTION =
  "How TMLGuide is built for accessibility, what has been tested automatically, what has not yet been checked by hand, and how to report a problem.";
const PATH = "/accessibility";

/** The date this statement was last reviewed. Update it whenever any claim below changes. */
const LAST_REVIEWED = "26 November 2026";
const LAST_REVIEWED_ISO = "2026-11-26";

/** The WCAG version this site is aiming at. Not a conformance claim: see the page's own wording. */
const TARGET = "WCAG 2.2 Level AA";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  ...socialMetadata({ path: PATH, title: TITLE, description: DESCRIPTION }),
};

/**
 * The accessibility statement.
 *
 * A Server Component: static prose, no state and no data beyond the review date and the contact
 * constant. The point of the page is that it does not overclaim. It names the target, the single
 * automated check that has actually been run, the checks in the tools that have been done by hand
 * and the ones that have not, the known limitations, and the fact that there is no published
 * contact address yet rather than inventing one. Nothing here says "conforms" or "compliant".
 *
 * The tools section is deliberately precise about method. The sale timeline and the calculators
 * were checked in the browser's accessibility tree, from the keyboard, and by measurement at 320
 * CSS pixels and at a 640-pixel stand-in for 200 percent zoom. None of that is a screen-reader
 * test, and the page says so rather than letting a clean scan imply otherwise.
 *
 * Presentation only, never the wording: the page now uses the same reading grammar as /about and
 * the guides. One 1240px column on the footer's inset, a hero that ends on a hairline, sections
 * separated by the page rhythm with a single GoldDivider at each boundary that wants an ornament,
 * a 65-character measure, list markers in the edition accent, the "no conformance claim" sentence
 * in its own callout so the caveat reads as the page's own rather than as one more paragraph, and
 * a single dated review line at the close.
 *
 * Nothing about the accessibility behaviour changed: the heading order, the six labelled regions,
 * the callout wording, the `<code>` storage key and the machine-readable review date are all as
 * they were. The stylesheet is written to survive the toolbar's own preference rules: sizes are in
 * `rem` and percentages rather than fixed pixels, no rule pins a text colour the high-contrast
 * palette cannot override, and no measure is capped so tightly that 150 percent text breaks it.
 */
export default function AccessibilityPage() {
  return (
    <main id="main" className="a11y-page-main">
      <header className="a11y-page-hero">
        <p className="label text-accent">Accessibility</p>
        <h1 className="a11y-page-hero__title">
          What works, what has been checked, and what has not
        </h1>
        <p className="a11y-page-hero__lede">
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
          <div className="a11y-page-callout a11y-page-callout--caveat">
            <p className="a11y-page-callout__label label">No conformance claim</p>
            <p>
              TMLGuide does not claim conformance with {TARGET}, and this page is not a certificate.
              A passing automated scan is a floor, not proof that the site works with assistive
              technology. Where something has not been tested, the section that follows says so
              rather than leaving the gap to be assumed.
            </p>
          </div>
        </div>
      </section>

      <GoldDivider butterfly="right" />

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
              JAWS, VoiceOver or TalkBack. The tools pages have been checked in the browser&apos;s
              accessibility tree and with keyboard tests, which is not the same thing: it shows a
              control has a name and can be reached, not that the name is announced usefully. How
              the landmarks, the live regions and the accessibility panel are announced is
              therefore unverified.
            </li>
            <li>
              <strong>A full keyboard audit.</strong> The tools pages have been walked end to end
              with the keyboard alone: tab order, visible focus, the edition tabs, the map diagram
              and the My Trip confirmation. The panel, the search dialog and the radio player have
              unit tests for focus order. The rest of the site has not been walked end to end.
            </li>
            <li>
              <strong>A review at 200 percent zoom and at 400 percent reflow.</strong> The tools
              pages and this page have been measured at 320 CSS pixels wide and at a 640-pixel
              layout standing in for 200 percent zoom of a 1280-pixel window: the document does not
              scroll sideways at either width, and wide tables scroll inside their own box. The 400
              percent reflow check has not been run, and the rest of the site has not been checked
              page by page at either zoom level.
            </li>
            <li>
              <strong>Contrast over imagery and gradients.</strong> The measured contrast figures
              cover solid surfaces. Text that sits over the ambient glow or over a gradient has not
              been measured at every scroll position.
            </li>
            <li>
              <strong>Touch target sizes on a real device.</strong> Controls in the tools have been
              measured in the browser at a 320-pixel viewport and meet 44 by 44 CSS pixels. That has
              not been verified on physical hardware, where spacing and reach matter as much as the
              box.
            </li>
          </ul>
        </div>
      </section>

      <GoldDivider butterfly="left" />

      <section className="a11y-page-section" aria-labelledby="toolbar-heading">
        <h2 id="toolbar-heading" className="a11y-page-section__title">
          Changing how the site looks
        </h2>
        <div className="a11y-page-prose">
          <p>
            A display toolbar lets you adjust the site without changing anything in your browser or
            your operating system. Its button shows the letters <strong>Aa</strong> and is labelled{" "}
            <strong>Accessibility settings</strong>. It sits at the right-hand end of the site
            header, and appears from 900px wide. The bottom bar on a phone carries navigation only,
            so on a narrower screen there is no copy of the button.
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
          <ul className="a11y-page-list a11y-page-list--settings">
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
            <code className="a11y-page-code">tml-a11y-prefs</code>. Nothing is sent anywhere, no
            cookie is set, and there is no analytics on this site. Clearing site data clears the
            settings, and the panel&apos;s Reset button does the same without touching anything else.
          </p>
        </div>
      </section>

      <GoldDivider butterfly="left" />

      <section className="a11y-page-section" aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="a11y-page-section__title">
          What has been checked in the tools
        </h2>
        <div className="a11y-page-prose">
          <p>
            The sale timeline and the calculators were listed here as unchecked. They have now been
            worked through by hand at a desk, without a screen reader, using the browser&apos;s own
            accessibility tree, the keyboard alone, and measurements taken in the browser at a
            320-pixel viewport. That is a real improvement and it is not a screen-reader test.
          </p>
          <ul className="a11y-page-list">
            <li>
              <strong>Names.</strong> Every control on the tools pages was read from the
              accessibility tree and compared with its visible label. Where a control printed text
              that was missing from its name, the name was corrected: the map diagram&apos;s zones,
              the two swap buttons, and the badges on the map&apos;s zone buttons. The packing
              list&apos;s checkboxes had been named by their whole label — the item, the tag, the
              citation, the check date and the rule, about forty words before the state — so the
              item text is now the name and the rest is the description.
            </li>
            <li>
              <strong>The keyboard.</strong> Focus order, the tab patterns, Escape in the My Trip
              confirmation, and the focus that comes back to the button which opened it were all
              driven from the keyboard. Focus is drawn on every stop, including the two wide panels
              that now scroll inside themselves.
            </li>
            <li>
              <strong>Layout at a phone width and at 200 percent zoom.</strong> Measured in the
              browser rather than by eye: at 320 CSS pixels, and at a 640-pixel layout standing in
              for 200 percent zoom of a 1280-pixel window, no tools page or this page scrolls
              sideways. Two things were fixed to get there. The budget&apos;s category chart was an
              SVG that scaled its own text, so its 13-pixel labels rendered about five pixels tall
              in a 238-pixel panel; it is now ordinary text beside a bar, and the labels stay at
              their declared size. The venue diagram kept a fixed 800 by 500 canvas at any width, so
              its labels and its tap targets shrank with it; it now keeps a floor width and scrolls
              inside its own framed box, and focusing a zone scrolls it into view.
            </li>
            <li>
              <strong>Announcements.</strong> The Pearl calculator&apos;s live region covered its
              whole result panel, so every keystroke re-read the standing warning about the 2027
              rate. It now speaks the figure alone. The budget calculator had no live region at all,
              so its total changed in silence; it now announces the new total once the reader stops
              typing, rather than on every keystroke.
            </li>
            <li>
              <strong>What was not verified.</strong> No screen reader was run. Nothing here says
              how any of these controls sound in NVDA, JAWS, VoiceOver or TalkBack, and the
              announcements above were checked as text in a live region, not by listening.
            </li>
          </ul>
          <p className="a11y-page-note">
            The automated scans were also re-run at a 320-pixel viewport as well as a desktop one.
            They report no violations on the tools pages or on this page. As above, that is a floor.
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
              marked up with row and column headers and a caption. In the tools, the budget
              calculator&apos;s category breakdown is a decorative bar chart beside a real table,
              and the table is given a tab stop so it can be scrolled from the keyboard on a narrow
              screen. None of these has been read with a screen reader.
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

      <div className="a11y-page-reviewed">
        <p className="a11y-page-reviewed__text">
          <span className="label a11y-page-reviewed__label">Last reviewed </span>
          <time dateTime={LAST_REVIEWED_ISO}>{LAST_REVIEWED}</time>. This statement describes the
          site as it is today. It will be updated when a manual audit is completed, when the
          outstanding checks above are done, or when a contact route is published.
        </p>
      </div>
    </main>
  );
}
