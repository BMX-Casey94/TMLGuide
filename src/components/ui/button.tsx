import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
/* Kit styles travel with the component so any page that uses it is styled. */
import "./ui.css";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

interface CommonButtonProps {
  variant?: ButtonVariant;
  /** `md` is 44px tall, `lg` is 52px. */
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

export interface ButtonProps
  extends CommonButtonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "disabled"> {
  disabled?: boolean;
  /**
   * Shows a loading state: sets `aria-busy`, disables the control and swaps the
   * visible text for `loadingLabel`. The accessible name stays the action label,
   * so assistive technology hears "Example action, busy" rather than losing the
   * button's purpose mid-request.
   */
  loading?: boolean;
  /** Visible text while `loading` is true, for example "Sending". */
  loadingLabel?: string;
}

function buttonClasses(variant: ButtonVariant, size: ButtonSize, className?: string): string {
  return cx("tml-btn", `tml-btn--${variant}`, `tml-btn--${size}`, className);
}

/**
 * Action button. The focus ring comes from the global `:focus-visible` rule, so
 * the accent follows the current edition.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  loading = false,
  loadingLabel = "Loading",
  type = "button",
  disabled = false,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <span className="tml-btn__spinner" aria-hidden="true" />
          {/* The action keeps its accessible name; the visible text reports progress. */}
          <span aria-hidden="true">{loadingLabel}</span>
          <span className="tml-btn__sr">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export interface ButtonLinkProps
  extends CommonButtonProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> {
  href: string;
}

/** Navigation control styled as a button. Renders a single anchor. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link {...rest} href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}

