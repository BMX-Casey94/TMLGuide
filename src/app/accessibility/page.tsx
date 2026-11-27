import type { Metadata } from "next";
import Link from "next/link";
import { GoldDivider } from "@/components/ui/gold-divider";
import { CORRECTIONS_EMAIL } from "@/components/home/contact";
import { socialMetadata } from "@/lib/seo/social";
import "./a11y-page.css";

const TITLE = "Accessibility";
const DESCRIPTION =
  "How to make TMLGuide easier to read: text size, contrast, motion, spacing and font settings, plus how the pages work with a keyboard and on a phone.";
const PATH = "/accessibility";

/** The date this page was last reviewed. Update it whenever a claim on the page changes. */
const LAST_REVIEWED = "27 November 2026";
const LAST_REVIEWED_ISO = "2026-11-27";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  ...socialMetadata({ path: PATH, title: TITLE, description: DESCRIPTION }),
};

/**
 * The accessibility page.
 *
 * A Server Component: static prose, no state, and no data beyond the review date and the contact
 * constant. It is written for readers rather than for a compliance file, because TMLGuide is an
 * independent fan guide and no regulation obliges it to publish anything here. What it does owe a
 * reader is a straight account of the display settings the site ships, the checks that have been
 * run, and the gaps that remain.
 *
 * The copy therefore avoids standards numbers, the words "conformance" and "compliant", and any
 * framing borrowed from public-sector statements. It names what a reader can change, what works
 * without a mouse, what has been measured, and what has not been listened to with a screen reader.
 *
 * Presentation matches /about and the guides: one 1240px column on the footer's inset, a hero that
 * ends on a hairline, sections separated by the page rhythm with a single GoldDivider at each
 * boundary that wants an ornament, a 65-character measure, list markers in the edition accent, one
 * callout for the caveat that matters most, and a dated review line at the close.
 *
 * The stylesheet is written to survive the toolbar's own preference rules: sizes are in `rem` and
 * percentages rather than fixed pixels, no rule pins a text colour the high-contrast palette cannot
 * override, and no measure is capped so tightly that 150 percent text breaks it.
 */
