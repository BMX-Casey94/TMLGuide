import Link from "next/link";
import { Icon3D, type Icon3DName } from "@/components/ui/icon-3d";
import "@/components/ui/ui.css";
import "./tools.css";

/** Whether a tool is ready to use or still to come. */
export type ToolCardStatus = "live" | "planned";

export interface ToolCardProps {
  readonly href: string;
  readonly title: string;
  /** One sentence: what question the tool answers. */
  readonly description: string;
  readonly icon: Icon3DName;
  readonly status: ToolCardStatus;
  /** Short mono label above the title, for example "Budget". */
  readonly kicker: string;
}

const STATUS_TEXT: Readonly<Record<ToolCardStatus, string>> = {
  live: "Ready",
  planned: "Coming soon",
};

/**
 * A tool in the hub grid.
 *
 * The card is one link when the tool exists. A planned tool renders as a
 * non-interactive article with its status in words, rather than a link that
 * goes nowhere: a dead link is worse than an honest "coming soon".
 */
export function ToolCard({ href, title, description, icon, status, kicker }: ToolCardProps) {
  const body = (
    <>
      <div className="tool-card__top">
        <p className="label text-cream-mute">{kicker}</p>
        <span className={`tool-card__status tool-card__status--${status}`}>{STATUS_TEXT[status]}</span>
      </div>
      <Icon3D name={icon} size={56} glow className="tool-card__icon" />
      <h2 className="tool-card__title">{title}</h2>
      <p className="tool-card__body">{description}</p>
      {status === "live" ? (
        <span className="tool-card__cta label" aria-hidden="true">
          Open
          <span aria-hidden="true">→</span>
        </span>
      ) : null}
    </>
  );

  if (status === "planned") {
    return <article className="tool-card tool-card--planned">{body}</article>;
  }

  return (
    <Link href={href} className="tool-card tool-card--link group">
      {body}
    </Link>
  );
}
