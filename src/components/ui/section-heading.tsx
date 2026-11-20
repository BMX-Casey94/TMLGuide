import Link from "next/link";
import type { ReactNode } from "react";
/* Kit styles travel with the component so any page that uses it is styled. */
import "./ui.css";
import { cx } from "./cx";

export interface SectionHeadingProps {
  /** Tracked mono label above the title. */
  kicker: string;
  /** Serif display title. */
  title: ReactNode;
  /** Optional supporting sentence, capped at 62 characters per line unit. */
  lede?: ReactNode;
  /** Optional slot for a link or button, aligned with the title on wide screens. */
  action?: ReactNode;
  /** Anchor target for `aria-labelledby` on the surrounding section. */
  id?: string;
  /**
   * Whether the heading draws the hairline above itself. Defaults to `"top"`,
   * which is what every page outside the home page expects.
   *
   * Set `"none"` when something directly above the heading already breaks the
   * page: a `GoldDivider`, or a full-width band with its own edge. Two rules a
   * few pixels apart read as a mistake, and the divider convention allows only
   * one break between two sections.
   */
  hairline?: "top" | "none";
  className?: string;
}

/**
 * Section opener: mono kicker, serif h2 and an optional lede with a link slot.
 * The hairline above the heading matches the section rules in the direction doc.
 */
export function SectionHeading({
  kicker,
  title,
  lede,
  action,
  id,
  hairline = "top",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cx("tml-section-head", hairline === "none" && "tml-section-head--bare", className)}
    >
      <div className="tml-section-head__headline">
        <p className="label text-accent">{kicker}</p>
        <h2 id={id} className="tml-section-head__title">
          {title}
        </h2>
      </div>
      {lede || action ? (
        <div className="tml-section-head__aside">
          {lede ? <p className="tml-section-head__lede">{lede}</p> : null}
          {action ? <div className="tml-section-head__action">{action}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export interface SectionActionProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/** A quiet text link sized for the section-heading action slot. */
export function SectionAction({ href, children, className }: SectionActionProps) {
  return (
    <Link href={href} className={cx("tml-section-link", className)}>
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

