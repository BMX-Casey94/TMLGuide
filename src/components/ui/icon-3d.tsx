import Image from "next/image";
/* Kit styles travel with the component so any page that uses it is styled. */
import "./ui.css";
import { cx } from "./cx";

/**
 * Every file in `public/icons/3d`. The list is checked against the directory by
 * `icon-3d.test.ts`, so a renamed or removed asset fails the test suite rather than
 * a page at runtime.
 */
export const ICON_3D_NAMES = [
  "bag",
  "camera",
  "chart",
  "computer",
  "credit-card",
  "file-text",
  "fire",
  "flag",
  "flash",
  "gift",
  "headphone",
  "key",
  "link",
  "lock",
  "locker",
  "magic-trick",
  "map-pin",
  "medal",
  "money-bag",
  "music",
  "notebook",
  "puzzle",
  "rocket",
  "setting",
  "shield",
  "star",
  "target",
  "thumb-up",
  "tick",
  "tools",
  "trophy",
  "video-cam",
  "wallet",
] as const;

export type Icon3DName = (typeof ICON_3D_NAMES)[number];

export interface Icon3DProps {
  /** Which icon to render. */
  name: Icon3DName;
  /** Width and height in CSS pixels. */
  size?: number;
  /** Draw a soft edition-accent glow behind the icon. */
  glow?: boolean;
  /** Accessible text. Leave empty when the icon is decorative. */
  alt?: string;
  className?: string;
}

/**
 * A 3D icon from the curated set. Decorative by default (`alt=""`), so a screen
 * reader skips it and the surrounding heading carries the meaning.
 */
export function Icon3D({ name, size = 48, glow = false, alt = "", className }: Icon3DProps) {
  return (
    <span
      className={cx("tml-icon3d", glow && "tml-icon3d--glow", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <Image
        className="tml-icon3d__img"
        src={`/icons/3d/${name}.webp`}
        alt={alt}
        width={size}
        height={size}
      />
    </span>
  );
}

