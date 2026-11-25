import { belgiumFacts } from "@/data/belgium/facts";

/**
 * Schematic planning maps for Tomorrowland Belgium: De Schorre (festival grounds)
 * and DreamVille (camping & accommodation).
 *
 * IMPORTANT: These are original, simplified schematic diagrams built solely for
 * trip planning. They are NOT official Tomorrowland maps, and distances/times
 * are rough planning estimates. Note also that `src/data/belgium/stages.ts`
 * intentionally holds no 2027 stage list because the organiser has not yet
 * published the 2027 lineup of 16 stages (`belgiumFacts.headlineStats`).
 */

export type VenueMapId = "de-schorre" | "dreamville";

export type MapNodeCategory = "stage" | "entrance" | "camp" | "hub";

export interface SchematicMapNode {
  readonly id: string;
  readonly name: string;
  readonly shortLabel: string;
  readonly category: MapNodeCategory;
  /** Schematic SVG coordinates on an 800 x 500 canvas. */
  readonly x: number;
  readonly y: number;
  /** Short plain-English orientation note. */
  readonly summary: string;
}

export interface SchematicMapEdge {
  readonly from: string;
  readonly to: string;
  /** Approximate footpath distance in miles (UK English — never km). */
  readonly distanceMiles: number;
  /** Normal-flow walking time in minutes. */
  readonly walkMinutes: number;
  /** Multiplier applied during peak set changeovers or closing exodus. */
  readonly peakMultiplier: number;
  /** Optional bottleneck note shown when this edge is part of a route. */
  readonly bottleneckNote?: string;
}

export interface SchematicBackdropShape {
  readonly id: string;
  readonly kind: "water" | "woods" | "meadow";
  readonly label?: string;
  readonly labelX?: number;
  readonly labelY?: number;
  readonly path: string;
}

export interface SchematicMapConfig {
  readonly id: VenueMapId;
  readonly title: string;
  readonly subtitle: string;
  readonly canvasLabel: string;
  readonly defaultFrom: string;
  readonly defaultTo: string;
  readonly nodes: readonly SchematicMapNode[];
  readonly edges: readonly SchematicMapEdge[];
  readonly backdrop: readonly SchematicBackdropShape[];
  readonly stageNote: string;
}

export const MAP_SCHEMATIC_DISCLAIMER =
  "Schematic planning estimate — not an official Tomorrowland map. Distances are approximate footpath estimates in miles and walking times vary significantly with crowd density, weather, and one-way crowd-control systems.";

