/**
 * The source line every price and fact carries.
 *
 * The brief requires a visible citation and a check date beside anything drawn
 * from data, so this component is used on cards, detail views and the explainer
 * rather than being optional decoration.
 */
import { formatCheckedDate } from "./format";
import type { Source } from "@/data/schemas";
import "./tickets.css";

export interface SourceLineProps {
  source: Source;
  lastVerified: string;
  /** Prefix for the link text, for example "Official page". */
  label?: string;
}

export function SourceLine({ source, lastVerified, label = "Source" }: SourceLineProps) {
  const checked = formatCheckedDate(lastVerified);

  return (
    <p className="tml-tix-source">
      <span>{label}:</span>
      <a
        className="tml-tix-source__link"
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {source.title}
        <span className="tml-tix-sr"> (opens in a new tab)</span>
      </a>
      {checked === null ? null : (
        <>
          <span aria-hidden="true">·</span>
          <span>
            Checked <time dateTime={lastVerified}>{checked}</time>
          </span>
        </>
      )}
    </p>
  );
}
