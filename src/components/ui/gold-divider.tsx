import { useId } from "react";
/* Kit styles travel with the component so any page that uses it is styled. */
import "./ui.css";
import { cx } from "./cx";

export type ButterflyPosition = "none" | "left" | "right";

export interface GoldDividerProps {
  /** Where the decorative butterfly sits relative to the sparkle. */
  butterfly?: ButterflyPosition;
  className?: string;
}

/**
 * Ornamental section break: a gold hairline that fades out at both ends, a
 * centred four-point sparkle, two small dots and an optional butterfly. Purely
 * decorative, so it is hidden from assistive technology.
 *
 * The hairline is its own SVG with `preserveAspectRatio="none"` so it stays a
 * true 1px rule at any width, while the ornament keeps natural proportions in a
 * second, fixed-size SVG. One stretched SVG would distort the star and wings.
 *
 * Gradient ids come from `useId` so two dividers on one page never collide.
 */
export function GoldDivider({ butterfly = "none", className }: GoldDividerProps) {
  const gradientId = useId();
  const hairGradientId = `${gradientId}-hair`;
  const ornamentGradientId = `${gradientId}-ornament`;
  const butterflyTransform = butterfly === "left" ? "translate(-46 0)" : "translate(46 0)";

  return (
    <div className={cx("tml-divider", className)} role="presentation" aria-hidden="true">
      <svg
        className="tml-divider__hair"
        viewBox="0 0 1200 1"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id={hairGradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8a6a1f" stopOpacity="0" />
            <stop offset="0.12" stopColor="#8a6a1f" stopOpacity="0.75" />
            <stop offset="0.5" stopColor="#e9c46a" stopOpacity="1" />
            <stop offset="0.88" stopColor="#fff1c2" stopOpacity="0.7" />
            <stop offset="1" stopColor="#fff1c2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1200" height="1" fill={`url(#${hairGradientId})`} />
      </svg>

      <span className="tml-divider__shimmer" />

      <svg
        className="tml-divider__ornament"
        width="164"
        height="40"
        viewBox="-82 -20 164 40"
        focusable="false"
      >
        <defs>
          <linearGradient id={ornamentGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1c2" />
            <stop offset="0.55" stopColor="#e9c46a" />
            <stop offset="1" stopColor="#8a6a1f" />
          </linearGradient>
        </defs>

        {/* two small dots flanking the star */}
        <circle cx="-26" cy="0" r="1.5" fill="#e9c46a" opacity="0.72" />
        <circle cx="26" cy="0" r="1.5" fill="#e9c46a" opacity="0.72" />

        {/* four-point sparkle: concave sides, drawn from cubic beziers */}
        <path
          d="M0 -10C1.6 -3.6 3.6 -1.6 10 0C3.6 1.6 1.6 3.6 0 10C-1.6 3.6 -3.6 1.6 -10 0C-3.6 -1.6 -1.6 -3.6 0 -10Z"
          fill={`url(#${ornamentGradientId})`}
        />
        <circle cx="0" cy="0" r="1.15" fill="#0c0a09" opacity="0.55" />

        {butterfly === "none" ? null : (
          <g
            transform={butterflyTransform}
            fill={`url(#${ornamentGradientId})`}
            opacity="0.8"
          >
            {/* upper wings */}
            <path d="M0.9 -1.1C3.4 -9.4 10.4 -12 12.6 -8.5C14.7 -5 9.7 0.1 0.9 1.1Z" />
            <path d="M-0.9 -1.1C-3.4 -9.4 -10.4 -12 -12.6 -8.5C-14.7 -5 -9.7 0.1 -0.9 1.1Z" />
            {/* lower wings */}
            <path d="M0.6 1.4C5.6 1.5 9.6 3.5 8.7 7.1C7.9 10.2 3.2 10.3 0.4 5.3Z" />
            <path d="M-0.6 1.4C-5.6 1.5 -9.6 3.5 -8.7 7.1C-7.9 10.2 -3.2 10.3 -0.4 5.3Z" />
            {/* body and antennae */}
            <path d="M0 -6.4C1.1 -3.9 1.15 3.9 0 8.3C-1.15 3.9 -1.1 -3.9 0 -6.4Z" />
            <path
              d="M0 -6.1C-2.1 -9.2 -3.5 -10.4 -4.8 -11"
              fill="none"
              stroke="#e9c46a"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
            <path
              d="M0 -6.1C2.1 -9.2 3.5 -10.4 4.8 -11"
              fill="none"
              stroke="#e9c46a"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
}



