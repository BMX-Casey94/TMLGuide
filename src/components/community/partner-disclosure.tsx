/**
 * Partner disclosure copy.
 *
 * Two different sentences carry two different jobs, and both are kept:
 *
 * - `partner.disclosure` is the record's own disclosure, printed verbatim on the
 *   card. It is what the data says about that specific partner, and the schema
 *   refuses anything shorter than a sentence.
 * - `PARTNER_INDEPENDENCE_LINE` is TMLGuide's own standing statement, printed on
 *   every card and in the page explainer, because a per-partner disclosure does
 *   not say who is publishing the page.
 *
 * The data is explicit that no commission or endorsement can be verified (see
 * src/data/community/partners.ts), so these lines claim neither. They say what is
 * known: the partner is listed, the relationship is not a recommendation, and the
 * partner's own terms govern.
 */

/** Printed under every partner card, verbatim, by requirement. */
export const PARTNER_CHECK_TERMS_LINE = "Independent guide, check the partner's own terms";

/** The page-level explainer's heading and body. */
export const PARTNER_DISCLOSURE_TITLE = "Partner disclosure";

export const PARTNER_DISCLOSURE_PARAGRAPHS = [
  "This page lists companies that the original TMLGuide community site carried as partners. Listing them is not a recommendation, and TMLGuide has no verified information about whether money changes hands between them and anyone else.",
  "Every partner entry prints the disclosure that belongs to that partner, word for word. Read it before you book: it says where the entry came from and what to check.",
  "Offers, codes and prices are set by the partner and can change or end without notice. Confirm the terms, the total price and the cancellation policy on the partner's own site before you pay anything.",
  "None of these companies is Tomorrowland. For tickets and official travel packages, check tomorrowland.com.",
] as const;

/** Shown once above the cards when the collection is not empty. */
export const PARTNER_LIST_INTRO =
  "Each card repeats the disclosure for that partner. Promo codes are printed exactly as the partner supplied them.";

export interface PartnerDisclosureProps {
  className?: string;
}

/**
 * The page-level "Partner disclosure" explainer.
 *
 * A real section with its own heading rather than a footnote, because it has to
 * be reachable by heading navigation and readable before the first card. It is
 * rendered unconditionally by the page, not only when partners exist.
 */
export function PartnerDisclosure({ className }: PartnerDisclosureProps) {
  return (
    <section
      aria-labelledby="partner-disclosure-title"
      id="partner-disclosure"
      className={
        className ??
        "mt-8 rounded-[var(--radius-card)] border border-hair-strong bg-surface/60 p-5 sm:p-6"
      }
    >
      <p className="label text-accent">Read first</p>
      <h2 id="partner-disclosure-title" className="mt-2 font-display text-2xl">
        {PARTNER_DISCLOSURE_TITLE}
      </h2>
      <div className="mt-3 flex max-w-[68ch] flex-col gap-3 text-sm leading-relaxed text-cream-mute">
        {PARTNER_DISCLOSURE_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <p className="mt-4 border-t border-hair pt-4 text-sm text-cream">{PARTNER_CHECK_TERMS_LINE}</p>
    </section>
  );
}
