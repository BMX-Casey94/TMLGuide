/**
 * Distance formatting shared by the venue maps and the winter transit timer.
 *
 * This module used to hold the schematic map's Dijkstra implementation as well.
 * That diagram has been replaced by a real MapLibre map drawing the same walk on
 * `src/lib/maps/geo-data.ts`, so the only thing still needed here is the miles
 * formatter — which the winter timer imports as `../maps/maps-logic`.
 *
 * The guide speaks in miles throughout, so nothing here converts to kilometres.
 */

/** Rounds to two decimal places, the precision every distance figure in the guide uses. */
function roundMiles(miles: number): number {
  return Math.round(miles * 100) / 100;
}

/**
 * Formats a distance in miles using UK English phrasing.
 * Never outputs kilometres.
 */
export function formatMiles(miles: number): string {
  const rounded = roundMiles(miles);
  if (rounded === 0) return "0 miles";
  const formatted = rounded.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} ${rounded === 1 ? "mile" : "miles"}`;
}