export default function AccessibilityPage() {
  return (
    <main id="main" className="a11y-page-main">
      <header className="a11y-page-hero">
        <p className="label text-accent">Accessibility</p>
        <h1 className="a11y-page-hero__title">Making the guide easy to read and use</h1>
        <p className="a11y-page-hero__lede">
          TMLGuide is an independent fan guide to Tomorrowland. This page covers the display settings
          built into the site, the way the pages work with a keyboard and on a phone, and the parts
          that still need work.
        </p>
      </header>

      <section className="a11y-page-section" aria-labelledby="toolbar-heading">
        <h2 id="toolbar-heading" className="a11y-page-section__title">
          Change how the site looks
        </h2>
        <div className="a11y-page-prose">
          <p>
            A display panel lets you change how the site looks without altering anything in your
            browser or on your device. Its button shows the letters <strong>Aa</strong>, and a screen
            reader calls it <strong>Accessibility settings</strong>. It sits at the top right of the
            header on a tablet or a desktop screen, from about 900 pixels wide; the bar at the bottom
            of a phone carries navigation only, so a narrow screen has no copy of the button.
          </p>
          <ol className="a11y-page-steps">
            <li>Open the panel. Focus moves into it, and the first Tab reaches the first setting.</li>
            <li>
              Choose with the arrow keys inside a group, or with the pointer. Every change applies
              immediately and is announced.
            </li>
            <li>
              Press Escape or the close button to shut the panel. Focus returns to the button you
              opened it with.
            </li>
          </ol>
          <p>The settings are:</p>
          <ul className="a11y-page-list a11y-page-list--settings">
            <li>
              <strong>Text size</strong> at 100, 115, 130 or 150 percent of your browser&apos;s own
              text size.
            </li>
            <li>
              <strong>High contrast</strong>, which makes body text and thin lines stand out more
              sharply against the background.
            </li>
            <li>
              <strong>Reduced motion</strong>, which stops transitions and animations across the
              site, including the radio player&apos;s slide-out. &ldquo;Follow system&rdquo; leaves
              the choice to your device.
            </li>
            <li>
              <strong>Readable font</strong>, which swaps the decorative heading type for the plain
              sans-serif that body text already uses.
            </li>
            <li>
              <strong>Underlined links</strong>, which underline links in running text so they are
              not told apart by colour alone.
            </li>
            <li>
              <strong>Line and letter spacing</strong>, at normal or relaxed.
            </li>
          </ul>
          <p>
            <strong>Reset to defaults</strong> puts every setting back, including the ones you have
            not changed this visit.
          </p>
          <p className="a11y-page-note">
            Your choices are saved in this browser only, under the key{" "}
            <code className="a11y-page-code">tml-a11y-prefs</code>. Nothing is sent anywhere, no
            cookie is set, and there is no analytics on this site. Clearing site data clears the
            settings, and Reset does the same without touching anything else.
          </p>
        </div>
      </section>

      <GoldDivider butterfly="right" />

      <section className="a11y-page-section" aria-labelledby="input-heading">
        <h2 id="input-heading" className="a11y-page-section__title">
          Built for keyboards and small screens
        </h2>
        <div className="a11y-page-prose">
          <p>
            Every page is designed to work without a mouse. Links, buttons and form fields are built
            to be reached with Tab, the focus ring is drawn on every stop, the display panel keeps
            focus inside itself while it is open and closes on Escape, and its settings can be
            changed with the arrow keys.
          </p>
          <p>
            The layout is built for small screens first. Text wraps rather than forcing the page to
            scroll sideways, wide tables and the venue map scroll inside their own box, and controls
            in the tools measure at least 44 by 44 pixels in the browser. The tools pages and this
            one have been measured at 320 pixels wide, about the narrowest phone still in use, and at
            200 percent browser zoom.
          </p>
        </div>
      </section>

      <section className="a11y-page-section" aria-labelledby="checked-heading">
        <h2 id="checked-heading" className="a11y-page-section__title">
          What we have checked
        </h2>
        <div className="a11y-page-prose">
          <p>
            Every page is scanned automatically at a desktop width and at a phone width, and the scan
            currently reports nothing to fix. It catches the mechanical faults: images with no
            alternative text, form fields with no label, heading levels that skip, text contrast that
            is too low, and two elements sharing the same id.
          </p>
          <p>
            Automated checks cannot see everything. They do not tell you whether the reading order
            makes sense, whether an announcement is useful, or whether a control can actually be
            reached. So the interactive tools — the sale timeline, the budget, Pearl and journey
            calculators, the packing list and the venue map — have also been walked through using
            only the keyboard, measured at a phone width, and checked against the list of controls
            and labels each page presents to assistive technology.
          </p>
          <div className="a11y-page-callout a11y-page-callout--caveat">
            <p className="a11y-page-callout__label label">Worth knowing</p>
            <p>
              A clean automatic scan is a starting point, not proof that the site works with a screen
              reader. Where something has not been checked, the section below says so rather than
              leaving you to assume.
            </p>
          </div>
        </div>
      </section>

      <GoldDivider butterfly="left" />

      <section className="a11y-page-section" aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="a11y-page-section__title">
          Known limitations
        </h2>
        <div className="a11y-page-prose">
          <ul className="a11y-page-list">
            <li>
              <strong>Maps and calculators need a current browser.</strong> They are the most
              script-heavy parts of the site and work best in an up-to-date Chrome, Safari, Firefox or
              Edge. Older browsers, and some in-app browsers inside social apps, may not draw the map
              diagram properly.
            </li>
            <li>
              <strong>Screen readers have not been tried by hand.</strong> No page has been read with
              NVDA, JAWS, VoiceOver or TalkBack. Names, roles and announcements have been checked as
              text, which shows a control has a name and can be reached, not that the name is
              announced usefully.
            </li>
            <li>
              <strong>The site is dark only.</strong> There is no light theme. High contrast and
              larger text help, but a reader who needs dark text on a light background will not find
              it here, and browser forced-colours modes have not been tested.
            </li>
            <li>
              <strong>Some destinations are not ours.</strong> Links to Tomorrowland&apos;s own pages
              and to community group chats leave this site, and their accessibility is outside our
              control.
            </li>
          </ul>
        </div>
      </section>

      <GoldDivider butterfly="right" />

      <section className="a11y-page-section" aria-labelledby="report-heading">
        <h2 id="report-heading" className="a11y-page-section__title">
          Telling us about a problem
        </h2>
        <div className="a11y-page-prose">
          <p>
            If something here does not work for you, that is worth knowing, and it will be looked at.
            Say which page you were on, what you were trying to do, and what happened; if you use a
            screen reader or voice control, naming it and its version helps.
          </p>
          <div className="a11y-page-callout">
            <p>
              <strong>There is no published contact address yet.</strong> Rather than print a mailbox
              nobody reads, this page says plainly that the route is not open. When an address exists
              it will appear here.
            </p>
            <p>
              In the meantime, the{" "}
              <Link href="/community">community groups</Link> are the route to the people who
              maintain this site, and the <Link href="/about">About page</Link> describes how
              corrections are handled.
            </p>
          </div>
          {CORRECTIONS_EMAIL === null ? null : (
            <p>
              Write to <a href={`mailto:${CORRECTIONS_EMAIL}`}>{CORRECTIONS_EMAIL}</a>.
            </p>
          )}
        </div>
      </section>

      <div className="a11y-page-reviewed">
        <p className="a11y-page-reviewed__text">
          <span className="label a11y-page-reviewed__label">Last reviewed </span>
          <time dateTime={LAST_REVIEWED_ISO}>{LAST_REVIEWED}</time>. This page describes the site as
          it is today. It will be updated when more of the checks above have been done, or when a
          contact address is published.
        </p>
      </div>
    </main>
  );
}
