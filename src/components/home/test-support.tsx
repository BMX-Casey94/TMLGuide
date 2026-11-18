import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { isKnownRoute } from "./routes";

/**
 * Helpers shared by the home and About page tests.
 *
 * `next/link` renders an ordinary anchor under jsdom, so the pages need no
 * router provider. What does need care is the route assertion: every internal
 * link must resolve to a destination the site has agreed to serve, and that
 * check should be written once rather than repeated in six files.
 */

/** True when a same-site link points at a route the site knows about. */
export function isInternalLink(href: string): boolean {
  return isKnownRoute(href);
}

/**
 * Renders a component that uses `next/link`.
 *
 * A thin wrapper on purpose: it marks the call site as one that depends on the
 * router's link behaviour, and gives a future need for a router context a single
 * place to live.
 */
export function renderAsRouter(ui: ReactElement) {
  return render(ui);
}
