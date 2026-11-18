import Link from "next/link";
import type { ReactNode } from "react";
/* Kit styles travel with the component so any page that uses it is styled. */
import "./ui.css";
import { cx } from "./cx";
import { Icon3D } from "./icon-3d";
import type { Icon3DName } from "./icon-3d";

export type CardVariant = "standard" | "feature" | "stat" | "alert";
export type CardHeadingLevel = 2 | 3 | 4;

interface CardCommon {
  /** Mono label above the title. */
  kicker: string;
  /** Body copy. */
  children?: ReactNode;
  /** Heading level for the card title. Defaults to 3. */
  headingLevel?: CardHeadingLevel;
  /** 3D icon shown at the top of the card. */
  icon?: Icon3DName;
  /** Makes the whole card a single link to this destination. */
  href?: string;
  /** Small status pill, for example "Verified". */
  badge?: string;
  /** ISO date of the last check, rendered as "Checked 12 Mar 2027". */
  verifiedOn?: string;
  className?: string;
}

interface ContentCardProps extends CardCommon {
  variant?: "standard" | "feature";
  /** Card title, rendered at `headingLevel`. */
  title: string;
}

interface AlertCardProps extends CardCommon {
  variant: "alert";
  title: string;
  /**
   * Visible text prefix such as "Scam alert". Required so the warning never
   * depends on the ember edge colour alone.
   */
  statusLabel: string;
}

interface StatCardProps extends CardCommon {
  variant: "stat";
  /** The figure, rendered large in the display serif. */
  value: string | number;
  /** Unit shown beside the figure. */
  unit?: string;
  /** Caption under the figure, and the card heading text. */
  label: string;
}

export type CardProps = ContentCardProps | AlertCardProps | StatCardProps;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  /* Pin the zone: an unpinned formatter renders in the runtime timezone, which
     can shift the day by one and differ between the server and the browser. */
  timeZone: "UTC",
});

/**
 * Formats an ISO date (date-only or full timestamp) as "12 Mar 2027".
 * Returns null for anything unparseable so the caller can omit the line.
 */
function formatCheckedDate(iso: string): string | null {
  const value = iso.trim();
  const normalised = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(normalised);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

/** The accent edge differs per variant: standard cards use the left edge. */
function edgeClass(variant: CardVariant): string {
  if (variant === "alert") return "tml-card--alert";
  if (variant === "feature") return "tml-card--top";
  return "tml-card--left";
}

/**
 * The Dusk Programme card: layered dusk surface, hairline border, edition-accent
 * edge, glowing 3D icon and a quiet hover lift. One component covers the guide
 * card, the feature card, the stat tile and the safety alert.
 */
export function Card(props: CardProps) {
  const { kicker, icon, href, badge, verifiedOn, headingLevel = 3, children, className } = props;
  const variant = props.variant ?? "standard";
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  const isAlert = props.variant === "alert";
  const isStat = props.variant === "stat";

  const heading = isStat ? props.label : props.title;
  const checkedLabel = verifiedOn ? formatCheckedDate(verifiedOn) : null;
  const shownIcon: Icon3DName | undefined = isAlert ? (icon ?? "shield") : icon;

  const rootClassName = cx(
    "tml-card",
    edgeClass(variant),
    href && "tml-card--interactive group",
    className,
  );

  const body = (
    <div className="tml-card__body">
      <div className="tml-card__top">
        <p className="label text-cream-mute">{kicker}</p>
        {badge ? <span className="tml-card__badge label">{badge}</span> : null}
      </div>

      {isAlert ? <p className="tml-card__status label">{props.statusLabel}</p> : null}

      {isStat ? (
        <p className="tml-card__stat-value">
          <span>{props.value}</span>
          {props.unit ? <span className="tml-card__stat-unit">{props.unit}</span> : null}
        </p>
      ) : shownIcon ? (
        <Icon3D
          name={shownIcon}
          size={variant === "feature" ? 72 : 56}
          glow
          className={cx("tml-card__icon", variant === "feature" && "tml-card__icon--lg")}
        />
      ) : null}

      <Heading
        className={cx(
          "tml-card__title",
          variant === "feature" && "tml-card__title--feature",
          isStat && "tml-card__title--stat",
        )}
      >
        {heading}
      </Heading>

      {children ? <div className="tml-card__prose">{children}</div> : null}

      {checkedLabel ? (
        <p className="tml-card__checked label">
          Checked <time dateTime={verifiedOn}>{checkedLabel}</time>
        </p>
      ) : null}

      {href ? (
        <span className="tml-card__cta label" aria-hidden="true">
          Open
          <span className="tml-card__arrow">→</span>
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={rootClassName}>
        {body}
      </Link>
    );
  }

  return <article className={rootClassName}>{body}</article>;
}

