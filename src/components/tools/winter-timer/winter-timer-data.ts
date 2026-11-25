import { winterStages } from "@/data/winter/stages";
import { winterFacts } from "@/data/winter/facts";

export type WinterTravelMode = "ski" | "pedestrian";
export type WinterCrowdLevel = "light" | "standard" | "peak";
export type WinterZoneGroup = "mountain" | "apres" | "village" | "hub";

export interface WinterZone {
  readonly id: string;
  readonly name: string;
  readonly group: WinterZoneGroup;
  /** Optional stage id matching `src/data/winter/stages.ts`. */
  readonly stageId?: string;
  readonly elevationLabel: string;
  readonly hoursSummary: string;
  readonly accessNote: string;
}

export interface WinterRouteLeg {
  readonly from: string;
  readonly to: string;
  /** Approximate distance in miles (UK English — never km). */
  readonly distanceMiles: number;
  /** Connection label (lift, gondola, town lift, piste, or footpath). */
  readonly connectionLabel: string;
  /** Travel breakdown when skiing or snowboarding. */
  readonly ski: {
    readonly walkOrSkiMinutes: number;
    readonly liftMinutes: number;
    readonly baseQueueMinutes: number;
  };
  /** Travel breakdown when travelling as a pedestrian / gondola user. */
  readonly pedestrian: {
    readonly walkOrSkiMinutes: number;
    readonly liftMinutes: number;
    readonly baseQueueMinutes: number;
  };
}

function stageDescription(id: string, fallback: string): string {
  return winterStages.find((stage) => stage.id === id)?.description ?? fallback;
}

export function getWinterFactValue(id: string): string {
  return winterFacts.find((fact) => fact.id === id)?.value ?? "";
}

export const WINTER_TIMER_DISCLAIMER =
  "Planning estimates only — not an official Tomorrowland Winter or Alpe d'Huez lift timetable. Actual transit times depend on Alpine weather, wind holds, piste conditions, and lift queues. Check live resort lift status before setting off.";

export const WINTER_ZONES: readonly WinterZone[] = [
  {
    id: "alpe-village-centre",
    name: "Alpe d'Huez Village (Bergers / Snow Front)",
    group: "hub",
    elevationLabel: "Resort base (~1,860 m)",
    hoursSummary: "Free Télécentre & Alpe Express town lifts plus 4 free Resalp bus lines",
    accessNote:
      "Central resort hub connecting accommodation, snow-front lifts, and the Bergers lift base.",
  },
  {
    id: "frozen-lotus-2027",
    name: "Frozen Lotus",
    group: "mountain",
    stageId: "frozen-lotus-2027",
    elevationLabel: "Mountain (~2,300 m, Marmottes)",
    hoursSummary: "12:00–17:00 Sat–Mon · 12:00–17:30 Tue–Fri",
    accessNote: stageDescription(
      "frozen-lotus-2027",
      "Daytime mountain stage reached via the Les Marmottes 1 lift from Bergers to Marmottes 2300.",
    ),
  },
  {
    id: "orbyz-2027",
    name: "Orbyz",
    group: "mountain",
    stageId: "orbyz-2027",
    elevationLabel: "Mountain (daytime area)",
    hoursSummary: "12:00–17:00 Sat–Mon · 12:00–17:30 Tue–Fri",
    accessNote: stageDescription(
      "orbyz-2027",
      "Daytime mountain stage in the 2027 line-up; accessible by skiers and pedestrians with the lift and ski pass.",
    ),
  },
  {
    id: "life-2027",
    name: "Life",
    group: "mountain",
    stageId: "life-2027",
    elevationLabel: "Mountain (daytime area)",
    hoursSummary: "12:00–17:00 Sat–Mon · 12:00–17:30 Tue–Fri",
    accessNote: stageDescription(
      "life-2027",
      "Daytime mountain stage in the 2027 line-up; accessible by skiers and pedestrians with the lift and ski pass.",
    ),
  },
  {
    id: "moose-bar-2027",
    name: "Moose Bar",
    group: "apres",
    stageId: "moose-bar-2027",
    elevationLabel: "Snow-front / village edge",
    hoursSummary: "15:00–19:30 Sat–Fri (daytime slot)",
    accessNote: stageDescription(
      "moose-bar-2027",
      "Daytime après-ski stage running 15:00–19:30 Saturday to Friday.",
    ),
  },
  {
    id: "mainstage-2027",
    name: "MainStage",
    group: "village",
    stageId: "mainstage-2027",
    elevationLabel: "Village main festival area",
    hoursSummary: "19:00–01:30 Tue–Fri (closed Sat–Mon)",
    accessNote: stageDescription(
      "mainstage-2027",
      "Covered and heated night MainStage in the village main festival area (open Tue 23–Fri 26 March).",
    ),
  },
  {
    id: "cage-2027",
    name: "Cage",
    group: "village",
    stageId: "cage-2027",
    elevationLabel: "Village main festival area",
    hoursSummary: "19:00–00:00 Sat–Mon · 19:00–01:30 Tue–Fri",
    accessNote: stageDescription(
      "cage-2027",
      "Night stage in the village main festival area alongside MainStage and Planaxis.",
    ),
  },
  {
    id: "planaxis-2027",
    name: "Planaxis",
    group: "village",
    stageId: "planaxis-2027",
    elevationLabel: "Village main festival area",
    hoursSummary: "19:00–00:00 Sat–Mon · 19:00–01:30 Tue–Fri",
    accessNote: stageDescription(
      "planaxis-2027",
      "Night stage in the village main festival area alongside MainStage and Cage.",
    ),
  },
  {
    id: "oz-3300",
    name: "Oz 3300 (Base Village)",
    group: "hub",
    elevationLabel: "Surrounding village (lift-linked)",
    hoursSummary: "Last daytime lift 16:45 · Night lift 18:30–21:00 & 22:30–00:30 (02:00 MainStage days)",
    accessNote:
      "Linked to Alpe d'Huez via gondola/lift (~20 min night lift with the €40 Transportation Pass, included in Oz 3300 packages). Walking between villages is prohibited.",
  },
];