export const DE_SCHORRE_MAP: SchematicMapConfig = {
  id: "de-schorre",
  title: "De Schorre (Festival Grounds)",
  subtitle: `${belgiumFacts.festival.venue.value.name}, ${belgiumFacts.festival.venue.value.locality} — schematic layout of key landmark zones`,
  canvasLabel:
    "Schematic diagram of De Schorre festival grounds showing eight key landmark zones and footpaths",
  defaultFrom: "main-entrance",
  defaultTo: "mainstage",
  stageNote: `The official 2027 homepage states the festival has ${belgiumFacts.headlineStats.value.stages} stages, but has not yet published the 2027 stage list. The landmarks below represent typical De Schorre zones for walking-time planning only.`,
  backdrop: [
    {
      id: "central-lake",
      kind: "water",
      label: "Central ponds",
      labelX: 390,
      labelY: 258,
      path: "M 300 220 C 335 190, 445 190, 480 230 C 505 260, 470 310, 415 315 C 350 320, 275 280, 300 220 Z",
    },
    {
      id: "core-woods",
      kind: "woods",
      label: "Wooded valley",
      labelX: 225,
      labelY: 395,
      path: "M 150 330 C 195 315, 285 335, 305 385 C 315 420, 255 450, 185 435 C 140 420, 125 355, 150 330 Z",
    },
    {
      id: "amphitheatre",
      kind: "meadow",
      label: "Amphitheatre bowl",
      labelX: 650,
      labelY: 345,
      path: "M 565 285 C 620 250, 725 270, 745 340 C 755 395, 690 445, 610 430 C 555 415, 535 330, 565 285 Z",
    },
  ],
  nodes: [
    {
      id: "main-entrance",
      name: "Main Entrance",
      shortLabel: "Main Entrance",
      category: "entrance",
      x: 92,
      y: 265,
      summary: "Day-visitor entrance on the western edge of De Schorre.",
    },
    {
      id: "freedom",
      name: "Freedom",
      shortLabel: "Freedom",
      category: "stage",
      x: 195,
      y: 125,
      summary: "North-west indoor hall zone, typically near the day-visitor approach.",
    },
    {
      id: "atmosphere",
      name: "Atmosphere",
      shortLabel: "Atmosphere",
      category: "stage",
      x: 390,
      y: 95,
      summary: "Northern big-top tent zone above the central water.",
    },
    {
      id: "core",
      name: "Core",
      shortLabel: "Core",
      category: "stage",
      x: 230,
      y: 375,
      summary: "Wooded south-west grove reached via narrower park paths.",
    },
    {
      id: "crystal-garden",
      name: "Crystal Garden",
      shortLabel: "Crystal Garden",
      category: "stage",
      x: 390,
      y: 255,
      summary: "Central floating/waterside zone linking the western and eastern halves.",
    },
    {
      id: "the-library",
      name: "The Library",
      shortLabel: "The Library",
      category: "stage",
      x: 545,
      y: 195,
      summary: "East-central open-air stage zone on the approach towards the Mainstage.",
    },
    {
      id: "dreamville-entrance",
      name: "DreamVille Entrance",
      shortLabel: "DreamVille Gate",
      category: "entrance",
      x: 690,
      y: 115,
      summary: "North-east festival entrance connecting to the DreamVille footpath.",
    },
    {
      id: "mainstage",
      name: "Mainstage",
      shortLabel: "Mainstage",
      category: "stage",
      x: 650,
      y: 355,
      summary: "South-east amphitheatre bowl — the largest crowd hub on site.",
    },
  ],
  edges: [
    {
      from: "main-entrance",
      to: "freedom",
      distanceMiles: 0.22,
      walkMinutes: 6,
      peakMultiplier: 1.5,
      bottleneckNote: "Entry security and wristband lanes can slow movement near the Main Entrance.",
    },
    {
      from: "main-entrance",
      to: "core",
      distanceMiles: 0.28,
      walkMinutes: 7,
      peakMultiplier: 1.45,
    },
    {
      from: "main-entrance",
      to: "crystal-garden",
      distanceMiles: 0.35,
      walkMinutes: 9,
      peakMultiplier: 1.55,
      bottleneckNote: "The central boardwalk bridges narrow sharply during sunset changeovers.",
    },
    {
      from: "freedom",
      to: "atmosphere",
      distanceMiles: 0.24,
      walkMinutes: 6,
      peakMultiplier: 1.45,
    },
    {
      from: "freedom",
      to: "crystal-garden",
      distanceMiles: 0.27,
      walkMinutes: 7,
      peakMultiplier: 1.55,
      bottleneckNote: "Freedom exits funnel onto the northern lakeside path after big sets.",
    },
    {
      from: "atmosphere",
      to: "crystal-garden",
      distanceMiles: 0.22,
      walkMinutes: 6,
      peakMultiplier: 1.5,
    },
    {
      from: "atmosphere",
      to: "the-library",
      distanceMiles: 0.26,
      walkMinutes: 7,
      peakMultiplier: 1.45,
    },
    {
      from: "core",
      to: "crystal-garden",
      distanceMiles: 0.26,
      walkMinutes: 7,
      peakMultiplier: 1.5,
      bottleneckNote: "The wooded paths out of Core are narrower than the main park promenade.",
    },
    {
      from: "crystal-garden",
      to: "the-library",
      distanceMiles: 0.24,
      walkMinutes: 6,
      peakMultiplier: 1.6,
      bottleneckNote: "Central bridges between Crystal Garden and The Library are a major pinch point.",
    },
    {
      from: "crystal-garden",
      to: "mainstage",
      distanceMiles: 0.36,
      walkMinutes: 10,
      peakMultiplier: 1.75,
      bottleneckNote: "The hill descent and approach to Mainstage can switch to one-way crowd control.",
    },
    {
      from: "the-library",
      to: "dreamville-entrance",
      distanceMiles: 0.25,
      walkMinutes: 7,
      peakMultiplier: 1.55,
      bottleneckNote: "Heavy two-way foot traffic builds here from 17:00 when DreamVille crossings open.",
    },
    {
      from: "the-library",
      to: "mainstage",
      distanceMiles: 0.25,
      walkMinutes: 7,
      peakMultiplier: 1.7,
      bottleneckNote: "Headliner changeovers between The Library and Mainstage create dense queues.",
    },
    {
      from: "dreamville-entrance",
      to: "mainstage",
      distanceMiles: 0.34,
      walkMinutes: 9,
      peakMultiplier: 1.8,
      bottleneckNote: "Expect slow-moving crowds along the DreamVille side of the Mainstage at closing.",
    },
  ],
};

