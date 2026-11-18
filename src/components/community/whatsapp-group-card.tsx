import { useId } from "react";
import type { WhatsappGroup } from "@/data/schemas";
import { cx } from "@/components/ui/cx";
import { formatCheckDate } from "./card-format";
import { WhatsappSafetyNote } from "./safety-note";
import { EDITION_LABELS } from "./whatsapp-filter";

export interface WhatsappGroupCardProps {
  group: WhatsappGroup;
  /** Heading level for the group title, so the card fits the region outline. */
  headingLevel?: 3 | 4;
  className?: string;
}

/**
 * One community chat.
 *
 * The card is not itself a link. A whole-card link would make the safety note and
 * the checked date part of the link's accessible name, and would leave no way to
 * read the warning without leaving the page. Instead the title is a heading and a
 * single "Join on WhatsApp" anchor sits at the foot of the card.
 *
 * The title is printed exactly as stored, emoji included, because it is the name
 * readers will look for in WhatsApp.
 */
export function WhatsappGroupCard({ group, headingLevel = 4, className }: WhatsappGroupCardProps) {
  const Heading = `h${headingLevel}` as "h3" | "h4";
  const checked = formatCheckDate(group.lastLinkCheck);
  const editionLabel = EDITION_LABELS[group.edition];
  // `useId` rather than the record id: the id is unique in the data, but a
  // component reused on another page cannot then collide with itself.
  const titleId = `${useId()}-title`;

  return (
    <article
      className={cx(
        "flex h-full flex-col rounded-[var(--radius-card)] border border-hair bg-gradient-to-b from-surface-2 to-surface p-5",
        className,
      )}
      aria-labelledby={titleId}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-hair-strong px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-mute">
          {group.region}
        </span>
        <span className="rounded-full border border-hair px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-mute">
          {editionLabel}
        </span>
      </div>

      <Heading
        id={titleId}
        className="mt-3 font-display text-lg leading-snug [overflow-wrap:anywhere]"
      >
        {group.title}
      </Heading>

      <WhatsappSafetyNote className="mt-4" />

      {checked === null ? null : (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-mute">
          Link checked{" "}
          <time dateTime={group.lastLinkCheck}>{checked}</time>
        </p>
      )}

      <a
        href={group.inviteUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-auto inline-flex min-h-11 items-center gap-2 pt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-accent underline-offset-4 hover:underline"
        >
          Join on WhatsApp
          <span aria-hidden="true">↗</span>
          {/* The visible label is the same on every card, so the accessible name
              adds which group it opens. */}
          <span className="sr-only">{` — ${group.title} (opens in a new tab)`}</span>
        </a>
    </article>
  );
}
