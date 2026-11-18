import type { Stage } from "../schemas";

/**
 * Winter 2027 stages.
 *
 * The seven names come from the official 2027 line-up release, which
 * `docs/factcheck/winter.md` records in its verified Gaps section (item 6):
 * Orbyz, Frozen Lotus and Life by day; MainStage, Cage and Planaxis at night;
 * Moose Bar.
 *
 * No official statement classifies any 2027 stage beyond MainStage as covered,
 * heated or open-air — the "indoor and heated" description in our notes belongs
 * to the 2025 line-up and is marked `outdated` — so every stage except the
 * MainStage is typed `other` rather than asserting a structure nobody has
 * published.
 */
export const winterStages: readonly Stage[] = [
  {
    id: "mainstage-2027",
    edition: "winter",
    name: "MainStage",
    kind: "mainstage",
    description:
      "The night stage at the main festival area in the village. Official description: a covered and heated MainStage. Open Tuesday 23 to Friday 26 March 2027 and closed Saturday 20 to Monday 22 March. The main festival area runs 19:00 to 01:30 on Tuesday to Friday and 19:00 to 00:00 on Saturday to Monday.",
    source: {
      url: "https://winter.tomorrowland.com/en/practical/opening-hours/",
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "cage-2027",
    edition: "winter",
    name: "Cage",
    kind: "other",
    description:
      "Night stage at the main festival area, named in the official 2027 line-up release alongside the MainStage and Planaxis. The release does not describe its structure or capacity.",
    source: {
      url: "https://press.winter.tomorrowland.com/from-midday-to-mainstage-tomorrowland-winter-2027-reveals-its-full-line-up",
      title: "From midday to MainStage: Tomorrowland Winter 2027 reveals its full line-up",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "planaxis-2027",
    edition: "winter",
    name: "Planaxis",
    kind: "other",
    description:
      "Night stage at the main festival area, named in the official 2027 line-up release alongside the MainStage and Cage. The release does not describe its structure or capacity.",
    source: {
      url: "https://press.winter.tomorrowland.com/from-midday-to-mainstage-tomorrowland-winter-2027-reveals-its-full-line-up",
      title: "From midday to MainStage: Tomorrowland Winter 2027 reveals its full line-up",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "orbyz-2027",
    edition: "winter",
    name: "Orbyz",
    kind: "other",
    description:
      "Daytime stage in the 2027 line-up. The official release groups Orbyz with Frozen Lotus and Life as the daytime programme, before the festival moves to the village stages in the evening.",
    source: {
      url: "https://press.winter.tomorrowland.com/from-midday-to-mainstage-tomorrowland-winter-2027-reveals-its-full-line-up",
      title: "From midday to MainStage: Tomorrowland Winter 2027 reveals its full line-up",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "frozen-lotus-2027",
    edition: "winter",
    name: "Frozen Lotus",
    kind: "other",
    description:
      "Daytime mountain stage in the 2027 line-up, reached with the Les Marmottes 1 lift from Bergers to the Marmottes 2300 station. Pedestrians can reach it with the lift and ski pass, which every ticket includes.",
    source: {
      url: "https://winter.tomorrowland.com/en/add-on-sale/food-experiences/frozen-lotus/",
      title: "Tomorrowland Winter: Frozen Lotus food experience",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "life-2027",
    edition: "winter",
    name: "Life",
    kind: "other",
    description:
      "Daytime stage in the 2027 line-up. The official release groups Life with Orbyz and Frozen Lotus as the daytime programme, before the festival moves to the village stages in the evening.",
    source: {
      url: "https://press.winter.tomorrowland.com/from-midday-to-mainstage-tomorrowland-winter-2027-reveals-its-full-line-up",
      title: "From midday to MainStage: Tomorrowland Winter 2027 reveals its full line-up",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
  {
    id: "moose-bar-2027",
    edition: "winter",
    name: "Moose Bar",
    kind: "other",
    description:
      "Named in the official 2027 line-up release. The 2027 opening-hours page lists a daytime Moosebar slot from 15:00 to 19:30, Saturday to Friday; no night-time Moosebar hours are published.",
    source: {
      url: "https://winter.tomorrowland.com/en/practical/opening-hours/",
      title: "Tomorrowland Winter: opening hours",
      retrievedOn: "2026-11-18",
    },
    lastVerified: "2026-11-18",
    confidence: "official",
  },
];
