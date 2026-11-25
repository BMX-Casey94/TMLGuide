import type { Metadata } from "next";
import Link from "next/link";
import { sharedData } from "@/data/shared";
import { communityData } from "@/data/community";
import { GoldDivider } from "@/components/ui/gold-divider";
import { CORRECTIONS_EMAIL } from "@/components/home/contact";
import { formatLongDate } from "@/components/home/format";
import { serialiseJsonLd, webPageJsonLd } from "@/components/home/json-ld";
import { OFFICIAL_HOST_ROLES, citedSourceUrls } from "@/components/home/source-hosts";
import { oldestVerifiedOn } from "@/components/home/verified-on";
import { socialMetadata } from "@/lib/seo/social";
import "@/components/home/home.css";
import "./about.css";

const TITLE = "About this guide";
const DESCRIPTION =
  "Who runs TMLGuide, how each fact is checked against Tomorrowland's own pages, how errors are corrected, and the official sites every figure comes from.";
const PATH = "/about";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  ...socialMetadata({ path: PATH, title: TITLE, description: DESCRIPTION }),
};

/** Every source URL the data cites, so the host table can be checked against it. */
const SOURCE_URLS = citedSourceUrls();

/**
 * The About page: who this is, what the method is, what happens when a fact is
 * wrong, and where every figure comes from.
 *
 * It makes no claim that is not true today. There is no organisation behind the
 * site, so no company details are given; there is no tracking on the site, so the
 * privacy section says that rather than describing a cookie policy that does not
 * exist; and there is no corrections address in the repository, so the page
 * leaves a clearly marked place for one instead of inventing a mailbox.
 */
