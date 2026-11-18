/**
 * Layout metrics shared between the Client Components that draw chrome and the Server Components
 * that reserve space for it.
 *
 * This module has no directive, so both sides import the values as plain numbers. A constant
 * imported from a Client Component module would arrive on the server as a client reference instead.
 */

/** The mobile tab bar's own content height, excluding its border and the device safe-area inset. */
export const TABBAR_HEIGHT_PX = 64;

/** The tab bar's hairline top border. */
export const TABBAR_BORDER_PX = 1;

/**
 * Everything the tab bar occupies at the bottom of a viewport except the device inset, which varies
 * per device and is added as `env(safe-area-inset-bottom)` wherever this value is used. The layout
 * also exposes the same height as `--tabbar-h` in globals.css.
 */
export const TABBAR_TOTAL_HEIGHT_PX = TABBAR_HEIGHT_PX + TABBAR_BORDER_PX;