/**
 * Directed schematic transit legs between Alpe d'Huez resort hubs and 2027 stages.
 * Uphill vs downhill legs are modelled separately because skiing downhill avoids
 * a return gondola queue, whereas uphill always requires a lift/gondola ride.
 */
export const WINTER_ROUTE_LEGS: readonly WinterRouteLeg[] = [
  // Village hub <-> Frozen Lotus (Les Marmottes 1 from Bergers to Marmottes 2300)
  {
    from: "alpe-village-centre",
    to: "frozen-lotus-2027",
    distanceMiles: 1.15,
    connectionLabel: "Alpe Express / Bergers approach + Les Marmottes 1 lift",
    ski: { walkOrSkiMinutes: 6, liftMinutes: 10, baseQueueMinutes: 8 },
    pedestrian: { walkOrSkiMinutes: 9, liftMinutes: 12, baseQueueMinutes: 10 },
  },
  {
    from: "frozen-lotus-2027",
    to: "alpe-village-centre",
    distanceMiles: 1.15,
    connectionLabel: "Piste descent to Bergers (ski) or Les Marmottes 1 gondola down (pedestrian)",
    ski: { walkOrSkiMinutes: 10, liftMinutes: 0, baseQueueMinutes: 3 },
    pedestrian: { walkOrSkiMinutes: 8, liftMinutes: 12, baseQueueMinutes: 8 },
  },

  // Village hub <-> Orbyz
  {
    from: "alpe-village-centre",
    to: "orbyz-2027",
    distanceMiles: 1.25,
    connectionLabel: "Snow-front gondola ascent towards daytime mountain zone",
    ski: { walkOrSkiMinutes: 7, liftMinutes: 12, baseQueueMinutes: 9 },
    pedestrian: { walkOrSkiMinutes: 10, liftMinutes: 14, baseQueueMinutes: 10 },
  },
  {
    from: "orbyz-2027",
    to: "alpe-village-centre",
    distanceMiles: 1.25,
    connectionLabel: "Piste return to snow front (ski) or gondola descent (pedestrian)",
    ski: { walkOrSkiMinutes: 11, liftMinutes: 0, baseQueueMinutes: 3 },
    pedestrian: { walkOrSkiMinutes: 9, liftMinutes: 14, baseQueueMinutes: 9 },
  },

  // Village hub <-> Life
  {
    from: "alpe-village-centre",
    to: "life-2027",
    distanceMiles: 1.05,
    connectionLabel: "Resort gondola ascent to daytime mountain sector",
    ski: { walkOrSkiMinutes: 6, liftMinutes: 10, baseQueueMinutes: 8 },
    pedestrian: { walkOrSkiMinutes: 9, liftMinutes: 12, baseQueueMinutes: 9 },
  },
  {
    from: "life-2027",
    to: "alpe-village-centre",
    distanceMiles: 1.05,
    connectionLabel: "Piste return to resort base (ski) or gondola descent (pedestrian)",
    ski: { walkOrSkiMinutes: 9, liftMinutes: 0, baseQueueMinutes: 3 },
    pedestrian: { walkOrSkiMinutes: 8, liftMinutes: 12, baseQueueMinutes: 8 },
  },

  // Mountain-to-mountain links
  {
    from: "frozen-lotus-2027",
    to: "orbyz-2027",
    distanceMiles: 0.9,
    connectionLabel: "Inter-sector piste & chairlift (ski) or gondola transfer (pedestrian)",
    ski: { walkOrSkiMinutes: 8, liftMinutes: 8, baseQueueMinutes: 7 },
    pedestrian: { walkOrSkiMinutes: 10, liftMinutes: 16, baseQueueMinutes: 10 },
  },
  {
    from: "orbyz-2027",
    to: "frozen-lotus-2027",
    distanceMiles: 0.9,
    connectionLabel: "Inter-sector piste & Les Marmottes link (ski) or gondola transfer (pedestrian)",
    ski: { walkOrSkiMinutes: 8, liftMinutes: 8, baseQueueMinutes: 7 },
    pedestrian: { walkOrSkiMinutes: 10, liftMinutes: 16, baseQueueMinutes: 10 },
  },
  {
    from: "frozen-lotus-2027",
    to: "life-2027",
    distanceMiles: 0.8,
    connectionLabel: "Mountain piste link (ski) or gondola connection (pedestrian)",
    ski: { walkOrSkiMinutes: 7, liftMinutes: 7, baseQueueMinutes: 6 },
    pedestrian: { walkOrSkiMinutes: 9, liftMinutes: 14, baseQueueMinutes: 9 },
  },
  {
    from: "life-2027",
    to: "frozen-lotus-2027",
    distanceMiles: 0.8,
    connectionLabel: "Mountain piste link (ski) or gondola connection (pedestrian)",
    ski: { walkOrSkiMinutes: 7, liftMinutes: 7, baseQueueMinutes: 6 },
    pedestrian: { walkOrSkiMinutes: 9, liftMinutes: 14, baseQueueMinutes: 9 },
  },
  {
    from: "orbyz-2027",
    to: "life-2027",
    distanceMiles: 0.75,
    connectionLabel: "Upper-mountain traverse (ski) or lift transfer (pedestrian)",
    ski: { walkOrSkiMinutes: 7, liftMinutes: 6, baseQueueMinutes: 6 },
    pedestrian: { walkOrSkiMinutes: 9, liftMinutes: 13, baseQueueMinutes: 9 },
  },
  {
    from: "life-2027",
    to: "orbyz-2027",
    distanceMiles: 0.75,
    connectionLabel: "Upper-mountain traverse (ski) or lift transfer (pedestrian)",
    ski: { walkOrSkiMinutes: 7, liftMinutes: 6, baseQueueMinutes: 6 },
    pedestrian: { walkOrSkiMinutes: 9, liftMinutes: 13, baseQueueMinutes: 9 },
  },

  // Village hub <-> Moose Bar
  {
    from: "alpe-village-centre",
    to: "moose-bar-2027",
    distanceMiles: 0.3,
    connectionLabel: "Snow-front footpath / Télécentre town lift",
    ski: { walkOrSkiMinutes: 6, liftMinutes: 0, baseQueueMinutes: 4 },
    pedestrian: { walkOrSkiMinutes: 7, liftMinutes: 0, baseQueueMinutes: 4 },
  },
  {
    from: "moose-bar-2027",
    to: "alpe-village-centre",
    distanceMiles: 0.3,
    connectionLabel: "Snow-front footpath / Télécentre town lift",
    ski: { walkOrSkiMinutes: 6, liftMinutes: 0, baseQueueMinutes: 3 },
    pedestrian: { walkOrSkiMinutes: 7, liftMinutes: 0, baseQueueMinutes: 3 },
  },

  // Village hub <-> Main Festival Area (MainStage, Cage, Planaxis)
  {
    from: "alpe-village-centre",
    to: "mainstage-2027",
    distanceMiles: 0.45,
    connectionLabel: "Village footpath / free Resalp shuttle + Main Entrance security",
    ski: { walkOrSkiMinutes: 10, liftMinutes: 0, baseQueueMinutes: 8 },
    pedestrian: { walkOrSkiMinutes: 10, liftMinutes: 0, baseQueueMinutes: 8 },
  },
  {
    from: "mainstage-2027",
    to: "alpe-village-centre",
    distanceMiles: 0.45,
    connectionLabel: "Village footpath / free Resalp shuttle",
    ski: { walkOrSkiMinutes: 10, liftMinutes: 0, baseQueueMinutes: 4 },
    pedestrian: { walkOrSkiMinutes: 10, liftMinutes: 0, baseQueueMinutes: 4 },
  },
  {
    from: "moose-bar-2027",
    to: "mainstage-2027",
    distanceMiles: 0.35,
    connectionLabel: "Snow-front walk to Main Festival Area entrance",
    ski: { walkOrSkiMinutes: 8, liftMinutes: 0, baseQueueMinutes: 7 },
    pedestrian: { walkOrSkiMinutes: 8, liftMinutes: 0, baseQueueMinutes: 7 },
  },
  {
    from: "mainstage-2027",
    to: "moose-bar-2027",
    distanceMiles: 0.35,
    connectionLabel: "Walk from Main Festival Area to snow front",
    ski: { walkOrSkiMinutes: 8, liftMinutes: 0, baseQueueMinutes: 4 },
    pedestrian: { walkOrSkiMinutes: 8, liftMinutes: 0, baseQueueMinutes: 4 },
  },

  // Intra-main-festival-area links (MainStage <-> Cage <-> Planaxis)
  {
    from: "mainstage-2027",
    to: "cage-2027",
    distanceMiles: 0.14,
    connectionLabel: "Main festival area walkway",
    ski: { walkOrSkiMinutes: 4, liftMinutes: 0, baseQueueMinutes: 3 },
    pedestrian: { walkOrSkiMinutes: 4, liftMinutes: 0, baseQueueMinutes: 3 },
  },
  {
    from: "cage-2027",
    to: "mainstage-2027",
    distanceMiles: 0.14,
    connectionLabel: "Main festival area walkway",
    ski: { walkOrSkiMinutes: 4, liftMinutes: 0, baseQueueMinutes: 4 },
    pedestrian: { walkOrSkiMinutes: 4, liftMinutes: 0, baseQueueMinutes: 4 },
  },
  {
    from: "mainstage-2027",
    to: "planaxis-2027",
    distanceMiles: 0.16,
    connectionLabel: "Main festival area walkway",
    ski: { walkOrSkiMinutes: 5, liftMinutes: 0, baseQueueMinutes: 3 },
    pedestrian: { walkOrSkiMinutes: 5, liftMinutes: 0, baseQueueMinutes: 3 },
  },
  {
    from: "planaxis-2027",
    to: "mainstage-2027",
    distanceMiles: 0.16,
    connectionLabel: "Main festival area walkway",
    ski: { walkOrSkiMinutes: 5, liftMinutes: 0, baseQueueMinutes: 4 },
    pedestrian: { walkOrSkiMinutes: 5, liftMinutes: 0, baseQueueMinutes: 4 },
  },
  {
    from: "cage-2027",
    to: "planaxis-2027",
    distanceMiles: 0.12,
    connectionLabel: "Main festival area walkway",
    ski: { walkOrSkiMinutes: 3, liftMinutes: 0, baseQueueMinutes: 2 },
    pedestrian: { walkOrSkiMinutes: 3, liftMinutes: 0, baseQueueMinutes: 2 },
  },
  {
    from: "planaxis-2027",
    to: "cage-2027",
    distanceMiles: 0.12,
    connectionLabel: "Main festival area walkway",
    ski: { walkOrSkiMinutes: 3, liftMinutes: 0, baseQueueMinutes: 2 },
    pedestrian: { walkOrSkiMinutes: 3, liftMinutes: 0, baseQueueMinutes: 2 },
  },

  // Oz 3300 <-> Alpe d'Huez Village Centre (lift-linked; ~20 min ride)
  {
    from: "oz-3300",
    to: "alpe-village-centre",
    distanceMiles: 2.3,
    connectionLabel: "Oz 3300 gondola / night lift connection (~20 min ride)",
    ski: { walkOrSkiMinutes: 6, liftMinutes: 20, baseQueueMinutes: 8 },
    pedestrian: { walkOrSkiMinutes: 7, liftMinutes: 20, baseQueueMinutes: 9 },
  },
  {
    from: "alpe-village-centre",
    to: "oz-3300",
    distanceMiles: 2.3,
    connectionLabel: "Oz 3300 gondola / night lift connection (~20 min ride)",
    ski: { walkOrSkiMinutes: 6, liftMinutes: 20, baseQueueMinutes: 8 },
    pedestrian: { walkOrSkiMinutes: 7, liftMinutes: 20, baseQueueMinutes: 9 },
  },
];

export const WINTER_OFFICIAL_LINKS = [
  {
    label: "Alpe d'Huez official ski area & lift status",
    url: "https://skipass.alpedhuez.com/",
  },
  {
    label: "Tomorrowland Winter: opening hours & last lifts",
    url: "https://winter.tomorrowland.com/en/practical/opening-hours/",
  },
  {
    label: "Tomorrowland Winter: at the festival (pedestrian access)",
    url: "https://winter.tomorrowland.com/en/practical/at-the-festival/",
  },
] as const;
