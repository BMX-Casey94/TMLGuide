import type { Metadata } from "next";
import { Button, ButtonLink } from "@/components/ui/button";
import { ButterflyTrail } from "@/components/ui/butterfly-trail";
import { Card } from "@/components/ui/card";
import { CardCarousel } from "@/components/ui/card-carousel";
import { GoldDivider } from "@/components/ui/gold-divider";
import { ICON_3D_NAMES, Icon3D } from "@/components/ui/icon-3d";
import { SectionAction, SectionHeading } from "@/components/ui/section-heading";
import "./kit.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "UI kit",
};

const editions = [
  { id: "belgium", name: "Belgium" },
  { id: "winter", name: "Winter" },
  { id: "brasil", name: "Brasil" },
] as const;

export default function KitPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-7">
      <header className="border-b border-hair py-14">
        <p className="label text-accent">Internal reference</p>
        <h1 className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl">
          UI kit
        </h1>
        <p className="kit-intro mt-5">
          Every component, variant and edition accent in one place. All copy on this page is
          placeholder text for layout checks, not guide content.
        </p>
      </header>

      <section className="kit-section" aria-labelledby="kit-typography">
        <SectionHeading
          id="kit-typography"
          kicker="01 · Type and headings"
          title="Section heading, lede and action"
          lede="The section opener pairs a tracked mono kicker with a serif h2 and an optional lede, capped at 62 characters per line."
          action={<SectionAction href="#kit-cards">Example action</SectionAction>}
        />
      </section>

      <GoldDivider butterfly="right" />

      <section className="kit-section" aria-labelledby="kit-cards">
        <SectionHeading
          id="kit-cards"
          kicker="02 · Cards"
          title="Card family"
          lede="Standard, feature, stat and alert variants on the dusk surface, each with the edition-accent edge."
        />

        <div className="kit-card-grid mt-8">
          <Card
            kicker="Example kicker"
            title="Example standard card"
            icon="gift"
            badge="Verified"
            verifiedOn="2027-03-12"
            href="#kit-cards"
          >
            Example body copy for a standard card with an icon, a badge and a checked date.
          </Card>

          <Card
            variant="feature"
            kicker="Example kicker"
            title="Example feature card"
            icon="trophy"
          >
            Example body copy for the feature variant, which uses a top accent edge and a larger
            icon.
          </Card>

          <Card
            variant="stat"
            kicker="Example statistic"
            value="400,000"
            unit="people"
            label="Example statistic label"
          />

          <Card
            variant="alert"
            kicker="Example kicker"
            title="Example alert card"
            statusLabel="Example warning"
            icon="shield"
          >
            Example body copy for the alert variant. The ember edge is reinforced by the visible
            status label, so the warning never depends on colour alone.
          </Card>

          <Card kicker="Example kicker" title="Example static card" icon="map-pin" headingLevel={4}>
            Example body copy for a card with no link, which keeps the same surface without a
            hover lift.
          </Card>

          <Card
            kicker="Example kicker"
            title="Example linked card"
            icon="wallet"
            href="#kit-cards"
            headingLevel={4}
          >
            Example body copy for a whole-card link with a focus ring and a visible arrow.
          </Card>
        </div>
      </section>

      <section className="kit-section" aria-labelledby="kit-carousel">
        <SectionHeading
          id="kit-carousel"
          kicker="03 · Carousel"
          title="Swipe on mobile, grid from 700px"
          lede="Narrow the window to see the snap scroller with a peek of the next card; widen it for two then three columns."
        />

        <CardCarousel label="Example card group" className="mt-8">
          <Card kicker="Example one" title="Example card one" icon="star">
            Example body copy.
          </Card>
          <Card kicker="Example two" title="Example card two" icon="music">
            Example body copy.
          </Card>
          <Card kicker="Example three" title="Example card three" icon="headphone">
            Example body copy.
          </Card>
        </CardCarousel>
      </section>

      <section className="kit-section" aria-labelledby="kit-editions">
        <SectionHeading
          id="kit-editions"
          kicker="04 · Edition accents"
          title="One accent per edition"
          lede="Each wrapper redefines --ea locally: Belgium saffron, Winter ice and Brasil coral. The dark ground, hairline and cream text never change."
        />

        <div className="kit-edition-grid">
          {editions.map((edition) => (
            <div key={edition.id} data-demo-ed={edition.id} className="kit-demo">
              <div className="kit-demo-head">
                <p className="label text-cream-mute">{edition.name} accent</p>
                <span className="kit-swatch" aria-hidden="true" />
              </div>
              <Card
                kicker="Example kicker"
                title="Example accent card"
                icon="flash"
                href="#kit-editions"
                className="mt-4"
              >
                Example body copy with the edition accent edge.
              </Card>
              <div className="kit-stack mt-4">
                <Button>Example action</Button>
                <Button variant="secondary">Example secondary</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <GoldDivider butterfly="left" />

      <section className="kit-section" aria-labelledby="kit-buttons">
        <SectionHeading
          id="kit-buttons"
          kicker="05 · Actions"
          title="Buttons and links"
          lede="Primary, secondary and ghost at both sizes, with a loading state that reports aria-busy and blocks further clicks."
        />

        <div className="kit-stack mt-8">
          <Button>Example primary</Button>
          <Button variant="secondary">Example secondary</Button>
          <Button variant="ghost">Example ghost</Button>
          <Button size="lg">Example large primary</Button>
          <Button variant="secondary" size="lg">
            Example large secondary
          </Button>
          <Button disabled>Example disabled</Button>
          <Button loading loadingLabel="Example loading">
            Example loading action
          </Button>
          <ButtonLink href="#kit-buttons">Example button link</ButtonLink>
        </div>
      </section>

      <section className="kit-section" aria-labelledby="kit-icons">
        <SectionHeading
          id="kit-icons"
          kicker="06 · Icons"
          title="3D icon set"
          lede="Every exported name, at the default size, with the accent glow on the first four."
        />

        <ul className="kit-icon-row mt-8">
          {ICON_3D_NAMES.map((name, index) => (
            <li key={name} className="kit-icon-cell">
              <Icon3D name={name} glow={index < 4} />
              <span className="kit-code">{name}</span>
            </li>
          ))}
        </ul>

        <div className="kit-stack mt-10">
          <Icon3D name="rocket" size={24} />
          <Icon3D name="rocket" size={48} glow />
          <Icon3D name="rocket" size={96} glow />
        </div>
      </section>

      <section className="kit-section" aria-labelledby="kit-dividers">
        <SectionHeading
          id="kit-dividers"
          kicker="07 · Ornament"
          title="Gold dividers"
          lede="The shimmer runs on a slow loop and is removed entirely under reduced motion."
        />

        <div className="mt-8">
          <GoldDivider />
          <GoldDivider butterfly="left" />
          <GoldDivider butterfly="right" />
        </div>
      </section>

      <section className="kit-section" aria-labelledby="kit-trail">
        <SectionHeading
          id="kit-trail"
          kicker="08 · Parallax"
          title="Butterfly trail"
          lede="Scroll-linked drift behind content. Each stage clips overflow so the sideways travel cannot widen the page."
        />

        <div className="kit-trail-stage mt-8">
          <ButterflyTrail side="right" opacity={0.6} drift="medium" />
          <p className="label relative z-10 p-7 text-cream-mute">Example stage, right side</p>
        </div>

        <div className="kit-trail-stage mt-5">
          <ButterflyTrail side="left" opacity={0.45} width="min(420px, 70vw)" />
          <p className="label relative z-10 p-7 text-cream-mute">Example stage, left side</p>
        </div>
      </section>
    </main>
  );
}

