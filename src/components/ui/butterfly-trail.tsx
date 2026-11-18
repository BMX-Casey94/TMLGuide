import Image from "next/image";
import type { CSSProperties } from "react";
/* Kit styles travel with the component so any page that uses it is styled. */
import "./ui.css";
import { cx } from "./cx";

export type ButterflyTrailSide = "left" | "right";
export type ButterflyTrailDrift = "slow" | "medium";

export interface ButterflyTrailProps {
  /** Which edge of the section the trail hugs. Left mirrors the artwork. */
  side?: ButterflyTrailSide;
  /** Overall opacity, 0 to 1. */
  opacity?: number;
  /** Rendered width as a CSS length. Clamped to the viewport by the component. */
  width?: string;
  /** Load the image immediately, for a trail that is above the fold. */
  priority?: boolean;
  /** How far the trail travels as it scrolls past. */
  drift?: ButterflyTrailDrift;
  className?: string;
}

/* The artwork is 1280x563, trimmed from the source by
   scripts/process-brand-assets.mjs. */
const ASSET_WIDTH = 1280;
const ASSET_HEIGHT = 563;

/**
 * Decorative butterfly flight trail with a scroll-linked drift.
 *
 * IMPORTANT for consumers: the drift moves the artwork sideways as well as
 * vertically, so the containing section must clip overflow (`overflow-x: clip`)
 * or the trail can add a horizontal scrollbar on narrow screens. The component
 * caps itself at `100vw` but cannot clip a parent.
 *
 * No JavaScript is involved: the drift is a CSS scroll-driven animation behind
 * `@supports (animation-timeline: view())`, and browsers without that support get
 * the static image. Reduced motion also gets the static image.
 */
export function ButterflyTrail({
  side = "right",
  opacity = 0.55,
  width = "min(560px, 80vw)",
  priority = false,
  drift = "slow",
  className,
}: ButterflyTrailProps) {
  const clampedOpacity = Math.min(1, Math.max(0, opacity));

  return (
    <div
      className={cx("tml-trail", `tml-trail--${side}`, className)}
      style={
        {
          "--bt-width": width,
          "--bt-opacity": clampedOpacity,
          "--bt-drift": drift === "medium" ? "7rem" : "3.5rem",
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <Image
        className="tml-trail__img"
        src="/brand/butterfly-trail-1280.webp"
        alt=""
        width={ASSET_WIDTH}
        height={ASSET_HEIGHT}
        sizes="(max-width: 700px) 80vw, 560px"
        /* `priority` is deprecated in Next.js 16 in favour of `preload`, which
           means the same thing: fetch the image in the document head. The public
           prop keeps the kit's documented name. */
        preload={priority}
      />
    </div>
  );
}

