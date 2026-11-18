import { useId } from "react";
import type { Partner } from "@/data/schemas";
import { cx } from "@/components/ui/cx";
import { formatCheckDate, sourceHost } from "./card-format";
import { PARTNER_CHECK_TERMS_LINE } from "./partner-disclosure";
import { EDITION_LABELS } from "./whatsapp-filter";

export interface PartnerCardProps {
  partner: Partner;
  /** Heading level, so the card can sit at h3 under a section or h4 inside a group. */
  headingLevel?: 3 | 4;
  className?: string;
}

/**
 * One partner entry.
 *
 * The disclosure is the most prominent block on the card: it sits directly
 * beneath the name, above the offer, with its own visible label, so it cannot be
 * mistaken for small print at the foot. It is printed exactly as stored, because
 * it is the partner's recorded disclosure and rewording it would change what the
 * page claims.
 *
 * The offer and the promo code are also printed as stored. The Rent-a-Tent code
 * reads "DCATRAVEL", which looks like another partner's name; the data records
 * that mismatch and says it needs checking with the vendor, so the page shows the
 * code as given and sends readers to the partner's own terms rather than
 * silently correcting or hiding it.
 */
export function PartnerCard({ partner, headingLevel = 3, className }: PartnerCardProps) {
  const Heading = `h${headingLevel}` as "h3" | "h4";
  const titleId = `${useId()}-title`;
  const checked = formatCheckDate(partner.lastVerified);
  const host = sourceHost(partner.url);
  const editionLabel = partner.edition === "all" ? null : EDITION_LABELS[partner.edition];

  return (
    <article
      aria-labelledby={titleId}
      className={cx(
        "flex h-full flex-col rounded-[var(--radius-card)] border border-hair bg-gradient-to-b from-surface-2 to-surface p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Heading id={titleId} className="font-display text-xl leading-tight">
          {partner.name}
        </Heading>
        {editionLabel === null ? null : (
          <span className="rounded-full border border-hair px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-mute">
            {editionLabel}
          </span>
        )}
      </div>

      {/*
        The disclosure, first and unmistakable. `aria-label` on the region is not
        used: the visible label plus the paragraph is already one readable block.
      */}
      <div className="mt-3 rounded-xl border-l-2 border-accent bg-accent/[0.06] py-2.5 pr-3 pl-3.5">
        <p className="label text-accent">Disclosure</p>
        <p className="mt-1.5 text-sm leading-relaxed text-cream">{partner.disclosure}</p>
      </div>

      <div className="mt-4">
        <p className="label text-cream-mute">Offer</p>
        <p className="mt-1.5 text-sm leading-relaxed text-cream-mute">{partner.offer}</p>
      </div>

      {partner.promoCode === undefined ? null : (
        <div className="mt-3">
          <p className="label text-cream-mute">Promo code</p>
          {/* A plain code, not user input: rendered as text so it can be selected and copied. */}
          <p className="mt-1.5 font-mono text-sm tracking-[0.12em] text-cream">{partner.promoCode}</p>
        </div>
      )}

      <div className="mt-auto pt-5">
        <a
          href={partner.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent underline-offset-4 hover:underline"
        >
          Visit {partner.name}
          <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>

        <p className="mt-2 text-sm text-cream">{PARTNER_CHECK_TERMS_LINE}</p>

        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-mute">
          {host === null ? "Partner link" : `Source: ${host}`}
          {checked === null ? null : (
            <>
              {" · "}
              Checked <time dateTime={partner.lastVerified}>{checked}</time>
            </>
          )}
        </p>
      </div>
    </article>
  );
}
