import { ButtonLink } from "@/components/ui/button";
import { ButterflyTrail } from "@/components/ui/butterfly-trail";

/**
 * The closing call to action: community and radio.
 *
 * The global footer is rendered by the site shell and is not repeated here. This
 * is the page's own last pitch, and it links only to the two destinations it
 * names.
 */
export function CommunityCta() {
  return (
    <section className="home-section home-cta" aria-labelledby="community-cta-heading">
      {/*
        The trail sits inside the section's content column, unclipped. It is the
        section's own `overflow` that used to slice the wing, so this section
        carries none; the page wrapper is the single horizontal clip for the
        whole page.
      */}
      <ButterflyTrail side="left" opacity={0.26} width="min(420px, 58vw)" drift="medium" />
      <div className="home-cta__panel">
        <div>
          <p className="label text-accent">Community</p>
          <h2 id="community-cta-heading" className="home-cta__title">
            Plan it with people who are going
          </h2>
          <p className="home-cta__body">
            Group chats for each weekend, for transport, for DreamVille and for Brasil. Between
            festivals, One World Radio plays the sets you are planning around.
          </p>
        </div>
        <div className="home-cta__actions">
          <ButtonLink href="/community">Find a group</ButtonLink>
          <ButtonLink href="/radio" variant="secondary">
            Listen to the radio
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