export default function AboutPage() {
  const checkedOn = oldestVerifiedOn();
  const checkedOnLabel = formatLongDate(checkedOn);

  // Only editions with a guide count here: Thailand has a record in the shared
  // overview but no pages on this site, and counting it would overstate the site.
  const guideEditions = new Set(
    sharedData.editions
      .map((record) => record.guideEdition)
      .filter((edition): edition is NonNullable<typeof edition> => edition !== undefined),
  );
  const groupCount = communityData.whatsappGroups.length;

  return (
    <main id="main" className="home-main about-main">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(webPageJsonLd(PATH, TITLE, DESCRIPTION)) }}
      />

      <header className="about-header">
        <p className="label text-accent">About</p>
        <h1 className="about-header__title">An independent guide, with its workings shown</h1>
        <p className="about-header__lede">
          TMLGuide is a fan-run guide to Tomorrowland. It exists because most of what a first-time
          visitor needs is scattered across sale pages, help-centre articles and forums, and because
          a wrong price or a wrong date is expensive to discover late.
        </p>
      </header>

      <section className="about-section" aria-labelledby="who-heading">
        <h2 id="who-heading" className="about-section__title">
          Who runs this
        </h2>
        <div className="about-prose">
          <p>
            TMLGuide is written and maintained by a small group of people who go to the festival. It
            is a hobby project with a professional standard of accuracy, not a business: nothing is
            sold here, no tickets are resold here, and no commission is earned on a ticket, a
            package or a hotel.
          </p>
          <p>
            The site covers {guideEditions.size} editions of Tomorrowland: Belgium in July, Winter
            in the Alps in March, and Brasil in the southern autumn. It keeps {groupCount} community
            group chats and the tools that go with them: a sale timeline, a budget calculator, a
            Pearl calculator and a countdown.
          </p>
          <p>
            Everything was last checked on <strong>{checkedOnLabel}</strong>. That date is read from
            the data rather than typed into this sentence, so it moves when the facts do.
          </p>
        </div>

        <div className="about-callout">
          <p>
            <strong>Not affiliated.</strong> TMLGuide is not affiliated with, endorsed by or
            sponsored by Tomorrowland or WeAreOne.World B.V. Tomorrowland is a trademark of its
            respective owner. No official logo, crest, typeface, stage photograph or artwork
            appears on this site, and no official page is reproduced here.
          </p>
        </div>
      </section>

      <GoldDivider butterfly="right" />

      <section className="about-section" aria-labelledby="method-heading">
        <h2 id="method-heading" className="about-section__title">
          How facts are checked
        </h2>
        <div className="about-prose">
          <p>
            Every figure on the site is attached to a source and a date at the point it is stored,
            not added afterwards by hand. A record that cannot name its source fails the build, so it
            cannot reach a page.
          </p>
          <ul>
            <li>
              <strong>Official sources only.</strong> Prices, dates and rules come from
              Tomorrowland&apos;s own sites and its help centre. A primary operator page (a venue, a
              lift company, a transport operator) is used only for something Tomorrowland does not
              publish itself.
            </li>
            <li>
              <strong>Every claim gets a verdict.</strong> Each one is marked confirmed, changed (the
              fact holds but the value moved for this cycle), outdated, unverifiable (no official or
              primary source found) or contradicted by its sources. Unverifiable claims are never
              published as if they were confirmed.
            </li>
            <li>
              <strong>Figures carry their year.</strong> A 2025 or 2026 price is never presented as a
              2027 price. Where an edition has no published figure, the page says so instead of
              filling the gap.
            </li>
            <li>
              <strong>Links are checked, not assumed.</strong> Outbound links are requested and their
              responses recorded. A link that is dead, insecure or refuses automated clients is noted
              in the ledger and fixed or removed before launch.
            </li>
            <li>
              <strong>Currencies are never converted.</strong> Euro prices are shown in euros and
              Brasil&apos;s prices in reais, because no official source publishes an exchange rate.
            </li>
          </ul>
          <p className="about-note">
            The ledgers themselves live in the project repository: one per edition, one for contested
            claims, and one for link health. They record the source, the retrieval date and the
            verdict for each claim, including the ones that were rejected.
          </p>
        </div>
      </section>

      <section className="about-section" aria-labelledby="errors-heading">
        <h2 id="errors-heading" className="about-section__title">
          When something is wrong
        </h2>
        <div className="about-prose">
          <p>
            Corrections are taken seriously, because a stale price or a moved sale date is the one
            thing this site cannot afford. If a figure here disagrees with an official page, the
            official page is right and this site is wrong.
          </p>
          <p>
            When you report something, the fix follows the same route as the original fact: the
            official page is re-read, the record is corrected with a new check date, and the page is
            rebuilt. If a figure cannot be re-confirmed, it comes off the page rather than staying up
            with an old date attached.
          </p>
          <p>
            Corrections are welcome through the{" "}
            <Link className="about-inline-link" href="/community">
              community channels
            </Link>
            , where the people who maintain the site are reachable.
          </p>
          {CORRECTIONS_EMAIL === null ? null : (
            <p className="about-contact">
              By email:{" "}
              <a className="about-contact__address" href={`mailto:${CORRECTIONS_EMAIL}`}>
                {CORRECTIONS_EMAIL}
              </a>
            </p>
          )}
        </div>
      </section>

      <section className="about-section" aria-labelledby="partners-heading">
        <h2 id="partners-heading" className="about-section__title">
          Partners and money
        </h2>
        <div className="about-prose">
          <p>
            Some accommodation and travel providers are listed as community partners. They are there
            because the community already uses them, and each listing carries the same neutral
            disclosure: check the partner&apos;s own terms before booking.
          </p>
          <p>
            No partner pays for placement and no commission is taken on anything booked through a
            listing. Where a partner offers a discount code, the code is the partner&apos;s own. The
            one donation link on the site is labelled as a donation, not as a partner.
          </p>
          <p>
            The full list, with each disclosure, is in the{" "}
            <Link className="about-inline-link" href="/community#partners">
              community partners section
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="about-section" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="about-section__title">
          Privacy, briefly
        </h2>
        <div className="about-prose">
          <p>
            There is no analytics, no advertising and no third-party tracking script on this site
            today. Nothing is sent to an advertising network and nothing follows you to another site.
          </p>
          <p>
            Two things are stored in your browser to make the site work as expected: the edition you
            last selected, and the radio volume. Both stay on your device, and both can be cleared by
            clearing site data. Playing the radio opens a connection to the public stream, which is
            the only outbound request the site makes on your behalf. Loading the page makes no
            outbound request at all.
          </p>
          <p className="about-note">
            This section describes the site as it is today. If analytics is added later, this text
            and a consent step must change with it, and neither has been written in advance.
          </p>
        </div>
      </section>

      <section className="about-section" aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="about-section__title">
          Where the facts come from
        </h2>
        <div className="about-prose">
          <p>
            These are the official hosts the data cites, and what each one is used for. Every host
            below belongs to Tomorrowland; if a fact needs a page that is not on this list, that
            page is a named operator&apos;s own site and is cited on the record itself.
          </p>
        </div>

        <div className="about-table-wrap">
          <table className="about-table">
            <caption>Official sources, by host</caption>
            <thead>
              <tr>
                <th scope="col">Host</th>
                <th scope="col">Used for</th>
              </tr>
            </thead>
            <tbody>
              {OFFICIAL_HOST_ROLES.map((entry) => (
                <tr key={entry.host}>
                  {/* The host is what each row is about, so it is the row's header. */}
                  <th scope="row">{entry.host}</th>
                  <td>{entry.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="about-note">
          Every record also stores the exact page it was read from and the date it was retrieved, so
          a citation is one click from the figure it supports. This page checks the host list against
          the data at build time: a citation to a Tomorrowland host that is missing from the table
          fails the test suite.
        </p>
      </section>

      <section className="about-section" aria-labelledby="assets-heading">
        <h2 id="assets-heading" className="about-section__title">
          Pictures and icons
        </h2>
        <div className="about-prose">
          <p>
            The logo, the butterfly mark and the flight trail are original artwork commissioned for
            this site. The 3D icons come from the 3dicons library and are used under its CC0 licence.
            Every image and icon is recorded in an asset ledger in the repository with its source,
            licence and how it was made.
          </p>
          <p>
            No photograph, render or recording from Tomorrowland is used or hosted here. Recordings
            of sets, where the site links to them, are played from the artist&apos;s or the
            festival&apos;s own channel; no audio file is stored on this server.
          </p>
        </div>
      </section>

      <section className="about-section" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="about-section__title">
          Get in touch
        </h2>
        <div className="about-prose">
          <p>
            The{" "}
            <Link className="about-inline-link" href="/community">
              community groups
            </Link>{" "}
            are the fastest route to the people who maintain this site, and they are also where most
            corrections start. For anything about the guide itself,{" "}
            <Link className="about-inline-link" href="/guides">
              the guide index
            </Link>{" "}
            is the best place to check whether the answer already exists.
          </p>
          <p className="about-note">
            {/* Deliberately no address until one exists. See contact.ts. */}
            There is no general contact address published yet.
          </p>
        </div>
      </section>

      <div className="about-footnote">
        <p className="about-footnote__text">
          Last checked {checkedOnLabel}. Dates, prices and rules can change without notice; confirm
          against the official Tomorrowland pages before you book. {SOURCE_URLS.length} sourced
          records back the pages of this site.
        </p>
      </div>
    </main>
  );
}
