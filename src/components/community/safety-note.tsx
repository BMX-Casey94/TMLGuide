import { cx } from "@/components/ui/cx";

/**
 * The safety note shown with every WhatsApp group.
 *
 * One list of statements feeds both the compact block inside each card and the
 * full note above the directory, so the two can never drift apart and a test can
 * assert the required warnings are present wherever the note appears.
 *
 * The wording is deliberately specific: "unofficial", "never share ticket
 * details, wristband numbers, passport or payment details", "admins will never
 * ask you for payment" and the impersonation warning are all non-negotiable on a
 * page that links strangers' group chats.
 */
export const WHATSAPP_SAFETY_POINTS = [
  "Unofficial community group, not run by Tomorrowland, WeAreOne.World B.V. or TMLGuide.",
  "Never share ticket details, wristband numbers, passport or payment details.",
  "Admins will never ask you for payment.",
  "Beware impersonators: a name and photo prove nothing.",
] as const;

/** Shown once above the directory, where there is room for the reasoning. */
export const WHATSAPP_SAFETY_INTRO =
  "These chats are run by other attendees, and anyone can join one. Read this before you post.";

/** Closing advice in the full note. Guidance, not a claim about the groups. */
export const WHATSAPP_SAFETY_ADVICE =
  "If anyone asks for payment or personal details, stop and check through an official Tomorrowland channel.";

export type WhatsappSafetyVariant = "card" | "full";

export interface WhatsappSafetyNoteProps {
  /** `card` is the compact block inside a group card; `full` is the page-level note. */
  variant?: WhatsappSafetyVariant;
  className?: string;
}

/**
 * The safety note. Deliberately not an alert landmark: there is one on every
 * card, and 24 landmarks would bury the page structure for screen reader users.
 * The words carry the warning, not the styling.
 */
export function WhatsappSafetyNote({ variant = "card", className }: WhatsappSafetyNoteProps) {
  const items = (
    <ul
      className={cx(
        "list-disc pl-4",
        variant === "card" ? "space-y-1 text-[0.7rem] leading-snug" : "mt-3 space-y-2 text-sm",
      )}
    >
      {WHATSAPP_SAFETY_POINTS.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
  );

  if (variant === "full") {
    return (
      <section
        aria-labelledby="whatsapp-safety-title"
        className={cx(
          "mt-8 rounded-[var(--radius-card)] border border-ember/30 bg-ember/[0.06] p-5 sm:p-6",
          className,
        )}
      >
        <p className="label text-ember">Safety</p>
        <h3 id="whatsapp-safety-title" className="mt-2 font-display text-xl">
          Read this before you join a group
        </h3>
        <p className="mt-2 text-sm text-cream-mute">{WHATSAPP_SAFETY_INTRO}</p>
        {items}
        <p className="mt-3 text-sm text-cream-mute">{WHATSAPP_SAFETY_ADVICE}</p>
      </section>
    );
  }

  return (
    <div
      className={cx(
        "mt-1 rounded-xl border border-ember/25 bg-ember/[0.05] px-3 py-2.5 text-cream-mute",
        className,
      )}
    >
      <p className="label text-ember">Safety</p>
      <div className="mt-1.5">{items}</div>
    </div>
  );
}
