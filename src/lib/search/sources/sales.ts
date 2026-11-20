import { saleWindows as belgiumSaleWindows } from "@/data/belgium";
import { winterSaleWindows } from "@/data/winter";
import { brasilSaleWindows } from "@/data/brasil";
import { recordAnchor } from "../anchors";
import { formatInstantLong } from "../format";
import { joinSnippet } from "./types";
import type { SourceEntry } from "./types";

/**
 * Sale windows, from the three validated collections.
 *
 * Belgium and Winter quote every instant in Belgian local time and pin the zone
 * to `Europe/Brussels`; Brasil quotes its own in `America/Sao_Paulo`, because
 * Brazilian sales are announced in BRT. The zone comes from the record, never
 * from the visitor's clock, so the date in a result cannot drift by an hour or a
 * day.
 *
 * All of them link to the sale timeline, which renders each window with a
 * countdown and a calendar file.
 */
export const saleEntries: SourceEntry[] = [
  ...belgiumSaleWindows.map((window) => ({
    slug: `belgium-${window.id}`,
    title: window.name,
    snippet: joinSnippet([
      formatInstantLong(window.opensAt, window.timeZone),
      window.audience,
      window.notes,
    ]),
    edition: "belgium" as const,
    href: "/tools/sale-timeline" as const,
    anchor: recordAnchor("sale", window.id),
    source: "src/data/belgium/sale-windows.ts",
    sourceUrl: window.source.url,
    lastVerified: window.lastVerified,
  })),
  ...winterSaleWindows.map((window) => ({
    slug: `winter-${window.id}`,
    title: window.name,
    snippet: joinSnippet([
      formatInstantLong(window.opensAt, window.timeZone),
      window.audience,
      window.notes,
    ]),
    edition: "winter" as const,
    href: "/tools/sale-timeline" as const,
    anchor: recordAnchor("sale", window.id),
    source: "src/data/winter/sale-windows.ts",
    sourceUrl: window.source.url,
    lastVerified: window.lastVerified,
  })),
  ...brasilSaleWindows.map((window) => ({
    slug: `brasil-${window.id}`,
    title: window.name,
    snippet: joinSnippet([
      formatInstantLong(window.opensAt, window.timeZone),
      window.status === "past" ? "Closed" : window.status === "open" ? "Open now" : "Upcoming",
      window.audience,
    ]),
    edition: "brasil" as const,
    href: "/tools/sale-timeline" as const,
    anchor: recordAnchor("sale", window.id),
    source: "src/data/brasil/facts.ts",
    sourceUrl: window.source.url,
    lastVerified: window.lastVerified,
  })),
];
