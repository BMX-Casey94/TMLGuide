import type { ReactNode } from "react";
/* Kit styles travel with the component so any page that uses it is styled. */
import "./ui.css";
import { cx } from "./cx";

export interface CardCarouselProps {
  /** Accessible name for the region. */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Card group that becomes a swipeable snap carousel on narrow screens and a
 * two or three column grid from 700px and 1100px up.
 *
 * The scrollable element is the region itself and is focusable, so keyboard
 * users can move it with the arrow keys. The edge fades sit on the outer wrapper
 * so they stay put while the track scrolls under them.
 */
export function CardCarousel({ label, children, className }: CardCarouselProps) {
  return (
    <div className={cx("tml-carousel", className)}>
      <div className="tml-carousel__track" role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
    </div>
  );
}