export const DREAMVILLE_MAP: SchematicMapConfig = {
  id: "dreamville",
  title: "DreamVille (Camping & Accommodation)",
  subtitle: "Schematic layout of DreamVille districts and the walk to the festival gate",
  canvasLabel:
    "Schematic diagram of DreamVille showing six accommodation and hub zones connected to the festival entrance",
  defaultFrom: "magnificent-greens",
  defaultTo: "festival-entrance",
  stageNote: `DreamVille opens ${belgiumFacts.dreamville.openingWindow.value.opensOnDay} at ${belgiumFacts.dreamville.openingWindow.value.opensAt} and closes ${belgiumFacts.dreamville.openingWindow.value.closesOnDay} at ${belgiumFacts.dreamville.openingWindow.value.closesAt}. Walking times below depend on which pitch row you camp in — far corners of Magnificent Greens can add 5–10 minutes.`,
  backdrop: [
    {
      id: "mg-fields",
      kind: "meadow",
      label: "Camping fields",
      labelX: 175,
      labelY: 255,
      path: "M 70 115 C 145 85, 290 105, 315 210 C 335 305, 250 405, 130 390 C 60 375, 40 165, 70 115 Z",
    },
    {
      id: "montagoe-grounds",
      kind: "woods",
      label: "Lodge grounds",
      labelX: 585,
      labelY: 165,
      path: "M 510 100 C 565 80, 660 95, 675 165 C 685 215, 610 245, 535 225 C 495 210, 480 130, 510 100 Z",
    },
  ],
  nodes: [
    {
      id: "magnificent-greens",
      name: "Magnificent Greens",
      shortLabel: "Magnificent Greens",
      category: "camp",
      x: 135,
      y: 250,
      summary: "Pitch-your-own camping fields at the outer edge of DreamVille.",
    },
    {
      id: "friendship-garden",
      name: "Friendship Garden",
      shortLabel: "Friendship Garden",
      category: "camp",
      x: 285,
      y: 365,
      summary: "Reserved group camping sector south of the main Marketplace spine.",
    },
    {
      id: "marketplace",
      name: "Marketplace",
      shortLabel: "Marketplace",
      category: "hub",
      x: 335,
      y: 215,
      summary: "Central DreamVille spine with shops, food, bakery, and meeting points.",
    },
    {
      id: "easy-tent",
      name: "Easy Tent",
      shortLabel: "Easy Tent",
      category: "camp",
      x: 495,
      y: 340,
      summary: "Pre-pitched DreamVille tent district closer to the festival walkway.",
    },
    {
      id: "montagoe",
      name: "Montagoe",
      shortLabel: "Montagoe",
      category: "camp",
      x: 565,
      y: 165,
      summary: "Lodges, cabanas, and Relax Rooms — shortest walk to the festival entrance.",
    },
    {
      id: "festival-entrance",
      name: "Festival Entrance",
      shortLabel: "Festival Gate",
      category: "entrance",
      x: 705,
      y: 255,
      summary: "DreamVille exit walkway leading towards the De Schorre festival grounds.",
    },
  ],
  edges: [
    {
      from: "magnificent-greens",
      to: "marketplace",
      distanceMiles: 0.32,
      walkMinutes: 8,
      peakMultiplier: 1.45,
      bottleneckNote: "Morning coffee runs and midday festival departures crowd the Marketplace spine.",
    },
    {
      from: "magnificent-greens",
      to: "friendship-garden",
      distanceMiles: 0.25,
      walkMinutes: 6,
      peakMultiplier: 1.35,
    },
    {
      from: "friendship-garden",
      to: "marketplace",
      distanceMiles: 0.22,
      walkMinutes: 6,
      peakMultiplier: 1.4,
    },
    {
      from: "friendship-garden",
      to: "easy-tent",
      distanceMiles: 0.28,
      walkMinutes: 7,
      peakMultiplier: 1.45,
    },
    {
      from: "marketplace",
      to: "easy-tent",
      distanceMiles: 0.26,
      walkMinutes: 7,
      peakMultiplier: 1.5,
      bottleneckNote: "Foot traffic thickens where the Marketplace joins the main corridor to the gate.",
    },
    {
      from: "marketplace",
      to: "montagoe",
      distanceMiles: 0.3,
      walkMinutes: 8,
      peakMultiplier: 1.4,
    },
    {
      from: "easy-tent",
      to: "festival-entrance",
      distanceMiles: 0.35,
      walkMinutes: 9,
      peakMultiplier: 1.7,
      bottleneckNote: "The DreamVille–festival walkway slows heavily between 12:00–14:00 and after closing.",
    },
    {
      from: "montagoe",
      to: "festival-entrance",
      distanceMiles: 0.22,
      walkMinutes: 6,
      peakMultiplier: 1.6,
      bottleneckNote: "Security checks at the DreamVille festival gate add queue time at peak entry.",
    },
    {
      from: "easy-tent",
      to: "montagoe",
      distanceMiles: 0.24,
      walkMinutes: 6,
      peakMultiplier: 1.35,
    },
  ],
};

export const VENUE_MAPS: Readonly<Record<VenueMapId, SchematicMapConfig>> = {
  "de-schorre": DE_SCHORRE_MAP,
  dreamville: DREAMVILLE_MAP,
};

export const VENUE_MAP_ORDER: readonly VenueMapId[] = ["de-schorre", "dreamville"];
